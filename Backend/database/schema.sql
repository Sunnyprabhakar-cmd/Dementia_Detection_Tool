git status-- =========================================
-- USERS
-- =========================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    refer_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- =========================================
-- SCREENING SESSIONS
-- =========================================

CREATE TABLE screening_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'started',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,

    CONSTRAINT fk_screening_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);

-- Required by patient intake and assessment report queries.
CREATE TABLE IF NOT EXISTS screening_patient_profiles (
    screening_id INTEGER PRIMARY KEY REFERENCES screening_sessions(id) ON DELETE CASCADE,
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
    symptom_onset TEXT,
    functional_changes TEXT,
    family_history TEXT,
    consent_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- =========================================
-- TASK RESPONSES
-- =========================================

CREATE TABLE task_responses (
    id SERIAL PRIMARY KEY,

    screening_id INTEGER NOT NULL,

    task_type VARCHAR(50) NOT NULL,

    response_data JSONB,

    score NUMERIC(5,2),

    reaction_time NUMERIC(10,3),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_response_screening
        FOREIGN KEY (screening_id)
        REFERENCES screening_sessions(id)
        ON DELETE CASCADE
);


-- =========================================
-- SCREENING RESULTS
-- =========================================

CREATE TABLE screening_results (
    id SERIAL PRIMARY KEY,

    screening_id INTEGER UNIQUE NOT NULL,

    memory_score NUMERIC(5,2),

    attention_score NUMERIC(5,2),

    language_score NUMERIC(5,2),

    orientation_score NUMERIC(5,2),

    overall_score NUMERIC(5,2),

    risk_level VARCHAR(20),

    risk_score NUMERIC(5,2),

    probability NUMERIC(5,4),

    task_scores JSONB,

    recommendation TEXT,

    flags JSONB,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_result_screening
        FOREIGN KEY (screening_id)
        REFERENCES screening_sessions(id)
        ON DELETE CASCADE
);