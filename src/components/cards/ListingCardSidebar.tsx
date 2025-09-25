// src/components/cards/ListingCardSidebar.tsx
"use client";

import type { Listing } from "@/lib/types";
import { clsx } from "clsx";
import { ExternalLink, MapPin, BedDouble } from "lucide-react";
import { KindIcon, kindLabel, splitAddress, countyAndEircode } from "./_shared";

export default function ListingCardSidebar({
  listing,
  selected,
  onHover,
  onLeave,
  onClick,
}: {
  listing: Listing;
  selected?: boolean;
  onHover?: () => void;
  onLeave?: () => void;
  onClick?: () => void;
}) {
  const bedsLabel =
    listing.beds === 0 ? "Studio" : `${listing.beds} Bed${listing.beds === 1 ? "" : "s"}`;
  const kind = kindLabel(listing.kind as any, listing.title, (listing as any).propertyType);
  const countyEir = countyAndEircode(listing);

  const { primary, secondary } = splitAddress(listing.address, listing.county);

  const fullAddress =
    (listing.address?.trim() || [primary, secondary].filter(Boolean).join(", ")) || "—";

  const handleClick = () => {
    onClick?.();
    window.dispatchEvent(
      new CustomEvent("map:focus", {
        detail: { id: listing.id, lat: listing.lat, lng: listing.lng },
      })
    );
  };

  function displayPrice(price?: number | null) {
    if (!price || price <= 0) return "POA";
    return `€${price.toLocaleString()}`;
  }  

  return (
    <button
      type="button"
      onMouseEnter={() => {
        onHover?.();
        window.dispatchEvent(new CustomEvent("map:hover", { detail: { id: listing.id } }));
      }}
      onMouseLeave={() => {
        onLeave?.();
        window.dispatchEvent(new CustomEvent("map:hover", { detail: { id: null } }));
      }}
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
            alt={fullAddress}
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
          {/* Title = full address */}
          <h3
            className="font-semibold leading-snug text-sm text-white line-clamp-1 group-hover:text-violet-200 transition mb-1.5"
            title={fullAddress}
          >
            {fullAddress}
          </h3>

          {/* County · Eircode */}
          {!!countyEir && (
            <div
              className="flex items-center gap-1.5 truncate text-[11.5px] leading-tight text-white/70 mt-0.5"
              title={countyEir}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <span className="truncate">{countyEir}</span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="mt-3 flex items-center gap-3 text-[12px] text-slate-300/90">
          <span className="inline-flex items-center gap-1">
            <BedDouble className="h-3.5 w-3.5 opacity-80" />
            {listing.beds != null ? (listing.beds === 0 ? "Studio" : bedsLabel) : "—"}
          </span>
          <span className="inline-flex items-center gap-1">
            <KindIcon kind={listing.kind as any} />
            {kind}
          </span>
        </div>

        {/* Sources */}
        {listing.sources && listing.sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {listing.sources.map((src) => {
              const slug = (src.name || "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "")
                .trim();

              return (
                <a
                  key={src.url}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-200/90 hover:text-white hover:bg-white/[0.08] transition-colors"
                  title={src.name}
                >
                  <img
                    src={`/logos/${slug}.png`}
                    alt=""
                    className="h-3.5 w-3.5 rounded-full object-cover ring-1 ring-white/20 bg-white/80"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    loading="lazy"
                  />
                  <span className="truncate">{src.name}</span>
                  <ExternalLink className="h-3.5 w-3.5 opacity-70" strokeWidth={1.4} />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </button>
  );
}
