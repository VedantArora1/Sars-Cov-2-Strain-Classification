from collections.abc import Iterable

from app.db import SessionLocal
from app.services.fasta import ParsedSequence
from app.services.jobs import create_job_from_sequences
from app.services.reference import load_reference_sequence


SIGNATURE_MUTATIONS = {
    "alpha_demo_01": ["A23063T", "C23271A", "C23604A"],
    "delta_demo_01": ["T22917G", "C22995A", "C21618G"],
    "omicron_demo_01": ["A23013C", "C23202A", "C23525T", "G23607A"],
}


def apply_mutations(reference: str, mutation_labels: Iterable[str]) -> str:
    sequence = list(reference)
    for label in mutation_labels:
        if len(label) < 3 or label.startswith(("ins_", "del_")):
            continue

        reference_base = label[0]
        alternate_base = label[-1]
        position = int(label[1:-1]) - 1

        if position < 0 or position >= len(sequence):
            continue
        if sequence[position] != reference_base:
            continue

        sequence[position] = alternate_base

    return "".join(sequence)


def main():
    reference = load_reference_sequence()
    demo_sequences = [
        ParsedSequence(
            sample_name=sample_name,
            fasta_header=f"{sample_name} synthetic_demo_sequence",
            sequence=apply_mutations(reference, mutation_labels),
        )
        for sample_name, mutation_labels in SIGNATURE_MUTATIONS.items()
    ]

    db = SessionLocal()
    try:
        response = create_job_from_sequences(db, demo_sequences)
        print(f"Seeded demo analysis job {response.job_id} with {response.sample_count} samples.")
        for sample in response.samples:
            print(f"- {sample.sample_name}: {sample.predicted_label} ({sample.mutation_count} mutations)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
