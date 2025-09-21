import type { PropertyKind, ListingType } from "./filters";

export type Listing = {
  id: string;
  title: string;
  price: number;      // EUR per month or sale price
  lat: number;
  lng: number;
  county: string;
  kind?: PropertyKind;
  beds: number;
  baths?: number;
  type: ListingType;
  url: string;        // primary source link
  address?: string;
  images?: string[];
  createdAt: string;  // ISO
  eircode?: string; // populated by API from Firestore key

  /** Optional array of sources (Daft, MyHome, Agent website, etc.) */
  sources?: Array<{
    name: string;
    url: string;
  }>;
};
