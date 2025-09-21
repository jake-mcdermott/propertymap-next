// src/lib/firebaseClient.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { dlog } from "./debug";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FB_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FB_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FB_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FB_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FB_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FB_APP_ID!,
  // measurementId is optional
  measurementId: process.env.NEXT_PUBLIC_FB_MEASUREMENT_ID,
};

function assertConfig(obj: Record<string, string | undefined>) {
  const missing = Object.entries(obj)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(
      `[firebaseClient] Missing env: ${missing.join(
        ", "
      )}. Did you create .env.local and restart the dev server?`
    );
  }
}
assertConfig(cfg);

// Helpful warning if bucket looks wrong
if (cfg.storageBucket?.endsWith(".firebasestorage.app")) {
  dlog(
    "firebase",
    "⚠️ storageBucket ends with .firebasestorage.app — Firestore/Storage typically use *.appspot.com. You set:",
    cfg.storageBucket
  );
}

dlog("firebase", "Initializing app", {
  projectId: cfg.projectId,
  authDomain: cfg.authDomain,
  storageBucket: cfg.storageBucket,
});

export const app: FirebaseApp = getApps()[0] ?? initializeApp(cfg);
export const db: Firestore = getFirestore(app);

// Optional: lazily init Analytics in the browser if provided
if (typeof window !== "undefined" && cfg.measurementId) {
  import("firebase/analytics")
    .then(({ getAnalytics }) => {
      try {
        getAnalytics(app);
        dlog("firebase", "Analytics initialized");
      } catch (e) {
        dlog("firebase", "Analytics init failed", e);
      }
    })
    .catch((e) => dlog("firebase", "Analytics import failed", e));
}
