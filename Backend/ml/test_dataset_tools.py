import hashlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError

import pandas as pd

from Backend.ml.download_authorized_dataset import (
    DownloadGateError,
    download_file,
    load_approved_manifest,
)
from Backend.ml.join_derived_mri import MRIJoinError, join_derived_features


class DownloadManifestTests(unittest.TestCase):
    def write_manifest(self, directory: Path, **overrides) -> Path:
        values = {
            "dataset_name": "approved research release",
            "release": "release-1",
            "source_url": "https://sites.wustl.edu/oasisbrains/",
            "download_url": "https://download.nrg.wustl.edu/file.tar.gz",
            "access_terms_url": "https://sites.wustl.edu/oasisbrains/home/access/",
            "authorization_reference": "local-approval-1",
            "license_or_agreement": "approved research terms",
            "authorization_confirmed": True,
            "sha256": hashlib.sha256(b"fixture").hexdigest(),
            "file_name": "file.tar.gz",
        }
        values.update(overrides)
        path = directory / "manifest.json"
        path.write_text(json.dumps(values), encoding="utf-8")
        return path

    def test_accepts_complete_explicitly_approved_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            manifest = load_approved_manifest(
                self.write_manifest(Path(temporary))
            )
        self.assertEqual(manifest["release"], "release-1")

    def test_rejects_unapproved_or_untrusted_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for changes in (
                {"authorization_confirmed": False},
                {"download_url": "https://unknown.example/file"},
                {"file_name": "../file"},
                {"sha256": "not-a-checksum"},
                {"authorization_reference": ""},
                {"license_or_agreement": ""},
            ):
                with self.subTest(changes=changes):
                    with self.assertRaises(DownloadGateError):
                        load_approved_manifest(self.write_manifest(root, **changes))

    def test_resumes_to_verified_file_and_writes_provenance_sidecar(self):
        class Response(io.BytesIO):
            status = 206
            headers = {}

            def geturl(self):
                return "https://download.nrg.wustl.edu/file.tar.gz"

            def getcode(self):
                return self.status

        class Opener:
            def __init__(self):
                self.request = None

            def open(self, request, timeout):
                self.request = request
                return Response(b"def")

        content = b"abcdef"
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = {
                "dataset_name": "approved research release",
                "release": "release-1",
                "source_url": "https://sites.wustl.edu/oasisbrains/",
                "download_url": "https://download.nrg.wustl.edu/file.tar.gz",
                "access_terms_url": "https://sites.wustl.edu/oasisbrains/home/access/",
                "authorization_reference": "local-approval-1",
                "license_or_agreement": "approved research terms",
                "authorization_confirmed": True,
                "sha256": hashlib.sha256(content).hexdigest(),
                "expected_size_bytes": len(content),
                "file_name": "file.tar.gz",
            }
            partial = root / "file.tar.gz.part"
            partial.write_bytes(b"abc")
            opener = Opener()

            result = download_file(manifest, root, opener=opener)

            self.assertEqual(opener.request.get_header("Range"), "bytes=3-")
            self.assertEqual(result["sha256"], manifest["sha256"])
            self.assertEqual((root / "file.tar.gz").read_bytes(), content)
            self.assertTrue((root / "file.tar.gz.provenance.json").is_file())

    def test_access_denied_stops_without_authentication_bypass(self):
        class Opener:
            def open(self, request, timeout):
                error = HTTPError(request.full_url, 403, "Forbidden", {}, None)
                error.close()
                raise error

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            manifest = {
                "dataset_name": "approved research release",
                "release": "release-1",
                "source_url": "https://sites.wustl.edu/oasisbrains/",
                "download_url": "https://download.nrg.wustl.edu/file.tar.gz",
                "access_terms_url": "https://sites.wustl.edu/oasisbrains/home/access/",
                "authorization_reference": "local-approval-1",
                "license_or_agreement": "approved research terms",
                "authorization_confirmed": True,
                "sha256": hashlib.sha256(b"fixture").hexdigest(),
                "file_name": "file.tar.gz",
            }
            with self.assertRaisesRegex(DownloadGateError, "manual access process"):
                download_file(manifest, root, opener=Opener())


class DerivedMRIJoinTests(unittest.TestCase):
    def setUp(self):
        self.clinical = pd.DataFrame(
            {
                "subject": ["p1", "p2", "p3"],
                "visit": [1, 1, 1],
                "label": ["group_a", "group_b", "group_a"],
            }
        )
        self.mri = pd.DataFrame(
            {
                "image_subject": ["p1", "p2", "orphan"],
                "image_visit": [1, 1, 9],
                "volume": [1.2, 2.3, 9.9],
                "processing": ["complete", "failed", "complete"],
            }
        )

    def join(self, mri=None):
        return join_derived_features(
            self.clinical,
            mri if mri is not None else self.mri,
            clinical_id="subject",
            mri_id="image_subject",
            clinical_session="visit",
            mri_session="image_visit",
            feature_columns=["volume"],
            mri_processing_status="processing",
        )

    def test_exact_id_session_matching_and_unmatched_records(self):
        result, stats = self.join()
        self.assertEqual(
            result["mri_status"].tolist(),
            ["matched", "processing_failed", "missing_mri"],
        )
        self.assertTrue(pd.isna(result.loc[1, "volume"]))
        self.assertEqual(stats["matched_records"], 1)
        self.assertEqual(stats["missing_mri_records"], 1)
        self.assertEqual(stats["processing_failed_records"], 1)
        self.assertEqual(stats["unmatched_mri_records"], 1)

    def test_duplicate_mri_id_session_is_rejected(self):
        duplicated = pd.concat([self.mri, self.mri.iloc[[0]]], ignore_index=True)
        with self.assertRaisesRegex(MRIJoinError, "not unique"):
            self.join(duplicated)

    def test_missing_feature_and_non_numeric_feature_are_rejected(self):
        with self.assertRaisesRegex(MRIJoinError, "missing"):
            join_derived_features(
                self.clinical,
                self.mri,
                clinical_id="subject",
                mri_id="image_subject",
                feature_columns=["not_a_feature"],
            )
        non_numeric = self.mri.copy()
        non_numeric["volume"] = ["one", "two", "three"]
        with self.assertRaisesRegex(MRIJoinError, "numeric"):
            self.join(non_numeric)


if __name__ == "__main__":
    unittest.main()
