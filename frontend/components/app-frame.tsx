"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppNav } from "./app-nav";

type AppFrameProps = {
  children: ReactNode;
  userName: string;
  username: string;
};

export function AppFrame({ children, userName, username }: AppFrameProps) {
  const pathname = usePathname();
  const displayName = userName || "Preview Analyst";
  const handleName = username ? `@${username}` : "@preview_analyst";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  if (pathname === "/" || pathname === "/register") {
    return <>{children}</>;
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand-block compact">
          <p className="eyebrow">BioPath</p>
          <h1>SARS-CoV-2 Intelligence</h1>
          <p className="sidebar-copy">Clinical genomic review workspace.</p>
        </div>

        <div className="sidebar-group">
          <p className="sidebar-section-label">Workspace</p>
          <AppNav />
        </div>

        <div className="sidebar-group sidebar-footer">
          <div className="sidebar-panel sidebar-panel-subtle">
            <p className="panel-label">Signed In</p>
            <p className="mono-value">{displayName}</p>
          </div>

          <div className="sidebar-panel sidebar-panel-subtle">
            <p className="panel-label">Reference</p>
            <p className="mono-value">NC_045512.2</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Genomic Surveillance Dashboard</p>
            <p className="topbar-title">Review uploaded sequences, job status, and mutation signals.</p>
          </div>
          <div className="topbar-actions">
            <details className="account-menu">
              <summary className="account-menu-trigger">
                <span className="account-avatar" aria-hidden="true">
                  {initials || "PA"}
                </span>
                <span className="account-meta">
                  <strong>{displayName}</strong>
                  <span>{handleName}</span>
                </span>
                <span className="account-caret" aria-hidden="true">
                  v
                </span>
              </summary>

              <div className="account-menu-panel">
                <div className="account-menu-header">
                  <p className="panel-label">Signed In</p>
                  <strong>{displayName}</strong>
                  <span>{handleName}</span>
                </div>

                <div className="account-menu-links">
                  <Link href="/settings" className="account-menu-link">
                    Account Settings
                  </Link>
                  <Link href="/jobs" className="account-menu-link">
                    Recent Runs
                  </Link>
                </div>

                <form action="/api/auth/logout" method="post">
                  <button className="button account-menu-button" type="submit">
                    Log Out
                  </button>
                </form>
              </div>
            </details>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
