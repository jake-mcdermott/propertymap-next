// src/components/MobilePane.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Listing } from "@/lib/types";
import { SURFACE, SURFACE_SOFT, HAIRLINE } from "@/lib/ui";
import { ListingCard } from "@/components/ListingCard";
import ScrollContainer from "@/components/ui/ScrollContainer";
import FiltersDialog from "@/components/filters/FiltersDialog";
import type { Filters, ListingType } from "@/lib/filters";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { SlidersHorizontal, RotateCcw, Link as LinkIcon, Check } from "lucide-react";
import MobileListingDrawer from "@/components/ui/MobileListingDrawer";
import BottomListSheet from "@/components/ui/BottomListSheet";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

type Props = {
  listings: Listing[];
  active: Listing | null;
  visibleRows: Listing[];
  loading: boolean;
  mobileView: "map" | "list";                 // kept for parent compatibility (not shown in UI)
  setMobileView: (v: "map" | "list") => void; // kept for parent compatibility
  onSelect: (id: string) => void;
  onVisibleChange: (ids: string[]) => void;
  onMapLoaded?: () => void;
  mobileFiltersOpen?: boolean;
  setMobileFiltersOpen?: (open: boolean) => void;
  onCloseActive?: () => void;
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

/* =====================================================================================
   Main component
   ===================================================================================== */
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
}: Props) {
  const [filtersOpenUncontrolled, setFiltersOpenUncontrolled] = useState(false);
  const filtersOpen = mobileFiltersOpen ?? filtersOpenUncontrolled;
  const setFiltersOpen = setMobileFiltersOpen ?? setFiltersOpenUncontrolled;

  const [copied, setCopied] = useState(false);
  const { filters, replaceFilters } = useUrlFilters();

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

  // Keep old behavior for cluster-pick: just ensure we're on "map" in parent state.
  useEffect(() => {
    const onPick = (e: Event) => {
      const { ids } = (e as CustomEvent).detail as { ids: string[]; lat: number; lng: number };
      if (!ids?.length) return;
      onSelect(ids[0]);
      setMobileView("map");
    };
    window.addEventListener("map:cluster-pick", onPick as EventListener);
    return () => window.removeEventListener("map:cluster-pick", onPick as EventListener);
  }, [onSelect, setMobileView]);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(24);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [visibleRows.length, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const { pageSlice, totalPages } = useMemo(() => {
    const total = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    const p = Math.min(Math.max(1, page), total);
    const start = (p - 1) * pageSize;
    const end = Math.min(start + pageSize, visibleRows.length);
    return { pageSlice: visibleRows.slice(start, end), totalPages: total };
  }, [visibleRows, page, pageSize]);

  const scrollKey = `${page}-${pageSize}`;

  const headerRange = useMemo(() => {
    if (loading) return "…";
    if (visibleRows.length === 0) return "0";
    const start = (page - 1) * pageSize + (pageSlice.length ? 1 : 0);
    const end = (page - 1) * pageSize + pageSlice.length;
    return `${start}–${end} of ${visibleRows.length}`;
  }, [loading, visibleRows.length, page, pageSize, pageSlice.length]);

  const mapAreaRef = useRef<HTMLDivElement>(null);

  return (
    <section className="md:hidden flex-1 min-h-0 flex flex-col">
      {/* Header */}
      <div className={`${SURFACE} ${HAIRLINE} shrink-0`}>
        <div className="px-3 py-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-200 bg-white/[0.05] ring-1 ring-white/10 hover:bg-white/[0.08] transition"
            aria-haspopup="dialog"
            aria-expanded={filtersOpen}
          >
            <SlidersHorizontal className="h-4 w-4 opacity-90" aria-hidden />
            Filters
          </button>

          <div className="ml-auto flex items-center gap-2">
            <IconButton title={copied ? "Copied!" : "Copy link"} ariaLabel="Copy link" onClick={handleCopy}>
              {copied ? <Check className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
            </IconButton>
            <IconButton title="Reset filters" ariaLabel="Reset filters" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>

      {/* Map area (sheet lives inside this container) */}
      <div ref={mapAreaRef} className="flex-1 min-h-0 relative">
        <div className={`${SURFACE_SOFT} absolute inset-0`}>
          <PropertyMap
            listings={listings}
            active={active}
            onSelect={onSelect}
            onVisibleChange={onVisibleChange}
            onReady={onMapLoaded}
            popupMode="mobile"
          />
        </div>

        {/* Bottom draggable list sheet */}
        <BottomListSheet
          containerRef={mapAreaRef as React.RefObject<HTMLDivElement>}
          rows={visibleRows}
          loading={loading}
          pageSlice={pageSlice}
          scrollKey={scrollKey}
          page={page}
          totalPages={totalPages}
          setPage={setPage}
          pageSize={pageSize}
          setPageSize={setPageSize}
        />
      </div>

      {/* Filters dialog */}
      <FiltersDialog
        open={filtersOpen}
        onClose={() => {
          setFiltersOpen(false);
        }}
      />

      {/* Mobile drawer for active listing */}
      <MobileListingDrawer
        open={!!active}
        listing={active}
        onClose={() => {
          onCloseActive?.();
        }}
      />
    </section>
  );
}
