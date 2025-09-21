// src/components/map/ListingCardPopup.tsx
"use client";

import type { Listing } from "@/lib/types";
import { MapPin, BedDouble, Bath, ExternalLink } from "lucide-react";
import { splitAddress, countyAndEircode } from "./_shared";

type Source = { name: string; url: string };

function isSource(v: unknown): v is Source {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return typeof o.url === "string" && typeof o.name === "string";
}

export default function ListingCardPopup({ listing }: { listing: Listing }) {
  const { primary } = splitAddress(listing.address, listing.county);
  const title = listing.address?.trim() || primary;
  const countyEir = countyAndEircode(listing);

  const hasCoords =
    typeof listing.lat === "number" &&
    !Number.isNaN(listing.lat) &&
    typeof listing.lng === "number" &&
    !Number.isNaN(listing.lng);

  const gmapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`
    : undefined;

  const bedsLabel =
    listing.beds === 0 ? "Studio" : `${listing.beds} Bed${listing.beds === 1 ? "" : "s"}`;
  const bathsLabel =
    listing.baths != null ? `${listing.baths} Bath${listing.baths === 1 ? "" : "s"}` : null;

  // ---- SAFE SOURCES ----
  const maybeSources = (listing as { sources?: unknown }).sources;
  const sources: Source[] = Array.isArray(maybeSources)
    ? (maybeSources as unknown[]).filter(isSource)
    : [];
  const hasSources = sources.length > 0;

  function displayPrice(price?: number | null) {
    if (!price || price <= 0) return "POA";
    return `€${price.toLocaleString()}`;
    }

  return (
    <div className="w-[320px] overflow-hidden rounded-lg text-white bg-black border border-white/16 select-none">
      {/* Media */}
      <div className="relative aspect-[16/9] bg-black">
        {listing.images?.[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={listing.images[0]} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-xs text-white/50">No image</div>
        )}

        {/* Overlay for legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />

        {/* Price (overlay, left) */}
        <div className="absolute left-2 top-2">
          <span className="inline-flex items-center rounded-[6px] border border-white/20 bg-black/90 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur-sm">
            {displayPrice(listing.price)}
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

        {/* County, Eircode */}
        {!!countyEir && (
          <div
            className="flex items-center gap-1.5 truncate text-[11.5px] leading-tight text-white/70"
            title={countyEir}
          >
            <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" />
            <span className="truncate">{countyEir}</span>
          </div>
        )}

        {/* Beds & Baths */}
        <div className="mt-1 flex items-center gap-3 text-[11.5px] leading-tight text-white/80">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="h-3.5 w-3.5 opacity-80" />
            {listing.beds != null ? (listing.beds === 0 ? "Studio" : bedsLabel) : "—"}
          </span>
          {bathsLabel && (
            <span className="inline-flex items-center gap-1.5">
              <Bath className="h-3.5 w-3.5 opacity-80" />
              {bathsLabel}
            </span>
          )}
        </div>

        {/* Divider (only if we have sources) */}
        {hasSources && <div className="h-px bg-white/12 mt-2 mb-0" />}

        {/* Sources */}
        {hasSources && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {sources.slice(0, 6).map((src) => {
              const slug = (src.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
              return (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium
                            !text-white visited:!text-white hover:!text-white active:!text-white focus:!text-white
                            ring-1 ring-inset ring-white/15 hover:ring-white/25
                            bg-white/10 hover:bg-white/16
                            no-underline transition-colors shadow-sm"
                  title={src.name}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/logos/${slug}.png`}
                    alt=""
                    className="h-3.5 w-3.5 rounded-[4px] object-cover ring-1 ring-black/10 bg-white"
                    loading="lazy"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                  />
                  <span className="truncate max-w-[120px] opacity-95">{src.name}</span>
                  <ExternalLink
                    className="h-3.5 w-3.5 opacity-80 group-hover:opacity-100"
                    strokeWidth={1.6}
                  />
                </a>
              );
            })}
            {sources.length > 6 && (
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px]
                              text-white/90 ring-1 ring-inset ring-white/12 bg-white/8">
                +{sources.length - 6} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
