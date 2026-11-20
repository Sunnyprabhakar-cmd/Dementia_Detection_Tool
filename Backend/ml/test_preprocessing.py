import tempfile
import unittest
import wave
from pathlib import Path

import numpy as np
import pandas as pd
from PIL import Image, ImageDraw

from Backend.ml.preprocessing import (
    analyze_missing_values,
    clean_tabular_dataframe,
    detect_duplicates,
    extract_acoustic_features_from_wav,
    extract_clock_drawing_features,
    fit_transform_preprocessor,
    participant_level_split,
    validate_feature_schema,
    version_dataset_artifact,
)


ROOT = Path(__file__).resolve().parents[2]
ZENODO_13378346 = ROOT / "research-data" / "open_zenodo" / "zenodo_13378346_dataset.xlsx"
ZENODO_5509808 = ROOT / "research-data" / "open_zenodo" / "zenodo_5509808_dataset.xlsx"


class PreprocessingPipelineTests(unittest.TestCase):
    @unittest.skipUnless(ZENODO_13378346.is_file(), "Zenodo 13378346 dataset not present")
    def test_real_zenodo_13378346_cleaning_splitting_scaling_and_versioning(self):
        raw = pd.read_excel(ZENODO_13378346, header=1)
        numeric_cols = ["Age", "Years of study", "ADL", "IADL", "BMI"]
        cleaned, summary = clean_tabular_dataframe(
            raw,
            id_col="Nr",
            numeric_cols=numeric_cols,
        )
        self.assertGreater(summary["cleaned_rows"], 200)
        self.assertIn("Clinical Diagnosis", cleaned.columns)

        schema_check = validate_feature_schema(
            cleaned,
            required_columns=["Nr", "Age", "Clinical Diagnosis"] + numeric_cols,
            numeric_columns=numeric_cols,
        )
        self.assertTrue(schema_check["valid"], schema_check)

        # Binary target for split verification (control vs impaired/other)
        cleaned["target_binary"] = (
            cleaned["Clinical Diagnosis"].astype(str).str.strip().str.lower() != "control"
        ).astype(int)
        train_df, val_df, test_df = participant_level_split(
            cleaned,
            group_col="Nr",
            target_col="target_binary",
            test_size=0.2,
            val_size=0.2,
            random_state=42,
        )
        train_ids = set(train_df["Nr"].astype(str))
        val_ids = set(val_df["Nr"].astype(str))
        test_ids = set(test_df["Nr"].astype(str))
        self.assertEqual(len(train_ids & val_ids), 0)
        self.assertEqual(len(train_ids & test_ids), 0)
        self.assertEqual(len(val_ids & test_ids), 0)
        self.assertEqual(len(train_df) + len(val_df) + len(test_df), len(cleaned))

        scaled = fit_transform_preprocessor(
            train_df,
            numeric_cols=numeric_cols,
            val_df=val_df,
            test_df=test_df,
            scaling="standard",
        )
        self.assertFalse(np.isnan(scaled["X_train"]).any())
        self.assertFalse(np.isnan(scaled["X_val"]).any())
        self.assertFalse(np.isnan(scaled["X_test"]).any())

        with tempfile.TemporaryDirectory() as tmp:
            manifest = version_dataset_artifact(
                cleaned,
                Path(tmp),
                dataset_name="zenodo_13378346_cleaned",
                version="v1.0.0",
                source_provenance={"license": "CC-BY-4.0", "zenodo_id": 13378346},
            )
            self.assertEqual(len(manifest["sha256"]), 64)
            self.assertEqual(manifest["row_count"], len(cleaned))

    @unittest.skipUnless(ZENODO_5509808.is_file(), "Zenodo 5509808 dataset not present")
    def test_real_zenodo_5509808_missingness_and_duplicates(self):
        raw = pd.read_excel(ZENODO_5509808)
        cleaned, summary = clean_tabular_dataframe(raw, id_col="ID")
        self.assertGreater(summary["cleaned_rows"], 600)
        missing = analyze_missing_values(cleaned)
        self.assertIn("columns", missing)
        dups = detect_duplicates(cleaned, subset=["ID"])
        self.assertEqual(dups["exact_duplicate_rows"], 0)

    def test_audio_validation_and_acoustic_features_non_clinical_fixture(self):
        # Non-clinical synthetic audio fixture (16 kHz voiced tone + pause + tone)
        sr = 16000
        t1 = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        tone1 = 0.4 * np.sin(2 * np.pi * 150.0 * t1)
        silence = np.zeros(int(sr * 0.25))
        t2 = np.linspace(0, 0.5, int(sr * 0.5), endpoint=False)
        tone2 = 0.4 * np.sin(2 * np.pi * 165.0 * t2)
        signal = np.concatenate([np.zeros(int(sr * 0.1)), tone1, silence, tone2])
        pcm = (signal * 32767).astype(np.int16)

        with tempfile.TemporaryDirectory() as tmp:
            wav_path = Path(tmp) / "fixture.wav"
            with wave.open(str(wav_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sr)
                wf.writeframes(pcm.tobytes())

            res = extract_acoustic_features_from_wav(wav_path)
            self.assertEqual(res["status"], "complete")
            feats = res["features"]
            self.assertAlmostEqual(feats["audio_duration_seconds"], 1.35, places=1)
            self.assertGreaterEqual(feats["waveform_pause_count"], 1)
            self.assertIsNotNone(feats["pitch_mean_hz"])
            self.assertGreater(feats["pitch_mean_hz"], 120.0)
            self.assertLess(feats["pitch_mean_hz"], 200.0)
            self.assertIn("mfcc_1_mean", feats)
            self.assertIn("mfcc_13_std", feats)

            # Silent WAV must be rejected
            silent_path = Path(tmp) / "silent.wav"
            with wave.open(str(silent_path), "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sr)
                wf.writeframes(np.zeros(sr, dtype=np.int16).tobytes())
            with self.assertRaises(ValueError):
                extract_acoustic_features_from_wav(silent_path)

    def test_clock_drawing_validation_and_features_non_clinical_fixture(self):
        # Non-clinical synthetic clock image fixture
        with tempfile.TemporaryDirectory() as tmp:
            img_path = Path(tmp) / "clock_fixture.png"
            img = Image.new("RGB", (300, 300), "white")
            draw = ImageDraw.Draw(img)
            draw.ellipse([30, 30, 270, 270], outline="black", width=4)
            draw.line([150, 150, 150, 75], fill="black", width=4)
            draw.line([150, 150, 210, 150], fill="black", width=3)
            img.save(img_path)

            strokes = [
                {"points": [{"x": 150, "y": 150}, {"x": 150, "y": 75}]},
                {"points": [{"x": 150, "y": 150}, {"x": 210, "y": 150}]},
            ]
            res = extract_clock_drawing_features(
                img_path,
                strokes=strokes,
                completion_time_seconds=18.4,
            )
            self.assertEqual(res["status"], "complete")
            feats = res["features"]
            self.assertGreater(feats["circularity_score"], 0.7)
            self.assertGreater(feats["quadrant_balance_score"], 0.7)
            self.assertEqual(feats["stroke_count"], 2)
            self.assertAlmostEqual(feats["total_stroke_length_px"], 135.0, places=1)
            self.assertEqual(feats["completion_time_seconds"], 18.4)

            # Blank image must be rejected
            blank_path = Path(tmp) / "blank.png"
            Image.new("RGB", (300, 300), "white").save(blank_path)
            with self.assertRaises(ValueError):
                extract_clock_drawing_features(blank_path)


if __name__ == "__main__":
    unittest.main()
