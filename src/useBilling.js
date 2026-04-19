// useBilling.js — Hook para manejar compras con RevenueCat
// Uso: const { purchasePro, restorePurchases, loading } = useBilling();
//
// RevenueCat es la fuente de verdad del plan.
// Firestore se sincroniza SOLO desde la Cloud Function syncPlanFromRC.
// El cliente nunca escribe plan/isCoach directamente.

import { useState, useCallback } from "react";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { getFunctions, httpsCallable } from "firebase/functions";
import { App as CapApp } from "@capacitor/app";

const RC_API_KEY_ANDROID = import.meta.env.VITE_RC_API_KEY_ANDROID;
const RC_API_KEY_IOS     = import.meta.env.VITE_RC_API_KEY_IOS;

function getRcApiKey() {
  const platform = Capacitor.getPlatform();
  if (platform === "ios") return RC_API_KEY_IOS;
  return RC_API_KEY_ANDROID;
}


async function syncPlanViaFunction(updateUser) {
  try {
    const functions = getFunctions();
    const syncPlan  = httpsCallable(functions, "syncPlanFromRC");
    const result    = await syncPlan();           // la CF valida con RC server-side
    const { plan, isCoach } = result.data;
    const resolvedIsCoach = isCoach ?? ["coach", "gym"].includes(plan);
    console.log("[RC syncPlan] plan desde servidor:", plan, "isCoach:", resolvedIsCoach);
    updateUser({ plan, isCoach: resolvedIsCoach });
    localStorage.removeItem("gym_pending_plan");
    return { plan, isCoach: resolvedIsCoach };
  } catch (e) {
    console.error("[RC syncPlan] Cloud Function error:", e);
    throw e;
  }
}

// Fallback offline: igual que antes, pero SOLO guarda localmente.
// syncPendingPlan() llamará a la CF cuando haya conexión.
function savePlanLocally(uid, updateUser) {
  // No sabemos el plan exacto sin consultar RC — solo marcamos que hay algo pendiente.
  // Al reconectar, syncPendingPlan() consulta RC correctamente.
  console.warn("[RC] Sin conexión — plan pendiente marcado, se sincronizará al arrancar.");
  localStorage.setItem("gym_pending_plan", JSON.stringify({ uid, pendingSync: true }));
}

// ── configureRevenueCat ───────────────────────────────────────────────────────

export async function configureRevenueCat(uid, updateUser) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await Purchases.setLogLevel({ level: import.meta.env.DEV ? LOG_LEVEL.DEBUG : LOG_LEVEL.ERROR });
    await Purchases.configure({ apiKey: getRcApiKey() });
    if (uid) await Purchases.logIn({ appUserID: uid });

    // Listener en tiempo real — RC detecta cambios de entitlement.
    // En lugar de escribir Firestore directo, llama a la Cloud Function.
    if (updateUser) {
      Purchases.addCustomerInfoUpdateListener(async () => {
        console.log("[RevenueCat] customerInfo actualizado — sincronizando via CF...");
        try {
          await syncPlanViaFunction(updateUser);
        } catch (e) {
          console.error("[RC listener] error en syncPlanViaFunction:", e);
        }
      });
    }
  } catch (e) {
    console.error("[RevenueCat] configure error:", e);
  }
}

// ── syncPendingPlan ───────────────────────────────────────────────────────────
// Llama esto en onAuthStateChanged para sincronizar planes pendientes.

export async function syncPendingPlan(updateUser) {
  const raw = localStorage.getItem("gym_pending_plan");
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.pendingSync && !parsed?.uid) return;
    console.log("[RC syncPendingPlan] sincronizando plan pendiente...");
    await syncPlanViaFunction(updateUser);
  } catch (e) {
    console.error("[RevenueCat] syncPendingPlan error:", e);
  }
}

// ── getPackage (sin cambios) ──────────────────────────────────────────────────

function getPackage(offerings, packageType) {
  const current       = offerings?.current;
  const coachOffering = offerings?.all?.["coach"];
  if (!current) return null;
  switch (packageType) {
    case "monthly":
      return current.monthly
          ?? current.availablePackages?.find(p => p.identifier === "$rc_monthly")
          ?? current.availablePackages?.find(p => p.identifier === "monthly")
          ?? null;
    case "yearly":
      return current.annual
          ?? current.availablePackages?.find(p => p.identifier === "$rc_annual")
          ?? current.availablePackages?.find(p => p.identifier === "yearly")
          ?? null;
    case "coach_monthly":
      return coachOffering?.monthly
          ?? coachOffering?.availablePackages?.find(p => p.identifier === "$rc_monthly")
          ?? coachOffering?.availablePackages?.find(p => p.identifier === "coach_monthly")
          ?? null;
    case "coach_yearly":
      return coachOffering?.annual
          ?? coachOffering?.availablePackages?.find(p => p.identifier === "$rc_annual")
          ?? coachOffering?.availablePackages?.find(p => p.identifier === "coach_yearly")
          ?? null;
    default:
      return current.monthly ?? null;
  }
}

// ── useBilling hook ───────────────────────────────────────────────────────────

export function useBilling() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const purchasePro = useCallback(async (uid, updateUser, packageType = "monthly") => {
    if (!Capacitor.isNativePlatform()) {
      alert("Las compras solo están disponibles en la app de Android.");
      return { ok: false };
    }
    setLoading(true);
    setError(null);
    try {
      const offerings = await Purchases.getOfferings();
      if (!offerings?.current) throw new Error("No hay ofertas disponibles");
      const pkg = getPackage(offerings, packageType);
      if (!pkg) {
        const available = offerings.current?.availablePackages?.map(p => p.identifier).join(", ") || "ninguno";
        throw new Error(`Paquete "${packageType}" no encontrado. Disponibles: ${available}`);
      }

      // Lanzar la compra — RC la procesa
      await Purchases.purchasePackage({ aPackage: pkg });

      // Google Play puede tardar segundos en confirmar a RC.
      // Reintentamos hasta 8 veces con 4s de espera entre cada intento (max ~28s).
      let plan = "free";
      for (let attempt = 0; attempt < 8; attempt++) {
        if (attempt > 0) await new Promise(r => setTimeout(r, 4000));
        try {
          const result = await syncPlanViaFunction(updateUser);
          plan = result.plan;
          if (plan !== "free") break;
          console.log(`[RC purchase] intento ${attempt + 1}/4 - plan aun free, reintentando...`);
        } catch (e) {
          console.warn(`[RC purchase] intento ${attempt + 1}/4 fallo:`, e.message);
        }
      }

      if (plan !== "free") {
        return { ok: true, plan };
      } else {
        // La compra fue procesada por Google Play, pero RC aún no confirmó.
        // Devolvemos ok:true con plan "pending" para no bloquear al usuario.
        console.warn("[RC purchase] Compra registrada en Google Play pero RC aún no confirmó. Plan quedará en 'pending'.");
        return { ok: true, plan: "pending", msg: "Compra registrada. El plan se activará en 1-2 minutos automáticamente." };
      }
    } catch (e) {
      if (e?.code === "1") return { ok: false, cancelled: true };
      console.error("[RevenueCat] purchase error:", e);
      setError(e.message || "Error al procesar el pago");
      return { ok: false, error: e.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const restorePurchases = useCallback(async (uid, updateUser) => {
    if (!Capacitor.isNativePlatform()) return { ok: false };
    setLoading(true);
    setError(null);
    try {
      await Purchases.restorePurchases();
      const { plan } = await syncPlanViaFunction(updateUser);
      return { ok: true, plan };
    } catch (e) {
      console.error("[RevenueCat] restore error:", e);
      setError(e.message || "Error al restaurar compras");
      return { ok: false };
    } finally {
      setLoading(false);
    }
  }, []);

  const checkProStatus = useCallback(async (uid, updateUser) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await syncPlanViaFunction(updateUser);
    } catch (e) {
      console.error("[RevenueCat] checkStatus error:", e);
    }
  }, []);

  return { purchasePro, restorePurchases, checkProStatus, loading, error };
}

// ── checkProStatusStandalone ──────────────────────────────────────────────────
// Llamado en onAuthStateChanged.

export async function checkProStatusStandalone(uid, updateUser) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    console.log("[RC checkProStatusStandalone] iniciando para uid:", uid);
    await syncPlanViaFunction(updateUser);
  } catch (e) {
    console.error("[RevenueCat] checkStatus error:", e);
  }
}

// ── registerAppResumeListener (sin cambios funcionales) ──────────────────────

export function registerAppResumeListener(uid, updateUser) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let lastCheck = 0;
  const THROTTLE_MS = 10_000;

  const handle = CapApp.addListener("appStateChange", async ({ isActive }) => {
    if (!isActive) return;
    const now = Date.now();
    if (now - lastCheck < THROTTLE_MS) return;
    lastCheck = now;
    console.log("[RevenueCat] App resumed — sincronizando plan via CF...");
    await checkProStatusStandalone(uid, updateUser);
  });

  return () => handle.then(h => h.remove()).catch(() => {});
}