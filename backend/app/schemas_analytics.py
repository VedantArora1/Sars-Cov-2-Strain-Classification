from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LabeledValue(BaseModel):
    label: str
    value: int


class PcaPoint(BaseModel):
    sample_id: UUID
    sample_name: str
    label: str
    pc1: float
    pc2: float


class TreeNode(BaseModel):
    name: str
    sample_id: UUID | None = None
    distance: float | None = None
    children: list["TreeNode"] = Field(default_factory=list)


class HeatmapRow(BaseModel):
    sample_id: UUID
    sample_name: str
    values: list[int]


class HeatmapPayload(BaseModel):
    columns: list[str] = Field(default_factory=list)
    rows: list[HeatmapRow] = Field(default_factory=list)


class VariabilitySite(BaseModel):
    position: int
    consensus_base: str
    base_counts: dict[str, int] = Field(default_factory=dict)


class ConsensusSummary(BaseModel):
    consensus_sequence_preview: str = ""
    consensus_length: int = 0
    variable_site_count: int = 0
    high_variability_sites: list[VariabilitySite] = Field(default_factory=list)


class ClusterSummary(BaseModel):
    label: str
    sample_count: int
    average_similarity_percent: float
    sample_names: list[str] = Field(default_factory=list)


class DistanceEntry(BaseModel):
    sample_id: UUID
    sample_name: str
    distance: float


class DistanceRow(BaseModel):
    sample_id: UUID
    sample_name: str
    distances: list[DistanceEntry] = Field(default_factory=list)


class JobAnalyticsResponse(BaseModel):
    job_id: UUID
    generated_at: datetime
    sample_count: int
    classification_distribution: list[LabeledValue] = Field(default_factory=list)
    mutation_frequency: list[LabeledValue] = Field(default_factory=list)
    snp_frequency: list[LabeledValue] = Field(default_factory=list)
    kmer_frequency: list[LabeledValue] = Field(default_factory=list)
    pca_projection: list[PcaPoint] = Field(default_factory=list)
    phylogenetic_tree: TreeNode
    phylogenetic_newick: str = ""
    consensus_summary: ConsensusSummary
    cluster_summary: list[ClusterSummary] = Field(default_factory=list)
    mutation_heatmap: HeatmapPayload
    distance_matrix: list[DistanceRow] = Field(default_factory=list)


TreeNode.model_rebuild()
