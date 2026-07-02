from datetime import datetime

from sqlalchemy.orm import Session

from app.config import settings
from app.db import SessionLocal
from app.models import AnalysisArtifact, AnalysisJob, ClassificationResult, FeatureSet, GeneratedReport, Mutation, Sample, SampleMutation
from app.schemas import JobCreateResponse, SampleUploadResult, VariantClassificationResponse
from app.services.analysis import build_kmer_frequency, build_mutation_matrix_row, compare_to_reference, summarize_sequence_against_reference
from app.services.classification import classify_sample, get_variant_classification
from app.services.cohort import build_job_analytics
from app.services.fasta import ParsedSequence, validate_sequence
from app.services.reporting import build_job_report


def queue_job_from_sequences(db: Session, parsed_sequences: list[ParsedSequence]) -> JobCreateResponse:
    job = AnalysisJob(
        status="queued",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
        summary={
            "sample_count": len(parsed_sequences),
            "reference_accession": settings.reference_accession,
            "queued_at": datetime.utcnow().isoformat(),
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    return JobCreateResponse(job_id=job.id, status=job.status, sample_count=len(parsed_sequences), samples=[])


def process_job(job_id: str, parsed_sequences: list[ParsedSequence]) -> None:
    db = SessionLocal()
    try:
        job = db.get(AnalysisJob, job_id)
        if job is None:
            return

        job.status = "processing"
        job.updated_at = datetime.utcnow()
        job.summary = {
            **(job.summary or {}),
            "sample_count": len(parsed_sequences),
            "reference_accession": settings.reference_accession,
            "started_at": datetime.utcnow().isoformat(),
        }
        db.commit()
        db.refresh(job)

        _populate_job(db, job, parsed_sequences)

        job.status = "completed"
        job.updated_at = datetime.utcnow()
        job.summary = {
            "sample_count": len(job.samples),
            "reference_accession": settings.reference_accession,
            "completed_at": datetime.utcnow().isoformat(),
        }
        analytics_payload = build_job_analytics(job)
        db.add(AnalysisArtifact(job_id=job.id, artifact_type="cohort_analytics", payload=analytics_payload))
        job_report = build_job_report(job)
        db.add(GeneratedReport(job_id=job.id, report_type=job_report["report_type"], payload=job_report))
        db.commit()
    except Exception as exc:
        db.rollback()
        failed_job = db.get(AnalysisJob, job_id)
        if failed_job is not None:
            failed_job.status = "failed"
            failed_job.updated_at = datetime.utcnow()
            failed_job.summary = {
                **(failed_job.summary or {}),
                "sample_count": len(parsed_sequences),
                "reference_accession": settings.reference_accession,
                "error": str(exc),
                "failed_at": datetime.utcnow().isoformat(),
            }
            db.commit()
    finally:
        db.close()


def build_job_response(job: AnalysisJob) -> JobCreateResponse:
    return JobCreateResponse(
        job_id=job.id,
        status=job.status,
        sample_count=(job.summary or {}).get("sample_count", len(job.samples)),
        samples=[
            SampleUploadResult(
                sample_id=sample.id,
                sample_name=sample.sample_name,
                fasta_header=sample.fasta_header,
                sequence_length=sample.sequence_length,
                qc_status=sample.qc_status,
                qc_notes=(sample.qc_notes or {}).get("messages", []),
                predicted_label=(sample.classifications[0].predicted_label if sample.classifications else None),
                variant_classification=(
                    VariantClassificationResponse(
                        **get_variant_classification(
                            sample.classifications[0].predicted_label,
                            sample.classifications[0].rationale,
                        )
                    )
                    if sample.classifications
                    else None
                ),
                mutation_count=len(sample.mutations),
            )
            for sample in job.samples
        ],
    )


def _populate_job(db: Session, job: AnalysisJob, parsed_sequences: list[ParsedSequence]) -> None:
    for parsed in parsed_sequences:
        qc_notes = validate_sequence(parsed.sequence)
        qc_status = "passed" if not qc_notes else "warning"
        mutations = compare_to_reference(parsed.sequence)
        kmer_profile = build_kmer_frequency(parsed.sequence)
        mutation_matrix_row = build_mutation_matrix_row(mutations)
        analysis_summary = summarize_sequence_against_reference(parsed.sequence, mutations)
        classification = classify_sample(analysis_summary)

        sample = Sample(
            job_id=job.id,
            sample_name=parsed.sample_name,
            fasta_header=parsed.fasta_header,
            sequence=parsed.sequence,
            sequence_length=len(parsed.sequence),
            qc_status=qc_status,
            qc_notes={"messages": qc_notes},
        )
        db.add(sample)
        db.flush()

        db.add(FeatureSet(sample_id=sample.id, feature_type="kmer_3", payload=kmer_profile))
        db.add(FeatureSet(sample_id=sample.id, feature_type="mutation_matrix", payload=mutation_matrix_row))
        db.add(FeatureSet(sample_id=sample.id, feature_type="analysis_summary", payload=analysis_summary))
        db.add(FeatureSet(sample_id=sample.id, feature_type="snp_spectrum", payload=analysis_summary["snp_spectrum"]))
        db.add(
            ClassificationResult(
                sample_id=sample.id,
                classifier_name=classification["classifier_name"],
                predicted_label=classification["predicted_label"],
                confidence=classification["confidence"],
                rationale=classification["rationale"],
            )
        )

        for mutation_payload in mutations:
            mutation = Mutation(
                reference_accession=mutation_payload["reference_accession"],
                position=mutation_payload["position"],
                reference_base=mutation_payload["reference_base"],
                alternate_base=mutation_payload["alternate_base"],
                mutation_label=mutation_payload["mutation_label"],
            )
            db.add(mutation)
            db.flush()
            db.add(SampleMutation(sample_id=sample.id, mutation_id=mutation.id))

    db.flush()
