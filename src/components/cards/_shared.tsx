"use client";

import type { Listing } from "@/lib/types";
import { Home, Building2 } from "lucide-react";

export const isEircode = (s?: string) => !!s && /^[A-Z0-9]{7}$/i.test(s);

export function countyAndEircode(listing: Partial<Listing> & { id?: string }) {
    // Prefer explicit field; fall back to id if it looks like an Eircode
    const eir = listing.eircode ?? (isEircode(listing.id) ? listing.id : undefined);
    const county = listing.county || "";
    return [county, eir ? eir.toUpperCase() : null].filter(Boolean).join(", ");
  }
    
export function kindLabel(
  kind?: Listing["kind"],
  title?: string,
  propertyType?: string
) {
  if (kind === "apartment" || kind === "house") return kind[0].toUpperCase() + kind.slice(1);
  const s = (propertyType || title || "").toLowerCase();
  if (/apartment|apt|flat|studio/.test(s)) return "Apartment";
  if (/house|detached|semi|terrace|bungalow/.test(s)) return "House";
  return "Home";
}

export function KindIcon({ kind }: { kind?: Listing["kind"] }) {
  const Icon = kind === "apartment" ? Building2 : Home;
  return <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />;
}

export function cleanCounty(s?: string) {
  if (!s) return "";
  return s.replace(/^\s*(?:co\.?|county)\s+/i, "").trim();
}

export function splitAddress(address?: string, fallbackCounty?: string) {
  const parts = (address || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(cleanCounty);

  const cleanedCounty = cleanCounty(fallbackCounty);

  if (parts.length === 0) return { primary: cleanedCounty || "—", secondary: "" };

  const primary = parts.slice(0, 2).join(", ");
  let secondary = parts.slice(2).join(", ");

  if (!secondary && cleanedCounty) {
    const pLow = primary.toLowerCase();
    if (!pLow.includes(cleanedCounty.toLowerCase())) secondary = cleanedCounty;
  }
  return { primary, secondary };
}
