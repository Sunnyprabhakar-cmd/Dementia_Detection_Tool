CREATE TABLE IF NOT EXISTS brain_imaging_scans (
    id SERIAL PRIMARY KEY,
    screening_id INTEGER NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    modality VARCHAR(10) NOT NULL CHECK (modality IN ('mri', 'ct')),
    original_format VARCHAR(20) NOT NULL CHECK (original_format IN ('nifti', 'nifti_gz', 'dicom', 'dicom_zip')),
    storage_key VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64) NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    deidentified_metadata JSONB,
    quality_warnings JSONB,
    preprocessing_summary JSONB,
    model_output JSONB,
    processing_status VARCHAR(30) NOT NULL DEFAULT 'validated',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS brain_imaging_screening_modality_idx
    ON brain_imaging_scans (screening_id, modality, created_at DESC);

CREATE INDEX IF NOT EXISTS brain_imaging_user_idx
    ON brain_imaging_scans (user_id, created_at DESC);
