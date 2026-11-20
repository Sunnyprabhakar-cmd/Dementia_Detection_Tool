"""Reproducible 3D Brain MRI acquisition, validation, feature extraction, and training pipeline.

Uses anonymized 3D T1-weighted MPRAGE NIfTI volumes from `radiata-ai/brain-structure`
(OASIS-1 and OASIS-2 subsets, licensed under ODC-By v1.0 / OASIS terms).
Strictly experimental research proof-of-concept; not a clinical diagnostic model.
"""

from __future__ import annotations

import csv
import hashlib
import io
import json
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import nibabel as nib
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from Backend.ml.model_contract import BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION
from Backend.ml.preprocessing.feature_engineering import participant_level_split

HF_BASE = "https://huggingface.co/datasets/radiata-ai/brain-structure/resolve/main"
TARGET_STUDIES = {"OASIS-1", "OASIS-2"}


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _wilson_ci(k: int, n: int, z: float = 1.96) -> list[float]:
    if n == 0:
        return [0.0, 0.0]
    p = k / n
    denom = 1.0 + z * z / n
    center = (p + z * z / (2.0 * n)) / denom
    half = (z * np.sqrt((p * (1.0 - p) + z * z / (4.0 * n)) / n)) / denom
    return [round(float(max(0.0, center - half)), 4), round(float(min(1.0, center + half)), 4)]


def _eval_binary(y_true: np.ndarray, probs: np.ndarray, threshold: float = 0.50) -> dict[str, Any]:
    preds = (probs >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, preds, labels=[0, 1]).ravel()
    spec = float(tn / (tn + fp)) if (tn + fp) else 0.0
    n = int(len(y_true))
    acc = float(accuracy_score(y_true, preds))
    return {
        "n_samples": n,
        "accuracy": round(acc, 4),
        "accuracy_wilson_95ci": _wilson_ci(int(tp + tn), n),
        "precision": round(float(precision_score(y_true, preds, zero_division=0)), 4),
        "recall_sensitivity": round(float(recall_score(y_true, preds, zero_division=0)), 4),
        "specificity": round(spec, 4),
        "f1": round(float(f1_score(y_true, preds, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y_true, probs)), 4) if len(np.unique(y_true)) > 1 else None,
        "pr_auc": round(float(average_precision_score(y_true, probs)), 4) if len(np.unique(y_true)) > 1 else None,
        "confusion_matrix": [[int(tn), int(fp)], [int(fn), int(tp)]],
    }


def extract_3d_mri_representation(nifti_path: Path) -> dict[str, Any]:
    """Load a 3D NIfTI volume, validate shape/intensity, and extract volumetric features + tensors."""
    img = nib.load(str(nifti_path))
    data = np.asarray(img.get_fdata(dtype=np.float32))
    if data.ndim == 4:
        data = data[..., 0]
    if data.ndim != 3 or min(data.shape) < 16:
        raise ValueError(f"Invalid 3D MRI shape: {data.shape}")
    if not np.all(np.isfinite(data)):
        data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    nonzero = data[data > 0]
    if nonzero.size < 1000:
        raise ValueError("MRI volume has insufficient brain foreground voxels.")

    mean_nz = float(np.mean(nonzero))
    std_nz = float(np.std(nonzero)) or 1.0
    norm = np.where(data > 0, (data - mean_nz) / std_nz, 0.0).astype(np.float32)

    nx, ny, nz = norm.shape
    cx, cy, cz = nx // 2, ny // 2, nz // 2

    # Interpretable 3D morphometric & regional intensity summary (27 features)
    brain_mask = data > (0.05 * float(np.max(nonzero)))
    brain_ratio = float(np.mean(brain_mask))
    left_mean = float(np.mean(norm[:cx, :, :]))
    right_mean = float(np.mean(norm[cx:, :, :]))
    hemi_asym = abs(left_mean - right_mean)

    # Central sub-volume (ventricular / medial temporal proxy)
    c_box = norm[nx // 4 : 3 * nx // 4, ny // 4 : 3 * ny // 4, nz // 4 : 3 * nz // 4]
    c_raw = data[nx // 4 : 3 * nx // 4, ny // 4 : 3 * ny // 4, nz // 4 : 3 * nz // 4]
    central_low_ratio = float(np.mean(c_raw < (0.25 * mean_nz)))

    # 3x3x2 coarse spatial grid means (18 features)
    grid_feats: list[float] = []
    xs = np.array_split(np.arange(nx), 3)
    ys = np.array_split(np.arange(ny), 3)
    zs = np.array_split(np.arange(nz), 2)
    for xi in xs:
        for yi in ys:
            for zi in zs:
                grid_feats.append(float(np.mean(norm[np.ix_(xi, yi, zi)])))

    gx, gy, gz = np.gradient(norm)
    grad_energy = float(np.mean(np.sqrt(gx * gx + gy * gy + gz * gz)))

    features = {
        "brain_foreground_ratio": round(brain_ratio, 6),
        "nonzero_intensity_cv": round(std_nz / (abs(mean_nz) + 1e-6), 6),
        "nonzero_p10": round(float(np.percentile(nonzero, 10) / (mean_nz + 1e-6)), 6),
        "nonzero_p50": round(float(np.percentile(nonzero, 50) / (mean_nz + 1e-6)), 6),
        "nonzero_p90": round(float(np.percentile(nonzero, 90) / (mean_nz + 1e-6)), 6),
        "hemisphere_asymmetry": round(hemi_asym, 6),
        "central_low_intensity_ratio": round(central_low_ratio, 6),
        "central_norm_mean": round(float(np.mean(c_box)), 6),
        "gradient_energy_mean": round(grad_energy, 6),
        **{f"grid_{i}": round(v, 6) for i, v in enumerate(grid_feats)},
    }

    # Tri-planar 2D mid-slices resized to 64x64
    t_vol = torch.from_numpy(norm).unsqueeze(0).unsqueeze(0)  # (1, 1, X, Y, Z)
    vol_3d = F.interpolate(t_vol, size=(32, 40, 32), mode="trilinear", align_corners=False).squeeze(0).numpy()

    s_ax = F.interpolate(torch.from_numpy(norm[:, :, cz]).unsqueeze(0).unsqueeze(0), size=(64, 64), mode="bilinear", align_corners=False).squeeze(0).squeeze(0)
    s_co = F.interpolate(torch.from_numpy(norm[:, cy, :]).unsqueeze(0).unsqueeze(0), size=(64, 64), mode="bilinear", align_corners=False).squeeze(0).squeeze(0)
    s_sa = F.interpolate(torch.from_numpy(norm[cx, :, :]).unsqueeze(0).unsqueeze(0), size=(64, 64), mode="bilinear", align_corners=False).squeeze(0).squeeze(0)
    slices_2d = torch.stack([s_ax, s_co, s_sa], dim=0).numpy()

    return {
        "shape": [int(nx), int(ny), int(nz)],
        "features": features,
        "slices_2d": slices_2d,
        "vol_3d": vol_3d,
    }


def download_and_prepare_radiata_oasis(raw_dir: Path, manifest_csv: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Download OASIS-1 and OASIS-2 3D NIfTI volumes from radiata-ai/brain-structure."""
    raw_dir.mkdir(parents=True, exist_ok=True)
    meta_url = f"{HF_BASE}/metadata.csv"
    txt = urllib.request.urlopen(meta_url, timeout=30).read().decode("utf-8", errors="replace")
    all_rows = [r for r in csv.DictReader(io.StringIO(txt)) if r.get("study") in TARGET_STUDIES]

    def _fetch_one(row: dict[str, str]) -> dict[str, Any] | None:
        rel_path = row["t1_local_path"]
        dest = raw_dir / rel_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        if not dest.is_file() or dest.stat().st_size < 1024:
            url = f"{HF_BASE}/{rel_path}"
            with urllib.request.urlopen(url, timeout=60) as resp:
                dest.write_bytes(resp.read())
        return {"row": row, "path": dest}

    downloaded: list[dict[str, Any]] = []
    failed = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = [pool.submit(_fetch_one, r) for r in all_rows]
        for fut in as_completed(futures):
            try:
                res = fut.result()
                if res is not None:
                    downloaded.append(res)
            except Exception:
                failed += 1

    seen_hashes: set[str] = set()
    dup_count = 0
    corrupt_count = 0
    records: list[dict[str, Any]] = []
    for item in sorted(downloaded, key=lambda x: x["row"]["t1_local_path"]):
        path = item["path"]
        r = item["row"]
        fhash = _sha256_file(path)
        if fhash in seen_hashes:
            dup_count += 1
            continue
        seen_hashes.add(fhash)
        try:
            rep = extract_3d_mri_representation(path)
        except Exception:
            corrupt_count += 1
            continue
        subj_hash = hashlib.sha256(f"{r['study']}:{r['participant_id']}".encode("utf-8")).hexdigest()[:16]
        diag = r["clinical_diagnosis"]
        records.append({
            "t1_local_path": str(path),
            "study": r["study"],
            "participant_hash": subj_hash,
            "clinical_diagnosis": diag,
            "target": 1 if diag == "Alzheimers_disease" else 0,
            "age": r.get("age"),
            "sex": r.get("sex"),
            "file_sha256": fhash,
            **rep["features"],
        })

    df = pd.DataFrame(records)
    manifest_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(manifest_csv, index=False)

    audit = {
        "total_oasis_metadata_rows": len(all_rows),
        "downloaded_ok": len(downloaded),
        "download_failed": failed,
        "valid_volumes": int(len(df)),
        "unique_participants": int(df["participant_hash"].nunique()) if not df.empty else 0,
        "duplicates_skipped": dup_count,
        "corrupt_skipped": corrupt_count,
        "class_distribution": df["clinical_diagnosis"].value_counts().to_dict() if not df.empty else {},
        "study_distribution": df["study"].value_counts().to_dict() if not df.empty else {},
    }
    return df, audit


class TriPlanar2DCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(3, 16, kernel_size=3, padding=1),
            nn.BatchNorm2d(16),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(16, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2),
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(64, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


class Light3DCNN(nn.Module):
    def __init__(self) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv3d(1, 12, kernel_size=3, padding=1),
            nn.BatchNorm3d(12),
            nn.ReLU(),
            nn.MaxPool3d(2),
            nn.Conv3d(12, 24, kernel_size=3, padding=1),
            nn.BatchNorm3d(24),
            nn.ReLU(),
            nn.MaxPool3d(2),
            nn.Conv3d(24, 48, kernel_size=3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool3d(1),
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(48, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x).squeeze(-1)


def _train_torch_binary(
    model: nn.Module,
    x_train: np.ndarray,
    y_train: np.ndarray,
    x_val: np.ndarray,
    y_val: np.ndarray,
    *,
    epochs: int = 18,
    batch_size: int = 24,
    lr: float = 1e-3,
    seed: int = 42,
) -> tuple[nn.Module, np.ndarray]:
    torch.manual_seed(seed)
    pos = max(1, int(np.sum(y_train == 1)))
    neg = max(1, int(np.sum(y_train == 0)))
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([neg / pos], dtype=torch.float32))
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-4)

    xt = torch.from_numpy(x_train.astype(np.float32))
    yt = torch.from_numpy(y_train.astype(np.float32))
    xv = torch.from_numpy(x_val.astype(np.float32))

    best_auc = -1.0
    best_state = {k: v.clone() for k, v in model.state_dict().items()}
    rng = np.random.default_rng(seed)

    for _ in range(epochs):
        model.train()
        perm = rng.permutation(len(xt))
        for start in range(0, len(xt), batch_size):
            idx = perm[start : start + batch_size]
            optimizer.zero_grad()
            logits = model(xt[idx])
            loss = criterion(logits, yt[idx])
            loss.backward()
            optimizer.step()

        model.eval()
        with torch.no_grad():
            val_probs = torch.sigmoid(model(xv)).numpy()
        val_auc = roc_auc_score(y_val, val_probs) if len(np.unique(y_val)) > 1 else 0.0
        if val_auc > best_auc:
            best_auc = val_auc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        final_val_probs = torch.sigmoid(model(xv)).numpy()
    return model, final_val_probs


def train_and_evaluate_mri_models(
    df: pd.DataFrame,
    audit: dict[str, Any],
    output_root: Path,
    model_version: str = "radiata-oasis-mri-v1.0.0",
    seed: int = 42,
) -> dict[str, Any]:
    """Train & compare 3D Volumetric LogReg, Tri-Planar 2D CNN, and Lightweight 3D CNN."""
    feature_cols = [
        "brain_foreground_ratio", "nonzero_intensity_cv", "nonzero_p10", "nonzero_p50", "nonzero_p90",
        "hemisphere_asymmetry", "central_low_intensity_ratio", "central_norm_mean", "gradient_energy_mean",
        *[f"grid_{i}" for i in range(18)],
    ]

    train_df, val_df, test_df = participant_level_split(df, group_col="participant_hash", target_col="target", random_state=seed)

    def _load_tensors(sub_df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
        s2d, v3d = [], []
        for p in sub_df["t1_local_path"]:
            rep = extract_3d_mri_representation(Path(p))
            s2d.append(rep["slices_2d"])
            v3d.append(rep["vol_3d"])
        return np.stack(s2d), np.stack(v3d)

    s2_tr, v3_tr = _load_tensors(train_df)
    s2_va, v3_va = _load_tensors(val_df)
    s2_te, v3_te = _load_tensors(test_df)

    y_tr = train_df["target"].to_numpy()
    y_va = val_df["target"].to_numpy()
    y_te = test_df["target"].to_numpy()

    # 1. Volumetric Logistic Regression (interpretable baseline)
    logreg = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced", random_state=seed)),
    ])
    logreg.fit(train_df[feature_cols], y_tr)
    lr_va_probs = logreg.predict_proba(val_df[feature_cols])[:, 1]
    lr_te_probs = logreg.predict_proba(test_df[feature_cols])[:, 1]

    # 2. Tri-Planar 2D CNN
    cnn2d, c2_va_probs = _train_torch_binary(TriPlanar2DCNN(), s2_tr, y_tr, s2_va, y_va, seed=seed)
    with torch.no_grad():
        c2_te_probs = torch.sigmoid(cnn2d(torch.from_numpy(s2_te.astype(np.float32)))).numpy()

    # 3. Lightweight 3D CNN
    cnn3d, c3_va_probs = _train_torch_binary(Light3DCNN(), v3_tr, y_tr, v3_va, y_va, seed=seed)
    with torch.no_grad():
        c3_te_probs = torch.sigmoid(cnn3d(torch.from_numpy(v3_te.astype(np.float32)))).numpy()

    comparison = {
        "volumetric_logreg": {
            "validation": _eval_binary(y_va, lr_va_probs),
            "test": _eval_binary(y_te, lr_te_probs),
        },
        "triplanar_2d_cnn": {
            "validation": _eval_binary(y_va, c2_va_probs),
            "test": _eval_binary(y_te, c2_te_probs),
        },
        "lightweight_3d_cnn": {
            "validation": _eval_binary(y_va, c3_va_probs),
            "test": _eval_binary(y_te, c3_te_probs),
        },
    }

    # Select best by validation ROC-AUC
    selected = max(comparison.keys(), key=lambda k: comparison[k]["validation"]["roc_auc"] or 0.0)

    bundle_dir = output_root / model_version
    bundle_dir.mkdir(parents=True, exist_ok=True)
    lr_path = bundle_dir / "volumetric_logreg.joblib"
    c2_path = bundle_dir / "triplanar_2d_cnn.pt"
    c3_path = bundle_dir / "lightweight_3d_cnn.pt"
    joblib.dump(logreg, lr_path)
    torch.save(cnn2d.state_dict(), c2_path)
    torch.save(cnn3d.state_dict(), c3_path)

    metadata = {
        "format": BUNDLE_FORMAT,
        "schema_version": BUNDLE_SCHEMA_VERSION,
        "model_version": model_version,
        "modality": "mri",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "seed": seed,
        "labels": ["0", "1"],
        "label_mapping": {"0": "cognitively_normal", "1": "Alzheimers_disease"},
        "selected_model": selected,
        "feature_schema": [{"name": c, "type": "number"} for c in feature_cols],
        "dataset": {
            "source": "radiata-ai/brain-structure (OASIS-1 & OASIS-2 T1w MPRAGE NIfTI)",
            "license": "ODC-By v1.0 (dataset compilation); OASIS-1 / OASIS-2 source DUA terms",
            "audit": audit,
            "splits": {
                "train_scans": int(len(train_df)),
                "train_participants": int(train_df["participant_hash"].nunique()),
                "val_scans": int(len(val_df)),
                "val_participants": int(val_df["participant_hash"].nunique()),
                "test_scans": int(len(test_df)),
                "test_participants": int(test_df["participant_hash"].nunique()),
            },
        },
        "models": {
            "volumetric_logreg": {"file": lr_path.name, "sha256": _sha256_file(lr_path), "metrics": comparison["volumetric_logreg"]},
            "triplanar_2d_cnn": {"file": c2_path.name, "sha256": _sha256_file(c2_path), "metrics": comparison["triplanar_2d_cnn"]},
            "lightweight_3d_cnn": {"file": c3_path.name, "sha256": _sha256_file(c3_path), "metrics": comparison["lightweight_3d_cnn"]},
        },
        "comparison": comparison,
        "limitations": [
            "This imaging model is an experimental research prototype and is not intended for clinical diagnosis. Results must be interpreted by qualified healthcare professionals.",
            "Trained on skull-stripped, MNI152-aligned T1-weighted MRI volumes from OASIS-1 and OASIS-2; does not include MCI or non-AD dementias.",
            "Uncalibrated relative scores are not diagnostic probabilities.",
        ],
    }
    (bundle_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
