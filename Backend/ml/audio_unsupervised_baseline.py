import json
from pathlib import Path

import pandas as pd
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler


FEATURES_PATH = Path(__file__).resolve().parent.parent.parent / "artifacts" / "models" / "audio" / "baseline_v1" / "audio_features.csv"
ARTIFACT_DIR = FEATURES_PATH.parent
METADATA_PATH = ARTIFACT_DIR / "unsupervised_audio_baseline.json"


def build_unsupervised_audio_baseline():
    df = pd.read_csv(FEATURES_PATH)
    if df.empty:
        raise ValueError("Audio feature file is empty; no usable audio feature matrix was generated.")

    feature_cols = [
        col for col in df.columns
        if col not in {"file", "subject", "label", "status"}
    ]
    X = df[feature_cols].copy()
    X = X.dropna(axis=1)

    if X.shape[1] < 2:
        raise ValueError("Not enough numeric audio features remain for clustering.")

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    n_clusters = min(3, max(2, len(df)))
    model = KMeans(n_clusters=n_clusters, random_state=42, n_init=20)
    labels = model.fit_predict(X_scaled)

    silhouette = silhouette_score(X_scaled, labels) if len(df) >= 3 and n_clusters > 1 and n_clusters < len(df) else None

    cluster_summary = (
        df.assign(cluster=labels)
        .groupby("cluster")
        .agg(
            samples=("file", "count"),
            subjects=("subject", "nunique"),
            avg_duration_seconds=("duration_seconds", "mean"),
            avg_rms=("rms_mean", "mean"),
            avg_zcr=("zcr_mean", "mean")
        )
        .reset_index()
        .to_dict(orient="records")
    )

    result = {
        "status": "exploratory_audio_baseline",
        "method": "KMeans on acoustic feature vectors",
        "input_rows": int(len(df)),
        "input_features": int(X.shape[1]),
        "n_clusters": int(n_clusters),
        "silhouette_score": float(silhouette) if silhouette is not None else None,
        "cluster_summary": cluster_summary,
        "limitations": [
            "This is an exploratory unsupervised baseline and is not a dementia classifier.",
            "There are no valid audio labels or subject-linked labels in the current dataset.",
            "This output should be interpreted as a pattern-discovery step, not a clinically valid diagnostic model."
        ]
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    METADATA_PATH.write_text(json.dumps(result, indent=2), encoding="utf-8")

    print(json.dumps({
        "status": "success",
        "n_clusters": int(n_clusters),
        "silhouette_score": float(silhouette) if silhouette is not None else None,
        "output": str(METADATA_PATH)
    }, indent=2))


if __name__ == "__main__":
    build_unsupervised_audio_baseline()
