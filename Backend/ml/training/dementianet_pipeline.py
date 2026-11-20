"""Reproducible acoustic training & evaluation pipeline on DementiaNet WAV recordings.

Note: DementiaNet consists of public-figure YouTube interview clips with weak
biographical labels (dementia vs nodementia). Models trained here are strictly
experimental proof-of-concept research models, NOT clinically validated diagnostics.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np
import pandas as pd

from Backend.ml.model_contract import BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION
from Backend.ml.preprocessing.audio_preprocessing import extract_acoustic_features, validate_wav_audio
from Backend.ml.preprocessing.feature_engineering import participant_level_split
from Backend.ml.training.voice_pipeline import _eval_split, build_voice_candidates


ACOUSTIC_FEATURE_COLS = [
    "voiced_frame_ratio", "voiced_unvoiced_ratio",
    "energy_rms_mean", "energy_rms_std", "zcr_mean",
    "spectral_centroid_hz", "spectral_bandwidth_hz", "spectral_rolloff_hz",
    "pitch_mean_hz", "pitch_median_hz", "pitch_std_hz", "pitch_range_hz",
    "jitter_local", "shimmer_local", "hnr_mean_db",
    "waveform_silence_ratio", "waveform_pause_count", "waveform_mean_pause_seconds",
    *[f"mfcc_{i}_mean" for i in range(1, 14)],
    *[f"mfcc_{i}_std" for i in range(1, 14)],
]

SILENCE_CONTROL_COLS = [
    "waveform_silence_ratio",
    "waveform_pause_count",
    "waveform_mean_pause_seconds",
]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extract_dementianet_features(raw_dir: Path, cache_csv: Path | None = None) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Validate and extract acoustic features from DementiaNet dementia/ and nodementia/ WAVs."""
    rows: list[dict[str, Any]] = []
    seen_hashes: set[str] = set()
    corrupt_count = 0
    duplicate_count = 0

    for label_name, target in (("nodementia", 0), ("dementia", 1)):
        label_dir = raw_dir / label_name
        if not label_dir.is_dir():
            continue
        for wav_path in sorted(label_dir.rglob("*.wav")):
            speaker_name = wav_path.parent.name
            speaker_hash = hashlib.sha256(f"{label_name}:{speaker_name}".encode("utf-8")).hexdigest()[:16]
            file_hash = _sha256_file(wav_path)
            if file_hash in seen_hashes:
                duplicate_count += 1
                continue
            seen_hashes.add(file_hash)

            try:
                decoded = validate_wav_audio(wav_path, min_duration_sec=0.5)
                acoustic = extract_acoustic_features(decoded["samples"], decoded["sample_rate"])
            except Exception:
                corrupt_count += 1
                continue

            rows.append({
                "speaker_hash": speaker_hash,
                "label_name": label_name,
                "target": target,
                "sample_rate": decoded["sample_rate"],
                "duration_seconds": decoded["duration_seconds"],
                **{k: acoustic.get(k) for k in ACOUSTIC_FEATURE_COLS},
            })

    df = pd.DataFrame(rows)
    if cache_csv is not None and not df.empty:
        cache_csv.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(cache_csv, index=False)

    audit = {
        "valid_recordings": int(len(df)),
        "unique_speakers": int(df["speaker_hash"].nunique()) if not df.empty else 0,
        "corrupt_or_silent_skipped": corrupt_count,
        "duplicate_audio_skipped": duplicate_count,
        "class_distribution": df["label_name"].value_counts().to_dict() if not df.empty else {},
        "sample_rates": df["sample_rate"].value_counts().to_dict() if not df.empty else {},
    }
    return df, audit


def train_dementianet_models(
    df: pd.DataFrame,
    audit: dict[str, Any],
    output_dir: Path,
    *,
    model_version: str = "dementianet-acoustic-v1.0.0",
    random_state: int = 42,
) -> dict[str, Any]:
    """Train and compare speaker-grouped models on DementiaNet acoustic features."""
    train_df, val_df, test_df = participant_level_split(
        df, group_col="speaker_hash", target_col="target", test_size=0.2, val_size=0.2, random_state=random_state
    )
    assert set(train_df["speaker_hash"]).isdisjoint(set(test_df["speaker_hash"]))
    assert set(train_df["speaker_hash"]).isdisjoint(set(val_df["speaker_hash"]))
    assert set(val_df["speaker_hash"]).isdisjoint(set(test_df["speaker_hash"]))

    y_train = train_df["target"].to_numpy()
    y_val = val_df["target"].to_numpy()
    y_test = test_df["target"].to_numpy()

    comparison: dict[str, Any] = {}
    fitted_models: dict[str, Any] = {}
    for name, pipe in build_voice_candidates(random_state=random_state).items():
        pipe.fit(train_df[ACOUSTIC_FEATURE_COLS], y_train)
        fitted_models[name] = pipe
        comparison[name] = {
            "validation": _eval_split(pipe, val_df[ACOUSTIC_FEATURE_COLS], y_val),
            "test": _eval_split(pipe, test_df[ACOUSTIC_FEATURE_COLS], y_test),
        }

    # Silence-only control baseline
    silence_pipe = build_voice_candidates(random_state=random_state)["logistic_regression"]
    silence_pipe.fit(train_df[SILENCE_CONTROL_COLS], y_train)
    comparison["silence_control"] = {
        "validation": _eval_split(silence_pipe, val_df[SILENCE_CONTROL_COLS], y_val),
        "test": _eval_split(silence_pipe, test_df[SILENCE_CONTROL_COLS], y_test),
    }

    bundle_dir = output_dir / model_version
    bundle_dir.mkdir(parents=True, exist_ok=True)
    bundle_models: dict[str, Any] = {}
    for contract_name in ("logistic_regression", "random_forest"):
        model_path = bundle_dir / f"{contract_name}.joblib"
        joblib.dump(fitted_models[contract_name], model_path)
        bundle_models[contract_name] = {
            "file": model_path.name,
            "sha256": _sha256_file(model_path),
            "metrics": comparison[contract_name],
        }

    metadata = {
        "format": BUNDLE_FORMAT,
        "schema_version": BUNDLE_SCHEMA_VERSION,
        "model_version": model_version,
        "modality": "speech_acoustic_poc",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "labels": ["0", "1"],
        "label_mapping": {"0": "nodementia", "1": "dementia"},
        "feature_schema": [{"name": c, "type": "number"} for c in ACOUSTIC_FEATURE_COLS],
        "dataset": {
            "source": "DementiaNet (github.com/shreyasgite/dementianet)",
            "usage_permission": "Local non-commercial research proof-of-concept only; raw YouTube audio clips not redistributed.",
            "audit": audit,
            "splits": {
                "train_recordings": int(len(train_df)),
                "train_speakers": int(train_df["speaker_hash"].nunique()),
                "val_recordings": int(len(val_df)),
                "val_speakers": int(val_df["speaker_hash"].nunique()),
                "test_recordings": int(len(test_df)),
                "test_speakers": int(test_df["speaker_hash"].nunique()),
            },
        },
        "models": bundle_models,
        "comparison": comparison,
        "limitations": [
            "Experimental speech-based research screening output — not a clinical diagnosis.",
            "Trained on DementiaNet public-figure YouTube interviews with weak biographical labels, not clinical CDR/MMSE evaluations.",
            "English spontaneous interview speech only; not validated for Hindi, Punjabi, Sinhala, or Tamil.",
        ],
    }
    (bundle_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
