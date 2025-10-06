// src/components/map/ListingCardPopup.tsx
"use client";

import React from "react";
import type { Listing } from "@/lib/types";
import { MapPin, BedDouble, Bath, Ruler } from "lucide-react";
import { splitAddress } from "./_shared";

/* ------------ tiny helpers to match sidebar/listing card ------------ */
function cleanCounty(s?: string) {
  if (!s) return "";
  return s.replace(/^\s*(?:co\.?|county)\s+/i, "").trim();
}

/** Town, County · Eircode (if town present; otherwise sensible fallbacks) */
function locationLineFrom(listing: Listing) {
  const town = String((listing as any).town || "").trim();
  const county = cleanCounty(listing.county);
  const eir = (listing as any).eircode || "";

  const left = [town || null, county || null]
    .filter(Boolean)
    .join(town && county ? ", " : "");

  return [left || null, eir || null].filter(Boolean).join(" · ");
}

function formatPrice(price?: number | null) {
  if (!price || price <= 0) return "POA";
  return `€${price.toLocaleString()}`;
}

function formatBeds(beds?: number | null) {
  if (beds == null) return "—";
  return beds === 0 ? "Studio" : `${beds} Bed${beds === 1 ? "" : "s"}`;
}

function formatBaths(baths?: number | null) {
  if (baths == null) return null;
  return `${baths} Bath${baths === 1 ? "" : "s"}`;
}

function formatSqm(n?: number | null) {
  if (!Number.isFinite(n as number) || (n as number) <= 0) return null;
  return `${Math.round(n as number)} m²`;
}

/* ------------ shared source helpers (same look as sidebar) ------------ */
type SourceItem = { name?: string; url: string };

function brandFromHost(host: string): string {
  const h = host.replace(/^(?:www\.)?/i, "").toLowerCase();
  if (h.includes("myhome")) return "myhome";
  if (h.includes("sherryfitz")) return "sherryfitz";
  if (h.includes("dng")) return "dng";
  if (h.includes("westcorkproperty")) return "westcorkproperty";
  if (h.includes("michelleburke")) return "michelleburke";
  if (h.includes("zoopla")) return "zoopla";
  if (h.includes("propertymap") || h.includes("findqo")) return "findqo";
  return "generic";
}

function prettyName(brand: string): string {
  switch (brand) {
    case "myhome":
      return "MyHome";
    case "sherryfitz":
      return "SherryFitz";
    case "dng":
      return "DNG";
    case "westcorkproperty":
      return "James Lyon O'Keefe";
    case "michelleburke":
      return "Michelle Burke";
    case "zoopla":
      return "Zoopla";
    case "findqo":
      return "PropertyMap";
    default:
      return "Source";
  }
}

function deriveSources(listing: Listing): SourceItem[] {
  const primary = (listing.url as string) || undefined;
  const extra =
    ((listing as any).sources as Array<{ name?: string; url: string }>) ||
    undefined;

  const fallback: SourceItem[] = primary ? [{ name: undefined, url: primary }] : [];
  const src = (extra && extra.length ? extra : fallback).slice(0, 8);
  return src.map((s) => ({ name: s.name?.trim(), url: s.url }));
}

function SourcePill({ item }: { item: SourceItem }) {
  let host = "";
  try {
    host = new URL(item.url).host;
  } catch {}
  const brand = brandFromHost(host);
  const label =
    item.name || prettyName(brand) || host.replace(/^(?:www\.)?/i, "") || "Source";

  const logoFor = (b: string) =>
    ["myhome", "findqo", "sherryfitz", "dng", "westcorkproperty", "michelleburke", "zoopla"].includes(
      b
    )
      ? `/logos/${b}.png`
      : "/logos/generic.png";

  const [src, setSrc] = React.useState(logoFor(brand));

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={label}
      className="
        group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] leading-none
        bg-white/10 ring-1 ring-white/12 no-underline decoration-transparent
        !text-white visited:!text-white hover:!text-white focus:!text-white active:!text-white
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20
        transition-all duration-150 ease-out will-change-transform
        hover:bg-white/14 hover:ring-white/20
        motion-safe:hover:-translate-y-px active:scale-[0.99]
        shadow-none hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_6px_14px_rgba(0,0,0,0.25)]
        [&>*]:!text-white [&_span]:!text-white
      "
    >
      {/* logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5 rounded-[3px] object-contain transition duration-150 ease-out group-hover:brightness-110"
        onError={() => {
          if (src !== "/logos/generic.png") setSrc("/logos/generic.png");
        }}
        loading="lazy"
      />
      <span className="whitespace-nowrap">{label}</span>
    </a>
  );
}

/* ---------------------- component ---------------------- */
export default function ListingCardPopup({ listing }: { listing: Listing }) {
  const { primary } = splitAddress(listing.address, listing.county);
  const title = (listing.address?.trim() || primary || "").trim();

  const locLine = locationLineFrom(listing);
  const sizeText = formatSqm((listing as any).sizeSqm as number | null | undefined);

  const hasCoords =
    typeof listing.lat === "number" &&
    !Number.isNaN(listing.lat) &&
    typeof listing.lng === "number" &&
    !Number.isNaN(listing.lng);

  const gmapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`
    : undefined;

  const bedsLabel = formatBeds(listing.beds);
  const bathsLabel = formatBaths(listing.baths);

  const srcs = deriveSources(listing);
  const hasSources = srcs.length > 0;

  return (
    <div className="w-[320px] overflow-hidden rounded-lg text-white bg-black shadow-[0_6px_18px_rgba(0,0,0,0.35)] select-none">
      {/* Media (seamless edges) */}
      <div className="relative aspect-[16/9] overflow-hidden">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.images[0]}
            alt={title}
            className="absolute inset-0 block h-full w-full object-cover transform-gpu scale-[1.01]"
            draggable={false}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/50">
            No image
          </div>
        )}

        {/* Overlay for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        {/* Price (overlay, left) */}
        <div className="absolute left-2 top-2">
          <span className="inline-flex items-center rounded-[6px] border border-white/20 bg-black/90 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur-sm">
            {formatPrice(listing.price)}
          </span>
        </div>

        {/* Google Maps (overlay, right) */}
        {gmapsUrl && (
          <a
            href={gmapsUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open in Google Maps"
            className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[6px]
                       border border-white/20 bg-black/90 px-2 py-0.5 text-[12px] font-semibold
                       !text-white visited:!text-white hover:!text-white active:!text-white focus:!text-white
                       no-underline backdrop-blur-sm hover:bg-black transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={1.6} />
            Maps
          </a>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-3">
        {/* Title: full address */}
        <div className="truncate text-[13px] font-semibold leading-tight" title={title}>
          {title}
        </div>

        {/* Location: Town, County · Eircode */}
        {!!locLine && (
          <div
            className="flex items-center gap-1.5 truncate text-[11.5px] leading-tight text-white/70"
            title={locLine}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span className="truncate">{locLine}</span>
          </div>
        )}

        {/* Stats row: Beds, Baths, Size (m²) */}
        <div className="mt-1 flex items-center gap-3 text-[11.5px] leading-tight text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5 opacity-80" />
            {bedsLabel}
          </span>

          {bathsLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Bath className="h-3.5 w-3.5 opacity-80" />
              {bathsLabel}
            </span>
          )}

          {sizeText && (
            <span className="inline-flex items-center gap-1.5">
              <Ruler className="h-3.5 w-3.5 opacity-80" />
              {sizeText}
            </span>
          )}
        </div>

        {/* Divider (only if we have sources) */}
        {hasSources && <div className="h-px bg-white/12 mt-2 mb-0" />}

        {/* Sources — identical pill styling */}
        {hasSources && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {srcs.slice(0, 6).map((s, i) => (
              <SourcePill key={`${listing.id ?? title}-pop-${i}-${s.url}`} item={s} />
            ))}
            {srcs.length > 6 && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px]
                               text-white/90 ring-1 ring-inset ring-white/12 bg-white/8">
                +{srcs.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
