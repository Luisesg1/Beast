import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, getDocsFromServer, deleteDoc, writeBatch, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { todayStr } from "./helpers";
import { trackError } from "./analytics";
import { hashSession, buildSnapshot, diffSessions } from "./sessionDiff";

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
  } catch(e) { trackError(e, "getMyCoaches"); return []; }
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
  } catch(e) { trackError(e, "unassignRoutineFromAthlete"); return { ok: false }; }
}

export async function markRoutineCompleted(athleteUid, routineId) {
  if (!athleteUid || !routineId) return false;
  try {
    await setDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId),
      { completed: true, completedAt: todayStr() }, { merge: true });
    return true;
  } catch(e) { trackError(e, "markRoutineCompleted"); return false; }
}

// ── Body Stats / Medidas ──────────────────────────────────────────────────────

export async function saveBodyStatsToDB(uid, stats) {
  try {
    await setDoc(doc(db, "body_stats", uid), stats);
    return true;
  } catch(e) { trackError(e, "saveBodyStatsToDB"); return false; }
}

export async function saveMeasuresToDB(uid, entries) {
  try {
    await setDoc(doc(db, "measures", uid), { entries, updatedAt: serverTimestamp() });
    return true;
  } catch(e) { trackError(e, "saveMeasuresToDB"); return false; }
}

export async function loadMeasuresFromDB(uid) {
  try {
    const snap = await getDoc(doc(db, "measures", uid));
    return snap.exists() ? (snap.data().entries || []) : null;
  } catch(e) { trackError(e, "loadMeasuresFromDB"); return null; }
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
    trackError(e, "saveCustomExercise");
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
    trackError(e, "updateCustomExerciseGif");
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
  } catch(e) { trackError(e, "updateCustomExerciseMeta"); return false; }
}

export async function deleteCustomExercise(coachUid, id) {
  try {
    const ref = coachUid
      ? doc(db, "coaches", coachUid, "custom_exercises", id)
      : doc(db, "custom_exercises", id);
    await deleteDoc(ref);
    return true;
  } catch(e) { trackError(e, "deleteCustomExercise"); return false; }
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export async function teamsGet(code) {
  try {
    const snap = await getDoc(doc(db, "teams", code));
    return snap.exists() ? snap.data() : null;
  } catch(e) { trackError(e, "teamsGet"); return null; }
}

export async function teamsSet(code, val) {
  try {
    await setDoc(doc(db, "teams", code), val);
    return true;
  } catch(e) { trackError(e, "teamsSet"); return false; }
}

// ── Sessions ──────────────────────────────────────────────────────────────────
//
// Arquitectura de guardado tolerante al límite de 1MB de Firestore SIN pérdida de
// datos. El documento principal `sessions/{uid}` guarda las sesiones más recientes
// que quepan; el excedente (las más antiguas) se reparte en chunks dentro de la
// subcolección `sessions/{uid}/archive/{chunk_n}`. Al cargar, se combinan ambos.
//
// Esto es un PUENTE hacia la migración definitiva a `users/{uid}/sessions/{id}`
// (Etapa 4). A diferencia de la versión anterior, NUNCA sobrescribe destructivamente:
// el archivo se escribe ANTES que el principal, así un fallo intermedio jamás borra
// sesiones antiguas.

const SESSION_DOC_WARN_BYTES = 700_000;  // avisar al 70% del límite
const SESSION_DOC_MAX_BYTES  = 950_000;  // límite efectivo por documento (1MB real)

// Orden recientes→antiguas, tolerante a sesiones sin `date`.
function byDateDesc(a, b) {
  const da = (a && a.date) || "";
  const dbd = (b && b.date) || "";
  return dbd.localeCompare(da);
}

// Agrupa items en chunks cuyo JSON {list:[...]} no supere maxBytes.
// Una sola sesión que por sí sola exceda el límite igual va en su propio chunk
// (no se puede partir más sin romper la arquitectura de Etapa 4).
function chunkByBytes(items, maxBytes) {
  const chunks = [];
  let current = [];
  for (const it of items) {
    current.push(it);
    if (JSON.stringify({ list: current }).length > maxBytes && current.length > 1) {
      current.pop();
      chunks.push(current);
      current = [it];
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

// Sincroniza la subcolección de archivo con los chunks dados: escribe/actualiza los
// nuevos y borra los chunks sobrantes de un guardado anterior. Atómico (writeBatch).
// Si `chunks` está vacío, deja la subcolección vacía.
async function syncArchive(uid, chunks) {
  const archiveCol = collection(db, "sessions", uid, "archive");
  const existing = await getDocs(archiveCol);
  const batch = writeBatch(db);

  chunks.forEach((c, i) => {
    batch.set(doc(archiveCol, `chunk_${i}`), { list: c, updatedAt: serverTimestamp() });
  });

  existing.forEach(d => {
    const idx = parseInt(String(d.id).replace("chunk_", ""), 10);
    if (Number.isNaN(idx) || idx >= chunks.length) batch.delete(d.ref);
  });

  await batch.commit();
}

// ── Migración a subcolección users/{uid}/sessions/{id} (Etapa 4-A, fase Expand) ──
//
// Escritura DUAL: el documento legacy `sessions/{uid}` se sigue escribiendo como
// red de seguridad (fuente de verdad durante la transición); además, cada sesión
// se replica de forma incremental en `users/{uid}/sessions/{id}`. La lectura
// combina ambos modelos deduplicando por id. Tras el backfill y la validación, la
// fase Contract dejará de escribir/leer el legacy.

// Snapshot en memoria por uid (id → hash) para escribir solo las sesiones que
// cambiaron, sin reescribir toda la subcolección en cada guardado.
// La lógica de diff vive en sessionDiff.js (pura y testeada).
const sessionSnapshots = new Map();

// Escribe en la subcolección solo los cambios respecto al último snapshot conocido.
// Lotes de 450 (límite de 500 por batch en Firestore).
async function syncSessionsSubcollection(uid, sessions) {
  const col = collection(db, "users", uid, "sessions");

  let prev = sessionSnapshots.get(uid);
  if (!prev) {
    // Sin snapshot (primer guardado tras recargar): leer lo que ya existe.
    prev = new Map();
    const snap = await getDocs(col);
    snap.forEach(d => prev.set(d.id, hashSession({ id: d.id, ...d.data() })));
  }

  const { sets, deletes } = diffSessions(prev, sessions);
  const ops = [
    ...sets.map(s => ({ type: "set", id: String(s.id), data: s })),
    ...deletes.map(id => ({ type: "delete", id })),
  ];

  for (let i = 0; i < ops.length; i += 450) {
    const batch = writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      const ref = doc(col, op.id);
      if (op.type === "set") batch.set(ref, op.data);
      else batch.delete(ref);
    }
    await batch.commit();
  }

  sessionSnapshots.set(uid, buildSnapshot(sessions));
}

// Escritura legacy (documento + archivo de overflow). Es la red de seguridad.
async function saveSessionsLegacy(uid, sorted) {
  const fullSize = JSON.stringify({ list: sorted }).length;

  if (fullSize <= SESSION_DOC_MAX_BYTES) {
    if (fullSize > SESSION_DOC_WARN_BYTES) {
      console.warn(`[saveSessions] Documento al ${Math.round(fullSize/1000)}KB de ~1000KB.`);
    }
    await setDoc(doc(db, "sessions", uid), { list: sorted, updatedAt: serverTimestamp(), _archiveChunks: 0 });
    await syncArchive(uid, []);
    return;
  }

  const main = chunkByBytes(sorted, SESSION_DOC_MAX_BYTES)[0];
  const overflow = sorted.slice(main.length);
  const archiveChunks = chunkByBytes(overflow, SESSION_DOC_MAX_BYTES);
  await syncArchive(uid, archiveChunks); // archivo primero: nunca pierde antiguas
  await setDoc(doc(db, "sessions", uid), { list: main, updatedAt: serverTimestamp(), _archiveChunks: archiveChunks.length });
}

export async function loadSessions(uid) {
  try {
    // 1) Subcolección nueva (vacía para usuarios aún no migrados).
    const subSessions = [];
    try {
      const subSnap = await getDocs(collection(db, "users", uid, "sessions"));
      subSnap.forEach(d => subSessions.push({ id: d.id, ...d.data() }));
    } catch (_) { /* sin permisos o vacía — ignorar */ }

    // 2) Documento legacy + su archivo de overflow.
    const mainSnap = await getDoc(doc(db, "sessions", uid));
    const main = mainSnap.exists() ? (mainSnap.data().list || []) : [];
    let archived = [];
    try {
      const archSnap = await getDocs(collection(db, "sessions", uid, "archive"));
      archSnap.forEach(d => { archived = archived.concat(d.data().list || []); });
    } catch (_) { /* sin archivo — ignorar */ }

    // Combinar: legacy primero, la subcolección (más reciente) sobrescribe por id.
    const byId = new Map();
    const noId = [];
    [...main, ...archived].forEach(s => {
      if (s && s.id != null) byId.set(String(s.id), s);
      else if (s) noId.push(s);
    });
    subSessions.forEach(s => { if (s && s.id != null) byId.set(String(s.id), s); });

    const combined = [...byId.values(), ...noId].sort(byDateDesc);
    sessionSnapshots.set(uid, buildSnapshot(combined)); // base para diffs de escritura
    return combined;
  } catch (e) {
    trackError(e, "loadSessions");
    return [];
  }
}

export async function saveSessions(uid, sessions) {
  const sorted = [...(sessions || [])].sort(byDateDesc);

  // 1) Legacy PRIMERO: es la fuente de verdad durante la transición. Si esto falla,
  //    el guardado falla (el usuario debe saberlo) y no se pierde nada.
  try {
    await saveSessionsLegacy(uid, sorted);
  } catch (e) {
    trackError(e, "saveSessions:legacy");
    return false;
  }

  // 2) Subcolección DESPUÉS: best-effort. Si falla, el dato ya está a salvo en
  //    legacy; se corregirá en el próximo guardado o en el backfill.
  try {
    await syncSessionsSubcollection(uid, sorted);
  } catch (e) {
    trackError(e, "saveSessions:sub");
  }

  return true;
}