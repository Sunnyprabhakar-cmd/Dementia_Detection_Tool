"""Clock-drawing image validation, computer vision preprocessing, and spatial/stroke feature extraction."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image
from scipy import ndimage


def validate_drawing_image(image_path: Path, min_ink_ratio: float = 0.002) -> dict[str, Any]:
    """Validate a drawing image, convert to grayscale, denoise, threshold, and return ink mask."""
    if not image_path.is_file():
        raise FileNotFoundError(f"Drawing image not found: {image_path}")

    with Image.open(image_path) as img:
        gray = img.convert("L")
        width, height = gray.size
        arr = np.asarray(gray, dtype=np.uint8)

    if width < 64 or height < 64:
        raise ValueError(f"Drawing image too small ({width}x{height}); minimum is 64x64.")

    # Noise reduction via 3x3 median filter, then adaptive threshold relative to background
    denoised = ndimage.median_filter(arr, size=3)
    bg_level = float(np.percentile(denoised, 95))
    threshold = min(210.0, max(120.0, bg_level - 35.0))
    ink_mask = denoised < threshold

    ink_ratio = float(np.mean(ink_mask))
    if ink_ratio < min_ink_ratio:
        raise ValueError("Drawing image appears blank (insufficient ink pixels).")

    # Simple image quality metric based on contrast and non-fragmented ink
    contrast = max(0.0, min(1.0, (bg_level - float(np.mean(denoised[ink_mask]))) / 255.0))
    return {
        "width": int(width),
        "height": int(height),
        "ink_ratio": round(ink_ratio, 6),
        "contrast_score": round(contrast, 4),
        "ink_mask": ink_mask,
    }


def _detect_components(mask: np.ndarray, min_pixels: int = 8) -> list[dict[str, Any]]:
    """Detect connected ink regions (contours/components) and their bounding boxes."""
    labeled, num_features = ndimage.label(mask)
    if num_features == 0:
        return []
    slices = ndimage.find_objects(labeled)
    components: list[dict[str, Any]] = []
    for idx, slc in enumerate(slices, start=1):
        if slc is None:
            continue
        region = labeled[slc] == idx
        area = int(np.sum(region))
        if area < min_pixels:
            continue
        y0, y1 = slc[0].start, slc[0].stop
        x0, x1 = slc[1].start, slc[1].stop
        cy = (y0 + y1) / 2.0
        cx = (x0 + x1) / 2.0
        components.append({
            "area": area,
            "cx": cx,
            "cy": cy,
            "w": x1 - x0,
            "h": y1 - y0,
        })
    return components


def extract_clock_drawing_features(
    image_path: Path,
    *,
    strokes: list[dict[str, Any]] | None = None,
    completion_time_seconds: float | None = None,
) -> dict[str, Any]:
    """Extract clock boundary, number-region, hand, spatial balance, and stroke features."""
    validated = validate_drawing_image(image_path)
    mask: np.ndarray = validated["ink_mask"]
    height, width = mask.shape

    ys, xs = np.where(mask)
    min_x, max_x = int(xs.min()), int(xs.max())
    min_y, max_y = int(ys.min()), int(ys.max())
    bbox_w = max(1, max_x - min_x + 1)
    bbox_h = max(1, max_y - min_y + 1)
    aspect_ratio = bbox_w / float(bbox_h)

    cx_canvas, cy_canvas = width / 2.0, height / 2.0
    cx_ink, cy_ink = float(xs.mean()), float(ys.mean())
    norm_diag = math.hypot(width, height)
    center_offset_ratio = math.hypot(cx_ink - cx_canvas, cy_ink - cy_canvas) / norm_diag

    radius = max(bbox_w, bbox_h) / 2.0
    dists = np.hypot(xs - cx_ink, ys - cy_ink) / max(1.0, radius)
    outer_ring_ratio = float(np.mean((dists >= 0.72) & (dists <= 1.15)))
    number_ring_ratio = float(np.mean((dists >= 0.45) & (dists < 0.72)))
    inner_hand_ratio = float(np.mean(dists < 0.45))

    # Quadrant balance around ink centroid
    q1 = float(np.mean((xs >= cx_ink) & (ys < cy_ink)))
    q2 = float(np.mean((xs < cx_ink) & (ys < cy_ink)))
    q3 = float(np.mean((xs < cx_ink) & (ys >= cy_ink)))
    q4 = float(np.mean((xs >= cx_ink) & (ys >= cy_ink)))
    quadrants = np.array([q1, q2, q3, q4], dtype=np.float64)
    quadrant_balance = max(0.0, 1.0 - float(np.std(quadrants)) * 4.0)

    # Outer contour circularity
    outer_mask = (dists >= 0.72) & (dists <= 1.15)
    if np.any(outer_mask):
        outer_dists = dists[outer_mask]
        circularity_score = max(0.0, min(1.0, 1.0 - float(np.std(outer_dists)) * 3.0))
    else:
        circularity_score = 0.0

    # Connected component analysis for boundary, number regions, and hands
    components = _detect_components(mask, min_pixels=8)
    number_components = [
        c for c in components
        if 0.42 <= (math.hypot(c["cx"] - cx_ink, c["cy"] - cy_ink) / max(1.0, radius)) <= 0.90
        and max(c["w"], c["h"]) < radius * 0.45
    ]
    detected_number_regions = len(number_components)
    missing_numbers_estimate = max(0, 12 - min(12, detected_number_regions))

    if len(number_components) >= 2:
        angles_deg = sorted(
            (math.degrees(math.atan2(c["cy"] - cy_ink, c["cx"] - cx_ink)) % 360.0)
            for c in number_components
        )
        diffs = [
            (angles_deg[(i + 1) % len(angles_deg)] - angles_deg[i]) % 360.0
            for i in range(len(angles_deg))
        ]
        number_spacing_std_deg = float(np.std(diffs))
        ideal_step = 30.0
        number_placement_deviation_deg = float(np.mean([abs(d - ideal_step) for d in diffs]))
    else:
        number_spacing_std_deg = None
        number_placement_deviation_deg = None

    # Inner hand region analysis
    inner_mask = dists < 0.45
    if np.sum(inner_mask) >= 5:
        hand_angles = np.degrees(np.arctan2(ys[inner_mask] - cy_ink, xs[inner_mask] - cx_ink)) % 360.0
        hand_angle_spread = float(np.std(hand_angles))
        max_hand_reach = float(np.max(dists[inner_mask]))
    else:
        hand_angle_spread = 0.0
        max_hand_reach = 0.0

    # Drawing completeness heuristic (boundary + numbers + hands)
    has_boundary = 1.0 if outer_ring_ratio > 0.05 and circularity_score > 0.35 else 0.0
    has_numbers = min(1.0, detected_number_regions / 12.0)
    has_hands = 1.0 if inner_hand_ratio > 0.02 and max_hand_reach > 0.15 else 0.0
    completeness_score = round((has_boundary * 0.35 + has_numbers * 0.35 + has_hands * 0.30), 4)

    # Stroke-level metrics
    stroke_count = len(strokes) if isinstance(strokes, list) else None
    total_stroke_length = 0.0
    if isinstance(strokes, list):
        for stroke in strokes:
            pts = stroke.get("points") if isinstance(stroke, dict) else None
            if isinstance(pts, list) and len(pts) >= 2:
                for idx in range(1, len(pts)):
                    p0, p1 = pts[idx - 1], pts[idx]
                    total_stroke_length += math.hypot(
                        float(p1.get("x", 0)) - float(p0.get("x", 0)),
                        float(p1.get("y", 0)) - float(p0.get("y", 0)),
                    )

    features = {
        "canvas_width": validated["width"],
        "canvas_height": validated["height"],
        "ink_coverage_ratio": validated["ink_ratio"],
        "image_quality_score": validated["contrast_score"],
        "bounding_box_aspect_ratio": round(aspect_ratio, 4),
        "center_offset_ratio": round(center_offset_ratio, 4),
        "circularity_score": round(circularity_score, 4),
        "outer_ring_ink_ratio": round(outer_ring_ratio, 4),
        "number_ring_ink_ratio": round(number_ring_ratio, 4),
        "inner_hand_ink_ratio": round(inner_hand_ratio, 4),
        "quadrant_balance_score": round(quadrant_balance, 4),
        "q1_ink_ratio": round(q1, 4),
        "q2_ink_ratio": round(q2, 4),
        "q3_ink_ratio": round(q3, 4),
        "q4_ink_ratio": round(q4, 4),
        "detected_number_regions": detected_number_regions,
        "missing_numbers_estimate": missing_numbers_estimate,
        "number_spacing_std_deg": round(number_spacing_std_deg, 2) if number_spacing_std_deg is not None else None,
        "number_placement_deviation_deg": round(number_placement_deviation_deg, 2)
        if number_placement_deviation_deg is not None
        else None,
        "hand_angle_spread_deg": round(hand_angle_spread, 2),
        "hand_length_ratio": round(max_hand_reach, 4),
        "drawing_completeness_score": completeness_score,
        "stroke_count": stroke_count,
        "total_stroke_length_px": round(total_stroke_length, 2) if isinstance(strokes, list) else None,
        "completion_time_seconds": round(float(completion_time_seconds), 3)
        if completion_time_seconds is not None
        else None,
    }
    return {
        "status": "complete",
        "method": "transparent_rule_based_cv_heuristics",
        "limitation": "Rule-based spatial features only; not a validated clinical clock-drawing diagnosis.",
        "features": features,
    }
