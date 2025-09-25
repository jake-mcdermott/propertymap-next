// src/lib/insightsLocal.ts
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

export type TS =
  | { toMillis: () => number }
  | { seconds?: number; nanoseconds?: number }
  | number
  | null
  | undefined;

export type RawListing = {
  id?: string;
  title?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  price?: number | null | string;
  asking?: number | null | string;
  askingPrice?: number | null | string;
  priceEuro?: number | null | string;

  rent?: number | null | string;
  monthlyRent?: number | null | string;

  type?: string | null;
  saleOrRent?: string | null;
  listingType?: string | null;

  eircode?: string | null;
  routingKey?: string | null;
  rk?: string | null;

  county?: string | null;
  addressCounty?: string | null;
  adminCounty?: string | null;

  url?: string | null;
  image?: string | null;
  images?: string[] | null;
  sources?: { url?: string | null }[] | null;

  createdAt?: TS;
  updatedAt?: TS;
  ts?: TS;
  scrapedAt?: TS;
  seenAt?: TS;

  [k: string]: unknown;
};

export type AvgRow = { rk: string; county: string | null; avg: number; count: number; lat?: number | null; lng?: number | null };
export type LiveRow = { id?: string | null; title?: string | null; address?: string | null; price: number; county: string | null; rk: string | null; url: string | null; image: string | null };

export type ListingType = "sale" | "rent";

/* ---------------- helpers ---------------- */
export const canonicalCounty = (s?: string | null) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").replace(/\s+(city|county)$/g, "").trim();

const take3 = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

export function extractRKFrom(anyCode?: string | null): string | null {
  if (!anyCode) return null;
  const rk = take3(anyCode);
  return /^[A-Z0-9]{3}$/.test(rk) ? rk : null;
}
export function extractRK(d: RawListing): string | null {
  return extractRKFrom(d.rk) ?? extractRKFrom(d.routingKey) ?? extractRKFrom(d.eircode) ?? null;
}

export function parseMoneyLike(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function firstPrice(d: RawListing): number | null {
  const sale = parseMoneyLike(d.price) ?? parseMoneyLike(d.askingPrice) ?? parseMoneyLike(d.asking) ?? parseMoneyLike(d.priceEuro);
  if (sale != null) return sale;
  const rent = parseMoneyLike(d.rent) ?? parseMoneyLike(d.monthlyRent);
  return rent != null ? rent : null;
}

export function inferType(d: RawListing): ListingType {
  const raw = (d.type ?? d.saleOrRent ?? d.listingType ?? "").toString().toLowerCase();
  if (raw.includes("rent")) return "rent";
  if (raw.includes("sale") || raw === "") {
    if (d.rent != null || d.monthlyRent != null) return "rent";
    return "sale";
  }
  return (raw as ListingType) ?? "sale";
}

export function tsToMillis(t: TS): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t > 1e12 ? t : t * 1000;
  if (typeof t === "object") {
    // @ts-expect-error – Firestore Timestamp union
    if (typeof t.toMillis === "function") return t.toMillis();
    // @ts-expect-error – Firestore Timestamp union
    if (typeof t.seconds === "number") return t.seconds * 1000;
  }
  return null;
}

/* ------------- RK → county map (from /public) ------------- */
type RKCountyMap = Record<string, { county?: string | null }>;
let rkMapCache: RKCountyMap | null = null;

export async function loadRKCountyMap(): Promise<RKCountyMap> {
  if (rkMapCache) return rkMapCache;
  try {
    const res = await fetch("/data/routing_key_counties.json", { cache: "force-cache" });
    const raw = (await res.json()) as Record<string, any>;
    const out: RKCountyMap = {};
    for (const [k, v] of Object.entries(raw)) {
      const rk = take3(k);
      if (!rk) continue;
      const county = v && typeof v === "object" ? (v.county ?? v.County ?? v.COUNTY) : undefined;
      if (county) out[rk] = { county: String(county) };
    }
    rkMapCache = out;
  } catch {
    rkMapCache = {};
  }
  return rkMapCache!;
}

/* ---------------- listings snapshot parsing ---------------- */
export function collectListingsFromSnapshot(
  snap: { forEach: (cb: (doc: QueryDocumentSnapshot<DocumentData>) => void) => void }
): RawListing[] {
  const out: RawListing[] = [];
  const looksLikeListing = (v: unknown): v is RawListing =>
    !!v && typeof v === "object" && "lat" in (v as any) && "lng" in (v as any);

  snap.forEach((doc) => {
    if (doc.id === "_manifest") return;
    const data = doc.data() as unknown;

    if (data && typeof data === "object" && Array.isArray((data as any).items)) {
      for (const it of (data as any).items as unknown[]) if (looksLikeListing(it)) out.push(it as RawListing);
      return;
    }
    if (Array.isArray(data)) {
      for (const it of data as unknown[]) if (looksLikeListing(it)) out.push(it as RawListing);
      return;
    }
    if (looksLikeListing(data)) out.push(data as RawListing);
  });

  // optional: simple id-based dedupe
  const seen = new Set<string>();
  return out.filter((l) => (l.id && !seen.has(l.id) ? (seen.add(l.id), true) : !l.id));
}

/* ---------------- client-side aggregations ---------------- */
export async function buildMapAverages(
  listings: RawListing[],
  counties: string[],
  type: ListingType,
  opts: { maxAgeDays?: number } = {}
): Promise<AvgRow[]> {
  const maxAgeDays = opts.maxAgeDays ?? 90;
  const sinceMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const rkMap = await loadRKCountyMap();
  const filterSet = new Set(counties.map(canonicalCounty));

  type Acc = { sum: number; n: number; latSum: number; lngSum: number; county: string | null };
  const byRK = new Map<string, Acc>();

  for (const d of listings) {
    if (inferType(d) !== type) continue;

    const tms =
      tsToMillis(d.updatedAt) ?? tsToMillis(d.createdAt) ?? tsToMillis(d.ts) ?? tsToMillis(d.scrapedAt) ?? tsToMillis(d.seenAt);
    if (tms != null && tms < sinceMs) continue;

    const rk = extractRK(d);
    if (!rk) continue;

    const price = firstPrice(d);
    if (price == null || price <= 0) continue;

    const mappedCounty = rkMap[rk]?.county ? canonicalCounty(rkMap[rk]!.county) : null;
    const listingCounty =
      canonicalCounty(d.county) || canonicalCounty(d.addressCounty) || canonicalCounty(d.adminCounty) || null;
    const finalCounty = mappedCounty ?? listingCounty;

    if (filterSet.size && finalCounty && !filterSet.has(finalCounty)) continue;

    const lat = typeof d.lat === "number" ? d.lat : null;
    const lng = typeof d.lng === "number" ? d.lng : null;

    const acc = byRK.get(rk) || { sum: 0, n: 0, latSum: 0, lngSum: 0, county: finalCounty };
    acc.sum += price;
    acc.n += 1;
    if (lat != null && lng != null) {
      acc.latSum += lat;
      acc.lngSum += lng;
    }
    if (!acc.county && finalCounty) acc.county = finalCounty;
    byRK.set(rk, acc);
  }

  const rows: AvgRow[] = Array.from(byRK.entries()).map(([rk, a]) => ({
    rk,
    county: a.county,
    avg: Math.round(a.sum / a.n),
    count: a.n,
    lat: a.n ? a.latSum / a.n : null,
    lng: a.n ? a.lngSum / a.n : null,
  }));

  rows.sort((x, y) => y.avg - x.avg);
  return rows;
}

export async function buildLiveRows(
  listings: RawListing[],
  counties: string[],
  type: ListingType,
  opts: { maxAgeDays?: number } = {}
): Promise<LiveRow[]> {
  const maxAgeDays = opts.maxAgeDays ?? 90;
  const sinceMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  const rkMap = await loadRKCountyMap();
  const filterSet = new Set(counties.map(canonicalCounty));

  const bestByKey = new Map<string, LiveRow>();

  const getUrl = (l: RawListing): string | null =>
    (l.url || l.sources?.find((s) => s?.url)?.url || null) as string | null;

  for (const d of listings) {
    if (inferType(d) !== type) continue;

    const tms =
      tsToMillis(d.updatedAt) ?? tsToMillis(d.createdAt) ?? tsToMillis(d.ts) ?? tsToMillis(d.scrapedAt) ?? tsToMillis(d.seenAt);
    if (tms != null && tms < sinceMs) continue;

    const rk = extractRK(d);
    const price = firstPrice(d);
    if (price == null || price <= 0) continue;

    const mappedCounty = rk ? (rkMap[rk]?.county ? canonicalCounty(rkMap[rk]!.county) : null) : null;
    const listingCounty =
      canonicalCounty(d.county) || canonicalCounty(d.addressCounty) || canonicalCounty(d.adminCounty) || null;
    const finalCounty = mappedCounty ?? listingCounty;

    if (filterSet.size && finalCounty && !filterSet.has(finalCounty)) continue;

    const id = d.id ?? null;
    const url = (() => {
      const u = getUrl(d);
      if (!u) return null;
      try {
        const x = new URL(u);
        x.hash = ""; x.search = "";
        const host = x.host.replace(/^www\./, "").toLowerCase();
        return `${x.protocol}//${host}${x.pathname}`.replace(/\/+$/, "");
      } catch { return u.trim(); }
    })();

    const titleNorm = (d.title || d.address || "").toLowerCase().replace(/\s+/g, " ").trim();
    const key = id || url || `${rk ?? "UNK"}|${price}|${titleNorm.slice(0, 80)}`;

    const row: LiveRow = {
      id,
      title: (d.title as string) ?? d.address ?? null,
      address: (d.address as string) ?? d.title ?? null,
      price,
      county: finalCounty,
      rk: rk ?? null,
      url,
      image: (d.image as string) ?? (Array.isArray(d.images) ? (d.images?.[0] as string) : null) ?? null,
    };

    const prev = bestByKey.get(key);
    if (!prev || row.price > prev.price) {
      bestByKey.set(key, row);
    } else {
      // merge media if previous lacked them
      if (!prev.url && row.url) prev.url = row.url;
      if (!prev.image && row.image) prev.image = row.image;
      if (!prev.title && row.title) prev.title = row.title;
      bestByKey.set(key, prev);
    }
  }

  return Array.from(bestByKey.values());
}

export function weightedMedian(rows: AvgRow[]): number | null {
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
