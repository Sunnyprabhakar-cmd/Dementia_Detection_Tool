CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    refer_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS task_responses (
    id SERIAL PRIMARY KEY,
    screening_id INTEGER NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
    task_type VARCHAR(50) NOT NULL,
    response_data JSONB,
    score NUMERIC(5, 2),
    reaction_time NUMERIC(10, 3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS screening_results (
    id SERIAL PRIMARY KEY,
    screening_id INTEGER UNIQUE NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
    memory_score NUMERIC(5, 2),
    attention_score NUMERIC(5, 2),
    language_score NUMERIC(5, 2),
    orientation_score NUMERIC(5, 2),
    overall_score NUMERIC(5, 2),
    risk_level VARCHAR(20),
    risk_score NUMERIC(5, 2),
    probability NUMERIC(5, 4),
    task_scores JSONB,
    recommendation TEXT,
    flags JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
