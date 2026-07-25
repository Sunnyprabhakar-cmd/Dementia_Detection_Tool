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

    probability NUMERIC(5,4),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_result_screening
        FOREIGN KEY (screening_id)
        REFERENCES screening_sessions(id)
        ON DELETE CASCADE
);