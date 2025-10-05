// src/lib/filterListings.ts
import type { Filters } from "./filters";
import type { Listing } from "@/lib/types";

/** Normalize to "MyHome" from a URL host */
function hostToSourceName(host?: string | null): string | null {
  if (!host) return null;
  const h = host.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase();
  if (h.includes("sherryfitz")) return "SherryFitz";
  if (h.includes("dng")) return "DNG";
  if (h.includes("findqo")) return "FindQo";
  if (h.includes("myhome")) return "MyHome";
  if (h.includes("westcorkproperty")) return "West Cork Property";
  if (h.includes("michelleburke")) return "Michelle Burke";
  if (h.includes("zoopla")) return "Zoopla";
  return null;
}

// shared helpers
const norm = (s?: string | null) => (s ?? "").normalize("NFKD").toLowerCase();
const tokenize = (s?: string | null) =>
  norm(s).replace(/['’]/g, "").split(/[^a-z]+/).filter(Boolean);

/** exact token/phrase match (handles multi-word towns) */
function addressContainsName(addr?: string | null, name?: string | null): boolean {
  const A = tokenize(addr);
  const N = tokenize(name);
  if (!A.length || !N.length) return false;
  for (let i = 0; i <= A.length - N.length; i++) {
    let ok = true;
    for (let j = 0; j < N.length; j++) {
      if (A[i + j] !== N[j]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

// Convert various size fields to a single number in m²
function extractSizeSqm(anyL: any): number | undefined {
  const direct =
    typeof anyL.sizeSqm === "number" ? anyL.sizeSqm :
    typeof anyL.sqm === "number" ? anyL.sqm :
    typeof anyL.floorAreaSqm === "number" ? anyL.floorAreaSqm :
    undefined;
  if (Number.isFinite(direct)) return direct as number;

  // Common string fields
  const s: string | undefined =
    typeof anyL.sizeSqm === "string" ? anyL.sizeSqm :
    typeof anyL.sqm === "string" ? anyL.sqm :
    typeof anyL.floorArea === "string" ? anyL.floorArea :
    typeof anyL.size === "string" ? anyL.size :
    undefined;
  if (!s) return undefined;

  const txt = String(s).toLowerCase();

  // Find all numbers (including ranges). Keep the largest (usually total).
  const nums = (txt.match(/[\d,.]+/g) || [])
    .map(t => Number(t.replace(/,/g, "")))
    .filter(n => Number.isFinite(n)) as number[];
  if (!nums.length) return undefined;
  const n = Math.max(...nums);

  // Unit heuristics
  // If mentions ft or sq ft/sqft/ft² -> convert to m²
  const isSqft = /\b(ft|sq\s?ft|ft²|sqft)\b/.test(txt);
  const isSqm  = /\b(m2|m²|\bsqm\b)\b/.test(txt);

  if (isSqft) return n / 10.7639;           // ft² → m²
  if (isSqm)  return n;                      // already m²

  // If unit unknown: guess. If value is big (e.g. > 300) it's likely ft²
  if (n > 300) return n / 10.7639;          // heuristic
  return n;                                  // otherwise assume m²
}

export function filterListings(all: Listing[], f: Filters): Listing[] {
  const forcedType = f.type === "rent" ? "rent" : "sale";

  // Precompute lowercase lookups once
  const wantCounties = (f.counties ?? []).map((c) => c.toLowerCase());
  const wantTowns = (f.towns ?? []).map((t) => t.toLowerCase());
  const hasCountyFilter = wantCounties.length > 0;
  const hasTownFilter = wantTowns.length > 0;

  return all.filter((l) => {
    const anyL = l as any;

    // ---- TYPE (sale|rent) ----
    const lType = typeof anyL.type === "string" ? String(anyL.type).toLowerCase() : undefined;
    if (lType && lType !== forcedType) return false;

    // ---- KIND (house|apartment) ----
    if (f.kind) {
      const rawKind: string | undefined =
        (typeof anyL.propertyType === "string" && anyL.propertyType) ||
        (typeof anyL.kind === "string" && anyL.kind) ||
        undefined;

      let normalizedKind: "house" | "apartment" | undefined;
      if (rawKind) {
        const rk = rawKind.toLowerCase();
        if (rk.includes("apartment") || rk === "apt") normalizedKind = "apartment";
        else if (rk.includes("house") || rk.includes("detached") || rk.includes("semi")) normalizedKind = "house";
      } else if (typeof anyL.title === "string") {
        const t = anyL.title.toLowerCase();
        if (t.includes("apartment")) normalizedKind = "apartment";
        else if (t.includes("house")) normalizedKind = "house";
      }

      if (normalizedKind && normalizedKind !== f.kind) return false;
    }

    // ---- LOCATION (County ∪ Town) ----
    if (hasCountyFilter || hasTownFilter) {
      const county = (anyL.county ?? "").toString().trim().toLowerCase();
      const town   = (anyL.town ?? "").toString().trim().toLowerCase();
      const addr   = (anyL.address ?? "").toString().trim().toLowerCase();

      const countyHit =
        (county && wantCounties.includes(county)) ||
        (!county && addr && wantCounties.some((c) => addr.includes(c)));

      const townHit =
        (town && wantTowns.includes(town)) ||
        (!town && addr && wantTowns.some((t) => addressContainsName(addr, t)));

      if (!(countyHit || townHit)) return false; // OR semantics
    }

    // ---- SOURCES ----
    if (Array.isArray(f.sources) && f.sources.length) {
      const wanted = new Set(f.sources.map((s) => s.toLowerCase()));
      const names = new Set<string>();

      try {
        const host = new URL((anyL.url ?? "") as string).host;
        const fromHost = hostToSourceName(host);
        if (fromHost) names.add(fromHost.toLowerCase());
      } catch {}

      if (typeof anyL.source === "string" && anyL.source.trim()) {
        names.add(anyL.source.trim().toLowerCase());
      }

      if (Array.isArray(anyL.sources)) {
        for (const s of anyL.sources) {
          if (s?.name) names.add(String(s.name).trim().toLowerCase());
          if (s?.url) {
            try {
              const h = new URL(s.url).host;
              const n = hostToSourceName(h);
              if (n) names.add(n.toLowerCase());
            } catch {}
          }
        }
      }

      const hit = Array.from(names).some((n) => wanted.has(n));
      if (!hit) return false;
    }

    // ---- BEDS ----
    const beds = typeof anyL.beds === "number" ? anyL.beds : undefined;
    if (f.bedsMin != null && (beds ?? 0) < f.bedsMin) return false;
    if (f.bedsMax != null && (beds ?? 99) > f.bedsMax) return false;

    // ---- PRICE ----
    const price = typeof anyL.price === "number" ? anyL.price : undefined;
    if (f.priceMin != null && (price ?? 0) < f.priceMin) return false;
    if (f.priceMax != null && (price ?? 9e99) > f.priceMax) return false;

    // ✅ NEW — SIZE (m²). Your listings use sizeSqm (number)
    const sizeSqm = extractSizeSqm(anyL);
    if (f.sqmMin != null && (sizeSqm ?? 0) < f.sqmMin) return false;
    if (f.sqmMax != null && (sizeSqm ?? 9e9) > f.sqmMax) return false;
    
    return true;
  });
}
