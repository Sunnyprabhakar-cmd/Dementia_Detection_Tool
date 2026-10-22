"""Join precomputed, documented MRI features to matching clinical sessions."""

import argparse
import hashlib
import json
import sys
from pathlib import Path
from typing import Any

import pandas as pd


class MRIJoinError(ValueError):
    pass


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_provenance(
    manifest_path: str | Path,
    clinical_path: str | Path,
    mri_path: str | Path,
) -> dict[str, Any]:
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    if manifest.get("authorization_confirmed") is not True:
        raise MRIJoinError(
            "MRI/clinical processing is blocked until the dataset terms and authorization are documented."
        )
    if not manifest.get("authorization_reference"):
        raise MRIJoinError("Manifest must include an authorization_reference.")
    for name, path in (("clinical", Path(clinical_path)), ("mri_features", Path(mri_path))):
        expected = manifest.get(f"{name}_sha256")
        if not isinstance(expected, str) or len(expected) != 64:
            raise MRIJoinError(f"Manifest must include {name}_sha256.")
        if _sha256(path).lower() != expected.lower():
            raise MRIJoinError(f"{name} file does not match the provenance manifest.")
    return manifest


def join_derived_features(
    clinical: pd.DataFrame,
    mri_features: pd.DataFrame,
    *,
    clinical_id: str,
    mri_id: str,
    feature_columns: list[str],
    clinical_session: str | None = None,
    mri_session: str | None = None,
    mri_processing_status: str | None = None,
    clinical_columns: list[str] | None = None,
) -> tuple[pd.DataFrame, dict[str, int]]:
    if (clinical_session is None) != (mri_session is None):
        raise MRIJoinError(
            "Provide both clinical_session and mri_session, or neither."
        )
    for frame, column, kind in (
        (clinical, clinical_id, "clinical"),
        (mri_features, mri_id, "MRI"),
    ):
        if column not in frame.columns:
            raise MRIJoinError(f"{kind} identifier column {column!r} is missing.")
        if frame[column].isna().any():
            raise MRIJoinError(f"{kind} identifier contains missing values.")

    clinical_keys = [clinical_id]
    mri_keys = [mri_id]
    if clinical_session and mri_session:
        if clinical_session not in clinical.columns or mri_session not in mri_features.columns:
            raise MRIJoinError("A requested session column is missing.")
        if clinical[clinical_session].isna().any() or mri_features[mri_session].isna().any():
            raise MRIJoinError("Session keys contain missing values.")
        clinical_keys.append(clinical_session)
        mri_keys.append(mri_session)
    if not feature_columns:
        raise MRIJoinError("At least one derived MRI feature must be explicitly selected.")
    missing_features = [column for column in feature_columns if column not in mri_features.columns]
    if missing_features:
        raise MRIJoinError(
            "Requested MRI feature columns are missing: " + ", ".join(missing_features)
        )
    if not all(pd.api.types.is_numeric_dtype(mri_features[column]) for column in feature_columns):
        raise MRIJoinError("MRI feature columns must be numeric.")
    if mri_processing_status:
        if mri_processing_status not in mri_features.columns:
            raise MRIJoinError("The requested MRI processing-status column is missing.")
        statuses = set(mri_features[mri_processing_status].dropna().unique())
        if mri_features[mri_processing_status].isna().any() or not statuses <= {
            "complete",
            "failed",
        }:
            raise MRIJoinError(
                "MRI processing status must contain only 'complete' or 'failed'."
            )
    if mri_features.duplicated(mri_keys).any():
        raise MRIJoinError("MRI identifier/session keys are not unique; refusing an ambiguous join.")
    if clinical.duplicated(clinical_keys).any():
        raise MRIJoinError("Clinical identifier/session keys are not unique.")

    include = clinical_columns or list(clinical.columns)
    requested = list(dict.fromkeys([*clinical_keys, *include]))
    missing_clinical = [column for column in requested if column not in clinical.columns]
    if missing_clinical:
        raise MRIJoinError(
            "Requested clinical columns are missing: " + ", ".join(missing_clinical)
        )
    collisions = sorted(set(feature_columns) & set(requested))
    if collisions:
        raise MRIJoinError(
            "MRI feature names collide with selected clinical columns: "
            + ", ".join(collisions)
        )

    left = clinical.loc[:, requested].copy()
    right_columns = [*mri_keys, *feature_columns]
    if mri_processing_status:
        right_columns.append(mri_processing_status)
    right = mri_features.loc[:, right_columns].copy()
    right = right.rename(columns=dict(zip(mri_keys, clinical_keys)))
    result = left.merge(
        right,
        on=clinical_keys,
        how="left",
        validate="one_to_one",
        indicator="_mri_match",
    )
    result["mri_status"] = result["_mri_match"].map(
        {"both": "matched", "left_only": "missing_mri"}
    )
    if mri_processing_status:
        failed = result[mri_processing_status] == "failed"
        result.loc[failed, "mri_status"] = "processing_failed"
        result.loc[failed, feature_columns] = pd.NA
        result = result.drop(columns=mri_processing_status)
    result = result.drop(columns="_mri_match")
    matched_keys = set(map(tuple, right.loc[:, clinical_keys].itertuples(index=False, name=None)))
    clinical_key_values = set(map(tuple, left.loc[:, clinical_keys].itertuples(index=False, name=None)))
    stats = {
        "clinical_records": int(len(clinical)),
        "mri_records": int(len(mri_features)),
        "matched_records": int((result["mri_status"] == "matched").sum()),
        "missing_mri_records": int((result["mri_status"] == "missing_mri").sum()),
        "processing_failed_records": int(
            (result["mri_status"] == "processing_failed").sum()
        ),
        "unmatched_mri_records": int(len(matched_keys - clinical_key_values)),
    }
    return result, stats


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Validate and join explicitly selected, precomputed MRI-derived features."
    )
    parser.add_argument("--clinical-csv", required=True)
    parser.add_argument("--mri-features-csv", required=True)
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--clinical-id", required=True)
    parser.add_argument("--mri-id", required=True)
    parser.add_argument("--clinical-session")
    parser.add_argument("--mri-session")
    parser.add_argument("--mri-processing-status", help="Optional column containing only 'complete' or 'failed'.")
    parser.add_argument("--feature-columns", required=True, help="Comma-separated numeric columns.")
    parser.add_argument(
        "--clinical-columns",
        help="Optional comma-separated columns to carry forward; defaults to all clinical columns.",
    )
    parser.add_argument(
        "--output",
        default=str(Path(__file__).resolve().parents[1] / "data" / "processed" / "mri_features.csv"),
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate joins and print aggregate counts only.")
    return parser


def main() -> int:
    try:
        args = build_parser().parse_args()
        clinical_path = Path(args.clinical_csv).expanduser()
        mri_path = Path(args.mri_features_csv).expanduser()
        validate_provenance(args.manifest, clinical_path, mri_path)
        clinical = pd.read_csv(clinical_path)
        mri = pd.read_csv(mri_path)
        features = [name.strip() for name in args.feature_columns.split(",") if name.strip()]
        clinical_columns = (
            [name.strip() for name in args.clinical_columns.split(",") if name.strip()]
            if args.clinical_columns
            else None
        )
        joined, stats = join_derived_features(
            clinical,
            mri,
            clinical_id=args.clinical_id,
            mri_id=args.mri_id,
            feature_columns=features,
            clinical_session=args.clinical_session,
            mri_session=args.mri_session,
            mri_processing_status=args.mri_processing_status,
            clinical_columns=clinical_columns,
        )
        if args.dry_run:
            print(json.dumps({"status": "dry_run", **stats}))
            return 0
        output_path = Path(args.output).expanduser()
        output_path.parent.mkdir(parents=True, exist_ok=True)
        joined.to_csv(output_path, index=False)
        print(json.dumps({"status": "success", "output": str(output_path), **stats}))
        return 0
    except (MRIJoinError, OSError, ValueError, pd.errors.ParserError, json.JSONDecodeError) as error:
        print(json.dumps({"status": "blocked_or_error", "message": str(error)}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
