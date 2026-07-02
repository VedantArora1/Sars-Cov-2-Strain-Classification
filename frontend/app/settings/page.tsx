import { getCurrentSession } from "../../lib/server-session";
import { SettingsForms } from "../../components/settings-forms";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  const memberSince = session.createdAt
    ? new Date(session.createdAt).toLocaleDateString()
    : "Preview mode";

  return (
    <main className="page-shell">
      <section className="workspace-header">
        <div>
          <p className="eyebrow">Settings</p>
          <h2>Account and workspace preferences</h2>
          <p className="section-copy">
            Manage account information, security defaults, and review preferences for the analysis
            workspace.
          </p>
        </div>
      </section>

      <section className="settings-shell">
        <aside className="settings-sidebar">
          <div className="settings-profile-card">
            <p className="panel-label">Account</p>
            <h3>{session.userName || "Preview Analyst"}</h3>
            <p className="settings-username">@{session.username || "preview_analyst"}</p>
            <div className="settings-profile-meta">
              <span>{session.isAuthenticated ? "Signed in" : "Preview mode"}</span>
              <span>Member since {memberSince}</span>
            </div>
          </div>
        </aside>

        <div className="settings-content">
          <SettingsForms
            canEdit={session.isAuthenticated}
            displayName={session.userName || "Preview Analyst"}
            username={session.username || "preview_analyst"}
          />

          <article className="section">
            <p className="panel-label">Preferences</p>
            <h3>Dashboard and analysis defaults</h3>
            <div className="settings-list">
              <div className="settings-row">
                <span>Default reference</span>
                <strong>NC_045512.2</strong>
              </div>
              <div className="settings-row">
                <span>Runs shown</span>
                <strong>Latest first</strong>
              </div>
              <div className="settings-row">
                <span>Sample detail density</span>
                <strong>Compact</strong>
              </div>
              <div className="settings-row">
                <span>Report export</span>
                <strong>JSON + HTML</strong>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
