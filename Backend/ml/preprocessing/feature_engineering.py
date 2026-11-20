"""Feature schema validation, leak-free normalization, participant-level splitting, and dataset versioning."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.model_selection import GroupShuffleSplit, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MinMaxScaler, StandardScaler


def validate_feature_schema(
    df: pd.DataFrame,
    required_columns: list[str],
    *,
    numeric_columns: list[str] | None = None,
) -> dict[str, Any]:
    """Validate that required columns exist and numeric columns have valid numeric types."""
    missing_cols = [col for col in required_columns if col not in df.columns]
    non_numeric: list[str] = []
    if numeric_columns:
        for col in numeric_columns:
            if col in df.columns and not pd.api.types.is_numeric_dtype(df[col]):
                non_numeric.append(col)

    valid = len(missing_cols) == 0 and len(non_numeric) == 0
    return {
        "valid": valid,
        "missing_columns": missing_cols,
        "non_numeric_columns": non_numeric,
        "checked_columns": len(required_columns),
    }


def participant_level_split(
    df: pd.DataFrame,
    *,
    group_col: str,
    target_col: str,
    test_size: float = 0.2,
    val_size: float = 0.2,
    random_state: int = 42,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """Split DataFrame into disjoint participant-grouped train, val, and test partitions."""
    if group_col not in df.columns or target_col not in df.columns:
        raise KeyError(f"Columns '{group_col}' and '{target_col}' are required for splitting.")

    groups = df[group_col].astype(str)
    y = df[target_col]

    # Outer split: train_val vs test
    n_outer = max(2, int(round(1.0 / max(0.05, test_size))))
    if y.nunique() > 1 and groups.nunique() >= n_outer:
        outer_cv = StratifiedGroupKFold(n_splits=n_outer, shuffle=True, random_state=random_state)
        train_val_idx, test_idx = next(outer_cv.split(df, y, groups))
    else:
        gss = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
        train_val_idx, test_idx = next(gss.split(df, y, groups))

    train_val_df = df.iloc[train_val_idx].reset_index(drop=True)
    test_df = df.iloc[test_idx].reset_index(drop=True)

    # Inner split: train vs val
    rel_val = val_size / max(1e-6, 1.0 - test_size)
    n_inner = max(2, int(round(1.0 / max(0.05, rel_val))))
    tv_groups = train_val_df[group_col].astype(str)
    tv_y = train_val_df[target_col]

    if tv_y.nunique() > 1 and tv_groups.nunique() >= n_inner:
        inner_cv = StratifiedGroupKFold(n_splits=n_inner, shuffle=True, random_state=random_state + 1)
        train_idx, val_idx = next(inner_cv.split(train_val_df, tv_y, tv_groups))
    else:
        gss_inner = GroupShuffleSplit(n_splits=1, test_size=rel_val, random_state=random_state + 1)
        train_idx, val_idx = next(gss_inner.split(train_val_df, tv_y, tv_groups))

    train_df = train_val_df.iloc[train_idx].reset_index(drop=True)
    val_df = train_val_df.iloc[val_idx].reset_index(drop=True)
    return train_df, val_df, test_df


def fit_transform_preprocessor(
    train_df: pd.DataFrame,
    *,
    numeric_cols: list[str],
    val_df: pd.DataFrame | None = None,
    test_df: pd.DataFrame | None = None,
    scaling: str = "standard",
) -> dict[str, Any]:
    """Fit median imputation + normalization/standardization on train_df only."""
    scaler = StandardScaler() if scaling == "standard" else MinMaxScaler()
    pipeline = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", scaler),
    ])

    X_train = pipeline.fit_transform(train_df[numeric_cols])
    result: dict[str, Any] = {
        "pipeline": pipeline,
        "scaling": scaling,
        "feature_columns": list(numeric_cols),
        "X_train": X_train,
    }
    if val_df is not None:
        result["X_val"] = pipeline.transform(val_df[numeric_cols])
    if test_df is not None:
        result["X_test"] = pipeline.transform(test_df[numeric_cols])
    return result


def version_dataset_artifact(
    df: pd.DataFrame,
    output_dir: Path,
    *,
    dataset_name: str,
    version: str,
    source_provenance: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Persist a cleaned dataset snapshot and SHA-256 versioned manifest."""
    target_dir = output_dir / f"{dataset_name}-{version}"
    target_dir.mkdir(parents=True, exist_ok=True)
    csv_path = target_dir / f"{dataset_name}.csv"
    df.to_csv(csv_path, index=False)

    sha256 = hashlib.sha256(csv_path.read_bytes()).hexdigest()
    manifest = {
        "dataset_name": dataset_name,
        "version": version,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "row_count": int(len(df)),
        "column_count": int(len(df.columns)),
        "columns": [str(c) for c in df.columns],
        "sha256": sha256,
        "file": csv_path.name,
        "source_provenance": source_provenance or {},
    }
    manifest_path = target_dir / "dataset_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest
