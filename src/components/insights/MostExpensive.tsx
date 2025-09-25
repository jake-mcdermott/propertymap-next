// components/insights/MostExpensive.tsx
"use client";

import React from "react";

const fmt = (n?: number | null) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");

export type ListingType = "sale" | "rent";

type Row = {
  id?: string | null;
  title?: string | null;
  address?: string | null;
  county: string | null;
  rk: string | null;
  price: number;
  url: string | null;
  image: string | null;
};

function titleCase(s?: string | null) {
  return (s || "").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

function normUrl(u?: string | null) {
  if (!u) return null;
  try {
    const x = new URL(u);
    x.search = "";
    x.hash = "";
    const host = x.host.replace(/^www\./, "").toLowerCase();
    return `${x.protocol}//${host}${x.pathname}`.replace(/\/+$/, "");
  } catch {
    return u.trim();
  }
}

function buildTop(rows: Row[], limit = 120): Row[] {
  if (!rows?.length) return [];
  const best = new Map<string, Row>();

  for (const r of rows) {
    if (!Number.isFinite(r.price) || (r.price as number) <= 0) continue;

    const url = normUrl(r.url);
    const titleNorm = (r.title || r.address || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
    const key = r.id || url || `${r.rk ?? ""}|${r.price}|${titleNorm.slice(0, 80)}`;

    const prev = best.get(key);
    if (!prev) {
      best.set(key, { ...r, url });
      continue;
    }
    // keep the higher price; otherwise merge missing bits
    if (r.price > prev.price) {
      best.set(key, {
        ...r,
        url: url ?? prev.url,
        image: r.image ?? prev.image,
        title: r.title ?? prev.title,
        address: r.address ?? prev.address,
      });
    } else {
      if (!prev.url && url) prev.url = url;
      if (!prev.image && r.image) prev.image = r.image;
      if (!prev.title && r.title) prev.title = r.title;
      if (!prev.address && r.address) prev.address = r.address;
      best.set(key, prev);
    }
  }

  return Array.from(best.values())
    .sort((a, b) => (b.price || 0) - (a.price || 0))
    .slice(0, limit);
}

export default function MostExpensive({
  counties,
  type,
  liveRows,
  limit = 120,
}: {
  counties: string[];
  type: ListingType;
  liveRows: Row[];      // <-- pass from InsightsClient
  limit?: number;
}) {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [mx, setMx] = React.useState(10); // “See more”: +10 each time

  React.useEffect(() => {
    setRows(buildTop(liveRows, limit));
    setMx(10); // reset pagination on filter/type change
  }, [liveRows, limit, type, counties.join(",")]);

  return (
    <section className="mt-6 md:mt-8 rounded-xl border border-neutral-800 bg-neutral-900">
      <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Most Expensive Listings</h2>
        <span className="text-xs text-neutral-400">
          Showing {Math.min(mx, rows.length)} of {rows.length}
        </span>
      </div>

      <div className="relative overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-neutral-900 sticky top-0">
            <tr className="border-b border-neutral-800">
              <th className="text-left px-3 py-2 text-neutral-300 font-medium w-10">#</th>
              <th className="text-left px-3 py-2 text-neutral-300 font-medium">Listing</th>
              <th className="text-left px-3 py-2 text-neutral-300 font-medium">County</th>
              <th className="text-left px-3 py-2 text-neutral-300 font-medium">RK</th>
              <th className="text-left px-3 py-2 text-neutral-300 font-medium">Price</th>
              <th className="text-left px-3 py-2 text-neutral-300 font-medium w-28">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, mx).map((r, i) => (
              <tr key={`${r.id || r.url || i}`} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                <td className="px-3 py-2 text-neutral-400">{i + 1}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    {/* thumbnail */}
                    {r.image ? (
                      <a href={r.url ?? undefined} target="_blank" rel="noopener noreferrer" className="hidden sm:block">
                        <img
                          src={r.image}
                          alt={r.title || r.address || ""}
                          className="h-12 w-20 rounded object-cover border border-neutral-800"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                        />
                      </a>
                    ) : (
                      <div className="h-12 w-20 rounded border border-neutral-800 bg-neutral-850 hidden sm:block" />
                    )}
                    {/* single, bigger line */}
                    <div className="min-w-0">
                      <a
                        href={r.url ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-neutral-100 hover:text-white font-semibold text-sm md:text-base leading-snug line-clamp-2"
                        title={r.title || r.address || undefined}
                      >
                        {r.title || r.address || "—"}
                      </a>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-neutral-200">{titleCase(r.county)}</td>
                <td className="px-3 py-2 text-neutral-200">{r.rk ?? "—"}</td>
                <td className="px-3 py-2 text-neutral-100 whitespace-nowrap">{fmt(r.price)}</td>
                <td className="px-3 py-2">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-neutral-200 hover:text-neutral-50 underline underline-offset-2"
                    >
                      Open
                    </a>
                  ) : (
                    <span className="text-neutral-500">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="px-3 py-3 text-neutral-500">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {rows.length > 0 && rows.length > mx && (
        <div className="px-4 py-3 flex justify-center">
          <button
            type="button"
            onClick={() => setMx((v) => v + 10)}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700"
          >
            See {Math.min(10, rows.length - mx)} more
          </button>
        </div>
      )}
    </section>
  );
}
