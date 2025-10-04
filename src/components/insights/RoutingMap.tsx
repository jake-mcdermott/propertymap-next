"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { Feature, FeatureCollection } from "geojson";
import type { Map as LeafletMap, Layer } from "leaflet";
import type { LatLngExpression } from "leaflet";

const MapContainer = dynamic(async () => (await import("react-leaflet")).MapContainer, { ssr: false });
const TileLayer    = dynamic(async () => (await import("react-leaflet")).TileLayer, { ssr: false });
const GeoJSON      = dynamic(async () => (await import("react-leaflet")).GeoJSON, { ssr: false });

type Row = { rk: string; county: string | null; avg: number; count: number; lat?: number | null; lng?: number | null };

type Props = {
  rows: Row[];
  valueLabel?: string;              // e.g., "Avg Price" or "Avg €/m²"
  valueFmt?: (n: number) => string; // e.g., €12,345 or €3,456 / m²
};

const rkPropCandidates = ["ROUTINGKEY","ROUTING_KEY","ROUTE_KEY","RK","EIRCODE","POSTCODE","POSTALCODE","POSTAL_K","POSTAL"];
const descriptorPropCandidates = ["DESCRIPTOR","Descriptor","DESC","NAME","LABEL","DISPLAYNAME","DISPLAY_NAM","ROUTING_DESC"];

const defaultFmt = (n: number) => "€" + Math.round(n).toLocaleString("en-IE");
const titleCase = (s: string) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
const extractRK = (val: unknown): string | null => {
  if (val == null) return null;
  const rk = String(val).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  return /^[A-Z0-9]{3}$/.test(rk) ? rk : null;
};

export default function RoutingMap({ rows, valueLabel = "Avg", valueFmt = defaultFmt }: Props) {
  const [geo, setGeo] = React.useState<FeatureCollection | null>(null);
  const [rkProp, setRkProp] = React.useState<string | null>(null);
  const [descProp, setDescProp] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState("");

  // Load the shapes once
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const gjRes = await fetch("/data/routing_keys.geojson");
        if (!gjRes.ok) throw new Error("Failed to load routing_keys.geojson");
        const gj = (await gjRes.json()) as FeatureCollection;

        if (!cancelled) {
          const props0 = (gj.features?.[0]?.properties ?? {}) as Record<string, unknown>;
          const guessRK = rkPropCandidates.find((k) => k in props0) ??
            Object.keys(props0).find((k) => extractRK((props0 as any)[k]));
          const guessDesc = descriptorPropCandidates.find((k) => k in props0) ?? null;

          setRkProp(guessRK ?? null);
          setDescProp(guessDesc);
          setGeo(gj);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Error loading map data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build RK → stat map
  const rkStats = React.useMemo(() => {
    const m = new Map<string, Row>();
    for (const r of rows) m.set(r.rk.toUpperCase(), r);
    return m;
  }, [rows]);

  // Merge stats into features (filter to rows we actually have)
  const fc: FeatureCollection | null = React.useMemo(() => {
    if (!geo) return null;
    const feats: Feature[] = [];

    for (const f of geo.features) {
      const p = (f.properties ?? {}) as Record<string, any>;

      let rk: string | null = null;
      if (rkProp && p[rkProp] != null) rk = extractRK(p[rkProp]);
      if (!rk) {
        for (const k of rkPropCandidates) { rk = extractRK(p[k]); if (rk) break; }
        if (!rk) { for (const [, v] of Object.entries(p)) { rk = extractRK(v); if (rk) break; } }
      }
      if (!rk) continue;

      const stat = rkStats.get(rk);
      if (!stat) continue;

      let desc: string | undefined;
      if (descProp && p[descProp] != null) desc = String(p[descProp]);
      else for (const k of descriptorPropCandidates) { if (p[k] != null) { desc = String(p[k]); break; } }

      feats.push({
        ...f,
        properties: { ...p, __rk: rk, __avg: stat.avg, __cnt: stat.count, __county: stat.county, __desc: desc },
      });
    }

    return { type: "FeatureCollection", features: feats };
  }, [geo, rkProp, descProp, rkStats]);

  // Color scale from current rows (whatever metric they carry)
  const scale = React.useMemo(() => {
    const avgs = rows.map((x) => x.avg).filter(Number.isFinite).sort((a, b) => a - b);
    if (!avgs.length) return { colorFor: (_: number) => "#555" };
    const q = (p: number) => avgs[Math.min(avgs.length - 1, Math.max(0, Math.floor(p * (avgs.length - 1))))];
    const stops = [q(0.05), q(0.25), q(0.5), q(0.75), q(0.95)];
    const palette = ["#224d2a","#2e7d32","#f9a825","#ef6c00","#c62828","#8e0000"];
    const colorFor = (v: number) => {
      let i = 0; while (i < stops.length && v > stops[i]) i++;
      return palette[i];
    };
    return { colorFor };
  }, [rows]);

  const mapRef = React.useRef<LeafletMap | null>(null);
  const dublin: LatLngExpression = [53.35, -6.26];

  // Fit bounds to visible features
  React.useEffect(() => {
    if (!fc || !fc.features.length) return;
    const L = (globalThis as any).L;
    const map = mapRef.current;
    if (!map || !L) return;
    try {
      const layer = L.geoJSON(fc);
      const b = layer.getBounds();
      if (b.isValid()) map.fitBounds(b, { padding: [20, 20] });
    } catch {}
  }, [fc]);

  return (
    <div className="relative w-full h-[380px] md:h-[520px]">
      <style jsx global>{`
        .leaflet-container { z-index: 0 !important; }
        .leaflet-pane,
        .leaflet-top,
        .leaflet-bottom,
        .leaflet-control,
        .leaflet-overlay-pane,
        .leaflet-popup-pane,
        .leaflet-marker-pane,
        .leaflet-shadow-pane,
        .leaflet-tile-pane,
        .leaflet-map-pane { z-index: 0 !important; }
      `}</style>

      {loading && <div className="absolute inset-0 grid place-content-center text-neutral-400 text-sm">Loading map…</div>}
      {err && <div className="absolute inset-0 grid place-content-center text-red-400 text-sm">{err}</div>}

      {!loading && !err && (
        <MapContainer
          ref={mapRef as any}
          center={dublin}
          zoom={7}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
          className="rounded-md"
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            detectRetina
          />
          {fc && (
            <GeoJSON
              key={rows.length + (valueLabel ?? "Avg")}
              data={fc as any}
              style={(feat?: Feature) => {
                const p = (feat?.properties ?? {}) as any;
                const avg = p?.__avg as number | undefined;
                return {
                  color: "#111",
                  weight: 0.6,
                  fillColor: Number.isFinite(avg) ? scale.colorFor(avg!) : "#555",
                  fillOpacity: 0.7,
                };
              }}
              onEachFeature={(feature: Feature, layer: Layer) => {
                const p = (feature.properties ?? {}) as any;
                const rk = p.__rk as string | undefined;
                const avg = p.__avg as number | undefined;
                const cnt = p.__cnt as number | undefined;
                const county = p.__county as string | undefined;
                const desc = p.__desc as string | undefined;
                const html = `
                  <div style="font:12px/1.3 system-ui,-apple-system,Segoe UI,Roboto;color:#000;">
                    <div style="font-weight:600;">${rk ?? "—"} · ${county ? titleCase(county) : "—"}</div>
                    ${desc ? `<div style="margin-top:2px;">${desc}</div>` : ""}
                    <div>${valueLabel ?? "Avg"}: ${Number.isFinite(avg) ? (valueFmt?.(avg!) ?? defaultFmt(avg!)) : "—"}</div>
                    <div>Sample: ${cnt ?? "—"}</div>
                  </div>`;
                (layer as any).bindPopup(html);
                (layer as any).on("mouseover", () => (layer as any).setStyle({ weight: 1.2, fillOpacity: 0.85 }));
                (layer as any).on("mouseout",  () => (layer as any).setStyle({ weight: 0.6, fillOpacity: 0.7 }));
              }}
            />
          )}
        </MapContainer>
      )}
    </div>
  );
}
