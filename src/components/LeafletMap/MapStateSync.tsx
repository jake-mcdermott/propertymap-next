// src/components/PropertyMap/MapStateSync.tsx
"use client";

import { useEffect, type Dispatch, type SetStateAction } from "react";
import { useMap, useMapEvents } from "react-leaflet";
import type { LatLngBounds } from "leaflet";
import { toBbox, bboxEqual } from "./helpers";

type Props = {
  setBbox: Dispatch<SetStateAction<[number, number, number, number]>>;
  setZoom: Dispatch<SetStateAction<number>>;
  safeGetBounds: (m: any) => LatLngBounds | null;
  emitVisible: () => void;
};

export default function MapStateSync({
  setBbox,
  setZoom,
  safeGetBounds,
  emitVisible,
}: Props) {
  const map = useMap();

  // prime state on mount
  useEffect(() => {
    const b = safeGetBounds(map);
    if (b) {
      const nb = toBbox(b);
      setBbox((prev) => (bboxEqual(prev, nb) ? prev : nb));
      setZoom((prev) => (prev !== map.getZoom() ? map.getZoom() : prev));
    }
  }, [map, safeGetBounds, setBbox, setZoom]);

  useMapEvents({
    moveend: (e) => {
      const b = safeGetBounds(e.target);
      if (b) {
        const nb = toBbox(b);
        setBbox((prev) => (bboxEqual(prev, nb) ? prev : nb));
        emitVisible();
      }
    },
    zoomend: (e) => {
      setZoom((prev) => (prev !== e.target.getZoom() ? e.target.getZoom() : prev));
      emitVisible();
    },
  });

  return null;
}
