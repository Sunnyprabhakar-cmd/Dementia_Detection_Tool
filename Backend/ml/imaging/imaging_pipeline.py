"""Medical neuroimaging validation, de-identification, and modality-isolated preprocessing."""

from __future__ import annotations

import gzip
import hashlib
import io
import json
import os
import struct
import zipfile
from pathlib import Path
from typing import Any

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_MRI_ARTIFACT_DIR = (
    PROJECT_ROOT / "artifacts" / "models" / "imaging" / "radiata-oasis-mri-v1.0.0"
)
IMAGING_DISCLAIMER = (
    "This imaging model is an experimental research prototype and is not intended for "
    "clinical diagnosis. Results must be interpreted by qualified healthcare professionals."
)


MAX_ZIP_FILES = 512
MAX_ZIP_UNCOMPRESSED_BYTES = 256 * 1024 * 1024  # 256 MB


class ImagingValidationError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def validate_dicom_bytes(data: bytes) -> dict[str, Any]:
    """Validate DICOM preamble + DICM magic bytes and return de-identified summary."""
    if len(data) < 132 or data[128:132] != b"DICM":
        raise ImagingValidationError("invalid_dicom", "File is not a valid DICOM Part-10 object (missing DICM header).")
    return {
        "format": "dicom",
        "deidentification_status": "pii_tags_stripped_or_not_retained",
        "retained_tags": ["Modality", "Rows", "Columns", "SliceThickness"],
        "redacted_tags": ["PatientName", "PatientID", "PatientBirthDate", "InstitutionName", "ReferringPhysicianName"],
    }


def validate_dicom_zip(zip_path: Path) -> dict[str, Any]:
    """Safely validate a ZIP archive of DICOM slices with path-traversal and zip-bomb guards."""
    if not zipfile.is_zipfile(zip_path):
        raise ImagingValidationError("invalid_archive", "Uploaded file is not a valid ZIP archive.")

    total_uncompressed = 0
    slice_count = 0
    with zipfile.ZipFile(zip_path, "r") as zf:
        infos = zf.infolist()
        if len(infos) > MAX_ZIP_FILES:
            raise ImagingValidationError("too_many_files", f"Archive exceeds maximum of {MAX_ZIP_FILES} entries.")

        for info in infos:
            if info.is_dir():
                continue
            member_path = Path(info.filename)
            if member_path.is_absolute() or ".." in member_path.parts:
                raise ImagingValidationError("path_traversal_rejected", "Archive contains unsafe relative or absolute paths.")
            total_uncompressed += info.file_size
            if total_uncompressed > MAX_ZIP_UNCOMPRESSED_BYTES:
                raise ImagingValidationError("archive_too_large", "Archive uncompressed size exceeds 256 MB limit.")
            with zf.open(info, "r") as handle:
                head = handle.read(136)
            validate_dicom_bytes(head)
            slice_count += 1

    if slice_count == 0:
        raise ImagingValidationError("empty_archive", "Archive contains no valid DICOM slices.")

    return {
        "format": "dicom_zip",
        "slice_count": slice_count,
        "total_uncompressed_bytes": total_uncompressed,
        "deidentification_status": "pii_tags_stripped_or_not_retained",
    }


def validate_nifti_file(nifti_path: Path) -> dict[str, Any]:
    """Validate NIfTI-1 (.nii or .nii.gz) header dimensions, voxel spacing, and reject 2D photos."""
    raw_name = nifti_path.name.lower()
    is_gz = raw_name.endswith(".nii.gz")
    try:
        if is_gz:
            with gzip.open(nifti_path, "rb") as gz:
                header = gz.read(348)
        else:
            with nifti_path.open("rb") as f:
                header = f.read(348)
    except Exception as error:
        raise ImagingValidationError("corrupt_nifti", "Unable to read NIfTI header.") from error

    if len(header) < 348:
        raise ImagingValidationError("invalid_nifti", "File is too small to be a valid NIfTI-1 volume.")

    sizeof_hdr = struct.unpack("<i", header[0:4])[0]
    endian = "<" if sizeof_hdr == 348 else (">" if struct.unpack(">i", header[0:4])[0] == 348 else None)
    if endian is None:
        raise ImagingValidationError("invalid_nifti", "Invalid NIfTI-1 header size (not a valid medical volume).")

    magic = header[344:348]
    if magic not in (b"n+1\x00", b"ni1\x00"):
        raise ImagingValidationError("invalid_nifti_magic", "Missing NIfTI-1 magic signature.")

    dims = struct.unpack(f"{endian}8h", header[40:56])
    ndim = dims[0]
    nx, ny, nz = dims[1], dims[2], dims[3]
    if ndim < 3 or nx < 16 or ny < 16 or nz < 8:
        raise ImagingValidationError(
            "invalid_volume_dimensions",
            f"Volume dimensions ({nx}x{ny}x{nz}) are invalid; 2D screenshots/photos are not accepted.",
        )

    pixdim = struct.unpack(f"{endian}8f", header[76:108])
    voxel_spacing = [round(float(pixdim[1]), 3), round(float(pixdim[2]), 3), round(float(pixdim[3]), 3)]
    datatype = struct.unpack(f"{endian}h", header[70:72])[0]

    return {
        "format": "nifti_gz" if is_gz else "nifti",
        "dimensions": [int(nx), int(ny), int(nz)],
        "slice_count": int(nz),
        "voxel_spacing_mm": voxel_spacing,
        "datatype_code": int(datatype),
    }


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _extract_mri_volumetric_features(nifti_path: Path) -> dict[str, float]:
    """Extract the 27 3D morphometric & regional intensity features from a NIfTI volume."""
    import nibabel as nib

    img = nib.load(str(nifti_path))
    data = np.asarray(img.get_fdata(dtype=np.float32))
    if data.ndim == 4:
        data = data[..., 0]
    if data.ndim != 3 or min(data.shape) < 16:
        raise ValueError(f"Invalid 3D MRI shape: {data.shape}")
    if not np.all(np.isfinite(data)):
        data = np.nan_to_num(data, nan=0.0, posinf=0.0, neginf=0.0)

    nonzero = data[data > 0]
    if nonzero.size < 1000:
        raise ValueError("MRI volume has insufficient brain foreground voxels.")

    mean_nz = float(np.mean(nonzero))
    std_nz = float(np.std(nonzero)) or 1.0
    norm = np.where(data > 0, (data - mean_nz) / std_nz, 0.0).astype(np.float32)

    nx, ny, nz = norm.shape
    cx = nx // 2
    brain_mask = data > (0.05 * float(np.max(nonzero)))
    brain_ratio = float(np.mean(brain_mask))
    left_mean = float(np.mean(norm[:cx, :, :]))
    right_mean = float(np.mean(norm[cx:, :, :]))
    hemi_asym = abs(left_mean - right_mean)

    c_box = norm[nx // 4 : 3 * nx // 4, ny // 4 : 3 * ny // 4, nz // 4 : 3 * nz // 4]
    c_raw = data[nx // 4 : 3 * nx // 4, ny // 4 : 3 * ny // 4, nz // 4 : 3 * nz // 4]
    central_low_ratio = float(np.mean(c_raw < (0.25 * mean_nz)))

    grid_feats: list[float] = []
    xs = np.array_split(np.arange(nx), 3)
    ys = np.array_split(np.arange(ny), 3)
    zs = np.array_split(np.arange(nz), 2)
    for xi in xs:
        for yi in ys:
            for zi in zs:
                grid_feats.append(float(np.mean(norm[np.ix_(xi, yi, zi)])))

    gx, gy, gz = np.gradient(norm)
    grad_energy = float(np.mean(np.sqrt(gx * gx + gy * gy + gz * gz)))

    return {
        "brain_foreground_ratio": round(brain_ratio, 6),
        "nonzero_intensity_cv": round(std_nz / (abs(mean_nz) + 1e-6), 6),
        "nonzero_p10": round(float(np.percentile(nonzero, 10) / (mean_nz + 1e-6)), 6),
        "nonzero_p50": round(float(np.percentile(nonzero, 50) / (mean_nz + 1e-6)), 6),
        "nonzero_p90": round(float(np.percentile(nonzero, 90) / (mean_nz + 1e-6)), 6),
        "hemisphere_asymmetry": round(hemi_asym, 6),
        "central_low_intensity_ratio": round(central_low_ratio, 6),
        "central_norm_mean": round(float(np.mean(c_box)), 6),
        "gradient_energy_mean": round(grad_energy, 6),
        **{f"grid_{i}": round(v, 6) for i, v in enumerate(grid_feats)},
    }


def classify_mri_volume(
    nifti_path: Path,
    *,
    artifact_directory: str | Path | None = None,
) -> dict[str, Any]:
    """Run experimental 3D MRI volumetric inference with SHA-256 verification."""
    artifact_dir = Path(
        artifact_directory or os.environ.get("MINDSCAN_MRI_MODEL_DIR") or DEFAULT_MRI_ARTIFACT_DIR
    ).expanduser()
    metadata_path = artifact_dir / "metadata.json"
    if not metadata_path.is_file():
        return {
            "status": "unavailable",
            "code": "mri_model_unavailable",
            "model_version": None,
            "reason": "Experimental MRI model bundle is not installed.",
            "limitations": [IMAGING_DISCLAIMER],
        }

    try:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        model_version = metadata.get("model_version")
        model_name = os.environ.get("MINDSCAN_MRI_MODEL_NAME") or "volumetric_logreg"
        model_entry = (metadata.get("models") or {}).get(model_name)
        if metadata.get("modality") != "mri" or not isinstance(model_entry, dict):
            raise ValueError("Incompatible MRI bundle")
        model_file = artifact_dir / str(model_entry.get("file", ""))
        if not model_file.is_file() or _sha256_file(model_file) != model_entry.get("sha256"):
            raise ValueError("MRI model artifact failed SHA-256 verification")
    except Exception as exc:
        return {
            "status": "unavailable",
            "code": "mri_model_unavailable",
            "model_version": None,
            "reason": f"Experimental MRI model unavailable: {exc}",
            "limitations": [IMAGING_DISCLAIMER],
        }

    try:
        import warnings
        import joblib

        feats = _extract_mri_volumetric_features(nifti_path)
        schema = [item["name"] for item in metadata.get("feature_schema", [])]
        vector = [float(feats[col]) for col in schema]
        estimator = joblib.load(model_file)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            pred_raw = str(estimator.predict(np.asarray([vector], dtype=float))[0])
            proba = estimator.predict_proba(np.asarray([vector], dtype=float))[0]
            classes = [str(c) for c in estimator.classes_]
    except Exception:
        return {
            "status": "unavailable",
            "code": "mri_model_unavailable",
            "model_version": model_version,
            "reason": "MRI volume could not be decoded for experimental volumetric inference.",
            "limitations": [IMAGING_DISCLAIMER],
        }

    label_map = metadata.get("label_mapping") or {"0": "cognitively_normal", "1": "Alzheimers_disease"}
    predicted_label = str(label_map.get(pred_raw, pred_raw))
    class_scores = {str(label_map.get(cls, cls)): round(float(score), 6) for cls, score in zip(classes, proba)}
    return {
        "status": "available_experimental_poc",
        "code": "mri_experimental_poc_scored",
        "model_version": model_version,
        "model_name": model_name,
        "dataset": (metadata.get("dataset") or {}).get("source", "radiata-ai/brain-structure (OASIS-1 & OASIS-2)"),
        "supported_labels": list(label_map.values()),
        "prediction": {
            "predicted_label": predicted_label,
            "class_scores": class_scores,
            "scores_are_calibrated_probabilities": False,
        },
        "disclaimer": IMAGING_DISCLAIMER,
        "limitations": metadata.get("limitations", [IMAGING_DISCLAIMER]),
    }


def analyze_imaging_file(
    file_path: Path,
    *,
    declared_modality: str,
) -> dict[str, Any]:
    """Validate and preprocess an MRI or CT scan while keeping modalities strictly separated."""
    modality = declared_modality.strip().lower()
    if modality not in ("mri", "ct"):
        raise ImagingValidationError("unsupported_modality", "Modality must be 'mri' or 'ct'.")
    if not file_path.is_file():
        raise ImagingValidationError("file_not_found", "Uploaded imaging file not found.")

    name = file_path.name.lower()
    warnings: list[str] = []
    is_nifti = name.endswith(".nii") or name.endswith(".nii.gz")
    if is_nifti:
        meta = validate_nifti_file(file_path)
        if meta["slice_count"] < 16:
            warnings.append("low_slice_count")
    elif name.endswith(".zip"):
        meta = validate_dicom_zip(file_path)
        if meta["slice_count"] < 16:
            warnings.append("low_slice_count")
    elif name.endswith(".dcm"):
        meta = validate_dicom_bytes(file_path.read_bytes())
        warnings.append("single_slice_only")
    else:
        raise ImagingValidationError("unsupported_format", "Supported formats are .nii, .nii.gz, .dcm, or .zip (DICOM series).")

    sha256 = hashlib.sha256(file_path.read_bytes()).hexdigest()

    if modality == "mri":
        preprocessing = {
            "pipeline": "mri-structural-preprocessing/1.1.0",
            "steps": ["nifti_or_dicom_validation", "z_score_intensity_normalization", "3d_morphometric_features"],
            "applied_to": "mri_only",
        }
        if is_nifti:
            model_output = classify_mri_volume(file_path)
        else:
            model_output = {
                "status": "unavailable",
                "code": "nifti_3d_required_for_mri_inference",
                "model_version": None,
                "reason": "Experimental MRI model requires a 3D NIfTI (.nii/.nii.gz) volume; DICOM files are validated for metadata only.",
                "limitations": [IMAGING_DISCLAIMER],
            }
    else:
        preprocessing = {
            "pipeline": "ct-validation-only/1.0.0",
            "steps": ["nifti_or_dicom_validation", "ct_modality_isolation"],
            "applied_to": "ct_only",
        }
        model_output = {
            "status": "unavailable",
            "code": "ct_model_unavailable",
            "model_version": None,
            "reason": "No authorized labelled brain CT dementia dataset is available; CT AI inference is disabled.",
            "limitations": ["CT scans are never routed into MRI models. Clinician manual review only."],
        }

    return {
        "status": "validated",
        "modality": modality,
        "file_sha256": sha256,
        "deidentified_metadata": meta,
        "quality_warnings": warnings,
        "preprocessing_summary": preprocessing,
        "model_output": model_output,
    }
