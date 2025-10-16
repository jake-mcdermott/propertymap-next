"use client";

import React, { Suspense, useEffect, useMemo, useState, useRef } from "react";
import type { Listing } from "@/lib/types";
import Header from "@/components/layout/Header";
import { useSearchParams } from "next/navigation";
import { searchParamsToFilters } from "@/lib/filters";
import { filterListings } from "@/lib/filterListings";
import { sameSet } from "@/lib/sameSet";
import { useMediaQuery } from "@/hooks/useMedia";

import DesktopMain from "@/components/layout/DesktopMain";
import Sidebar from "@/components/layout/Sidebar";
import MobilePane from "@/components/layout/MobilePane";
import BootSplash from "@/components/layout/Bootsplash";

// ✅ use the cached fetcher
import { fetchListingsCached } from "@/lib/fetchListingsCached";
import { Layers, Train, ShoppingCart, X as XIcon, Sparkles, Map as MapIcon, Moon } from "lucide-react";

/** Small helper: post-ready delay to let Leaflet finish its first paint */
function usePostReadyDelay(ready: boolean, delayMs = 160) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!ready) {
      setArmed(false);
      return;
    }
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (prefersReduced || delayMs <= 0) {
      setArmed(true);
      return;
    }
    const t = setTimeout(() => setArmed(true), delayMs);
    return () => clearTimeout(t);
  }, [ready, delayMs]);
  return armed;
}

/* ---------------- "What's New" popup ---------------- */
const WHATSNEW_KEY = "pm:whatsnew:layers:v2";

function WhatsNewModal({
  onClose,
  onOpenLayers,
}: {
  onClose: () => void;
  onOpenLayers: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => prevActive?.focus?.();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl focus:outline-none"
      >
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-neutral-800/60 hover:bg-neutral-800"
        >
          <XIcon className="h-4 w-4 text-slate-200" />
        </button>

        <div className="p-5 sm:p-6">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-emerald-300">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-medium">New feature</span>
          </div>

          <h3 id="whatsnew-title" className="text-xl font-semibold text-white">
            Map Layers: Map Views, Transport & Supermarkets
          </h3>

          <p className="mt-2 text-sm leading-relaxed text-slate-200/90">
            You can find new <span className="font-medium">Map Views</span> (Standard, Satellite, Dark),
            plus <span className="font-medium">Transport</span> and <span className="font-medium">Supermarket</span> overlays
            in the <span className="font-semibold">Layers</span> tab. Toggle Irish Rail &amp; Luas lines and quickly
            see nearby chains.
          </p>

          <div className="mt-4 grid gap-3 text-slate-300">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Open the <strong>Layers</strong> tab on the map</span>
            </div>
            <div className="flex items-center gap-2">
              <MapIcon className="h-4 w-4" />
              <span><strong>Map Views</strong>: Standard · Satellite · Dark</span>
            </div>
            <div className="flex items-center gap-2">
              <Train className="h-4 w-4" />
              <span>Show transport overlays (Irish Rail &amp; Luas)</span>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              <span>Plot nearby supermarkets at a glance</span>
            </div>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-800/80"
            >
              Close
            </button>
            <button
              onClick={onOpenLayers}
              className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:bg-emerald-400"
            >
              Open Layers tab
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeClientInner() {
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Track dataset version (so selection resets if data set changes)
  const [datasetVersion, setDatasetVersion] = useState<string | null>(null);

  // Map tells us when tiles+clusters+first visible set are ready
  const [bootReady, setBootReady] = useState(false);

  // IDs currently in viewport (used for list & selection)
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  // Selection + mobile UI bits
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Only mount one layout/tree (prevents two maps racing)
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const sp = useSearchParams();

  /* ---------------- Fetch once on mount (cached) ---------------- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const { listings, fromCache, version } = await fetchListingsCached();
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
    return () => {
      alive = false;
    };
  }, []);

  const active = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  const filters = useMemo(
    () => searchParamsToFilters(new URLSearchParams(sp.toString())),
    [sp]
  );

  const filteredRows = useMemo(() => filterListings(rows, filters), [rows, filters]);

  const visibleRows = useMemo(() => {
    if (loading) return [];
    if (!filteredRows.length) return [];
    if (visibleIds.size === 0) return [];
    return filteredRows.filter((r) => visibleIds.has(r.id));
  }, [filteredRows, visibleIds, loading]);

  /* ---------------- Guards & effects ---------------- */
  // Reset selection while loading new data
  useEffect(() => {
    if (loading) setSelectedId(null);
  }, [loading]);

  // Drop selection if it no longer passes filters
  useEffect(() => {
    if (!selectedId) return;
    if (!filteredRows.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [filteredRows, selectedId]);

  // Drop selection if it scrolls out of view
  useEffect(() => {
    if (!selectedId) return;
    if (!visibleRows.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [visibleRows, selectedId]);

  // If a new dataset version loads later (e.g., after a manifest change), clear selection
  useEffect(() => {
    // reserved for future background refresh logic
  }, [datasetVersion]);

  // Ensure Leaflet gets a resize when switching to map on mobile
  useEffect(() => {
    if (mobileView === "map") {
      const id = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [mobileView]);

  /* ---------------- Unified splash rule ---------------- */
  const booting = loading || !bootReady;
  const desktopRevealArmed = usePostReadyDelay(!booting, 160);
  const contentVisible =
    isDesktop === true ? (!booting && desktopRevealArmed) : !booting;

  // Splash fade
  const [splashPhase, setSplashPhase] =
    useState<"shown" | "fading" | "hidden">("shown");
  useEffect(() => {
    if (splashPhase !== "shown") return;
    if (contentVisible) {
      setSplashPhase("fading");
      const t = setTimeout(() => {
        setSplashPhase("hidden");
        requestAnimationFrame(() =>
          window.dispatchEvent(new Event("resize"))
        );
      }, 220);
      return () => clearTimeout(t);
    }
  }, [contentVisible, splashPhase]);

  /* ---------------- Show "What's New" once ---------------- */
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    if (!contentVisible) return; // wait till map is ready
    try {
      const seen = localStorage.getItem(WHATSNEW_KEY);
      if (!seen) {
        // tiny delay so it appears after UI settles
        const t = setTimeout(() => setShowWhatsNew(true), 200);
        return () => clearTimeout(t);
      }
    } catch {
      // ignore storage errors; fail quietly
    }
  }, [contentVisible]);

  const handleCloseWhatsNew = () => {
    try {
      localStorage.setItem(WHATSNEW_KEY, "1");
    } catch {}
    setShowWhatsNew(false);
  };

  const handleOpenLayers = () => {
    try {
      localStorage.setItem(WHATSNEW_KEY, "1");
    } catch {}
    // Emit a custom event in case you want to auto-open a Layers panel elsewhere.
    // In your Layers UI, you can listen: window.addEventListener("pm:open-layers", ...)
    window.dispatchEvent(new CustomEvent("pm:open-layers"));
    setShowWhatsNew(false);
  };

  return (
    <main className="h-dvh overflow-hidden bg-neutral-950 text-slate-100 flex flex-col relative">
      <Header />

      {/* ✅ SEO-only headings: not visible, don’t block the map */}
      <h1 className="sr-only">
        Find property for sale on an interactive map across Ireland
      </h1>
      <h2 className="sr-only">Popular searches and quick filters</h2>

      {isDesktop === null ? (
        <div className="flex-1 min-h-0" />
      ) : isDesktop ? (
        <div
          className={`
            flex-1 min-h-0 h-full grid grid-cols-[minmax(360px,600px)_1fr] gap-0
            transition-opacity duration-300 will-change-[opacity]
            ${contentVisible ? "opacity-100" : "opacity-0"}
          `}
        >
          <Sidebar
            visibleRows={visibleRows}
            loading={loading}
            selectedId={selectedId}
            onSelect={(id) => setSelectedId(id)}
          />
          <DesktopMain
            listings={filteredRows}
            active={active}
            onSelect={(id) => setSelectedId(id)}
            onVisibleChange={(ids) =>
              setVisibleIds((prev) => {
                const next = new Set(ids);
                return sameSet(prev, next) ? prev : next;
              })
            }
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
          onSelect={(id) => setSelectedId(id)}
          onVisibleChange={(ids) =>
            setVisibleIds((prev) => {
              const next = new Set(ids);
              return sameSet(prev, next) ? prev : next;
            })
          }
          onMapLoaded={() => setBootReady(true)}
          onCloseActive={() => setSelectedId(null)}
        />
      )}

      {splashPhase !== "hidden" && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-200 ${
            splashPhase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <BootSplash />
        </div>
      )}

      {/* What's New modal */}
      {showWhatsNew && (
        <WhatsNewModal
          onClose={handleCloseWhatsNew}
          onOpenLayers={handleOpenLayers}
        />
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
