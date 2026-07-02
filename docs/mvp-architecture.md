# MVP Architecture

## Product flow

1. User uploads one or more FASTA files
2. Frontend submits files to the backend
3. Backend creates an analysis job and sample records
4. Sequences are parsed and validated
5. Each sequence is compared against `NC_045512.2`
6. Mutation calls and feature summaries are stored in PostgreSQL
7. Frontend displays mutation summaries and analysis status
8. A report artifact is generated for download

## MVP feature set

- Batch FASTA upload
- Sequence validation
- Reference-based mutation detection skeleton
- K-mer frequency generation and storage
- Mutation matrix storage
- Job and sample tracking
- Results API
- Dashboard shell
- Job-level summary report

## Backend modules

- `app/main.py` - FastAPI entry point
- `app/config.py` - environment-driven settings
- `app/db.py` - SQLAlchemy engine and session handling
- `app/models.py` - ORM tables
- `app/schemas.py` - request and response schemas
- `app/services/fasta.py` - FASTA parsing and validation
- `app/services/reference.py` - reference genome loading
- `app/services/analysis.py` - mutation comparison and feature extraction

## Frontend modules

- `app/page.tsx` - landing page
- `app/upload/page.tsx` - upload interface
- `app/jobs/[jobId]/page.tsx` - job status and results page
- `lib/api.ts` - backend client helpers

## Data model

Core tables:

- `analysis_jobs`
- `samples`
- `sample_sequences`
- `mutations`
- `sample_mutations`
- `feature_sets`
- `classification_results`
- `generated_reports`

## API surface

- `GET /health`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{job_id}`
- `GET /api/v1/jobs/{job_id}/samples`
- `GET /api/v1/jobs/{job_id}/report`
- `GET /api/v1/samples/{sample_id}`

## Implementation notes

- The MVP keeps analysis synchronous in code structure, but uses a job table so async workers can be added later.
- Mutation calling starts with simple position-wise comparison and can later be replaced by a stronger alignment workflow.
- ML and phylogenetics are designed as downstream modules that consume feature tables stored in PostgreSQL.
