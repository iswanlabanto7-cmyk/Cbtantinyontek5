import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  updateDoc
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import defaultFirebaseConfig from "../firebase-applet-config.json";

// Support both environment variables (standard for Vercel) and local firebase-applet-config.json
export const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || defaultFirebaseConfig.firestoreDatabaseId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId || "",
  oAuthClientId: import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID || defaultFirebaseConfig.oAuthClientId || "",
  recaptchaSiteKey: import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY || defaultFirebaseConfig.recaptchaSiteKey || ""
};

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with firestoreDatabaseId (CRITICAL per guidelines)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Authentication
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Storage
export const storage = getStorage(app);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const rawMsg = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMsg,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(rawMsg);
}

// Validate Connection to Firestore
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.warn("Koneksi Firestore offline atau belum terhubung. Periksa konfigurasi Firebase.");
    }
  }
}

// Auth Helpers
export async function loginWithGoogle() {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    console.error("Gagal login dengan Google Popup:", error);
    if (error.code === 'auth/popup-blocked') {
      throw new Error("Popup browser diblokir. Silakan gunakan 'Masuk Cepat Guru/Admin' atau izinkan popup.");
    }
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error("Domain belum terdaftar di Firebase Authorized Domains. Silakan gunakan 'Masuk Cepat Guru/Admin'.");
    }
    throw error;
  }
}

export async function loginWithEmail(email: string, pass: string) {
  try {
    return await signInWithEmailAndPassword(auth, email, pass);
  } catch (error: any) {
    console.error("Gagal login email:", error);
    throw error;
  }
}

export async function registerWithEmail(email: string, pass: string, displayName?: string) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (displayName && cred.user) {
      await updateProfile(cred.user, { displayName });
    }
    return cred;
  } catch (error: any) {
    console.error("Gagal daftar akun:", error);
    throw error;
  }
}

// 1-Click Fast Login for Guru / Admin in preview environment
export const DEFAULT_GURU_EMAIL = "guru.iswan@examcbt.id";
export const DEFAULT_GURU_PASS = "GuruHebat2026!";

export async function loginAsDefaultAdmin(): Promise<User> {
  try {
    const cred = await signInWithEmailAndPassword(auth, DEFAULT_GURU_EMAIL, DEFAULT_GURU_PASS);
    return cred.user;
  } catch (err: any) {
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      try {
        const newCred = await createUserWithEmailAndPassword(auth, DEFAULT_GURU_EMAIL, DEFAULT_GURU_PASS);
        await updateProfile(newCred.user, { displayName: "Iswan Labanto (Guru)" });
        return newCred.user;
      } catch (createErr: any) {
        if (createErr.code === "auth/email-already-in-use") {
          const fallbackCred = await signInWithEmailAndPassword(auth, DEFAULT_GURU_EMAIL, DEFAULT_GURU_PASS);
          return fallbackCred.user;
        }
        throw createErr;
      }
    }
    throw err;
  }
}

export async function logoutUser() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Gagal logout:", error);
    throw error;
  }
}

