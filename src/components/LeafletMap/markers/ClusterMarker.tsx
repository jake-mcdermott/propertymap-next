"use client";

import { useMemo } from "react";
import { Marker } from "react-leaflet";
import type { Marker as LeafletMarker, DivIcon } from "leaflet";
import L from "leaflet";
import { renderToString } from "react-dom/server";
import ClusterPill from "./pills/ClusterPill";

type Props = {
  clusterId: number;
  lat: number;
  lng: number;
  count: number;
  onExpand: (clusterId: number, lat: number, lng: number) => void;
  highlighted?: boolean;
};

export default function ClusterMarker({
  clusterId,
  lat,
  lng,
  count,
  onExpand,
  highlighted,
}: Props) {
  const html = useMemo(
    () => renderToString(<ClusterPill count={count} highlighted={!!highlighted} />),
    [count, highlighted]
  );

  const icon: DivIcon = useMemo(
    () =>
      L.divIcon({
        className: "pm-cluster",
        html,
        iconSize: [0, 0],
        iconAnchor: [0, 0],  // center with CSS transform
        popupAnchor: [0, -28],
      }),
    [html]
  );

  return (
    <Marker
      position={[lat, lng]}
      icon={icon}
      eventHandlers={{ click: () => onExpand(clusterId, lat, lng) }}
      ref={(ref) => {
        const _ = ref as unknown as LeafletMarker | null;
      }}
    />
  );
}
