// src/server/firebaseAdmin.ts
import { getApps, initializeApp, cert, applicationDefault, App } from "firebase-admin/app";
import {
  getFirestore,
  FieldValue,
  FieldPath,
  Timestamp,
  Settings,
  Firestore,
} from "firebase-admin/firestore";

let app: App | undefined;
let db: Firestore | undefined;

function initApp() {
  if (getApps().length) return getApps()[0];

  // A) Full JSON blob in env
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (saJson) {
    const creds = JSON.parse(saJson);
    return initializeApp({ credential: cert(creds), projectId: creds.project_id });
  }

  // B) Individual fields
  const projectIdEnv = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;
  if (projectIdEnv && clientEmail && privateKeyRaw) {
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    return initializeApp({
      credential: cert({ projectId: projectIdEnv, clientEmail, privateKey }),
      projectId: projectIdEnv,
    });
  }

  // C) Application Default Credentials + explicit projectId (works on Firebase/Cloud Run too)
  const fallbackProjectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GCLOUD_PROJECT ||
    process.env.GOOGLE_CLOUD_PROJECT;

  if (!fallbackProjectId) {
    throw new Error(
      "No projectId available. Set FIREBASE_PROJECT_ID (or GCLOUD_PROJECT / GOOGLE_CLOUD_PROJECT), " +
        "or provide service account credentials via FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: fallbackProjectId,
  });
}

export function getDb() {
  if (!app) app = initApp();
  if (!db) {
    db = getFirestore(app);
    db.settings({ ignoreUndefinedProperties: true } as Settings);
  }
  return db;
}

export { FieldValue, FieldPath, Timestamp };
