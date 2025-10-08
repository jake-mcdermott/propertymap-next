// src/components/map/MapStatusOverlay.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { GeoJSON, useMap, useMapEvent } from "react-leaflet";
import type { Feature, FeatureCollection, Point } from "geojson";
import L from "leaflet";
import { Clock, TrainFront, TramFront, ShoppingCart } from "lucide-react";
import { fetchManifestClient } from "@/lib/fetchManifestClient";
import { renderToString } from "react-dom/server";

type ManifestInfo = { updatedAt?: Date | null };

// ---- helpers ----
function formatRelative(d: Date) {
  const diff = Math.max(0, Date.now() - d.getTime());
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 45) return "just now";
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr${hr > 1 ? "s" : ""} ago`;
  if (day < 7) return `${day} day${day > 1 ? "s" : ""} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Parse GTFS-like stops.txt lines: stop_id,0,name,,lat,lon,...
function parseStopsTxtToGeoJSON(
  txt: string
): FeatureCollection<Point, { name?: string; id?: string }> {
  const features: Feature<Point, { name?: string; id?: string }>[] = [];
  const lines = txt.split(/\r?\n/);
  for (const line of lines) {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) continue;
    const cols = raw.split(","); // naive split
    if (cols.length < 6) continue;
    const id = cols[0]?.trim();
    const name = cols[2]?.trim();
    const lat = Number(cols[4]);
    const lon = Number(cols[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { id, name },
    });
  }
  return { type: "FeatureCollection", features };
}

type AnyProps = Record<string, any>;
function luasColorFromProps(props?: AnyProps): string {
  const v = String(props?.line ?? props?.route ?? props?.name ?? "").toLowerCase();
  if (v.includes("green")) return "#00A94F"; // LUAS Green
  return "#ef4444";                           // default: Red
}

export default function MapStatusOverlay() {
  // map + zoom tracking
  const map = useMap();
  const [zoom, setZoom] = useState<number>(() => map.getZoom?.() ?? 10);
  useMapEvent("zoomend", () => setZoom(map.getZoom()));

  // status pill
  const [info, setInfo] = useState<ManifestInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);

  // rail lines & stations
  const [railways, setRailways] = useState<FeatureCollection | null>(null);
  const [loadingRails, setLoadingRails] = useState(true);
  const [stations, setStations] =
    useState<FeatureCollection<Point, { name?: string; id?: string }> | null>(null);
  const [loadingStations, setLoadingStations] = useState(true);

  // LUAS lines & stops
  const [luas, setLuas] = useState<FeatureCollection | null>(null);
  const [loadingLuas, setLoadingLuas] = useState(true);
  const [luasStops, setLuasStops] =
    useState<FeatureCollection<Point, { name?: string; id?: string }> | null>(null);
  const [loadingLuasStops, setLoadingLuasStops] = useState(true);

  // SUPERMARKETS
  const [supermarkets, setSupermarkets] =
    useState<FeatureCollection<Point, Record<string, any>> | null>(null);
  const [loadingSupermarkets, setLoadingSupermarkets] = useState(true);

  // UI prefs
  const [showTransit, setShowTransit] = useState<boolean>(() => {
    try { return localStorage.getItem("pm-layer-transport") === "1"; } catch { return false; }
  });
  const [showSupermarkets, setShowSupermarkets] = useState<boolean>(() => {
    try { return localStorage.getItem("pm-layer-supermarkets") === "1"; } catch { return false; }
  });

  const [minZoomForRails, setMinZoomForRails] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("pm-layer-transport-minzoom") || "10", 10); } catch { return 10; }
  });

  // Stations visible from Z14+
  const stationsMinZoom = 14;

  // refresh prefs when dialog “Apply” fires
  useEffect(() => {
    const refresh = () => {
      try {
        setShowTransit(localStorage.getItem("pm-layer-transport") === "1");
        setShowSupermarkets(localStorage.getItem("pm-layer-supermarkets") === "1");
        setMinZoomForRails(parseInt(localStorage.getItem("pm-layer-transport-minzoom") || "10", 10));
      } catch {}
    };
    window.addEventListener("map:requery-visible", refresh);
    return () => window.removeEventListener("map:requery-visible", refresh);
  }, []);

// Ensure panes exist + z-index rules (force stations & supermarkets over listing/cluster markers)
useEffect(() => {
  // Rails (below markers)
  const railPane = map.getPane("pmRailPane") ?? map.createPane("pmRailPane");
  if (railPane) {
    railPane.style.zIndex = "620";
    railPane.style.pointerEvents = "none";
  }

  // LUAS lines (below markers)
  const tramPane = map.getPane("pmTramPane") ?? map.createPane("pmTramPane");
  if (tramPane) {
    tramPane.style.zIndex = "622";
    tramPane.style.pointerEvents = "none";
  }

  // Top-level z for things that must sit above listings/clusters.
  // markerPane is ~600; clusters/listings may use zIndexOffset; 20k wins.
  const transitTopZ = showTransit ? 20000 : 600;
  const transitTipZ = showTransit ? 20500 : 650;

  const supermarketTopZ = showSupermarkets ? 20000 : 600;
  const supermarketTipZ = showSupermarkets ? 20500 : 650;

  // Rail stations (above listings)
  const stationPane = map.getPane("pmStationPane") ?? map.createPane("pmStationPane");
  if (stationPane) {
    stationPane.style.zIndex = String(transitTopZ);
    stationPane.style.pointerEvents = "auto";
  }

  // LUAS stops (above listings)
  const tramStopPane = map.getPane("pmTramStationPane") ?? map.createPane("pmTramStationPane");
  if (tramStopPane) {
    tramStopPane.style.zIndex = String(transitTopZ);
    tramStopPane.style.pointerEvents = "auto";
  }

  // Supermarkets (NOW above listings)
  const smPane = map.getPane("pmSupermarketPane") ?? map.createPane("pmSupermarketPane");
  if (smPane) {
    smPane.style.zIndex = String(supermarketTopZ);
    smPane.style.pointerEvents = "auto";
  }
  const smTipPane = map.getPane("pmSupermarketTipPane") ?? map.createPane("pmSupermarketTipPane");
  if (smTipPane) {
    smTipPane.style.zIndex = String(supermarketTipZ);
    smTipPane.style.pointerEvents = "none";
  }

  // Tooltips (transit)
  const stationTipPane = map.getPane("pmStationTooltipPane") ?? map.createPane("pmStationTooltipPane");
  if (stationTipPane) {
    stationTipPane.style.zIndex = String(transitTipZ);
    stationTipPane.style.pointerEvents = "none";
  }
  const tramTipPane = map.getPane("pmTramTooltipPane") ?? map.createPane("pmTramTooltipPane");
  if (tramTipPane) {
    tramTipPane.style.zIndex = String(transitTipZ);
    tramTipPane.style.pointerEvents = "none";
  }
}, [map, showTransit, showSupermarkets]);

  // Load “updatedAt”
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await fetchManifestClient();
        if (!alive) return;
        setInfo(m ?? null);
      } finally {
        if (alive) setLoadingInfo(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load railways
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/railways.geojson", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed railways.geojson: ${res.status}`);
        const json = (await res.json()) as FeatureCollection;
        if (!alive) return;
        setRailways(json);
      } catch {
        if (!alive) return;
        setRailways(null);
      } finally {
        if (alive) setLoadingRails(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load rail stations (geojson first, else stops.txt)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const gj = await fetch("/data/rail_stations.geojson", { cache: "force-cache" });
        if (gj.ok) {
          const json =
            (await gj.json()) as FeatureCollection<Point, { name?: string; id?: string }>;
          if (!alive) return;
          setStations(json);
        } else {
          const st = await fetch("/data/stops.txt", { cache: "force-cache" });
          if (!st.ok) throw new Error(`Failed stations & stops.txt: ${st.status}`);
          const txt = await st.text();
          const parsed = parseStopsTxtToGeoJSON(txt);
          if (!alive) return;
          setStations(parsed);
        }
      } catch {
        if (!alive) return;
        setStations(null);
      } finally {
        if (alive) setLoadingStations(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load LUAS lines
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/luas.geojson", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed luas.geojson: ${res.status}`);
        const json = (await res.json()) as FeatureCollection;
        if (!alive) return;
        setLuas(json);
      } catch {
        if (!alive) return;
        setLuas(null);
      } finally {
        if (alive) setLoadingLuas(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load LUAS stops
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/luas_stations.geojson", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed luas_stations.geojson: ${res.status}`);
        const json =
          (await res.json()) as FeatureCollection<Point, { name?: string; id?: string }>;
        if (!alive) return;
        setLuasStops(json);
      } catch {
        if (!alive) return;
        setLuasStops(null);
      } finally {
        if (alive) setLoadingLuasStops(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Load Supermarkets
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/data/supermarkets.geojson", { cache: "force-cache" });
        if (!res.ok) throw new Error(`Failed supermarkets.geojson: ${res.status}`);
        const json =
          (await res.json()) as FeatureCollection<Point, Record<string, any>>;
        if (!alive) return;
        setSupermarkets(json);
      } catch {
        if (!alive) return;
        setSupermarkets(null);
      } finally {
        if (alive) setLoadingSupermarkets(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const rel = useMemo(
    () => (info?.updatedAt ? formatRelative(new Date(info.updatedAt)) : null),
    [info?.updatedAt]
  );
  const abs = info?.updatedAt ? new Date(info.updatedAt).toLocaleString() : undefined;

  const containerCls =
    "pointer-events-none absolute left-2 top-2 md:left-3 md:top-auto md:bottom-3 z-[1000] md:z-[1000]";

  // visibility gates
  const railsVisible = !!railways && !!showTransit && zoom >= minZoomForRails;
  const stationsVisible = !!stations && !!showTransit && zoom >= stationsMinZoom;

  const luasVisible = !!luas && !!showTransit && zoom >= minZoomForRails;
  const luasStopsVisible = !!luasStops && !!showTransit && zoom >= stationsMinZoom;

  const supermarketsMinZoom = 12; // show fairly early, adjust if needed
  const supermarketsVisible = !!supermarkets && !!showSupermarkets && zoom >= supermarketsMinZoom;

  // dynamic sizes
  const railWeightMain = Math.max(1.5, Math.min(3, (zoom - 8) * 0.4)); // rails thickness
  const tramWeight = Math.max(0.8, Math.min(2, railWeightMain * 0.7)); // always thinner than rails

  return (
    <>
      {/* Railways */}
      {railsVisible && !loadingRails && (
        <GeoJSON
          pane="pmRailPane"
          data={railways!}
          style={() => ({
            color: "#10b981", // emerald-500
            weight: railWeightMain,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round",
          })}
          interactive={false}
        />
      )}

      {/* LUAS lines (per-feature red/green) */}
      {luasVisible && !loadingLuas && (
        <GeoJSON
          pane="pmTramPane"
          data={luas!}
          style={(feature) => ({
            color: luasColorFromProps(feature?.properties as AnyProps),
            weight: tramWeight,
            opacity: 1,
            lineCap: "round",
            lineJoin: "round",
          })}
          interactive={false}
        />
      )}

      {/* Rail stations (white disc + train icon) */}
      {stationsVisible && !loadingStations && (
        <GeoJSON
          pane="pmStationPane"
          data={stations!}
          pointToLayer={(_feature, latlng) => {
            const sz = Math.round(Math.max(22, Math.min(30, 12 + (zoom - 9) * 2.2)));
            const iconSvg = renderToString(
              <TrainFront size={Math.round(sz * 0.62)} strokeWidth={2.3} className="text-neutral-900" />
            );
            const html = `
              <div
                class="grid place-items-center rounded-full bg-white
                       ring-1 ring-neutral-400/70 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
                style="width:${sz}px;height:${sz}px"
                role="img" aria-label="Train station"
              >${iconSvg}</div>`;
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "pm-train-station",
                html,
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
              }),
              pane: "pmStationPane",
              interactive: true,
              zIndexOffset: 0,
              keyboard: false,
            });
          }}
          onEachFeature={(feature, layer) => {
            const raw = feature.properties?.name || feature.properties?.id || "Station";
            const name = /station/i.test(raw) ? raw : `${raw} Station`;
            layer.bindTooltip(name, {
              pane: "pmStationTooltipPane",
              direction: "top",
              opacity: 0.95,
              offset: L.point(0, -14),
              sticky: true,
              className: "rounded-md px-2 py-1 text-[12px] bg-black/80 text-white ring-1 ring-white/10",
            });
          }}
        />
      )}

      {/* LUAS stops (white disc + tram icon) */}
      {luasStopsVisible && !loadingLuasStops && (
        <GeoJSON
          pane="pmTramStationPane"
          data={luasStops!}
          pointToLayer={(_feature, latlng) => {
            const sz = Math.round(Math.max(22, Math.min(30, 12 + (zoom - 9) * 2.2)));
            const iconSvg = renderToString(
              <TramFront size={Math.round(sz * 0.62)} strokeWidth={2.3} className="text-neutral-900" />
            );
            const html = `
              <div
                class="grid place-items-center rounded-full bg-white
                      ring-1 ring-neutral-400/70 shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
                style="width:${sz}px;height:${sz}px"
                role="img" aria-label="Tram stop"
              >${iconSvg}</div>`;
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "pm-tram-stop",
                html,
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
              }),
              pane: "pmTramStationPane",
              interactive: true,
              zIndexOffset: 0,
              keyboard: false,
            });
          }}
          onEachFeature={(feature, layer) => {
            const raw = feature.properties?.name || feature.properties?.id || "Stop";
            const name = /\bstop\b/i.test(raw) ? raw : `${raw} Stop`;
            layer.bindTooltip(name, {
              pane: "pmTramTooltipPane",
              direction: "top",
              opacity: 0.95,
              offset: L.point(0, -14),
              sticky: true,
              className: "rounded-md px-2 py-1 text-[12px] bg-black/80 text-white ring-1 ring-white/10",
            });
          }}
        />
      )}

      {/* Supermarkets (white disc + cart icon) */}
      {supermarketsVisible && !loadingSupermarkets && (
        <GeoJSON
          pane="pmSupermarketPane"
          data={supermarkets!}
          pointToLayer={(feature, latlng) => {
            const sz = Math.round(Math.max(20, Math.min(28, 10 + (zoom - 9) * 2.0)));
            const iconSvg = renderToString(
              <ShoppingCart
                size={Math.round(sz * 0.58)}
                strokeWidth={2.2}
                className="text-neutral-900"
              />
            );
            const html = `
              <div
                class="grid place-items-center rounded-full bg-white
                       ring-1 ring-emerald-300/70 shadow-[0_2px_8px_rgba(0,0,0,0.20)]"
                style="width:${sz}px;height:${sz}px"
                role="img" aria-label="Supermarket"
              >${iconSvg}</div>`;
            return L.marker(latlng, {
              icon: L.divIcon({
                className: "pm-supermarket",
                html,
                iconSize: [sz, sz],
                iconAnchor: [sz / 2, sz / 2],
              }),
              pane: "pmSupermarketPane",
              interactive: true,
              zIndexOffset: 0,
              keyboard: false,
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = (feature?.properties ?? {}) as AnyProps;
            const label =
              p.branch ??
              p.name ??
              (p.chain ? `${p.chain} Supermarket` : "Supermarket");
            layer.bindTooltip(String(label), {
              pane: "pmSupermarketTipPane",
              direction: "top",
              opacity: 0.95,
              offset: L.point(0, -12),
              sticky: true,
              className:
                "rounded-md px-2 py-1 text-[12px] bg-black/80 text-white ring-1 ring-white/10",
            });
          }}
        />
      )}

      {/* Status pill */}
      {loadingInfo && !info ? (
        <div className={containerCls} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <span className="inline-flex h-6 min-w-[124px] items-center rounded-md bg-black/70">
            <span className="mx-2 h-3 w-3 rounded-full bg-white/30 animate-pulse" />
            <span className="h-3 w-24 rounded bg-white/20 animate-pulse" />
          </span>
        </div>
      ) : rel ? (
        <div className={containerCls} style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <span
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md bg-black/75 px-2.5 py-1 text-[12px] text-white shadow-md ring-1 ring-black/50"
            title={abs ? `Updated ${abs}` : undefined}
            aria-label={abs ? `Updated ${abs}` : undefined}
          >
            <Clock className="h-3.5 w-3.5 opacity-90" />
            Updated {rel}
          </span>
        </div>
      ) : null}
    </>
  );
}
