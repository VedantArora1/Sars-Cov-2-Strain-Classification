from __future__ import annotations

from collections import Counter
from math import sqrt

from app.models import AnalysisJob, Sample
from app.services.classification import get_variant_classification


def get_feature_payload(sample: Sample, feature_type: str) -> dict:
    feature = next((item for item in sample.feature_sets if item.feature_type == feature_type), None)
    return feature.payload if feature else {}


def build_job_analytics(job: AnalysisJob) -> dict:
    mutation_frequency = Counter()
    snp_frequency = Counter()
    kmer_frequency = Counter()
    classification_frequency = Counter()

    for sample in job.samples:
        analysis_summary = get_feature_payload(sample, "analysis_summary")
        for mutation in sample.mutations:
            mutation_frequency[mutation.mutation.mutation_label] += 1

        for label, count in analysis_summary.get("snp_spectrum", {}).items():
            snp_frequency[label] += count

        for kmer, count in get_feature_payload(sample, "kmer_3").items():
            kmer_frequency[kmer] += count

        if sample.classifications:
            classification = sample.classifications[0]
            variant = get_variant_classification(classification.predicted_label, classification.rationale)
            classification_frequency[variant["label"]] += 1

    heatmap = build_mutation_heatmap(job)
    phylogenetic_tree = build_phylogenetic_tree(job.samples)
    return {
        "job_id": str(job.id),
        "sample_count": len(job.samples),
        "classification_distribution": [
            {"label": label, "value": value}
            for label, value in classification_frequency.most_common()
        ],
        "mutation_frequency": [
            {"label": label, "value": value}
            for label, value in mutation_frequency.most_common(15)
        ],
        "snp_frequency": [
            {"label": label, "value": value}
            for label, value in sorted(snp_frequency.items(), key=lambda item: (-item[1], item[0]))[:12]
        ],
        "kmer_frequency": [
            {"label": label, "value": value}
            for label, value in kmer_frequency.most_common(12)
        ],
        "pca_projection": build_pca_projection(job),
        "phylogenetic_tree": phylogenetic_tree,
        "phylogenetic_newick": build_newick_tree(phylogenetic_tree),
        "consensus_summary": build_consensus_summary(job.samples),
        "cluster_summary": build_cluster_summary(job.samples),
        "mutation_heatmap": heatmap,
        "distance_matrix": build_distance_matrix(job.samples),
    }


def build_mutation_heatmap(job: AnalysisJob) -> dict:
    mutation_counter = Counter()
    for sample in job.samples:
        labels = {link.mutation.mutation_label for link in sample.mutations}
        for label in labels:
            mutation_counter[label] += 1

    top_mutations = [label for label, _ in mutation_counter.most_common(12)]
    rows = []

    for sample in job.samples:
        present = {link.mutation.mutation_label for link in sample.mutations}
        rows.append(
            {
                "sample_id": str(sample.id),
                "sample_name": sample.sample_name,
                "values": [1 if label in present else 0 for label in top_mutations],
            }
        )

    return {"columns": top_mutations, "rows": rows}


def build_distance_matrix(samples: list[Sample]) -> list[dict]:
    matrix = []
    for left in samples:
        distances = []
        for right in samples:
            distances.append(
                {
                    "sample_id": str(right.id),
                    "sample_name": right.sample_name,
                    "distance": round(sequence_distance(left.sequence, right.sequence), 4),
                }
            )
        matrix.append({"sample_id": str(left.id), "sample_name": left.sample_name, "distances": distances})
    return matrix


def build_phylogenetic_tree(samples: list[Sample]) -> dict:
    if not samples:
        return {"name": "Empty cohort", "children": []}

    clusters = [
        {
            "key": str(sample.id),
            "name": sample.sample_name,
            "members": [sample],
            "node": {"name": sample.sample_name, "sample_id": str(sample.id)},
        }
        for sample in samples
    ]

    while len(clusters) > 1:
        best_pair = None
        best_distance = None

        for left_index in range(len(clusters)):
            for right_index in range(left_index + 1, len(clusters)):
                distance = average_cluster_distance(
                    clusters[left_index]["members"],
                    clusters[right_index]["members"],
                )
                if best_distance is None or distance < best_distance:
                    best_distance = distance
                    best_pair = (left_index, right_index)

        left_index, right_index = best_pair
        right = clusters.pop(right_index)
        left = clusters.pop(left_index)
        clusters.append(
            {
                "key": f"{left['key']}::{right['key']}",
                "name": f"{left['name']} + {right['name']}",
                "members": [*left["members"], *right["members"]],
                "node": {
                    "name": f"{left['name']} + {right['name']}",
                    "distance": round(best_distance or 0.0, 4),
                    "children": [left["node"], right["node"]],
                },
            }
        )

    return clusters[0]["node"]


def build_newick_tree(node: dict) -> str:
    if not node.get("children"):
        return sanitize_newick_label(node["name"])

    children = ",".join(build_newick_tree(child) for child in node["children"])
    branch_length = f":{node.get('distance', 0.0):.4f}" if node.get("distance") is not None else ""
    return f"({children}){sanitize_newick_label(node['name'])}{branch_length};"


def sanitize_newick_label(label: str) -> str:
    return label.replace(" ", "_").replace("(", "").replace(")", "").replace(";", "")


def build_consensus_summary(samples: list[Sample]) -> dict:
    if not samples:
        return {
            "consensus_sequence_preview": "",
            "consensus_length": 0,
            "variable_site_count": 0,
            "high_variability_sites": [],
        }

    max_length = max(len(sample.sequence) for sample in samples)
    consensus_bases = []
    variable_site_count = 0
    high_variability_sites = []

    for index in range(max_length):
        column = [sample.sequence[index] if index < len(sample.sequence) else "-" for sample in samples]
        counts = Counter(column)
        consensus_base, consensus_count = counts.most_common(1)[0]
        consensus_bases.append(consensus_base)

        if len(counts) > 1:
            variable_site_count += 1

        dominant_fraction = consensus_count / len(samples)
        if len(counts) > 1 and dominant_fraction < 0.8 and len(high_variability_sites) < 12:
            high_variability_sites.append(
                {
                    "position": index + 1,
                    "consensus_base": consensus_base,
                    "base_counts": dict(sorted(counts.items())),
                }
            )

    consensus_sequence = "".join(consensus_bases).replace("-", "")
    return {
        "consensus_sequence_preview": consensus_sequence[:120],
        "consensus_length": len(consensus_sequence),
        "variable_site_count": variable_site_count,
        "high_variability_sites": high_variability_sites,
    }


def build_cluster_summary(samples: list[Sample]) -> list[dict]:
    clusters: dict[str, list[Sample]] = {}
    for sample in samples:
        if sample.classifications:
            classification = sample.classifications[0]
            label = get_variant_classification(classification.predicted_label, classification.rationale)["label"]
        else:
            label = sample.qc_status
        clusters.setdefault(label, []).append(sample)

    summary = []
    for label, members in sorted(clusters.items(), key=lambda item: (-len(item[1]), item[0])):
        average_similarity = sum(
            get_feature_payload(member, "analysis_summary").get("sequence_similarity_percent", 0.0)
            for member in members
        ) / max(len(members), 1)
        summary.append(
            {
                "label": label,
                "sample_count": len(members),
                "average_similarity_percent": round(average_similarity, 4),
                "sample_names": [member.sample_name for member in members[:8]],
            }
        )

    return summary


def average_cluster_distance(left_members: list[Sample], right_members: list[Sample]) -> float:
    pairs = [
        sequence_distance(left.sequence, right.sequence)
        for left in left_members
        for right in right_members
    ]
    return sum(pairs) / len(pairs) if pairs else 0.0


def sequence_distance(left_sequence: str, right_sequence: str) -> float:
    shared_length = min(len(left_sequence), len(right_sequence))
    mismatches = sum(
        1
        for left_base, right_base in zip(left_sequence[:shared_length], right_sequence[:shared_length])
        if left_base != right_base
    )
    length_penalty = abs(len(left_sequence) - len(right_sequence))
    denominator = max(len(left_sequence), len(right_sequence), 1)
    return (mismatches + length_penalty) / denominator


def build_pca_projection(job: AnalysisJob) -> list[dict]:
    vectors = []
    for sample in job.samples:
        analysis_summary = get_feature_payload(sample, "analysis_summary")
        vectors.append(
            {
                "sample_id": str(sample.id),
                "sample_name": sample.sample_name,
                "label": (
                    get_variant_classification(
                        sample.classifications[0].predicted_label,
                        sample.classifications[0].rationale,
                    )["label"]
                    if sample.classifications
                    else sample.qc_status
                ),
                "values": [
                    float(analysis_summary.get("mutation_count", 0)),
                    float(analysis_summary.get("mutation_types", {}).get("snp", 0)),
                    float(analysis_summary.get("mutation_types", {}).get("insertion", 0)),
                    float(analysis_summary.get("mutation_types", {}).get("deletion", 0)),
                    float(analysis_summary.get("transition_count", 0)),
                    float(analysis_summary.get("transversion_count", 0)),
                    float(analysis_summary.get("sequence_similarity_percent", 0.0)),
                    float(sample.sequence_length),
                ],
            }
        )

    if not vectors:
        return []

    matrix = [item["values"] for item in vectors]
    standardized = standardize_matrix(matrix)
    covariance = covariance_matrix(standardized)
    eigenvector_one = power_iteration(covariance)
    eigenvalue_one = eigenvalue_for(covariance, eigenvector_one)
    deflated = deflate_matrix(covariance, eigenvector_one, eigenvalue_one)
    eigenvector_two = power_iteration(deflated)

    points = []
    for row, vector in zip(standardized, vectors):
        pc1 = dot_product(row, eigenvector_one)
        pc2 = dot_product(row, eigenvector_two)
        points.append(
            {
                "sample_id": vector["sample_id"],
                "sample_name": vector["sample_name"],
                "label": vector["label"],
                "pc1": round(pc1, 4),
                "pc2": round(pc2, 4),
            }
        )

    return points


def standardize_matrix(matrix: list[list[float]]) -> list[list[float]]:
    if not matrix:
        return []

    column_count = len(matrix[0])
    means = []
    deviations = []

    for column_index in range(column_count):
        column = [row[column_index] for row in matrix]
        mean = sum(column) / len(column)
        variance = sum((value - mean) ** 2 for value in column) / max(len(column) - 1, 1)
        deviation = sqrt(variance) if variance > 0 else 1.0
        means.append(mean)
        deviations.append(deviation)

    return [
        [
            (row[column_index] - means[column_index]) / deviations[column_index]
            for column_index in range(column_count)
        ]
        for row in matrix
    ]


def covariance_matrix(matrix: list[list[float]]) -> list[list[float]]:
    if not matrix:
        return []

    row_count = len(matrix)
    column_count = len(matrix[0])
    covariance = [[0.0 for _ in range(column_count)] for _ in range(column_count)]

    for left in range(column_count):
        for right in range(column_count):
            covariance[left][right] = sum(row[left] * row[right] for row in matrix) / max(row_count - 1, 1)

    return covariance


def power_iteration(matrix: list[list[float]], iterations: int = 32) -> list[float]:
    if not matrix:
        return []

    vector = [1.0 for _ in range(len(matrix))]
    for _ in range(iterations):
        candidate = [dot_product(row, vector) for row in matrix]
        norm = sqrt(sum(value * value for value in candidate)) or 1.0
        vector = [value / norm for value in candidate]
    return vector


def eigenvalue_for(matrix: list[list[float]], vector: list[float]) -> float:
    transformed = [dot_product(row, vector) for row in matrix]
    denominator = dot_product(vector, vector) or 1.0
    return dot_product(vector, transformed) / denominator


def deflate_matrix(matrix: list[list[float]], eigenvector: list[float], eigenvalue: float) -> list[list[float]]:
    output = []
    for row_index, row in enumerate(matrix):
        output_row = []
        for column_index, value in enumerate(row):
            output_row.append(value - eigenvalue * eigenvector[row_index] * eigenvector[column_index])
        output.append(output_row)
    return output


def dot_product(left: list[float], right: list[float]) -> float:
    return sum(left_value * right_value for left_value, right_value in zip(left, right))
