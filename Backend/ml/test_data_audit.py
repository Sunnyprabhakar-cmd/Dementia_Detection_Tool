import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pandas as pd

from Backend.ml.data_audit import build_audit_report, main


class AggregateAuditTests(unittest.TestCase):
    def test_report_contains_aggregates_but_no_participant_values(self):
        frame = pd.DataFrame(
            {
                "participant_key": ["private-id-1", "private-id-1", "private-id-2"],
                "visit": [1, 2, 1],
                "label": ["control", "control", "case"],
                "memory_recall_count": [4, None, 2],
            }
        )

        report = build_audit_report(
            frame,
            target_column="label",
            participant_column="participant_key",
            session_column="visit",
            provenance={
                "dataset_name": "non-clinical test fixture",
                "release": "fixture",
                "source_url": "https://example.invalid",
                "authorization_reference": "test-only",
                "license_or_agreement": "test fixture only",
                "model_use_permission": "test fixture only",
                "model_training_and_inference_authorized": True,
                "authorization_confirmed": True,
                "sha256": "not included in report",
            },
            dataset_sha256="0" * 64,
        )

        serialized = json.dumps(report)
        self.assertEqual(report["shape"], {"rows": 3, "columns": 4})
        self.assertEqual(report["participants"]["unique"], 2)
        self.assertEqual(report["participants"]["with_repeated_rows"], 1)
        self.assertEqual(report["sessions"]["unique_participant_session_pairs"], 3)
        self.assertEqual(report["target"]["class_distribution"], {"control": 2, "case": 1})
        self.assertEqual(report["columns"][3]["missing_count"], 1)
        self.assertNotIn("private-id-1", serialized)
        self.assertNotIn("private-id-2", serialized)
        self.assertNotIn("not included in report", serialized)

    def test_requires_explicit_schema_keys_and_unique_columns(self):
        frame = pd.DataFrame({"target": ["a"], "participant": ["p1"]})
        with self.assertRaisesRegex(ValueError, "missing required"):
            build_audit_report(
                frame,
                target_column="target",
                participant_column="unknown",
            )

        duplicate_columns = pd.DataFrame([["a", "p1"]], columns=["target", "target"])
        with self.assertRaisesRegex(ValueError, "unique"):
            build_audit_report(
                duplicate_columns,
                target_column="target",
                participant_column="target",
            )

    def test_cli_refuses_unapproved_provenance_before_writing_report(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            data_path = root / "dataset.csv"
            manifest_path = root / "manifest.json"
            output_path = root / "report.json"
            data_path.write_text(
                "participant,target\nprivate-id,control\n",
                encoding="utf-8",
            )
            manifest_path.write_text(
                json.dumps(
                    {
                        "dataset_name": "fixture",
                        "release": "fixture",
                        "source_url": "https://example.invalid",
                        "authorization_reference": "not-approved",
                        "license_or_agreement": "not approved",
                        "authorization_confirmed": False,
                        "sha256": "0" * 64,
                    }
                ),
                encoding="utf-8",
            )

            with patch(
                "sys.argv",
                [
                    "data_audit.py",
                    "--data",
                    str(data_path),
                    "--provenance",
                    str(manifest_path),
                    "--target",
                    "target",
                    "--participant",
                    "participant",
                    "--output",
                    str(output_path),
                ],
            ):
                self.assertEqual(main(), 1)

            self.assertFalse(output_path.exists())


if __name__ == "__main__":
    unittest.main()
