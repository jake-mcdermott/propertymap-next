"use client";

import dynamic from "next/dynamic";
import type { Listing } from "@/lib/types";
import FiltersBar from "../filters/Filters";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), { ssr: false });

type Props = {
  listings: Listing[];
  active: Listing | null;
  onSelect: (id: string) => void;
  onVisibleChange?: (ids: string[]) => void;
  onMapLoaded?: () => void;
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
      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <PropertyMap
            listings={listings}
            active={active}
            onSelect={onSelect}
            onVisibleChange={onVisibleChange}
            onReady={onMapLoaded} // <-- unified: only fires after non-empty visible
          />
        </div>
      </div>
    </div>
  );
}
