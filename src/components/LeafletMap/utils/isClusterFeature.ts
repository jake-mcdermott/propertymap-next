import type { AnyProps, ClusterFeature } from "supercluster";
import type { PtProps, ClProps } from "../types";

type PointFeature<P = Record<string, unknown>> = GeoJSON.Feature<GeoJSON.Point, P>;

export default function isClusterFeature(
  f: PointFeature<PtProps> | ClusterFeature<ClProps>
): f is ClusterFeature<ClProps> {
  return ((f as any).properties as AnyProps).cluster === true;
}
