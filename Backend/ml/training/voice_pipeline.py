"""Speaker-grouped voice model comparison pipeline (Milestone 3).

Supports comparing acoustic-only, linguistic-only, combined, and silence-only
control baselines on authorized speaker-labeled speech datasets (e.g., ADReSSo).
"""

from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC

from Backend.ml.model_contract import BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION
from Backend.ml.preprocessing.feature_engineering import participant_level_split


def _wilson_ci(successes: int, total: int, z: float = 1.96) -> list[float] | None:
    if total <= 0:
        return None
    p = successes / total
    denom = 1.0 + (z * z) / total
    center = (p + (z * z) / (2 * total)) / denom
    half = (z * math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denom
    return [round(max(0.0, center - half), 4), round(min(1.0, center + half), 4)]


def build_voice_candidates(random_state: int = 42) -> dict[str, Pipeline]:
    def make_pipe(est: Any) -> Pipeline:
        return Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("scaler", StandardScaler()),
            ("classifier", est),
        ])

    return {
        "logistic_regression": make_pipe(
            LogisticRegression(max_iter=2000, class_weight="balanced", random_state=random_state)
        ),
        "random_forest": make_pipe(
            RandomForestClassifier(
                n_estimators=200, max_depth=6, min_samples_leaf=2,
                class_weight="balanced", random_state=random_state,
            )
        ),
        "gradient_boosting": make_pipe(
            GradientBoostingClassifier(n_estimators=100, max_depth=3, random_state=random_state)
        ),
        "svm_rbf": make_pipe(
            SVC(kernel="rbf", probability=True, class_weight="balanced", random_state=random_state)
        ),
    }


def _eval_split(model: Any, X: pd.DataFrame, y: np.ndarray) -> dict[str, Any]:
    y_pred = model.predict(X)
    y_prob = model.predict_proba(X)[:, 1]
    cm = confusion_matrix(y, y_pred, labels=[0, 1])
    tn, fp, fn, tp = (int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1]))
    specificity = tn / max(1, tn + fp)
    return {
        "n_samples": int(len(y)),
        "accuracy": round(float(accuracy_score(y, y_pred)), 4),
        "accuracy_wilson_95ci": _wilson_ci(int(np.sum(y_pred == y)), int(len(y))),
        "precision": round(float(precision_score(y, y_pred, zero_division=0)), 4),
        "recall_sensitivity": round(float(recall_score(y, y_pred, zero_division=0)), 4),
        "specificity": round(float(specificity), 4),
        "f1": round(float(f1_score(y, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y, y_prob)), 4) if len(np.unique(y)) > 1 else None,
        "pr_auc": round(float(average_precision_score(y, y_prob)), 4) if len(np.unique(y)) > 1 else None,
        "brier_score": round(float(brier_score_loss(y, y_prob)), 4),
        "confusion_matrix": cm.tolist(),
    }


def run_voice_model_comparison(
    df: pd.DataFrame,
    *,
    speaker_col: str,
    target_col: str,
    acoustic_cols: list[str],
    linguistic_cols: list[str],
    silence_control_cols: list[str],
    output_dir: Path | None = None,
    model_version: str = "voice-research-v1.0.0",
    dataset_provenance: dict[str, Any] | None = None,
    random_state: int = 42,
) -> dict[str, Any]:
    """Compare acoustic, linguistic, combined, and silence-control baselines with speaker-level splits."""
    train_df, val_df, test_df = participant_level_split(
        df, group_col=speaker_col, target_col=target_col, random_state=random_state
    )
    assert set(train_df[speaker_col]).isdisjoint(set(test_df[speaker_col]))
    assert set(train_df[speaker_col]).isdisjoint(set(val_df[speaker_col]))

    feature_sets = {
        "acoustic_only": acoustic_cols,
        "linguistic_only": linguistic_cols,
        "combined": acoustic_cols + linguistic_cols,
        "silence_control": silence_control_cols,
    }

    y_train = train_df[target_col].to_numpy()
    y_test = test_df[target_col].to_numpy()
    results: dict[str, Any] = {}
    best_combined_lr = None
    best_combined_rf = None

    for fs_name, cols in feature_sets.items():
        if not cols:
            continue
        results[fs_name] = {}
        for model_name, pipe in build_voice_candidates(random_state=random_state).items():
            pipe.fit(train_df[cols], y_train)
            results[fs_name][model_name] = _eval_split(pipe, test_df[cols], y_test)
            if fs_name == "combined" and model_name == "logistic_regression":
                best_combined_lr = pipe
            if fs_name == "combined" and model_name == "random_forest":
                best_combined_rf = pipe

    report: dict[str, Any] = {
        "model_version": model_version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "splits": {
            "train_speakers": int(train_df[speaker_col].nunique()),
            "val_speakers": int(val_df[speaker_col].nunique()),
            "test_speakers": int(test_df[speaker_col].nunique()),
        },
        "comparison": results,
    }

    if output_dir is not None and best_combined_lr is not None and best_combined_rf is not None:
        bundle_dir = output_dir / model_version
        bundle_dir.mkdir(parents=True, exist_ok=True)
        models_meta: dict[str, Any] = {}
        for name, est in (("logistic_regression", best_combined_lr), ("random_forest", best_combined_rf)):
            path = bundle_dir / f"{name}.joblib"
            joblib.dump(est, path)
            models_meta[name] = {
                "file": path.name,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        bundle_meta = {
            "format": BUNDLE_FORMAT,
            "schema_version": BUNDLE_SCHEMA_VERSION,
            "model_version": model_version,
            "modality": "speech",
            "labels": ["0", "1"],
            "feature_schema": [{"name": c, "type": "number"} for c in (acoustic_cols + linguistic_cols)],
            "dataset": dataset_provenance or {},
            "models": models_meta,
            "comparison": results,
        }
        (bundle_dir / "metadata.json").write_text(json.dumps(bundle_meta, indent=2), encoding="utf-8")
        report["bundle_dir"] = str(bundle_dir)

    return report
