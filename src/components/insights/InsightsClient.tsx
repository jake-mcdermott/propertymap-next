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
  Info,
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
import type { FeatureCollection } from "geojson";

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

type NiCountyStat = {
  county: string;
  countySlug: string;
  totalListings: number;
  avgPriceGBP: number | null;
  medianPriceGBP: number | null;
  // optional fields that may or may not exist in stats; we no longer rely on them for min/max
  minPriceGBP?: number | null;
  maxPriceGBP?: number | null;
  countsByType?: { Apartment?: number; House?: number };
};

const medianListing = (rows: LiveRow[]): LiveRow | null => {
  if (!rows.length) return null;
  const sorted = [...rows].sort((a, b) => a.price - b.price);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid];
};

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

/* ======================= NI helpers ======================= */
const normalizeCountyName = (s?: string | null) => {
  let v = (s ?? "").trim().toLowerCase();
  v = v.replace(/^county\s+/i, "");
  v = v.replace(/[()]/g, "");
  v = v.replace(/\s*\/\s*/g, " ");
  v = v.replace(/\s*-\s*/g, " ");
  v = v.replace(/\s+/g, " ");
  if (/\bderry\b/.test(v)) v = "londonderry";
  return v;
};
const titleizeCountyNI = (s: string) => s.replace(/\b\w/g, (m) => m.toUpperCase());
function countyNameFromProps(p: Record<string, any>): string {
  const direct =
    p.COUNTY_NAME ??
    p.CountyName ??
    p.NAME ??
    p.County ??
    p.county ??
    p.admin_name ??
    p.AdminName ??
    null;
  if (direct) return String(direct);
  for (const [k, v] of Object.entries(p)) {
    if (/county/i.test(k) && v != null && String(v).trim()) return String(v);
  }
  return "";
}
/* ========================================================= */

function weightedMedianNumber(pairs: Array<{ value: number; weight: number }>): number | null {
  const arr = pairs
    .filter((p) => Number.isFinite(p.value) && p.weight > 0)
    .sort((a, b) => a.value - b.value);
  const total = arr.reduce((a, p) => a + p.weight, 0);
  if (total <= 0 || !arr.length) return null;
  let acc = 0;
  for (const p of arr) {
    acc += p.weight;
    if (acc >= total / 2) return p.value;
  }
  return arr[arr.length - 1].value;
}

type NiKpis = {
  totalListings: number;
  avgGBP: number | null;
  avgEUR: number | null;
  medianGBP: number | null;
  medianEUR: number | null;
  /** NEW: true min / max listing prices (not averages) pulled from NI listing documents */
  minGBP: number | null;
  minEUR: number | null;
  maxGBP: number | null;
  maxEUR: number | null;
};

/** Info icon with simple title tooltip */
function InfoHover({ title }: { title: string | undefined }) {
  if (!title) return null;
  return (
    <span className="inline-flex items-center align-middle ml-1" title={title}>
      <Info className="h-3.5 w-3.5 text-neutral-400 hover:text-neutral-200" />
    </span>
  );
}

/** Try to pull NI listing prices directly from Firestore (for true min/max listing price). */
async function fetchNiListingExtremesGBP(): Promise<{ minGBP: number | null; maxGBP: number | null; sample: number }> {
  // Likely NI collections first; add a few common variants for safety
  const candidateCollections = [
    "ni_listings",
    "ni-map-listings",
    "ni_raw_listings",
    "niListings",
    "map-listings-ni",
    // fallback to a general pool (will post-filter to NI; only used if others empty)
    "map-listings",
    "listings",
  ];

  const isNiDoc = (d: any) => {
    const v =
      d?.country ??
      d?.region ??
      d?.jurisdiction ??
      d?.countryCode ??
      d?.country_code ??
      d?.country_name ??
      "";
    const s = String(v).toLowerCase();
    return /northern\s*ireland|^ni$|gb-?nir|ulster/.test(s);
  };

  const getPriceGBP = (d: any): number | null => {
    const candidates = [
      d?.priceGBP, d?.price_gbp, d?.askingPriceGBP, d?.asking_price_gbp,
      // sometimes price already stored in GBP as "price"
      d?.price, d?.askingPrice, d?.asking_price,
    ];
    for (const c of candidates) {
      const n = Number(c);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  };

  for (const name of candidateCollections) {
    try {
      const snap = await getDocs(collection(db, name));
      if (snap.empty) continue;

      let min: number | null = null;
      let max: number | null = null;
      let count = 0;

      snap.forEach((doc) => {
        const d = doc.data();
        // If we're reading a general collection, only accept NI docs
        if ((name === "map-listings" || name === "listings") && !isNiDoc(d)) return;

        // Skip rentals if type is available and says "rent"
        if (String(d?.type || "").toLowerCase() === "rent") return;

        const gbp = getPriceGBP(d);
        if (gbp == null) return;

        count += 1;
        if (min == null || gbp < min) min = gbp;
        if (max == null || gbp > max) max = gbp;
      });

      if (count > 0 && (min != null || max != null)) {
        return { minGBP: min ?? null, maxGBP: max ?? null, sample: count };
      }
      // else try next collection
    } catch {
      // swallow and try next candidate
    }
  }

  return { minGBP: null, maxGBP: null, sample: 0 };
}

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

  // NI overlay + KPIs
  const [includeNI, setIncludeNI] = React.useState<boolean>(true);
  const [niFx, setNiFx] = React.useState<number>(1.15); // GBP→EUR
  const [niOverlayFC, setNiOverlayFC] = React.useState<FeatureCollection | null>(null);
  const [niExtraValues, setNiExtraValues] = React.useState<number[]>([]);
  const [niLoading, setNiLoading] = React.useState<boolean>(false);
  const [niErr, setNiErr] = React.useState<string>("");

  const [niKpis, setNiKpis] = React.useState<NiKpis | null>(null);

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
    infoTitle,
  }: {
    label: string;
    value: React.ReactNode;
    sublabel?: React.ReactNode;
    icon?: React.ComponentType<{ size?: number; className?: string }>;
    loading?: boolean;
    infoTitle?: string;
  }) {
    return (
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-neutral-400">
            {label}
            <InfoHover title={infoTitle} />
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

  // ------------------- Fetch + Eircode-first scoping (ROI) -------------------
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

  // €/m²
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

  // --- Build € / m² rows per RK ---
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

  // Towns table
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

  // Rows for the map
  const mapRows = mapMetric === "price" ? avgRows : rkEurPerSqmRows;

  // ---- NI overlay fetch/join + KPIs (Price only) ----
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!includeNI || mapMetric !== "price") {
        setNiOverlayFC(null);
        setNiExtraValues([]);
        setNiKpis(null);
        return;
      }
      setNiLoading(true);
      setNiErr("");

      try {
        // County-level stats (for avg/median + overlay)
        const snap = await getDocs(collection(db, "ni_county_stats"));
        if (cancelled) return;
        const rows: NiCountyStat[] = [];
        snap.forEach((d) => rows.push(d.data() as NiCountyStat));

        const byCounty = new Map<string, { avgEur: number | null; cnt: number }>();
        const extras: number[] = [];
        const valueWeightPairsAvg: Array<{ value: number; weight: number }> = [];
        const valueWeightPairsMed: Array<{ value: number; weight: number }> = [];

        let totalListings = 0;
        let sumWeightedAvgGBP = 0;

        for (const r of rows) {
          const key = normalizeCountyName(r.county);
          const cnt = Number(r.totalListings || 0);
          const avgGBP = (r.avgPriceGBP ?? null) != null ? Number(r.avgPriceGBP) : null;
          const medGBP = (r.medianPriceGBP ?? null) != null ? Number(r.medianPriceGBP) : null;

          totalListings += cnt;

          if (avgGBP != null && Number.isFinite(avgGBP)) {
            sumWeightedAvgGBP += avgGBP * cnt;
            valueWeightPairsAvg.push({ value: avgGBP, weight: Math.max(1, cnt) });
          }
          if (medGBP != null && Number.isFinite(medGBP)) {
            valueWeightPairsMed.push({ value: medGBP, weight: Math.max(1, cnt) });
          }

          const avgEur = avgGBP != null ? avgGBP * niFx : null;
          byCounty.set(key, { avgEur, cnt });
          if (avgEur != null && Number.isFinite(avgEur)) extras.push(avgEur);
        }

        const avgGBP =
          totalListings > 0 && sumWeightedAvgGBP > 0 ? sumWeightedAvgGBP / totalListings : null;
        const medGBP =
          weightedMedianNumber(valueWeightPairsMed) ??
          weightedMedianNumber(valueWeightPairsAvg) ??
          null;

        // >>> NEW: get true min/max from NI listing documents <<<
        const { minGBP, maxGBP } = await fetchNiListingExtremesGBP();

        const kpis: NiKpis = {
          totalListings,
          avgGBP,
          avgEUR: avgGBP != null ? avgGBP * niFx : null,
          medianGBP: medGBP,
          medianEUR: medGBP != null ? medGBP * niFx : null,
          minGBP,
          minEUR: minGBP != null ? minGBP * niFx : null,
          maxGBP,
          maxEUR: maxGBP != null ? maxGBP * niFx : null,
        };
        if (!cancelled) setNiKpis(kpis);

        // GeoJSON overlay
        const res = await fetch("/data/ni_counties2.geojson");
        if (!res.ok) throw new Error("Failed to load NI counties GeoJSON");
        const gj = (await res.json()) as FeatureCollection;

        const joined = gj.features.map((f) => {
          const p = (f.properties ?? {}) as Record<string, any>;
          const raw = countyNameFromProps(p);
          const key = normalizeCountyName(raw);
          const stat = byCounty.get(key);
          return {
            ...f,
            properties: {
              ...p,
              __county: raw || titleizeCountyNI(key),
              __avg: stat?.avgEur ?? null,
              __cnt: stat?.cnt ?? null,
            },
          };
        });

        if (cancelled) return;
        setNiOverlayFC({ type: "FeatureCollection", features: joined });
        setNiExtraValues(extras);
      } catch (e: any) {
        if (!cancelled) {
          setNiErr(e?.message || "Failed to build NI overlay");
          setNiKpis(null);
        }
      } finally {
        if (!cancelled) setNiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [includeNI, niFx, mapMetric]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
      {/* ORANGE TOP LOADER */}
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
            includeNI={includeNI}
            setIncludeNI={setIncludeNI}
          />
        </div>
      </div>

      {/* Mobile filter bar */}
      <div className="lg:hidden top-[calc(var(--header-height,64px))] z-20 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 py-2 bg-neutral-900/90 backdrop-blur border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="text-xs text-neutral-400 flex-1 truncate">
            {selectedCounties.length ? selectedCounties.join(", ") : "No counties selected"}
            {trimEnabled ? " • Trim 5%" : ""}
            {includeNI ? " • NI On" : ""}
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
                  includeNI={includeNI}
                  setIncludeNI={setIncludeNI}
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
        {/* KPIs (ROI) */}
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

        {/* NI KPIs (second row) — min/max are TRUE listing extremes */}
        {includeNI && (
          <section className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
            <KPICard
              label="NI • Average Price"
              value={fmt(niKpis?.avgEUR ?? null)}
              icon={LineChart}
              loading={niLoading}
              sublabel={niErr ? <span className="text-red-400">{niErr}</span> : undefined}
            />
            <KPICard
              label="NI • Median Price"
              value={fmt(niKpis?.medianEUR ?? null)}
              icon={TrendingUp}
              loading={niLoading}
            />
            <KPICard
              label="NI • Total Listings"
              value={niKpis ? numFmt(niKpis.totalListings) : "—"}
              icon={Layers}
              loading={niLoading}
            />
          </section>
        )}

        {/* Map */}
        <section className="mt-6 md:mt-8 rounded-xl border border-neutral-800 bg-neutral-900 p-3 md:p-4">
          <div className="flex items-center justify-between mb-2">
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

            {/* RIGHT actions */}
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

              {/* ROI metric toggle */}
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

              {/* NI toggle above the map was removed */}
            </div>
          </div>

          <RoutingMap
            rows={(mapMetric === "price" ? avgRows : (rkEurPerSqmRows as any))}
            valueLabel={mapMetric === "price" ? "Avg Price" : "Avg €/m²"}
            valueFmt={mapMetric === "price" ? fmt : eurPerSqmFmt}
            // NI overlay when sidebar toggle is ON:
            extraValues={includeNI && mapMetric === "price" ? niExtraValues : undefined}
            niOverlay={includeNI && mapMetric === "price" ? niOverlayFC : null}
            niOverlayLabel="NI County Avg Price"
            niOverlayFmt={fmt}
          />

          {includeNI && mapMetric === "price" && (
            <div className="mt-2 text-[11px]">
              {niLoading ? (
                <span className="text-neutral-400">Loading NI overlay…</span>
              ) : niErr ? (
                <span className="text-red-400">NI overlay: {niErr}</span>
              ) : niOverlayFC ? (
                <span className="text-neutral-500">NI overlay ready</span>
              ) : (
                <span className="text-neutral-500">NI overlay off</span>
              )}
            </div>
          )}
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

        {/* Towns table */}
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
