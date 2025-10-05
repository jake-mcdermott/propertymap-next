// src/components/mobile/MobileListingDrawer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { Listing } from "@/lib/types";
import { X, MapPin, BedDouble, Bath, Home, Building2, Ruler } from "lucide-react";
import { clsx } from "clsx";

/* ------------------------------ utils ------------------------------ */

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    const original = document.body.style.overflow;
    if (locked) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [locked]);
}

function KindIcon({ kind }: { kind?: Listing["kind"] }) {
  const Icon = kind === "apartment" ? Building2 : Home;
  return <Icon className="h-4 w-4 opacity-70" aria-hidden />;
}

function displayPrice(price?: number | null) {
  if (!price || price <= 0) return "POA";
  return `€${price.toLocaleString()}`;
}

function cleanCounty(s?: string) {
  if (!s) return "";
  return s.replace(/^\s*(?:co\.?|county)\s+/i, "").trim();
}

/** Prefer "Town, County · Eircode" when town exists, else "County · Eircode" */
function locationLine(listing: Listing) {
  const town = String((listing as any).town || "").trim();
  const county = cleanCounty(listing.county);
  const eir = (listing as any).eircode || "";

  const left = [town || null, county || null].filter(Boolean).join(town && county ? ", " : "");
  return [left || null, eir || null].filter(Boolean).join(" · ");
}

type SourceItem = { name: string; url: string };

const brandFromHost = (host: string) => {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h.includes("myhome")) return "myhome";
  if (h.includes("findqo") || h.includes("propertymap")) return "findqo";
  if (h.includes("sherryfitz")) return "sherryfitz";
  if (h.includes("dng")) return "dng";
  if (h.includes("michelleburke")) return "michelleburke";
  if (h.includes("westcorkproperty")) return "westcorkproperty";
  if (h.includes("zoopla")) return "zoopla";
  return "generic";
};
const prettyName = (b: string) =>
  ({ myhome: "MyHome", westcorkproperty: "James Lyon O'Keefe", michelleburke: "Michelle Burke", findqo: "PropertyMap", sherryfitz: "SherryFitz", dng: "DNG", propertypal: "PropertyPal", rightmove: "Rightmove", zoopla: "Zoopla" } as Record<string,string>)[b] || "Source";

function SourcePill({ item }: { item: SourceItem }) {
  let host = "";
  try { host = new URL(item.url).host; } catch {}
  const brand = brandFromHost(host);
  const label = item.name || prettyName(brand) || host.replace(/^www\./, "") || "Source";
  const logoFor = (b: string) =>
    ["myhome","findqo","sherryfitz","dng","westcorkproperty","michelleburke","zoopla"].includes(b)
      ? `/logos/${b}.png`
      : `/logos/generic.png`;

  const [src, setSrc] = useState(logoFor(brand));

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] leading-none bg-white/[0.06] text-slate-100 ring-1 ring-white/10 hover:bg-white hover:text-black transition whitespace-nowrap"
      title={label}
      onClick={(e) => e.stopPropagation()}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={14}
        height={14}
        className="h-3.5 w-3.5 rounded-[3px] object-contain"
        onError={() => { if (src !== "/logos/generic.png") setSrc("/logos/generic.png"); }}
        loading="lazy"
      />
      <span className="whitespace-nowrap">{label}</span>
    </a>
  );
}

/* ------------------------------ component ------------------------------ */

type Props = {
  open: boolean;
  listing: Listing | null;
  onClose: () => void;
};

const DRAG_CLOSE_PX = 72;

export default function MobileListingDrawer({ open, listing, onClose }: Props) {
  const startYRef = useRef<number | null>(null);
  const translateYRef = useRef<number>(0);
  const [dragging, setDragging] = useState(false);
  const [ty, setTy] = useState(0);

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!open) return;
    startYRef.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!open || startYRef.current == null) return;
    const dy = e.touches[0].clientY - startYRef.current;
    if (dy < 0) return setTy(0);
    translateYRef.current = dy;
    setTy(dy);
  };
  const endDrag = () => {
    setDragging(false);
    if (translateYRef.current > DRAG_CLOSE_PX) onClose();
    setTy(0);
    startYRef.current = null;
    translateYRef.current = 0;
  };

  const onBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const sources: SourceItem[] =
    listing?.sources?.length
      ? listing.sources.slice(0, 8)
      : listing?.url
      ? [{ name: new URL(listing.url).host.replace(/^www\./, ""), url: listing.url }]
      : [];

  const gmapsUrl =
    listing ? `https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}` : "#";

  const sizeSqm = listing ? (listing as any).sizeSqm as number | null | undefined : null;
  const locLine = listing ? locationLine(listing) : "";

  return (
    <>
      {/* Backdrop */}
      <div
        className={clsx(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] transition-opacity md:hidden",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onBackdropClick}
      />

      {/* Drawer */}
      <div
        className={clsx(
          "fixed left-0 right-0 bottom-0 z-50 md:hidden",
          open ? "pointer-events-auto" : "pointer-events-none"
        )}
        style={{
          transform: `translateY(${open ? ty : 100}%)`,
          transition: dragging ? "none" : "transform 280ms cubic-bezier(.2,.8,.2,1)",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={endDrag}
        onTouchCancel={endDrag}
        role="dialog"
        aria-modal="true"
        aria-label="Listing details"
      >
        <div className="rounded-t-2xl bg-neutral-900 shadow-2xl overflow-hidden">
          {/* Handle */}
          <div className="pt-2 pb-2">
            <div className="mx-auto h-1.5 w-10 rounded-full bg-white/25" />
          </div>

          {/* Edge-to-edge image with price + map + close */}
          <div className="relative">
            {listing?.images?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={listing.images[0]}
                alt={listing.address ?? "Listing"}
                className="w-full aspect-[16/9] object-cover"
              />
            ) : (
              <div className="w-full aspect-[16/9] grid place-items-center text-xs text-slate-400 bg-white/[0.04]">
                No photo
              </div>
            )}

            {/* Price pill */}
            {listing && (
              <div className="absolute left-2 bottom-2 rounded-full bg-black/70 text-white text-[12px] font-semibold px-2.5 py-1 backdrop-blur">
                {displayPrice(listing.price)}
              </div>
            )}

            {/* Google Maps button */}
            {listing && (
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in Google Maps"
                className="absolute top-2 left-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/70"
                onClick={(e) => e.stopPropagation()}
              >
                <MapPin className="h-4 w-4" />
              </a>
            )}

            {/* Close */}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/60 text-white hover:bg-black/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Minimal body */}
          <div className="px-3 py-3">
            {listing ? (
              <>
                {/* Address */}
                {!!listing.address && (
                  <div className="text-sm font-bold text-white truncate" title={listing.address}>
                    {listing.address}
                  </div>
                )}

                {/* Location subheading (Town, County · Eircode) */}
                {!!locLine && (
                  <div
                    className="mt-0.5 flex items-center gap-1.5 text-[12px] text-slate-300 truncate"
                    title={locLine}
                  >
                    <MapPin className="h-3.5 w-3.5 shrink-0 opacity-75" />
                    <span className="truncate">{locLine}</span>
                  </div>
                )}

                {/* Beds • Baths • Type • m² */}
                <div className="mt-2 text-[13px] text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-4 w-4 opacity-70" />
                    {listing.beds != null
                      ? listing.beds === 0
                        ? "Studio"
                        : `${listing.beds} Bed${listing.beds === 1 ? "" : "s"}`
                      : "—"}
                  </span>
                  <span className="px-2 opacity-40">•</span>
                  <span className="inline-flex items-center gap-1">
                    <Bath className="h-4 w-4 opacity-70" />
                    {listing.baths != null
                      ? `${listing.baths} Bath${listing.baths === 1 ? "" : "s"}`
                      : "—"}
                  </span>
                  <span className="px-2 opacity-40">•</span>
                  <span className="inline-flex items-center gap-1">
                    <KindIcon kind={listing.kind} />
                    {listing.kind ? listing.kind[0].toUpperCase() + listing.kind.slice(1) : "Home"}
                  </span>
                  {Number.isFinite(sizeSqm as number) && sizeSqm! > 0 && (
                    <>
                      <span className="px-2 opacity-40">•</span>
                      <span className="inline-flex items-center gap-1">
                        <Ruler className="h-4 w-4 opacity-70" />
                        {sizeSqm} m²
                      </span>
                    </>
                  )}
                </div>

                {/* Sources (single horizontal row, scrollable) */}
                {sources.length > 0 && (
                  <div className="mt-3">
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">
                      View on
                    </div>
                    <div
                      className={clsx(
                        "flex gap-2 -mx-3 px-3 overflow-x-auto",
                        "flex-nowrap",                                // one row
                        "[scrollbar-width:none] [-ms-overflow-style:none]", // FF/IE hide
                        "[&::-webkit-scrollbar]:hidden"               // WebKit hide
                      )}
                    >
                      {sources.map((s) => (
                        <SourcePill key={s.url} item={s} />
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="py-10 text-center text-slate-400 text-sm">No listing selected.</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
