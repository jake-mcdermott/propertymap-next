"use client";

import React from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InsightsSidebar, { type ListingType } from "./Sidebar";
import MostExpensive from "@/components/insights/MostExpensive";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";

const RoutingMap = dynamic(() => import("./RoutingMap"), { ssr: false });

type AvgRow = { rk: string; county: string | null; avg: number; count: number; lat?: number | null; lng?: number | null };
type LiveRow = { id?: string | null; title?: string | null; address?: string | null; price: number; county: string | null; rk: string | null; url: string | null; image: string | null };

const countiesAll = [
  "Carlow","Cavan","Clare","Cork","Donegal","Dublin","Galway","Kerry","Kildare","Kilkenny",
  "Laois","Leitrim","Limerick","Longford","Louth","Mayo","Meath","Monaghan","Offaly","Roscommon",
  "Sligo","Tipperary","Waterford","Westmeath","Wexford","Wicklow",
];

const DEFAULT_COUNTIES = ["Dublin", "Kildare", "Meath"];
const fmt = (n: number | null | undefined) => (n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE"));
const numFmt = (n: number) => n.toLocaleString("en-IE");

function weightedMedian(rows: AvgRow[]): number | null {
  if (!rows.length) return null;
  const total = rows.reduce((a, r) => a + r.count, 0);
  if (total <= 0) return null;
  const sorted = [...rows].sort((a, b) => a.avg - b.avg);
  let acc = 0;
  const mid = total / 2;
  for (const r of sorted) {
    acc += r.count;
    if (acc >= mid) return r.avg;
  }
  return sorted[sorted.length - 1].avg;
}

const titleCase = (s?: string | null) =>
  (s ?? "—").replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

const medianListing = (rows: LiveRow[]): LiveRow | null => {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const mid = Math.floor((sorted.length - 1) / 2); // lower middle if even
  return sorted[mid];
};

export default function InsightsClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // URL → state
  const initCounties = React.useMemo(() => {
    const raw = searchParams.get("counties");
    if (!raw) return DEFAULT_COUNTIES;
    const arr = raw.split(",").map((s) => s.trim()).filter((c) => countiesAll.includes(c));
    return arr.length ? arr : DEFAULT_COUNTIES;
  }, [searchParams]);
  const initType = ((searchParams.get("type") ?? "sale") as ListingType);

  const [selectedCounties, setSelectedCounties] = React.useState<string[]>(initCounties);
  const [type, setType] = React.useState<ListingType>(initType === "rent" ? "rent" : "sale");
  const [isCountyDropdownOpen, setIsCountyDropdownOpen] = React.useState<boolean>(true);

  // RK aggregates for map/table
  const [avgRows, setAvgRows] = React.useState<AvgRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string>("");

  // Live listing rows (for true median / min / max)
  const [liveRows, setLiveRows] = React.useState<LiveRow[]>([]);
  const [liveErr, setLiveErr] = React.useState<string>("");
  const [liveLoading, setLiveLoading] = React.useState<boolean>(true);

  // One flag to rule them all
  const isBusy = loading || liveLoading;

  // Push to URL
  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (selectedCounties.length) sp.set("counties", selectedCounties.join(","));
    if (type) sp.set("type", type);
    const next = `${pathname}?${sp.toString()}`;
    const current = `${pathname}?${searchParams.toString()}`;
    if (next !== current) router.replace(next, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCounties.join(","), type]);

  // Fetch averages (live) — drives the map
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const params = new URLSearchParams();
        params.set("type", type);
        if (selectedCounties.length) params.set("counties", selectedCounties.join(","));
        const res = await fetch(`/api/map-averages?${params.toString()}`, { next: { revalidate: 300 } });
        if (!res.ok) throw new Error("Failed to load map averages");
        const rows: AvgRow[] = await res.json();
        if (!cancelled) setAvgRows(rows);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Error loading data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCounties.join(","), type]);

  // Fetch full live rows (true median/min/max)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLiveLoading(true);
      try {
        setLiveErr("");
        const params = new URLSearchParams();
        if (selectedCounties.length) params.set("counties", selectedCounties.join(","));
        params.set("limit", "0"); // 0 = no cap
        const res = await fetch(`/api/live-listings?${params.toString()}`, { next: { revalidate: 120 } });
        if (!res.ok) throw new Error("Failed to load live listings");
        const data: LiveRow[] = await res.json();
        if (!cancelled) setLiveRows(data.filter(r => Number.isFinite(r.price)));
      } catch (e: any) {
        if (!cancelled) setLiveErr(e?.message || "Error loading live listings");
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCounties.join(",")]);

  // “See more” handling for table
  const [expanded, setExpanded] = React.useState(false);
  const MAX_ROWS = 10;
  const limitedRows = React.useMemo(() => {
    const cap = Math.min(50, avgRows.length);
    return expanded ? avgRows.slice(0, cap) : avgRows.slice(0, Math.min(MAX_ROWS, cap));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avgRows, expanded]);
  const remaining = Math.max(0, Math.min(50, avgRows.length) - Math.min(MAX_ROWS, avgRows.length));

  // Core metrics (map-level aggregates)
  const metrics = React.useMemo(() => {
    if (!avgRows.length) {
      return {
        totalListings: 0,
        weightedAvg: null as number | null,
        weightedMed: null as number | null,
        rkCount: 0,
      };
    }
    const totalListings = avgRows.reduce((a, r) => a + r.count, 0);
    const weightedAvg =
      totalListings > 0
        ? avgRows.reduce((a, r) => a + r.avg * r.count, 0) / totalListings
        : null;
    const weightedMed = weightedMedian(avgRows);
    const rkCount = avgRows.length;
    return { totalListings, weightedAvg, weightedMed, rkCount };
  }, [avgRows]);

  // True median/min/max from liveRows
  const med = React.useMemo(() => medianListing(liveRows), [liveRows]);
  const minMax = React.useMemo(() => {
    if (!liveRows.length) return { min: null as LiveRow | null, max: null as LiveRow | null };
    let min = liveRows[0], max = liveRows[0];
    for (const r of liveRows) {
      if (r.price < min.price) min = r;
      if (r.price > max.price) max = r;
    }
    return { min, max };
  }, [liveRows]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* Global slim progress bar */}
      <div
        className={`fixed left-0 right-0 top-[var(--header-height,0px)] h-[2px] z-30 transition-opacity duration-200 ${
          isBusy ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden={!isBusy}
      >
        <div className="h-full w-full bg-gradient-to-r from-[#fb923c] via-[#f97316] to-[#ea580c] animate-[progress_1.2s_ease-in-out_infinite]" />
      </div>
      <style jsx global>{`
        @keyframes progress {
          0% { transform: translateX(-60%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(60%); }
        }
      `}</style>

      {/* Desktop sidebar */}
      <div className="hidden lg:block lg:w-[360px] shrink-0">
        <div className="lg:sticky lg:top-4">
          <InsightsSidebar
            counties={countiesAll}
            selectedCounties={selectedCounties}
            setSelectedCounties={setSelectedCounties}
            type={type}
            setType={setType}
            isOpen={isCountyDropdownOpen}
            setIsOpen={setIsCountyDropdownOpen}
            isLoading={isBusy}
            error={err || liveErr}
          />
        </div>
      </div>

      {/* Mobile filter bar */}
      <div className="lg:hidden top-[calc(var(--header-height,64px))] z-20 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2 bg-neutral-900/90 backdrop-blur border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-400 flex-1 truncate">
            {selectedCounties.length ? selectedCounties.join(", ") : "No counties selected"}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <SlidersHorizontal className="mr-1" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[92vw] sm:max-w-[420px] p-0 bg-neutral-900 border-neutral-800">
              <SheetHeader className="px-4 py-3 border-b border-neutral-800">
                <SheetTitle className="text-sm">Filters</SheetTitle>
              </SheetHeader>
              <div className="p-3">
                <InsightsSidebar
                  counties={countiesAll}
                  selectedCounties={selectedCounties}
                  setSelectedCounties={setSelectedCounties}
                  type={type}
                  setType={setType}
                  isOpen={isCountyDropdownOpen}
                  setIsOpen={setIsCountyDropdownOpen}
                  isLoading={isBusy}
                  error={err || liveErr}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main panel */}
      <main className="flex-1 min-w-0">
        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">Average Prop. Price</div>
            <div className="mt-1 text-xl md:text-2xl font-semibold">{fmt(metrics.weightedAvg)}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">Median Prop. Price</div>
            <div className="mt-1 text-xl md:text-2xl font-semibold">{fmt(med?.price ?? null)}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">Total Listings</div>
            <div className="mt-1 text-xl md:text-2xl font-semibold">{numFmt(metrics.totalListings)}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">Min Property Price</div>
            <div className="mt-1 text-xl md:text-2xl font-semibold">{fmt(minMax.min?.price ?? null)}</div>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="text-[11px] uppercase tracking-wide text-neutral-400">Max Property Price</div>
            <div className="mt-1 text-xl md:text-2xl font-semibold">{fmt(minMax.max?.price ?? null)}</div>
          </div>
        </section>

        {/* Map */}
        <section className="mt-6 md:mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-3 md:p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Eircode Heat Map</h2>
            {!isBusy && !err ? (
              <span className="text-xs text-neutral-400">{metrics.rkCount} areas</span>
            ) : null}
          </div>
          <RoutingMap rows={avgRows} />
        </section>

        {/* Top table */}
        <section className="mt-6 md:mt-8 rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Routing Keys by Average Price</h2>
            {!isBusy && !err && (
              <span className="text-xs text-neutral-400">
                Showing {limitedRows.length} of {Math.min(50, avgRows.length)}
              </span>
            )}
          </div>

          <div className="relative overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900 sticky top-0">
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">RK</th>
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">County</th>
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">Avg</th>
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {limitedRows.map((r) => (
                  <tr key={r.rk} className="border-b border-neutral-800 hover:bg-neutral-800/50">
                    <td className="px-3 py-2 font-medium text-neutral-100">{r.rk}</td>
                    <td className="px-3 py-2 text-neutral-200">{titleCase(r.county)}</td>
                    <td className="px-3 py-2 text-neutral-100">{fmt(r.avg)}</td>
                    <td className="px-3 py-2 text-neutral-300">{numFmt(r.count)}</td>
                  </tr>
                ))}
                {!avgRows.length && (
                  <tr><td colSpan={4} className="px-3 py-3 text-neutral-500">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {!err && avgRows.length > MAX_ROWS && (
            <div className="px-4 py-3 border-t border-neutral-800 flex justify-center">
              <button
                type="button"
                onClick={() => setExpanded((s) => !s)}
                className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-850 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-600"
              >
                {expanded ? "See less" : `See ${numFmt(remaining)} more`}
                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" className={`transition-transform ${expanded ? "rotate-180" : ""}`}>
                  <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.06l3.71-2.83a.75.75 0 11.92 1.18l-4.17 3.18a.75.75 0 01-.92 0L5.21 8.41a.75.75 0 01.02-1.2z" />
                </svg>
              </button>
            </div>
          )}
        </section>

        {/* Most expensive listings */}
        <section className="mt-6 md:mt-8">
          <MostExpensive counties={selectedCounties} type={type} />
        </section>
      </main>
    </div>
  );
}
