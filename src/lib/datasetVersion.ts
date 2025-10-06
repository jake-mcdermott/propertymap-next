// src/lib/datasetVersion.ts
"use client";
import { fetchManifestClient } from "@/lib/fetchManifestClient";

// Create a short, stable key: "<count>:<updatedAtISO or 'na'>"
export async function computeDatasetVersion(): Promise<string> {
  try {
    const m = await fetchManifestClient();
    const iso = m?.updatedAt ? new Date(m.updatedAt).toISOString() : "na";
    // If you can cheaply include counts, even better; but just updatedAt is fine.
    return `v1:${iso}`;
  } catch {
    return "v1:na";
  }
}
