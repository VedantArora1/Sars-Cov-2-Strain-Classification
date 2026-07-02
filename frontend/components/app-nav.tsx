"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", detail: "Overview and operational pulse" },
  { href: "/jobs", label: "Run Archive", detail: "Past runs and generated reports" },
  { href: "/upload", label: "Upload Runs", detail: "Start new analysis batches" },
  { href: "/settings", label: "Settings", detail: "Account and workspace defaults" }
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname.startsWith(item.href);

        return (
          <Link className={isActive ? "is-active" : undefined} href={item.href} key={item.href}>
            <span className="nav-label">{item.label}</span>
            <span className="nav-detail">{item.detail}</span>
          </Link>
        );
      })}
    </nav>
  );
}
