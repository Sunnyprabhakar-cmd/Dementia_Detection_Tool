import json
from pathlib import Path

import pandas as pd


DATASET_PATH = Path(__file__).resolve().parent.parent / "data" / "dementia_dataset.csv"
AUDIO_ROOT = Path(__file__).resolve().parent.parent / "data" / "dementia"
REPORT_PATH = Path(__file__).resolve().parent.parent.parent / "artifacts" / "reports" / "data_audit" / "oasis_dementia_audit.json"


def build_audit_report():
    df = pd.read_csv(DATASET_PATH)
    audio_files = sorted(AUDIO_ROOT.rglob("*.wav"))

    report = {
        "dataset_name": "dementia_dataset.csv",
        "source": "OASIS-style longitudinal dementia dataset (project-local copy)",
        "file_type": "CSV",
        "shape": {
            "rows": int(df.shape[0]),
            "columns": int(df.shape[1])
        },
        "columns": [
            {
                "name": col,
                "dtype": str(df[col].dtype),
                "missing_count": int(df[col].isna().sum())
            }
            for col in df.columns
        ],
        "missing_values": {
            col: int(df[col].isna().sum()) for col in df.columns
        },
        "duplicates": {
            "row_duplicates": int(df.duplicated().sum()),
            "subject_duplicates": int(df["Subject ID"].duplicated().sum()) if "Subject ID" in df.columns else 0
        },
        "unique_subjects": int(df["Subject ID"].nunique()) if "Subject ID" in df.columns else 0,
        "repeated_measurements": {
            "subject_ids_with_multiple_visits": int((df["Subject ID"].value_counts() > 1).sum()) if "Subject ID" in df.columns else 0,
            "max_visits_per_subject": int(df["Subject ID"].value_counts().max()) if "Subject ID" in df.columns else 0
        },
        "label_distribution": {
            str(k): int(v) for k, v in df["Group"].value_counts(dropna=False).to_dict().items()
        } if "Group" in df.columns else {},
        "class_imbalance": {
            "majority_class": str(df["Group"].value_counts(dropna=False).idxmax()) if "Group" in df.columns else None,
            "minority_class": str(df["Group"].value_counts(dropna=False).idxmin()) if "Group" in df.columns else None,
            "imbalance_ratio": float(df["Group"].value_counts(dropna=False).max() / max(df["Group"].value_counts(dropna=False).min(), 1)) if "Group" in df.columns else None
        },
        "potential_identifiers": [
            col for col in df.columns if "id" in col.lower() or "subject" in col.lower()
        ],
        "potential_leakage_columns": [
            "Group",
            "CDR",
            "MMSE"
        ] if "Group" in df.columns else [],
        "audio_summary": {
            "file_count": len(audio_files),
            "folder_count": len({str(p.parent) for p in audio_files}),
            "sample_files": [str(p.relative_to(AUDIO_ROOT)) for p in audio_files[:10]],
            "file_extensions": sorted({p.suffix.lower() for p in audio_files})
        },
        "data_limitations": [
            "The tabular dataset is longitudinal but the audio files are not explicitly linked to the same subject IDs used in the tabular cohort.",
            "The Group label is an observed clinical category and should not be treated as a clinically validated diagnostic label for deployment.",
            "MMSE, CDR, and related clinical variables are not safe to treat as model-free inputs in a generalized risk screening prototype without checking temporal leakage and intended prediction objective."
        ]
    }

    return report


def main():
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    report = build_audit_report()
    REPORT_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({
        "status": "success",
        "report_path": str(REPORT_PATH),
        "rows": report["shape"]["rows"],
        "columns": report["shape"]["columns"],
        "audio_files": report["audio_summary"]["file_count"]
    }, indent=2))


if __name__ == "__main__":
    main()
