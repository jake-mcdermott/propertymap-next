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
  title?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  price?: number | null;
  asking?: number | null;
  askingPrice?: number | null;
  priceEuro?: number | null;

  type?: string | null;        // sale | rent, etc
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

const canonicalCounty = (s?: string | null) =>
  (s || "").toLowerCase().replace(/\s+/g, " ").replace(/\s+(city|county)$/g, "").trim();

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? (n as number) : null;
}

function firstPrice(d: Listing): number | null {
  return num(d.price) ?? num(d.askingPrice) ?? num(d.asking) ?? num(d.priceEuro) ?? null;
}

function inferType(d: Listing): "sale" | "rent" {
  const raw = (d.type ?? d.saleOrRent ?? d.listingType ?? "").toString().toLowerCase();
  if (raw.includes("rent")) return "rent";
  if (raw.includes("sale") || raw === "") return "sale";
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
      const county = v && typeof v === "object" ? (v.county ?? v.County ?? v.COUNTY) : undefined;
      if (rk && county) out[rk] = { county: String(county) };
    }
    rkCountyCache = out;
  } catch (e) {
    console.warn("[live-listings] Could not read routing_key_counties.json:", e);
    rkCountyCache = {};
  }
  return rkCountyCache!;
}

/* ---------------- API ---------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // Only SALE data per latest direction
    const wantedType = "sale" as const;

    // Live window
    const maxAgeDays = 90;
    const sinceMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

    const limit = Math.max(0, Number(searchParams.get("limit") ?? 0)) || 0; // 0 = no cap
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

    const rkMap = await getRKCountyMap();
    const snap = await getDocs(collection(db, "map-listings"));

    const looksLikeListing = (v: unknown): v is Listing =>
      !!v && typeof v === "object" && ("lat" in (v as any)) && ("lng" in (v as any));

    type Out = {
      id?: string | null;
      title?: string | null;
      address?: string | null;
      price: number;
      county: string | null;
      rk: string | null;
      url: string | null;
      image: string | null;
    };

    const out: Out[] = [];
    const seen = new Set<string>(); // de-dupe via id/url

    const consider = (d: Listing) => {
      if (inferType(d) !== wantedType) return;

      const tms =
        tsToMillis(d.updatedAt) ??
        tsToMillis(d.createdAt) ??
        tsToMillis(d.ts) ??
        tsToMillis(d.scrapedAt) ??
        tsToMillis(d.seenAt);
      if (tms != null && tms < sinceMs) return;

      const price = firstPrice(d);
      if (price == null || price <= 0) return;

      const rk = extractRK(d);
      const mappedCounty = rk ? (rkMap[rk]?.county ? canonicalCounty(rkMap[rk]!.county) : null) : null;

      // If mapping missing, fall back to listing county
      const listingCounty =
        canonicalCounty(d.county) ||
        canonicalCounty(d.addressCounty) ||
        canonicalCounty(d.adminCounty) ||
        null;

      const finalCounty = (mappedCounty ?? listingCounty) || null;

      // Filter by counties param
      if (countiesFilter && finalCounty && !countiesFilter.has(finalCounty)) return;

      const key = (d.id || "") + "|" + (d.url || "");
      if (key !== "|" && seen.has(key)) return;
      seen.add(key);

      out.push({
        id: d.id ?? null,
        title: (d.title as string) ?? null,
        address: (d.address as string) ?? null,
        price,
        county: finalCounty ? finalCounty : null,
        rk: rk ?? null,
        url: (d.url as string) ?? null,
        image: (d.image as string) ?? null,
      });
    };

    snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      if (doc.id === "_manifest") return;
      const data = doc.data();

      if (data && typeof data === "object" && Array.isArray((data as any).items)) {
        for (const it of (data as any).items as unknown[]) if (looksLikeListing(it)) consider(it as Listing);
        return;
      }
      if (Array.isArray(data)) {
        for (const it of data as unknown[]) if (looksLikeListing(it)) consider(it as Listing);
        return;
      }
      if (looksLikeListing(data)) consider(data as Listing);
    });

    const rows = limit > 0 ? out.slice(0, limit) : out;

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("live-listings error:", err);
    return NextResponse.json({ error: "Failed to build live listings" }, { status: 500 });
  }
}
