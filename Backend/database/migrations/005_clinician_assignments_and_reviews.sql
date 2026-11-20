ALTER TABLE clinician_reviews
    ADD COLUMN IF NOT EXISTS patient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS review_status VARCHAR(30) NOT NULL DEFAULT 'reviewed'
        CHECK (review_status IN ('pending', 'in_review', 'reviewed'));

CREATE TABLE IF NOT EXISTS clinician_patient_assignments (
    id SERIAL PRIMARY KEY,
    clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (clinician_id, patient_id)
);

CREATE INDEX IF NOT EXISTS clinician_assignments_clinician_idx
    ON clinician_patient_assignments (clinician_id, patient_id);

CREATE INDEX IF NOT EXISTS clinician_assignments_patient_idx
    ON clinician_patient_assignments (patient_id, clinician_id);

CREATE INDEX IF NOT EXISTS clinician_reviews_screening_created_idx
    ON clinician_reviews (screening_id, created_at DESC);

CREATE INDEX IF NOT EXISTS clinician_reviews_patient_idx
    ON clinician_reviews (patient_id);
