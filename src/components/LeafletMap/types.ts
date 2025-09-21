export type SourceLink = { name: string; url: string };

export type PtProps = {
  listingId: string;
  price: number;
  lat: number;
  lng: number;

  title: string | null;
  beds: number | null;
  baths: number | null;
  county: string | null;
  address: string | null;
  url: string | null;
  eircode: string | null;

  img: string | null;
  sources: { name: string; url: string }[];
};

export type ClProps = {
  cluster: true;
  cluster_id: number;
  point_count: number;
  point_count_abbreviated: number;
};
