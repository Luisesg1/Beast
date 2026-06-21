import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, getFirestore, persistentLocalCache, connectFirestoreEmulator } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(firebaseApp);

let db;
try {
  db = initializeFirestore(firebaseApp, { localCache: persistentLocalCache() });
} catch {
  db = getFirestore(firebaseApp);
}

const googleProvider = new GoogleAuthProvider();

// Solo para tests de integración: conecta a los emuladores locales si la variable
// está definida. En producción nunca lo está, así que este bloque jamás se ejecuta.
if (import.meta.env.VITE_FIRESTORE_EMULATOR) {
  const [host, port] = import.meta.env.VITE_FIRESTORE_EMULATOR.split(":");
  connectFirestoreEmulator(db, host, Number(port));
  try { connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true }); } catch {}
}

export { firebaseApp, auth, db, googleProvider };



