// src/components/PropertyMap/helpers.ts
import type { LatLngBounds } from "leaflet";

/** [west, south, east, north] — what Supercluster expects */
export function toBbox(b: LatLngBounds): [number, number, number, number] {
  const sw = b.getSouthWest();
  const ne = b.getNorthEast();
  // round to avoid churn from float noise
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return [r(sw.lng), r(sw.lat), r(ne.lng), r(ne.lat)];
}

export function bboxEqual(
  a: [number, number, number, number],
  b: [number, number, number, number]
) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

export const isMobileScreen = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(max-width: 767px)").matches;
