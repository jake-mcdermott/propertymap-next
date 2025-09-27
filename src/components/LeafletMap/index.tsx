// src/components/PropertyMap/LeafletMap.tsx
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { MapContainer, TileLayer, type MapContainerProps } from "react-leaflet";
import type {
  Map as LeafletMapInstance,
  LatLngBounds,
  LatLngExpression,
  LatLngLiteral,
} from "leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import Supercluster, { type ClusterFeature, type AnyProps } from "supercluster";
import type { Listing } from "@/lib/types";

import ClusterMarker from "./markers/ClusterMarker";
import ListingMarker from "./markers/ListingMarker";
import { ClProps, PtProps } from "./types";
import MapStatusOverlay from "./MapStatusOverlap";

import MapRefBridge from "./MapRefBridge";
import MapStateSync from "./MapStateSync";
import { isMobileScreen } from "./helpers";

/* =====================================================================================
   Types / props
   ===================================================================================== */
export type PopupMode = "auto" | "desktop" | "mobile";
export type LeafletMapProps = {
  listings: Listing[];
  active: Listing | null;
  onSelect: (id: string) => void;
  center?: LatLngExpression;
  mapProps?: Partial<MapContainerProps>;
  onVisibleChange?: (ids: string[]) => void;
  onReady?: () => void;
  className?: string;
  popupMode?: PopupMode;
};

type PointFeature<P = Record<string, unknown>> = GeoJSON.Feature<GeoJSON.Point, P>;
const isClusterFeature = (
  f: PointFeature<PtProps> | ClusterFeature<ClProps>
): f is ClusterFeature<ClProps> => (f.properties as AnyProps).cluster === true;

/* =====================================================================================
   Constants
   ===================================================================================== */
const FLY_DURATION = 450;
const PAN_DURATION = 300;
const EASE = 0.5;

/* =====================================================================================
   Component
   ===================================================================================== */
export default function LeafletMap({
  listings,
  active,
  onSelect,
  center,
  mapProps,
  className = "h-full w-full",
  onVisibleChange,
  onReady,
}: LeafletMapProps) {
  const mapRef = useRef<LeafletMapInstance | null>(null);

  // Marker refs for standard ListingMarker
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const suppressNextFocusRef = useRef(false);

  // Ready gates
  const [booted, setBooted] = useState(false);
  const readySentRef = useRef(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [didComputeVisible, setDidComputeVisible] = useState(false);

  // Cluster index
  const indexRef = useRef<Supercluster<PtProps, ClProps> | null>(null);
  const [indexReady, setIndexReady] = useState(false);
  const [indexVersion, setIndexVersion] = useState(0);

  // Hover highlight
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<number | null>(null);

  // View state
  const initialCenter = useMemo<LatLngExpression>(() => {
    if (center) return center;
    if (active) return [active.lat, active.lng] as LatLngExpression;
    return [53.5, -8.2];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const initialZoom = useMemo(() => (isMobileScreen() ? 6 : 7), []);
  const [bbox, setBbox] = useState<[number, number, number, number]>([-10.8, 51.3, -5.3, 55.5]);
  const [zoom, setZoom] = useState(6);

  /* -----------------------------------------------------------------------------
     Map ref bridge
     ----------------------------------------------------------------------------- */
  const setMapRef = (m: LeafletMapInstance | null) => {
    mapRef.current = m;
  };

  /* -----------------------------------------------------------------------------
     Points (GeoJSON)
     ----------------------------------------------------------------------------- */
  const points = useMemo(() => {
    const domainLabel = (href?: string) => {
      if (!href) return null;
      try {
        const host = new URL(href).host.replace(/^www\./, "");
        if (host.includes("myhome")) return "MyHome";
        if (host.includes("propertymap")) return "PropertyMap";
        if (host.includes("findqo")) return "FindQo";
        if (host.includes("sherryfitz")) return "SherryFitz";
        if (host.includes("dng")) return "DNG";
        return host.split(".")[0];
      } catch {
        return null;
      }
    };

    return listings.map<PointFeature<PtProps>>((l) => {
      const img = Array.isArray(l.images) && l.images.length ? l.images[0] : null;
      const primary = l.url as string | undefined;
      const extra = l.sources as Array<{ name: string; url: string }> | undefined;
      const derived = primary ? [{ name: domainLabel(primary) ?? "Source", url: primary }] : [];
      const sources = (extra && extra.length ? extra : derived).slice(0, 8);

      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [l.lng, l.lat] },
        properties: {
          listingId: l.id,
          price: l.price ?? 0,
          lat: l.lat,
          lng: l.lng,
          title: l.title ?? null,
          beds: l.beds ?? null,
          baths: l.baths ?? null,
          county: l.county ?? null,
          address: l.address ?? null,
          url: primary ?? null,
          eircode: (l as any).eircode ?? null,
          img,
          sources,
        },
      };
    });
  }, [listings]);

  /* -----------------------------------------------------------------------------
     Cluster index
     ----------------------------------------------------------------------------- */
  useEffect(() => {
    let cancelled = false;
    setIndexReady(false);

    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const idx = new Supercluster<PtProps, ClProps>({
        radius: 100,
        maxZoom: 22,
        minZoom: 0,
        minPoints: 2,
      });
      idx.load(points);
      if (cancelled) return;
      indexRef.current = idx;
      setIndexVersion((v) => v + 1);
      setIndexReady(true);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [points]);

  const rawClusters = useMemo(() => {
    const idx = indexRef.current;
    if (!idx || !indexReady) return [] as Array<PointFeature<PtProps> | ClusterFeature<ClProps>>;
    return idx.getClusters(bbox, Math.round(zoom)) as Array<
      PointFeature<PtProps> | ClusterFeature<ClProps>
    >;
  }, [bbox, zoom, indexReady, indexVersion]);

  /* -----------------------------------------------------------------------------
     Ready gate
     ----------------------------------------------------------------------------- */
  useEffect(() => {
    if (readySentRef.current) return;
    if (!indexReady || !tilesReady || !didComputeVisible) return;

    readySentRef.current = true;
    setBooted(true);
    requestAnimationFrame(() => onReady?.());
  }, [indexReady, tilesReady, didComputeVisible, onReady]);

  /* -----------------------------------------------------------------------------
     Visible ids
     ----------------------------------------------------------------------------- */
  const lastSentRef = useRef<string>("");

  const safeGetBounds = (map: LeafletMapInstance): LatLngBounds | null => {
    try {
      // @ts-expect-error _loaded exists at runtime
      if (!map || !map._loaded) return null;
      return map.getBounds();
    } catch {
      return null;
    }
  };

  const emitVisible = useMemo(() => {
    return () => {
      const map = mapRef.current;
      if (!map) return;
      const b = safeGetBounds(map);
      if (!b) return;

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
  }, [onVisibleChange, listings, didComputeVisible]);

  useEffect(() => {
    lastSentRef.current = "";
    const id = requestAnimationFrame(() => {
      try {
        mapRef.current?.invalidateSize(false);
      } catch {}
      emitVisible();
    });
    return () => cancelAnimationFrame(id);
  }, [listings, emitVisible]);

  useEffect(() => {
    if (!indexReady || !tilesReady) return;
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled || didComputeVisible) return;
      try {
        mapRef.current?.invalidateSize(false);
      } catch {}
      try {
        emitVisible();
      } catch {}
      tries += 1;
      if (!cancelled && !didComputeVisible && tries < 10) setTimeout(tick, 90);
    };
    const t0 = setTimeout(tick, 0);
    return () => {
      cancelled = true;
      clearTimeout(t0);
    };
  }, [indexReady, tilesReady, emitVisible, didComputeVisible]);

  useEffect(() => {
    const onRequery = () => {
      try {
        emitVisible();
      } catch {}
    };
    window.addEventListener("map:requery-visible", onRequery as EventListener);
    return () => window.removeEventListener("map:requery-visible", onRequery as EventListener);
  }, [emitVisible]);

  useEffect(() => {
    const onReset = () => {
      const map = mapRef.current;
      if (!map) return;

      const DEFAULT_CENTER: LatLngExpression = [53.5, -8.2];
      const DEFAULT_ZOOM = 6;

      try {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: false });
      } catch {}

      lastSentRef.current = "";
      requestAnimationFrame(() => emitVisible());
    };

    window.addEventListener("map:resetViewport", onReset as EventListener);
    return () => window.removeEventListener("map:resetViewport", onReset as EventListener);
  }, [emitVisible]);

  /* -----------------------------------------------------------------------------
     Hover → highlight nearest cluster when marker not mounted
     ----------------------------------------------------------------------------- */
  function findClusterIdForPoint(
    lat: number,
    lng: number,
    idx: Supercluster<PtProps, ClProps> | null,
    currentZoom: number,
    currentClusters: Array<PointFeature<PtProps> | ClusterFeature<ClProps>>,
    map: LeafletMapInstance | null
  ): number | null {
    if (!idx) return null;

    const z = Math.round(currentZoom);
    const eps = 1e-4;
    const bboxTiny: [number, number, number, number] = [lng - eps, lat - eps, lng + eps, lat + eps];
    const hits = idx.getClusters(bboxTiny, z) as Array<PointFeature<PtProps> | ClusterFeature<ClProps>>;
    const hitCluster = hits.find(isClusterFeature) as ClusterFeature<ClProps> | undefined;

    if (hitCluster?.id != null) {
      const cid = typeof hitCluster.id === "number" ? hitCluster.id : Number(hitCluster.id);
      if (Number.isFinite(cid)) return cid;
    }

    if (!map) return null;

    let best: { id: number; d: number } | null = null;
    const p = (map as any).project([lat, lng], (map as any).getZoom());
    for (const c of currentClusters) {
      if ((c as any).properties.cluster) {
        const [clng, clat] = c.geometry.coordinates as [number, number];
        const pc = (map as any).project([clat, clng], (map as any).getZoom());
        const d = Math.hypot(pc.x - p.x, pc.y - p.y);
        const cid = Number((c as ClusterFeature<ClProps>).id);
        if (!Number.isFinite(cid)) continue;
        if (!best || d < best.d) best = { id: cid, d };
      }
    }
    return best && best.d < 48 ? best.id : null;
  }

  useEffect(() => {
    const onHover = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { id?: string } | undefined;
      const id = d?.id ?? null;
      setHoveredId(id);

      if (!id) return setHoveredClusterId(null);

      const mk = markerRefs.current.get(id);
      if (mk) return setHoveredClusterId(null);

      const row = listings.find((r) => r.id === id);
      const map = mapRef.current;
      const idx = indexRef.current;
      if (!row || !map || !idx) return setHoveredClusterId(null);

      const cid = findClusterIdForPoint(row.lat, row.lng, idx, (map as any).getZoom(), rawClusters, map);
      setHoveredClusterId(cid ?? null);
    };

    window.addEventListener("map:hover", onHover as EventListener);
    return () => window.removeEventListener("map:hover", onHover as EventListener);
  }, [listings, rawClusters]);

  /* -----------------------------------------------------------------------------
     Focus helpers
     ----------------------------------------------------------------------------- */
  const tryOpenPopup = useCallback((id: string) => {
    if (isMobileScreen()) return;
    markerRefs.current.get(id)?.openPopup();
  }, []);

  const focusOnListing = useCallback(
    (id: string, lat: number, lng: number, zoomHint = 16) => {
      const map = mapRef.current as any;
      if (!map) return;

      const targetZoom = Math.max(map.getZoom(), zoomHint);
      try {
        map.flyTo([lat, lng], targetZoom, {
          animate: true,
          duration: FLY_DURATION / 1000,
          easeLinearity: EASE,
          noMoveStart: true,
        });
      } catch {
        map.setView([lat, lng], targetZoom, { animate: true });
      }
      tryOpenPopup(id);
    },
    [tryOpenPopup]
  );

  useEffect(() => {
    if (!active) return;

    if (suppressNextFocusRef.current) {
      suppressNextFocusRef.current = false;
      tryOpenPopup(active.id);
      return;
    }
    focusOnListing(active.id, active.lat, active.lng, 16);
  }, [active, focusOnListing, tryOpenPopup]);

  /* =====================================================================================
     Render
     ===================================================================================== */
  const showMap = booted || indexReady;
  const mapOpacityClass = showMap ? "opacity-100" : "opacity-0";
  const mapTransitionClass = "transition-opacity duration-300";

  const datasetKey = useMemo(() => {
    if (!listings.length) return "empty";
    const first = listings[0]?.id ?? "";
    const last = listings[listings.length - 1]?.id ?? "";
    return `${listings.length}:${first}:${last}`;
  }, [listings]);

  return (
    <>
      <style jsx global>{`
        :root {
          --pm-brand-1: #01677c;
          --pm-brand-2: #01677c;
          --pm-on-dark: #eef2ff;
          --pm-border: rgba(255,255,255,0.22);
          --pm-border-soft: rgba(255,255,255,0.14);
          --pm-zoom-ms: 300ms;
        }

        .leaflet-container { background: #05080f; outline: none; }

        /* Ensure markers & popups sit above tiles */
        .leaflet-pane.leaflet-marker-pane { z-index: 9998 !important; }
        .leaflet-pane.leaflet-popup-pane { z-index: 9999 !important; }

        /* Listing marker pill (used by <ListingMarker/>) */
        .pm-icon.pm-marker { background: transparent; border: 0; }
        .pm-marker-box { position: relative; }
        .pm-marker-pill {
          position: absolute;
          left: 50%;
          bottom: 0;
          transform: translateX(-50%);
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          height: 24px;
          border-radius: 9999px;
          color: #fff;
          white-space: nowrap;
          background: linear-gradient(180deg, rgba(255,255,255,.15) 0%, rgba(255,255,255,.06) 100%),
                      linear-gradient(135deg, var(--pm-brand-1) 0%, var(--pm-brand-2) 100%);
          border: 1px solid var(--pm-border);
          backdrop-filter: blur(2px);
          box-shadow: 0 8px 18px rgba(0,0,0,.35);
        }
        .pm-marker-price { font-weight: 900; font-size: 12.5px; letter-spacing: .15px; }
        .pm-marker-pill.is-highlighted {
          background: linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%) !important;
          border-color: rgba(251,146,60,.95);
          color: #fff;
          box-shadow: 0 0 0 2px rgba(251,146,60,.35), 0 10px 22px rgba(0,0,0,.45);
          transform: translateX(-50%) scale(1.06);
        }

        /* Cluster pill (used by <ClusterMarker/>) */
        .pm-cluster { background: transparent; border: 0; padding: 0; }
        .pm-cluster-outer { transform: translate(-50%, -100%); }
        .pm-cluster-pill {
          display: inline-flex; align-items: center; justify-content: center;
          height: 28px; padding: 0 12px; border-radius: 9999px;
          border: 1px solid var(--pm-border); color: #eef2ff;
          font-weight: 800; font-size: 12.5px; letter-spacing: .15px;
          background: radial-gradient(120% 140% at 100% 0%, rgba(255,255,255,.18), rgba(255,255,255,0) 60%),
                      linear-gradient(135deg, var(--pm-brand-1) 0%, var(--pm-brand-2) 100%);
          box-shadow: 0 8px 18px rgba(0,0,0,.35);
        }
        .pm-cluster-outer.is-highlighted .pm-cluster-pill {
          background: linear-gradient(135deg, #fb923c 0%, #f97316 45%, #ea580c 100%) !important;
          border-color: rgba(251,146,60,.95); color: #fff;
          box-shadow: 0 0 0 2px rgba(251,146,60,.35), 0 10px 22px rgba(0,0,0,.45);
        }

        /* Optional popup theme */
        .pm-popup .leaflet-popup-content { margin: 0 !important; padding: 0 !important; }
        .pm-popup .leaflet-popup-content-wrapper {
          background: radial-gradient(90% 100% at 100% 0%, rgba(124,58,237,.12), rgba(124,58,237,0) 70%), #0b1220;
          color: #e5eaf6; border: 1px solid var(--pm-border-soft); backdrop-filter: blur(6px);
          border-radius: 12px; box-shadow: 0 14px 34px rgba(2,4,8,.6); overflow: hidden;
        }
        .pm-popup .leaflet-popup-tip { background: #0b1220; border: 1px solid var(--pm-border-soft); }

        /* (Mobile) If you use a drawer instead of popups, hide popups */
        @media (max-width: 767px) {
          .leaflet-container .leaflet-popup,
          .leaflet-container .leaflet-popup-pane {
            display: none !important;
            visibility: hidden !important;
          }
        }
      `}</style>

      <div className={`${className} ${mapTransitionClass} ${mapOpacityClass}`}>
        <MapContainer
          key={datasetKey}
          center={initialCenter}
          zoom={initialZoom}
          minZoom={5}
          maxZoom={21}
          scrollWheelZoom
          // keep standard double-click / double-tap zoom enabled
          doubleClickZoom={true}
          preferCanvas
          className="h-full w-full"
          zoomAnimation
          fadeAnimation
          {...mapProps}
        >
          <MapRefBridge setMapRef={setMapRef} emitVisible={emitVisible} panDurationMs={PAN_DURATION} />

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap contributors &copy; CARTO"
            subdomains={["a", "b", "c", "d"]}
            detectRetina
            maxNativeZoom={20}
            maxZoom={22}
            eventHandlers={{ load: () => setTilesReady(true) }}
          />

          <MapStateSync
            setBbox={setBbox as Dispatch<SetStateAction<[number, number, number, number]>>}
            setZoom={setZoom as Dispatch<SetStateAction<number>>}
            safeGetBounds={(m) => {
              try { if (!m || !(m as any)._loaded) return null; return m.getBounds(); } catch { return null; }
            }}
            emitVisible={emitVisible}
          />

          {/* Clusters + markers (no spidering, no hold-zoom) */}
          {indexReady &&
            rawClusters.map((feature, idx) => {
              const [lng, lat] = feature.geometry.coordinates as [number, number];

              if (isClusterFeature(feature)) {
                const count = feature.properties.point_count as number;
                const clusterId = Number(feature.id);
                return (
                  <ClusterMarker
                    key={`cluster-${clusterId}-${idx}`}
                    clusterId={clusterId}
                    lat={lat}
                    lng={lng}
                    count={count}
                    onExpand={(cid, clat, clng) => {
                      const map = mapRef.current as any;
                      const idxRef = indexRef.current;
                      if (!map || !idxRef) return;

                      const base = idxRef.getClusterExpansionZoom(cid);
                      const desired = Math.min(
                        Math.max(base + 1, map.getZoom() + 1),
                        map.getMaxZoom()
                      );

                      map.flyTo([clat, clng], desired, {
                        animate: true,
                        duration: 0.55,
                        easeLinearity: 0.4,
                        noMoveStart: true,
                      });
                    }}
                    highlighted={hoveredClusterId === clusterId}
                  />
                );
              }

              const f = feature as PointFeature<PtProps>;
              const id = f.properties.listingId;

              return (
                <ListingMarker
                  key={`${id}-${idx}`}
                  f={f}
                  setMarkerRef={(i: string, ref: L.Marker | null) => {
                    if (ref) markerRefs.current.set(i, ref);
                    else markerRefs.current.delete(i);
                  }}
                  onSelect={(id2: string) => {
                    suppressNextFocusRef.current = true; // map click → popup only
                    onSelect(id2);
                    if (!isMobileScreen()) {
                      try { markerRefs.current.get(id2)?.openPopup(); } catch {}
                    }
                  }}
                  highlighted={hoveredId === id}
                />
              );
            })}

          <MapStatusOverlay />
        </MapContainer>
      </div>
    </>
  );
}
