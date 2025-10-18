"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import type { Listing } from "@/lib/types";
import Header from "@/components/layout/Header";
import { usePathname, useSearchParams } from "next/navigation";
import { searchParamsToFilters } from "@/lib/filters";
import { filterListings } from "@/lib/filterListings";
import { sameSet } from "@/lib/sameSet";
import { useMediaQuery } from "@/hooks/useMedia";

import DesktopMain from "@/components/layout/DesktopMain";
import Sidebar from "@/components/layout/Sidebar";
import MobilePane from "@/components/layout/MobilePane";
import BootSplash from "@/components/layout/Bootsplash";
import { fetchListingsCached } from "@/lib/fetchListingsCached";
import { Layers, Train, ShoppingCart, X as XIcon, Sparkles, Map as MapIcon } from "lucide-react";

/** Small helper: post-ready delay to let Leaflet finish its first paint */
function usePostReadyDelay(ready: boolean, delayMs = 160) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!ready) { setArmed(false); return; }
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || delayMs <= 0) { setArmed(true); return; }
    const t = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(t);
  }, [ready, delayMs]);
  return armed;
}

const WHATSNEW_KEY = "pm:whatsnew:layers:v2";

function WhatsNewModal({
  onClose,
  onOpenLayers,
}: { onClose: () => void; onOpenLayers: () => void }) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prev?.focus?.();
  }, []);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="whatsnew-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div ref={dialogRef} tabIndex={-1} className="relative w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl focus:outline-none">
        <button aria-label="Close" onClick={onClose} className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-neutral-800/60 hover:bg-neutral-800">
          <XIcon className="h-4 w-4 text-slate-200" />
        </button>
        <div className="p-5 sm:p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">New feature</span>
          </div>
          <h3 id="whatsnew-title" className="text-xl font-semibold text-white">Map Layers: Map Views, Transport & Supermarkets</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
            Find <b>Map Views</b> (Standard, Satellite, Dark), plus <b>Transport</b> and <b>Supermarket</b> overlays in the <b>Layers</b> tab.
          </p>
          <div className="mt-4 grid gap-3 text-slate-300">
            <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><span>Open the <strong>Layers</strong> tab on the map</span></div>
            <div className="flex items-center gap-2"><MapIcon className="h-4 w-4" /><span><strong>Map Views</strong>: Standard · Satellite · Dark</span></div>
            <div className="flex items-center gap-2"><Train className="h-4 w-4" /><span>Show transport overlays (Irish Rail &amp; Luas)</span></div>
            <div className="flex items-center gap-2"><ShoppingCart className="h-4 w-4" /><span>See nearby supermarkets at a glance</span></div>
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button onClick={onClose} className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-800/80">Close</button>
            <button onClick={onOpenLayers} className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-emerald-400">Open Layers tab</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeClientInner() {
  const pathname = usePathname();
  const sp = useSearchParams();

  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [datasetVersion, setDatasetVersion] = useState<string | null>(null);

  const [bootReady, setBootReady] = useState(false);
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isDesktop = useMediaQuery("(min-width: 768px)");

  /* ---------- load data ---------- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { listings, version } = await fetchListingsCached();
        if (!alive) return;
        setRows(Array.isArray(listings) ? listings : []);
        setDatasetVersion(version);
      } catch {
        if (!alive) return;
        setRows([]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  /* ---------- filtering ---------- */
  // Important: ignore `listing` param in filters to avoid coupling selection ↔ filters
  const filters = useMemo(() => {
    const qp = new URLSearchParams(sp.toString());
    qp.delete("listing");
    return searchParamsToFilters(qp);
  }, [sp]);

  const filteredRows = useMemo(() => filterListings(rows, filters), [rows, filters]);
  const active = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  const visibleRows = useMemo(() => {
    if (loading) return [];
    if (!filteredRows.length) return [];
    if (visibleIds.size === 0) return [];
    return filteredRows.filter((r) => visibleIds.has(r.id));
  }, [filteredRows, visibleIds, loading]);

  /* ---------- deep link + URL sync ---------- */

  // Normalize the query param eircode
  const deepLinkId = useMemo(() => {
    const v = (sp.get("listing") || "").toUpperCase().replace(/\s|-/g, "");
    return /^[A-Z0-9]{7}$/.test(v) ? v : null;
  }, [sp]);

  // Skip URL mutations until we resolve the initial deep-link after the first data load.
  const deepLinkResolvedRef = useRef(false);

  // Apply deep link once, right after data loads
  useEffect(() => {
    if (loading) return; // wait for data
    if (deepLinkResolvedRef.current) return; // only handle once on first load

    if (deepLinkId && rows.some((r) => r.id === deepLinkId)) {
      setSelectedId(deepLinkId);
    }
    deepLinkResolvedRef.current = true;
  }, [loading, rows, deepLinkId]);

  // Keep ?listing= synced with selection — but only AFTER the initial deep-link is resolved.
  // Use History API directly to avoid Next soft navigation & re-render.
  useEffect(() => {
    if (!pathname) return;
    if (!deepLinkResolvedRef.current) return;
    if (typeof window === "undefined") return;

    const current = window.location.search;
    const params = new URLSearchParams(current);
    if (selectedId) params.set("listing", selectedId);
    else params.delete("listing");

    const nextSearch = params.toString();
    const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash || ""}`;

    // Only replace if it actually changed
    if (`${pathname}${current}` !== `${pathname}${nextSearch ? `?${nextSearch}` : ""}`) {
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [selectedId, pathname]);

  /* ---------- guards ---------- */
  useEffect(() => { if (loading) setSelectedId(null); }, [loading]);

  // Keep selection even if it temporarily leaves the “visibleRows” due to UI resize.
  // Only clear when selection is NOT in the filtered dataset anymore.
  useEffect(() => {
    if (!selectedId) return;
    if (!filteredRows.some((r) => r.id === selectedId)) {
      setSelectedId(null);
    }
  }, [filteredRows, selectedId]);

  /* ---------- map boot / splash ---------- */
  const booting = loading || !bootReady;
  const desktopRevealArmed = usePostReadyDelay(!booting, 160);
  const contentVisible = isDesktop === true ? (!booting && desktopRevealArmed) : !booting;

  const [splashPhase, setSplashPhase] = useState<"shown" | "fading" | "hidden">("shown");
  useEffect(() => {
    if (splashPhase !== "shown") return;
    if (contentVisible) {
      setSplashPhase("fading");
      const t = setTimeout(() => {
        setSplashPhase("hidden");
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }, 220);
      return () => clearTimeout(t);
    }
  }, [contentVisible, splashPhase]);

  /* ---------- What's New ---------- */
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  useEffect(() => {
    if (!contentVisible) return;
    try {
      const seen = localStorage.getItem(WHATSNEW_KEY);
      if (!seen) {
        const t = setTimeout(() => setShowWhatsNew(true), 200);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [contentVisible]);
  const handleCloseWhatsNew = () => { try { localStorage.setItem(WHATSNEW_KEY, "1"); } catch {} setShowWhatsNew(false); };
  const handleOpenLayers = () => { try { localStorage.setItem(WHATSNEW_KEY, "1"); } catch {} window.dispatchEvent(new CustomEvent("pm:open-layers")); setShowWhatsNew(false); };

  /* ---------- stable callbacks (prevent child re-renders) ---------- */
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id || null);
  }, []);

  const handleVisibleChange = useCallback((ids: string[]) => {
    setVisibleIds((prev) => {
      const next = new Set(ids);
      return sameSet(prev, next) ? prev : next;
    });
  }, []);

  /* ---------- render ---------- */
  return (
    <main className="h-dvh overflow-hidden bg-neutral-950 text-slate-100 flex flex-col relative">
      <Header />
      <h1 className="sr-only">Find property for sale on an interactive map across Ireland</h1>
      <h2 className="sr-only">Popular searches and quick filters</h2>

      {isDesktop === null ? (
        <div className="flex-1 min-h-0" />
      ) : isDesktop ? (
        <div className={`flex-1 min-h-0 h-full grid grid-cols-[minmax(360px,600px)_1fr] gap-0 transition-opacity duration-300 will-change-[opacity] ${contentVisible ? "opacity-100" : "opacity-0"}`}>
          <Sidebar
            visibleRows={visibleRows}
            loading={loading}
            selectedId={selectedId}
            onSelect={handleSelect}
          />
          <DesktopMain
            listings={filteredRows}
            active={active}
            onSelect={handleSelect}
            onVisibleChange={handleVisibleChange}
            onMapLoaded={() => setBootReady(true)}
          />
        </div>
      ) : (
        <MobilePane
          listings={filteredRows}
          active={active}
          visibleRows={visibleRows}
          loading={loading}
          mobileView={mobileView}
          setMobileView={setMobileView}
          mobileFiltersOpen={mobileFiltersOpen}
          setMobileFiltersOpen={setMobileFiltersOpen}
          onSelect={handleSelect}
          onVisibleChange={handleVisibleChange}
          onMapLoaded={() => setBootReady(true)}
          onCloseActive={() => setSelectedId(null)}
        />
      )}

      {splashPhase !== "hidden" && (
        <div className={`fixed inset-0 z-50 transition-opacity duration-200 ${splashPhase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"}`}>
          <BootSplash />
        </div>
      )}

      {showWhatsNew && (
        <WhatsNewModal onClose={handleCloseWhatsNew} onOpenLayers={handleOpenLayers} />
      )}
    </main>
  );
}

export default function HomeClient() {
  return (
    <Suspense fallback={null}>
      <HomeClientInner />
    </Suspense>
  );
}
