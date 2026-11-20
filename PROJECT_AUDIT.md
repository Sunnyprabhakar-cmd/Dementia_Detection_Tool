# MindScan AI — Complete Repository Audit (`PROJECT_AUDIT.md`)

**Date:** 2026-11-20  
**Workspace:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`  
**Audit Scope:** Full read-only inspection of all directories, source files, dependencies, database schemas, ML/AI pipelines, and test suites prior to Stage 1 implementation.

---

## 1. Executive Summary

The repository (`mindscan-ai`) is a well-structured **React + Vite** frontend, **Node.js + Express (ESM)** backend, **PostgreSQL** database, and **Python** ML/speech-processing prototype. It already enforces strong engineering boundaries:
- Authenticated, user-scoped assessment sessions (`JWT` + `bcrypt`).
- Server-side scoring for `memory`, `attention`, and `orientation`, plus privacy-preserving `voice` observation storage (raw audio and transcript text are not persisted).
- A strict, checksum-verified Python subprocess inference contract (`Backend/ml/predict.py`, `model_contract.py`) that returns explicit `unavailable` states rather than fabricating clinical predictions.
- A `faster-whisper` offline speech transcription pipeline (`transcribe_audio.py`, `speech_features.py`, `transcript_analysis.py`).

However, several core capabilities required by the target **Early-Stage Dementia Screening System** are missing, incomplete, or disconnected:
1. **Dependencies & Environment:** `Backend/node_modules`, `Frontend/node_modules`, Python `.venv` / `.venv-audio`, and `.env` files are not installed/configured yet (5/33 Backend tests fail on missing `express`/`pg`; 10/10 Python tests fail on `PYTHONPATH` / missing `artifacts/models/tabular/baseline_v1`).
2. **Cognitive Assessments:** Missing **Delayed Memory Recall**, **Number Repetition / Digit Span**, **Picture Recognition**, **Pattern Recognition**, and **Clock Drawing Assessment**. Existing `MemoryTask`, `OrientationTask`, and `LanguageTask` in `Frontend/src/App.jsx` submit hardcoded `responseTime` values (`12.5`, `10.5`, `14`) instead of measured completion times.
3. **Voice & Speech Intelligence:** Acoustic signal features (**MFCCs**, **pitch & pitch variation**, waveform silence/pause detection, response latency) are not implemented (`SpeechTimingObservations` in `App.jsx` literally displays `"Pitch statistics: Not measured"`). Language-aware transcript rules are English-only; no voice visualizations exist.
4. **Drawing Intelligence:** Completely absent — no HTML5 canvas capture, image/stroke preprocessing, spatial accuracy, number placement, clock hand positioning, or drawing time analysis.
5. **AI/ML & Risk/Recommendation Engine:** No live-compatible trained model artifact is installed (`artifacts/models/` has no `.pkl` bundle). `screening_results.risk_level` and `risk_score` are hardcoded to `null` in `screeningService.js`, `recommendation` is a static string, and `aiService.js` (`/api/ai/analyze`) is a disconnected legacy heuristic.
6. **Application & End-User Features:** No role-based authentication (`patient` vs `clinician`), no dedicated **Clinician Dashboard**, no **PDF report export**, no **Notifications** system, incomplete i18n coverage (`en`, `si`, `ta`), and duplicated/unused frontend components (`Login.jsx`, `memoryTask.jsx`, `startScreening.jsx`, duplicate `AttentionTask` in `App.jsx` vs `components/AttentionTask.jsx`).

---

## 2. Repository Inventory & Environment Findings

| Area | Verified Paths / Versions | Current Health |
| --- | --- | --- |
| **Root** | `package.json`, `README.md`, `setup.ps1`, `scripts/dev.js`, `Frontend.zip`, `h -u origin main --force-with-lease` (stray file) | Root scripts orchestrate Backend, Frontend, DB, and Python tests. |
| **Frontend** | `Frontend/package.json` (`react` 19.2.8, `vite` 8.3.0, `eslint` 10.10.0) | `12/12` unit tests in `Frontend/tests/assessmentUtils.test.js` pass. `node_modules` and `.env` missing. |
| **Backend** | `Backend/package.json` (`express` 4.22.3, `pg` 8.23.0, `bcrypt` 6.0.0, `jsonwebtoken` 9.0.3, `cors` 2.8.6, `dotenv` 17.4.2, `axios` 1.20.0) | `28/33` Node tests pass; `5/33` fail due to missing `node_modules` (`express`, `pg`). `.env` missing. |
| **Database** | `Backend/database/migrations/000_core_tables.sql` through `003_runtime_indexes.sql`, `schema.sql` | Migrations are clean; `schema.sql` line 1 has a syntax typo (`git status-- ===...`). |
| **Python ML** | Python 3.14.7 installed globally; `Backend/ml/requirements-training.txt`, `requirements-audio.txt` | `.venv` and `.venv-audio` not created. `test_*.py` fail without `PYTHONPATH` set to repo root; `test_legacy_model.py` fails because `artifacts/models/tabular/baseline_v1/metadata.json` is absent. |
| **Docs & Research** | `docs/*`, `research-data/saturn_dryad_2025/*`, `artifacts/reports/data_audit/oasis_dementia_audit.json` | Thorough documentation of provenance, privacy, and SATURN Dryad 2025 baseline isolation. |

---

## 3. Seven-Layer Architectural Comparison & Implementation Matrix

| Layer / Module | Existing Status | Missing Features | Required Changes | Dependencies |
| --- | --- | --- | --- | --- |
| **1. Client Layer** (`Frontend/src/App.jsx`, `components/*`, `assessmentUtils.js`, `api.js`) | Auth UI, language switcher (`en`/`si`/`ta`), intake/consent form, immediate memory, attention, orientation, voice recording, language fluency, optional motor tapping & clinician form, basic report & 5-item history. | Delayed memory recall; Digit span (number repetition); Picture recognition; Pattern recognition; Clock drawing canvas; real task completion timers; error/skip pattern tracking; voice & drawing visualizations; PDF export; Clinician dashboard; notifications UI; full `si`/`ta` translations. | Modularize `App.jsx` into dedicated task/dashboard components; remove/archive legacy `Login.jsx`, `memoryTask.jsx`, `startScreening.jsx` and unify `AttentionTask.jsx`; add missing cognitive & drawing tasks; add real timers & charts; wire new APIs. | Backend REST APIs, Browser `MediaRecorder`, HTML5 `Canvas` |
| **2. Backend Services Layer** (`Backend/server.js`, `routes/*`, `controller/*`, `services/*`, `middleware/*`) | Express ESM API, JWT auth, screening CRUD, server-side scoring (`memory`, `attention`, `orientation`), voice privacy validation, audio upload validation, ML subprocess runner. | Role-based auth (`patient`/`clinician`); task validators/scorers for delayed recall, digit span, picture recognition, pattern recognition, clock drawing; drawing upload/analysis endpoint; clinician endpoints; notifications endpoints; risk/recommendation aggregation; PDF/report data endpoint. | Add `role` & `preferred_language` to auth/users; extend `screeningService.js` & `assessmentValidation.js` for new tasks; add `drawingRoutes`/`drawingController`, `clinicianRoutes`, `notificationRoutes`; install `Backend/node_modules`. | PostgreSQL, `authMiddleware.js`, Python ML/AI scripts |
| **3. AI Processing Layer** (`Backend/ml/transcribe_audio.py`, `speech_features.py`, `transcript_analysis.py`, `audio_validation.py`) | `faster-whisper` (`base`) offline transcription, audio decoding/validation, WPM, segment pause gaps, non-speech ratio, English filler/repetition/vague-word counts. | Acoustic signal features (**MFCCs**, **pitch F0 mean/std/range**, energy, response latency); multilingual transcript rules (`si`, `ta`); **Drawing Intelligence** (`drawing_features.py` for clock contour, number placement, clock hand angles, spatial accuracy, completion time). | Add acoustic extraction (`librosa`/`scipy`/`numpy`) to audio pipeline; add language-aware speech analysis; create `Backend/ml/drawing_features.py` for clock drawing image/stroke analysis. | `faster-whisper`, `numpy`, `scipy`, `librosa` (or `soundfile`), `opencv-python-headless` / `Pillow` |
| **4. Machine Learning Layer** (`Backend/ml/train_model.py`, `predict.py`, `model_contract.py`, `tabular_baseline.py`, `audio_classifier.py`, `data_audit.py`) | Versioned bundle contract, SHA-256 verification, group-aware `LogisticRegression` & `RandomForestClassifier` trainer, `predict.py` CLI, SATURN Dryad 2025 baseline. | Live-compatible trained model artifacts (cognitive, speech, drawing); dataset acquisition/cleaning/feature-selection scripts for public authorized datasets; risk score & recommendation engine; model comparison & evaluation reports. | Set up `.venv`; acquire/validate authorized public datasets; train & evaluate models with proper train/val/test & comparison; persist versioned bundles; implement risk/recommendation engine. | `pandas`, `numpy`, `scikit-learn`, `joblib`, authorized datasets |
| **5. Data Storage Layer** (`Backend/database/migrations/*`, `schema.sql`, `config/db.js`) | PostgreSQL pool + TLS config + 4 numbered migrations (`users`, `screening_sessions`, `screening_patient_profiles`, `task_responses`, `screening_results`). | `users.role` (`patient`/`clinician`), `users.preferred_language`; `notifications` table; drawing storage/metadata support; fix `schema.sql` line 1 typo. | Add migration `004_roles_notifications_and_tasks.sql`; fix `schema.sql`; ensure PostgreSQL `mindscan` DB is migrated and tested. | PostgreSQL server |
| **6. External Services Layer** (`Backend/ml/download_authorized_dataset.py`, `faster-whisper` cache, `.env.example`) | Gated dataset downloader; offline `HF_HUB_OFFLINE=1` whisper config; `.env.example` templates. | Local `.env` files; clear configuration template for optional external STT/translation APIs with graceful local fallback. | Create `.env` templates/configs; ensure graceful fallback when `faster-whisper` cache or external APIs are absent. | Network (for authorized dataset download), HuggingFace cache |
| **7. Output & End Users Layer** (`ResultSummary` in `App.jsx`, `resultController.js`, `demoService.js`) | Research-disclaimer report, cognitive task-performance score, simulated educational percentage, voice timing/transcript counts, basic 5-item history. | Patient dashboard (full history, trends, notifications); Clinician dashboard (patient cohort view, clinical notes, risk breakdown); PDF report export; voice & drawing visualizations. | Build Patient & Clinician dashboards, interactive charts/visualizations, PDF export, and notification center. | Client Layer, Backend APIs |

---

## 4. Module Dependency Map

```mermaid
flowchart TD
    UI[React + Vite Client Layer] -->|JWT Auth & Role| AuthAPI[/api/auth]
    UI -->|Screening & Tasks| ScreenAPI[/api/screening]
    UI -->|Audio Blob| AudioAPI[/api/audio/upload]
    UI -->|Drawing Canvas/Strokes| DrawAPI[/api/screening/:id/drawing]
    UI -->|History & Reports| ResultAPI[/api/results]
    UI -->|Clinician Views| ClinAPI[/api/clinician]
    UI -->|Notifications| NotifAPI[/api/notifications]

    AuthAPI --> AuthSvc[authService.js]
    ScreenAPI --> ScreenSvc[screeningService.js]
    ScreenSvc --> ValSvc[assessmentValidation.js]
    ScreenSvc --> MLSvc[mlService.js]
    ScreenSvc --> RiskEng[Risk & Recommendation Engine]

    AudioAPI --> AudioCtrl[audioAgentController.js]
    AudioCtrl -->|subprocess| WhisperPy[transcribe_audio.py + speech_features.py + acoustic_features.py]
    DrawAPI --> DrawCtrl[drawingController.js]
    DrawCtrl -->|subprocess| DrawPy[drawing_features.py]

    MLSvc -->|subprocess| PredictPy[predict.py]
    PredictPy --> Bundles[Versioned Model Bundles]
    TrainPy[train_model.py] --> Bundles

    AuthSvc --> PG[(PostgreSQL)]
    ScreenSvc --> PG
    ResultAPI --> PG
    ClinAPI --> PG
    NotifAPI --> PG
```

---

## 5. Duplicated Code, Unused Files & Architectural Problems

1. **Duplicate `AttentionTask`:** `Frontend/src/components/AttentionTask.jsx` implements a cleaner `performance.now()`-based task with `saveFailed` retry handling, whereas `Frontend/src/App.jsx` (lines 781–853) defines an inline `AttentionTask` using `Date.now()` and does not import `components/AttentionTask.jsx`.
2. **Unused Legacy Components:** `Frontend/src/components/Login.jsx`, `Frontend/src/components/memoryTask.jsx`, and `Frontend/src/components/startScreening.jsx` are orphaned and unused by `App.jsx`.
3. **Monolithic `App.jsx`:** All views, tasks, and report components live in a single 1,370-line file (`Frontend/src/App.jsx`), making maintenance and testing difficult.
4. **Hardcoded Task Timings:** `App.jsx` submits hardcoded `responseTime` values (`12.5` for memory, `10.5` for orientation, `14` for language) instead of measuring actual task duration.
5. **Stray / Archive Files at Root:** `Frontend.zip` and `h -u origin main --force-with-lease` exist at the repository root (preserved per audit rules, not deleted).
6. **Schema Typo:** `Backend/database/schema.sql` line 1 starts with `git status-- ===...`.
7. **Missing `node_modules` & `.venv`:** Dependencies are declared in `package.json` and `requirements-*.txt` but not yet installed in the workspace.

---

## 6. Prioritized Implementation Roadmap

- **Stage 1 — Environment, Dependencies, Database & Baseline Verification**
  - Install `Backend` and `Frontend` npm dependencies, create Python `.venv`, configure `.env` files, fix `schema.sql` typo, verify PostgreSQL & run migrations, and verify baseline test suites.
- **Stage 2 — Database Schema & Role-Based Auth + Notifications**
  - Add migration `004` (`users.role`, `users.preferred_language`, `notifications` table), update `authService.js` / `authMiddleware.js` for patient & clinician roles, and build notification APIs.
- **Stage 3 — Complete Cognitive Assessment Suite**
  - Implement **Delayed Memory Recall**, **Number Repetition / Digit Span**, **Picture Recognition**, and **Pattern Recognition** in Backend validation/scoring and Frontend modular components, with real completion-time tracking, error/skip tracking, and full `en`/`si`/`ta` i18n.
- **Stage 4 — Drawing Intelligence System (Clock Drawing Test)**
  - Build interactive HTML5 Canvas Clock Drawing component (with stroke/time capture) and Python/Node `drawing_features.py` image & spatial analysis (contour, number placement, hand positioning, completion time).
- **Stage 5 — Voice & Speech Intelligence Upgrade**
  - Add acoustic signal extraction (**MFCCs**, **pitch F0 mean/variation**, response latency, waveform pause analysis), language-aware transcript analysis, and Frontend voice visualizations.
- **Stage 6 — AI/ML Pipeline, Datasets, Model Training & Risk/Recommendation Engine**
  - Search/acquire legitimate public research datasets, run reproducible cleaning/feature engineering/selection, train & compare ML models, persist versioned bundles, and connect risk score & recommendation generation to the live inference API.
- **Stage 7 — Patient & Clinician Dashboards, PDF Export & End-to-End Verification**
  - Build Patient Dashboard, Clinician Dashboard, PDF report export, end-to-end integration tests, and update all required documentation (`PROJECT_STATUS.md`, `IMPLEMENTATION_LOG.md`, `DATASET_CATALOG.md`, `MODEL_EVALUATION.md`, `API_DOCUMENTATION.md`, `TEST_REPORT.md`).
