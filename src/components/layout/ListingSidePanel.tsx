// src/components/map/ListingSidePanel.tsx
"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import NextImage from "next/image";
import {
  ChevronRight,
  ChevronLeft,
  MapPin,
  BedDouble,
  Bath,
  Ruler,
  Home,
  Building2,
  ExternalLink,
  Copy,
} from "lucide-react";
import type { Listing } from "@/lib/types";

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

/* ======================= Sources (uniform chips, per-brand logo) ======================= */
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
    if (host.includes("findqo")) return "findqo";
    if (host.includes("google")) return "googlemaps";
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
    case "findqo": return "FindQo";
    case "googlemaps": return "Google Maps";
    default: return "Source";
  }
}

// Strictly use project assets in /public/logos/*.png
const BRAND_LOGO: Record<string, string> = {
  myhome: "/logos/myhome.png",
  daft: "/logos/daft.png",
  findqo: "/logos/findqo.png",
  sherryfitz: "/logos/sherryfitz.png",
  dng: "/logos/dng.png",
  westcorkproperty: "/logos/westcorkproperty.png",
  michelleburke: "/logos/michelleburke.png",
  googlemaps: "/logos/googlemaps.png",
  generic: "/logos/generic.png",
};

// one source of truth for chip dimensions + style (black fill, white border)
const CHIP_BASE =
  [
    "group relative flex items-center gap-3 rounded-2xl no-underline",
    "h-11 px-3.5",
    "border border-white/80 bg-black text-white",
    "shadow-[0_6px_18px_-10px_rgba(0,0,0,0.7)] hover:bg-black/90 hover:border-white transition",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 cursor-pointer",
  ].join(" ");

function SourceChip({ item }: { item: SourceItem }) {
  const brand = brandFromUrl(item.url);
  const label = (item.name?.trim() || prettyName(brand)) || "Source";
  const [src, setSrc] = useState(BRAND_LOGO[brand] || BRAND_LOGO.generic);

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      title={label}
      onClick={(e) => e.stopPropagation()}
      className={CHIP_BASE}
    >
      {/* brand logo — fixed 20px */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        width={20}
        height={20}
        alt=""
        className="h-5 w-5 object-contain"
        onError={() => setSrc(BRAND_LOGO.generic)}
        loading="lazy"
      />
      <span className="flex-1 truncate text-[13px] font-semibold leading-none">
        {label}
      </span>
      <ExternalLink className="h-4 w-4 text-white/80 group-hover:text-white transition" />
    </a>
  );
}

/* Action chip (same style as SourceChip) — LEFT icon only */
function ActionCopyChip({ listing }: { listing: Listing }) {
  const [copied, setCopied] = useState(false);
  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const id = (listing as any)?.id || (listing as any)?.eircode || "";
    return `${window.location.origin}/?listing=${encodeURIComponent(String(id || ""))}`;
  }, [listing]);

  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      },
      () => {
        // Fallback
        try {
          const el = document.createElement("textarea");
          el.value = shareUrl;
          el.setAttribute("readonly", "");
          el.style.position = "absolute";
          el.style.left = "-9999px";
          document.body.appendChild(el);
          el.select();
          document.execCommand("copy");
          document.body.removeChild(el);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {}
      }
    );
  };

  return (
    <button
      type="button"
      className={CHIP_BASE}
      title="Copy link"
      aria-label="Copy link"
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
    >
      <span className="inline-flex h-5 w-5 items-center justify-center">
        <Copy className="h-4 w-4 text-white/90" />
      </span>
      <span className="flex-1 truncate text-[13px] font-semibold leading-none">
        {copied ? "Copied!" : "Copy Link"}
      </span>
    </button>
  );
}

/* ======================= Summary items (white icon only) ======================= */
function SummaryItem({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-slate-300">
        <span className="text-slate-900">{icon}</span>
      </span>
      <span className="text-[13.5px] font-medium text-white/90 leading-tight">{label}</span>
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

/* ======================= Image Carousel (no thumbnail strip) ======================= */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ImageCarousel({
  images,
  alt,
  onOpenFull,
}: {
  images: string[];
  alt: string;
  onOpenFull?: () => void; // reserved if you add a gallery modal later
}) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [touching, setTouching] = useState(false);
  const startXRef = useRef<number | null>(null);

  // reset when images change
  useEffect(() => setIndex(0), [images.join("|")]);

  const total = images.length;

  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const next = (i + delta + total) % total;
      return next;
    });
  }, [total]);

  // keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // preload neighbors
  useEffect(() => {
    if (typeof window === "undefined" || total < 2) return;
    const next = new window.Image();
    next.decoding = "async";
    next.loading = "eager";
    next.src = images[(index + 1) % total] || "";

    const prev = new window.Image();
    prev.decoding = "async";
    prev.loading = "eager";
    prev.src = images[(index - 1 + total) % total] || "";
  }, [index, images, total]);

  // touch/swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    setTouching(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startXRef.current == null) return;
    const dx = e.touches[0].clientX - startXRef.current;
    setDragX(dx);
  };
  const onTouchEnd = () => {
    const threshold = 48;
    if (dragX > threshold) go(-1);
    else if (dragX < -threshold) go(1);
    setDragX(0);
    setTouching(false);
    startXRef.current = null;
  };

  return (
    <div className="relative -mx-4 sm:-mx-5 select-none">
      {/* Main image area */}
      <div
        className="relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="relative"
          style={{
            transform: `translate3d(${touching ? clamp(dragX, -120, 120) : 0}px,0,0)`,
            transition: touching ? "none" : "transform 200ms ease",
          }}
        >
          <NextImage
            key={images[index] ?? "img"}
            src={images[index] ?? ""}
            alt={alt}
            width={1920}
            height={1080}
            className="block h-72 lg:h-80 w-full object-cover"
            unoptimized
            priority={false}
            onClick={onOpenFull}
          />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0" />
        </div>

        {/* Left/Right gradient hit areas */}
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              className={[
                "absolute left-0 top-0 h-full w-16 flex items-center justify-start",
                "bg-gradient-to-r from-black/35 to-transparent",
                "hover:from-black/45 active:scale-[0.98]",
              ].join(" ")}
              onClick={(e) => { e.stopPropagation(); go(-1); }}
            >
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-black/60 ring-1 ring-white/15 p-1.5">
                <ChevronLeft className="h-5 w-5 text-white" />
              </span>
            </button>
            <button
              type="button"
              aria-label="Next image"
              className={[
                "absolute right-0 top-0 h-full w-16 flex items-center justify-end",
                "bg-gradient-to-l from-black/35 to-transparent",
                "hover:from-black/45 active:scale-[0.98]",
              ].join(" ")}
              onClick={(e) => { e.stopPropagation(); go(1); }}
            >
              <span className="mr-1 inline-flex items-center justify-center rounded-full bg-black/60 ring-1 ring-white/15 p-1.5">
                <ChevronRight className="h-5 w-5 text-white" />
              </span>
            </button>
          </>
        )}

        {/* Counter badge */}
        {total > 1 && (
          <div
            className="absolute right-2 top-2 rounded-full bg-black/65 px-2.5 py-1 text-[12px] font-semibold text-white ring-1 ring-white/20"
            aria-live="polite"
          >
            {index + 1} / {total}
          </div>
        )}
      </div>
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
    if (!listing) return [];
    const fromListingUrl: SourceItem[] = (listing as any)?.url ? [{ url: (listing as any).url as string }] : [];
    const fromSources = Array.isArray(listing.sources)
      ? listing.sources.map((s) => ({ name: s.name, url: s.url }))
      : [];
    const norm = (u: string) => {
      try { const y = new URL(u); y.hash = ""; return y.toString().replace(/\/+$/, ""); } catch { return u; }
    };
    const seen = new Set<string>();
    const uniq: SourceItem[] = [];
    for (const s of [...fromListingUrl, ...fromSources]) {
      const k = norm(s.url);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      uniq.push({ ...s, url: k });
    }
    return uniq.slice(0, 8);
  }, [listing]);

  // Pre-composed email link
  const emailHref = useMemo(() => {
    const subject = listing
      ? `Issue with listing: ${titleText(listing)}`
      : "Issue with listing";
    const possibleUrl =
      (listing as any)?.url || (typeof window !== "undefined" ? window.location.href : "");
    const body = `Hi PropertyMap,\n\nThere's an issue with this listing:\n${titleText(
      listing || undefined
    )}\n${possibleUrl}\n\nDetails:\n`;
    return `mailto:info@propertymap.ie?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [listing]);

  if (!mounted) return null;

  const hasCoords =
    typeof listing?.lat === "number" && !Number.isNaN(listing?.lat) &&
    typeof listing?.lng === "number" && !Number.isNaN(listing?.lng);
  const mapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${listing!.lat},${listing!.lng}`
    : undefined;

  const images = (Array.isArray(listing?.images) ? listing!.images : []).filter(Boolean);

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

        {/* Scroll area */}
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
            {/* Hero: Carousel (arrows + counter only) */}
            {images.length > 0 && (
              <ImageCarousel
                images={images}
                alt={titleText(listing || undefined)}
              />
            )}

            {/* Price + Title */}
            <div className="space-y-1 px-0.5">
              <div className="text-2xl font-semibold leading-tight text-white">
                {formatPrice(listing?.price)}
              </div>

              <h1 className="text-lg font-semibold leading-tight">{titleText(listing)}</h1>

              {sub ? (
                <div className="flex items-center gap-1.5 text-sm leading-tight text-white/75">
                  <MapPin className="h-4 w-4 shrink-0 opacity-80" />
                  <span className="truncate">{sub}</span>
                </div>
              ) : null}
            </div>

            {/* — Divider + Key facts — */}
            <Divider />
            <SectionHeader>Summary</SectionHeader>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {has(listing?.beds) && (
                <SummaryItem
                  icon={<BedDouble className="h-4 w-4" />}
                  label={listing!.beds === 0 ? "Studio" : `${listing!.beds} bed${listing!.beds === 1 ? "" : "s"}`}
                />
              )}
              {has(listing?.baths) && (
                <SummaryItem
                  icon={<Bath className="h-4 w-4" />}
                  label={`${listing!.baths} bath${listing!.baths === 1 ? "" : "s"}`}
                />
              )}
              {typeLabel(listing) && (
                <SummaryItem
                  icon={isApt ? <Building2 className="h-4 w-4" /> : <Home className="h-4 w-4" />}
                  label={typeLabel(listing)!}
                />
              )}
              {toSqm((listing as any)?.sizeSqm) && (
                <SummaryItem icon={<Ruler className="h-4 w-4" />} label={`${toSqm((listing as any).sizeSqm)} m²`} />
              )}
            </div>

            {/* — Divider + Actions (Maps chip styled like sources) — */}
            {mapsUrl && listing && (
              <>
                <Divider />
                <SectionHeader>Actions</SectionHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <SourceChip item={{ name: "Google Maps", url: mapsUrl }} />
                  <ActionCopyChip listing={listing} />
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
                    <SourceChip key={`${s.url}-${i}`} item={s} />
                  ))}
                </div>
              </>
            )}

            {/* — Divider + Feedback — */}
            <>
              <Divider />
              <SectionHeader>Troubleshooting</SectionHeader>
              <p className="text-[12.5px] leading-snug text-white/70">
                Noticed an issue with this listing? Please contact{" "}
                <a
                  href={emailHref}
                  className="underline decoration-white/40 underline-offset-[3px] hover:decoration-white"
                >
                  info@propertymap.ie
                </a>
                .
              </p>
            </>
            <div className=""></div>
          </div>
        </div>
      </aside>
    </>,
    document.body
  );
}
