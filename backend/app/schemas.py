from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class VariantClassificationResponse(BaseModel):
    key: str
    label: str
    common_name: str | None = None
    display_label: str | None = None


class SampleUploadResult(BaseModel):
    sample_id: UUID
    sample_name: str
    fasta_header: str | None = None
    sequence_length: int
    qc_status: str
    qc_notes: list[str] = Field(default_factory=list)
    predicted_label: str | None = None
    variant_classification: VariantClassificationResponse | None = None
    mutation_count: int = 0


class JobCreateResponse(BaseModel):
    job_id: UUID
    status: str
    sample_count: int
    samples: list[SampleUploadResult]


class JobSummaryResponse(BaseModel):
    job_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    summary: dict | None = None


class JobListItemResponse(BaseModel):
    job_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime
    sample_count: int = 0
    reference_accession: str | None = None
    top_classifications: list[str] = Field(default_factory=list)


class MutationResponse(BaseModel):
    position: int
    reference_base: str
    alternate_base: str
    mutation_label: str


class ClassificationResponse(BaseModel):
    classifier_name: str
    predicted_label: str
    confidence: int
    rationale: dict
    variant_classification: VariantClassificationResponse


class SampleReportClassificationResponse(BaseModel):
    classifier_name: str
    predicted_label: str
    confidence: int
    variant_classification: VariantClassificationResponse


class SampleDetailResponse(BaseModel):
    sample_id: UUID
    sample_name: str
    sequence_length: int
    qc_status: str
    qc_notes: list[str] = Field(default_factory=list)
    exact_reference_match: bool = False
    sequence_similarity_percent: float = 0.0
    mutation_summary: dict = Field(default_factory=dict)
    classification: ClassificationResponse | None = None
    top_kmers: list[dict[str, int | str]] = Field(default_factory=list)
    mutation_matrix_row: dict[str, int] = Field(default_factory=dict)
    snp_spectrum: dict[str, int] = Field(default_factory=dict)
    mutations: list[MutationResponse] = Field(default_factory=list)


class ReportResponse(BaseModel):
    job_id: UUID
    report_type: str
    generated_at: datetime
    summary: dict
    samples: list[dict]
    analytics: dict = Field(default_factory=dict)
