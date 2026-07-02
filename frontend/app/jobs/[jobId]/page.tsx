"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { HeatmapTable, MiniBarChart, NewickBlock, ScatterPlot, TreePanel } from "../../../components/charts";
import { classificationTone, DashboardCard, MetricRow, StatusBadge } from "../../../components/dashboard";
import { getJob, getJobAnalytics, getJobReport, getJobSamples, type JobAnalytics, type JobReport, type JobSummary, type UploadedSample } from "../../../lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/backend";

function getVariantDisplayLabel(variant?: { label: string; display_label?: string | null } | null): string {
  return variant?.display_label ?? variant?.label ?? "Pending";
}

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const jobId = typeof params.jobId === "string" ? params.jobId : "";
  const [job, setJob] = useState<JobSummary | null>(null);
  const [samples, setSamples] = useState<UploadedSample[]>([]);
  const [report, setReport] = useState<JobReport | null>(null);
  const [analytics, setAnalytics] = useState<JobAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(10);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let ignore = false;

    async function loadJobData() {
      try {
        const [jobResponse, sampleResponse, reportResponse, analyticsResponse] = await Promise.all([
          getJob(jobId),
          getJobSamples(jobId),
          getJobReport(jobId),
          getJobAnalytics(jobId)
        ]);

        if (!ignore) {
          setJob(jobResponse);
          setSamples(sampleResponse);
          setReport(reportResponse);
          setAnalytics(analyticsResponse);
          setLoadingProgress(100);
        }
      } catch (loadError) {
        if (!ignore) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load the job report.");
          setLoadingProgress(0);
        }
      }
    }

    loadJobData();
    return () => {
      ignore = true;
    };
  }, [jobId]);

  const isLoading = !job || !report || !analytics;

  useEffect(() => {
    if (!jobId || !isLoading) {
      return;
    }

    const interval = window.setInterval(() => {
      setLoadingProgress((current) => (current >= 92 ? current : current + 7));
    }, 280);

    return () => window.clearInterval(interval);
  }, [isLoading, jobId]);

  const reportHighlights = useMemo(() => {
    if (!report || !analytics) {
      return [];
    }

    const leadClassification = analytics.classification_distribution[0];
    const leadMutation = analytics.mutation_frequency[0];

    return [
      {
        label: "Dominant variant",
        value: leadClassification ? `${leadClassification.label} (${leadClassification.value})` : "Pending"
      },
      {
        label: "Most recurrent mutation",
        value: leadMutation ? `${leadMutation.label} (${leadMutation.value})` : "Pending"
      },
      {
        label: "Variable sites",
        value: analytics.consensus_summary.variable_site_count
      },
      {
        label: "Consensus length",
        value: analytics.consensus_summary.consensus_length
      }
    ];
  }, [analytics, report]);

  const sampleSimilarityById = useMemo(() => {
    const entries = report?.samples.map((sample) => [sample.sample_id, sample.sequence_similarity_percent] as const) ?? [];
    return new Map(entries);
  }, [report]);

  return (
    <main className="page-shell">
      <section className="section">
        <p className="eyebrow">Run Report</p>
        <h2>Batch analysis summary</h2>
        <p>The job report summarizes the uploaded batch, QC status, baseline classification, sequence similarity, recurrent mutations, and analysis outputs.</p>

        {error ? <p className="status">{error}</p> : null}
        {isLoading ? (
          <div className="loading-panel" aria-live="polite">
            <div className="progress-copy">
              <div>
                <p className="panel-label">Generating Report View</p>
                <strong>Collecting summary metrics, charts, and sample-level signals</strong>
              </div>
              <span className="mono-value">{loadingProgress}%</span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${loadingProgress}%` }} />
            </div>
          </div>
        ) : null}

        {job && report && analytics ? (
          <div className="report-stack">
            <section className="hero report-hero">
              <div className="hero-copy">
                <div>
                  <p className="eyebrow">Run Identifier</p>
                  <h2 className="mono-heading">{job.job_id}</h2>
                  <p className="section-copy">
                    A calmer report layout that surfaces the cohort story first, then opens into visuals and deeper sample inspection.
                  </p>
                </div>
                <div className="actions hero-actions">
                  <a className="button" href={`${API_BASE_URL}/jobs/${jobId}/report/html`} target="_blank" rel="noreferrer">
                    Open HTML Report
                  </a>
                  <a className="button" href={`${API_BASE_URL}/jobs/${jobId}/report/json`} target="_blank" rel="noreferrer">
                    Export JSON
                  </a>
                </div>
              </div>

              <aside className="workspace-pulse">
                <p className="panel-label">Run Status</p>
                <div className="pulse-metric">
                  <span>Status</span>
                  <strong><StatusBadge>{job.status}</StatusBadge></strong>
                </div>
                <div className="pulse-metric">
                  <span>Generated</span>
                  <strong>{new Date(report.generated_at).toLocaleString()}</strong>
                </div>
                <div className="pulse-metric">
                  <span>Reference</span>
                  <strong>{report.summary.reference_accession ?? "NC_045512.2"}</strong>
                </div>
              </aside>
            </section>

            <section className="report-overview-grid">
              <DashboardCard eyebrow="Overview" title="Cohort Snapshot" className="card-emphasis">
                <MetricRow label="Samples" value={report.summary.sample_count} />
                <MetricRow label="Warnings" value={report.summary.warning_sample_count} />
                <MetricRow label="Exact matches" value={report.summary.exact_reference_match_count ?? 0} />
                <MetricRow label="Total mutations" value={report.summary.total_detected_mutations} />
              </DashboardCard>

              <DashboardCard eyebrow="Highlights" title="Primary Signals">
                <div className="insight-list">
                  {reportHighlights.map((item) => (
                    <p className="data-line" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </p>
                  ))}
                </div>
              </DashboardCard>

              <DashboardCard eyebrow="Consensus" title="Sequence Preview">
                <MetricRow label="Consensus length" value={analytics.consensus_summary.consensus_length} />
                <MetricRow label="Variable sites" value={analytics.consensus_summary.variable_site_count} />
                <p className="mono-block">
                  {analytics.consensus_summary.consensus_sequence_preview || "No consensus preview available."}
                </p>
              </DashboardCard>
            </section>

            <section className="section section-spaced">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Visual Summary</p>
                  <h2>Distribution and mutation signals</h2>
                  <p className="section-copy">The highest-signal cohort trends sit together here so the report feels like a guided read instead of a wall of unrelated cards.</p>
                </div>
              </div>
              <div className="results report-signals-grid">
                <DashboardCard eyebrow="Summary" title="Variant Distribution">
                  <MiniBarChart items={analytics.classification_distribution} empty="No classification counts available." />
                </DashboardCard>

                <DashboardCard eyebrow="Signal" title="Top Recurrent Mutations">
                  <MiniBarChart items={analytics.mutation_frequency} empty="No recurrent mutations available." />
                </DashboardCard>

                <DashboardCard eyebrow="SNP Spectrum" title="Substitution Frequency">
                  <MiniBarChart items={analytics.snp_frequency} empty="No SNP frequency data available." />
                </DashboardCard>

                <DashboardCard eyebrow="K-mer Profile" title="Cohort 3-mer Frequency">
                  <MiniBarChart items={analytics.kmer_frequency} empty="No k-mer frequency data available." />
                </DashboardCard>
              </div>
            </section>

            <section className="section section-spaced">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Sample Review</p>
                  <h2>Sample overview and narrative</h2>
                  <p className="section-copy">Dense card stacks have been replaced here with a compact table plus concise narrative cards.</p>
                </div>
              </div>

              <DashboardCard eyebrow="Samples" title="Sample Overview" className="card-span-full">
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Sample</th>
                        <th>QC</th>
                        <th>Pango lineage</th>
                        <th>Variant name</th>
                        <th>Similarity</th>
                        <th>Mutations</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samples.map((sample) => (
                        <tr key={sample.sample_id}>
                          <td>{sample.sample_name}</td>
                          <td><StatusBadge>{sample.qc_status}</StatusBadge></td>
                          <td>
                            <StatusBadge tone={classificationTone(sample.predicted_label)}>
                              {sample.predicted_label ?? "Pending"}
                            </StatusBadge>
                          </td>
                          <td>{getVariantDisplayLabel(sample.variant_classification)}</td>
                          <td>{sampleSimilarityById.has(sample.sample_id) ? `${sampleSimilarityById.get(sample.sample_id)?.toFixed(3)}%` : "N/A"}</td>
                          <td>{sample.mutation_count}</td>
                          <td>
                            <Link className="button" href={`/samples/${sample.sample_id}`}>
                              Open Sample Detail
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </DashboardCard>

              <div className="report-narrative-grid">
                {report.samples.map((sample) => (
                  <div className="sample-card report-narrative-card" key={sample.sample_id}>
                    <p><strong>{sample.sample_name}</strong></p>
                    <p>
                      Pango lineage: {sample.classification ? `${sample.classification.predicted_label} (${sample.classification.confidence}%)` : "Pending"}
                    </p>
                    <p>
                      Variant name: {getVariantDisplayLabel(sample.classification?.variant_classification) || "Not available"}
                    </p>
                    <p>
                      Similarity {sample.sequence_similarity_percent.toFixed(3)}%
                      {" | "}
                      {sample.exact_reference_match ? "Exact reference match" : "Variant signal detected"}
                    </p>
                    <p>Top k-mers: {sample.top_kmers.length ? sample.top_kmers.map((item) => `${item.kmer}:${item.count}`).join(" | ") : "Not available"}</p>
                    <p>QC notes: {sample.qc_notes.length ? sample.qc_notes.join(" | ") : "None"}</p>
                    <p>
                      Mutation summary: {sample.top_mutations.length ? sample.top_mutations.map((item) => item.mutation_label).join(", ") : "None detected"}
                      {sample.remaining_mutation_count > 0 ? `, and ${sample.remaining_mutation_count} more` : ""}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="section section-spaced">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Cohort Visuals</p>
                  <h2>Spatial, phylogenetic, and mutation views</h2>
                  <p className="section-copy">These views are grouped together so the report shifts cleanly from summary into deeper evidence.</p>
                </div>
              </div>

              <div className="results">
                <DashboardCard eyebrow="Ordination" title="PCA Projection" className="card-span-full">
                  <ScatterPlot points={analytics.pca_projection} />
                </DashboardCard>

                <DashboardCard eyebrow="Evolution" title="Phylogenetic Tree" className="card-span-full">
                  <TreePanel tree={analytics.phylogenetic_tree} />
                </DashboardCard>

                <DashboardCard eyebrow="Tree Export" title="Newick Representation" className="card-span-full">
                  <NewickBlock value={analytics.phylogenetic_newick} />
                </DashboardCard>

                <DashboardCard eyebrow="Clusters" title="Lineage Cluster Summary">
                  {analytics.cluster_summary.length ? (
                    analytics.cluster_summary.map((cluster) => (
                      <div className="sample-card" key={cluster.label}>
                        <p><strong>{cluster.label}</strong></p>
                        <MetricRow label="Samples" value={cluster.sample_count} />
                        <MetricRow label="Avg similarity" value={`${cluster.average_similarity_percent.toFixed(3)}%`} />
                        <p>Members: {cluster.sample_names.join(", ")}</p>
                      </div>
                    ))
                  ) : (
                    <p>No cluster summary available.</p>
                  )}
                </DashboardCard>

                <DashboardCard eyebrow="Variability" title="High-Variability Sites" className="card-span-full">
                  {analytics.consensus_summary.high_variability_sites.length ? (
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Position</th>
                            <th>Consensus</th>
                            <th>Base Counts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.consensus_summary.high_variability_sites.map((site) => (
                            <tr key={site.position}>
                              <td>{site.position}</td>
                              <td>{site.consensus_base}</td>
                              <td>
                                {Object.entries(site.base_counts)
                                  .map(([base, count]) => `${base}:${count}`)
                                  .join(" | ")}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p>No high-variability sites detected.</p>
                  )}
                </DashboardCard>

                <DashboardCard eyebrow="Mutation Matrix" title="Heatmap View" className="card-span-full">
                  <HeatmapTable heatmap={analytics.mutation_heatmap} />
                </DashboardCard>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
