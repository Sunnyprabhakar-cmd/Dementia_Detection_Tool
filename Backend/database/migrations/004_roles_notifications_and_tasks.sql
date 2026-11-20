ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT 'patient'
        CHECK (role IN ('patient', 'clinician')),
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(16) NOT NULL DEFAULT 'en';

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(40) NOT NULL DEFAULT 'info',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_read_created_idx
    ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS clinician_reviews (
    id SERIAL PRIMARY KEY,
    screening_id INTEGER NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
    clinician_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notes TEXT NOT NULL,
    follow_up_recommended BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
