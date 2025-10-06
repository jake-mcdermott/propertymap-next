// src/lib/manifestCache.ts
"use client";
import { get, set } from "idb-keyval";
import { fetchManifestClient, type ManifestInfo } from "@/lib/fetchManifestClient";

type Cached<T> = { ts: number; data: T };
const KEY = "pm:manifest:v1";

// module-scope memory cache
let mem: Cached<ManifestInfo> | null = null;

/** Read manifest from memory → IDB (no network). Returns null if not present. */
export async function readManifestCache(): Promise<ManifestInfo | null> {
  if (mem) return mem.data;
  const idb = (await get<Cached<ManifestInfo>>(KEY)) || null;
  if (idb) {
    mem = idb;
    return idb.data;
  }
  return null;
}

/** Write manifest to both memory and IDB. */
export async function writeManifestCache(data: ManifestInfo): Promise<void> {
  mem = { ts: Date.now(), data };
  await set(KEY, mem);
}

/**
 * Cached fetch: fast return from mem/IDB; optionally refresh in background.
 * @param refresh If true, also kick off a background refresh.
 */
export async function fetchManifestCached(refresh = true): Promise<ManifestInfo | null> {
  const cached = await readManifestCache();
  if (refresh) {
    // fire-and-forget background refresh; don’t block UI
    (async () => {
      try {
        const fresh = await fetchManifestClient();
        if (fresh) await writeManifestCache(fresh);
      } catch {}
    })();
  }
  // Prefer cached if available; if not, fetch once and persist
  if (cached) return cached;
  const fresh = await fetchManifestClient();
  if (fresh) await writeManifestCache(fresh);
  return fresh;
}
