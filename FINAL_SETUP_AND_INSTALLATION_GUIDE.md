# Final Setup & Installation Guide — MindScan AI

**Repository:** `D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main`

---

## 1. Prerequisites

- **Node.js:** `v20+` (verified on `v24.21.0`) with `npm`
- **Python:** `3.11+` (verified on `3.14`)
- **PostgreSQL:** Neon PostgreSQL (TLS-enabled) or local PostgreSQL `15+`
- **Optional (Containerized):** Docker Desktop (`docker compose`)

---

## 2. Backend Installation

```powershell
cd D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Backend
npm install
```

### Environment Configuration (`Backend/.env`)
Copy `Backend/.env.example` to `Backend/.env` and replace placeholders with your local values (never commit `Backend/.env`):

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
DATABASE_SSL_REJECT_UNAUTHORIZED=true
JWT_SECRET=<your-strong-random-jwt-secret>
MINDSCAN_DEMO_MODE=false
PYTHON_EXECUTABLE=D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\.venv-audio\Scripts\python.exe
```

*(Note: For local non-TLS Postgres fallback, leave `DATABASE_URL=` empty and set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DATABASE_SSL=false`.)*

### Database Connection & Migrations (`000`–`006`)

```powershell
npm --prefix D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Backend run database:test
npm --prefix D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Backend run migrate
```

### Provision a Clinician Account (CLI Only)
Public registration creates `patient` accounts only. Provision a clinician account via CLI:

```powershell
node D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Backend\scripts\create-clinician.js "Dr. Name" "clinician@example.com" "<min-8-char-password>"
```

---

## 3. Frontend Installation

```powershell
cd D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Frontend
npm install
```

Copy `Frontend/.env.example` (or create `Frontend/.env`) with:

```env
VITE_API_URL=http://localhost:3001
```

---

## 4. Python Audio & ML Environment (`.venv-audio`)

Create and populate `.venv-audio` for `faster-whisper`, PyAV decoding, acoustic feature extraction, DementiaNet PoC inference, and Pillow clock-drawing analysis:

```powershell
python -m venv D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\.venv-audio
D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\.venv-audio\Scripts\python.exe -m pip install -r D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Backend\ml\requirements-audio.txt
D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\.venv-audio\Scripts\python.exe -m pip install scikit-learn joblib pillow
```

- **ML Model Bundle:** `artifacts/models/speech_poc/dementianet-acoustic-v1.0.0/` (`logistic_regression.joblib`, `random_forest.joblib`, `metadata.json` with SHA-256 verification).
- **faster-whisper Model Cache:** `faster-whisper-base` (`~145 MB`) downloads automatically on first transcription into the local Hugging Face cache.

---

## 5. Development Startup & Production Build

- **Start Backend:**
  ```powershell
  npm --prefix D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Backend start
  ```
- **Start Frontend (Dev):**
  ```powershell
  npm --prefix D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Frontend run dev -- --port 5173
  ```
- **Production Frontend Build:**
  ```powershell
  npm --prefix D:\Dementia_Detection_Tool-main\Dementia_Detection_Tool-main\Frontend run build
  ```

---

## 6. Troubleshooting

- **`SASL: client password must be a string`:** `Backend/.env` is missing `DATABASE_URL` or `DB_PASSWORD`.
- **`No module named 'PIL'` on Clock Drawing:** Ensure `pillow` is installed in `.venv-audio` and `PYTHON_EXECUTABLE` points to `.venv-audio\Scripts\python.exe`.
- **`Audio model unavailable` / `Inconclusive`:** `dementianet-acoustic-v1.0.0` only scores English (`en`) audio with `quality_reliable === true` and all 44 finite acoustic features.
