"""Create aggregate-only reports for explicitly authorized tabular datasets."""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

if __package__:
    from .train_model import validate_provenance
else:
    from train_model import validate_provenance


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_audit_report(
    frame: pd.DataFrame,
    *,
    target_column: str,
    participant_column: str,
    session_column: str | None = None,
    provenance: dict[str, Any] | None = None,
    dataset_sha256: str | None = None,
) -> dict[str, Any]:
    if not frame.columns.is_unique:
        raise ValueError("Dataset column names must be unique.")
    required = [target_column, participant_column]
    if session_column:
        required.append(session_column)
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError("Dataset is missing required columns: " + ", ".join(missing))
    if frame[participant_column].isna().any():
        raise ValueError("Participant identifiers must not be missing.")

    target = frame[target_column]
    participant = frame[participant_column]
    report: dict[str, Any] = {
        "created_at_utc": datetime.now(timezone.utc).isoformat(),
        "provenance": {
            key: provenance.get(key)
            for key in (
                "dataset_name",
                "release",
                "source_url",
                "authorization_reference",
                "license_or_agreement",
                "model_use_permission",
                "model_training_and_inference_authorized",
                "authorization_confirmed",
            )
        }
        if provenance
        else None,
        "dataset_sha256": dataset_sha256,
        "shape": {
            "rows": int(frame.shape[0]),
            "columns": int(frame.shape[1]),
        },
        "columns": [
            {
                "name": str(column),
                "dtype": str(frame[column].dtype),
                "missing_count": int(frame[column].isna().sum()),
                "missing_fraction": float(frame[column].isna().mean()),
            }
            for column in frame.columns
        ],
        "duplicates": {
            "exact_duplicate_rows": int(frame.duplicated().sum()),
            "duplicate_participant_session_keys": (
                int(frame.duplicated([participant_column, session_column]).sum())
                if session_column
                else None
            ),
        },
        "participants": {
            "unique": int(participant.nunique(dropna=True)),
            "with_repeated_rows": int((participant.value_counts() > 1).sum()),
        },
        "sessions": (
            {
                "column": session_column,
                "unique_participant_session_pairs": int(
                    frame[[participant_column, session_column]]
                    .drop_duplicates()
                    .shape[0]
                ),
            }
            if session_column
            else None
        ),
        "target": {
            "column": target_column,
            "missing_count": int(target.isna().sum()),
            "class_distribution": {
                str(label): int(count)
                for label, count in target.value_counts(dropna=True).items()
            },
        },
        "notices": [
            "Aggregate schema audit only; no participant identifiers or row values are included.",
            "This report does not establish label validity, authorization, feature compatibility, or model performance.",
        ],
    }
    return report


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Audit an explicitly authorized CSV without exposing row values or identifiers."
    )
    parser.add_argument("--data", required=True, help="CSV covered by the provenance manifest.")
    parser.add_argument("--provenance", required=True, help="Authorization/provenance JSON.")
    parser.add_argument("--target", required=True, help="Explicit target/label column.")
    parser.add_argument("--participant", required=True, help="Participant grouping column.")
    parser.add_argument("--session", help="Optional session/visit key column.")
    parser.add_argument("--output", required=True, help="Private JSON report destination.")
    return parser


def main() -> int:
    try:
        args = build_parser().parse_args()
        data_path = Path(args.data).expanduser()
        provenance = validate_provenance(args.data, args.provenance)
        frame = pd.read_csv(data_path)
        report = build_audit_report(
            frame,
            target_column=args.target,
            participant_column=args.participant,
            session_column=args.session,
            provenance=provenance,
            dataset_sha256=sha256_file(data_path),
        )
        output_path = Path(args.output).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(report, indent=2, allow_nan=False),
            encoding="utf-8",
        )
        print(
            json.dumps(
                {
                    "status": "success",
                    "rows": report["shape"]["rows"],
                    "columns": report["shape"]["columns"],
                    "participants": report["participants"]["unique"],
                    "output": str(output_path),
                }
            )
        )
        return 0
    except (OSError, ValueError, json.JSONDecodeError, pd.errors.ParserError) as error:
        print(json.dumps({"status": "blocked_or_error", "message": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
