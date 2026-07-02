import Link from "next/link";

import { classificationTone, StatusBadge } from "../../components/dashboard";
import { listJobs } from "../../lib/api";
import { getCurrentSession } from "../../lib/server-session";

type JobsPageProps = {
  searchParams?: Promise<{
    q?: string;
    status?: string;
  }>;
};

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const session = await getCurrentSession();
  const params = (await searchParams) ?? {};
  const query = params.q?.trim() ?? "";
  const status = params.status?.trim() ?? "";
  const jobs = await listJobs(50, { q: query || undefined, status: status || undefined }).catch(() => []);
  const visibleJobs = jobs.filter((job) => session.runIds.includes(job.job_id));

  return (
    <main className="page-shell">
      <section className="section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Run Archive</p>
            <h2>Your persisted SARS-CoV-2 analysis runs</h2>
            <p>Search only the jobs created within your current signed-in workspace.</p>
          </div>
          <Link href="/upload" className="button primary">
            Upload New Batch
          </Link>
        </div>

        <form className="filter-bar" action="/jobs" method="get">
          <label className="filter-field">
            <span className="panel-label">Search</span>
            <input defaultValue={query} name="q" placeholder="Job ID or sample name" type="text" />
          </label>
          <label className="filter-field">
            <span className="panel-label">Status</span>
            <select defaultValue={status} name="status">
              <option value="">All statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <div className="filter-actions">
            <button className="button" type="submit">
              Apply Filters
            </button>
            <Link className="button" href="/jobs">
              Reset
            </Link>
          </div>
        </form>

        {visibleJobs.length ? (
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
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => (
                  <tr key={job.job_id}>
                    <td className="mono-value">{job.job_id}</td>
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
                    <td>
                      <Link className="button" href={`/jobs/${job.job_id}`}>
                        View Report
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="status">No jobs matched the current filters for this user.</p>
        )}
      </section>
    </main>
  );
}
