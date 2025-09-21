export type TS =
  | { toMillis: () => number }
  | { seconds?: number; nanoseconds?: number }
  | number
  | null
  | undefined;

export type RawListing = {
  id?: string;
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

  createdAt?: TS;
  updatedAt?: TS;
  ts?: TS;
  scrapedAt?: TS;
  seenAt?: TS;

  [k: string]: unknown;
};

export function canonicalCounty(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(city|county)$/g, "")
    .trim();
}

export function extractRKFrom(anyCode?: string | null): string | null {
  if (!anyCode) return null;
  const rk = anyCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return /^[A-Z0-9]{3}$/.test(rk) ? rk : null;
}

export function extractRK(d: RawListing): string | null {
  return (
    extractRKFrom(d.rk) ??
    extractRKFrom(d.routingKey) ??
    extractRKFrom(d.eircode) ??
    null
  );
}

export function parseMoneyLike(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export type ListingType = "sale" | "rent";

export function inferType(d: RawListing): ListingType {
  const raw = (d.type ?? d.saleOrRent ?? d.listingType ?? "").toString().toLowerCase();
  if (raw.includes("rent")) return "rent";
  if (raw.includes("sale") || raw === "") {
    if (d.rent != null || d.monthlyRent != null) return "rent";
    return "sale";
  }
  return (raw as ListingType) ?? "sale";
}

export function firstPrice(d: RawListing): number | null {
  const sale =
    parseMoneyLike(d.price) ??
    parseMoneyLike(d.askingPrice) ??
    parseMoneyLike(d.asking) ??
    parseMoneyLike(d.priceEuro);
  if (sale != null) return sale;

  const rent = parseMoneyLike(d.rent) ?? parseMoneyLike(d.monthlyRent);
  return rent != null ? rent : null;
}

/** Narrowing helpers (so no ts-ignore needed) */
function hasToMillis(x: unknown): x is { toMillis: () => number } {
  return !!x && typeof (x as any).toMillis === "function";
}
function hasSeconds(x: unknown): x is { seconds: number } {
  return !!x && typeof (x as any).seconds === "number";
}

export function tsToMillis(t: TS): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t > 1e12 ? t : t * 1000;
  if (hasToMillis(t)) return t.toMillis();
  if (hasSeconds(t)) return t.seconds * 1000;
  return null;
}
