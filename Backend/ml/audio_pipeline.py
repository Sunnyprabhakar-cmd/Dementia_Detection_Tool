import json
from pathlib import Path

import librosa
import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
AUDIO_ROOT = PROJECT_ROOT / "Backend" / "data" / "dementia"
ARTIFACT_DIR = PROJECT_ROOT / "artifacts" / "models" / "audio" / "baseline_v1"
FEATURES_PATH = ARTIFACT_DIR / "audio_features.csv"
SUBJECT_FEATURES_PATH = ARTIFACT_DIR / "audio_subject_features.csv"
METADATA_PATH = ARTIFACT_DIR / "audio_metadata.json"


def discover_audio_files():
    return sorted(AUDIO_ROOT.rglob("*.wav"))


def validate_and_extract(file_path: Path):
    try:
        signal, sample_rate = librosa.load(file_path, sr=None, mono=False)
    except Exception as exc:
        return {
            "file": str(file_path.relative_to(PROJECT_ROOT)),
            "status": "unreadable",
            "error": str(exc),
            "label": None,
            "subject": file_path.parent.name,
        }

    if signal.ndim > 1:
        channels = signal.shape[0]
        mono_signal = signal.mean(axis=0)
    else:
        channels = 1
        mono_signal = signal

    duration = float(librosa.get_duration(y=mono_signal, sr=sample_rate))
    rms = librosa.feature.rms(y=mono_signal).squeeze()
    zcr = librosa.feature.zero_crossing_rate(mono_signal).squeeze()
    spectral_centroid = librosa.feature.spectral_centroid(y=mono_signal, sr=sample_rate).squeeze()
    spectral_bandwidth = librosa.feature.spectral_bandwidth(y=mono_signal, sr=sample_rate).squeeze()
    spectral_rolloff = librosa.feature.spectral_rolloff(y=mono_signal, sr=sample_rate).squeeze()
    mfcc = librosa.feature.mfcc(y=mono_signal, sr=sample_rate, n_mfcc=13)

    silence_ratio = float(np.mean(np.abs(mono_signal) < 0.01))

    feature_row = {
        "file": str(file_path.relative_to(PROJECT_ROOT)),
        "subject": file_path.parent.name,
        "label": None,
        "sample_rate": int(sample_rate),
        "channels": int(channels),
        "duration_seconds": round(duration, 4),
        "silence_ratio": round(silence_ratio, 4),
        "rms_mean": round(float(rms.mean()), 6),
        "rms_std": round(float(rms.std()), 6),
        "zcr_mean": round(float(zcr.mean()), 6),
        "zcr_std": round(float(zcr.std()), 6),
        "spectral_centroid_mean": round(float(spectral_centroid.mean()), 6),
        "spectral_centroid_std": round(float(spectral_centroid.std()), 6),
        "spectral_bandwidth_mean": round(float(spectral_bandwidth.mean()), 6),
        "spectral_bandwidth_std": round(float(spectral_bandwidth.std()), 6),
        "spectral_rolloff_mean": round(float(spectral_rolloff.mean()), 6),
        "spectral_rolloff_std": round(float(spectral_rolloff.std()), 6),
    }

    for idx in range(mfcc.shape[0]):
        feature_row[f"mfcc_{idx + 1}_mean"] = round(float(mfcc[idx].mean()), 6)
        feature_row[f"mfcc_{idx + 1}_std"] = round(float(mfcc[idx].std()), 6)

    feature_row["status"] = "valid"
    return feature_row


def build_subject_level_features(features_df):
    if features_df.empty:
        return pd.DataFrame()

    subject_features = features_df.copy()
    numeric_cols = [
        col for col in subject_features.columns
        if col not in {"file", "subject", "label", "status"} and pd.api.types.is_numeric_dtype(subject_features[col])
    ]

    if not numeric_cols:
        return pd.DataFrame()

    grouped = subject_features.groupby("subject", dropna=False)
    summary_frames = []
    for subject_name, group in grouped:
        row = {"subject": subject_name, "recording_count": int(len(group))}
        for col in numeric_cols:
            values = group[col].dropna()
            if values.empty:
                row[f"{col}_mean"] = None
                row[f"{col}_std"] = None
                row[f"{col}_min"] = None
                row[f"{col}_max"] = None
            else:
                row[f"{col}_mean"] = float(values.mean())
                row[f"{col}_std"] = float(values.std(ddof=0)) if len(values) > 1 else 0.0
                row[f"{col}_min"] = float(values.min())
                row[f"{col}_max"] = float(values.max())
        summary_frames.append(row)

    return pd.DataFrame(summary_frames)


def build_audio_summary():
    files = discover_audio_files()
    rows = []
    failures = []

    for file_path in files:
        parsed = validate_and_extract(file_path)
        if parsed.get("status") == "valid":
            rows.append(parsed)
        else:
            failures.append(parsed)

    df = pd.DataFrame(rows)
    subject_df = build_subject_level_features(df)
    summary = {
        "dataset_root": str(AUDIO_ROOT),
        "audio_file_count": len(files),
        "valid_file_count": len(df),
        "unreadable_file_count": len(failures),
        "subject_level_rows": int(len(subject_df)) if not subject_df.empty else 0,
        "label_status": "No explicit patient-level audio labels were present in the current project audio dataset.",
        "subject_count": int(df["subject"].nunique()) if not df.empty else 0,
        "duration_summary": {
            "min_seconds": round(float(df["duration_seconds"].min()), 4) if not df.empty else None,
            "max_seconds": round(float(df["duration_seconds"].max()), 4) if not df.empty else None,
            "mean_seconds": round(float(df["duration_seconds"].mean()), 4) if not df.empty else None,
        },
        "sample_rate_summary": {
            "min_hz": int(df["sample_rate"].min()) if not df.empty else None,
            "max_hz": int(df["sample_rate"].max()) if not df.empty else None,
            "median_hz": int(df["sample_rate"].median()) if not df.empty else None,
        },
        "channels_summary": {
            "unique_channels": sorted(df["channels"].unique().tolist()) if not df.empty else [],
            "most_common_channel_count": int(df["channels"].mode().iloc[0]) if not df.empty else None,
        },
        "limitations": [
            "Audio files are available, but there is no verified subject-level label mapping for a supervised dementia classification task.",
            "This pipeline extracts reproducible acoustic features and records metadata; it does not invent target labels.",
            "Multimodal fusion is intentionally deferred until the audio and tabular datasets are linked by a verified patient or subject identifier.",
            "Subject-level aggregation is available for clustering and anomaly detection, but it is not a dementia diagnosis model."
        ],
    }

    return df, subject_df, summary, failures


def main():
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    features_df, subject_df, summary, failures = build_audio_summary()

    if not features_df.empty:
        features_df.to_csv(FEATURES_PATH, index=False)
    else:
        pd.DataFrame([]).to_csv(FEATURES_PATH, index=False)

    if not subject_df.empty:
        subject_df.to_csv(SUBJECT_FEATURES_PATH, index=False)
    else:
        pd.DataFrame([]).to_csv(SUBJECT_FEATURES_PATH, index=False)

    summary["subject_level_feature_csv"] = str(SUBJECT_FEATURES_PATH)
    METADATA_PATH.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    print(json.dumps({
        "status": "success",
        "audio_files": int(summary["audio_file_count"]),
        "valid_files": int(summary["valid_file_count"]),
        "unreadable_files": int(summary["unreadable_file_count"]),
        "subject_level_rows": int(summary["subject_level_rows"]),
        "feature_csv": str(FEATURES_PATH),
        "subject_feature_csv": str(SUBJECT_FEATURES_PATH),
        "metadata_json": str(METADATA_PATH),
        "label_status": summary["label_status"],
    }, indent=2))

    if failures:
        print(json.dumps({"failed_files": failures[:5]}, indent=2))


if __name__ == "__main__":
    main()
