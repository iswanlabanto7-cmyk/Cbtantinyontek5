import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import firebaseConfig from "./firebase-applet-config.json";

// Konfigurasi Firebase
export { firebaseConfig };

// Inisialisasi Firebase App
export const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore Database
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Inisialisasi Firebase Authentication
export const auth = getAuth(app);

// Inisialisasi Firebase Cloud Storage
export const storage = getStorage(app);

export default app;
