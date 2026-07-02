CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS analysis_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    summary JSONB
);

CREATE TABLE IF NOT EXISTS samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    sample_name VARCHAR(255) NOT NULL,
    fasta_header VARCHAR(500),
    sequence TEXT NOT NULL,
    sequence_length INTEGER NOT NULL,
    qc_status VARCHAR(32) NOT NULL DEFAULT 'pending',
    qc_notes JSONB
);

CREATE TABLE IF NOT EXISTS mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference_accession VARCHAR(32) NOT NULL,
    position INTEGER NOT NULL,
    reference_base VARCHAR(4) NOT NULL,
    alternate_base VARCHAR(4) NOT NULL,
    mutation_label VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS sample_mutations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    mutation_id UUID NOT NULL REFERENCES mutations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS feature_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    feature_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS generated_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    report_type VARCHAR(50) NOT NULL DEFAULT 'mvp_summary',
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS classification_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    classifier_name VARCHAR(100) NOT NULL,
    predicted_label VARCHAR(100) NOT NULL,
    confidence INTEGER NOT NULL,
    rationale JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES analysis_jobs(id) ON DELETE CASCADE,
    artifact_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
