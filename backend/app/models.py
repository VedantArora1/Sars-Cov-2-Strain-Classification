from datetime import datetime
from uuid import uuid4

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    status: Mapped[str] = mapped_column(String(32), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    samples: Mapped[list["Sample"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    reports: Mapped[list["GeneratedReport"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    artifacts: Mapped[list["AnalysisArtifact"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class Sample(Base):
    __tablename__ = "samples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_jobs.id"))
    sample_name: Mapped[str] = mapped_column(String(255))
    fasta_header: Mapped[str | None] = mapped_column(String(500), nullable=True)
    sequence: Mapped[str] = mapped_column(Text)
    sequence_length: Mapped[int] = mapped_column(Integer)
    qc_status: Mapped[str] = mapped_column(String(32), default="pending")
    qc_notes: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped["AnalysisJob"] = relationship(back_populates="samples")
    mutations: Mapped[list["SampleMutation"]] = relationship(back_populates="sample", cascade="all, delete-orphan")
    feature_sets: Mapped[list["FeatureSet"]] = relationship(back_populates="sample", cascade="all, delete-orphan")
    classifications: Mapped[list["ClassificationResult"]] = relationship(
        back_populates="sample",
        cascade="all, delete-orphan",
    )


class Mutation(Base):
    __tablename__ = "mutations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    reference_accession: Mapped[str] = mapped_column(String(32))
    position: Mapped[int] = mapped_column(Integer)
    reference_base: Mapped[str] = mapped_column(String(4))
    alternate_base: Mapped[str] = mapped_column(String(4))
    mutation_label: Mapped[str] = mapped_column(String(50))

    sample_links: Mapped[list["SampleMutation"]] = relationship(back_populates="mutation", cascade="all, delete-orphan")


class SampleMutation(Base):
    __tablename__ = "sample_mutations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    sample_id: Mapped[str] = mapped_column(String(36), ForeignKey("samples.id"))
    mutation_id: Mapped[str] = mapped_column(String(36), ForeignKey("mutations.id"))

    sample: Mapped["Sample"] = relationship(back_populates="mutations")
    mutation: Mapped["Mutation"] = relationship(back_populates="sample_links")


class FeatureSet(Base):
    __tablename__ = "feature_sets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    sample_id: Mapped[str] = mapped_column(String(36), ForeignKey("samples.id"))
    feature_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON)

    sample: Mapped["Sample"] = relationship(back_populates="feature_sets")


class GeneratedReport(Base):
    __tablename__ = "generated_reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_jobs.id"))
    report_type: Mapped[str] = mapped_column(String(50), default="mvp_summary")
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job: Mapped["AnalysisJob"] = relationship(back_populates="reports")


class ClassificationResult(Base):
    __tablename__ = "classification_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    sample_id: Mapped[str] = mapped_column(String(36), ForeignKey("samples.id"))
    classifier_name: Mapped[str] = mapped_column(String(100))
    predicted_label: Mapped[str] = mapped_column(String(100))
    confidence: Mapped[int] = mapped_column(Integer)
    rationale: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    sample: Mapped["Sample"] = relationship(back_populates="classifications")


class AnalysisArtifact(Base):
    __tablename__ = "analysis_artifacts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    job_id: Mapped[str] = mapped_column(String(36), ForeignKey("analysis_jobs.id"))
    artifact_type: Mapped[str] = mapped_column(String(50))
    payload: Mapped[dict] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    job: Mapped["AnalysisJob"] = relationship(back_populates="artifacts")
