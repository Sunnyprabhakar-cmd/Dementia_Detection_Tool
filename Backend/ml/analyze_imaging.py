"""CLI entrypoint for MRI/CT neuroimaging validation and preprocessing."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from Backend.ml.imaging.imaging_pipeline import ImagingValidationError, analyze_imaging_file


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and preprocess MRI/CT neuroimaging files.")
    parser.add_argument("--file", required=True)
    parser.add_argument("--modality", required=True, choices=["mri", "ct"])
    args = parser.parse_args()

    try:
        result = analyze_imaging_file(Path(args.file), declared_modality=args.modality)
        print(json.dumps(result, allow_nan=False))
        return 0
    except ImagingValidationError as error:
        print(json.dumps({"status": "rejected", "code": error.code, "message": str(error)}))
        return 1
    except Exception as error:
        print(json.dumps({"status": "error", "code": "imaging_error", "message": str(error)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
