from pathlib import Path

from app.config import settings


REFERENCE_SEQUENCE = (
    "ATTAAAGGTTTATACCTTCCCAGGTAACAAACCAACCAACTTTCGATCTCTTGTAGATCT"
    "GTTCTCTAAACGAACTTTAAAATCTGTGTGGCTGTCACTCGGCTGCATGCTTAGTGCACT"
)


def get_reference_accession() -> str:
    return settings.reference_accession


def load_reference_sequence() -> str:
    reference_path = Path(__file__).resolve().parents[2] / "data" / "reference_nc_045512_2.fasta"
    if reference_path.exists():
        lines = [line.strip() for line in reference_path.read_text(encoding="utf-8").splitlines() if line.strip()]
        return "".join(line for line in lines if not line.startswith(">")).upper()

    return REFERENCE_SEQUENCE
