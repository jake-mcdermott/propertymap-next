"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Listing } from "@/lib/types";
import { SURFACE, SURFACE_SOFT, HAIRLINE } from "@/lib/ui";
import FiltersDialog from "@/components/filters/FiltersDialog";
import MapLayersDialog from "@/components/LeafletMap/MayLayersControl";
import type { Filters, ListingType } from "@/lib/filters";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { SlidersHorizontal, RotateCcw, Link as LinkIcon, Check, Layers } from "lucide-react";
import MobileListingDrawer from "@/components/ui/MobileListingDrawer";
import BottomListSheet from "@/components/ui/BottomListSheet";

// IMPORTANT: ensure PropertyMap mounts only on client
const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

type Props = {
  listings: Listing[];
  active: Listing | null;
  visibleRows: Listing[];
  loading: boolean;

  mobileView: "map" | "list";
  setMobileView: (v: "map" | "list") => void;

  onSelect: (id: string) => void;
  onVisibleChange: (ids: string[]) => void;
  onMapLoaded?: () => void;

  mobileFiltersOpen?: boolean;
  setMobileFiltersOpen?: (open: boolean) => void;

  onCloseActive?: () => void;

  mapMountKey?: number;
};

/* ---------- Small button ---------- */
function IconButton({
  title,
  ariaLabel,
  onClick,
  children,
}: {
  title: string;
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      onClick={onClick}
      className="cursor-pointer inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 bg-white/5 hover:bg-white/10 active:scale-[0.98] transition"
    >
      {children}
    </button>
  );
}

export default function MobilePane({
  listings,
  active,
  visibleRows,
  loading,
  mobileView,
  setMobileView,
  onSelect,
  onVisibleChange,
  onMapLoaded,
  mobileFiltersOpen,
  setMobileFiltersOpen,
  onCloseActive,
  mapMountKey = 0,
}: Props) {
  const [filtersOpenUncontrolled, setFiltersOpenUncontrolled] = useState(false);
  const filtersOpen = mobileFiltersOpen ?? filtersOpenUncontrolled;
  const setFiltersOpen = setMobileFiltersOpen ?? setFiltersOpenUncontrolled;

  const [layersOpen, setLayersOpen] = useState(false);

  const [copied, setCopied] = useState(false);
  const { filters, replaceFilters } = useUrlFilters();

  // === Cluster override state ===
  const [clusterOverrideIds, setClusterOverrideIds] = useState<string[] | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetKey, setSheetKey] = useState(0); // bump to remount sheet (fresh measure/animation)

  const handleCopy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {
      window.prompt("Copy this URL:", url);
    }
  };

  const handleReset = () => {
    const type: ListingType = filters.type === "rent" ? "rent" : "sale";
    const cleared: Filters = { type };
    replaceFilters(cleared, { resetViewportOnTypeChange: true });
  };

  // Listen for same-point cluster picks (PropertyMap dispatches map:cluster-pick with openSheet=true)
  useEffect(() => {
    const onPick = (e: Event) => {
      const { ids, openSheet } = (e as CustomEvent).detail as {
        ids: string[];
        lat: number;
        lng: number;
        openSheet?: boolean;
      };
      if (!ids?.length) return;

      setMobileView("map");

      if (openSheet) {
        setClusterOverrideIds(ids.slice());
        setSheetOpen(true);
        setSheetKey((k) => k + 1);
        onCloseActive?.();
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        return;
      }

      onSelect(ids[0]);
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    };

    window.addEventListener("map:cluster-pick", onPick as EventListener);
    return () => window.removeEventListener("map:cluster-pick", onPick as EventListener);
  }, [onSelect, setMobileView, onCloseActive]);

  // Derived rows for the sheet
  const sheetRows = useMemo(() => {
    if (!clusterOverrideIds?.length) return visibleRows;
    const keep = new Set(clusterOverrideIds);
    return visibleRows.filter((r) => keep.has(r.id));
  }, [visibleRows, clusterOverrideIds]);

  // === Pagination ===
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    if (clusterOverrideIds?.length) {
      setPageSize(Math.max(24, clusterOverrideIds.length));
      setPage(1);
    } else {
      setPageSize((s) => Math.max(24, s));
    }
  }, [clusterOverrideIds]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(sheetRows.length / pageSize));
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [sheetRows.length, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters, clusterOverrideIds]);

  const { pageSlice, totalPages } = useMemo(() => {
    const total = Math.max(1, Math.ceil(sheetRows.length / pageSize));
    const p = Math.min(Math.max(1, page), total);
    const start = (p - 1) * pageSize;
    const end = Math.min(start + pageSize, sheetRows.length);
    return { pageSlice: sheetRows.slice(start, end), totalPages: total };
  }, [sheetRows, page, pageSize]);

  const scrollKey = `${page}-${pageSize}`;

  const mapAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapAreaRef.current) return;
    const id = requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSheetClose = () => {
    setSheetOpen(false);
    setClusterOverrideIds(null);
    requestAnimationFrame(() => window.dispatchEvent(new Event("map:requery-visible")));
  };

  return (
    <section className="md:hidden flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className={`${SURFACE} ${HAIRLINE} shrink-0`}>
        <div className="px-3 py-2 flex items-center gap-2">
          {/* Left side intentionally empty so cluster below sits on the right */}
          <div className="ml-auto flex items-center gap-2">
            <IconButton title={copied ? "Copied!" : "Copy link"} ariaLabel="Copy link" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            </IconButton>
            <IconButton title="Reset filters" ariaLabel="Reset filters" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>

            {/* Layers (NEW) */}
            <button
              type="button"
              onClick={() => setLayersOpen(true)}
              className="cursor-pointer border border-white/15 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-200 bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.12] active:scale-[0.99] transition"
              aria-haspopup="dialog"
              aria-expanded={layersOpen}
            >
              <Layers className="h-4 w-4 opacity-90" aria-hidden />
              Layers
            </button>

            {/* Filters LAST so it's at the far right for thumb reach */}
            <button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="cursor-pointer border border-white/15 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-200 bg-white/[0.08] ring-1 ring-white/10 hover:bg-white/[0.12] active:scale-[0.99] transition"
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="h-4 w-4 opacity-90" aria-hidden />
              Filters
            </button>
          </div>
        </div>
      </div>

      {/* Map + sheet */}
      <div ref={mapAreaRef} className="flex-1 min-h-0 relative h-full">
        <div className={`${SURFACE_SOFT} absolute inset-0 h-full w-full`}>
          <PropertyMap
            key={mapMountKey}
            listings={listings}
            active={active}
            onSelect={onSelect}
            onVisibleChange={onVisibleChange}
            onReady={onMapLoaded}
            popupMode="mobile"
          />
        </div>

        <BottomListSheet
          key={sheetKey}
          containerRef={mapAreaRef as React.RefObject<HTMLDivElement>}
          rows={sheetRows}
          loading={loading}
          pageSlice={pageSlice}
          scrollKey={scrollKey}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
          open={clusterOverrideIds ? sheetOpen : undefined}
          onClose={clusterOverrideIds ? handleSheetClose : undefined}
        />
      </div>

      {/* Filters */}
      <FiltersDialog
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
          requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        }}
      />

      {/* Map Layers (NEW) */}
      <MapLayersDialog
        open={layersOpen}
        onClose={() => {
          setLayersOpen(false);
          requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        }}
      />

      {/* Single listing drawer */}
      <MobileListingDrawer
        open={!!active}
        listing={active}
        onClose={() => {
          onCloseActive?.();
          requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
        }}
      />
    </section>
  );
}
