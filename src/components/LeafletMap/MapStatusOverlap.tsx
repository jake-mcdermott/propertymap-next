// src/components/map/MapStatusOverlay.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { fetchManifestClient } from "@/lib/fetchManifestClient";

type ManifestInfo = { updatedAt?: Date | null };

function formatRelative(d: Date) {
  const diff = Math.max(0, Date.now() - d.getTime());
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 45) return "just now";
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr${hr > 1 ? "s" : ""} ago`;
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MapStatusOverlay() {
  const [info, setInfo] = useState<ManifestInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await fetchManifestClient();
        if (!alive) return;
        setInfo(m ?? null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const rel = useMemo(
    () => (info?.updatedAt ? formatRelative(new Date(info.updatedAt)) : null),
    [info?.updatedAt]
  );
  const abs = info?.updatedAt ? new Date(info.updatedAt).toLocaleString() : undefined;

  // Shared container classes:
  // - Mobile: top-right (avoid bottom sheet)
  // - md+: bottom-left (original spot)
  const containerCls =
    "pointer-events-none absolute left-2 top-2 md:left-3 md:top-auto md:bottom-3 z-[1000] " +
    "md:z-[1000]"; // stays above bottom sheet (z-20) & tiles

  if (loading && !info) {
    return (
      <div className={containerCls} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
        <span className="inline-flex h-6 min-w-[124px] items-center rounded-md bg-black/70">
          <span className="mx-2 h-3 w-3 rounded-full bg-white/30 animate-pulse" />
          <span className="h-3 w-24 rounded bg-white/20 animate-pulse" />
        </span>
      </div>
    );
  }

  if (!rel) return null;

  return (
    <div className={containerCls} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
      <span
        className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-[12px] text-white shadow-md ring-1 ring-black/50"
        title={abs ? `Updated ${abs}` : undefined}
        aria-label={abs ? `Updated ${abs}` : undefined}
      >
        <Clock className="h-3.5 w-3.5 opacity-90" />
        Updated {rel}
      </span>
    </div>
  );
}
