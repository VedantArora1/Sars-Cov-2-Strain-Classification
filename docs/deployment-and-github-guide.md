# Deployment And GitHub Guide

This guide is for preparing the project so another person can clone it on a fresh machine and run it with the minimum confusion.

## 1. What must be installed on a new machine

Required tools:

- Git
- Python 3.11 or newer
- Node.js 20 LTS or newer
- npm
- Docker Desktop or a local PostgreSQL installation if you want PostgreSQL mode

## 2. Project dependencies this repo uses

### Backend Python packages

These are installed from `backend/requirements.txt`:

- `fastapi`
- `uvicorn[standard]`
- `sqlalchemy`
- `psycopg[binary]`
- `pydantic`
- `pydantic-settings`
- `python-multipart`

### Frontend Node packages

These are installed from `frontend/package.json`:

- `next`
- `react`
- `react-dom`
- `typescript`
- `@types/node`
- `@types/react`
- `@types/react-dom`

## 3. Files that should be in GitHub

Keep these:

- `frontend/`
- `backend/`
- `docs/`
- `docker-compose.yml`
- `README.md`
- `.gitignore`
- lock files such as `frontend/package-lock.json`
- example env files such as `backend/.env.example` and `frontend/.env.example`

Do not upload local/generated files:

- `frontend/node_modules/`
- `frontend/.next/`
- `backend/.venv/`
- `backend/__pycache__/` and other `__pycache__` folders
- `*.db`, `*.db-shm`, `*.db-wal`
- `*.log`
- temporary FASTA test files like `tmp-*.fa`
- real secret `.env` files

## 4. Fresh setup after cloning

### Backend setup

From `backend/`:

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
python -m app.init_db
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend checks:

- Open `http://127.0.0.1:8000/health`
- Open `http://127.0.0.1:8000/health/database`
- Open `http://127.0.0.1:8000/docs`

### Frontend setup

From `frontend/` in a new terminal:

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

Frontend checks:

- Open `http://127.0.0.1:3000`
- Confirm uploads, jobs, and sample pages load

## 5. Database options

### Option A: easiest local mode

Use SQLite fallback. In `backend/.env`:

```env
USE_SQLITE_FALLBACK=true
SQLITE_FALLBACK_URL=sqlite:///./sarscov2.db
```

This is best for quick local setup.

### Option B: PostgreSQL mode

Start Postgres from the repo root:

```powershell
docker compose up -d postgres
```

Then in `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/sarscov2
USE_SQLITE_FALLBACK=false
```

Then run:

```powershell
python -m app.init_db
```

## 6. Environment variables to verify

Backend:

- `DATABASE_URL`
- `USE_SQLITE_FALLBACK`
- `SQLITE_FALLBACK_URL`
- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `REFERENCE_ACCESSION`

Frontend:

- `NEXT_PUBLIC_API_BASE_URL`
- `BACKEND_API_BASE_URL`

Recommended local values:

- `NEXT_PUBLIC_API_BASE_URL=/api/backend`
- `BACKEND_API_BASE_URL=http://127.0.0.1:8000/api/v1`

## 7. Manual deployment checklist

Before pushing to GitHub:

- Run backend install from scratch in a clean terminal
- Run frontend install from scratch in a clean terminal
- Confirm `.gitignore` is excluding local artifacts
- Make sure `.env` is not being committed
- Make sure `frontend/node_modules` is not being committed
- Make sure `.venv` is not being committed
- Make sure local SQLite database files are not being committed
- Confirm `backend/data/reference_nc_045512_2.fasta` is either included intentionally or explained clearly
- Update `README.md` if startup steps change

Before calling deployment complete:

- Backend health endpoint returns `ok`
- Database health endpoint returns `ok`
- Frontend opens successfully
- Creating a job works
- Job results page loads
- Sample detail page loads

## 8. What you can check yourself if something fails

If backend does not start:

- Check Python version with `python --version`
- Check virtual environment is activated
- Check `pip install -r requirements.txt` finished without errors
- Check `backend/.env` values
- Check whether port `8000` is already in use

If frontend does not start:

- Check Node version with `node -v`
- Check `npm install` finished without errors
- Check whether port `3000` is already in use
- Check `frontend/.env.local`

If frontend opens but API calls fail:

- Confirm backend is running on `127.0.0.1:8000`
- Confirm `BACKEND_API_BASE_URL` points to `/api/v1`
- Confirm `http://127.0.0.1:8000/health` works in the browser

If database errors appear:

- Check `http://127.0.0.1:8000/health/database`
- Confirm Docker/Postgres is running if using PostgreSQL
- Re-run `python -m app.init_db`

## 9. Recommended GitHub upload workflow

1. Run `git status`
2. Check that only source files and docs are listed
3. If `node_modules`, `.venv`, `.db`, `.log`, or `.env` appear, stop and fix `.gitignore`
4. Run the app once from a clean install path
5. Commit only after the project can start from the documented steps

## 10. Current project note

This project currently supports both:

- local SQLite fallback for easy development
- PostgreSQL-first deployment using `docker-compose.yml`

That is helpful, but it means your documentation must say clearly which mode the next person should use first. For a first-time downloader, SQLite is the easiest path.
