"""CLI entrypoint for clock-drawing image validation and spatial feature extraction."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from Backend.ml.preprocessing.image_preprocessing import extract_clock_drawing_features


def main() -> int:
    parser = argparse.ArgumentParser(description="Analyze a clock drawing image.")
    parser.add_argument("--image", required=True, help="Path to PNG/JPEG drawing image")
    parser.add_argument("--strokes", default="", help="Optional JSON file with strokes array")
    parser.add_argument("--time", type=float, default=None, help="Completion time in seconds")
    args = parser.parse_args()

    strokes = None
    if args.strokes:
        strokes_path = Path(args.strokes)
        if strokes_path.is_file():
            strokes = json.loads(strokes_path.read_text(encoding="utf-8"))

    try:
        result = extract_clock_drawing_features(
            Path(args.image),
            strokes=strokes,
            completion_time_seconds=args.time,
        )
        print(json.dumps(result, allow_nan=False))
        return 0
    except Exception as error:
        print(json.dumps({
            "status": "error",
            "message": str(error),
            "features": None,
        }))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
