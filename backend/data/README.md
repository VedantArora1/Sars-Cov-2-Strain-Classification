# Reference Genome Data

Place the full SARS-CoV-2 reference FASTA from NCBI in this directory as:

- `reference_nc_045512_2.fasta`

Expected accession:

- `NC_045512.2`

The MVP backend is already wired to load this file automatically when present. Until the full
reference FASTA is added, the comparison service uses a short embedded placeholder sequence only
for scaffold-level development.
