"""Tabular data cleaning, missing-value analysis, and duplicate detection."""

from __future__ import annotations

from typing import Any
import pandas as pd


def strip_column_whitespace(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy with leading/trailing whitespace removed from column names."""
    cleaned = df.copy()
    cleaned.columns = [str(col).strip() for col in cleaned.columns]
    return cleaned


def analyze_missing_values(df: pd.DataFrame) -> dict[str, Any]:
    """Compute aggregate missing-value counts and percentages per column."""
    total_rows = int(len(df))
    per_column: dict[str, dict[str, Any]] = {}
    for col in df.columns:
        missing_count = int(df[col].isna().sum())
        per_column[str(col)] = {
            "missing_count": missing_count,
            "missing_percent": round((missing_count / total_rows) * 100, 2) if total_rows else 0.0,
            "dtype": str(df[col].dtype),
        }
    total_cells = total_rows * int(len(df.columns))
    total_missing = int(df.isna().sum().sum())
    return {
        "row_count": total_rows,
        "column_count": int(len(df.columns)),
        "total_missing_cells": total_missing,
        "overall_missing_percent": round((total_missing / total_cells) * 100, 2) if total_cells else 0.0,
        "columns": per_column,
    }


def detect_duplicates(
    df: pd.DataFrame,
    subset: list[str] | None = None,
) -> dict[str, Any]:
    """Detect exact duplicate rows and optional key-level duplicates."""
    exact_dup_mask = df.duplicated(keep="first")
    result: dict[str, Any] = {
        "exact_duplicate_rows": int(exact_dup_mask.sum()),
        "unique_exact_rows": int((~exact_dup_mask).sum()),
    }
    if subset:
        valid_keys = [col for col in subset if col in df.columns]
        if valid_keys:
            key_dup_mask = df.duplicated(subset=valid_keys, keep="first")
            result["key_columns"] = valid_keys
            result["key_duplicate_rows"] = int(key_dup_mask.sum())
    return result


def clean_tabular_dataframe(
    df: pd.DataFrame,
    *,
    id_col: str | None = None,
    numeric_cols: list[str] | None = None,
    drop_all_null_cols: bool = True,
    drop_exact_duplicates: bool = True,
) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Clean a tabular DataFrame and return the cleaned copy with an audit summary."""
    cleaned = strip_column_whitespace(df)
    initial_rows = int(len(cleaned))
    initial_cols = int(len(cleaned.columns))

    if drop_all_null_cols:
        cleaned = cleaned.dropna(axis=1, how="all")

    cleaned = cleaned.dropna(axis=0, how="all")

    if drop_exact_duplicates:
        cleaned = cleaned.drop_duplicates(keep="first")

    if id_col and id_col in cleaned.columns:
        cleaned[id_col] = cleaned[id_col].astype("string").str.strip()

    if numeric_cols:
        for col in numeric_cols:
            if col in cleaned.columns:
                cleaned[col] = pd.to_numeric(cleaned[col], errors="coerce")

    cleaned = cleaned.reset_index(drop=True)
    summary = {
        "initial_rows": initial_rows,
        "cleaned_rows": int(len(cleaned)),
        "rows_removed": initial_rows - int(len(cleaned)),
        "initial_columns": initial_cols,
        "cleaned_columns": int(len(cleaned.columns)),
        "missingness": analyze_missing_values(cleaned),
        "duplicates": detect_duplicates(cleaned, subset=[id_col] if id_col else None),
    }
    return cleaned, summary
