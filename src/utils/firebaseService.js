import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, getDocsFromServer, deleteDoc, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { todayStr } from "./helpers";

// ── Coach / Athlete ───────────────────────────────────────────────────────────

// joinCoachByCode — el código se valida server-side en la Cloud Function.
// El cliente ya NO escribe directamente a coaches/{uid}.athletes.
export async function joinCoachByCode(athleteUid, athleteName, athleteEmail, code) {
  try {
    const functions = getFunctions();
    const joinCoach = httpsCallable(functions, "joinCoach");
    const result = await joinCoach({ code, athleteName, athleteEmail });
    // La CF devuelve { ok, coachData, msg }
    return result.data;
  } catch(e) {
    const msg = e?.code === "functions/not-found"
      ? "Código de coach no encontrado"
      : e?.message || "Error al conectar con coach";
    return { ok: false, msg };
  }
}

export async function getMyCoaches(athleteUid) {
  try {
    const snap = await getDocsFromServer(collection(db, "athlete_coaches", athleteUid, "coaches"));
    return snap.docs.map(d => d.data());
  } catch(e) { return []; }
}

export async function getFullRoutine(coachUid, routineId) {
  try {
    if (!coachUid || !routineId) return null;
    const snap = await getDoc(doc(db, "coaches", coachUid, "routines", routineId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), coachUid, routineId };
  } catch(e) {
    console.error("[getFullRoutine] ERROR:", e.code, e.message, { coachUid, routineId });
    return null;
  }
}

export async function unassignRoutineFromAthlete(athleteUid, routineId) {
  if (!athleteUid || !routineId) return { ok: false };
  try {
    await deleteDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId));
    return { ok: true };
  } catch(e) { return { ok: false }; }
}

export async function markRoutineCompleted(athleteUid, routineId) {
  if (!athleteUid || !routineId) return false;
  try {
    await setDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId),
      { completed: true, completedAt: todayStr() }, { merge: true });
    return true;
  } catch(e) { return false; }
}

// ── Body Stats / Medidas ──────────────────────────────────────────────────────

export async function saveBodyStatsToDB(uid, stats) {
  try {
    await setDoc(doc(db, "body_stats", uid), stats);
    return true;
  } catch(e) { return false; }
}

export async function saveMeasuresToDB(uid, entries) {
  try {
    await setDoc(doc(db, "measures", uid), { entries, updatedAt: serverTimestamp() });
    return true;
  } catch(e) { return false; }
}

export async function loadMeasuresFromDB(uid) {
  try {
    const snap = await getDoc(doc(db, "measures", uid));
    return snap.exists() ? (snap.data().entries || []) : null;
  } catch(e) { return null; }
}

// ── Ejercicios Personalizados ─────────────────────────────────────────────────
// Ahora son privados por coach: coaches/{coachUid}/custom_exercises/{id}

export async function saveCustomExercise(name, muscle, coachUid, createdByUid) {
  try {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    // Si tiene coachUid lo guarda en su subcolección privada,
    // si no lo guarda en la colección global para que el admin lo vea.
    const ref = coachUid
      ? doc(db, "coaches", coachUid, "custom_exercises", id)
      : doc(db, "custom_exercises", id);
    await setDoc(ref, {
      name, muscle, equipment: "Personalizado", machine: false,
      gifUrl: "", createdAt: new Date().toISOString().slice(0,10),
      ...(createdByUid ? { createdByUid } : {}),
    }, { merge: true });
  } catch(e) {
    console.error("[saveCustomExercise] ERROR:", e.code, e.message);
  }
}

export async function loadCustomExercises(coachUid, createdByUid) {
  const results = [];

  // Carga la colección global completa — el campo createdByUid no está garantizado
  // en documentos anteriores, así que no filtramos hasta migrar los datos existentes.
  // createdByUid se acepta en la firma para compatibilidad futura.
  try {
    const globalSnap = await getDocsFromServer(collection(db, "custom_exercises"));
    globalSnap.docs.forEach(d => {
      try { results.push({ id: d.id, _coachUid: null, ...d.data() }); } catch(_) {}
    });
  } catch(_) { /* sin permisos o vacía — ignorar */ }

  // Si hay coachUid, también carga los del coach (sin cambios)
  if (coachUid) {
    try {
      const coachSnap = await getDocsFromServer(
        collection(db, "coaches", coachUid, "custom_exercises")
      );
      coachSnap.docs.forEach(d => {
        try { results.push({ id: d.id, _coachUid: coachUid, ...d.data() }); } catch(_) {}
      });
    } catch(_) { /* ignorar */ }
  }

  return results;
}

export async function updateCustomExerciseGif(coachUid, id, gifUrl) {
  try {
    const ref = coachUid
      ? doc(db, "coaches", coachUid, "custom_exercises", id)
      : doc(db, "custom_exercises", id);
    await setDoc(ref, { gifUrl }, { merge: true });
    return true;
  } catch(e) {
    console.error("[updateCustomExerciseGif] ERROR:", e);
    return false;
  }
}

export async function updateCustomExerciseMeta(coachUid, id, name, muscle) {
  try {
    const ref = coachUid
      ? doc(db, "coaches", coachUid, "custom_exercises", id)
      : doc(db, "custom_exercises", id);
    await setDoc(ref, { name, muscle }, { merge: true });
    return true;
  } catch(e) { return false; }
}

export async function deleteCustomExercise(coachUid, id) {
  try {
    const ref = coachUid
      ? doc(db, "coaches", coachUid, "custom_exercises", id)
      : doc(db, "custom_exercises", id);
    await deleteDoc(ref);
    return true;
  } catch(e) { return false; }
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function teamsGet(code) {
  try {
    const snap = await getDoc(doc(db, "teams", code));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.error("teamsGet:", e); return null; }
}

export async function teamsSet(code, val) {
  try {
    await setDoc(doc(db, "teams", code), val);
    return true;
  } catch(e) { console.error("teamsSet:", e); return false; }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function loadSessions(uid) {
  try {
    const snap = await getDoc(doc(db, "sessions", uid));
    return snap.exists() ? (snap.data().list || []) : [];
  } catch(e) { return []; }
}

const SESSION_DOC_WARN_BYTES = 700_000;  // avisar al 70% del límite
const SESSION_DOC_MAX_BYTES  = 950_000;  // no guardar si supera esto (límite Firestore = 1MB)

export async function saveSessions(uid, sessions) {
  try {
    const payloadSize = JSON.stringify({ list: sessions }).length;

    if (payloadSize > SESSION_DOC_MAX_BYTES) {
      // Guardar solo las sesiones más recientes que quepan.
      // Las antiguas ya están en Firestore del guardado anterior — no se pierden hasta
      // que el usuario tenga conexión y se pueda migrar la arquitectura.
      const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
      let trimmed = sorted;
      while (
        JSON.stringify({ list: trimmed }).length > SESSION_DOC_MAX_BYTES &&
        trimmed.length > 1
      ) {
        trimmed = trimmed.slice(0, Math.floor(trimmed.length * 0.9));
      }
      console.warn(
        `[saveSessions] Documento demasiado grande (${payloadSize} bytes). ` +
        `Guardando ${trimmed.length}/${sessions.length} sesiones más recientes.`
      );
      await setDoc(doc(db, "sessions", uid), {
        list: trimmed,
        updatedAt: serverTimestamp(),
        _truncated: true,
      });
      return "truncated";
    }

    if (payloadSize > SESSION_DOC_WARN_BYTES) {
      console.warn(
        `[saveSessions] Documento cerca del límite: ` +
        `${Math.round(payloadSize / 1000)}KB de ~1000KB máx.`
      );
    }

    await setDoc(doc(db, "sessions", uid), {
      list: sessions,
      updatedAt: serverTimestamp(),
    });
    return true;
  } catch(e) {
    console.error("[saveSessions] Error:", e);
    return false;
  }
}