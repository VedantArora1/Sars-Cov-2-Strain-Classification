import type { ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  className?: string;
  eyebrow?: string;
  title: ReactNode;
};

type MetricProps = {
  label: ReactNode;
  value: ReactNode;
};

type BadgeTone = "default" | "success" | "warning" | "danger";

export function DashboardCard({ children, className, eyebrow, title }: CardProps) {
  return (
    <article className={className ? `card ${className}` : "card"}>
      {eyebrow ? <p className="panel-label">{eyebrow}</p> : null}
      <h3>{title}</h3>
      {children}
    </article>
  );
}

export function MetricRow({ label, value }: MetricProps) {
  return (
    <p className="data-line">
      <span>{label}</span>
      <strong>{value}</strong>
    </p>
  );
}

export function StatusBadge({ children, tone = "default" }: { children: ReactNode; tone?: BadgeTone }) {
  const className = tone === "default" ? "badge" : `badge badge-${tone}`;

  return <span className={className}>{children}</span>;
}

export function classificationTone(label: string | null | undefined): BadgeTone {
  const normalized = (label ?? "").toLowerCase();

  if (normalized.includes("reference-like")) {
    return "success";
  }
  if (normalized.includes("alpha")) {
    return "success";
  }
  if (normalized.includes("delta")) {
    return "warning";
  }
  if (normalized.includes("omicron")) {
    return "danger";
  }
  return "default";
}
