import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/firebaseClient";
import { collection, getDocs, type QueryDocumentSnapshot, type DocumentData } from "firebase/firestore";
import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

/* ---------------- types ---------------- */
type TS =
  | { toMillis: () => number }
  | { seconds?: number; nanoseconds?: number }
  | number
  | null
  | undefined;

type Listing = {
  id?: string;
  lat?: number | null;
  lng?: number | null;
  price?: number | null;
  asking?: number | null;
  askingPrice?: number | null;
  priceEuro?: number | null;
  rent?: number | null;
  monthlyRent?: number | null;
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

/* ---------------- helpers ---------------- */
const take3 = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);

function extractRK(d: Listing): string | null {
  const cand = d.rk ?? d.routingKey ?? d.eircode;
  if (!cand) return null;
  const v = take3(String(cand));
  return /^[A-Z0-9]{3}$/.test(v) ? v : null;
}

function canonicalCounty(s?: string | null) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\s+(city|county)$/g, "")
    .trim();
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function firstPrice(d: Listing): number | null {
  const sale = num(d.price) ?? num(d.askingPrice) ?? num(d.asking) ?? num(d.priceEuro);
  if (sale != null) return sale;
  const rent = num(d.rent) ?? num(d.monthlyRent);
  return rent != null ? rent : null;
}

function inferType(d: Listing): "sale" | "rent" {
  const raw = (d.type ?? d.saleOrRent ?? d.listingType ?? "").toString().toLowerCase();
  if (raw.includes("rent")) return "rent";
  if (raw.includes("sale") || raw === "") {
    if (d.rent != null || d.monthlyRent != null) return "rent";
    return "sale";
  }
  return raw as any;
}

function tsToMillis(t: TS): number | null {
  if (t == null) return null;
  if (typeof t === "number") return t > 1e12 ? t : t * 1000;
  if (typeof t === "object") {
    if ("toMillis" in (t as any) && typeof (t as any).toMillis === "function") {
      return (t as any).toMillis();
    }
    if ("seconds" in (t as any) && typeof (t as any).seconds === "number") {
      return (t as any).seconds * 1000;
    }
  }
  return null;
}

/* ---------------- routing-key → county map (cached) ---------------- */
type RKCountyMap = Record<string, { county?: string | null }>;

let rkCountyCache: RKCountyMap | null = null;
async function getRKCountyMap(): Promise<RKCountyMap> {
  if (rkCountyCache) return rkCountyCache;
  try {
    const p = path.join(process.cwd(), "public", "data", "routing_key_counties.json");
    const txt = await fs.readFile(p, "utf8");
    const raw = JSON.parse(txt) as Record<string, any>;
    const out: RKCountyMap = {};
    for (const [k, v] of Object.entries(raw)) {
      const rk = take3(k);
      if (!rk) continue;
      const county = v && typeof v === "object" ? (v.county ?? v.County ?? v.COUNTY) : undefined;
      if (county) out[rk] = { county: String(county) };
    }
    rkCountyCache = out;
  } catch (e) {
    console.warn("[map-averages] Could not read routing_key_counties.json:", e);
    rkCountyCache = {};
  }
  return rkCountyCache!;
}

/* ---------------- API ---------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const wantedType = (searchParams.get("type") ?? "sale").toLowerCase() === "rent" ? "rent" : "sale";

    // Live data only
    const maxAgeDays = 90;
    const sinceMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const countiesParam = searchParams.get("counties");
    const countiesFilter =
      countiesParam && countiesParam.trim()
        ? new Set(
            countiesParam
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
              .map(canonicalCounty)
          )
        : null;

    const debug = searchParams.get("debug") === "1";

    const rkMap = await getRKCountyMap();

    // Pull all shards
    const snap = await getDocs(collection(db, "map-listings"));

    type Acc = { sum: number; n: number; latSum: number; lngSum: number; county: string | null };
    const byRK = new Map<string, Acc>();

    let scannedDocs = 0;
    let scannedItems = 0;
    let matchedItems = 0;

    const looksLikeListing = (v: unknown): v is Listing =>
      !!v && typeof v === "object" && "lat" in (v as any) && "lng" in (v as any);

    const consume = (d: Listing) => {
      scannedItems++;

      if (inferType(d) !== wantedType) return;

      const tms =
        tsToMillis(d.updatedAt) ??
        tsToMillis(d.createdAt) ??
        tsToMillis(d.ts) ??
        tsToMillis(d.scrapedAt) ??
        tsToMillis(d.seenAt);
      if (tms != null && tms < sinceMs) return;

      const rk = extractRK(d);
      if (!rk) return;

      const price = firstPrice(d);
      if (price == null || price <= 0) return;

      // STRICT county resolution:
      const mappedCounty = rkMap[rk]?.county ? canonicalCounty(rkMap[rk]!.county) : null;

      // If we have a mapped county and a county filter, enforce it strictly.
      if (countiesFilter && mappedCounty && !countiesFilter.has(mappedCounty)) {
        return; // drop even if listing claims another county
      }

      // If mapping missing, fall back to listing county (so RK not in the file can still appear)
      const listingCounty =
        canonicalCounty(d.county) ||
        canonicalCounty(d.addressCounty) ||
        canonicalCounty(d.adminCounty) ||
        null;

      const finalCounty = mappedCounty ?? listingCounty;

      // Apply filter if we still have one
      if (countiesFilter && finalCounty && !countiesFilter.has(finalCounty)) return;

      const lat = num(d.lat);
      const lng = num(d.lng);

      const acc = byRK.get(rk) || { sum: 0, n: 0, latSum: 0, lngSum: 0, county: finalCounty };
      acc.sum += price;
      acc.n += 1;
      if (lat != null && lng != null) {
        acc.latSum += lat;
        acc.lngSum += lng;
      }
      if (!acc.county && finalCounty) acc.county = finalCounty;
      byRK.set(rk, acc);
      matchedItems++;
    };

    snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      scannedDocs++;
      if (doc.id === "_manifest") return;
      const data = doc.data();

      if (data && typeof data === "object" && Array.isArray((data as any).items)) {
        for (const it of (data as any).items as unknown[]) if (looksLikeListing(it)) consume(it as Listing);
        return;
      }
      if (Array.isArray(data)) {
        for (const it of data as unknown[]) if (looksLikeListing(it)) consume(it as Listing);
        return;
      }
      if (looksLikeListing(data)) consume(data as Listing);
    });

    const rows = Array.from(byRK.entries()).map(([rk, a]) => ({
      rk,
      county: a.county,
      avg: Math.round(a.sum / a.n),
      count: a.n,
      lat: a.n ? a.latSum / a.n : null,
      lng: a.n ? a.lngSum / a.n : null,
    }));

    rows.sort((x, y) => y.avg - x.avg);

    if (debug) {
      return NextResponse.json(
        {
          scannedDocs,
          scannedItems,
          matchedItems,
          distinctRKs: rows.length,
          sample: rows.slice(0, 5),
        },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            Pragma: "no-cache",
            Expires: "0",
            "Vercel-CDN-Cache-Control": "no-store",
          },
        }
      );
    }

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("map-averages error:", err);
    return NextResponse.json({ error: "Failed to build map averages" }, { status: 500 });
  }
}
