// src/components/PropertyMap/markers/ListingMarker.tsx
"use client";

import { useMemo } from "react";
import { Marker, Popup } from "react-leaflet";
import type { Marker as LeafletMarker, DivIcon } from "leaflet";
import L from "leaflet";
import type { PtProps } from "../types";
import { ListingCardPopup } from "@/components/cards";

type PointFeature<P = any> = GeoJSON.Feature<GeoJSON.Point, P>;

type Props = {
  f: PointFeature<PtProps>;
  setMarkerRef: (id: string, ref: LeafletMarker | null) => void;
  onSelect: (id: string) => void;
  highlighted?: boolean; // <- from map:hover in LeafletMap
  popupMode?: "desktop" | "mobile";
};

function formatCompact(n?: number | null) {
  if (n == null) return "—";
  const upper = new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: n >= 1_000_000 ? 2 : 0,
  }).format(n);
  return upper.toLowerCase();
}

export function displayPriceCompact(price?: number | null) {
  const n = Number(price);
  if (!Number.isFinite(n) || n <= 0) return "POA";
  return `€${formatCompact(n)}`;
}

function measurePillWidth(text: string) {
  const font =
    "900 13px Inter, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
  const canvas =
    (measurePillWidth as any)._c || ((measurePillWidth as any)._c = document.createElement("canvas"));
  const ctx = canvas.getContext("2d")!;
  ctx.font = font;
  const textW = ctx.measureText(text).width;
  const PADDING_X = 12, BORDER_X = 2, BUFFER = 4;
  const w = Math.ceil(textW + PADDING_X + BORDER_X + BUFFER);
  return Math.max(text === "POA" ? 32 : 36, Math.min(160, w));
}

export default function ListingMarker({ f, setMarkerRef, onSelect, highlighted = false }: Props) {
  const id = f.properties.listingId;
  const { lat, lng } = f.properties;
  const { title, img, beds, baths, county, address, eircode } = f.properties;
  const price = f.properties.price as number | null | undefined;

  const label = useMemo(() => displayPriceCompact(price), [price]);

  const icon: DivIcon = useMemo(() => {
    const H = 24;
    const W = measurePillWidth(label);
    const pillCls = `pm-marker-pill${highlighted ? " is-highlighted" : ""}`;

    const html = `
      <div class="pm-marker-box" style="width:${W}px;height:${H}px;">
        <div class="${pillCls}">
          <span class="pm-marker-price">${label}</span>
        </div>
      </div>
    `;

    return L.divIcon({
      className: "pm-icon pm-marker",
      html,
      iconSize: [W, H],
      iconAnchor: [W / 2, H],   // bottom-center
      popupAnchor: [0, -H],     // popup above pill
    });
  }, [label, highlighted]);

  // Lift highlighted markers above others
  const zIndexOffset = highlighted ? 1000 : 0;

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      zIndexOffset={zIndexOffset}
      ref={(ref) => setMarkerRef(id, (ref as unknown as LeafletMarker) || null)}
      eventHandlers={{ click: () => onSelect(id) }}
    >
      <Popup className="pm-popup" maxWidth={360} minWidth={320} closeButton autoPan={false}>
        <ListingCardPopup
          listing={{
            id,
            title: title ?? undefined,
            price: price && price > 0 ? price : null, // let card render POA if null
            address: address ?? undefined,
            county: county ?? undefined,
            beds: beds ?? undefined,
            eircode: eircode ?? undefined,
            baths: baths ?? undefined,
            images: img ? [img] : [],
            sources: (f.properties.sources as any) || [],
            lat,
            lng,
            kind: undefined,
          } as any}
        />
      </Popup>
    </Marker>
  );
}
