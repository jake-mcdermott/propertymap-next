// src/lib/findListingForOg.ts
import type { Listing } from "@/lib/types";

/** Where to fetch data for OG unfurls */
const OG_INDEX_URL =
  process.env.NEXT_PUBLIC_OG_INDEX_URL ||
  `${process.env.NEXT_PUBLIC_SITE_URL || ""}/data/og-index.json`;

const LISTINGS_URL =
  process.env.NEXT_PUBLIC_LISTINGS_URL ||
  `${process.env.NEXT_PUBLIC_SITE_URL || ""}/data/listings.json`;

/** Make any image or link URL absolute for OG */
function absolute(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url); // already absolute?
    return u.toString();
  } catch {
    const base =
      process.env.NEXT_PUBLIC_SITE_URL ||
      `https://${process.env.VERCEL_URL || "propertymap.ie"}`;
    try {
      return new URL(url.replace(/^\/+/, "/"), base).toString();
    } catch {
      return undefined;
    }
  }
}

/** Minimal, flexible shape we need for OG (intentionally looser than Listing) */
export type OgListing = {
  id: string;
  title?: string | null;
  address?: string | null;
  county?: string | null;
  town?: string | null;
  price?: number | null;
  images: string[]; // always an array, possibly empty
  eircode?: string | null;
};

/**
 * Try to find a listing by ID (eircode) with minimal info for OG.
 * 1) Try the small og-index file
 * 2) Fallback to the full listings file (may be large)
 */
export async function findListingForOg(id: string): Promise<OgListing | null> {
  const normId = (id || "").toUpperCase().replace(/\s|-/g, "");
  if (!/^[A-Z0-9]{7}$/.test(normId)) return null;

  // 1) Fast path: tiny index
  try {
    if (OG_INDEX_URL) {
      const r = await fetch(OG_INDEX_URL, { cache: "no-store" });
      if (r.ok) {
        const idx = (await r.json()) as Record<
          string,
          {
            title?: string;
            address?: string;
            county?: string;
            town?: string;
            price?: number;
            img?: string;
          }
        >;
        const hit = idx[normId];
        if (hit) {
          const imgAbs = absolute(hit.img);
          return {
            id: normId,
            title: hit.title ?? null,
            address: hit.address ?? null,
            county: hit.county ?? null,
            town: hit.town ?? null,
            price: typeof hit.price === "number" ? hit.price : null,
            images: imgAbs ? [imgAbs] : [],
          };
        }
      }
    }
  } catch {
    // ignore and fall through
  }

  // 2) Fallback: full listings
  try {
    if (LISTINGS_URL) {
      const r = await fetch(LISTINGS_URL, { cache: "no-store" });
      if (r.ok) {
        const data = (await r.json()) as { listings?: Listing[] } | Listing[];
        const arr: Listing[] = Array.isArray(data) ? data : data.listings || [];
        const found = arr.find((l) => (l.id || "").toUpperCase() === normId);
        if (found) {
          const firstImgAbs = absolute(
            Array.isArray(found.images) && found.images[0] ? found.images[0] : undefined
          );
          return {
            id: found.id,
            title: (found as any)?.title ?? null,
            address: (found as any)?.address ?? null,
            county: (found as any)?.county ?? null,
            town: (found as any)?.town ?? null,
            price:
              typeof (found as any)?.price === "number" ? (found as any).price : null,
            images: firstImgAbs ? [firstImgAbs] : [],
          };
        }
      }
    }
  } catch {
    // ignore
  }

  return null;
}

/** Build nice OG title/description from listing */
export function buildOgText(l: OgListing) {
  const price =
    typeof l.price === "number" && l.price > 0
      ? `€${l.price.toLocaleString()}`
      : "POA";
  const where = [l.town ?? undefined, l.county ?? undefined]
    .filter(Boolean)
    .join(", ");
  const title = l.title || l.address || "Property";
  const ogTitle = `${price} — ${title}`;
  const descParts = [where || undefined, `Eircode: ${l.id}`].filter(Boolean);
  const description = descParts.join(" · ");
  return { ogTitle, description };
}
