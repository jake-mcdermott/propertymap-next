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
import type { Map as LeafletMapInstance, LatLngExpression } from "leaflet";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import type Supercluster from "supercluster";
import type { Listing } from "@/lib/types";

import ClusterMarker from "./markers/ClusterMarker";
import ListingMarker from "./markers/ListingMarker";
import { ClProps, PtProps } from "./types";
import MapStatusOverlay from "./MapStatusOverlay";

import MapRefBridge from "./MapRefBridge";
import MapStateSync from "./MapStateSync";
import { isMobileScreen } from "./helpers";

import { EASE, FLY_DURATION, MAP_MAX_ZOOM, PAN_DURATION } from "./constants";
import MapGlobalStyles from "./MapGlobalStyles";
import useBasemap from "./hooks/useBaseMap";
import usePersistedView from "./hooks/usePersistedView";
import useSuperclusterIndex from "./hooks/useSuperclusterIndex";
import useVisibleEmitter from "./hooks/useVisibleEmitter";
import isClusterFeature from "./utils/isClusterFeature";
import { domainLabel } from "./utils/domainLabel";

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

/** NEW: helper to emit a sheet-open event for a cluster's leaves */
function openClusterSheet(
  clusterId: number,
  lat: number,
  lng: number,
  idx: Supercluster<PtProps, ClProps> | null | undefined
) {
  if (!idx) return;
  try {
    // Pull all leaves for this cluster (large limit to be safe)
    const leaves = idx.getLeaves(
      clusterId,
      10_000, // limit
      0 // offset
    ) as unknown as Array<GeoJSON.Feature<GeoJSON.Point, PtProps>>;

    const ids = leaves
      .map((f) => f?.properties?.listingId)
      .filter(Boolean) as string[];

    if (ids.length) {
      window.dispatchEvent(
        new CustomEvent("map:cluster-pick", {
          detail: { ids, lat, lng, openSheet: true },
        })
      );
    }
  } catch {
    // Swallow quietly; worst case the sheet doesn't open.
  }
}

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
  const markerRefs = useRef<Map<string, L.Marker>>(new Map());
  const suppressNextFocusRef = useRef(false);

  const [booted, setBooted] = useState(false);
  const readySentRef = useRef(false);
  const [tilesReady, setTilesReady] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<number | null>(null);

  const { initialCenter, initialZoom } = usePersistedView({ center, active });
  const [bbox, setBbox] = useState<[number, number, number, number]>([
    -10.8, 51.3, -5.3, 55.5,
  ]);
  const [zoom, setZoom] = useState(initialZoom);

  const { basemap } = useBasemap();

  const points = useMemo(() => {
    return listings.map<PointFeature<PtProps>>((l) => {
      const img = Array.isArray(l.images) && l.images.length ? l.images[0] : null;
      const primary = l.url as string | undefined;
      const extra =
        l.sources as Array<{ name: string; url: string }> | undefined;
      const derived = primary
        ? [{ name: domainLabel(primary) ?? "Source", url: primary }]
        : [];
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
          town: (l as any).town ?? null,
          sizeSqm: (l as any).sizeSqm ?? null,
        },
      };
    });
  }, [listings]);

  const { indexRef, indexReady, rawClusters } = useSuperclusterIndex({
    points,
    bbox,
    zoom,
  });
  const { emitVisible, didComputeVisible } = useVisibleEmitter({
    listings,
    mapRef,
    onVisibleChange,
  });

  useEffect(() => {
    if (readySentRef.current) return;
    if (!indexReady || !tilesReady || !didComputeVisible) return;
    readySentRef.current = true;
    setBooted(true);
    requestAnimationFrame(() => onReady?.());
  }, [indexReady, tilesReady, didComputeVisible, onReady]);

  const setMapRef = (m: LeafletMapInstance | null) => {
    mapRef.current = m;
    try {
      (m as any)?.zoomControl?.setPosition(
        isMobileScreen() ? "topright" : "topleft"
      );
    } catch {}
    if (!m) return;

    (m as any).off("popupopen");
    (m as any).on("popupopen", (e: any) => {
      try {
        const map = m as any;
        const latlng = e?.popup?.getLatLng?.();
        if (!latlng) return;
        const bottomPad = isMobileScreen() ? 180 : 40;
        map.panInside(latlng, {
          paddingTopLeft: [20, 20],
          paddingBottomRight: [20, bottomPad],
          animate: true,
        });
      } catch {}
    });

    const save = () => {
      try {
        const c = m.getCenter();
        const z = Math.min(m.getZoom(), MAP_MAX_ZOOM);
        localStorage.setItem(
          "pm-view",
          JSON.stringify({ c: [c.lat, c.lng], z })
        );
      } catch {}
    };
    m.on("moveend zoomend", save);
  };

  useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent).detail as { lat: number; lng: number };
      const map = mapRef.current as any;
      if (!map || !d) return;
      try {
        map.panInside(L.latLng(d.lat, d.lng), {
          paddingTopLeft: [20, 20],
          paddingBottomRight: [20, isMobileScreen() ? 180 : 40],
          animate: true,
        });
      } catch {}
    };
    window.addEventListener("map:nudge-for-popup", handler as EventListener);
    return () =>
      window.removeEventListener(
        "map:nudge-for-popup",
        handler as EventListener
      );
  }, []);

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
      const idx =
        indexRef.current as unknown as Supercluster<PtProps, ClProps> | null;
      if (!row || !map || !idx) return setHoveredClusterId(null);

      const z = Math.round((map as any).getZoom());
      const eps = 1e-4;
      const hits = idx.getClusters(
        [row.lng - eps, row.lat - eps, row.lng + eps, row.lat + eps],
        z
      );
      const hit = hits.find((h: any) => h?.properties?.cluster === true) as any;
      if (hit?.id != null) return setHoveredClusterId(Number(hit.id));

      // fallback to nearest cluster in current set
      const p = (map as any).project(
        [row.lat, row.lng],
        (map as any).getZoom()
      );
      let best: { id: number; d: number } | null = null;
      for (const c of rawClusters) {
        if ((c as any).properties.cluster) {
          const [clng, clat] = c.geometry.coordinates as [number, number];
          const pc = (map as any).project(
            [clat, clng],
            (map as any).getZoom()
          );
          const d2 = Math.hypot(pc.x - p.x, pc.y - p.y);
          const cid = Number((c as any).id);
          if (!Number.isFinite(cid)) continue;
          if (!best || d2 < best.d) best = { id: cid, d: d2 };
        }
      }
      setHoveredClusterId(best && best.d < 48 ? best.id : null);
    };
    window.addEventListener("map:hover", onHover as EventListener);
    return () =>
      window.removeEventListener("map:hover", onHover as EventListener);
  }, [listings, rawClusters, indexRef]);

  const focusOnListing = useCallback(
    (id: string, lat: number, lng: number, zoomHint = 16) => {
      const map = mapRef.current as any;
      if (!map) return;
      const targetZoom = Math.min(
        MAP_MAX_ZOOM,
        Math.max(map.getZoom(), zoomHint)
      );
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
      window.dispatchEvent(new CustomEvent("map:hover", { detail: { id } }));
    },
    []
  );

  useEffect(() => {
    if (!active) return;
    if (suppressNextFocusRef.current) {
      suppressNextFocusRef.current = false;
      window.dispatchEvent(
        new CustomEvent("map:hover", { detail: { id: active.id } })
      );
      return;
    }
    focusOnListing(active.id, active.lat, active.lng, 16);
  }, [active, focusOnListing]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const d = (ev as CustomEvent).detail as {
        id?: string;
        lat: number;
        lng: number;
        zoomHint?: number;
      };
      const map = mapRef.current as any;
      const idx = indexRef.current;
      if (!map || !idx) return;
      const id = d.id ?? null;
      const target = L.latLng(d.lat, d.lng);
      const maxZ = Math.min(map.getMaxZoom?.() ?? MAP_MAX_ZOOM, MAP_MAX_ZOOM);
      let z = Math.max(
        map.getZoom?.() ?? 0,
        Math.min(d.zoomHint ?? 15, MAP_MAX_ZOOM)
      );

      const isClusteredAt = (zoom: number): boolean => {
        const eps = 1e-4;
        const hits = idx.getClusters(
          [d.lng - eps, d.lat - eps, d.lng + eps, d.lat + eps],
          Math.round(zoom)
        );
        if (hits.some((h: any) => h?.properties?.cluster === true)) return true;
        const leaves = hits.filter((h: any) => h?.properties?.cluster !== true);
        return leaves.length > 1;
      };

      const finish = () => {
        if (id) window.dispatchEvent(new CustomEvent("map:hover", { detail: { id } }));
      };

      const step = () => {
        const clustered = isClusteredAt(z);
        if (!clustered || z >= maxZ) {
          map.flyTo(target, Math.min(maxZ, z), {
            animate: true,
            duration: 0.42,
            easeLinearity: 0.4,
            noMoveStart: true,
          });
          setTimeout(finish, 280);
          return;
        }
        z = Math.min(maxZ, z + 1);
        map.flyTo(target, z, {
          animate: true,
          duration: 0.25,
          easeLinearity: 0.4,
          noMoveStart: true,
        });
        setTimeout(step, 260);
      };

      try {
        map.flyTo(target, z, {
          animate: true,
          duration: 0.28,
          easeLinearity: 0.4,
          noMoveStart: true,
        });
      } catch {
        map.setView(target, z, { animate: true });
      }
      setTimeout(step, 300);
    };
    window.addEventListener(
      "map:focus-and-uncluster",
      handler as EventListener
    );
    return () =>
      window.removeEventListener(
        "map:focus-and-uncluster",
        handler as EventListener
      );
  }, [indexReady]);

  const showMap = booted || indexReady;
  const mapOpacityClass = showMap ? "opacity-100" : "opacity-0";
  const mapTransitionClass = "transition-opacity duration-300";
  const CLUSTER_EXPANSION_BIAS = 1;

  const datasetKey = useMemo(() => {
    if (!listings.length) return "empty";
    const first = listings[0]?.id ?? "";
    const last = listings[listings.length - 1]?.id ?? "";
    return `${listings.length}:${first}:${last}`;
  }, [listings]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      try {
        mapRef.current?.invalidateSize(false);
      } catch {}
      emitVisible();
    });
    return () => cancelAnimationFrame(id);
  }, [listings, emitVisible]);

  return (
    <>
      <MapGlobalStyles />

      <div
        className={`${className} relative transition-opacity ${mapTransitionClass} ${mapOpacityClass}`}
      >
        <MapContainer
          key={datasetKey}
          {...mapProps}
          center={initialCenter}
          zoom={initialZoom}
          minZoom={5}
          maxZoom={MAP_MAX_ZOOM}
          scrollWheelZoom
          doubleClickZoom
          touchZoom={true} // pinch-zoom (and two-finger)
          preferCanvas
          className="h-full w-full"
          zoomAnimation
          fadeAnimation
        >
          <MapRefBridge
            setMapRef={setMapRef}
            emitVisible={emitVisible}
            panDurationMs={PAN_DURATION}
          />

          {basemap === "standard" ? (
            <TileLayer
              key="standard"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
              subdomains={["a", "b", "c", "d"]}
              maxZoom={MAP_MAX_ZOOM}
              updateWhenZooming={false}
              keepBuffer={4}
              eventHandlers={{ load: () => setTilesReady(true) }}
            />
          ) : basemap === "satellite" ? (
            <TileLayer
              key="satellite"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={MAP_MAX_ZOOM}
              updateWhenZooming={false}
              keepBuffer={4}
              eventHandlers={{ load: () => setTilesReady(true) }}
            />
          ) : (
            <TileLayer
              key="dark"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
              subdomains={["a", "b", "c", "d"]}
              maxZoom={MAP_MAX_ZOOM}
              updateWhenZooming={false}
              keepBuffer={4}
              eventHandlers={{ load: () => setTilesReady(true) }}
            />
          )}

          <MapStateSync
            setBbox={
              setBbox as Dispatch<
                SetStateAction<[number, number, number, number]>
              >
            }
            setZoom={setZoom as Dispatch<SetStateAction<number>>}
            safeGetBounds={(m) => {
              try {
                if (!m || !(m as any)._loaded) return null;
                return m.getBounds();
              } catch {
                return null;
              }
            }}
            emitVisible={emitVisible}
          />

          {indexReady &&
            rawClusters.map((feature, i) => {
              const [lng, lat] = feature.geometry.coordinates as [
                number,
                number
              ];

              if (isClusterFeature(feature)) {
                const clusterId = Number((feature as any).id);
                const count = (feature as any).properties.point_count as number;
                return (
                  <ClusterMarker
                    key={`cluster-${clusterId}-${i}`}
                    clusterId={clusterId}
                    lat={lat}
                    lng={lng}
                    count={count}
                    onExpand={(cid, clat, clng) => {
                      const map = mapRef.current as any;
                      const idxRef =
                        indexRef.current as unknown as Supercluster<PtProps, ClProps> | null;
                      if (!map || !idxRef) return;
                    
                      const maxZ = Math.min(map.getMaxZoom?.() ?? MAP_MAX_ZOOM, MAP_MAX_ZOOM);
                    
                      // 1) Get Supercluster's expansion zoom (single hop)
                      let expansionZoom: number;
                      try {
                        expansionZoom = idxRef.getClusterExpansionZoom(cid) + 1; // 👈 nudge past expansion
                      } catch {
                        // fallback: one level above current if expansion is unavailable
                        expansionZoom = Math.min((map.getZoom?.() ?? 0) + 1, maxZ);
                      }
                    
                      // 2) Fly directly to the expansion zoom (fast, like before)
                      const desired = Math.min(expansionZoom, maxZ);
                      try {
                        map.flyTo([clat, clng], desired, {
                          animate: true,
                          duration: 0.25,        // fast like your old behavior
                          easeLinearity: 0.4,
                          noMoveStart: true,
                        });
                      } catch {
                        map.setView([clat, clng], desired, { animate: true });
                      }
                    
                      // 3) After the fly, if we are at max zoom and it's still clustered => open the sheet
                      setTimeout(() => {
                        try {
                          const z = map.getZoom?.() ?? 0;
                          if (z < maxZ) return; // not at true max; don't open the sheet
                    
                          const eps = 1e-4;
                          const hits = (
                            indexRef.current as unknown as Supercluster<PtProps, ClProps>
                          )?.getClusters([clng - eps, clat - eps, clng + eps, clat + eps], Math.round(z));
                    
                          const stillCluster = Array.isArray(hits) && hits.some((h: any) => h?.properties?.cluster === true);
                          if (stillCluster) {
                            // get the leaves and show the sheet
                            openClusterSheet(cid, clat, clng, idxRef);
                          }
                        } catch {}
                      }, 300); // just past the 0.25s fly
                    }}                    
                    highlighted={hoveredClusterId === clusterId}
                  />
                );
              }

              const f = feature as PointFeature<PtProps>;
              const id = f.properties.listingId;
              return (
                <ListingMarker
                  key={`${id}-${i}`}
                  f={f}
                  setMarkerRef={(i2: string, ref: L.Marker | null) => {
                    if (ref) markerRefs.current.set(i2, ref);
                    else markerRefs.current.delete(i2);
                  }}
                  onSelect={(id2: string) => {
                    suppressNextFocusRef.current = true;
                    onSelect(id2);
                    window.dispatchEvent(
                      new CustomEvent("map:hover", { detail: { id: id2 } })
                    );
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
