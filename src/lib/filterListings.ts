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
  return null;
}

export function filterListings(all: Listing[], f: Filters): Listing[] {
  const forcedType = f.type === "rent" ? "rent" : "sale";

  return all.filter((l) => {
    const anyL = l as any;

    // ---- TYPE (sale|rent) ----
    const lType = typeof anyL.type === "string" ? String(anyL.type).toLowerCase() : undefined;
    if (lType && lType !== forcedType) return false;

    // ---- KIND (house|apartment) ----
    if (f.kind) {
      // try propertyType, then kind, then fall back to title sniff
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
      // if we can't infer a kind at all, we don't filter it out
    }

    // ---- COUNTY ----
    if (Array.isArray(f.counties) && f.counties.length) {
      const county = (anyL.county ?? "").toString().trim().toLowerCase();
      const ok = f.counties.some((c) => county === c.toLowerCase());
      if (!ok) return false;
    }

    // ---- SOURCES (Daft/MyHome) ----
    if (Array.isArray(f.sources) && f.sources.length) {
      const wanted = new Set(f.sources.map((s) => s.toLowerCase()));

      const names = new Set<string>();

      // primary URL
      try {
        const host = new URL((anyL.url ?? "") as string).host;
        const fromHost = hostToSourceName(host);
        if (fromHost) names.add(fromHost.toLowerCase());
      } catch {}

      // single string field e.g. "source": "MyHome"
      if (typeof anyL.source === "string" && anyL.source.trim()) {
        names.add(anyL.source.trim().toLowerCase());
      }

      // array of sources {name,url}
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

    return true;
  });
}
