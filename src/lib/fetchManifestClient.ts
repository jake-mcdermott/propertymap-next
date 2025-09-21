// src/lib/fetchManifestClient.ts
"use client";

import { db } from "@/lib/firebaseClient";
import { doc, getDoc, Timestamp } from "firebase/firestore";

export type ManifestInfo = {
  updatedAt: Date | null;
  total: number | null;
  shards: number | null;
};

// Robust converter that handles Firestore Timestamp, {seconds,nanoseconds}, and epoch millis
function toDateFlexible(v: unknown): Date | null {
  if (v instanceof Timestamp) return v.toDate();

  if (typeof v === "number" && Number.isFinite(v)) {
    // Accept both seconds and ms heuristically (>= 10^12 looks like ms)
    return new Date(v < 1e12 ? v * 1000 : v);
  }

  if (v && typeof v === "object") {
    const o = v as { toDate?: () => Date; seconds?: number; nanoseconds?: number };
    if (typeof o.toDate === "function") {
      try {
        const d = o.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d;
      } catch {}
    }
    if (typeof o.seconds === "number") {
      const ms = o.seconds * 1000 + ((o.nanoseconds ?? 0) / 1e6);
      return new Date(ms);
    }
  }

  return null;
}

export async function fetchManifestClient(): Promise<ManifestInfo | null> {
  try {
    const snap = await getDoc(doc(db, "map-listings", "_manifest"));
    if (!snap.exists()) return null;

    const data = snap.data() as Record<string, unknown>;

    const updatedAt = toDateFlexible(data?.updatedAt);
    const total =
      typeof data?.total === "number" && Number.isFinite(data.total) ? data.total : null;
    const shards =
      typeof data?.shards === "number" && Number.isFinite(data.shards) ? data.shards : null;

    return { updatedAt, total, shards };
  } catch {
    return null;
  }
}
