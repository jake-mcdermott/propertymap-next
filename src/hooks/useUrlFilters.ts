"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Filters, ListingType } from "@/lib/filters";
import { searchParamsToFilters, filtersToSearchParams } from "@/lib/filters";

/**
 * Centralized URL <-> Filters hook that:
 * - Parses filters from the current URL
 * - Applies updates *shallowly* (History API) with no Next.js navigation
 * - Emits app-wide events so the map/list can re-query in-memory data
 *
 * Absolutely NO router.push/replace here to avoid App Router navigations.
 */

function safeParseFromLocation(): Filters {
  try {
    const sp = new URLSearchParams(window.location.search);
    return searchParamsToFilters(sp);
  } catch {
    // SSR or unexpected environment: return sane defaults
    return { type: "sale" };
  }
}

export function useUrlFilters() {
  const [filters, setFilters] = useState<Filters>(() => {
    if (typeof window === "undefined") return { type: "sale" };
    return safeParseFromLocation();
  });

  // Keep a copy of last-committed type for type-change logic (view/viewport resets)
  const lastTypeRef = useRef<ListingType>(filters.type === "rent" ? "rent" : "sale");
  useEffect(() => {
    lastTypeRef.current = filters.type === "rent" ? "rent" : "sale";
  }, [filters.type]);

  // Parse on mount and whenever user navigates Back/Forward
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => setFilters(safeParseFromLocation());
    window.addEventListener("popstate", onPop);
    // Also react if another part of the app shallow-applies filters
    const onExternal = () => setFilters(safeParseFromLocation());
    window.addEventListener("filters:changed", onExternal as EventListener);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("filters:changed", onExternal as EventListener);
    };
  }, []);

  const replaceFilters = useCallback(
    (next: Filters, opts?: { resetViewportOnTypeChange?: boolean }) => {
      if (typeof window === "undefined") return;

      const current = new URLSearchParams(window.location.search);
      const sp = filtersToSearchParams(next, current);
      const href = `${window.location.pathname}?${sp.toString()}`;
      window.history.replaceState(null, "", href);

      // Update hook state immediately (no need to wait for events)
      setFilters(next);

      // Detect type change (sale <-> rent)
      const prevType = lastTypeRef.current;
      const nextType: ListingType = next.type === "rent" ? "rent" : "sale";
      const typeChanged = prevType !== nextType;

      // Optional viewport reset if type changed (nice UX when flipping sale/rent)
      if (typeChanged && opts?.resetViewportOnTypeChange) {
        try {
          window.dispatchEvent(new Event("map:resetViewport"));
          window.scrollTo({ top: 0, behavior: "auto" });
        } catch {}
      }

      // Let the rest of the app recompute against the in-memory dataset
      try {
        window.dispatchEvent(new CustomEvent<Filters>("filters:changed", { detail: next }));
        window.dispatchEvent(new Event("map:requery-visible"));
      } catch {}

      // Keep internal type tracker in sync
      lastTypeRef.current = nextType;
    },
    []
  );

  return useMemo(() => ({ filters, replaceFilters }), [filters, replaceFilters]);
}
