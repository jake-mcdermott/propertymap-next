// src/components/layout/DesktopMain.tsx
"use client";

import dynamic from "next/dynamic";
import type { Listing } from "@/lib/types";
import FiltersBar from "../filters/Filters";

// Load map on client only (same as mobile) for consistent boot timing
const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

type Props = {
  listings: Listing[];
  active: Listing | null;
  onSelect: (id: string) => void;
  onVisibleChange?: (ids: string[]) => void;
  onMapLoaded?: () => void; // signal up to BootSplash controller
};

export default function DesktopMain({
  listings,
  active,
  onSelect,
  onVisibleChange,
  onMapLoaded,
}: Props) {
  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="p-2 shrink-0">
        <FiltersBar />
      </div>

      {/* Map fills remainder; no local loader overlay */}
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <PropertyMap
            listings={listings}
            active={active}
            onSelect={onSelect}
            onVisibleChange={(ids) => {
              onVisibleChange?.(ids);
              // optional: nudge visible recompute on big layouts
              // window.dispatchEvent(new Event("map:requery-visible"));
            }}
            onReady={() => {
              // Only tell the app we're ready; BootSplash decides when to fade
              onMapLoaded?.();
            }}
          />
        </div>
      </div>
    </div>
  );
}
