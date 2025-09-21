// src/lib/fetchListingsClient.ts
import { db } from "./firebaseClient";
import {
  collection,
  getDocs,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import type { Listing } from "@/lib/types";
import { dgroup, dlog } from "./debug";

const looksLikeListing = (v: unknown): v is Listing =>
  !!v &&
  typeof v === "object" &&
  typeof (v as any).lat === "number" &&
  typeof (v as any).lng === "number";

export async function fetchListingsClient(): Promise<Listing[]> {
  const g = dgroup("firestore", "getDocs(map-listings)");
  const t0 = performance.now();

  try {
    const snap = await getDocs(collection(db, "map-listings"));
    const docIds: string[] = [];
    const out: Listing[] = [];

    snap.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
      docIds.push(doc.id);
      if (doc.id === "_manifest") return;

      const data = doc.data() as unknown;

      // { items: [...] } shard shape
      if (
        data &&
        typeof data === "object" &&
        Array.isArray((data as Record<string, unknown>).items)
      ) {
        const items = (data as Record<string, unknown>).items as unknown[];
        for (const it of items) {
          if (looksLikeListing(it)) out.push(it);
        }
        return;
      }

      // Safety: raw array doc
      if (Array.isArray(data)) {
        for (const it of data) if (looksLikeListing(it)) out.push(it);
        return;
      }

      // Not a recognized shape — log the first couple of keys to help debug
      const keys = data && typeof data === "object" ? Object.keys(data as object) : [];
      dlog("firestore", `Doc ${doc.id} has unexpected shape`, keys.slice(0, 6));
    });

    const t1 = performance.now();
    dlog("firestore", "Snapshot", {
      docs: snap.size,
      docIds: docIds.slice(0, 20), // cap to avoid spam
      ms: Math.round(t1 - t0),
    });

    // de-dupe by id
    const seen = new Set<string>();
    const deduped = out.filter((l) =>
      l?.id && !seen.has(l.id) ? (seen.add(l.id), true) : false
    );

    dlog("firestore", "Listings parsed", {
      totalRaw: out.length,
      deduped: deduped.length,
    });

    g.end();
    return deduped;
  } catch (err: unknown) {
    g.end();
    // Provide helpful hints for common issues
    const hint =
      (typeof err === "object" && err && "code" in err && (err as any).code === "permission-denied")
        ? "Check Firestore Rules. You may need public read on /map-listings."
        : undefined;
    dlog("firestore", "❌ getDocs failed", { err, hint });
    throw err;
  }
}
