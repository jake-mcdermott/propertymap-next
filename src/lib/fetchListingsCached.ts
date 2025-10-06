// src/lib/fetchListingsCached.ts
"use client";

import type { Listing } from "@/lib/types";
import { computeDatasetVersion } from "./datasetVersion";
import { readCache, writeCache } from "./listingsCache";
import { fetchAllListingsRaw } from "./fetchListingsClient";

export type FetchListingsResult = { listings: Listing[]; fromCache: boolean; version: string };

export async function fetchListingsCached(): Promise<FetchListingsResult> {
  const version = await computeDatasetVersion();

  const cached = await readCache<Listing[]>(version);
  if (cached) return { listings: cached, fromCache: true, version };

  const fresh = await fetchAllListingsRaw();
  await writeCache(version, fresh);
  return { listings: fresh, fromCache: false, version };
}
