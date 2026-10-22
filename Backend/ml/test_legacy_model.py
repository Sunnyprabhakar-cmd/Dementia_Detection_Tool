import json
import unittest
from pathlib import Path

import joblib
import pandas as pd


ROOT = Path(__file__).resolve().parents[2]
ARTIFACT = ROOT / "artifacts" / "models" / "tabular" / "baseline_v1"


class LegacyCognitiveModelTests(unittest.TestCase):
    def test_recovered_artifact_loads_with_original_schema_and_labels(self):
        metadata = json.loads((ARTIFACT / "metadata.json").read_text(encoding="utf-8"))
        model = joblib.load(ARTIFACT / "model.pkl")
        features = metadata["feature_columns"]
        record = {
            "Visit": 1,
            "MR Delay": 0,
            "M/F": "F",
            "Hand": "R",
            "Age": 70,
            "EDUC": 16,
            "SES": 2,
            "MMSE": 28,
            "CDR": 0,
            "eTIV": 1500,
            "nWBV": 0.75,
            "ASF": 1.1,
        }
        prediction = model.predict(pd.DataFrame([record], columns=features))[0]
        scores = model.predict_proba(pd.DataFrame([record], columns=features))[0]

        self.assertIn(prediction, model.classes_)
        self.assertEqual(list(model.classes_), [0, 1])
        self.assertEqual(len(scores), 2)
        self.assertEqual(
            metadata["target"],
            "Group -> {Nondemented:0, Demented:1, Converted:1}",
        )


if __name__ == "__main__":
    unittest.main()
