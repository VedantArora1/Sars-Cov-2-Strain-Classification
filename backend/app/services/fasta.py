from dataclasses import dataclass


VALID_BASES = {"A", "C", "G", "T", "N"}
STRICT_UPLOAD_BASES = {"A", "C", "G", "T"}
MIN_UPLOAD_SEQUENCE_LENGTH = 29_000
MAX_UPLOAD_SEQUENCE_LENGTH = 31_000


@dataclass
class ParsedSequence:
    sample_name: str
    fasta_header: str
    sequence: str


def parse_fasta_text(contents: str) -> list[ParsedSequence]:
    records: list[ParsedSequence] = []
    current_header: str | None = None
    current_sequence_parts: list[str] = []

    for raw_line in contents.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.startswith(">"):
            if current_header is not None:
                records.append(_build_record(current_header, current_sequence_parts))
            current_header = line[1:].strip()
            current_sequence_parts = []
            continue

        current_sequence_parts.append(line)

    if current_header is not None:
        records.append(_build_record(current_header, current_sequence_parts))

    return records


def _build_record(header: str, sequence_parts: list[str]) -> ParsedSequence:
    sample_name = header.split()[0] if header else "unknown_sample"
    sequence = "".join(sequence_parts).upper().replace(" ", "")
    return ParsedSequence(
        sample_name=sample_name,
        fasta_header=header,
        sequence=sequence,
    )


def validate_sequence(sequence: str) -> list[str]:
    notes: list[str] = []

    if not sequence:
        notes.append("Sequence is empty.")
        return notes

    invalid_bases = sorted(set(sequence) - VALID_BASES)
    if invalid_bases:
        notes.append(f"Invalid bases detected: {', '.join(invalid_bases)}")

    if len(sequence) < 29000:
        notes.append("Sequence is shorter than the expected SARS-CoV-2 genome length.")

    ambiguous_ratio = sequence.count("N") / len(sequence)
    if ambiguous_ratio > 0.05:
        notes.append("Sequence contains more than 5% ambiguous bases (N).")

    return notes


def validate_upload_records(records: list[ParsedSequence]) -> list[str]:
    errors: list[str] = []

    if len(records) > 1:
        errors.append(
            "Multiple FASTA headers were found in one uploaded file. Please upload one sequence per file."
        )

    for record in records:
        if len(record.sequence) < MIN_UPLOAD_SEQUENCE_LENGTH:
            errors.append(
                f"{record.sample_name} is shorter than the minimum required length of {MIN_UPLOAD_SEQUENCE_LENGTH:,} characters."
            )

        if len(record.sequence) > MAX_UPLOAD_SEQUENCE_LENGTH:
            errors.append(
                f"{record.sample_name} exceeds the {MAX_UPLOAD_SEQUENCE_LENGTH:,} character limit."
            )

        invalid_bases = sorted(set(record.sequence) - STRICT_UPLOAD_BASES)
        if invalid_bases:
            errors.append(
                f"{record.sample_name} contains invalid characters. Only A, C, G, and T are allowed "
                f"(found: {', '.join(invalid_bases)})."
            )

    return errors
