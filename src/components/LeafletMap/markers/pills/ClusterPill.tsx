"use client";

export default function ClusterPill({
  count,
  highlighted = false,
}: {
  count: number;
  highlighted?: boolean;
}) {
  return (
    <div className={`pm-cluster-outer ${highlighted ? "is-highlighted" : ""}`}>
      <div className="pm-cluster-pill">{count}</div>
    </div>
  );
}
