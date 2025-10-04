export type SourceLink = { name: string; url: string };

export type PtProps = {
  /** Always present */
  listingId: string;
  lat: number;
  lng: number;

  /** Optional (hydrate on demand for popups/cards) */
  price?: number | null;
  title?: string | null;
  beds?: number | null;
  baths?: number | null;
  county?: string | null;
  address?: string | null;
  url?: string | null;
  eircode?: string | null;
  town?: string | null;
  sizeSqm?: number | null;

  img?: string | null;
  sources?: SourceLink[];

  /** Supercluster sets this on non-cluster features as false (declare to avoid casts) */
  cluster?: false;
};

export type ClProps = {
  /** Markers returned by Supercluster when a point is a cluster */
  cluster: true;

  /** Standard Supercluster fields */
  point_count: number;
  point_count_abbreviated?: number;

  /** Some libs/types use cluster_id; Supercluster also exposes feature.id — keep both optional */
  cluster_id?: number;
  id?: number | string;
};
