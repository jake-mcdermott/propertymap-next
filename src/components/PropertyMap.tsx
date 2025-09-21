"use client";

import dynamic from "next/dynamic";
import type { Listing } from "@/lib/types";
import type { LeafletMapProps } from "@/components/LeafletMap";

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
  onSelect: (id: string) => void;
  center?: LeafletMapProps["center"];
  mapProps?: LeafletMapProps["mapProps"];
  onVisibleChange?: (ids: string[]) => void;
  onReady?: () => void;
  popupMode?: LeafletMapProps["popupMode"];
}) {
  return (
    <div className="h-full w-full min-h-0">
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
    </div>
  );
}
