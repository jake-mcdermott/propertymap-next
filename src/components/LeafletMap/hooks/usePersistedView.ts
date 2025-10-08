import { useEffect, useMemo, useRef } from "react";
import type { LatLngExpression } from "leaflet";
import { MAP_MAX_ZOOM } from "../constants";
import { isMobileScreen } from "../helpers";

export default function usePersistedView({
  center,
  active,
}: {
  center?: LatLngExpression;
  active: { lat: number; lng: number } | null;
}) {
  const persistedView = useRef<{ c: LatLngExpression; z: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pm-view");
      if (raw) {
        const { c, z } = JSON.parse(raw);
        if (Array.isArray(c) && typeof z === "number") {
          persistedView.current = { c: [c[0], c[1]] as LatLngExpression, z };
        }
      }
    } catch {}
  }, []);

  const initialCenter = useMemo<LatLngExpression>(() => {
    if (persistedView.current?.c) return persistedView.current.c;
    if (center) return center;
    if (active) return [active.lat, active.lng] as LatLngExpression;
    return [53.5, -8.2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialZoom = useMemo(() => {
    if (persistedView.current?.z != null) return Math.min(persistedView.current.z, MAP_MAX_ZOOM);
    return Math.min(isMobileScreen() ? 6 : 7, MAP_MAX_ZOOM);
  }, []);

  return { initialCenter, initialZoom };
}
