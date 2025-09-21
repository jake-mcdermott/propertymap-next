"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
import { fetchListingsClient } from "@/lib/fetchListingsClient";

function HomeClientInner() {
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Map will set this true only after tiles + clusters + first NON-EMPTY visible set.
  const [bootReady, setBootReady] = useState(false);

  // IDs currently in viewport (used for list & selection, NOT for boot)
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());

  // Selection + mobile UI bits
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"map" | "list">("map");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // IMPORTANT: only mount one layout/tree (prevents two maps racing)
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const sp = useSearchParams();

  /* ---------------- Fetch once on mount ---------------- */
  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchListingsClient();
        if (!alive) return;
        setRows(Array.isArray(data) ? data : []);
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

  /* ---------------- Selection guards ---------------- */
  useEffect(() => {
    if (loading) setSelectedId(null);
  }, [loading]);

  useEffect(() => {
    if (!selectedId) return;
    if (!filteredRows.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [filteredRows, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (!visibleRows.some((r) => r.id === selectedId)) setSelectedId(null);
  }, [visibleRows, selectedId]);

  // Ensure Leaflet gets a resize when switching to map on mobile
  useEffect(() => {
    if (mobileView === "map") {
      const id = requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
      });
      return () => cancelAnimationFrame(id);
    }
  }, [mobileView]);

  /* ---------------- Unified splash rule (desktop == mobile) ---------------- */
  const booting = loading || !bootReady;

  // One-way fade state
  const [splashPhase, setSplashPhase] = useState<"shown" | "fading" | "hidden">("shown");
  useEffect(() => {
    if (splashPhase !== "shown") return;
    if (!booting) {
      setSplashPhase("fading");
      const t = setTimeout(() => {
        setSplashPhase("hidden");
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }, 800);
      return () => clearTimeout(t);
    }
  }, [booting, splashPhase]);

  return (
    <main className="h-dvh overflow-hidden bg-neutral-950 text-slate-100 flex flex-col relative">
      <Header />

      {isDesktop === null ? (
        // Until we know which layout to mount, mount neither to avoid double-map race.
        <div className="flex-1 min-h-0" />
      ) : isDesktop ? (
        // ========================= Desktop ONLY =========================
        <div className="flex-1 min-h-0 h-full grid grid-cols-[minmax(360px,480px)_1fr] gap-0">
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
        // ========================= Mobile ONLY =========================
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

      {/* Global splash overlay */}
      {splashPhase !== "hidden" && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-800 ${
            splashPhase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <BootSplash />
        </div>
      )}
    </main>
  );
}

/** Suspense wrapper for useSearchParams client usage */
export default function HomeClient() {
  return (
    <Suspense fallback={null}>
      <HomeClientInner />
    </Suspense>
  );
}
