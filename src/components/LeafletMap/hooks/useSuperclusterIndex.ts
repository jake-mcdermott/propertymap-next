import { useEffect, useMemo, useRef, useState } from "react";
import Supercluster, { type ClusterFeature } from "supercluster";
import type { PtProps, ClProps } from "../types";

type PointFeature<P = Record<string, unknown>> = GeoJSON.Feature<GeoJSON.Point, P>;

export default function useSuperclusterIndex({
  points,
  bbox,
  zoom,
}: {
  points: PointFeature<PtProps>[];
  bbox: [number, number, number, number];
  zoom: number;
}) {
  const indexRef = useRef<Supercluster<PtProps, ClProps> | null>(null);
  const [indexReady, setIndexReady] = useState(false);
  const [indexVersion, setIndexVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIndexReady(false);
    const raf = requestAnimationFrame(() => {
      if (cancelled) return;
      const idx = new Supercluster<PtProps, ClProps>({ radius: 100, maxZoom: 20, minZoom: 0, minPoints: 2 });
      idx.load(points);
      if (cancelled) return;
      indexRef.current = idx;
      setIndexVersion((v) => v + 1);
      setIndexReady(true);
    });
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [points]);

  const rawClusters = useMemo(() => {
    const idx = indexRef.current;
    if (!idx || !indexReady) return [] as Array<PointFeature<PtProps> | ClusterFeature<ClProps>>;
    return idx.getClusters(bbox, Math.round(zoom)) as Array<PointFeature<PtProps> | ClusterFeature<ClProps>>;
  }, [bbox, zoom, indexReady, indexVersion]);

  return { indexRef, indexReady, indexVersion, rawClusters };
}
