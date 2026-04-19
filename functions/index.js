// functions/index.js
// Deploy: firebase deploy --only functions
//
// Esta función es la ÚNICA que puede escribir plan/isCoach en Firestore.
// El cliente llama a syncPlanFromRC() después de cada compra/restore.
// RevenueCat llama a revenueCatWebhook() en cancelaciones/renovaciones.
// sendPushToAthlete() envía notificaciones push al atleta vía FCM.
// askCoach() y analyzePhotos() son proxies de OpenAI con rate limiting server-side.
// joinCoach() valida el código de coach server-side y registra al atleta.

const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore }   = require("firebase-admin/firestore");
const { getMessaging }   = require("firebase-admin/messaging");
const { defineSecret }   = require("firebase-functions/params");
const crypto = require("crypto");

initializeApp();
const db = getFirestore();

const RC_SECRET     = defineSecret("REVENUECAT_SECRET_KEY");
const OPENAI_SECRET = defineSecret("OPENAI_API_KEY");

// ID de tu proyecto en RevenueCat (visible en la URL: app.revenuecat.com/projects/84ec7b14/...)
const RC_PROJECT_ID = "84ec7b14";

// Mapeo de entitlement IDs internos de RC → nombre del plan
// Obtenido de: GET /v2/projects/84ec7b14/entitlements
const ENTITLEMENT_ID_MAP = {
  "entl1ba2698490": "coach",
  "entl1d6a242a41": "pro",
};

// Jerarquía de planes: mayor índice = mayor valor
const PLAN_RANK = { free: 0, pro: 1, coach: 2, gym: 3 };

// Límites de uso de IA por plan (por día)
const AI_DAILY_LIMITS = { free: 5, pro: 30, coach: 100, gym: 200 };

// Helper compartido
const todayStr = () => new Date().toISOString().slice(0, 10);

// ── Helper: detectar plan desde active_entitlements de RC API V2 ─────────────
//
// V2 devuelve: { items: [ { entitlement_id, expires_at } ] }
// Usamos ENTITLEMENT_ID_MAP para convertir el ID interno al nombre del plan.

function detectPlanV2(entitlements) {
  const items = entitlements?.items || [];

  const isActive = (planName) => {
    const entitlementId = Object.keys(ENTITLEMENT_ID_MAP).find(
      id => ENTITLEMENT_ID_MAP[id] === planName
    );
    if (!entitlementId) return false;

    const item = items.find(e => e.entitlement_id === entitlementId);
    if (!item) return false;
    if (!item.expires_at) return true;
    return new Date(item.expires_at) > new Date();
  };

  if (isActive("gym"))   return "gym";
  if (isActive("coach")) return "coach";
  if (isActive("pro"))   return "pro";
  return "free";
}

// ── Helper: llamar a RC API V2 ────────────────────────────────────────────────

async function fetchRCSubscriber(uid, apiKey) {
  const url = `https://api.revenuecat.com/v2/projects/${RC_PROJECT_ID}/customers/${uid}/active_entitlements`;
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[RC API V2] ${res.status} para uid=${uid}:`, body);
    throw new Error(`RC API ${res.status}`);
  }

  const data = await res.json();
  return data || { items: [] };
}

// ── Helper: escribir plan en Firestore (operación privilegiada) ──────────────

async function applyPlanToFirestore(uid, plan, { allowDowngrade = true } = {}) {
  const isCoach = ["coach", "gym"].includes(plan);

  if (!allowDowngrade && plan === "free") {
    const currentSnap = await db.collection("users").doc(uid).get();
    const currentPlan = currentSnap.exists ? (currentSnap.data()?.plan || "free") : "free";
    const currentRank = PLAN_RANK[currentPlan] ?? 0;
    const newRank     = PLAN_RANK[plan] ?? 0;

    if (currentRank > newRank) {
      console.log(`[applyPlanToFirestore] ⚠️ Downgrade bloqueado: ${currentPlan} → ${plan} para uid=${uid}`);
      return { plan: currentPlan, isCoach: ["coach", "gym"].includes(currentPlan) };
    }
  }

  await db.collection("users").doc(uid).set({ plan, isCoach }, { merge: true });

  if (isCoach) {
    const coachRef  = db.collection("coaches").doc(uid);
    const coachSnap = await coachRef.get();
    const existing  = coachSnap.exists ? coachSnap.data() : {};

    const code = existing.code
      || Math.random().toString(36).slice(2, 8).toUpperCase();

    await coachRef.set({
      uid,
      athletes:  existing.athletes  || {},
      createdAt: existing.createdAt || todayStr(),
      code,
    }, { merge: true });
  }

  return { plan, isCoach };
}

// ── Helper: enviar push a un usuario por su UID ──────────────────────────────

async function sendPushToUid(uid, title, body, data = {}) {
  try {
    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return { ok: false, reason: "user_not_found" };

    const fcmToken = userSnap.data()?.fcmToken;
    if (!fcmToken) return { ok: false, reason: "no_fcm_token" };

    await getMessaging().send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: "high",
        notification: {
          channelId: "beast_default",
          sound: "default",
          icon: "ic_notification",
          color: "#e8ff00",
        },
      },
    });

    return { ok: true };
  } catch (e) {
    console.error("[sendPushToUid] ERROR:", e.code, e.message);
    if (e.code === "messaging/registration-token-not-registered") {
      await db.collection("users").doc(uid).set({ fcmToken: null }, { merge: true });
    }
    return { ok: false, reason: e.code };
  }
}

// ── Helper: rate limiting de IA (contador diario en Firestore) ───────────────
//
// Colección: ai_usage/{uid}
// Campos:    count (number), date (string YYYY-MM-DD)
// Solo el Admin SDK puede escribir en esta colección (reglas de Firestore).

async function checkAndIncrementAiUsage(uid, plan) {
  const today = todayStr();
  const limit = AI_DAILY_LIMITS[plan] ?? AI_DAILY_LIMITS.free;
  const ref   = db.collection("ai_usage").doc(uid);

  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const data = snap.exists ? snap.data() : {};

    // Si el doc es de otro día, reiniciar contador
    const count = (data.date === today) ? (data.count || 0) : 0;

    if (count >= limit) {
      return { allowed: false, count, limit };
    }

    t.set(ref, { count: count + 1, date: today, plan }, { merge: false });
    return { allowed: true, count: count + 1, limit };
  });

  return result;
}

// ── Helper: llamar a OpenAI chat completions ─────────────────────────────────

async function callOpenAI(apiKey, messages, { model = "gpt-4o-mini", maxTokens = 500 } = {}) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("[callOpenAI] Error:", res.status, err);
    throw new Error(`OpenAI API ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ── sendPushToAthlete ─────────────────────────────────────────────────────────

exports.sendPushToAthlete = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const { athleteUid, type, routineName, message, coachName } = request.data || {};

  if (!athleteUid || !type) {
    throw new HttpsError("invalid-argument", "Faltan parámetros requeridos.");
  }

  const coachSnap = await db.collection("coaches").doc(request.auth.uid).get();
  if (!coachSnap.exists) {
    throw new HttpsError("permission-denied", "No eres coach.");
  }
  const coachData = coachSnap.data();
  if (!coachData?.athletes?.[athleteUid]) {
    throw new HttpsError("permission-denied", "Este atleta no es tuyo.");
  }

  let title, body, data;

  if (type === "routine_assigned") {
    title = "💪 Nueva rutina asignada";
    body  = routineName
      ? `${coachName || "Tu coach"} te asignó: ${routineName}`
      : `${coachName || "Tu coach"} te asignó una nueva rutina`;
    data  = { type, routineName: routineName || "" };

  } else if (type === "coach_feedback") {
    title = "💬 Feedback de tu coach";
    body  = message || `${coachName || "Tu coach"} dejó un comentario en tu sesión`;
    data  = { type, message: message || "" };

  } else {
    throw new HttpsError("invalid-argument", `Tipo desconocido: ${type}`);
  }

  const result = await sendPushToUid(athleteUid, title, body, data);
  console.log(`[sendPushToAthlete] type=${type} athleteUid=${athleteUid} result=`, result);
  return result;
});

// ── saveFcmToken ──────────────────────────────────────────────────────────────

exports.saveFcmToken = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const { token } = request.data || {};
  if (!token || typeof token !== "string") {
    throw new HttpsError("invalid-argument", "Token inválido.");
  }

  await db.collection("users").doc(request.auth.uid).set(
    { fcmToken: token, fcmUpdatedAt: new Date().toISOString() },
    { merge: true }
  );

  console.log(`[saveFcmToken] uid=${request.auth.uid} token guardado`);
  return { ok: true };
});

// ── syncPlanFromRC ────────────────────────────────────────────────────────────

exports.syncPlanFromRC = onCall(
  { secrets: [RC_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = request.auth.uid;

    let entitlements;
    try {
      entitlements = await fetchRCSubscriber(uid, RC_SECRET.value());
    } catch (e) {
      console.error("[syncPlanFromRC] Error al consultar RC:", e.message);
      throw new HttpsError("internal", "Error al verificar suscripción.");
    }

    const plan = detectPlanV2(entitlements);
    console.log(`[syncPlanFromRC] uid=${uid} plan=${plan}`);

    const result = await applyPlanToFirestore(uid, plan, { allowDowngrade: false });
    return result;
  }
);

// ── revenueCatWebhook ─────────────────────────────────────────────────────────

exports.revenueCatWebhook = onRequest(
  { secrets: [RC_SECRET] },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    const event = req.body;
    if (!event?.event?.app_user_id) {
      res.status(400).send("Bad Request");
      return;
    }

    const uid       = event.event.app_user_id;
    const eventType = event.event.type;

    console.log(`[rcWebhook] event=${eventType} uid=${uid}`);

    const relevantEvents = [
      "INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE",
      "CANCELLATION", "EXPIRATION", "BILLING_ISSUE",
      "SUBSCRIBER_ALIAS", "TRANSFER",
      "NON_RENEWING_PURCHASE",
    ];

    if (!relevantEvents.includes(eventType)) {
      res.status(200).send("Ignored");
      return;
    }

    try {
      const entitlements = await fetchRCSubscriber(uid, RC_SECRET.value());
      const plan         = detectPlanV2(entitlements);

      await applyPlanToFirestore(uid, plan, { allowDowngrade: true });
      console.log(`[rcWebhook] ✅ uid=${uid} → plan=${plan}`);
      res.status(200).send("OK");
    } catch (e) {
      console.error("[rcWebhook] error:", e);
      res.status(500).send("Internal Error");
    }
  }
);

// ── askCoach ──────────────────────────────────────────────────────────────────
//
// Proxy seguro de OpenAI para el chat de IA del coach.
// La API key nunca llega al cliente — se lee desde Firebase Secrets.
// Rate limit: contador diario por usuario en Firestore (colección ai_usage).
//
// Llamar desde el cliente:
//   const askCoach = httpsCallable(functions, "askCoach");
//   const result = await askCoach({ messages: [...], systemPrompt: "..." });
//   // result.data.reply  → respuesta del asistente

exports.askCoach = onCall(
  { secrets: [OPENAI_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = request.auth.uid;
    const { messages, systemPrompt } = request.data || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpsError("invalid-argument", "Se requiere un array de mensajes.");
    }
    if (messages.length > 50) {
      throw new HttpsError("invalid-argument", "Demasiados mensajes en el contexto.");
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const plan = userSnap.exists ? (userSnap.data()?.plan || "free") : "free";

    const usage = await checkAndIncrementAiUsage(uid, plan);
    if (!usage.allowed) {
      console.log(`[askCoach] Rate limit alcanzado: uid=${uid} plan=${plan} count=${usage.count}/${usage.limit}`);
      throw new HttpsError(
        "resource-exhausted",
        `Límite diario de IA alcanzado (${usage.limit} mensajes/día). Mejora tu plan para más.`
      );
    }

    const systemMessage = {
      role: "system",
      content: systemPrompt ||
        "Eres un asistente de fitness experto. Ayuda al usuario con sus entrenamientos, nutrición y progreso. Sé conciso y motivador. Responde en el idioma del usuario.",
    };

    const sanitizedMessages = messages
      .filter(m => ["user", "assistant"].includes(m.role) && typeof m.content === "string")
      .map(m => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const openaiMessages = [systemMessage, ...sanitizedMessages];

    let reply;
    try {
      reply = await callOpenAI(OPENAI_SECRET.value(), openaiMessages, {
        model: "gpt-4o-mini",
        maxTokens: 600,
      });
    } catch (e) {
      console.error("[askCoach] Error OpenAI:", e.message);
      throw new HttpsError("internal", "Error al consultar el asistente de IA.");
    }

    console.log(`[askCoach] uid=${uid} plan=${plan} usage=${usage.count}/${usage.limit}`);
    return {
      reply,
      usage: { count: usage.count, limit: usage.limit },
    };
  }
);

// ── analyzePhotos ─────────────────────────────────────────────────────────────
//
// Proxy seguro de OpenAI Vision para analizar fotos de progreso.
// Acepta URLs de Firebase Storage (no base64 directamente).
// Rate limit: comparte el mismo contador ai_usage que askCoach.
//
// Llamar desde el cliente:
//   const analyzePhotos = httpsCallable(functions, "analyzePhotos");
//   const result = await analyzePhotos({ photoUrls: [...], prompt: "..." });
//   // result.data.analysis → análisis del asistente

exports.analyzePhotos = onCall(
  { secrets: [OPENAI_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
    }

    const uid = request.auth.uid;
    const { photoUrls, prompt } = request.data || {};

    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      throw new HttpsError("invalid-argument", "Se requiere al menos una URL de foto.");
    }
    if (photoUrls.length > 6) {
      throw new HttpsError("invalid-argument", "Máximo 6 fotos por análisis.");
    }

    const validUrls = photoUrls.every(url =>
      typeof url === "string" &&
      (url.startsWith("https://firebasestorage.googleapis.com/") ||
       url.startsWith("https://storage.googleapis.com/"))
    );
    if (!validUrls) {
      throw new HttpsError("invalid-argument", "Solo se permiten URLs de Firebase Storage.");
    }

    const userSnap = await db.collection("users").doc(uid).get();
    const plan = userSnap.exists ? (userSnap.data()?.plan || "free") : "free";

    if (plan === "free") {
      throw new HttpsError(
        "permission-denied",
        "El análisis de fotos requiere un plan Pro o superior."
      );
    }

    const usage = await checkAndIncrementAiUsage(uid, plan);
    if (!usage.allowed) {
      console.log(`[analyzePhotos] Rate limit: uid=${uid} plan=${plan}`);
      throw new HttpsError(
        "resource-exhausted",
        `Límite diario de IA alcanzado (${usage.limit}/día). Vuelve mañana.`
      );
    }

    const imageContents = photoUrls.map(url => ({
      type: "image_url",
      image_url: { url, detail: "low" },
    }));

    const userPrompt = prompt ||
      "Analiza estas fotos de progreso físico. Comenta los cambios visibles en composición corporal, postura y desarrollo muscular. Sé específico y motivador.";

    const messages = [
      {
        role: "system",
        content: "Eres un experto en fitness y composición corporal. Analiza fotos de progreso de forma profesional, objetiva y motivadora. Responde en el idioma del usuario.",
      },
      {
        role: "user",
        content: [
          { type: "text", text: userPrompt },
          ...imageContents,
        ],
      },
    ];

    let analysis;
    try {
      analysis = await callOpenAI(OPENAI_SECRET.value(), messages, {
        model: "gpt-4o",
        maxTokens: 800,
      });
    } catch (e) {
      console.error("[analyzePhotos] Error OpenAI Vision:", e.message);
      throw new HttpsError("internal", "Error al analizar las fotos.");
    }

    console.log(`[analyzePhotos] uid=${uid} photos=${photoUrls.length} usage=${usage.count}/${usage.limit}`);
    return {
      analysis,
      usage: { count: usage.count, limit: usage.limit },
    };
  }
);

// ── joinCoach ─────────────────────────────────────────────────────────────────
//
// Valida el código de coach server-side y registra al atleta.
// El cliente NUNCA escribe coaches/{uid}.athletes directamente.
//
// Llamar desde el cliente:
//   const joinCoach = httpsCallable(functions, "joinCoach");
//   const result = await joinCoach({ code, athleteName, athleteEmail });
//   // result.data.ok       → true si se unió correctamente
//   // result.data.coachData → { uid, name, email }

exports.joinCoach = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }

  const athleteUid   = request.auth.uid;
  const athleteName  = (request.data.athleteName  || "").trim();
  const athleteEmail = (request.data.athleteEmail || "").trim().toLowerCase();
  const code         = (request.data.code         || "").trim().toUpperCase();

  if (!code) {
    throw new HttpsError("invalid-argument", "El código de coach es requerido.");
  }

  // Buscar coach por código — solo el admin SDK puede hacer este query ahora
  const coachesSnap = await db.collection("coaches")
    .where("code", "==", code)
    .limit(1)
    .get();

  if (coachesSnap.empty) {
    throw new HttpsError("not-found", "Código de coach no encontrado.");
  }

  const coachData = coachesSnap.docs[0].data();
  const coachUid  = coachData.uid;

  // Un coach no puede unirse a su propio código
  if (athleteUid === coachUid) {
    throw new HttpsError("failed-precondition", "No puedes unirte a tu propio código.");
  }

  // Si el atleta ya está registrado, retornar ok sin re-escribir
  if (coachData.athletes?.[athleteUid]) {
    return {
      ok: true,
      coachData: { uid: coachUid, name: coachData.name || "", email: coachData.email || "" },
    };
  }

  // Escribir con admin SDK en batch atómico
  const batch = db.batch();

  batch.set(
    db.doc(`coaches/${coachUid}`),
    {
      athletes: {
        [athleteUid]: {
          email:    athleteEmail,
          name:     athleteName,
          uid:      athleteUid,
          addedAt:  todayStr(),
        },
      },
    },
    { merge: true }
  );

  batch.set(
    db.doc(`athlete_coaches/${athleteUid}/coaches/${coachUid}`),
    {
      coachUid,
      coachName:  coachData.name  || "",
      coachEmail: coachData.email || "",
      addedAt:    todayStr(),
    }
  );

  await batch.commit();

  console.log(`[joinCoach] athleteUid=${athleteUid} → coachUid=${coachUid}`);
  return {
    ok: true,
    coachData: { uid: coachUid, name: coachData.name || "", email: coachData.email || "" },
  };
});