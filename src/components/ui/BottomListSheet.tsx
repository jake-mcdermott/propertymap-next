// src/components/ui/BottomListSheet.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/types";
import ScrollContainer from "@/components/ui/ScrollContainer";
import { ListingCard } from "@/components/ListingCard";

type SnapHeights = [number, number]; // [peek, full]

type Props = {
  containerRef: React.RefObject<HTMLDivElement>;
  rows: Listing[];
  loading: boolean;

  /** These can stay wired, but this component now derives slice locally from `rows` + sort */
  pageSlice: Listing[];
  scrollKey: string;
  page: number;
  totalPages: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (n: number) => void;
};

/* ---------- sort helpers (match Sidebar) ---------- */
type SortMode = "relevance" | "priceAsc" | "priceDesc";

function priceForSort(listing: Listing): number {
  const p = (listing.price ?? 0) as number;
  return p > 0 && Number.isFinite(p) ? p : Number.POSITIVE_INFINITY; // POA/0 → end
}

/** Count distinct sources defensively across shapes */
function sourcesCount(listing: Listing): number {
  const anyL = listing as any;
  if (Array.isArray(anyL.sources)) return anyL.sources.filter(Boolean).length;
  if (anyL.sources && typeof anyL.sources === "object") return Object.keys(anyL.sources).length;
  if (Array.isArray(anyL.sourceUrls)) return anyL.sourceUrls.filter(Boolean).length;
  if (Array.isArray(anyL.mergedFrom)) return anyL.mergedFrom.filter(Boolean).length;
  if (typeof anyL.source === "string" && anyL.source) return 1;
  if (typeof anyL.provider === "string" && anyL.provider) return 1;
  return 0;
}

/** Relevance: sources desc, then id asc, then price asc (stable-ish) */
function cmpRelevance(a: Listing, b: Listing): number {
  const ca = sourcesCount(a);
  const cb = sourcesCount(b);
  if (cb !== ca) return cb - ca;
  const aid = String((a as any).id ?? "");
  const bid = String((b as any).id ?? "");
  if (aid !== bid) return aid.localeCompare(bid);
  return priceForSort(a) - priceForSort(b);
}

export default function BottomListSheet({
  containerRef,
  rows,
  loading,

  // still accepted but ignored for slicing (we compute from rows + sort)
  pageSlice: _pageSliceProp,
  scrollKey,
  page,
  totalPages: _totalPagesProp,
  setPage,
  pageSize,
  setPageSize,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const grabRef = useRef<HTMLDivElement>(null);

  // container height cache + "ready" to avoid mid-snap flash
  const containerHRef = useRef<number>(0);
  const [ready, setReady] = useState(false);

  // Compute two snaps: bottom “peek” and top “full”
  const calcSnapHeights = (H: number): SnapHeights => {
    const peek = Math.round(Math.max(88, Math.min(120, H * 0.14))); // ~14% (clamped 88–120px)
    const full = H;
    return [peek, full];
  };

  const [snapHeights, setSnapHeights] = useState<SnapHeights>([320, 720]);
  const [height, setHeight] = useState<number>(0); // set after measure
  const [dragging, setDragging] = useState(false);

  // --- NEW: sort state + derived rows / paging ---
  const [sort, setSort] = useState<SortMode>("relevance");

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    if (sort === "relevance") {
      arr.sort(cmpRelevance);
    } else if (sort === "priceAsc") {
      arr.sort((a, b) => priceForSort(a) - priceForSort(b));
    } else {
      arr.sort((a, b) => priceForSort(b) - priceForSort(a));
    }
    return arr;
  }, [rows, sort]);

  const { localSlice, localTotalPages } = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
    const p = Math.min(Math.max(1, page), totalPages);
    const start = (p - 1) * pageSize;
    const end = Math.min(start + pageSize, sortedRows.length);
    return { localSlice: sortedRows.slice(start, end), localTotalPages: totalPages };
  }, [sortedRows, page, pageSize]);

  // reset to page 1 when sort or pageSize changes
  useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort, pageSize]);

  // measure once + on resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const H = el.clientHeight;
      containerHRef.current = H;

      const snaps = calcSnapHeights(H);
      setSnapHeights(snaps);

      if (!ready) {
        // first real measure: force to bottom snap
        setHeight(snaps[0]);
        setReady(true);
      } else {
        // later resizes: keep nearest of the two
        const nearest = nearestSnap(height, snaps);
        setHeight(nearest);
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nearestSnap = (h: number, snaps: SnapHeights = snapHeights) =>
    Math.abs(h - snaps[0]) <= Math.abs(h - snaps[1]) ? snaps[0] : snaps[1];

  // Drag state is bound to the handle only (list can scroll freely)
  const dragState = useRef<{ pointerId: number | null; startY: number; startHeight: number }>({
    pointerId: null,
    startY: 0,
    startHeight: 0,
  });

  const clampHeight = (h: number) =>
    Math.max(snapHeights[0], Math.min(snapHeights[1], h));

  const heightToTranslateY = (h: number) =>
    Math.max(0, (containerHRef.current || 0) - h);

  const startDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    grabRef.current?.setPointerCapture(e.pointerId);
    dragState.current = { pointerId: e.pointerId, startY: e.clientY, startHeight: height };
    setDragging(true);
  };

  const moveDrag: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!dragging) return;
    const dy = dragState.current.startY - e.clientY; // up => increase height
    setHeight(clampHeight(dragState.current.startHeight + dy));
  };

  const endDrag: React.PointerEventHandler<HTMLDivElement> = () => {
    const id = dragState.current.pointerId;
    if (id != null) {
      try { grabRef.current?.releasePointerCapture(id); } catch {}
    }
    setDragging(false);
    setHeight((h) => nearestSnap(h));
  };

  const toggleSnap = () => {
    const [peek, full] = snapHeights;
    setHeight((h) => (Math.abs(h - peek) < 6 ? full : peek));
  };

  // Pagination
  const canPrev = page > 1;
  const canNext = page < localTotalPages;
  const goPrev = () => canPrev && setPage(page - 1);
  const goNext = () => canNext && setPage(page + 1);

  // Layout constants
  const FOOTER_H = 48;
  const HEADER_H = 104; // handle + tiny toolbar
  const translateY = `translateY(${heightToTranslateY(height)}px)`;

  // While dragging, reduce iOS rubber-band effect a touch
  useEffect(() => {
    if (!dragging) return;
    const prev = document.body.style.overscrollBehaviorY;
    document.body.style.overscrollBehaviorY = "contain";
    return () => { document.body.style.overscrollBehaviorY = prev; };
  }, [dragging]);

  return (
    <div className="absolute inset-x-0 bottom-0 pointer-events-none" style={{ top: 0 }}>
      <div
        ref={panelRef}
        className={[
          "absolute left-0 right-0 bottom-0 z-20 pointer-events-auto will-change-transform",
          dragging || !ready ? "transition-none" : "transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        ].join(" ")}
        style={{
          height: containerHRef.current || 0, // fill container; slide via translateY
          transform: translateY,
        }}
      >
        <div
          className={[
            "relative h-full rounded-t-2xl border-t border-white/12",
            "shadow-[0_-16px_48px_rgba(0,0,0,0.6)] overflow-hidden",
            "bg-black text-slate-100",
          ].join(" ")}
        >
          {/* Handle — the only drag target */}
          <div
            ref={grabRef}
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={toggleSnap}
            className="select-none cursor-grab active:cursor-grabbing"
            style={{ touchAction: "none" }}
            role="button"
            aria-label="Drag to expand list"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleSnap();
              }
            }}
          >
          <div className="flex flex-col pt-2">   {/* was items-center */}
            <div className="h-1.5 w-12 rounded-full bg-white/80 self-center" />

            <div className="mt-2 text-[13px] text-slate-200 self-center">
              {rows.length ? `${rows.length} in view` : (loading ? "Loading…" : "No results")}
            </div>

            {/* toolbar: full-width, left-aligned */}
            <div className="mt-3 w-full px-3 flex items-center gap-3 text-xs justify-start">
              <label className="flex items-center gap-1 text-slate-300">
                Sort
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="ml-1 bg-white/[0.06] text-slate-100 ring-1 ring-white/10 rounded px-2 py-1"
                >
                  <option value="relevance" className="bg-black">Relevance</option>
                  <option value="priceAsc" className="bg-black">Price: Low → High</option>
                  <option value="priceDesc" className="bg-black">Price: High → Low</option>
                </select>
              </label>

              <label className="flex items-center gap-1 text-slate-300">
                per page
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                  className="ml-1 bg-white/[0.06] text-slate-100 ring-1 ring-white/10 rounded px-2 py-1"
                >
                  {[12, 24, 36, 48].map((n) => (
                    <option key={n} value={n} className="bg-black">{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          </div>

          {/* Scroll area (between handle and footer) */}
          <div className="absolute inset-x-0" style={{ top: HEADER_H, bottom: FOOTER_H }}>
            <div className="h-full" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
              <ScrollContainer className="h-full" key={scrollKey}>
                {rows.length === 0 && !loading && (
                  <div className="p-6 text-sm text-slate-300">
                    No listings in view. Pan or zoom the map.
                  </div>
                )}

                {rows.length > 0 && (
                  <ul className="divide-y divide-white/10">
                    {localSlice.map((r) => (
                      <li key={r.id} className="relative transition">
                        <ListingCard listing={r} selected={false} onClick={undefined} />
                      </li>
                    ))}
                  </ul>
                )}
              </ScrollContainer>
            </div>
          </div>

          {/* Footer (always pinned) */}
          {rows.length > 0 && localTotalPages > 1 && (
            <div
              className="absolute inset-x-0 z-10 border-t border-white/10 bg-black"
              style={{
                height: FOOTER_H,
                bottom: 0,
                paddingBottom: "env(safe-area-inset-bottom, 0px)",
              }}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  Page <span className="tabular-nums">{page}</span> /{" "}
                  <span className="tabular-nums">{localTotalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={!canPrev}
                    className={[
                      "px-3 py-1.5 text-sm rounded-md ring-1",
                      canPrev
                        ? "bg-white/5 ring-white/15 hover:bg-white/10 text-slate-100"
                        : "bg-white/5 ring-white/10 text-slate-500 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={goNext}
                    disabled={!canNext}
                    className={[
                      "px-3 py-1.5 text-sm rounded-md ring-1",
                      canNext
                        ? "bg-white/5 ring-white/15 hover:bg-white/10 text-slate-100"
                        : "bg-white/5 ring-white/10 text-slate-500 cursor-not-allowed",
                    ].join(" ")}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* subtle top edge separator */}
          <div
            className="pointer-events-none absolute left-0 right-0 -top-5 h-5"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.5), rgba(0,0,0,0))" }}
          />
        </div>
      </div>
    </div>
  );
}
