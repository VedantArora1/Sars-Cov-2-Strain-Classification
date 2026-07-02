from collections import Counter
from datetime import datetime
from html import escape

from app.models import AnalysisJob, Sample
from app.services.classification import get_display_classification_label, get_variant_classification
from app.services.cohort import build_job_analytics


def build_job_report(job: AnalysisJob) -> dict:
    analytics = build_job_analytics(job)
    samples_payload = []
    total_mutations = 0
    warning_samples = 0
    exact_reference_match_count = 0
    classification_counts = Counter()
    mutation_frequency = Counter()

    for sample in job.samples:
        mutation_count = len(sample.mutations)
        total_mutations += mutation_count
        if sample.qc_status != "passed":
            warning_samples += 1

        kmer_feature = next((feature for feature in sample.feature_sets if feature.feature_type == "kmer_3"), None)
        top_kmers = []
        if kmer_feature:
            sorted_kmers = sorted(kmer_feature.payload.items(), key=lambda item: item[1], reverse=True)[:5]
            top_kmers = [{"kmer": key, "count": value} for key, value in sorted_kmers]

        analysis_summary = next(
            (feature for feature in sample.feature_sets if feature.feature_type == "analysis_summary"),
            None,
        )
        analysis_payload = analysis_summary.payload if analysis_summary else {}
        if analysis_payload.get("exact_reference_match"):
            exact_reference_match_count += 1

        classification = sample.classifications[0] if sample.classifications else None
        if classification:
            variant = get_variant_classification(classification.predicted_label, classification.rationale)
            classification_counts[variant.get("display_label") or variant["label"]] += 1

        for link in sample.mutations:
            mutation_frequency[link.mutation.mutation_label] += 1

        samples_payload.append(
            build_sample_report(
                sample,
                mutation_count,
                top_kmers,
                analysis_payload,
                classification,
            )
        )

    return {
        "report_type": "mvp_summary",
        "generated_at": datetime.utcnow().isoformat(),
        "summary": {
            "sample_count": len(job.samples),
            "warning_sample_count": warning_samples,
            "exact_reference_match_count": exact_reference_match_count,
            "total_detected_mutations": total_mutations,
            "reference_accession": (job.summary or {}).get("reference_accession"),
            "classification_counts": dict(classification_counts),
            "top_recurrent_mutations": [
                {"mutation_label": label, "sample_frequency": count}
                for label, count in mutation_frequency.most_common(10)
            ],
        },
        "analytics": analytics,
        "samples": samples_payload,
    }


def build_sample_report(sample: Sample, mutation_count: int, top_kmers: list[dict], analysis_summary: dict, classification) -> dict:
    top_mutations = [
        {
            "mutation_label": link.mutation.mutation_label,
            "position": link.mutation.position,
            "reference_base": link.mutation.reference_base,
            "alternate_base": link.mutation.alternate_base,
        }
        for link in sample.mutations[:5]
    ]

    return {
        "sample_id": str(sample.id),
        "sample_name": sample.sample_name,
        "sequence_length": sample.sequence_length,
        "qc_status": sample.qc_status,
        "qc_notes": (sample.qc_notes or {}).get("messages", []),
        "mutation_count": mutation_count,
        "exact_reference_match": analysis_summary.get("exact_reference_match", False),
        "sequence_similarity_percent": analysis_summary.get("sequence_similarity_percent", 0.0),
        "classification": (
            {
                "classifier_name": classification.classifier_name,
                "predicted_label": get_display_classification_label(
                    classification.predicted_label,
                    classification.rationale,
                ),
                "confidence": classification.confidence,
                "rationale": classification.rationale,
                "variant_classification": get_variant_classification(
                    classification.predicted_label,
                    classification.rationale,
                ),
            }
            if classification
            else None
        ),
        "top_kmers": top_kmers,
        "top_mutations": top_mutations,
        "remaining_mutation_count": max(mutation_count - len(top_mutations), 0),
    }


def render_job_report_html(job_report: dict) -> str:
    summary = job_report["summary"]
    analytics = job_report.get("analytics", {})
    classification_counts = summary.get("classification_counts", {})
    top_recurrent = summary.get("top_recurrent_mutations", [])
    pca_points = analytics.get("pca_projection", [])
    heatmap = analytics.get("mutation_heatmap", {})
    cluster_summary = analytics.get("cluster_summary", [])
    consensus_summary = analytics.get("consensus_summary", {})
    snp_frequency = analytics.get("snp_frequency", [])
    classification_distribution = analytics.get("classification_distribution", [])
    mutation_frequency = analytics.get("mutation_frequency", [])

    classification_items = "".join(
        f"<li><strong>{escape(label)}</strong>: {count}</li>"
        for label, count in classification_counts.items()
    ) or "<li>No classifications available.</li>"

    recurrent_rows = "".join(
        f"<tr><td>{escape(item['mutation_label'])}</td><td>{item['sample_frequency']}</td></tr>"
        for item in top_recurrent
    ) or "<tr><td>No recurrent mutations</td><td>0</td></tr>"

    pca_rows = "".join(
        f"<tr><td>{escape(point['sample_name'])}</td><td>{escape(point['label'])}</td><td>{point['pc1']}</td><td>{point['pc2']}</td></tr>"
        for point in pca_points
    ) or "<tr><td>No PCA projection</td><td>-</td><td>0</td><td>0</td></tr>"

    heatmap_header = "".join(f"<th>{escape(label)}</th>" for label in heatmap.get("columns", []))
    heatmap_rows = "".join(
        "<tr><td>{}</td>{}</tr>".format(
            escape(row["sample_name"]),
            "".join(
                f"<td class=\"{'heat-on' if value else 'heat-off'}\">{value}</td>"
                for value in row["values"]
            ),
        )
        for row in heatmap.get("rows", [])
    ) or "<tr><td>No heatmap rows</td></tr>"

    cluster_rows = "".join(
        f"<tr><td>{escape(item['label'])}</td><td>{item['sample_count']}</td><td>{item['average_similarity_percent']:.3f}%</td><td>{escape(', '.join(item['sample_names']))}</td></tr>"
        for item in cluster_summary
    ) or "<tr><td>No clusters</td><td>0</td><td>0%</td><td>-</td></tr>"

    variability_rows = "".join(
        f"<tr><td>{site['position']}</td><td>{escape(site['consensus_base'])}</td><td>{escape(' | '.join(f'{base}:{count}' for base, count in site['base_counts'].items()))}</td></tr>"
        for site in consensus_summary.get("high_variability_sites", [])
    ) or "<tr><td colspan=\"3\">No high-variability sites detected.</td></tr>"

    classification_chart = render_bar_chart(
        classification_distribution,
        title="Variant Distribution",
        color="#2563eb",
    )
    mutation_chart = render_bar_chart(
        mutation_frequency[:10],
        title="Top Recurrent Mutations",
        color="#f59e0b",
    )
    snp_chart = render_bar_chart(
        snp_frequency[:10],
        title="SNP Substitution Frequency",
        color="#10b981",
    )
    pca_chart = render_pca_scatter(pca_points)

    sample_sections = []
    for sample in job_report["samples"]:
        mutation_text = (
            ", ".join(escape(item["mutation_label"]) for item in sample["top_mutations"])
            if sample["top_mutations"]
            else "None detected"
        )
        if sample.get("remaining_mutation_count", 0) > 0:
            mutation_text += f", and {sample['remaining_mutation_count']} more"

        sample_sections.append(
            f"""
            <section class=\"sample\">
              <h2>{escape(sample['sample_name'])}</h2>
              <p><strong>Sequence length:</strong> {sample['sequence_length']} bases</p>
              <p><strong>QC status:</strong> {escape(sample['qc_status'])}</p>
              <p><strong>Exact reference match:</strong> {'Yes' if sample['exact_reference_match'] else 'No'}</p>
              <p><strong>Similarity:</strong> {sample['sequence_similarity_percent']:.3f}%</p>
              <p><strong>Pango lineage:</strong> {escape(sample['classification']['predicted_label']) if sample.get('classification') else 'Not available'}</p>
              <p><strong>Variant name:</strong> {escape(sample['classification']['variant_classification'].get('display_label') or sample['classification']['variant_classification']['label']) if sample.get('classification') else 'Not available'}</p>
              <p><strong>Classification note:</strong> {escape(str(sample['classification'].get('rationale', {}).get('rule', 'Not available'))) if sample.get('classification') else 'Not available'}</p>
              <p><strong>Mutation count:</strong> {sample['mutation_count']}</p>
              <p><strong>Top k-mers:</strong> {escape(' | '.join(f"{item['kmer']}:{item['count']}" for item in sample['top_kmers'])) if sample['top_kmers'] else 'Not available'}</p>
              <p><strong>Mutation preview:</strong> {mutation_text}</p>
            </section>
            """
        )

    sample_html = "".join(sample_sections)
    generated_at = escape(job_report.get("generated_at", ""))
    reference = escape(summary.get("reference_accession") or "NC_045512.2")

    return f"""
    <!DOCTYPE html>
    <html lang=\"en\">
      <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>SARS-CoV-2 Analysis Report</title>
        <style>
          body {{ font-family: Georgia, serif; margin: 0; background: #f7f4ee; color: #1f1d1a; }}
          main {{ max-width: 980px; margin: 0 auto; padding: 32px 20px 64px; }}
          section, article {{ background: #fffdf8; border: 1px solid #ded6c8; border-radius: 18px; padding: 20px; margin-top: 16px; }}
          h1, h2, h3 {{ margin: 0 0 12px; }}
          p, li, td, th {{ line-height: 1.6; }}
          table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
          th, td {{ border-bottom: 1px solid #ded6c8; padding: 10px 12px; text-align: left; }}
          ul {{ margin: 0; padding-left: 20px; }}
          .grid {{ display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }}
          .chart-card {{ padding: 16px; border: 1px solid #ded6c8; border-radius: 14px; background: #fff; }}
          .chart-card svg {{ width: 100%; height: auto; display: block; }}
          .mono {{ font-family: "Courier New", monospace; word-break: break-word; }}
          .heat-on {{ background: rgba(37, 99, 235, 0.18); }}
          .heat-off {{ background: rgba(148, 163, 184, 0.08); }}
          @media (max-width: 820px) {{ .grid {{ grid-template-columns: 1fr; }} }}
        </style>
      </head>
      <body>
        <main>
          <article>
            <h1>SARS-CoV-2 Analysis Report</h1>
            <p><strong>Generated at:</strong> {generated_at}</p>
            <p><strong>Reference accession:</strong> {reference}</p>
            <p><strong>Samples:</strong> {summary['sample_count']}</p>
            <p><strong>Warning samples:</strong> {summary['warning_sample_count']}</p>
            <p><strong>Exact reference matches:</strong> {summary['exact_reference_match_count']}</p>
            <p><strong>Total detected mutations:</strong> {summary['total_detected_mutations']}</p>
          </article>
          <section>
            <h2>Variant Distribution</h2>
            <ul>{classification_items}</ul>
          </section>
          <section>
            <h2>Visual Summary</h2>
            <div class="grid">
              <div class="chart-card">{classification_chart}</div>
              <div class="chart-card">{mutation_chart}</div>
              <div class="chart-card">{snp_chart}</div>
              <div class="chart-card">{pca_chart}</div>
            </div>
          </section>
          <section>
            <h2>Top Recurrent Mutations</h2>
            <table>
              <thead><tr><th>Mutation</th><th>Sample Frequency</th></tr></thead>
              <tbody>{recurrent_rows}</tbody>
            </table>
          </section>
          <section>
            <h2>Consensus Summary</h2>
            <p><strong>Consensus length:</strong> {consensus_summary.get('consensus_length', 0)}</p>
            <p><strong>Variable sites:</strong> {consensus_summary.get('variable_site_count', 0)}</p>
            <p><strong>Consensus preview:</strong> <span class="mono">{escape(consensus_summary.get('consensus_sequence_preview', '') or 'N/A')}</span></p>
          </section>
          <section>
            <h2>Cluster Summary</h2>
            <table>
              <thead><tr><th>Cluster</th><th>Samples</th><th>Average Similarity</th><th>Members</th></tr></thead>
              <tbody>{cluster_rows}</tbody>
            </table>
          </section>
          <section>
            <h2>PCA Projection</h2>
            <table>
              <thead><tr><th>Sample</th><th>Variant name</th><th>PC1</th><th>PC2</th></tr></thead>
              <tbody>{pca_rows}</tbody>
            </table>
          </section>
          <section>
            <h2>Mutation Heatmap Matrix</h2>
            <table>
              <thead><tr><th>Sample</th>{heatmap_header}</tr></thead>
              <tbody>{heatmap_rows}</tbody>
            </table>
          </section>
          <section>
            <h2>High-Variability Sites</h2>
            <table>
              <thead><tr><th>Position</th><th>Consensus</th><th>Base Counts</th></tr></thead>
              <tbody>{variability_rows}</tbody>
            </table>
          </section>
          <section>
            <h2>Phylogenetic Newick Export</h2>
            <p class="mono">{escape(analytics.get('phylogenetic_newick', '') or 'N/A')}</p>
          </section>
          {sample_html}
        </main>
      </body>
    </html>
    """


def render_bar_chart(items: list[dict], title: str, color: str) -> str:
    if not items:
        return f"<h3>{escape(title)}</h3><p>No data available.</p>"

    max_value = max(item.get("value", 0) for item in items) or 1
    bar_height = 24
    gap = 12
    label_width = 150
    width = 520
    height = len(items) * (bar_height + gap) + 36

    bars = []
    for index, item in enumerate(items):
        y = 24 + index * (bar_height + gap)
        value = item.get("value", 0)
        bar_width = (value / max_value) * (width - label_width - 70)
        bars.append(
            f"""
            <text x="0" y="{y + 16}" font-size="12" fill="#334155">{escape(str(item.get('label', '')))}</text>
            <rect x="{label_width}" y="{y}" width="{bar_width:.2f}" height="{bar_height}" rx="6" fill="{color}" opacity="0.85"></rect>
            <text x="{label_width + bar_width + 8:.2f}" y="{y + 16}" font-size="12" fill="#0f172a">{value}</text>
            """
        )

    return f"""
    <h3>{escape(title)}</h3>
    <svg viewBox="0 0 {width} {height}" role="img" aria-label="{escape(title)}">
      {''.join(bars)}
    </svg>
    """


def render_pca_scatter(points: list[dict]) -> str:
    if not points:
        return "<h3>PCA Scatter</h3><p>No PCA data available.</p>"

    xs = [point["pc1"] for point in points]
    ys = [point["pc2"] for point in points]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    def scale(value: float, minimum: float, maximum: float, lower: float, upper: float) -> float:
        if minimum == maximum:
            return (lower + upper) / 2
        return lower + ((value - minimum) / (maximum - minimum)) * (upper - lower)

    dots = []
    legend = []
    palette = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#0f766e"]
    labels = {point["label"]: palette[index % len(palette)] for index, point in enumerate(points)}

    for point in points:
        x = scale(point["pc1"], min_x, max_x, 40, 360)
        y = scale(point["pc2"], min_y, max_y, 240, 40)
        color = labels[point["label"]]
        dots.append(
            f'<circle cx="{x:.2f}" cy="{y:.2f}" r="5" fill="{color}" opacity="0.9"><title>{escape(point["sample_name"])} ({escape(point["label"])})</title></circle>'
        )

    for index, (label, color) in enumerate(labels.items()):
        legend_y = 278 + index * 18
        legend.append(
            f'<circle cx="18" cy="{legend_y - 4}" r="5" fill="{color}"></circle><text x="32" y="{legend_y}" font-size="12" fill="#334155">{escape(label)}</text>'
        )

    return f"""
    <h3>PCA Scatter</h3>
    <svg viewBox="0 0 420 340" role="img" aria-label="PCA scatter plot">
      <line x1="40" y1="240" x2="380" y2="240" stroke="#94a3b8" stroke-width="1" />
      <line x1="40" y1="40" x2="40" y2="240" stroke="#94a3b8" stroke-width="1" />
      {''.join(dots)}
      {''.join(legend)}
    </svg>
    """
