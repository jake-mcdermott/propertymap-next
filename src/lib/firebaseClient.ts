// src/lib/firebaseClient.ts
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  // getFirestore, // <- not used; we use initializeFirestore with options
  connectFirestoreEmulator,
  setLogLevel,
  type Firestore,
} from "firebase/firestore";
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

// Optional behavior via env (all optional)
const FORCE_LONG_POLL = process.env.NEXT_PUBLIC_FB_FORCE_LONG_POLL === "1";
const AUTO_DETECT_LONG_POLL =
  process.env.NEXT_PUBLIC_FB_AUTO_DETECT_LONG_POLL !== "0"; // default: true
const DISABLE_FETCH_STREAMS =
  process.env.NEXT_PUBLIC_FB_DISABLE_FETCH_STREAMS !== "0"; // default: true
const LOG_LEVEL = (process.env.NEXT_PUBLIC_FB_LOG_LEVEL || "error") as
  | "debug"
  | "error"
  | "silent";

const USE_EMULATOR = process.env.NEXT_PUBLIC_FB_EMULATOR === "1";
const EMU_HOST = process.env.NEXT_PUBLIC_FB_EMULATOR_HOST || "127.0.0.1";
const EMU_PORT = Number(process.env.NEXT_PUBLIC_FB_EMULATOR_PORT || "8080");

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

// Single app instance
export const app: FirebaseApp = getApps()[0] ?? initializeApp(cfg);

// --- Firestore (with stable transports) ---------------------------------
// These options reduce flaky Listen/channel errors on some networks/ad-blockers.
const fsOptions = {
  experimentalAutoDetectLongPolling: AUTO_DETECT_LONG_POLL, // usually true
  experimentalForceLongPolling: FORCE_LONG_POLL,           // opt-in via env
  useFetchStreams: !DISABLE_FETCH_STREAMS ? true : false,  // default false
};

export const db: Firestore = initializeFirestore(app, fsOptions);
dlog("firebase", "Firestore initialized", fsOptions);

// Optional: connect emulator (dev only)
if (typeof window !== "undefined" && USE_EMULATOR) {
  try {
    connectFirestoreEmulator(db, EMU_HOST, EMU_PORT);
    dlog("firebase", `Firestore emulator connected at http://${EMU_HOST}:${EMU_PORT}`);
  } catch (e) {
    dlog("firebase", "Firestore emulator connect failed", e);
  }
}

// Tone down SDK noise (still shows real errors)
try {
  setLogLevel(LOG_LEVEL);
  dlog("firebase", "Firestore log level", LOG_LEVEL);
} catch { /* noop */ }

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
