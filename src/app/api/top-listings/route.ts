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

type SourceRef = { name?: string; url?: string };

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
  image?: string | null;
  images?: string[] | null;
  url?: string | null;
  sources?: SourceRef[] | null;
  createdAt?: TS;
  updatedAt?: TS;
  ts?: TS;
  scrapedAt?: TS;
  seenAt?: TS;
  [k: string]: unknown;
};

/* ---------------- helpers ---------------- */
const take3 = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
const titleCase = (s?: string | null) =>
  (s || "").replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

function extractRK(d: Listing): string | null {
  const cand = d.rk ?? d.routingKey ?? d.eircode;
  if (!cand) return null;
  const v = take3(String(cand));
  return /^[A-Z0-9]{3}$/.test(v) ? v : null;
}
function canonicalCounty(s?: string | null) {
  return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/\s+(city|county)$/g, "").trim();
}

const firstNonEmpty = (...vals: Array<string | null | undefined>) =>
  vals.find((v) => !!v && String(v).trim().length)! || null;

const getListingUrl = (l: Listing): string | null =>
  firstNonEmpty(l.url, l.sources?.find((s) => s?.url)?.url);

const getListingImage = (l: Listing): string | null =>
  firstNonEmpty(l.image, l.images?.[0]);

const numericPrice = (l: Listing): number | null => {
  const cands = [l.price, l.askingPrice, l.asking, l.priceEuro, l.rent, l.monthlyRent]
    .map((v) => (typeof v === "string" ? Number(v) : v));
  const n = cands.find((v) => Number.isFinite(v as number)) as number | undefined;
  return Number.isFinite(n) ? (n as number) : null;
};

const inferType = (l: Listing): "sale" | "rent" => {
  const raw = (l.type ?? l.saleOrRent ?? l.listingType ?? "").toString().toLowerCase();
  if (raw.includes("rent")) return "rent";
  if (raw.includes("sale")) return "sale";
  if (l.rent != null || l.monthlyRent != null) return "rent";
  return "sale";
};

/* URL normaliser for dedupe */
function normalizeUrl(u?: string | null): string | null {
  if (!u) return null;
  try {
    const x = new URL(u);
    x.hash = "";
    x.search = ""; // ignore query for dedupe
    const host = x.host.replace(/^www\./, "").toLowerCase();
    return `${x.protocol}//${host}${x.pathname}`.replace(/\/+$/, "");
  } catch {
    return u.trim();
  }
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
    console.warn("[top-listings] Could not read routing_key_counties.json:", e);
    rkCountyCache = {};
  }
  return rkCountyCache!;
}

/* ---------------- API ---------------- */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const wantedType = (searchParams.get("type") ?? "sale").toLowerCase() === "rent" ? "rent" : "sale";
    const limit = Math.max(1, Math.min(200, Number(searchParams.get("limit") ?? 50) || 50));

    const countiesParam = searchParams.get("counties");
    const countiesFilter =
      countiesParam && countiesParam.trim()
        ? new Set(countiesParam.split(",").map((s) => s.trim()).filter(Boolean).map(canonicalCounty))
        : null;

    const snap = await getDocs(collection(db, "map-listings"));
    const rkMap = await getRKCountyMap();

    const looksLikeListing = (v: unknown): v is Listing =>
      !!v && typeof v === "object" && "lat" in (v as any) && "lng" in (v as any);

    // Dedupe map: key -> best row
    const bestByKey = new Map<
      string,
      { id?: string | null; title?: string | null; address?: string | null; county: string | null; rk: string | null; price: number; url: string | null; image: string | null; }
    >();

    const consume = (d: Listing) => {
      if (inferType(d) !== wantedType) return;

      const rk = extractRK(d);
      if (!rk) return;

      const mappedCounty = rkMap[rk]?.county ? canonicalCounty(rkMap[rk]!.county) : null;
      const listingCounty =
        canonicalCounty(d.county) || canonicalCounty(d.addressCounty) || canonicalCounty(d.adminCounty) || null;
      const finalCounty = mappedCounty ?? listingCounty;
      if (countiesFilter && finalCounty && !countiesFilter.has(finalCounty)) return;

      const price = numericPrice(d);
      if (price == null || price <= 0) return;

      const url = normalizeUrl(getListingUrl(d));
      const id = d.id ?? null;

      // Build a robust dedupe key
      const titleNorm = (d.title || d.address || "").toLowerCase().replace(/\s+/g, " ").trim();
      const key = id || url || `${rk}|${price}|${titleNorm.slice(0, 80)}`;

      const row = {
        id,
        title: d.title ?? d.address ?? null,
        address: d.address ?? d.title ?? null,
        county: finalCounty ? titleCase(finalCounty) : null,
        rk,
        price,
        url,
        image: getListingImage(d),
      };

      // Keep the highest-priced version for any duplicate key (or merge missing bits)
      const prev = bestByKey.get(key);
      if (!prev) {
        bestByKey.set(key, row);
      } else {
        if (row.price > prev.price) {
          bestByKey.set(key, row);
        } else {
          if (!prev.url && row.url) prev.url = row.url;
          if (!prev.image && row.image) prev.image = row.image;
          if (!prev.title && row.title) prev.title = row.title;
          bestByKey.set(key, prev);
        }
      }
    };

    snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
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

    const rows = Array.from(bestByKey.values()).sort((a, b) => b.price - a.price);
    return NextResponse.json(rows.slice(0, limit), {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("top-listings error:", err);
    return NextResponse.json({ error: "Failed to load top listings" }, { status: 500 });
  }
}
