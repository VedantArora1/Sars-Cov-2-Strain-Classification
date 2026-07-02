from collections import Counter
from copy import deepcopy

from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import Base, engine, get_db
from app.models import AnalysisArtifact, AnalysisJob, GeneratedReport, Sample
from app.schemas import ClassificationResponse, JobCreateResponse, JobListItemResponse, JobSummaryResponse, MutationResponse, ReportResponse, SampleDetailResponse, SampleUploadResult, VariantClassificationResponse
from app.schemas_analytics import JobAnalyticsResponse
from app.services.analysis import build_mutation_matrix_row, compare_to_reference, summarize_sequence_against_reference
from app.services.cohort import build_job_analytics
from app.services.classification import classify_sample, get_display_classification_label, get_variant_classification
from app.services.fasta import parse_fasta_text, validate_upload_records
from app.services.jobs import process_job, queue_job_from_sequences
from app.services.reporting import build_job_report, render_job_report_html


app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:3000",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    Base.metadata.create_all(bind=engine)
    print(f"[startup] database mode: {settings.database_mode}")


@app.get("/")
def root():
    return {
        "app": settings.app_name,
        "status": "ok",
        "api_prefix": settings.api_prefix,
        "docs_url": "/docs",
        "health_url": "/health",
    }


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


def _feature_payload(sample: Sample, feature_type: str) -> dict:
    feature = next((item for item in sample.feature_sets if item.feature_type == feature_type), None)
    return feature.payload if feature else {}


def _fresh_sample_analysis(sample: Sample) -> dict:
    mutations = compare_to_reference(sample.sequence)
    summary = summarize_sequence_against_reference(sample.sequence, mutations)
    classification = classify_sample(summary)
    return {
        "mutations": mutations,
        "summary": summary,
        "classification": classification,
    }


def _normalized_classification_payload(sample: Sample, analysis: dict | None = None) -> dict | None:
    if analysis is None:
        analysis = _fresh_sample_analysis(sample)

    classification = analysis["classification"]
    return {
        "classifier_name": classification["classifier_name"],
        "predicted_label": get_display_classification_label(
            classification["predicted_label"],
            classification["rationale"],
        ),
        "confidence": classification["confidence"],
        "rationale": classification["rationale"],
        "variant_classification": get_variant_classification(
            classification["predicted_label"],
            classification["rationale"],
        ),
    }


def _normalize_analytics_payload(job: AnalysisJob, payload: dict) -> dict:
    normalized = deepcopy(payload)
    sample_by_id = {str(sample.id): sample for sample in job.samples}
    sample_analysis = {str(sample.id): _fresh_sample_analysis(sample) for sample in job.samples}
    classification_counts = Counter()

    for point in normalized.get("pca_projection", []):
        sample = sample_by_id.get(str(point.get("sample_id")))
        analysis = sample_analysis.get(str(point.get("sample_id")))
        classification = _normalized_classification_payload(sample, analysis) if sample and analysis else None
        if classification:
            display_label = (
                classification["variant_classification"].get("display_label")
                or classification["variant_classification"]["label"]
            )
            point["label"] = display_label
            classification_counts[display_label] += 1

    if not classification_counts:
        for sample in job.samples:
            analysis = sample_analysis[str(sample.id)]
            classification = _normalized_classification_payload(sample, analysis)
            if classification:
                display_label = (
                    classification["variant_classification"].get("display_label")
                    or classification["variant_classification"]["label"]
                )
                classification_counts[display_label] += 1

    normalized["classification_distribution"] = [
        {"label": label, "value": value}
        for label, value in classification_counts.most_common()
    ]

    clusters: dict[str, list[dict[str, float | str]]] = {}
    for sample in job.samples:
        analysis = sample_analysis[str(sample.id)]
        classification = _normalized_classification_payload(sample, analysis)
        label = (
            classification["variant_classification"].get("display_label")
            or classification["variant_classification"]["label"]
            if classification
            else sample.qc_status
        )
        similarity = float(analysis["summary"].get("sequence_similarity_percent", 0.0))
        clusters.setdefault(label, []).append(
            {"sample_name": sample.sample_name, "similarity": similarity}
        )

    normalized["cluster_summary"] = [
        {
            "label": label,
            "sample_count": len(entries),
            "average_similarity_percent": round(
                sum(float(entry["similarity"]) for entry in entries) / max(len(entries), 1),
                4,
            ),
            "sample_names": [str(entry["sample_name"]) for entry in entries[:8]],
        }
        for label, entries in sorted(clusters.items(), key=lambda item: (-len(item[1]), item[0]))
    ]

    return normalized


def _normalize_report_payload(job: AnalysisJob, payload: dict) -> dict:
    normalized = deepcopy(payload)
    sample_by_id = {str(sample.id): sample for sample in job.samples}
    sample_analysis = {str(sample.id): _fresh_sample_analysis(sample) for sample in job.samples}
    classification_counts = Counter()
    total_mutations = 0
    exact_reference_match_count = 0

    for sample_payload in normalized.get("samples", []):
        sample = sample_by_id.get(str(sample_payload.get("sample_id")))
        analysis = sample_analysis.get(str(sample_payload.get("sample_id")))
        classification = _normalized_classification_payload(sample, analysis) if sample and analysis else None
        if classification and analysis:
            sample_payload["classification"] = classification
            sample_payload["mutation_count"] = analysis["summary"]["mutation_count"]
            sample_payload["exact_reference_match"] = analysis["summary"]["exact_reference_match"]
            sample_payload["sequence_similarity_percent"] = analysis["summary"]["sequence_similarity_percent"]
            sample_payload["top_mutations"] = [
                {
                    "mutation_label": mutation["mutation_label"],
                    "position": mutation["position"],
                    "reference_base": mutation["reference_base"],
                    "alternate_base": mutation["alternate_base"],
                }
                for mutation in analysis["mutations"][:5]
            ]
            sample_payload["remaining_mutation_count"] = max(
                analysis["summary"]["mutation_count"] - len(sample_payload["top_mutations"]),
                0,
            )
            display_label = (
                classification["variant_classification"].get("display_label")
                or classification["variant_classification"]["label"]
            )
            classification_counts[display_label] += 1
            total_mutations += analysis["summary"]["mutation_count"]
            exact_reference_match_count += 1 if analysis["summary"]["exact_reference_match"] else 0

    if classification_counts:
        normalized.setdefault("summary", {})["classification_counts"] = dict(classification_counts)
    normalized.setdefault("summary", {})["total_detected_mutations"] = total_mutations
    normalized.setdefault("summary", {})["exact_reference_match_count"] = exact_reference_match_count

    if "analytics" in normalized:
        normalized["analytics"] = _normalize_analytics_payload(job, normalized["analytics"])

    return normalized


@app.get("/health/database")
def database_healthcheck():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database_mode": settings.database_mode,
            "database_url": settings.resolved_database_url,
        }
    except Exception as exc:
        return {
            "status": "error",
            "database_mode": settings.database_mode,
            "database_url": settings.resolved_database_url,
            "detail": str(exc),
        }


@app.post(f"{settings.api_prefix}/jobs", response_model=JobCreateResponse)
async def create_job(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(...),
    db: Session = Depends(get_db),
):
    if len(files) > settings.max_upload_files:
        raise HTTPException(
            status_code=400,
            detail=f"Upload at most {settings.max_upload_files} FASTA files at a time.",
        )

    parsed_sequences = []

    for fasta_file in files:
        payload = await fasta_file.read()
        if len(payload) > settings.max_upload_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{fasta_file.filename} is too large. Keep each upload under "
                    f"{settings.max_upload_bytes // 1_000_000} MB."
                ),
            )

        try:
            content = payload.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail=f"{fasta_file.filename} is not valid UTF-8 FASTA text.",
            ) from exc

        parsed_records = parse_fasta_text(content)

        if not parsed_records:
            raise HTTPException(status_code=400, detail=f"No FASTA records found in {fasta_file.filename}")
        empty_records = [record.sample_name or "unknown_sample" for record in parsed_records if not record.sequence]
        if empty_records:
            preview = ", ".join(empty_records[:5])
            raise HTTPException(
                status_code=400,
                detail=(
                    f"{fasta_file.filename} contains FASTA headers without sequence data "
                    f"({preview})."
                ),
            )

        record_errors = validate_upload_records(parsed_records)
        if record_errors:
            raise HTTPException(
                status_code=400,
                detail=f"{fasta_file.filename}: {' '.join(record_errors)}",
            )

        parsed_sequences.extend(parsed_records)

        if len(parsed_sequences) > settings.max_fasta_records_per_request:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Upload contains {len(parsed_sequences)} FASTA records, above the supported "
                    f"limit of {settings.max_fasta_records_per_request}. This usually means the file "
                    "is malformed or not a SARS-CoV-2 FASTA batch."
                ),
            )

    job_response = queue_job_from_sequences(db, parsed_sequences)
    background_tasks.add_task(process_job, str(job_response.job_id), parsed_sequences)
    return job_response


@app.get(f"{settings.api_prefix}/jobs/{{job_id}}", response_model=JobSummaryResponse)
def get_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobSummaryResponse(job_id=job.id, status=job.status, created_at=job.created_at, updated_at=job.updated_at, summary=job.summary)


@app.get(f"{settings.api_prefix}/jobs", response_model=list[JobListItemResponse])
def list_jobs(limit: int = 20, status: str | None = None, q: str | None = None, db: Session = Depends(get_db)):
    query = db.query(AnalysisJob)
    if status:
        query = query.filter(AnalysisJob.status == status)
    if q:
        pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                AnalysisJob.id.ilike(pattern),
                AnalysisJob.samples.any(Sample.sample_name.ilike(pattern)),
            )
        )

    jobs = query.order_by(AnalysisJob.created_at.desc()).limit(limit).all()

    output = []
    for job in jobs:
        classifications = sorted(
            {
                (
                    _normalized_classification_payload(sample, _fresh_sample_analysis(sample))["variant_classification"].get("display_label")
                    or _normalized_classification_payload(sample, _fresh_sample_analysis(sample))["variant_classification"]["label"]
                )
                for sample in job.samples
            }
        )
        output.append(
            JobListItemResponse(
                job_id=job.id,
                status=job.status,
                created_at=job.created_at,
                updated_at=job.updated_at,
                sample_count=(job.summary or {}).get("sample_count", len(job.samples)),
                reference_accession=(job.summary or {}).get("reference_accession"),
                top_classifications=classifications[:3],
            )
        )

    return output


@app.get(f"{settings.api_prefix}/jobs/{{job_id}}/samples", response_model=list[SampleUploadResult])
def get_job_samples(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="Job results are not ready yet")
    return [
        SampleUploadResult(
            sample_id=sample.id,
            sample_name=sample.sample_name,
            fasta_header=sample.fasta_header,
            sequence_length=sample.sequence_length,
            qc_status=sample.qc_status,
            qc_notes=(sample.qc_notes or {}).get("messages", []),
            predicted_label=_normalized_classification_payload(sample, _fresh_sample_analysis(sample))["predicted_label"],
            variant_classification=VariantClassificationResponse(
                **_normalized_classification_payload(sample, _fresh_sample_analysis(sample))["variant_classification"]
            ),
            mutation_count=_fresh_sample_analysis(sample)["summary"]["mutation_count"],
        )
        for sample in job.samples
    ]


@app.get(f"{settings.api_prefix}/samples/{{sample_id}}", response_model=SampleDetailResponse)
def get_sample(sample_id: str, db: Session = Depends(get_db)):
    sample = db.get(Sample, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")

    analysis = _fresh_sample_analysis(sample)
    mutations = [
        MutationResponse(
            position=mutation["position"],
            reference_base=mutation["reference_base"],
            alternate_base=mutation["alternate_base"],
            mutation_label=mutation["mutation_label"],
        )
        for mutation in analysis["mutations"]
    ]

    kmer_feature = next((feature for feature in sample.feature_sets if feature.feature_type == "kmer_3"), None)
    mutation_matrix_feature = next((feature for feature in sample.feature_sets if feature.feature_type == "mutation_matrix"), None)
    analysis_summary_feature = next((feature for feature in sample.feature_sets if feature.feature_type == "analysis_summary"), None)
    snp_spectrum_feature = next((feature for feature in sample.feature_sets if feature.feature_type == "snp_spectrum"), None)
    classification = sample.classifications[0] if sample.classifications else None

    top_kmers = []
    if kmer_feature:
        sorted_kmers = sorted(kmer_feature.payload.items(), key=lambda item: item[1], reverse=True)[:10]
        top_kmers = [{"kmer": key, "count": value} for key, value in sorted_kmers]

    analysis_summary = analysis["summary"]
    return SampleDetailResponse(
        sample_id=sample.id,
        sample_name=sample.sample_name,
        sequence_length=sample.sequence_length,
        qc_status=sample.qc_status,
        qc_notes=(sample.qc_notes or {}).get("messages", []),
        exact_reference_match=analysis_summary.get("exact_reference_match", False),
        sequence_similarity_percent=analysis_summary.get("sequence_similarity_percent", 0.0),
        mutation_summary=analysis_summary,
        classification=(
            ClassificationResponse(
                classifier_name=analysis["classification"]["classifier_name"],
                predicted_label=get_display_classification_label(
                    analysis["classification"]["predicted_label"],
                    analysis["classification"]["rationale"],
                ),
                confidence=analysis["classification"]["confidence"],
                rationale=analysis["classification"]["rationale"],
                variant_classification=VariantClassificationResponse(
                    **get_variant_classification(
                        analysis["classification"]["predicted_label"],
                        analysis["classification"]["rationale"],
                    )
                ),
            )
            if analysis["classification"]
            else None
        ),
        top_kmers=top_kmers,
        mutation_matrix_row=build_mutation_matrix_row(analysis["mutations"]),
        snp_spectrum=analysis_summary.get("snp_spectrum", {}),
        mutations=mutations,
    )


@app.get(f"{settings.api_prefix}/jobs/{{job_id}}/report", response_model=ReportResponse)
def get_job_report(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="Job results are not ready yet")

    report = next((item for item in job.reports if item.report_type == "mvp_summary"), None)
    payload = _normalize_report_payload(job, report.payload) if report else build_job_report(job)
    return ReportResponse(
        job_id=job.id,
        report_type=payload["report_type"],
        generated_at=report.created_at if report else job.updated_at,
        summary=payload["summary"],
        samples=payload["samples"],
        analytics=payload.get("analytics", {}),
    )


@app.get(f"{settings.api_prefix}/jobs/{{job_id}}/analytics", response_model=JobAnalyticsResponse)
def get_job_analytics(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.status != "completed":
        raise HTTPException(status_code=409, detail="Job results are not ready yet")

    artifact = next((item for item in job.artifacts if item.artifact_type == "cohort_analytics"), None)
    payload = _normalize_analytics_payload(job, artifact.payload) if artifact else build_job_analytics(job)
    return JobAnalyticsResponse(
        job_id=job.id,
        generated_at=artifact.created_at if artifact else job.updated_at,
        sample_count=payload.get("sample_count", len(job.samples)),
        classification_distribution=payload.get("classification_distribution", []),
        mutation_frequency=payload.get("mutation_frequency", []),
        snp_frequency=payload.get("snp_frequency", []),
        kmer_frequency=payload.get("kmer_frequency", []),
        pca_projection=payload.get("pca_projection", []),
        phylogenetic_tree=payload.get("phylogenetic_tree", {"name": "Empty cohort", "children": []}),
        phylogenetic_newick=payload.get("phylogenetic_newick", ""),
        consensus_summary=payload.get(
            "consensus_summary",
            {"consensus_sequence_preview": "", "consensus_length": 0, "variable_site_count": 0, "high_variability_sites": []},
        ),
        cluster_summary=payload.get("cluster_summary", []),
        mutation_heatmap=payload.get("mutation_heatmap", {"columns": [], "rows": []}),
        distance_matrix=payload.get("distance_matrix", []),
    )


@app.get(f"{settings.api_prefix}/jobs/{{job_id}}/report/html", response_class=HTMLResponse)
def get_job_report_html(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    report = next((item for item in job.reports if item.report_type == "mvp_summary"), None)
    payload = _normalize_report_payload(job, report.payload) if report else build_job_report(job)
    return HTMLResponse(render_job_report_html(payload))


@app.get(f"{settings.api_prefix}/jobs/{{job_id}}/report/json")
def get_job_report_json(job_id: str, db: Session = Depends(get_db)):
    job = db.get(AnalysisJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    report = next((item for item in job.reports if item.report_type == "mvp_summary"), None)
    payload = _normalize_report_payload(job, report.payload) if report else build_job_report(job)
    return JSONResponse(
        content=payload,
        headers={"Content-Disposition": f'attachment; filename="job-{job_id}-report.json"'},
    )
