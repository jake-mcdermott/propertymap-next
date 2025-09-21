// src/components/PropertyMap/MapRefBridge.tsx
"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

type Props = {
  setMapRef: (m: any) => void;
  emitVisible: () => void;
  panDurationMs?: number;
};

export default function MapRefBridge({ setMapRef, emitVisible, panDurationMs = 300 }: Props) {
  const map = useMap();

  useEffect(() => {
    setMapRef(map);

    map.whenReady(() => {
      // @ts-expect-error runtime prop
      map.options.duration = panDurationMs;

      // initial ticks
      try { map.invalidateSize(false); } catch {}
      requestAnimationFrame(() => emitVisible());
      const r1 = requestAnimationFrame(() => {
        try { map.invalidateSize(false); } catch {}
        emitVisible();
      });
      const t1 = setTimeout(() => {
        try { map.invalidateSize(false); } catch {}
        emitVisible();
      }, 120);

      // container resize → keep bbox fresh
      const ro = new ResizeObserver(() => {
        try { map.invalidateSize(false); } catch {}
        emitVisible();
      });
      ro.observe(map.getContainer());

      // tab visibility bounce
      const onVis = () => {
        if (document.visibilityState === "visible") {
          try { map.invalidateSize(false); } catch {}
          emitVisible();
        }
      };
      document.addEventListener("visibilitychange", onVis);

      return () => {
        cancelAnimationFrame(r1);
        clearTimeout(t1);
        ro.disconnect();
        document.removeEventListener("visibilitychange", onVis);
      };
    });
  }, [map, setMapRef, emitVisible, panDurationMs]);

  return null;
}
