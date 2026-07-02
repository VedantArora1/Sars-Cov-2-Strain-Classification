# SARS-CoV-2 Analysis Platform

This repository contains the MVP for a web-based SARS-CoV-2 analysis platform.

## MVP goals

- Upload one or more FASTA files
- Validate SARS-CoV-2 sequences
- Compare sequences against `NC_045512.2`
- Extract basic mutation calls
- Prepare k-mer and mutation-matrix features
- Store jobs and results in PostgreSQL
- Present results in a web dashboard
- Generate the base structure for later ML and phylogenetic expansion

## Repository structure

- `frontend/` - Next.js web interface
- `backend/` - FastAPI API and analysis pipeline
- `docs/` - design and implementation notes

Deployment and GitHub handoff notes live in:

- `docs/deployment-and-github-guide.md`

## Planned stack

- Frontend: Next.js, TypeScript, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, Pydantic
- Database: PostgreSQL
- Analysis: Biopython, pandas, scikit-learn

## MVP status

The repository is scaffolded with:

- frontend shell
- backend API skeleton
- FASTA parsing and validation utilities
- reference-comparison service skeleton
- PostgreSQL schema draft
- persisted feature tables for k-mer and mutation-matrix payloads
- job-level MVP report generation
- job and sample detail pages in the frontend

## Reference genome

Add the full NCBI FASTA for `NC_045512.2` at:

- `backend/data/reference_nc_045512_2.fasta`

The current scaffold falls back to a short placeholder sequence until that file is added.

## Next implementation steps

1. Install dependencies
2. Add the full `NC_045512.2` FASTA into `backend/data/`
3. Start PostgreSQL and initialize the schema
4. Run the backend and frontend locally
5. Add mutation plots, ML classification, and phylogenetic analysis

## Local run guide

### Backend

1. Create the virtual environment:
   `python -m venv .venv`
2. Install dependencies:
   `.venv\Scripts\python -m pip install -r requirements.txt`
3. Set environment values using `backend/.env.example`
4. Initialize the database:
   `.venv\Scripts\python -m app.init_db`
5. Run the API:
   `.venv\Scripts\python -m uvicorn app.main:app --reload`
6. Seed a demo multi-variant cohort if you want a ready-made dashboard dataset:
   `.venv\Scripts\python -m app.seed_demo`

The backend is configured for PostgreSQL-first deployment through `DATABASE_URL`.
For local previewing, `USE_SQLITE_FALLBACK=true` keeps the app usable even when PostgreSQL is not running.

### PostgreSQL-first setup

1. Start PostgreSQL:
   `docker compose up -d postgres`
2. Set `DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/sarscov2`
3. Initialize the schema:
   `.venv\Scripts\python -m app.init_db`
4. Run the API:
   `.venv\Scripts\python -m uvicorn app.main:app --reload`
5. Check database reachability:
   `http://localhost:8000/health/database`

### Local fallback mode

If PostgreSQL is not available yet, keep:

- `USE_SQLITE_FALLBACK=true`
- `SQLITE_FALLBACK_URL=sqlite:///./sarscov2.db`

That lets the same FastAPI app and frontend continue working while the deployment target remains PostgreSQL.

### Frontend

1. Install dependencies:
   `npm install`
2. Set `NEXT_PUBLIC_API_BASE_URL` if needed
3. Run the app:
   `npm run dev`
