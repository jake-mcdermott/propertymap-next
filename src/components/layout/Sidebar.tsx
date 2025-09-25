// src/components/layout/Sidebar.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/types";
import { SURFACE } from "@/lib/ui";
import { ListingCardSidebar } from "@/components/cards";
import ScrollContainer from "@/components/ui/ScrollContainer";

type Props = {
  visibleRows: Listing[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/* Tiny spinner */
function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block ${className} animate-spin rounded-full border-2 border-slate-400/30 border-t-slate-200`}
    />
  );
}

/* Lightweight skeleton */
function SkeletonCard() {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-4 rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] p-0">
      <div className="relative min-h-[135px] bg-white/[0.06]" />
      <div className="py-3 pr-3">
        <div className="space-y-2">
          <div className="h-3.5 w-3/4 bg-white/[0.10] rounded" />
          <div className="h-3 w-2/3 bg-white/[0.08] rounded" />
        </div>
        <div className="mt-4 flex gap-3">
          <div className="h-3 w-16 bg-white/[0.08] rounded" />
          <div className="h-3 w-14 bg-white/[0.08] rounded" />
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-5 w-20 bg-white/[0.06] rounded-md" />
          <div className="h-5 w-16 bg-white/[0.06] rounded-md" />
          <div className="h-5 w-14 bg-white/[0.06] rounded-md" />
        </div>
      </div>
    </div>
  );
}

/**
 * WindowedList: simple virtualization without deps.
 * Assumes roughly fixed item height; use a generous overscan to hide variance.
 */
function WindowedList<T>({
  items,
  renderItem,
  estimatedItemHeight = 160,
  gap = 12,
  overscan = 6,
  className = "",
  onMountTopScrollRef,
}: {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimatedItemHeight?: number;
  gap?: number;
  overscan?: number;
  className?: string;
  onMountTopScrollRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [viewportH, setViewportH] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const rowH = estimatedItemHeight + gap;
  const totalH = Math.max(items.length * rowH - gap, 0);

  useEffect(() => {
    if (!onMountTopScrollRef) return;
    onMountTopScrollRef.current = () => {
      const el = scrollerRef.current;
      if (el) el.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    };
    return () => {
      if (onMountTopScrollRef) onMountTopScrollRef.current = null;
    };
  }, [onMountTopScrollRef]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight));
    ro.observe(el);
    setViewportH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop((e.currentTarget as HTMLDivElement).scrollTop);
  }, []);

  const { start, end, padTop, padBottom } = useMemo(() => {
    if (viewportH <= 0) {
      return {
        start: 0,
        end: Math.min(items.length, 40),
        padTop: 0,
        padBottom: Math.max(totalH - 40 * rowH, 0),
      };
    }
    const first = Math.max(Math.floor(scrollTop / rowH) - overscan, 0);
    const visibleCount = Math.ceil(viewportH / rowH) + overscan * 2;
    const last = Math.min(first + visibleCount, items.length);
    const top = first * rowH;
    const bottom = Math.max(totalH - top - (last - first) * rowH, 0);
    return { start: first, end: last, padTop: top, padBottom: bottom };
  }, [scrollTop, viewportH, items.length, rowH, totalH, overscan]);

  const slice = items.slice(start, end);

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={`flex-1 min-h-0 overflow-auto will-change-scroll ${className}`}
    >
      <div style={{ height: totalH }} className="relative">
        <div style={{ height: padTop }} />
        <div className="px-3 pb-3 grid gap-3">
          {slice.map((item, i) => renderItem(item, start + i))}
        </div>
        <div style={{ height: padBottom }} />
      </div>
    </div>
  );
}

/* Pagination controls */
function Pager({
  total,
  page,
  pageSize,
  onPage,
  onPageSize,
}: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-white border-t border-white/10">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canPrev}
          onClick={() => onPage(page - 1)}
          className={`cursor-pointer px-2 py-1 rounded-md border ${canPrev ? "border-white/15 hover:bg-white/[0.06]" : "border-white/10 opacity-50 cursor-not-allowed"}`}
          aria-label="Previous page"
        >
          Prev
        </button>
        <div className="tabular-nums">{page} / {totalPages}</div>
        <button
          type="button"
          disabled={!canNext}
          onClick={() => onPage(page + 1)}
          className={`cursor-pointer px-2 py-1 rounded-md border ${canNext ? "border-white/15 hover:bg-white/[0.06]" : "border-white/10 opacity-50 cursor-not-allowed"}`}
          aria-label="Next page"
        >
          Next
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="pageSize" className="text-white">Page size</label>
        <select
          id="pageSize"
          value={pageSize}
          onChange={(e) => onPageSize(parseInt(e.target.value, 10))}
          className="cursor-pointer bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 outline-none text-white"
        >
          {[24, 48, 96].map((s) => (
            <option key={s} value={s} className="text-black">{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

/* ---------- NEW: sort helpers ---------- */
type SortMode = "relevance" | "priceAsc" | "priceDesc";
function priceForSort(listing: Listing): number {
  const p = (listing.price ?? 0) as number;
  return p > 0 && Number.isFinite(p) ? p : Number.POSITIVE_INFINITY; // POA/0 → end
}

export default function Sidebar({
  visibleRows,
  loading,
  selectedId,
  onSelect,
}: Props) {
  // pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(48);

  // NEW: sort state
  const [sort, setSort] = useState<SortMode>("relevance");

  // clamp page when list changes
  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleRows.length / pageSize));
    if (page > totalPages) setPage(totalPages);
    if (page < 1) setPage(1);
  }, [visibleRows.length, page, pageSize]);

  // scroll-to-top hook for virtualized list
  const scrollTopRef = useRef<(() => void) | null>(null);

  // NEW: sorted copy (never mutate props)
  const sortedRows = useMemo(() => {
    if (sort === "relevance") return visibleRows;
    const arr = [...visibleRows];
    if (sort === "priceAsc") {
      arr.sort((a, b) => priceForSort(a) - priceForSort(b));
    } else if (sort === "priceDesc") {
      arr.sort((a, b) => priceForSort(b) - priceForSort(a));
    }
    return arr;
  }, [visibleRows, sort]);

  // compute slice for current page (from sorted list)
  const { pageSlice, totalPages } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    const end = Math.min(start + pageSize, sortedRows.length);
    return { pageSlice: sortedRows.slice(start, end), totalPages };
  }, [sortedRows, page, pageSize]);

  // when page, pageSize, or sort changes → scroll to top of list
  useEffect(() => {
    scrollTopRef.current?.();
  }, [page, pageSize, sort]);

  const showSkeletons = loading && visibleRows.length === 0;
  const useWindowing = pageSlice.length > 60; // still window within the current page

  // hover → map highlight
  const sendHover = useCallback((id: string | null) => {
    window.dispatchEvent(new CustomEvent("map:hover", { detail: { id } }));
  }, []);

  return (
    <aside className={`${SURFACE} h-full min-h-0 flex flex-col text-white`}>
      {/* Header */}
      <div className="h-11 flex items-center justify-between px-3 shrink-0">
        <div className="text-sm font-medium">Listings</div>

        {/* NEW: sort control */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort" className="text-xs">Sort</label>
          <select
            id="sort"
            value={sort}
            onChange={(e) => {
              const v = e.target.value as SortMode;
              setSort(v);
              setPage(1);
            }}
            className="cursor-pointer bg-white/[0.04] border border-white/10 rounded-md px-2 py-1 text-xs outline-none text-white"
          >
            <option value="relevance" className="text-black">Relevance</option>
            <option value="priceAsc" className="text-black">Price: Low → High</option>
            <option value="priceDesc" className="text-black">Price: High → Low</option>
          </select>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {loading ? (
            <>
              <Spinner />
              <span>Loading…</span>
            </>
          ) : (
            <span className="tabular-nums">
              {sortedRows.length.toLocaleString()} total
              {sortedRows.length > 0 && (
                <span>{" "}| Page {page}/{totalPages}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* List area */}
      {showSkeletons ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <div className="px-3 pb-3 grid gap-3 animate-pulse">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      ) : sortedRows.length === 0 ? (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="px-4 py-6 text-sm">
            No listings in view. Pan or zoom the map.
          </div>
        </div>
      ) : useWindowing ? (
        <WindowedList
          items={pageSlice}
          estimatedItemHeight={160}
          gap={12}
          overscan={8}
          onMountTopScrollRef={scrollTopRef}
          renderItem={(r) => (
            <ListingCardSidebar
              key={r.id}
              listing={r}
              selected={r.id === selectedId}
              onHover={() => sendHover(r.id)}
              onLeave={() => sendHover(null)}
              onClick={() => onSelect(r.id)}
            />
          )}
        />
      ) : (
        <ScrollContainer className="flex-1 min-h-0">
          <div className="px-3 pb-3 grid gap-3">
            {pageSlice.map((r) => (
              <ListingCardSidebar
                key={r.id}
                listing={r}
                selected={r.id === selectedId}
                onHover={() => sendHover(r.id)}
                onLeave={() => sendHover(null)}
                onClick={() => onSelect(r.id)}
              />
            ))}
          </div>
        </ScrollContainer>
      )}

      {/* Pager */}
      {sortedRows.length > 0 && (
        <Pager
          total={sortedRows.length}
          page={page}
          pageSize={pageSize}
          onPage={(p) => setPage(p)}
          onPageSize={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}

      {/* Footer */}
      <footer className="shrink-0 px-3 py-2">
        <div className="text-[11px] flex items-center justify-between">
          <span>© {new Date().getFullYear()} PropertyMap.ie</span>
          <nav className="flex items-center gap-3">
            <a className="hover:opacity-90" href="/contact">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </aside>
  );
}
