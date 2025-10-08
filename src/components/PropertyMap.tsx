"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Listing } from "@/lib/types";
import type { LeafletMapProps } from "@/components/LeafletMap";
import ListingSidePanel from "@/components/layout/ListingSidePanel";

const LeafletMap = dynamic<LeafletMapProps>(
  () => import("@/components/LeafletMap").then((m) => m.default),
  { ssr: false }
);

export default function PropertyMap({
  listings,
  active,
  onSelect,
  center,
  mapProps,
  onVisibleChange,
  onReady,
  popupMode,
}: {
  listings: Listing[];
  active: Listing | null;
  onSelect: (id: string) => void; // call with "" (empty) to clear selection
  center?: LeafletMapProps["center"];
  mapProps?: LeafletMapProps["mapProps"];
  onVisibleChange?: (ids: string[]) => void;
  onReady?: () => void;
  popupMode?: LeafletMapProps["popupMode"];
}) {
  const byId = useMemo(() => {
    const m = new Map<string, Listing>();
    for (const l of listings) m.set(l.id, l);
    return m;
  }, [listings]);

  const activeRow = active ? byId.get(active.id) ?? active : null;

  return (
    <div className="relative h-full w-full min-h-0">
      <LeafletMap
        listings={listings}
        active={active}
        onSelect={onSelect}
        center={center}
        mapProps={mapProps}
        className="h-full w-full"
        onVisibleChange={onVisibleChange}
        onReady={onReady}
        popupMode={popupMode}
      />

      {/* Desktop slide-over (hidden on mobile via the component’s classes) */}
      <ListingSidePanel
        open={!!activeRow}
        listing={activeRow ?? null}
        onClose={() => onSelect("")}
      />
    </div>
  );
}
