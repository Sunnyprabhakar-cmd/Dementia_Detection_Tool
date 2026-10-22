ALTER TABLE screening_sessions
    ALTER COLUMN status SET DEFAULT 'in_progress';

CREATE INDEX IF NOT EXISTS screening_sessions_user_status_started_idx
    ON screening_sessions (user_id, status, started_at DESC);

CREATE INDEX IF NOT EXISTS task_responses_screening_task_created_idx
    ON task_responses (screening_id, task_type, created_at DESC, id DESC);
