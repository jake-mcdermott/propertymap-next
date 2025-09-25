"use client";

import React from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import InsightsSidebar, { type ListingType } from "./Sidebar";
import MostExpensive from "@/components/insights/MostExpensive";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, X as XIcon } from "lucide-react";

import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

import {
  collectListingsFromSnapshot,
  buildMapAverages,
  buildLiveRows,
  weightedMedian,
  type AvgRow,
  type LiveRow,
} from "@/lib/insights";

// NEW: manifest fetcher (you already have this util)
import { fetchManifestClient, type ManifestInfo } from "@/lib/fetchManifestClient";

const RoutingMap = dynamic(() => import("./RoutingMap"), { ssr: false });

const countiesAll = [
  "Carlow","Cavan","Clare","Cork","Donegal","Dublin","Galway","Kerry","Kildare","Kilkenny",
  "Laois","Leitrim","Limerick","Longford","Louth","Mayo","Meath","Monaghan","Offaly","Roscommon",
  "Sligo","Tipperary","Waterford","Westmeath","Wexford","Wicklow"
];

// DEFAULT: all counties selected so the whole map is populated
const DEFAULT_COUNTIES = countiesAll;

const fmt = (n: number | null | undefined) => (n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE"));
const numFmt = (n: number) => n.toLocaleString("en-IE");
const titleCase = (s?: string | null) => (s ?? "—").replace(/\w\S*/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase());

type RawListing = { price: number; county?: string; type?: string; [k: string]: any };

const medianListing = (rows: LiveRow[]): LiveRow | null => {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid];
};

// Simple percentile with linear interpolation on a sorted array
function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

// Trim by price **percentiles** among the currently selected subset.
// Keeps items within [q, 1-q]. Everything else is removed.
function trimListingsByPrice(
  listings: RawListing[],
  counties: string[],
  type: ListingType,
  trimFraction: number
): RawListing[] {
  const predicate = (l: RawListing) =>
    (!type || l.type === type) && (!counties.length || (l.county && counties.includes(l.county)));

  // Build the price distribution of the selected scope
  const selectedPrices = listings
    .filter(predicate)
    .map(l => l.price)
    .filter(p => Number.isFinite(p) && (p as number) > 0); // ignore POA/0 here as well when computing thresholds

  if (selectedPrices.length < 10 || trimFraction <= 0) return listings;

  selectedPrices.sort((a, b) => a - b);
  const low = quantile(selectedPrices, trimFraction);
  const high = quantile(selectedPrices, 1 - trimFraction);

  // Keep only items in [low, high] for the selected subset; everything else untouched
  return listings.filter(l => {
    if (!predicate(l)) return true;
    return l.price >= low && l.price <= high;
  });
}

export default function InsightsClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Derive initial state from URL
  const initCounties = React.useMemo(() => {
    const raw = searchParams.get("counties");
    if (!raw) return DEFAULT_COUNTIES;
    const arr = raw.split(",").map((s) => s.trim()).filter((c) => countiesAll.includes(c));
    return arr.length ? arr : DEFAULT_COUNTIES;
  }, [searchParams]);

  const initType = ((searchParams.get("type") ?? "sale") as ListingType);
  const initTrim = React.useMemo(() => {
    const t = searchParams.get("trim");
    return t === "1" || t === "true";
  }, [searchParams]);

  // State
  const [selectedCounties, setSelectedCounties] = React.useState<string[]>(initCounties);
  const [type, setType] = React.useState<ListingType>(initType === "rent" ? "rent" : "sale");
  const [isCountyDropdownOpen, setIsCountyDropdownOpen] = React.useState<boolean>(true);
  const [trimEnabled, setTrimEnabled] = React.useState<boolean>(initTrim);

  const [avgRows, setAvgRows] = React.useState<AvgRow[]>([]);
  const [liveRows, setLiveRows] = React.useState<LiveRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [liveLoading, setLiveLoading] = React.useState(true);
  const [err, setErr] = React.useState<string>("");
  const [liveErr, setLiveErr] = React.useState<string>("");

  // NEW: manifest state
  const [manifest, setManifest] = React.useState<ManifestInfo | null>(null);

  const isBusy = loading || liveLoading;

  // --- URL sync (smooth) ---
  const initCountiesRef = React.useRef(initCounties.join(","));
  const initTypeRef = React.useRef(initType);
  const initTrimRef = React.useRef(initTrim ? "1" : "");
  const didInitialSyncRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const currentHasQuery =
      !!searchParams.get("counties") || !!searchParams.get("type") || !!searchParams.get("trim");

    if (!didInitialSyncRef.current) {
      didInitialSyncRef.current = true;
      if (!currentHasQuery) return; // don't push defaults on first load
    }

    const stateCounties = selectedCounties.join(",");
    const stateType = type;
    const stateTrim = trimEnabled ? "1" : "";

    if (
      stateCounties === initCountiesRef.current &&
      stateType === initTypeRef.current &&
      stateTrim === initTrimRef.current
    ) {
      return;
    }

    const sp = new URLSearchParams();
    if (selectedCounties.length) sp.set("counties", stateCounties);
    if (type) sp.set("type", stateType);
    if (trimEnabled) sp.set("trim", "1");

    const next = `${pathname}?${sp.toString()}`;
    const current = `${window.location.pathname}${window.location.search}`;
    if (next !== current) {
      requestAnimationFrame(() => window.history.replaceState(null, "", next));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCounties.join(","), type, trimEnabled, pathname, searchParams]);

  // Single Firestore fetch → compute datasets (ignore POA/zero + optional trimming)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLiveLoading(true);
      setErr("");
      setLiveErr("");

      try {
        const snap = await getDocs(collection(db, "map-listings"));
        if (cancelled) return;

        const raw = collectListingsFromSnapshot(snap) as RawListing[];

        // ⛳️ IMPORTANT: ignore POA/zero-price listings globally
        const priced: RawListing[] = raw.filter(
          (l) => Number.isFinite(l.price) && (l.price as number) > 0
        );

        // Apply 5% each-side trimming if enabled, based on the current selection scope
        const working = trimEnabled
          ? trimListingsByPrice(priced, selectedCounties, type, 0.05)
          : priced;

        const [mapAgg, live] = await Promise.all([
          buildMapAverages(working, selectedCounties, type, { maxAgeDays: 90 }),
          buildLiveRows(working, selectedCounties, type, { maxAgeDays: 90 }),
        ]);

        if (!cancelled) {
          setAvgRows(mapAgg);
          setLiveRows(live);
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Error loading data");
          setLiveErr(e?.message || "Error loading data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLiveLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedCounties.join(","), type, trimEnabled]);

  // NEW: fetch manifest (last updated, total, shards)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const m = await fetchManifestClient();
      if (!alive) return;
      setManifest(m);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // “See more” handling
  const [expanded, setExpanded] = React.useState(false);
  const MAX_ROWS = 10;
  const limitedRows = React.useMemo(() => {
    const cap = Math.min(50, avgRows.length);
    return expanded ? avgRows.slice(0, cap) : avgRows.slice(0, Math.min(MAX_ROWS, cap));
  }, [avgRows, expanded]);
  const remaining = Math.max(0, Math.min(50, avgRows.length) - Math.min(MAX_ROWS, avgRows.length));

  // KPIs (computed from the already-filtered + trimmed avgRows)
  const metrics = React.useMemo(() => {
    if (!avgRows.length) return { totalListings: 0, weightedAvg: null as number | null, weightedMed: null as number | null, rkCount: 0 };
    const totalListings = avgRows.reduce((a, r) => a + r.count, 0);
    const weightedAvg = totalListings > 0 ? avgRows.reduce((a, r) => a + r.avg * r.count, 0) / totalListings : null;
    const weightedMed = weightedMedian(avgRows);
    const rkCount = avgRows.length;
    return { totalListings, weightedAvg, weightedMed, rkCount };
  }, [avgRows]);

  // Min/Max & median from the live rows (already filtered & trimmed upstream)
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

  // NEW: pretty "last updated" label
  const lastUpdatedLabel = React.useMemo(() => {
    const d = manifest?.updatedAt;
    if (!d || isNaN(d.getTime())) return null;

    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    if (isToday) {
      // Today, show only time
      return `Last updated Today ${d.toLocaleTimeString("en-IE", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    }
    // Otherwise show date + time (short)
    return `Last updated ${d.toLocaleDateString("en-IE", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    })} ${d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}`;
  }, [manifest?.updatedAt]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* Top progress bar */}
      <div className={`fixed left-0 right-0 top-[var(--header-height,0px)] h-[2px] z-30 transition-opacity duration-200 ${isBusy ? "opacity-100" : "opacity-0"}`} aria-hidden={!isBusy}>
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
            trimEnabled={trimEnabled}
            setTrimEnabled={setTrimEnabled}
          />
        </div>
      </div>

      {/* Mobile filter bar (full-screen Sheet) */}
      <div className="lg:hidden top-[calc(var(--header-height,64px))] z-20 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2 bg-neutral-900/90 backdrop-blur border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-400 flex-1 truncate">
            {selectedCounties.length ? selectedCounties.join(", ") : "No counties selected"}
            {trimEnabled ? " • Trim 5%" : ""}
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="h-8">
                <SlidersHorizontal className="mr-1" />
                Filters
              </Button>
            </SheetTrigger>

            {/* Full-screen, scrollable content */}
            <SheetContent
              side="bottom"
              className="h-[100dvh] w-screen max-w-none p-0 bg-neutral-900 border-neutral-800 rounded-none flex flex-col"
            >
              {/* iPhone-safe Close (X) */}
              <SheetClose asChild>
                <button
                  type="button"
                  aria-label="Close filters"
                  className="absolute z-20 inline-flex items-center justify-center rounded-md border border-neutral-700/60 bg-neutral-800/80 hover:bg-neutral-700/80 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-neutral-500"
                  style={{
                    top: "calc(env(safe-area-inset-top, 0px) + 10px)",
                    right: "calc(env(safe-area-inset-right, 0px) + 10px)",
                    width: "36px",
                    height: "36px",
                  }}
                >
                  <XIcon size={18} className="text-neutral-200" />
                </button>
              </SheetClose>

              {/* Header (spacer for X) */}
              <SheetHeader
                className="px-4 py-3 border-b border-neutral-800"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
              >
                <SheetTitle className="text-sm pb-8"></SheetTitle>
              </SheetHeader>

              {/* Scroll area */}
              <div className="flex-1 overflow-y-auto p-3">
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
                  trimEnabled={trimEnabled}
                  setTrimEnabled={setTrimEnabled}
                />
              </div>

              {/* Sticky Apply footer (orange) */}
              <div
                className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur px-3"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)", paddingTop: "10px" }}
              >
                <SheetClose asChild>
                  <Button
                    className="w-full h-11 font-medium text-white
                               bg-[#f97316] hover:bg-[#fb923c] active:bg-[#ea580c]
                               focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#fb923c]/50
                               transition"
                  >
                    Apply
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0">
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
              <div className="flex items-center gap-3 text-xs">
                <span className="text-neutral-400">{avgRows.length} areas</span>
                {lastUpdatedLabel && (
                  <span className="text-neutral-500">{lastUpdatedLabel}</span>
                )}
              </div>
            ) : null}
          </div>
          <RoutingMap rows={avgRows} />
        </section>

        {/* Table */}
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
                {!avgRows.length && <tr><td colSpan={4} className="px-3 py-3 text-neutral-500">No data</td></tr>}
              </tbody>
            </table>
          </div>

          {avgRows.length > MAX_ROWS && (
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

        <section className="mt-6 md:mt-8">
          <MostExpensive
            counties={selectedCounties}
            type={type}
            liveRows={liveRows}
          />
        </section>
      </main>
    </div>
  );
}
