// src/lib/listingsCache.ts
"use client";
import { get, set, del } from "idb-keyval";

type CachedPayload<T> = { version: string; data: T };
const IDB_KEY = "pm:listings:v1";

// module-scope memory cache
let mem: CachedPayload<any> | null = null;

export async function readCache<T = any>(version: string): Promise<T | null> {
  // memory first
  if (mem?.version === version) return mem.data as T;

  // idb fallback
  const idb = (await get<IDB_KEY_TYPE>(IDB_KEY)) as CachedPayload<T> | undefined;
  if (idb && idb.version === version) {
    mem = idb; // hydrate memory
    return idb.data;
  }
  return null;
}

export async function writeCache<T = any>(version: string, data: T): Promise<void> {
  mem = { version, data };
  await set(IDB_KEY, mem);
}

export async function bustCache(): Promise<void> {
  mem = null;
  await del(IDB_KEY);
}
type IDB_KEY_TYPE = CachedPayload<any>;
