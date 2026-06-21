// ─── analytics.js ─────────────────────────────────────────────────────────────
// Capa fina sobre Firebase Analytics con degradación elegante: si no hay
// measurementId configurado (VITE_FIREBASE_MEASUREMENT_ID) o el entorno no lo
// soporta, todas las funciones son no-op silenciosos. Así el código queda
// instrumentado y se activa solo con añadir esa variable de entorno.
//
// Para activarlo: habilita Google Analytics en la consola de Firebase y copia
// el measurementId (G-XXXXXXXXXX) a .env como VITE_FIREBASE_MEASUREMENT_ID.

import { getAnalytics, logEvent, setUserId, setUserProperties, isSupported } from "firebase/analytics";
import { firebaseApp } from "../firebase";

let analytics = null;
let ready = false;

export async function initAnalytics() {
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
  if (!measurementId) {
    if (import.meta.env.DEV) {
      console.info("[analytics] desactivado: define VITE_FIREBASE_MEASUREMENT_ID para activarlo.");
    }
    setupGlobalErrorTracking(); // los errores se registran en consola aunque Analytics esté off
    return;
  }
  try {
    if (await isSupported()) {
      analytics = getAnalytics(firebaseApp);
      ready = true;
    }
  } catch (e) {
    console.warn("[analytics] no disponible:", e?.message);
  }
  setupGlobalErrorTracking();
}

// Registra un evento. Nunca lanza: la telemetría jamás debe romper la app.
export function track(event, params = {}) {
  try {
    if (ready && analytics) logEvent(analytics, event, params);
  } catch (_) { /* no-op */ }
}

// Asocia el usuario actual y su plan a la sesión de Analytics.
export function setAnalyticsUser(uid, plan) {
  try {
    if (!ready || !analytics) return;
    if (uid) setUserId(analytics, uid);
    if (plan) setUserProperties(analytics, { plan });
  } catch (_) { /* no-op */ }
}

// Reporta un error como evento `app_error` (truncado para no exceder límites).
export function trackError(error, where = "unknown") {
  const message = String(error?.message || error || "").slice(0, 120);
  console.error(`[error:${where}]`, error);
  track("app_error", { message, where });
}

let globalHandlersInstalled = false;
function setupGlobalErrorTracking() {
  if (globalHandlersInstalled || typeof window === "undefined") return;
  globalHandlersInstalled = true;
  window.addEventListener("error", (e) => {
    trackError(e?.error || e?.message, "window.onerror");
  });
  window.addEventListener("unhandledrejection", (e) => {
    trackError(e?.reason, "unhandledrejection");
  });
}
