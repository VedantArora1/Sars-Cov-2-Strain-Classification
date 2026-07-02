"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardCard, MetricRow, StatusBadge } from "../../components/dashboard";
import { AnalysisSubmissionError, createAnalysisJob, type JobResponse } from "../../lib/api";
import { rememberRun } from "../../lib/client-session";

type UploadErrorState = {
  message: string;
  when: string;
};

export default function UploadPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<JobResponse | null>(null);
  const [error, setError] = useState<UploadErrorState | null>(null);
  const [progressValue, setProgressValue] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isSubmitting) {
      setProgressValue(job ? 100 : 0);
      return;
    }

    setProgressValue((current) => (current > 12 ? current : 12));

    const interval = window.setInterval(() => {
      setProgressValue((current) => (current >= 92 ? current : current + 8));
    }, 420);

    return () => window.clearInterval(interval);
  }, [isSubmitting, job]);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setJob(null);
    setProgressValue(0);

    if (files.length === 0) {
      setError({
        message: "Choose at least one FASTA file.",
        when: "This happens before submission if no FASTA file is selected."
      });
      return;
    }

    setIsSubmitting(true);

    void (async () => {
      try {
        const response = await createAnalysisJob(files);
        await rememberRun(response.job_id);
        setProgressValue(100);
        setJob(response);
      } catch (submissionError) {
        const fallback = "Unable to submit the analysis job.";
        if (submissionError instanceof AnalysisSubmissionError) {
          const when =
            submissionError.stage === "submission"
              ? "This happened while sending the FASTA batch to the analysis server."
              : submissionError.stage === "processing"
                ? "This happened after the batch was accepted and the analysis pipeline started running."
                : "This happened after processing finished, while loading the sample results.";
          setError({
            message: submissionError.message,
            when
          });
        } else {
          setError({
            message: submissionError instanceof Error ? submissionError.message : fallback,
            when: "This happened during the FASTA analysis request."
          });
        }
        setProgressValue(0);
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  return (
    <main className="page-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Upload Runs</p>
          <h2>Submit FASTA files for reference-based analysis</h2>
          <p className="section-copy">
            Queue one or more FASTA files for validation, mutation extraction, and QC review
            against the SARS-CoV-2 reference genome NC_045512.2.
          </p>
        </div>
      </section>

      <section className="upload-layout">
        <article className="section upload-brief">
          <p className="panel-label">Run Profile</p>
          <h3>Analysis pipeline</h3>
          <div className="settings-list">
            <div className="settings-row">
              <span>Reference</span>
              <strong>NC_045512.2</strong>
            </div>
            <div className="settings-row">
              <span>Accepted formats</span>
              <strong>FASTA batch upload</strong>
            </div>
            <div className="settings-row">
              <span>Outputs</span>
              <strong>QC, mutations, reports</strong>
            </div>
            <div className="settings-row">
              <span>Layout intent</span>
              <strong>Focused summary, then drill-down</strong>
            </div>
          </div>
        </article>

        <div className="upload-box">
          <form onSubmit={onSubmit}>
            <label className="upload-field">
              <span className="panel-label">FASTA Batch</span>
              <input
                type="file"
                accept=".fa,.fasta,.fna,.txt"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              <span className="upload-hint">
                Accepted formats: `.fa`, `.fasta`, `.fna`, `.txt` with one or multiple genomic sequences.
              </span>
            </label>
            {files.length ? (
              <div className="file-list">
                {files.map((file) => (
                  <span className="chip" key={`${file.name}-${file.size}`}>
                    {file.name}
                  </span>
                ))}
              </div>
            ) : null}
            <div className="progress-panel" aria-live="polite">
              <div className="progress-copy">
                <div>
                  <p className="panel-label">Processing State</p>
                  <strong>
                    {isSubmitting
                      ? "Generating analysis outputs"
                      : error
                        ? "Submission failed"
                        : job
                          ? "Analysis complete"
                          : "Waiting for submission"}
                  </strong>
                </div>
                <span className="mono-value">{progressValue}%</span>
              </div>
              <div className="progress-track" aria-hidden="true">
                <div className="progress-fill" style={{ width: `${progressValue}%` }} />
              </div>
              <p className="upload-hint">
                {isSubmitting
                  ? "Validating FASTA files, extracting mutations, and preparing the visual report."
                  : error
                    ? error.when
                  : "Submit a batch to start QC, mutation discovery, and report generation."}
              </p>
            </div>
            <button className="button primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Generating Report..." : "Run MVP Analysis"}
            </button>
          </form>
        </div>
      </section>

      {error ? (
        <div className="status status-error" role="alert">
          <strong>Error:</strong> {error.message}
          <br />
          <span>{error.when}</span>
        </div>
      ) : null}

      {job ? (
        <section className="section section-spaced">
          <div className="result-header">
            <div>
              <p className="eyebrow">Run Complete</p>
              <h2>Analysis batch processed successfully</h2>
              <p className="section-copy">
                Job <span className="mono-value">{job.job_id}</span> completed with {job.sample_count} sample(s).
              </p>
            </div>
            <div className="actions">
              <Link className="button primary" href={`/jobs/${job.job_id}`}>
                View Job Report
              </Link>
            </div>
          </div>

          <div className="sample-results-grid">
            {job.samples.map((sample) => (
              <DashboardCard
                key={`${sample.sample_name}-${sample.fasta_header}`}
                title={sample.sample_name}
                eyebrow="Sample Summary"
                className="sample-result-card"
              >
                <div className="settings-list">
                  <div className="settings-row">
                    <span>Sequence length</span>
                    <strong>{sample.sequence_length} bases</strong>
                  </div>
                  <div className="settings-row">
                    <span>QC status</span>
                    <strong><StatusBadge>{sample.qc_status}</StatusBadge></strong>
                  </div>
                  <div className="settings-row">
                    <span>Detected mutations</span>
                    <strong>{sample.mutation_count}</strong>
                  </div>
                </div>
                <p className="sample-notes">QC notes: {sample.qc_notes.length ? sample.qc_notes.join(" | ") : "None"}</p>
                <Link className="button" href={`/samples/${sample.sample_id}`}>
                  Inspect Sample
                </Link>
              </DashboardCard>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
