// src/lib/fetchListingsClient.ts
"use client";

import { db } from "./firebaseClient";
import { collection, getDocs, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import type { Listing } from "@/lib/types";
import type { Filters } from "@/lib/filters";

// Hard logging helpers (ignore dlog/dgroup completely here)
const L = (...args: any[]) => console.log("[fetchListingsClient]", ...args);
const E = (...args: any[]) => console.error("[fetchListingsClient]", ...args);

const MAP_COLL =
  (typeof process !== "undefined" &&
    process.env &&
    (process.env.NEXT_PUBLIC_MAP_COLL || process.env.MAP_COLL)) ||
  "map-listings";

// --- shape helpers ----------------------------------------------------
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

// --- filter helpers ---------------------------------------------------
const lower = (s?: string | null) => (s ?? "").normalize("NFKD").toLowerCase().trim();

function buildFilterPredicate(f?: Filters) {
  if (!f) {
    return (_l: Listing) => true;
  }

  // Normalize sets
  const type = f.type;
  const kind = f.kind;
  const sources = new Set((f.sources ?? []).map(lower));
  const counties = new Set((f.counties ?? []).map(lower));
  const towns = new Set((f.towns ?? []).map(lower));

  const bedsMin = f.bedsMin ?? null;
  const bedsMax = f.bedsMax ?? null;
  const priceMin = f.priceMin ?? null;
  const priceMax = f.priceMax ?? null;

  // location mode: OR by default (county OR town)
  const useUnionForLocation = true;

  return (l: Listing) => {
    // Type
    if (type && lower((l as any).type) !== lower(type)) return false;

    // Property kind
    if (kind && lower((l as any).kind) !== lower(kind)) return false;

    // Beds
    const beds = numOrNull((l as any).beds);
    if (bedsMin != null && (beds == null || beds < bedsMin)) return false;
    if (bedsMax != null && (beds == null || beds > bedsMax)) return false;

    // Price
    const price = numOrNull((l as any).price);
    if (priceMin != null && (price == null || price < priceMin)) return false;
    if (priceMax != null && (price == null || price > priceMax)) return false;

    // Sources
    if (sources.size) {
      const src = lower((l as any).source);
      if (!sources.has(src)) return false;
    }

    // Location: counties / towns
    if (counties.size || towns.size) {
      const county = lower((l as any).county);
      const town = lower((l as any).town);
      const address = lower((l as any).address);

      // Primary exact matches
      const matchCounty = county && counties.has(county);
      const matchTown = town && towns.has(town);

      // Fallback: if missing county/town fields, best-effort contains search in address
      const fallbackCounty =
        !county && address && [...counties].some((c) => c && address.includes(c));
      const fallbackTown =
        !town && address && [...towns].some((t) => t && address.includes(t));

      const hasCounty = matchCounty || fallbackCounty;
      const hasTown = matchTown || fallbackTown;

      if (useUnionForLocation) {
        if (!(hasCounty || hasTown)) return false; // need either
      } else {
        if (counties.size && !hasCounty) return false; // AND semantics if you flip the flag
        if (towns.size && !hasTown) return false;
      }
    }

    return true;
  };
}

// --- main -------------------------------------------------------------
/**
 * Fetch all listing shards (client) and filter in-memory.
 * @param filters Optional Filters to apply (type, kind, beds, price, sources, counties, towns)
 */
export async function fetchListingsClient(filters?: Filters): Promise<Listing[]> {
  const t0 = performance.now();
  L("BEGIN", { coll: MAP_COLL, withFilters: !!filters });

  try {
    // Sanity: db presence
    if (!db) {
      E("Firebase 'db' is undefined. Check firebaseClient initialization.");
      return [];
    }

    L("Calling getDocs()");
    const snap = await getDocs(collection(db, MAP_COLL));
    L("getDocs() resolved", { size: snap.size });

    const out: Listing[] = [];
    const docIds: string[] = [];

    let shardDocs = 0, arrayDocs = 0, manifestDocs = 0, otherDocs = 0;
    let totalFromShards = 0, totalFromArrays = 0, invalidItems = 0;

    snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      docIds.push(doc.id);
      if (doc.id === "_manifest") { manifestDocs++; return; }

      const data = doc.data() as unknown;

      // Shard shape
      if (data && typeof data === "object" && Array.isArray((data as any).items)) {
        shardDocs++;
        const items = (data as any).items as unknown[];
        totalFromShards += items.length;

        let added = 0, rejected = 0;
        for (const raw of items) {
          if (!looksLikeListingLoose(raw)) { invalidItems++; rejected++; continue; }
          const { lat, lng } = coerceLatLng(raw as any);
          const id = ensureId(raw as any);
          if (!id) { invalidItems++; rejected++; continue; }
          out.push({ ...(raw as any), id, lat: lat!, lng: lng! });
          added++;
        }
        L("Shard processed", { docId: doc.id, items: items.length, added, rejected });
        return;
      }

      // Array doc fallback
      if (Array.isArray(data)) {
        arrayDocs++;
        totalFromArrays += data.length;

        let added = 0, rejected = 0;
        for (const raw of data) {
          if (!looksLikeListingLoose(raw)) { invalidItems++; rejected++; continue; }
          const { lat, lng } = coerceLatLng(raw as any);
          const id = ensureId(raw as any);
          if (!id) { invalidItems++; rejected++; continue; }
          out.push({ ...(raw as any), id, lat: lat!, lng: lng! });
          added++;
        }
        L("Array doc processed", { docId: doc.id, items: data.length, added, rejected });
        return;
      }

      // Unknown shape
      otherDocs++;
      const keys = data && typeof data === "object" ? Object.keys(data as object) : [];
      L("Doc unexpected shape", { docId: doc.id, keys: keys.slice(0, 12) });
    });

    // de-dupe by id
    const seen = new Set<string>();
    const deduped = out.filter((l) => (l?.id && !seen.has(l.id) ? (seen.add(l.id), true) : false));

    // Apply filters (client-side)
    const pred = buildFilterPredicate(filters);
    const filtered = deduped.filter(pred);

    const t1 = performance.now();
    L("END", {
      ms: Math.round(t1 - t0),
      docs: snap.size,
      docIds: docIds.slice(0, 30),
      shardDocs, arrayDocs, manifestDocs, otherDocs,
      totalFromShards, totalFromArrays, invalidItems,
      totalRaw: out.length, deduped: deduped.length, filtered: filtered.length,
      filters: filters ? {
        type: filters.type, kind: filters.kind,
        counties: filters.counties?.length, towns: filters.towns?.length,
        bedsMin: filters.bedsMin, bedsMax: filters.bedsMax,
        priceMin: filters.priceMin, priceMax: filters.priceMax,
        sources: filters.sources?.length
      } : undefined
    });

    return filtered;
  } catch (err) {
    E("getDocs failed", err);
    throw err;
  }
}
