"""Reproducible, participant-grouped ML training, comparison, and versioned bundle export."""

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
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    brier_score_loss,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import StratifiedGroupKFold, cross_validate
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from Backend.ml.model_contract import BUNDLE_FORMAT, BUNDLE_SCHEMA_VERSION
from Backend.ml.preprocessing.data_cleaning import clean_tabular_dataframe
from Backend.ml.preprocessing.feature_engineering import participant_level_split


ZENODO_13378346_FEATURES = [
    "Sex", "Age", "Years of study", "CRP", "TSH", "Vit. B12",
    "Sodium", "Potassium", "Creatinine", "Hemoglobin",
    "Hemoglobin Glycated", "Uric Acid", "D3",
    "Diabeties", "Atherosclerosis", "Heart Attack", "FA", "Stroke", "HA",
    "ADL", "IADL", "BERG", "Stress", "BMI",
]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _wilson_ci(successes: int, total: int, z: float = 1.96) -> list[float] | None:
    if total <= 0:
        return None
    p = successes / total
    denom = 1.0 + (z * z) / total
    center = (p + (z * z) / (2 * total)) / denom
    half = (z * math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total)) / denom
    return [round(max(0.0, center - half), 4), round(min(1.0, center + half), 4)]


def load_zenodo_13378346(dataset_path: Path) -> tuple[pd.DataFrame, dict[str, Any]]:
    """Load, validate, and clean Zenodo 13378346 for binary cognitive-impairment research."""
    raw = pd.read_excel(dataset_path, header=1)
    cleaned, clean_summary = clean_tabular_dataframe(
        raw,
        id_col="Nr",
        numeric_cols=ZENODO_13378346_FEATURES,
    )
    if "Clinical Diagnosis" not in cleaned.columns or "Nr" not in cleaned.columns:
        raise ValueError("Dataset is missing required 'Nr' or 'Clinical Diagnosis' column.")

    cleaned["Clinical Diagnosis"] = cleaned["Clinical Diagnosis"].astype(str).str.strip()
    cleaned = cleaned[cleaned["Clinical Diagnosis"].isin(["control", "MCI", "DEMENTIA"])].copy()
    cleaned["target_impaired"] = (cleaned["Clinical Diagnosis"] != "control").astype(int)
    return cleaned.reset_index(drop=True), clean_summary


def build_candidate_models(random_state: int = 42) -> dict[str, Pipeline]:
    """Build candidate classification pipelines with leak-free training-only imputation & scaling."""
    def make_pipe(estimator: Any) -> Pipeline:
        return Pipeline([
            ("imputer", SimpleImputer(strategy="median", add_indicator=True)),
            ("scaler", StandardScaler()),
            ("classifier", estimator),
        ])

    return {
        "logistic_regression": make_pipe(
            LogisticRegression(max_iter=2000, class_weight="balanced", random_state=random_state)
        ),
        "decision_tree": make_pipe(
            DecisionTreeClassifier(max_depth=4, min_samples_leaf=5, class_weight="balanced", random_state=random_state)
        ),
        "random_forest": make_pipe(
            RandomForestClassifier(
                n_estimators=200, max_depth=6, min_samples_leaf=3,
                class_weight="balanced", random_state=random_state,
            )
        ),
        "gradient_boosting": make_pipe(
            GradientBoostingClassifier(
                n_estimators=100, max_depth=3, learning_rate=0.05, random_state=random_state
            )
        ),
    }


def _evaluate_binary(model: Any, X: pd.DataFrame, y: np.ndarray) -> dict[str, Any]:
    y_pred = model.predict(X)
    y_prob = model.predict_proba(X)[:, 1]
    acc = float(accuracy_score(y, y_pred))
    cm = confusion_matrix(y, y_pred, labels=[0, 1]).tolist()
    return {
        "n_samples": int(len(y)),
        "accuracy": round(acc, 4),
        "accuracy_wilson_95ci": _wilson_ci(int(np.sum(y_pred == y)), int(len(y))),
        "precision": round(float(precision_score(y, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y, y_pred, zero_division=0)), 4),
        "roc_auc": round(float(roc_auc_score(y, y_prob)), 4) if len(np.unique(y)) > 1 else None,
        "pr_auc": round(float(average_precision_score(y, y_prob)), 4) if len(np.unique(y)) > 1 else None,
        "brier_score": round(float(brier_score_loss(y, y_prob)), 4),
        "confusion_matrix_labels": [0, 1],
        "confusion_matrix": cm,
        "class_report": classification_report(
            y, y_pred, labels=[0, 1], target_names=["control", "impaired"],
            output_dict=True, zero_division=0,
        ),
    }


def run_training_and_evaluation(
    dataset_path: Path,
    output_dir: Path,
    *,
    model_version: str = "zenodo-13378346-v1.0.0",
    random_state: int = 42,
) -> dict[str, Any]:
    """Train, cross-validate, compare, explain, and persist a versioned model bundle."""
    df, clean_summary = load_zenodo_13378346(dataset_path)
    dataset_sha256 = _sha256_file(dataset_path)

    train_df, val_df, test_df = participant_level_split(
        df,
        group_col="Nr",
        target_col="target_impaired",
        test_size=0.2,
        val_size=0.2,
        random_state=random_state,
    )

    # Strict leakage check: disjoint participants across all partitions
    train_ids = set(train_df["Nr"].astype(str))
    val_ids = set(val_df["Nr"].astype(str))
    test_ids = set(test_df["Nr"].astype(str))
    assert len(train_ids & val_ids) == 0 and len(train_ids & test_ids) == 0 and len(val_ids & test_ids) == 0

    X_train, y_train = train_df[ZENODO_13378346_FEATURES], train_df["target_impaired"].to_numpy()
    X_val, y_val = val_df[ZENODO_13378346_FEATURES], val_df["target_impaired"].to_numpy()
    X_test, y_test = test_df[ZENODO_13378346_FEATURES], test_df["target_impaired"].to_numpy()

    train_val_df = pd.concat([train_df, val_df], ignore_index=True)
    X_tv = train_val_df[ZENODO_13378346_FEATURES]
    y_tv = train_val_df["target_impaired"].to_numpy()
    groups_tv = train_val_df["Nr"].astype(str).to_numpy()

    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=random_state)
    candidates = build_candidate_models(random_state=random_state)
    comparison: dict[str, Any] = {}
    fitted_models: dict[str, Any] = {}

    for name, pipe in candidates.items():
        cv_scores = cross_validate(
            pipe, X_tv, y_tv, groups=groups_tv, cv=cv,
            scoring={"roc_auc": "roc_auc", "f1": "f1", "accuracy": "accuracy"},
        )
        pipe.fit(X_train, y_train)
        fitted_models[name] = pipe
        comparison[name] = {
            "cv_5fold_roc_auc_mean": round(float(np.mean(cv_scores["test_roc_auc"])), 4),
            "cv_5fold_roc_auc_std": round(float(np.std(cv_scores["test_roc_auc"])), 4),
            "cv_5fold_f1_mean": round(float(np.mean(cv_scores["test_f1"])), 4),
            "validation": _evaluate_binary(pipe, X_val, y_val),
            "test": _evaluate_binary(pipe, X_test, y_test),
        }

    # Explainability on best-performing contract-supported model (random_forest) using validation set
    perm = permutation_importance(
        fitted_models["random_forest"], X_val, y_val, n_repeats=15, random_state=random_state, scoring="roc_auc"
    )
    top_explainability = sorted(
        [
            {
                "feature": feat,
                "permutation_importance_mean": round(float(mean), 4),
                "permutation_importance_std": round(float(std), 4),
            }
            for feat, mean, std in zip(ZENODO_13378346_FEATURES, perm.importances_mean, perm.importances_std)
        ],
        key=lambda item: item["permutation_importance_mean"],
        reverse=True,
    )[:10]

    # Calibrated logistic regression check on validation set
    calibrated_lr = CalibratedClassifierCV(fitted_models["logistic_regression"], method="sigmoid", cv=3)
    calibrated_lr.fit(X_train, y_train)
    calibrated_test_brier = round(float(brier_score_loss(y_test, calibrated_lr.predict_proba(X_test)[:, 1])), 4)

    # Persist versioned bundle conforming to Backend/ml/model_contract.py & predict.py
    bundle_dir = output_dir / model_version
    bundle_dir.mkdir(parents=True, exist_ok=True)
    bundle_models: dict[str, Any] = {}
    for contract_name in ("logistic_regression", "random_forest"):
        filename = f"{contract_name}.joblib"
        model_path = bundle_dir / filename
        joblib.dump(fitted_models[contract_name], model_path)
        bundle_models[contract_name] = {
            "file": filename,
            "sha256": _sha256_file(model_path),
            "metrics": {
                "validation": comparison[contract_name]["validation"],
                "test": comparison[contract_name]["test"],
            },
        }

    metadata = {
        "format": BUNDLE_FORMAT,
        "schema_version": BUNDLE_SCHEMA_VERSION,
        "model_version": model_version,
        "modality": "clinical_tabular_research",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "labels": ["0", "1"],
        "label_mapping": {"0": "control", "1": "impaired_MCI_or_DEMENTIA"},
        "feature_schema": [
            {"name": col, "type": "number"} for col in ZENODO_13378346_FEATURES
        ],
        "preprocessing": {
            "imputer": "SimpleImputer(strategy='median', add_indicator=True)",
            "scaler": "StandardScaler()",
            "fitted_on": "train_partition_only",
        },
        "dataset": {
            "source": "Zenodo 13378346 (Cognitive performance of older patients)",
            "license_or_agreement": "CC-BY-4.0",
            "authorization_confirmed": True,
            "model_training_and_inference_authorized": True,
            "model_use_permission": "CC-BY-4.0 open research dataset",
            "sha256": dataset_sha256,
            "row_count": int(len(df)),
            "splits": {
                "train_participants": int(len(train_df)),
                "validation_participants": int(len(val_df)),
                "test_participants": int(len(test_df)),
            },
        },
        "training_config": {
            "random_state": random_state,
            "cv_folds": 5,
            "cv_strategy": "StratifiedGroupKFold",
        },
        "models": bundle_models,
        "comparison": comparison,
        "calibrated_logistic_regression_test_brier": calibrated_test_brier,
        "explainability_top10_permutation_val": top_explainability,
        "limitations": [
            "Single-center N=283 tabular clinical/biomarker cohort; not external clinical validation.",
            "Not compatible with live MindScan digital-task inference.",
            "Feature importance reflects statistical association only, not causal mechanisms.",
        ],
    }
    (bundle_dir / "metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata
