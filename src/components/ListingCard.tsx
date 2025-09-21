// src/components/ListingCard.tsx
"use client";

import React, { useState } from "react";
import type { Listing } from "@/lib/types";
import { clsx } from "clsx";
import { ExternalLink, MapPin, BedDouble, Home, Building2 } from "lucide-react";

/* -------- helpers -------- */
function kindLabel(kind?: Listing["kind"], title?: string, propertyType?: string) {
  if (kind === "apartment" || kind === "house") return kind[0].toUpperCase() + kind.slice(1);
  const s = (propertyType || title || "").toLowerCase();
  if (/apartment|apt|flat|studio/.test(s)) return "Apartment";
  if (/house|detached|semi|terrace|bungalow/.test(s)) return "House";
  return "Home";
}
function KindIcon({ kind }: { kind?: Listing["kind"] }) {
  const Icon = kind === "apartment" ? Building2 : Home;
  return <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />;
}
function cleanCounty(s?: string) {
  if (!s) return "";
  return s.replace(/^\s*(?:co\.?|county)\s+/i, "").trim();
}
function splitAddress(address?: string, fallbackCounty?: string) {
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
function displayPrice(price?: number | null) {
  if (!price || price <= 0) return "POA";
  return `€${price.toLocaleString()}`;
}

/* -------- source branding helpers -------- */
type SourceItem = { name?: string; url: string };

function brandFromHost(host: string): string {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h.includes("daft")) return "daft";
  if (h.includes("myhome")) return "myhome";
  if (h.includes("sherryfitz")) return "sherryfitz";
  if (h.includes("propertypal")) return "propertypal";
  if (h.includes("rightmove")) return "rightmove";
  if (h.includes("zoopla")) return "zoopla";
  if (h.includes("propertymap") || h.includes("findqo")) return "findqo";
  return "generic";
}
function prettyName(brand: string): string {
  switch (brand) {
    case "daft": return "Daft";
    case "myhome": return "MyHome";
    case "sherryfitz": return "SherryFitz";
    case "propertypal": return "PropertyPal";
    case "rightmove": return "Rightmove";
    case "zoopla": return "Zoopla";
    case "findqo": return "PropertyMap";
    default: return "Source";
  }
}
function deriveSources(listing: Listing): SourceItem[] {
  const primary = listing.url as string | undefined;
  const extra = listing.sources as Array<{ name?: string; url: string }> | undefined;

  const fallback: SourceItem[] = primary ? [{ name: undefined, url: primary }] : [];
  const src = (extra && extra.length ? extra : fallback).slice(0, 8);

  return src.map((s) => ({ name: s.name?.trim(), url: s.url }));
}

/* -------- Source pill with logo -------- */
function SourcePill({ item }: { item: SourceItem }) {
  let host = "";
  try { host = new URL(item.url).host; } catch {}
  const brand = brandFromHost(host);
  const label = item.name || prettyName(brand) || host.replace(/^www\./, "") || "Source";
  const logoFor = (b: string) =>
    ["daft","myhome","findqo","sherryfitz","propertypal","rightmove","zoopla"].includes(b)
      ? `/logos/${b}.png`
      : `/logos/generic.png`;

  const [src, setSrc] = useState(logoFor(brand));

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] leading-none bg-white/[0.06] text-slate-100 ring-1 ring-white/10 hover:bg-white hover:text-black transition"
      title={label}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5 rounded-[3px] object-contain"
        onError={() => { if (src !== "/logos/generic.png") setSrc("/logos/generic.png"); }}
      />
      <span className="whitespace-nowrap">{label}</span>
    </a>
  );
}

/* ============================================================
   ListingCard — two variants:
   - "sidebar" (default)
   - "popup"
   ============================================================ */
type Variant = "sidebar" | "popup";

export function ListingCard({
  listing,
  selected,
  onHover,
  onLeave,
  onClick,
  variant = "sidebar",
}: {
  listing: Listing;
  selected?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
  variant?: Variant;
}) {
  const bedsLabel =
    listing.beds === 0 ? "Studio" : `${listing.beds} Bed${listing.beds === 1 ? "" : "s"}`;

  const propertyType =
    typeof (listing as Record<string, unknown>).propertyType === "string"
      ? ((listing as Record<string, unknown>).propertyType as string)
      : undefined;

  const kind = kindLabel(listing.kind, listing.title, propertyType);
  const { primary, secondary } = splitAddress(listing.address, listing.county);

  const fullAddress = [listing.address?.trim() || primary, secondary || null]
    .filter(Boolean)
    .join(", ");

  const handleClick = () => {
    onClick?.();
    if (variant === "sidebar") {
      window.dispatchEvent(
        new CustomEvent("map:focus", { detail: { id: listing.id, lat: listing.lat, lng: listing.lng } })
      );
    }
  };
  const handleEnter = () => {
    if (variant === "sidebar") {
      onHover?.();
      window.dispatchEvent(new CustomEvent("map:hover", { detail: { id: listing.id } }));
    }
  };
  const handleLeave = () => {
    if (variant === "sidebar") {
      onLeave?.();
      window.dispatchEvent(new CustomEvent("map:hover", { detail: { id: null } }));
    }
  };

  /* ---------- popup variant ---------- */
  if (variant === "popup") {
    const srcs = deriveSources(listing);
    return (
      <div
        className={clsx(
          "w-[380px] md:w-[440px] select-none rounded-xl overflow-hidden",
          "border border-white/12 bg-black"
        )}
        onClick={handleClick}
      >
        <div className="grid grid-cols-[160px_1fr] gap-3 items-stretch">
          {/* Photo (left) */}
          <div className="relative h-full min-h-[140px] overflow-hidden">
            {listing.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.images[0]}
                alt={primary}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center text-xs text-slate-400 bg-white/[0.02]">
                No photo
              </div>
            )}
            {/* Price */}
            <div className="absolute top-2 right-2">
              <span className="inline-flex items-center px-2 py-0.5 text-[11.5px] font-semibold tabular-nums bg-black/80 border border-white/20 text-white backdrop-blur-md rounded-md shadow-sm">
                {displayPrice(listing.price)}
              </span>
            </div>
          </div>

          {/* Content (right) */}
          <div className="min-w-0 py-3 pr-3 flex flex-col justify-between">
            <div>
              <h3
                className="font-semibold leading-snug text-sm text-white truncate"
                title={listing.title || primary}
              >
                {listing.title || primary}
              </h3>

              {!!fullAddress && (
                <div
                  className="mt-1 flex items-center gap-1.5 text-xs text-slate-300/90 truncate"
                  title={fullAddress}
                >
                  <MapPin className="h-3 w-3 shrink-0 opacity-70" />
                  {fullAddress}
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center gap-3 text-[12px] text-slate-300/90">
              <span className="inline-flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5 opacity-70" />
                {listing.beds != null ? (listing.beds === 0 ? "Studio" : bedsLabel) : "—"}
              </span>

              <span className="inline-flex items-center gap-1">
                <KindIcon kind={listing.kind} />
                {kind}
              </span>
            </div>

            {/* Sources with logos */}
            {srcs.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {srcs.slice(0, 6).map((s, i) => (
                  <SourcePill key={`${listing.id}-pop-${i}-${s.url}`} item={s} />
                ))}
                {srcs.length > 6 && (
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-200">
                    +{srcs.length - 6} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------- sidebar variant ---------- */
  const srcs = deriveSources(listing);

  return (
    <button
      type="button"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      className={clsx(
        "group w-full text-left grid grid-cols-[180px_1fr] items-stretch gap-4 cursor-pointer",
        "rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01]",
        "hover:from-white/[0.06] hover:to-white/[0.02] transition-all duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/40",
        "shadow-sm hover:shadow-lg",
        selected && "from-white/[0.08] to-white/[0.04] border-white/20"
      )}
    >
      {/* Photo */}
      <div className="relative h-full min-h-[135px] overflow-hidden">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={primary}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-xs text-slate-500 bg-white/[0.02]">
            No photo
          </div>
        )}
        {/* Price */}
        <div className="absolute top-2 right-2">
          <span className="inline-flex items-center px-2.5 py-1 text-[12px] font-semibold tabular-nums bg-black/60 border border-white/20 text-white backdrop-blur-md rounded-md shadow-sm">
            {displayPrice(listing.price)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="min-w-0 py-3 pr-3 flex flex-col justify-between">
        <div>
          <h3 className="font-semibold leading-snug text-sm text-white line-clamp-1 group-hover:text-violet-200 transition">
            {primary}
          </h3>

          {/* Secondary line (area/county) */}
          {secondary && (
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 line-clamp-1">
              <MapPin className="h-3 w-3 shrink-0 opacity-70" />
              {secondary}
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-3 text-[12px] text-slate-300/90">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 opacity-70" />
            {bedsLabel}
          </span>

          <span className="inline-flex items-center gap-1">
            <KindIcon kind={listing.kind} />
            {kind}
          </span>
        </div>

        {/* Sources with logos */}
        {srcs.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {srcs.map((s, i) => (
              <SourcePill key={`${listing.id}-side-${i}-${s.url}`} item={s} />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

/* Handy alias to make intent obvious where it’s used */
export const ListingPopupCard = (
  props: Omit<React.ComponentProps<typeof ListingCard>, "variant">
) => <ListingCard {...props} variant="popup" />;
