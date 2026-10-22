# Privacy and data handling

## Information handled

The application can store account details, an optional patient identifier, age and optional health/context fields, consent time, task responses, clinician-entered observations, a transcript that the participant chooses to continue with, and descriptive measurements derived from that transcript. These are sensitive data. Do not use real participant information in an unapproved environment.

Raw voice recordings are uploaded to the backend for local transcription and are held in a temporary per-request location. The recording is removed after processing; it is not persisted as an assessment response. A transcript is shown for review and is stored only when the participant elects to continue. Voice is not used to calculate a dementia score.

## Access and deletion

Authentication is required for assessment and audio endpoints. Assessment reads, changes, and deletion are scoped to the authenticated user. Deleting an assessment removes associated profile, task, and result rows through database relationships. This does not remove account records, backups, operating-system logs, or any data retained outside the application.

## Operational limitations

This repository does not implement a complete privacy program or establish regulatory compliance. Production safeguards still need review, including encrypted transport and storage, least-privilege database access, secret management, retention schedules, backup deletion, audit logging, consent language, incident response, and applicable institutional/legal requirements. The API currently configures broad CORS and the PostgreSQL client is configured without TLS; do not expose this development configuration to the public internet.

Do not commit `.env` files, participant files, audio, model binaries, access tokens, or authorization documents. Minimize collected fields and use only the data needed for a specifically approved purpose.
