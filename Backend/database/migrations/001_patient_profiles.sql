CREATE TABLE IF NOT EXISTS screening_patient_profiles (
    screening_id INTEGER PRIMARY KEY
        REFERENCES screening_sessions(id) ON DELETE CASCADE,
    patient_identifier VARCHAR(80),
    age SMALLINT NOT NULL CHECK (age BETWEEN 1 AND 120),
    sex VARCHAR(40) CHECK (
        sex IS NULL OR sex IN (
            'female', 'male', 'intersex', 'self_described',
            'prefer_not_to_say'
        )
    ),
    education_years SMALLINT CHECK (
        education_years IS NULL OR education_years BETWEEN 0 AND 40
    ),
    handedness VARCHAR(30) CHECK (
        handedness IS NULL OR handedness IN (
            'right', 'left', 'ambidextrous', 'unknown'
        )
    ),
    socioeconomic_status SMALLINT CHECK (
        socioeconomic_status IS NULL OR socioeconomic_status BETWEEN 1 AND 5
    ),
    medical_history TEXT,
    medications TEXT,
    reported_symptoms TEXT,
    symptom_onset VARCHAR(200),
    functional_changes TEXT,
    family_history TEXT,
    consent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
