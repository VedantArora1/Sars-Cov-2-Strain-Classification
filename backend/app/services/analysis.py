from collections import Counter

from app.services.reference import get_reference_accession, load_reference_sequence


MAX_REFERENCE_OFFSET = 250
OFFSET_SEED_LENGTH = 24
OFFSET_SEED_POSITIONS = (0, 64, 128, 256)


def _score_reference_offset(reference: str, sequence: str, offset: int) -> tuple[int, int]:
    matches = 0
    compared = 0

    for index, sample_base in enumerate(sequence):
        reference_index = index + offset
        if 0 <= reference_index < len(reference):
            compared += 1
            if sample_base == reference[reference_index]:
                matches += 1

    return matches, compared


def _candidate_reference_offsets(reference: str, sequence: str) -> list[int]:
    candidates: list[int] = []

    for seed_start in OFFSET_SEED_POSITIONS:
        if seed_start + OFFSET_SEED_LENGTH > len(sequence):
            continue

        seed = sequence[seed_start:seed_start + OFFSET_SEED_LENGTH]
        reference_index = reference.find(seed)
        if reference_index == -1:
            continue

        offset = reference_index - seed_start
        if offset not in candidates:
            candidates.append(offset)

    return candidates


def find_best_reference_offset(reference: str, sequence: str, max_offset: int = MAX_REFERENCE_OFFSET) -> int:
    if not reference or not sequence:
        return 0

    candidates = _candidate_reference_offsets(reference, sequence)
    best_offset = 0
    best_matches = -1
    best_compared = 1

    offsets = candidates if candidates else range(-max_offset, max_offset + 1)
    for offset in offsets:
        matches, compared = _score_reference_offset(reference, sequence, offset)
        if matches * best_compared > best_matches * compared:
            best_offset = offset
            best_matches = matches
            best_compared = compared

    return best_offset


def compare_to_reference(sequence: str) -> list[dict]:
    reference = load_reference_sequence()
    mutations: list[dict] = []
    offset = find_best_reference_offset(reference, sequence)

    for index, alt_base in enumerate(sequence):
        reference_index = index + offset
        if reference_index < 0 or reference_index >= len(reference):
            continue

        ref_base = reference[reference_index]
        position = reference_index + 1
        if ref_base != alt_base:
            mutations.append(
                {
                    "position": position,
                    "reference_base": ref_base,
                    "alternate_base": alt_base,
                    "mutation_label": f"{ref_base}{position}{alt_base}",
                    "reference_accession": get_reference_accession(),
                }
            )

    if offset < 0:
        for index, alt_base in enumerate(sequence[: abs(offset)], start=1):
            mutations.append(
                {
                    "position": index,
                    "reference_base": "-",
                    "alternate_base": alt_base,
                    "mutation_label": f"ins_{index}_{alt_base}",
                    "reference_accession": get_reference_accession(),
                }
            )

    sequence_end = offset + len(sequence)
    if sequence_end > len(reference):
        overflow_start = max(len(reference) - offset, 0)
        for index, alt_base in enumerate(sequence[overflow_start:], start=len(reference) + 1):
            mutations.append(
                {
                    "position": index,
                    "reference_base": "-",
                    "alternate_base": alt_base,
                    "mutation_label": f"ins_{index}_{alt_base}",
                    "reference_accession": get_reference_accession(),
                }
            )

    if offset > 0:
        for position, ref_base in enumerate(reference[:offset], start=1):
            mutations.append(
                {
                    "position": position,
                    "reference_base": ref_base,
                    "alternate_base": "-",
                    "mutation_label": f"del_{position}_{ref_base}",
                    "reference_accession": get_reference_accession(),
                }
            )

    if sequence_end < len(reference):
        for position, ref_base in enumerate(reference[max(sequence_end, 0):], start=max(sequence_end, 0) + 1):
            mutations.append(
                {
                    "position": position,
                    "reference_base": ref_base,
                    "alternate_base": "-",
                    "mutation_label": f"del_{position}_{ref_base}",
                    "reference_accession": get_reference_accession(),
                }
            )

    return mutations


def build_kmer_frequency(sequence: str, k: int = 3) -> dict[str, int]:
    kmers = (sequence[index:index + k] for index in range(len(sequence) - k + 1))
    counts = Counter(kmer for kmer in kmers if len(kmer) == k)
    return dict(counts)


def build_mutation_matrix_row(mutations: list[dict]) -> dict[str, int]:
    return {mutation["mutation_label"]: 1 for mutation in mutations}


def summarize_sequence_against_reference(sequence: str, mutations: list[dict]) -> dict:
    reference = load_reference_sequence()
    offset = find_best_reference_offset(reference, sequence)
    shared_start = max(offset, 0)
    shared_end = min(offset + len(sequence), len(reference))
    shared_length = max(shared_end - shared_start, 0)
    exact_matches = 0
    for index, sample_base in enumerate(sequence):
        reference_index = index + offset
        if 0 <= reference_index < len(reference) and reference[reference_index] == sample_base:
            exact_matches += 1
    similarity = round((exact_matches / len(reference)) * 100, 4) if reference else 0.0

    mutation_types = Counter()
    snp_spectrum = Counter()
    transition_count = 0
    transversion_count = 0

    for mutation in mutations:
        ref_base = mutation["reference_base"]
        alt_base = mutation["alternate_base"]

        if ref_base == "-":
            mutation_types["insertion"] += 1
            continue
        if alt_base == "-":
            mutation_types["deletion"] += 1
            continue

        mutation_types["snp"] += 1
        substitution = f"{ref_base}>{alt_base}"
        snp_spectrum[substitution] += 1
        if (ref_base, alt_base) in {("A", "G"), ("G", "A"), ("C", "T"), ("T", "C")}:
            transition_count += 1
        else:
            transversion_count += 1

    mutation_count = len(mutations)
    return {
        "reference_length": len(reference),
        "sequence_length": len(sequence),
        "shared_length": shared_length,
        "reference_alignment_offset": offset,
        "exact_reference_match": mutation_count == 0 and len(sequence) == len(reference),
        "sequence_similarity_percent": similarity,
        "mutation_count": mutation_count,
        "mutation_types": {
            "snp": mutation_types["snp"],
            "insertion": mutation_types["insertion"],
            "deletion": mutation_types["deletion"],
        },
        "transition_count": transition_count,
        "transversion_count": transversion_count,
        "snp_spectrum": dict(sorted(snp_spectrum.items())),
        "mutation_labels": [mutation["mutation_label"] for mutation in mutations],
    }
