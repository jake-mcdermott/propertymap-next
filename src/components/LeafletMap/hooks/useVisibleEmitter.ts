import { useMemo, useRef, useState } from "react";
import type { Map as LeafletMapInstance, LatLngBounds, LatLngLiteral } from "leaflet";
import type { Listing } from "@/lib/types";

export default function useVisibleEmitter({
  listings,
  mapRef,
  onVisibleChange,
}: {
  listings: Listing[];
  mapRef: React.MutableRefObject<LeafletMapInstance | null>;
  onVisibleChange?: (ids: string[]) => void;
}) {
  const lastSentRef = useRef<string>("");
  const [didComputeVisible, setDidComputeVisible] = useState(false);

  const safeGetBounds = (map: LeafletMapInstance): LatLngBounds | null => {
    try {
      // @ts-expect-error _loaded exists at runtime
      if (!map || !map._loaded) return null;
      return map.getBounds();
    } catch { return null; }
  };

  const emitVisible = useMemo(() => {
    return () => {
      const map = mapRef.current; if (!map) return;
      const b = safeGetBounds(map); if (!b) return;

      const ids = listings
        .filter((l) => b.contains({ lat: l.lat, lng: l.lng } as LatLngLiteral))
        .map((l) => l.id);
      const hash = ids.length ? ids.slice().sort().join("|") : "";
      if (hash !== lastSentRef.current) {
        lastSentRef.current = hash;
        onVisibleChange?.(ids);
      }
      if (!didComputeVisible) setDidComputeVisible(true);
    };
  }, [onVisibleChange, listings, didComputeVisible, mapRef.current]);

  return { emitVisible, didComputeVisible };
}
