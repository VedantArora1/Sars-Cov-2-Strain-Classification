import Link from "next/link";

import { classificationTone, StatusBadge } from "../../components/dashboard";
import { listJobs } from "../../lib/api";
import { getCurrentSession } from "../../lib/server-session";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  const jobs = await listJobs(50).catch(() => []);
  const isPreviewMode = !session.isAuthenticated;
  const visibleJobs = isPreviewMode ? jobs.slice(0, 8) : jobs.filter((job) => session.runIds.includes(job.job_id));
  const recentJobs = visibleJobs.slice(0, 8);
  const completedRuns = visibleJobs.filter((job) => job.status === "completed").length;
  const sampleVolume = visibleJobs.reduce((total, job) => total + job.sample_count, 0);
  const activeRuns = visibleJobs.filter((job) => job.status !== "completed").length;
  const completionRate = visibleJobs.length ? Math.round((completedRuns / visibleJobs.length) * 100) : 0;
  const latestRun = recentJobs[0];

  return (
    <main className="page-shell">
      <section className="hero dashboard-hero workspace-hero">
        <div className="hero-copy">
          <div>
            <p className="eyebrow">{isPreviewMode ? "Dashboard Preview" : "Workspace Overview"}</p>
            <h2>Sequencing operations dashboard</h2>
            <p className="section-copy">
              {isPreviewMode
                ? "Preview mode is temporarily bypassing login so you can inspect the main dashboard layout."
                : `Signed in as ${session.userName}. Review recent uploads, monitor job status, and reopen completed reports.`}
            </p>
          </div>
          <div className="summary-strip compact">
            <article className="metric-card">
              <p className="panel-label">Runs Tracked</p>
              <p className="metric-tile-value">{visibleJobs.length}</p>
            </article>
            <article className="metric-card">
              <p className="panel-label">Completion Rate</p>
              <p className="metric-tile-value">{completionRate}%</p>
            </article>
            <article className="metric-card">
              <p className="panel-label">Samples Reviewed</p>
              <p className="metric-tile-value">{sampleVolume}</p>
            </article>
          </div>
          <div className="actions hero-actions">
            <Link href="/upload" className="button primary">
              New Upload
            </Link>
            <Link href="/jobs" className="button">
              View All Runs
            </Link>
          </div>
        </div>

        <aside className="workspace-pulse">
          <p className="panel-label">Operational Pulse</p>
          <div className="pulse-metric">
            <span>In Progress</span>
            <strong>{activeRuns}</strong>
          </div>
          <div className="pulse-metric">
            <span>Completed</span>
            <strong>{completedRuns}</strong>
          </div>
          <div className="pulse-metric">
            <span>Latest Refresh</span>
            <strong>{latestRun ? new Date(latestRun.updated_at).toLocaleString() : "No runs yet"}</strong>
          </div>
          <p className="workspace-pulse-note">
            The dashboard now prioritizes one primary summary area instead of several equally weighted cards.
          </p>
        </aside>
      </section>

      <section className="summary-grid relaxed">
        <article className="metric-tile">
          <p className="panel-label">Completed</p>
          <p className="metric-tile-value">{completedRuns}</p>
          <p className="metric-tile-note">Ready for report review</p>
        </article>
        <article className="metric-tile">
          <p className="panel-label">In Progress</p>
          <p className="metric-tile-value">{activeRuns}</p>
          <p className="metric-tile-note">Awaiting processing or review</p>
        </article>
        <article className="metric-tile">
          <p className="panel-label">Reference</p>
          <p className="metric-tile-value metric-tile-value-small">NC_045512.2</p>
          <p className="metric-tile-note">Active baseline for all visible runs</p>
        </article>
      </section>

      <section className="section section-spaced">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Recent Runs</p>
            <h2>{isPreviewMode ? "Preview analysis history" : "Your analysis history"}</h2>
            <p className="section-copy">Focused run history with status, cohort size, and classification signals.</p>
          </div>
          <div className="actions">
            <Link href="/jobs" className="button">
              View All Runs
            </Link>
            <Link href="/upload" className="button">
              New Upload
            </Link>
          </div>
        </div>

        {recentJobs.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Samples</th>
                  <th>Reference</th>
                  <th>Classifications</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td>
                      <Link href={`/jobs/${job.job_id}`} className="mono-value table-link">
                        {job.job_id}
                      </Link>
                    </td>
                    <td>
                      <StatusBadge>{job.status}</StatusBadge>
                    </td>
                    <td>{job.sample_count}</td>
                    <td>{job.reference_accession ?? "NC_045512.2"}</td>
                    <td>
                      <div className="inline-badges">
                        {job.top_classifications.length ? (
                          job.top_classifications.map((label) => (
                            <StatusBadge key={label} tone={classificationTone(label)}>
                              {label}
                            </StatusBadge>
                          ))
                        ) : (
                          <span className="muted-copy">Pending</span>
                        )}
                      </div>
                    </td>
                    <td>{new Date(job.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <h3>{isPreviewMode ? "No preview runs available" : "No runs yet for this account"}</h3>
            <p>{isPreviewMode ? "Seed demo data or upload a FASTA batch to populate the dashboard preview." : "Upload a FASTA batch to create your first user-scoped analysis record."}</p>
            <Link href="/upload" className="button primary">
              Upload FASTA Files
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
