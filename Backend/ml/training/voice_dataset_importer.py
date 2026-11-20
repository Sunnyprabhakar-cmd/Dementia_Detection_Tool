"""Reusable, privacy-safe voice dataset importer for authorized speech corpora (ADReSSo/Pitt/EWA-DB)."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from Backend.ml.preprocessing.audio_preprocessing import extract_acoustic_features, validate_wav_audio


ALLOWED_LABELS = {"0", "1", "nc", "cn", "control", "healthy", "mci", "ad", "dementia"}


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def import_voice_dataset_directory(
    dataset_dir: Path,
    *,
    metadata_csv: Path,
    audio_col: str = "audio_relpath",
    participant_col: str = "participant_id",
    label_col: str = "label",
    language_col: str = "language",
    dataset_version: str = "v1.0.0",
    output_dir: Path | None = None,
) -> dict[str, Any]:
    """Validate audio files, labels, participant IDs, duplicates, and generate a SHA-256 manifest."""
    if not dataset_dir.is_dir():
        raise FileNotFoundError(f"Dataset directory not found: {dataset_dir}")
    if not metadata_csv.is_file():
        raise FileNotFoundError(f"Metadata CSV not found: {metadata_csv}")

    df = pd.read_csv(metadata_csv)
    required = [audio_col, participant_col, label_col]
    missing_cols = [c for c in required if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Metadata CSV missing required columns: {', '.join(missing_cols)}")

    missing_values = {
        col: int(df[col].isna().sum()) for col in df.columns
    }
    duplicate_audio_rows = int(df.duplicated(subset=[audio_col]).sum())

    records: list[dict[str, Any]] = []
    rejected_files: list[dict[str, str]] = []
    label_distribution: dict[str, int] = {}
    unique_participants: set[str] = set()

    for idx, row in df.iterrows():
        raw_rel = str(row[audio_col] or "").strip()
        pid_raw = str(row[participant_col] or "").strip()
        lbl_raw = str(row[label_col] or "").strip().lower()
        lang_raw = str(row.get(language_col, "en") or "en").strip().lower()

        if not raw_rel or not pid_raw or lbl_raw not in ALLOWED_LABELS:
            rejected_files.append({"row": str(idx), "reason": "missing_or_invalid_metadata_or_label"})
            continue

        audio_path = (dataset_dir / raw_rel).resolve()
        if not str(audio_path).startswith(str(dataset_dir.resolve())) or not audio_path.is_file():
            rejected_files.append({"row": str(idx), "reason": "missing_or_unsafe_audio_path"})
            continue

        try:
            decoded = validate_wav_audio(audio_path)
            acoustic = extract_acoustic_features(decoded["samples"], decoded["sample_rate"])
        except Exception as err:
            rejected_files.append({"row": str(idx), "reason": f"audio_validation_failed:{type(err).__name__}"})
            continue

        pid_hash = hashlib.sha256(pid_raw.encode("utf-8")).hexdigest()[:16]
        unique_participants.add(pid_hash)
        label_distribution[lbl_raw] = label_distribution.get(lbl_raw, 0) + 1

        records.append({
            "participant_hash": pid_hash,
            "label": lbl_raw,
            "language": lang_raw,
            "audio_sha256": _sha256_file(audio_path),
            "sample_rate": decoded["sample_rate"],
            "duration_seconds": decoded["duration_seconds"],
            "quality_warnings": decoded.get("quality_warnings", []),
            "quality_reliable": len(decoded.get("quality_warnings", [])) == 0,
            **acoustic,
        })

    manifest = {
        "dataset_version": dataset_version,
        "imported_at": datetime.now(timezone.utc).isoformat(),
        "total_metadata_rows": int(len(df)),
        "valid_imported_recordings": len(records),
        "rejected_recordings": len(rejected_files),
        "unique_participants": len(unique_participants),
        "duplicate_audio_rows": duplicate_audio_rows,
        "missing_values_per_column": missing_values,
        "label_distribution": label_distribution,
        "rejected_reasons_summary": rejected_files[:25],
        "pii_notice": "Participant IDs are one-way hashed; raw filenames and personal metadata are excluded.",
    }

    if output_dir is not None:
        output_dir.mkdir(parents=True, exist_ok=True)
        features_df = pd.DataFrame(records)
        features_path = output_dir / f"voice_features_{dataset_version}.csv"
        features_df.to_csv(features_path, index=False)
        manifest["features_file"] = features_path.name
        manifest["features_sha256"] = _sha256_file(features_path)
        (output_dir / "dataset_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    return manifest
