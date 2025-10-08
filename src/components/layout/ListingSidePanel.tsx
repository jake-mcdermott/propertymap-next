// src/components/map/ListingSidePanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  ChevronRight,
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  Home,
  Building2,
  ExternalLink,
} from "lucide-react";
import type { Listing } from "@/lib/types";
import { ShareButton } from "@/components/ShareButton";

/* ------------------------- tiny helpers ------------------------- */
function formatPrice(price?: number | null) {
  if (!price || price <= 0) return "POA";
  return `€${price.toLocaleString()}`;
}
const has = (v: unknown) => v !== null && v !== undefined && v !== "";

function toSqm(sizeSqm?: number | null) {
  if (!Number.isFinite(sizeSqm as number) || (sizeSqm as number) <= 0) return null;
  return Math.round(sizeSqm as number).toLocaleString();
}
function titleText(listing?: Listing | null) {
  return listing?.title || listing?.address || "Property";
}
function subtitleText(listing?: Listing | null) {
  if (!listing) return "";
  const town = String((listing as any)?.town || "").trim();
  const county = String(listing.county || "").trim();
  const eir = String((listing as any)?.eircode || "").trim();
  const left = [town || null, county || null].filter(Boolean).join(town && county ? ", " : "");
  return [left || null, eir || null].filter(Boolean).join(" · ");
}
function typeLabel(listing?: Listing | null) {
  const k = (listing as any)?.kind as string | undefined;
  if (!k) return null;
  return k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
}

/* -------------------- sources (brand buttons) ------------------- */
type SourceItem = { name?: string; url: string };

function brandFromUrl(url: string): string {
  try {
    const host = new URL(url).host.replace(/^www\./i, "").toLowerCase();
    if (host.includes("myhome")) return "myhome";
    if (host.includes("daft")) return "daft";
    if (host.includes("sherryfitz")) return "sherryfitz";
    if (host.includes("dng")) return "dng";
    if (host.includes("westcorkproperty")) return "westcorkproperty";
    if (host.includes("michelleburke")) return "michelleburke";
    if (host.includes("zoopla")) return "zoopla";
    if (host.includes("propertymap") || host.includes("findqo")) return "findqo";
    return "generic";
  } catch {
    return "generic";
  }
}
function prettyName(brand: string): string {
  switch (brand) {
    case "myhome": return "MyHome";
    case "daft": return "Daft";
    case "sherryfitz": return "SherryFitz";
    case "dng": return "DNG";
    case "westcorkproperty": return "James Lyon O'Keefe";
    case "michelleburke": return "Michelle Burke";
    case "zoopla": return "Zoopla";
    case "findqo": return "PropertyMap";
    default: return "Source";
  }
}
const logoPath = (brand: string) => `/logos/${brand}.png`;

function SourceButton({
  item,
  prominent = false,
}: {
  item: SourceItem;
  prominent?: boolean;
}) {
  const brand = brandFromUrl(item.url);
  const [src, setSrc] = useState(logoPath(brand));
  const label = item.name?.trim() || prettyName(brand);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      title={label}
      className={[
        "group relative flex items-center gap-3 rounded-xl px-3 py-2 no-underline text-white transition",
        "border bg-white/[0.04] border-white/10 hover:bg-white/[0.08] hover:border-white/20",
        prominent ? "ring-1 ring-white/15" : "",
      ].join(" ")}
      onClick={(e) => e.stopPropagation()}
    >
      {/* logo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        className="h-5 w-5 rounded-[4px] object-contain bg-white"
        onError={() => { if (src !== logoPath("generic")) setSrc(logoPath("generic")); }}
        loading="lazy"
      />
      {/* name */}
      <span className="flex-1 truncate text-[13.5px] font-medium">{label}</span>
      {/* external icon */}
      <ExternalLink className="h-4 w-4 opacity-70 transition group-hover:opacity-100" />
      {/* subtle glow on hover */}
      <span className="pointer-events-none absolute inset-0 rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.25)] opacity-0 group-hover:opacity-100 transition"></span>
    </a>
  );
}

/* ------------------- minimalist spec item ------------------- */
function SpecItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-slate-200">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/10">
        {icon}
      </span>
      <span className="leading-none">{label}</span>
    </div>
  );
}

/* ------------------- light section chrome ------------------- */
function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
      <div className="text-[11px] uppercase tracking-wide text-white/55">
        {children}
      </div>
    );
  }
  function Divider() {
  return (
    <div className="relative -mx-4 sm:-mx-5 h-px">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent" />
    </div>
  );
}

/* ======================= main panel ======================= */
export default function ListingSidePanel({
  open,
  listing,
  onClose,
}: {
  open: boolean;
  listing: Listing | null;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const sub = subtitleText(listing);
  const sqm = toSqm((listing as any)?.sizeSqm);
  const kind = typeLabel(listing);
  const isApt = (listing as any)?.kind === "apartment";

  const sources: SourceItem[] = useMemo(() => {
    if (!listing?.sources || !Array.isArray(listing.sources)) return [];
    // Make first item “prominent”: prefer listing.url if present
    const primary = (listing as any)?.url
      ? [{ name: undefined, url: (listing as any).url as string }]
      : [];
    const rest = listing.sources.map((s) => ({ name: s.name, url: s.url }));
    // de-dupe by url
    const seen = new Set<string>();
    const uniq: SourceItem[] = [];
    for (const s of [...primary, ...rest]) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      uniq.push(s);
    }
    return uniq.slice(0, 8);
  }, [listing]);

  const hasHeroStrip = Array.isArray(listing?.images) && listing!.images.length > 1;

  if (!mounted) return null;

  // quick actions
  const hasCoords =
    typeof listing?.lat === "number" && !Number.isNaN(listing?.lat) &&
    typeof listing?.lng === "number" && !Number.isNaN(listing?.lng);
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${listing!.lat},${listing!.lng}`
    : undefined;

  return createPortal(
    <>
      {/* Overlay */}
      <div
        className={[
          "hidden md:block fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm transition-opacity duration-150",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <aside
        className={[
          "hidden md:flex md:flex-col fixed right-0 top-0 z-[100001] h-[100dvh] w-[min(520px,92vw)]",
          "bg-neutral-950/96 text-slate-100 border-l border-white/10",
          "shadow-[0_0_80px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl",
          "transition-transform duration-250 ease-out will-change-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        {/* Slim header */}
        <div className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/70 backdrop-blur-md">
          <div className="flex h-9 items-center justify-between px-1.5">
            <div className="text-[11px] text-white/55 pr-2">Property details</div>
            <button
              type="button"
              onClick={onClose}
              title="Close"
              aria-label="Close"
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-white/85 hover:bg-white/10 hover:text-white active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35"
            >
              <ChevronRight className="h-4 w-4" />
              Close
            </button>
          </div>
        </div>

        {/* Scroll area with soft edge fades */}
        <div
          ref={scrollerRef}
          className="flex-1 overflow-y-auto px-4 sm:px-5 pb-[max(env(safe-area-inset-bottom),14px)]"
          style={{
            WebkitMaskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.85) 0, #000 16px, #000 calc(100% - 16px), rgba(0,0,0,0.85) 100%)",
            maskImage:
              "linear-gradient(to bottom, rgba(0,0,0,0.85) 0, #000 16px, #000 calc(100% - 16px), rgba(0,0,0,0.85) 100%)",
          }}
        >
          <div className="space-y-7">
            {/* Hero */}
            {listing?.images?.[0] ? (
              <div className="relative -mx-4 sm:-mx-5">
                <div className="relative overflow-hidden">
                  <Image
                    src={listing.images[0]}
                    alt={titleText(listing)}
                    width={1920}
                    height={1080}
                    className="block h-56 w-full object-cover"
                    unoptimized
                    priority={false}
                  />
                  {/* ring + gradient */}
                  <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
                  {/* price badge */}
                  <div className="absolute left-3 top-3">
                    <span className="inline-flex items-center rounded-md border border-white/20 bg-black/70 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur-sm shadow-sm">
                      {formatPrice(listing?.price)}
                    </span>
                  </div>
                </div>

                {/* optional thumbs */}
                {hasHeroStrip && (
                  <div className="mt-2 flex gap-2 px-3">
                    {listing!.images.slice(1, 6).map((src, i) => (
                      <div
                        key={`${src}-${i}`}
                        className="relative aspect-[16/11] h-14 overflow-hidden rounded-md border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                        title="More photos"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            {/* Title */}
            <div className="space-y-1 px-0.5">
              <h1 className="text-lg font-semibold leading-tight">{titleText(listing)}</h1>
              {sub ? (
                <div className="flex items-center gap-1.5 text-[13px] leading-tight text-white/75">
                  <MapPin className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="truncate">{sub}</span>
                </div>
              ) : null}
            </div>

            {/* — Divider + Key facts — */}
            <Divider />
            <SectionHeader>Summary</SectionHeader>

            {/* Spec grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {has(listing?.beds) && (
                <SpecItem
                  icon={<BedDouble className="h-4 w-4 opacity-90" />}
                  label={listing!.beds === 0 ? "Studio" : `${listing!.beds} bed${listing!.beds === 1 ? "" : "s"}`}
                />
              )}
              {has(listing?.baths) && (
                <SpecItem
                  icon={<Bath className="h-4 w-4 opacity-90" />}
                  label={`${listing!.baths} bath${listing!.baths === 1 ? "" : "s"}`}
                />
              )}
              {typeLabel(listing) && (
                <SpecItem
                  icon={isApt ? <Building2 className="h-4 w-4 opacity-90" /> : <Home className="h-4 w-4 opacity-90" />}
                  label={typeLabel(listing)!}
                />
              )}
              {toSqm((listing as any)?.sizeSqm) && (
                <SpecItem icon={<Ruler className="h-4 w-4 opacity-90" />} label={`${toSqm((listing as any).sizeSqm)} m²`} />
              )}
            </div>

            {/* — Divider + Actions — */}
            {(mapsUrl) && (
              <>
                <Divider />
                <SectionHeader>Actions</SectionHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[13px] text-white hover:bg-white/[0.10] transition"
                  >
                    <MapPin className="h-4 w-4" />
                    Open in Maps
                  </a>
                </div>
              </>
            )}
            {!mapsUrl && (
              <>
                <Divider />
                <SectionHeader>Actions</SectionHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <ShareButton className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[13px] text-slate-100 hover:bg-white/[0.10] transition" label="Copy link" />
                </div>
              </>
            )}

            {/* — Divider + Links — */}
            {sources.length > 0 && (
              <>
                <Divider />
                <SectionHeader>Links</SectionHeader>
                <div className="grid grid-cols-1 gap-2">
                  {sources.map((s, i) => (
                    <SourceButton key={`${s.url}-${i}`} item={s} prominent={i === 0} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
