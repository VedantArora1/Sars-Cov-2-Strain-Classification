"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { classificationTone, DashboardCard, MetricRow, StatusBadge } from "../../../components/dashboard";
import { getSample, type SampleDetail } from "../../../lib/api";

function getVariantDisplayLabel(variant?: { label: string; display_label?: string | null } | null): string {
  return variant?.display_label ?? variant?.label ?? "Not available";
}

export default function SampleDetailPage() {
  const params = useParams<{ sampleId: string }>();
  const sampleId = typeof params.sampleId === "string" ? params.sampleId : "";
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mutationPreview = sample?.mutations.slice(0, 25) ?? [];

  useEffect(() => {
    if (!sampleId) {
      return;
    }

    let ignore = false;

    async function loadSample() {
      try {
        const response = await getSample(sampleId);
        if (!ignore) {
          setSample(response);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the sample detail.");
        }
      }
    }

    loadSample();
    return () => {
      ignore = true;
    };
  }, [sampleId]);

  return (
    <main className="page-shell">
      <section className="section">
        <p className="eyebrow">Sample Inspection</p>
        <h2>Single-sequence analysis detail</h2>
        <p>This sample view shows QC notes, baseline classification, k-mer frequencies, mutation summaries, SNP spectrum, and a compact mutation table.</p>

        {error ? <p className="status">{error}</p> : null}
        {!sample ? <p className="status">Loading sample detail...</p> : null}

        {sample ? (
          <div className="results">
            <DashboardCard eyebrow="Overview" title={sample.sample_name} className="card-emphasis">
              <MetricRow label="Sequence length" value={`${sample.sequence_length} bases`} />
              <MetricRow label="QC status" value={<StatusBadge>{sample.qc_status}</StatusBadge>} />
              <MetricRow
                label="Reference match"
                value={sample.exact_reference_match ? "Exact NC_045512.2 match" : "Not an exact match"}
              />
              <MetricRow label="Sequence similarity" value={`${sample.sequence_similarity_percent.toFixed(3)}%`} />
              <MetricRow
                label="Pango lineage"
                value={
                  sample.classification ? (
                    <StatusBadge tone={classificationTone(sample.classification.predicted_label)}>
                      {`${sample.classification.predicted_label} (${sample.classification.confidence}%)`}
                    </StatusBadge>
                  ) : (
                    "Not available"
                  )
                }
              />
              <MetricRow
                label="Variant name"
                value={getVariantDisplayLabel(sample.classification?.variant_classification)}
              />
              {sample.classification?.rationale ? (
                <p>
                  Classifier rationale: {String(sample.classification.rationale.rule ?? "Not available")}
                  {Array.isArray(sample.classification.rationale.matched_signature_mutations) &&
                  sample.classification.rationale.matched_signature_mutations.length
                    ? ` Matched markers: ${sample.classification.rationale.matched_signature_mutations.join(", ")}.`
                    : ""}
                </p>
              ) : null}
              <p>QC notes: {sample.qc_notes.length ? sample.qc_notes.join(" | ") : "None"}</p>
            </DashboardCard>

            <DashboardCard eyebrow="Mutations" title="Mutation Summary">
              <MetricRow label="Total mutations" value={sample.mutation_summary.mutation_count ?? sample.mutations.length} />
              <MetricRow
                label="SNP / Ins / Del"
                value={`${sample.mutation_summary.mutation_types?.snp ?? 0} / ${sample.mutation_summary.mutation_types?.insertion ?? 0} / ${sample.mutation_summary.mutation_types?.deletion ?? 0}`}
              />
              <MetricRow
                label="Transitions / Transversions"
                value={`${sample.mutation_summary.transition_count ?? 0} / ${sample.mutation_summary.transversion_count ?? 0}`}
              />
            </DashboardCard>

            <DashboardCard eyebrow="K-mers" title="Top 3-mer Frequencies">
              {sample.top_kmers.length ? (
                sample.top_kmers.map((item) => (
                  <MetricRow key={item.kmer} label={<span className="mono-value">{item.kmer}</span>} value={item.count} />
                ))
              ) : (
                <p>No k-mer profile available.</p>
              )}
            </DashboardCard>

            <DashboardCard eyebrow="Feature Row" title="Mutation Matrix Row">
              <p className="mono-block">
                {Object.keys(sample.mutation_matrix_row).length
                  ? Object.entries(sample.mutation_matrix_row)
                      .slice(0, 20)
                      .map(([key, value]) => `${key}:${value}`)
                      .join(" | ")
                  : "No mutation features available."}
              </p>
            </DashboardCard>

            <DashboardCard eyebrow="Substitutions" title="SNP Spectrum">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Substitution</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(sample.snp_spectrum).length ? (
                      Object.entries(sample.snp_spectrum).map(([label, count]) => (
                        <tr key={label}>
                          <td>{label}</td>
                          <td>{count}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td>No SNP spectrum available</td>
                        <td>0</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </DashboardCard>

            <DashboardCard eyebrow="Mutation Table" title="Detected Mutations" className="card-span-full">
              {sample.mutations.length ? (
                <>
                  <p>
                    Showing {mutationPreview.length} of {sample.mutations.length} detected mutation(s).
                  </p>
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Mutation</th>
                          <th>Position</th>
                          <th>Reference</th>
                          <th>Alternate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mutationPreview.map((mutation) => (
                          <tr key={`${mutation.mutation_label}-${mutation.position}`}>
                            <td>{mutation.mutation_label}</td>
                            <td>{mutation.position}</td>
                            <td>{mutation.reference_base}</td>
                            <td>{mutation.alternate_base}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {sample.mutations.length > mutationPreview.length ? (
                    <p>
                      {sample.mutations.length - mutationPreview.length} additional mutations are hidden to keep the report readable.
                    </p>
                  ) : null}
                </>
              ) : (
                <p>No mutations detected against the loaded reference.</p>
              )}
            </DashboardCard>
          </div>
        ) : null}
      </section>
    </main>
  );
}
