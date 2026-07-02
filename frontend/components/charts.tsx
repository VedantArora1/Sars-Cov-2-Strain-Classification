import type { ReactNode } from "react";

type LabeledValue = {
  label: string;
  value: number;
};

type ScatterPoint = {
  sample_id: string;
  sample_name: string;
  label: string;
  pc1: number;
  pc2: number;
};

type TreeNode = {
  name: string;
  sample_id?: string | null;
  distance?: number | null;
  children?: TreeNode[];
};

type HeatmapPayload = {
  columns: string[];
  rows: Array<{
    sample_id: string;
    sample_name: string;
    values: number[];
  }>;
};

export function MiniBarChart({ items, empty }: { items: LabeledValue[]; empty: string }) {
  if (!items.length) {
    return <p>{empty}</p>;
  }

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="chart-list">
      {items.map((item) => (
        <div className="chart-row" key={item.label}>
          <div className="chart-meta">
            <span className="mono-value">{item.label}</span>
            <strong>{item.value}</strong>
          </div>
          <div className="chart-bar-track">
            <div className="chart-bar-fill" style={{ width: `${(item.value / maxValue) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ScatterPlot({ points }: { points: ScatterPoint[] }) {
  if (!points.length) {
    return <p>No PCA projection available.</p>;
  }

  const xs = points.map((point) => point.pc1);
  const ys = points.map((point) => point.pc2);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const normalize = (value: number, min: number, max: number) => {
    if (min === max) {
      return 50;
    }

    return 10 + ((value - min) / (max - min)) * 80;
  };

  return (
    <div className="scatter-shell">
      <svg className="scatter-plot" viewBox="0 0 100 100" aria-label="PCA scatter plot">
        <line x1="10" y1="90" x2="90" y2="90" className="scatter-axis" />
        <line x1="10" y1="10" x2="10" y2="90" className="scatter-axis" />
        {points.map((point) => {
          const x = normalize(point.pc1, minX, maxX);
          const y = 90 - normalize(point.pc2, minY, maxY) + 10;

          return (
            <g key={point.sample_id}>
              <circle className="scatter-dot" cx={x} cy={y} r="2.5" />
              <title>{`${point.sample_name} (${point.label})`}</title>
            </g>
          );
        })}
      </svg>
      <div className="scatter-legend">
        {points.map((point) => (
          <p className="data-line" key={`${point.sample_id}-legend`}>
            <span>{point.sample_name}</span>
            <strong>{`${point.pc1.toFixed(2)}, ${point.pc2.toFixed(2)}`}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}

export function HeatmapTable({ heatmap }: { heatmap: HeatmapPayload }) {
  if (!heatmap.columns.length || !heatmap.rows.length) {
    return <p>No mutation heatmap available.</p>;
  }

  return (
    <div className="heatmap-wrap">
      <table className="data-table heatmap-table">
        <thead>
          <tr>
            <th>Sample</th>
            {heatmap.columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {heatmap.rows.map((row) => (
            <tr key={row.sample_id}>
              <td>{row.sample_name}</td>
              {row.values.map((value, index) => (
                <td className={value ? "heatmap-cell is-active" : "heatmap-cell"} key={`${row.sample_id}-${index}`}>
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TreePanel({ tree }: { tree: TreeNode }) {
  return <div className="tree-panel">{renderTreeNode(tree)}</div>;
}

export function NewickBlock({ value }: { value: string }) {
  if (!value) {
    return <p>No Newick tree available.</p>;
  }

  return <pre className="newick-block">{value}</pre>;
}

function renderTreeNode(node: TreeNode): ReactNode {
  const hasChildren = Boolean(node.children?.length);
  return (
    <div className="tree-node">
      <p className="tree-label">
        <span>{node.name}</span>
        {typeof node.distance === "number" ? <strong>{node.distance.toFixed(4)}</strong> : null}
      </p>
      {hasChildren ? (
        <div className="tree-children">
          {node.children?.map((child) => (
            <div className="tree-branch" key={`${child.name}-${child.sample_id ?? "cluster"}`}>
              {renderTreeNode(child)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
