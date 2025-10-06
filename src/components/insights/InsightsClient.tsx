// src/app/insights/InsightsClient.tsx
"use client";

import React from "react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
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
import {
  SlidersHorizontal,
  X as XIcon,
  TrendingUp,
  LineChart,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Layers,
  Ruler,
} from "lucide-react";

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

import { type ManifestInfo } from "@/lib/fetchManifestClient";
import { fetchManifestCached } from "@/lib/fetchManifestCache";

const RoutingMap = dynamic(() => import("./RoutingMap"), { ssr: false });

/* -------------------- Small shared See More button -------------------- */
function SeeMoreButton({
  expanded,
  remaining,
  onClick,
}: {
  expanded: boolean;
  remaining: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-850 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-600"
    >
      {expanded ? "See less" : `See ${remaining.toLocaleString("en-IE")} more`}
      <svg
        width="12"
        height="12"
        viewBox="0 0 20 20"
        fill="currentColor"
        className={`transition-transform ${expanded ? "rotate-180" : ""}`}
      >
        <path d="M5.23 7.21a.75.75 0 011.06.02L10 10.06l3.71-2.83a.75.75 0 11.92 1.18l-4.17 3.18a.75.75 0 01-.92 0L5.21 8.41a.75.75 0 01.02-1.2z" />
      </svg>
    </button>
  );
}

/* --------------------------------------------------------------------- */

const countiesAll = [
  "Carlow","Cavan","Clare","Cork","Donegal","Dublin","Galway","Kerry","Kildare","Kilkenny",
  "Laois","Leitrim","Limerick","Longford","Louth","Mayo","Meath","Monaghan","Offaly","Roscommon",
  "Sligo","Tipperary","Waterford","Westmeath","Wexford","Wicklow"
];
const DEFAULT_COUNTIES = countiesAll;
const TOWN_MIN_SAMPLE = 10;

// Map metric toggle
type MapMetric = "price" | "eurPerSqm";

// Sane bounds for dwelling floor area (m²)
const SIZE_SQM_MIN = 15;
const SIZE_SQM_MAX = 1000;

const fmt = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE");
const eurPerSqmFmt = (n: number | null | undefined) =>
  n == null ? "—" : "€" + Math.round(n).toLocaleString("en-IE") + " / m²";
const numFmt = (n: number) => n.toLocaleString("en-IE");
const titleCase = (s?: string | null) =>
  (s ?? "—").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

// ---- Types ----
type RawListing = {
  id?: string;
  price: number;
  county?: string | null;
  type?: string | null;
  sizeSqm?: number | null;
  town?: string | null;
  eircode?: string | null;
  address?: string | null;
  [k: string]: any;
};

const medianListing = (rows: LiveRow[]): LiveRow | null => {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid];
};

const normCounty = (s?: string | null) =>
  (s || "").replace(/^\s*(?:co\.?|county)\s+/i, "").trim();

const rkOf = (eir?: string | null) =>
  typeof eir === "string" && eir.length >= 3 ? eir.slice(0, 3).toUpperCase() : null;

// Strictly use sizeSqm; discard null/zero/out-of-range
const getSizeSqm = (x: any): number | null => {
  const v = Number(x?.sizeSqm);
  if (!Number.isFinite(v)) return null;
  if (v <= 0) return null;
  if (v < SIZE_SQM_MIN || v > SIZE_SQM_MAX) return null;
  return v;
};

function trimListingsByPrice(
  listings: RawListing[],
  trimFraction: number
): RawListing[] {
  if (trimFraction <= 0) return listings;

  const base = listings
    .map((l) => l.price as number)
    .filter((p) => Number.isFinite(p) && p > 0)
    .sort((a, b) => a - b);

  if (base.length < 10) return listings;

  const q = (arr: number[], t: number) => {
    const pos = (arr.length - 1) * t;
    const lo = Math.floor(pos);
    const hi = Math.min(lo + 1, arr.length - 1);
    const frac = pos - lo;
    return arr[lo] + frac * (arr[hi] - arr[lo]);
  };

  const low = q(base, trimFraction);
  const high = q(base, 1 - trimFraction);

  return listings.filter(
    (l) => Number.isFinite(l.price) && l.price > 0 && l.price >= low && l.price <= high
  );
}

const extractTown = (x: any): string => {
  const t =
    (x?.town ??
      x?.locality ??
      x?.cityTown ??
      x?.areaTown ??
      x?.neighbourhood ??
      "") as string;
  if (t && String(t).trim()) return String(t).trim();

  const addr = String(x?.address || "").trim();
  if (!addr) return "";
  const first = addr.split(",")[1]?.trim() || addr.split(",")[0]?.trim() || "";
  const county = String(x?.county || "").replace(/^\s*(?:co\.?|county)\s+/i, "").trim().toLowerCase();
  if (first && first.toLowerCase() !== county) return first;
  return "";
};

export default function InsightsClient() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive initial state from URL
  const initCounties = React.useMemo(() => {
    const raw = searchParams.get("counties");
    if (!raw) return DEFAULT_COUNTIES;
    const arr = raw
      .split(",")
      .map((s) => s.trim())
      .filter((c) => countiesAll.includes(c));
    return arr.length ? arr : DEFAULT_COUNTIES;
  }, [searchParams]);

  const initType = (searchParams.get("type") ?? "sale") as ListingType;
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
  const [pricedBase, setPricedBase] = React.useState<RawListing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [liveLoading, setLiveLoading] = React.useState(true);
  const [err, setErr] = React.useState<string>("");
  const [liveErr, setLiveErr] = React.useState<string>("");

  const [manifest, setManifest] = React.useState<ManifestInfo | null>(null);

  const [mapMetric, setMapMetric] = React.useState<MapMetric>("price");

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

  function KPICard({
    label,
    value,
    sublabel,
    icon: Icon,
    loading,
  }: {
    label: string;
    value: React.ReactNode;
    sublabel?: React.ReactNode;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    loading?: boolean;
  }) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            {label}
          </div>
          {Icon ? <Icon size={16} className="text-neutral-500/70" /> : null}
        </div>

        <div className="mt-1">
          {loading ? (
            <div className="h-7 w-24 rounded bg-neutral-800/80 animate-pulse" />
          ) : (
            <div className="text-xl md:text-2xl font-semibold text-neutral-50 leading-tight tabular-nums">
              {value}
            </div>
          )}
        </div>

        {sublabel ? (
          <div className="mt-1.5 text-[11px] text-neutral-500">{sublabel}</div>
        ) : null}
      </div>
    );
  }

  // ------------------- Fetch + Eircode-first scoping -------------------
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLiveLoading(true);
      setErr("");
      setLiveErr("");

      try {
        // 1) Load everything once
        const snap = await getDocs(collection(db, "map-listings"));
        if (cancelled) return;
        const allRaw = collectListingsFromSnapshot(snap) as RawListing[];

        // keep only with a numeric >0 price
        let pricedAll = allRaw.filter((l) => Number.isFinite(l.price) && (l.price as number) > 0);

        // optional trim by price percentiles on the NATIONAL stream
        if (trimEnabled) pricedAll = trimListingsByPrice(pricedAll, 0.05);

        // 2) Build a NATIONWIDE RK→county map using the priced stream
        const nationwideAgg = await buildMapAverages(pricedAll, countiesAll, type, { maxAgeDays: 90 });
        const rkCounty = new Map<string, string | null>();
        for (const r of nationwideAgg) rkCounty.set(r.rk.toUpperCase(), r.county ?? null);

        // 3) Allowed RKs from selected counties (by RK county only)
        const selected = new Set(selectedCounties.map((c) => c.toLowerCase()));
        const allowedRKs = new Set<string>();
        for (const r of nationwideAgg) {
          const c = (r.county ?? "").toLowerCase();
          if (!selectedCounties.length || selected.has(c)) {
            allowedRKs.add(r.rk.toUpperCase());
          }
        }

        // 4) Scope the PRICED stream by allowed RK only (ignore listing.county)
        const scopedPriced = pricedAll.filter((x) => {
          const rk = rkOf(x.eircode);
          return rk ? allowedRKs.has(rk) : false;
        });

        // Also track ALL rows (priced + POA) scoped by RK, for map sample counts
        const scopedAll = allRaw.filter((x) => {
          const rk = rkOf(x.eircode);
          return rk ? allowedRKs.has(rk) : false;
        });

        // 5) Keep around for KPIs/€/m²/towns
        setPricedBase(scopedPriced);

        // 6) Build per-RK price map + live rows from scoped PRICED stream
        const [mapAggScoped, live] = await Promise.all([
          buildMapAverages(scopedPriced, selectedCounties, type, { maxAgeDays: 90 }),
          buildLiveRows(scopedPriced, selectedCounties, type, { maxAgeDays: 90 }),
        ]);

        // 7) Override each RK's 'count' with total scoped (priced + POA) so map counts match
        const countAllByRK = new Map<string, number>();
        for (const l of scopedAll) {
          const rk = rkOf(l.eircode);
          if (!rk) continue;
          countAllByRK.set(rk, (countAllByRK.get(rk) || 0) + 1);
        }
        const mapAggFinal = mapAggScoped.map((r) => {
          const total = countAllByRK.get(r.rk) ?? r.count;
          return { ...r, count: total, pricedCount: r.count } as AvgRow & { pricedCount?: number };
        });

        if (!cancelled) {
          setAvgRows(mapAggFinal);
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

  // Manifest (last updated)
  React.useEffect(() => {
    let alive = true;
    (async () => {
      const m = await fetchManifestCached();
      if (!alive) return;
      setManifest(m);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Routing Keys table paging
  const [expanded, setExpanded] = React.useState(false);
  const MAX_ROWS = 10;
  const limitedRows = React.useMemo(() => {
    const cap = Math.min(50, avgRows.length);
    return expanded ? avgRows.slice(0, cap) : avgRows.slice(0, Math.min(MAX_ROWS, cap));
  }, [avgRows, expanded]);
  const remaining = Math.max(0, Math.min(50, avgRows.length) - Math.min(MAX_ROWS, avgRows.length));

  // KPIs (use PRICED counts so trim reduces totals)
  const metrics = React.useMemo(() => {
    if (!avgRows.length) {
      return { totalListings: 0, weightedAvg: null as number | null, weightedMed: null as number | null, rkCount: 0 };
    }
    const pricedTotal = avgRows.reduce((a, r: any) => a + (r.pricedCount ?? r.count ?? 0), 0);
    const weightedAvg =
      pricedTotal > 0
        ? avgRows.reduce((a, r: any) => a + r.avg * (r.pricedCount ?? r.count ?? 0), 0) / pricedTotal
        : null;
    const weightedMed = weightedMedian(
      avgRows.map((r: any) => ({ ...r, count: r.pricedCount ?? r.count ?? 0 }))
    );
    const rkCount = avgRows.length;
    return { totalListings: pricedTotal, weightedAvg, weightedMed, rkCount };
  }, [avgRows]);

  // Live min/max/med
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

  // €/m² (weighted by size) – ONLY sizeSqm in sane bounds is considered
  const sqmMetrics = React.useMemo(() => {
    let sumPrice = 0;
    let sumSize = 0;
    let sample = 0;

    for (const x of pricedBase) {
      const price = Number(x.price);
      const sqm = getSizeSqm(x);
      if (!(price > 0) || sqm == null) continue;
      sumPrice += price;
      sumSize += sqm;
      sample += 1;
    }

    const weightedAvgEurPerSqm = sumSize > 0 ? sumPrice / sumSize : null;
    return { weightedAvgEurPerSqm, sample };
  }, [pricedBase]);

  // --- Build € / m² rows per RK from the RK-scoped priced base ---
  type MapRow = { rk: string; county: string | null; avg: number; count: number };
  const rkEurPerSqmRows: MapRow[] = React.useMemo(() => {
    const countyByRK = new Map<string, string | null>();
    for (const r of avgRows) countyByRK.set(r.rk.toUpperCase(), r.county ?? null);

    const agg = new Map<string, { sumPrice: number; sumSize: number; count: number; county: string | null }>();
    for (const x of pricedBase) {
      const rk = rkOf(x.eircode);
      if (!rk) continue;
      const sqm = getSizeSqm(x);
      const price = Number(x.price);
      if (!(price > 0) || sqm == null) continue;

      const key = rk.toUpperCase();
      const cty = countyByRK.get(key) ?? (x.county ?? null) ?? null;
      const prev = agg.get(key) || { sumPrice: 0, sumSize: 0, count: 0, county: cty };
      prev.sumPrice += price;
      prev.sumSize += sqm;
      prev.count += 1;
      if (prev.county == null && cty != null) prev.county = cty;
      agg.set(key, prev);
    }

    const out: MapRow[] = [];
    for (const [rk, v] of agg.entries()) {
      if (v.sumSize <= 0) continue;
      const avg = v.sumPrice / v.sumSize; // €/m²
      out.push({ rk, county: v.county ?? null, avg, count: v.count });
    }
    out.sort((a, b) => b.avg - a.avg);
    return out;
  }, [pricedBase, avgRows]);

  // Towns by avg price (desc) — require ≥ TOWN_MIN_SAMPLE
  type TownRow = { town: string; county: string | null; avg: number; count: number };
  const [townExpanded, setTownExpanded] = React.useState(false);
  const townsRows = React.useMemo(() => {
    const agg = new Map<string, { town: string; county: string | null; sum: number; count: number }>();
    for (const x of pricedBase) {
      const town = extractTown(x);
      if (!town) continue;
      const county = (x.county ?? null) as string | null;
      const key = `${town}||${county ?? ""}`;
      const prev = agg.get(key) || { town, county, sum: 0, count: 0 };
      if (Number(x.price) > 0) {
        prev.sum += Number(x.price);
        prev.count += 1;
      }
      agg.set(key, prev);
    }
    const rows: TownRow[] = Array.from(agg.values())
      .filter((x) => x.count >= TOWN_MIN_SAMPLE)
      .map((x) => ({ town: x.town, county: x.county, avg: x.sum / x.count, count: x.count }))
      .sort((a, b) => b.avg - a.avg);
    return rows;
  }, [pricedBase]);

  const TOWNS_MAX_ROWS = 10;
  const townsLimited = React.useMemo(() => {
    const cap = Math.min(50, townsRows.length);
    return townExpanded ? townsRows.slice(0, cap) : townsRows.slice(0, Math.min(TOWNS_MAX_ROWS, cap));
  }, [townsRows, townExpanded]);
  const townsRemaining = Math.max(
    0,
    Math.min(50, townsRows.length) - Math.min(TOWNS_MAX_ROWS, townsRows.length)
  );

  // Pretty "last updated"
  const lastUpdatedLabel = React.useMemo(() => {
    const d = manifest?.updatedAt as Date | undefined;
    if (!d || isNaN(d.getTime())) return null;
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return `Last updated Today ${d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `Last updated ${d.toLocaleDateString("en-IE", { year: "numeric", month: "short", day: "2-digit" })} ${d.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}`;
  }, [manifest?.updatedAt]);

  // Rows + formatting for the map based on toggle
  const mapRows = mapMetric === "price" ? avgRows : rkEurPerSqmRows;

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* ORANGE TOP LOADER — shows only when isBusy === true */}
      <div
        className={`fixed left-0 right-0 top-0 h-[3px] z-[9999] transition-opacity duration-200 ${isBusy ? "opacity-100" : "opacity-0"}`}
        aria-hidden={!isBusy}
      >
        <div className="relative h-full w-full overflow-hidden">
          <div className="absolute inset-0 bg-[#fb923c]/20" />
          <div className="absolute top-0 bottom-0 w-1/3 bg-gradient-to-r from-transparent via-[#f97316] to-transparent animate-[insightsBar_1.05s_linear_infinite]" />
        </div>
      </div>
      <style jsx global>{`
        @keyframes insightsBar {
          0%   { transform: translateX(-110%); }
          100% { transform: translateX(210%); }
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

      {/* Mobile filter bar */}
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

            <SheetContent
              side="bottom"
              className="h-[100dvh] w-screen max-w-none p-0 bg-neutral-900 border-neutral-800 rounded-none flex flex-col"
            >
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

              <SheetHeader
                className="px-4 py-3 border-b border-neutral-800"
                style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
              >
                <SheetTitle className="text-sm pb-8"></SheetTitle>
              </SheetHeader>

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

              <div
                className="border-t border-neutral-800 bg-neutral-900/95 backdrop-blur px-3"
                style={{
                  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
                  paddingTop: "10px",
                }}
              >
                <SheetClose asChild>
                  <Button className="w-full h-11 font-medium text-white bg-[#f97316] hover:bg-[#fb923c] active:bg-[#ea580c] focus:outline-none focus:ring-2 focus:ring-offset-0 focus:ring-[#fb923c]/50 transition">
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
        {/* KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-4">
          <KPICard
            label="Average Prop. Price"
            value={fmt(metrics.weightedAvg)}
            icon={LineChart}
            loading={isBusy}
          />
          <KPICard
            label="Median Prop. Price"
            value={fmt(med?.price ?? null)}
            icon={TrendingUp}
            loading={isBusy}
          />
          <KPICard
            label="Total Listings"
            value={numFmt(metrics.totalListings)}
            icon={Layers}
            loading={isBusy}
          />
          <KPICard
            label="Min Property Price"
            value={fmt(minMax.min?.price ?? null)}
            icon={ArrowDownWideNarrow}
            loading={isBusy}
          />
          <KPICard
            label="Max Property Price"
            value={fmt(minMax.max?.price ?? null)}
            icon={ArrowUpWideNarrow}
            loading={isBusy}
          />
          <KPICard
            label="Avg €/m²"
            value={eurPerSqmFmt(sqmMetrics.weightedAvgEurPerSqm)}
            icon={Ruler}
            loading={isBusy}
          />
        </section>

        {/* Map */}
        <section className="mt-6 md:mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-3 md:p-4">
          <div className="flex items-center justify-between mb-2">
            {/* LEFT: title + last updated on mobile */}
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold">
                {mapMetric === "price"
                  ? "Eircode Heat Map — Average Price"
                  : "Eircode Heat Map — Average €/m²"}
              </h2>
              {!isBusy && !err && lastUpdatedLabel && (
                <span className="mt-0.5 text-[11px] text-neutral-500 sm:hidden">
                  {lastUpdatedLabel}
                </span>
              )}
            </div>

            {/* RIGHT: scannable actions row; keeps lastUpdated inline on ≥sm */}
            <div className="flex items-center gap-2 min-w-0 flex-nowrap overflow-x-auto pr-[max(env(safe-area-inset-right),0.75rem)] -mr-2">
              {!isBusy && !err ? (
                <div className="flex items-center gap-3 text-xs shrink-0">
                  {lastUpdatedLabel && (
                    <span className="hidden sm:inline text-neutral-500">
                      {lastUpdatedLabel}
                    </span>
                  )}
                </div>
              ) : null}

              {/* Toggle */}
              <div className="ml-2 inline-flex rounded-md border border-neutral-700 overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={() => setMapMetric("price")}
                  className={`px-2.5 py-1.5 cursor-pointer text-xs ${
                    mapMetric === "price"
                      ? "bg-neutral-700 text-white"
                      : "bg-neutral-900 text-neutral-300"
                  }`}
                >
                  Price
                </button>
                <button
                  type="button"
                  onClick={() => setMapMetric("eurPerSqm")}
                  className={`px-2.5 py-1.5 cursor-pointer text-xs ${
                    mapMetric === "eurPerSqm"
                      ? "bg-neutral-700 text-white"
                      : "bg-neutral-900 text-neutral-300"
                  }`}
                >
                  €/m²
                </button>
              </div>
            </div>
          </div>

          <RoutingMap
            rows={(mapMetric === "price" ? avgRows : rkEurPerSqmRows) as any}
            valueLabel={mapMetric === "price" ? "Avg Price" : "Avg €/m²"}
            valueFmt={mapMetric === "price" ? fmt : eurPerSqmFmt}
          />
        </section>

        {/* Routing Keys table */}
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
                  <tr
                    key={r.rk}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50"
                  >
                    <td className="px-3 py-2 font-medium text-neutral-100">{r.rk}</td>
                    <td className="px-3 py-2 text-neutral-200">{titleCase(r.county)}</td>
                    <td className="px-3 py-2 text-neutral-100">{fmt(r.avg)}</td>
                    <td className="px-3 py-2 text-neutral-300">{numFmt(r.count)}</td>
                  </tr>
                ))}
                {!avgRows.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-neutral-500">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {avgRows.length > MAX_ROWS && (
            <div className="px-4 py-3 border-t border-neutral-800 flex justify-center">
              <SeeMoreButton
                expanded={expanded}
                remaining={remaining}
                onClick={() => setExpanded((s) => !s)}
              />
            </div>
          )}
        </section>

        {/* Towns by Average Price (desc) */}
        <section className="mt-6 md:mt-8 rounded-xl border border-neutral-800 bg-neutral-900">
          <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Towns by Average Price{" "}
              <span className="text-xs text-neutral-400">
                (≥ {TOWN_MIN_SAMPLE} listings)
              </span>
            </h2>
            {!isBusy && !err && (
              <span className="text-xs text-neutral-400">
                Showing {townsLimited.length} of {Math.min(50, townsRows.length)}
              </span>
            )}
          </div>

          <div className="relative overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead className="bg-neutral-900 sticky top-0">
                <tr className="border-b border-neutral-800">
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">Town</th>
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">County</th>
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">Avg</th>
                  <th className="text-left px-3 py-2 text-neutral-300 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {townsLimited.map((r) => (
                  <tr
                    key={`${r.town}::${r.county ?? ""}`}
                    className="border-b border-neutral-800 hover:bg-neutral-800/50"
                  >
                    <td className="px-3 py-2 font-medium text-neutral-100">
                      {titleCase(r.town)}
                    </td>
                    <td className="px-3 py-2 text-neutral-200">
                      {titleCase(r.county)}
                    </td>
                    <td className="px-3 py-2 text-neutral-100">{fmt(r.avg)}</td>
                    <td className="px-3 py-2 text-neutral-300">{numFmt(r.count)}</td>
                  </tr>
                ))}
                {!townsRows.length && (
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-neutral-500">
                      No data
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {townsRows.length > TOWNS_MAX_ROWS && (
            <div className="px-4 py-3 border-t border-neutral-800 flex justify-center">
              <SeeMoreButton
                expanded={townExpanded}
                remaining={townsRemaining}
                onClick={() => setTownExpanded((s) => !s)}
              />
            </div>
          )}
        </section>

        {/* Most Expensive */}
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
