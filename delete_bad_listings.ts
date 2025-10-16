/**
 * Delete specific Eircodes from `listings` and `map-listings`.
 *
 * Usage:
 *   TS:  npx ts-node scripts/delete_bad_listings.ts
 *   JS:  node scripts/delete_bad_listings.js
 *
 * Auth:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
 */

import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore, QuerySnapshot } from "firebase-admin/firestore";

// If you prefer explicit service account JSON, replace applicationDefault() with:
// initializeApp({ credential: cert(require("/path/to/serviceAccount.json")) });
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const EIRCODES = ["K36Y963", "D11HT44", "D09H2X8"];
const COLLECTIONS = ["listings", "map-listings"];

async function deleteByEircodes(
  collectionName: string,
  eircodes: string[]
) {
  console.log(`\nScanning "${collectionName}" for ${eircodes.length} Eircodes...`);
  // Firestore "in" supports up to 10 values per query; we only have 3.
  const snap: QuerySnapshot = await db
    .collection(collectionName)
    .where("eircode", "in", eircodes)
    .get();

  if (snap.empty) {
    console.log(`No matches in "${collectionName}".`);
    return;
  }

  const batch = db.batch();
  snap.docs.forEach((doc) => {
    console.log(`→ Deleting ${collectionName}/${doc.id} (eircode=${doc.get("eircode")})`);
    batch.delete(doc.ref);
  });
  await batch.commit();
  console.log(`Deleted ${snap.size} document(s) from "${collectionName}".`);
}

(async () => {
  try {
    for (const col of COLLECTIONS) {
      await deleteByEircodes(col, EIRCODES);
    }
    console.log("\n✅ Done.");
    process.exit(0);
  } catch (err) {
    console.error("Failed:", err);
    process.exit(1);
  }
})();
