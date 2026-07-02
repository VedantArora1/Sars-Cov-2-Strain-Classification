VARIANT_SIGNATURES = [
    {
        "variant_label": "20B / B.1.1",
        "common_name": "B.1.1 family",
        "label": "20B / B.1.1-like SARS-CoV-2",
        "variant_key": "20b_b117",
        "mutations": {"C241T", "C3037T", "C14408T", "A23403G", "G28881A", "G28882A", "G28883C"},
        "minimum_hits": 4,
    },
    {
        "variant_label": "20A / B.1",
        "common_name": "B.1 family",
        "label": "20A / B.1-like SARS-CoV-2",
        "variant_key": "20a_b1",
        "mutations": {"C241T", "C3037T", "C14408T", "A23403G"},
        "minimum_hits": 3,
    },
    {
        "variant_label": "Omicron",
        "common_name": "Omicron",
        "label": "Omicron-like SARS-CoV-2",
        "variant_key": "omicron",
        "mutations": {"C23202A", "C23525T", "C23604A", "G23607A", "A23013C", "A23040G"},
        "minimum_hits": 2,
    },
    {
        "variant_label": "Delta",
        "common_name": "Delta",
        "label": "Delta-like SARS-CoV-2",
        "variant_key": "delta",
        "mutations": {"T22917G", "C22995A", "C21618G", "G24410A", "C25469T"},
        "minimum_hits": 2,
    },
    {
        "variant_label": "Alpha",
        "common_name": "Alpha",
        "label": "Alpha-like SARS-CoV-2",
        "variant_key": "alpha",
        "mutations": {"A23063T", "C23271A", "C23604A", "C23709T", "T24506G"},
        "minimum_hits": 2,
    },
]

SIGNATURE_BY_KEY = {
    signature["variant_key"]: signature
    for signature in VARIANT_SIGNATURES
}

LOW_SIMILARITY_THRESHOLD = 80.0


def is_low_similarity_sequence(rationale: dict | None = None) -> bool:
    rationale = rationale or {}
    similarity = rationale.get("sequence_similarity_percent")
    return isinstance(similarity, (int, float)) and similarity < LOW_SIMILARITY_THRESHOLD


def get_display_classification_label(predicted_label: str, rationale: dict | None = None) -> str:
    if is_low_similarity_sequence(rationale):
        return "Not SARS-CoV-2-like sequence"

    return predicted_label


def _build_variant_payload(key: str, label: str, common_name: str | None = None) -> dict[str, str | None]:
    display_label = f"{label} ({common_name})" if common_name and common_name != label else label
    return {
        "key": key,
        "label": label,
        "common_name": common_name,
        "display_label": display_label,
    }


def get_variant_classification(predicted_label: str, rationale: dict | None = None) -> dict[str, str | None]:
    rationale = rationale or {}
    signature_key = rationale.get("signature_variant_key")
    if isinstance(signature_key, str) and signature_key in SIGNATURE_BY_KEY:
        signature = SIGNATURE_BY_KEY[signature_key]
        return _build_variant_payload(
            signature["variant_key"],
            signature["variant_label"],
            signature.get("common_name"),
        )

    if is_low_similarity_sequence(rationale):
        return _build_variant_payload("not_sars_cov_2_like", "Not SARS-CoV-2-like")

    normalized = predicted_label.lower()
    if "reference-like" in normalized:
        return _build_variant_payload("reference_like", "Reference-like")
    if "near-reference" in normalized:
        return _build_variant_payload("near_reference", "Near-reference")
    if "unclassified" in normalized:
        return _build_variant_payload("unclassified", "Unclassified")

    return _build_variant_payload("other", "Other")


def classify_sample(summary: dict) -> dict:
    mutation_count = summary["mutation_count"]
    exact_reference_match = summary["exact_reference_match"]
    similarity = summary["sequence_similarity_percent"]
    mutation_labels = set(summary.get("mutation_labels", []))

    if exact_reference_match:
        return {
            "classifier_name": "signature_lineage_classifier_v1",
            "predicted_label": "Reference-like (NC_045512.2 / Wuhan-Hu-1)",
            "confidence": 100,
            "rationale": {
                "rule": "Exact sequence match to the loaded reference genome.",
                "sequence_similarity_percent": similarity,
                "matched_signature_mutations": [],
            },
        }

    if similarity < LOW_SIMILARITY_THRESHOLD:
        return {
            "classifier_name": "signature_lineage_classifier_v1",
            "predicted_label": "Not SARS-CoV-2-like sequence",
            "confidence": 99,
            "rationale": {
                "rule": (
                    "Sequence similarity to the SARS-CoV-2 reference is too low for "
                    "lineage calling and suggests the upload is not SARS-CoV-2-like."
                ),
                "sequence_similarity_percent": similarity,
                "matched_signature_mutations": [],
            },
        }

    best_match = None
    best_hits = set()
    for signature in VARIANT_SIGNATURES:
        hits = mutation_labels & signature["mutations"]
        if len(hits) < signature["minimum_hits"]:
            continue

        if best_match is None or len(hits) > len(best_hits):
            best_match = signature
            best_hits = hits

    if best_match is not None:
        total_signature_markers = len(best_match["mutations"])
        confidence = min(95, 55 + int((len(best_hits) / total_signature_markers) * 40))
        return {
            "classifier_name": "signature_lineage_classifier_v1",
            "predicted_label": best_match["label"],
            "confidence": confidence,
            "rationale": {
                "rule": "Signature mutation overlap with curated lineage marker set.",
                "sequence_similarity_percent": similarity,
                "matched_signature_mutations": sorted(best_hits),
                "signature_marker_count": total_signature_markers,
                "signature_variant_key": best_match["variant_key"],
                "signature_variant_label": best_match["variant_label"],
            },
        }

    if mutation_count <= 5 and similarity >= 99.9:
        return {
            "classifier_name": "signature_lineage_classifier_v1",
            "predicted_label": "Near-reference SARS-CoV-2",
            "confidence": 72,
            "rationale": {
                "rule": "Very low mutation burden relative to the loaded reference genome.",
                "sequence_similarity_percent": similarity,
                "matched_signature_mutations": [],
            },
        }

    return {
        "classifier_name": "signature_lineage_classifier_v1",
        "predicted_label": "Unclassified SARS-CoV-2 sample",
        "confidence": 35,
        "rationale": {
            "rule": "No supported lineage signature crossed the decision threshold.",
            "sequence_similarity_percent": similarity,
            "matched_signature_mutations": [],
        },
    }
