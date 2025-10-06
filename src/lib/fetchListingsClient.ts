// src/lib/fetchListingsClient.ts
"use client";

import { db } from "./firebaseClient";
import { collection, getDocs, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import type { Listing } from "@/lib/types";
import type { Filters } from "@/lib/filters";

const L = (...args: any[]) => console.log("[fetchListingsClient]", ...args);
const E = (...args: any[]) => console.error("[fetchListingsClient]", ...args);

const MAP_COLL =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.NEXT_PUBLIC_MAP_COLL || process.env.MAP_COLL)) ||
  "map-listings";

/* ---------------- shape helpers (unchanged) ---------------- */
type GeoPointLike = { latitude: number; longitude: number };
const isGeoPointLike = (v: unknown): v is GeoPointLike =>
  !!v && typeof v === "object" && typeof (v as any).latitude === "number" && typeof (v as any).longitude === "number";

const numOrNull = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v)
    ? v
    : typeof v === "string" && Number.isFinite(Number(v.trim()))
    ? Number(v.trim())
    : null;

function coerceLatLng(it: any): { lat: number | null; lng: number | null } {
  if (isGeoPointLike(it)) return { lat: it.latitude, lng: it.longitude };
  if (isGeoPointLike(it?.location)) return { lat: it.location.latitude, lng: it.location.longitude };
  return { lat: numOrNull(it?.lat), lng: numOrNull(it?.lng) };
}

function ensureId(it: any): string | null {
  if (typeof it?.id === "string" && it.id.trim()) return it.id.trim();
  if (typeof it?.eircode === "string" && it.eircode.trim()) return it.eircode.trim();
  if (typeof it?.address === "string" && it.address.trim()) return it.address.trim();
  const { lat, lng } = coerceLatLng(it);
  if (lat != null && lng != null) return `${lat.toFixed(6)},${lng.toFixed(6)}`;
  return null;
}

function looksLikeListingLoose(v: unknown): v is Listing {
  if (!v || typeof v !== "object") return false;
  const { lat, lng } = coerceLatLng(v as any);
  return lat != null && lng != null;
}

/* ---------------- predicate builder (unchanged) ---------------- */
const lower = (s?: string | null) => (s ?? "").normalize("NFKD").toLowerCase().trim();

export function buildFilterPredicate(f?: Filters) {
  if (!f) return (_l: Listing) => true;

  const type = f.type;
  const kind = f.kind;
  const sources = new Set((f.sources ?? []).map(lower));
  const counties = new Set((f.counties ?? []).map(lower));
  const towns = new Set((f.towns ?? []).map(lower));

  const bedsMin = f.bedsMin ?? null;
  const bedsMax = f.bedsMax ?? null;
  const priceMin = f.priceMin ?? null;
  const priceMax = f.priceMax ?? null;

  const useUnionForLocation = true;

  return (l: Listing) => {
    if (type && lower((l as any).type) !== lower(type)) return false;
    if (kind && lower((l as any).kind) !== lower(kind)) return false;

    const beds = numOrNull((l as any).beds);
    if (bedsMin != null && (beds == null || beds < bedsMin)) return false;
    if (bedsMax != null && (beds == null || beds > bedsMax)) return false;

    const price = numOrNull((l as any).price);
    if (priceMin != null && (price == null || price < priceMin)) return false;
    if (priceMax != null && (price == null || price > priceMax)) return false;

    if (sources.size) {
      const src = lower((l as any).source);
      if (!sources.has(src)) return false;
    }

    if (counties.size || towns.size) {
      const county = lower((l as any).county);
      const town = lower((l as any).town);
      const address = lower((l as any).address);

      const matchCounty = county && counties.has(county);
      const matchTown = town && towns.has(town);
      const fallbackCounty = !county && address && [...counties].some((c) => c && address.includes(c));
      const fallbackTown   = !town   && address && [...towns].some((t) => t && address.includes(t));

      const hasCounty = matchCounty || fallbackCounty;
      const hasTown   = matchTown   || fallbackTown;

      if (useUnionForLocation) {
        if (!(hasCounty || hasTown)) return false;
      } else {
        if (counties.size && !hasCounty) return false;
        if (towns.size && !hasTown) return false;
      }
    }

    return true;
  };
}

/* ---------------- NEW: raw unfiltered fetcher ---------------- */
/** Pulls and de-dupes ALL listings. No filtering. */
export async function fetchAllListingsRaw(): Promise<Listing[]> {
  const t0 = performance.now();
  L("RAW BEGIN", { coll: MAP_COLL });

  if (!db) {
    E("Firebase 'db' is undefined. Check firebaseClient initialization.");
    return [];
  }

  const snap = await getDocs(collection(db, MAP_COLL));
  L("getDocs() resolved", { size: snap.size });

  const out: Listing[] = [];
  let shardDocs = 0, arrayDocs = 0, manifestDocs = 0, otherDocs = 0;
  let totalFromShards = 0, totalFromArrays = 0, invalidItems = 0;

  snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
    if (doc.id === "_manifest") { manifestDocs++; return; }
    const data = doc.data() as unknown;

    if (data && typeof data === "object" && Array.isArray((data as any).items)) {
      shardDocs++;
      const items = (data as any).items as unknown[];
      totalFromShards += items.length;

      for (const raw of items) {
        if (!looksLikeListingLoose(raw)) { invalidItems++; continue; }
        const { lat, lng } = coerceLatLng(raw as any);
        const id = ensureId(raw as any);
        if (!id) { invalidItems++; continue; }
        out.push({ ...(raw as any), id, lat: lat!, lng: lng! });
      }
      return;
    }

    if (Array.isArray(data)) {
      arrayDocs++;
      totalFromArrays += data.length;

      for (const raw of data) {
        if (!looksLikeListingLoose(raw)) { invalidItems++; continue; }
        const { lat, lng } = coerceLatLng(raw as any);
        const id = ensureId(raw as any);
        if (!id) { invalidItems++; continue; }
        out.push({ ...(raw as any), id, lat: lat!, lng: lng! });
      }
      return;
    }

    otherDocs++;
  });

  // de-dupe by id
  const seen = new Set<string>();
  const deduped = out.filter((l) => (l?.id && !seen.has(l.id) ? (seen.add(l.id), true) : false));

  const t1 = performance.now();
  L("RAW END", {
    ms: Math.round(t1 - t0),
    shardDocs, arrayDocs, manifestDocs, otherDocs,
    totalFromShards, totalFromArrays, invalidItems,
    totalRaw: out.length, deduped: deduped.length,
  });

  return deduped;
}

/* ---------------- Filtered wrapper (keeps your old API) ---------------- */
export async function fetchListingsClient(filters?: Filters): Promise<Listing[]> {
  const all = await fetchAllListingsRaw();
  const pred = buildFilterPredicate(filters);
  return all.filter(pred);
}
