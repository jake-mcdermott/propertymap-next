export type ListingType = "sale" | "rent";
export type PropertyKind = "house" | "apartment";
export type Filters = {
  type?: ListingType;          // sale | rent (default sale)
  kind?: PropertyKind;         // house | apartment
  counties?: string[];         // multi
  sources?: string[];          // multi (e.g. ["Daft","MyHome"])
  bedsMin?: number;
  bedsMax?: number;
  priceMin?: number;
  priceMax?: number;

  // map/view keys (optional)
  lat?: number; lng?: number; zoom?: number;
  bbox?: [number, number, number, number];
};

export const IRELAND_COUNTIES = [
  "Carlow","Cavan","Clare","Cork","Donegal","Dublin","Galway","Kerry","Kildare",
  "Kilkenny","Laois","Leitrim","Limerick","Longford","Louth","Mayo","Meath",
  "Monaghan","Offaly","Roscommon","Sligo","Tipperary","Waterford","Westmeath",
  "Wexford","Wicklow",
];

export const AVAILABLE_SOURCES = ["Daft","MyHome","FindQo"]; // extend as needed

export const priceDomain = (type: ListingType) => {
  const isRent = type === "rent";
  return { min: 0, max: isRent ? 5_000 : 1_500_000, step: isRent ? 50 : 5_000 };
};

export const bedsLabel = (n: number) => (n === 6 ? "6+" : String(n));

/* ---------- URL <-> Filters ---------- */

const parseNum = (v: string | null): number | undefined => {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const parseCSV = (v: string | null): string[] | undefined => {
  if (!v) return undefined;
  const arr = v.split(",").map(s => s.trim()).filter(Boolean);
  return arr.length ? Array.from(new Set(arr)) : undefined;
};

export function searchParamsToFilters(sp: URLSearchParams): Filters {
  const type = sp.get("type") === "rent" ? "rent" : "sale";

  return {
    type,
    kind: ((): PropertyKind | undefined => {
      const k = sp.get("kind");
      return k === "house" || k === "apartment" ? k : undefined;
    })(),
    counties: parseCSV(sp.get("counties")),
    sources: parseCSV(sp.get("sources")),
    bedsMin: parseNum(sp.get("bedsMin")),
    bedsMax: parseNum(sp.get("bedsMax")),
    priceMin: parseNum(sp.get("priceMin")),
    priceMax: parseNum(sp.get("priceMax")),
    lat: parseNum(sp.get("lat")),
    lng: parseNum(sp.get("lng")),
    zoom: parseNum(sp.get("zoom")),
    bbox: ((): [number,number,number,number] | undefined => {
      const v = sp.get("bbox");
      if (!v) return undefined;
      const parts = v.split(",").map(Number);
      return parts.length === 4 && parts.every(Number.isFinite)
        ? [parts[0],parts[1],parts[2],parts[3]] : undefined;
    })(),
  };
}

export function filtersToSearchParams(f: Filters, base?: URLSearchParams) {
  const sp = base ? new URLSearchParams(base) : new URLSearchParams();

  const set = (k: string, v?: string | number | null) => {
    if (v == null || v === "") sp.delete(k);
    else sp.set(k, String(v));
  };
  const setCSV = (k: string, arr?: string[]) => {
    if (!arr || !arr.length) sp.delete(k);
    else set(k, arr.join(","));
  };

  set("type", (f.type ?? "sale"));
  set("kind", f.kind ?? "");
  setCSV("counties", f.counties);
  setCSV("sources", f.sources);
  set("bedsMin", f.bedsMin ?? "");
  set("bedsMax", f.bedsMax ?? "");
  set("priceMin", f.priceMin ?? "");
  set("priceMax", f.priceMax ?? "");
  set("lat", f.lat ?? "");
  set("lng", f.lng ?? "");
  set("zoom", f.zoom ?? "");
  set("bbox", f.bbox ? f.bbox.join(",") : "");
  return sp;
}

/* ---------- UI helpers ---------- */

export function deriveEffective(f: Filters) {
  const enforcedType: ListingType = f.type === "rent" ? "rent" : "sale";
  const isRent = enforcedType === "rent";
  const dom = priceDomain(enforcedType);

  const bedsMinEff = Math.max(0, Math.min(6, f.bedsMin ?? 0));
  const bedsMaxEff = Math.max(0, Math.min(6, f.bedsMax ?? 6));
  const priceMinEff = Math.max(dom.min, Math.min(dom.max, f.priceMin ?? dom.min));
  const priceMaxEff = Math.max(dom.min, Math.min(dom.max, f.priceMax ?? dom.max));

  return { enforcedType, isRent, bedsMinEff, bedsMaxEff, priceMinEff, priceMaxEff, dom };
}
