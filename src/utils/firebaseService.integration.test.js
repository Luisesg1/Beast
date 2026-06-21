import { describe, it, expect, beforeAll } from "vitest";
import { signInAnonymously, signOut } from "firebase/auth";
import { getDocs, getDoc, setDoc, doc, collection } from "firebase/firestore";
import { auth, db } from "../firebase";
import { saveSessions, loadSessions, backfillLegacySessions } from "./firebaseService";

// Integración real contra los emuladores: ejercita la escritura/lectura dual de
// sesiones (documento legacy + subcolección users/{uid}/sessions) con Auth y las
// reglas de seguridad activas. Requiere: npm run test:integration.

let uid;

async function subIds() {
  const snap = await getDocs(collection(db, "users", uid, "sessions"));
  return snap.docs.map(d => d.id).sort();
}
async function legacyList() {
  const snap = await getDoc(doc(db, "sessions", uid));
  return snap.exists() ? (snap.data().list || []) : [];
}

const mk = (id, extra = {}) => ({ id, date: "2026-06-01", workout: "Push", exercises: [], ...extra });

beforeAll(async () => {
  const cred = await signInAnonymously(auth);
  uid = cred.user.uid;
});

describe("saveSessions / loadSessions — escritura y lectura dual (emulador)", () => {
  it("guarda en AMBOS modelos y recupera la sesión", async () => {
    await saveSessions(uid, [mk("a")]);

    expect(await subIds()).toEqual(["a"]);             // subcolección poblada
    expect((await legacyList()).map(s => s.id)).toEqual(["a"]); // legacy poblado
    expect((await loadSessions(uid)).map(s => s.id)).toEqual(["a"]);
  });

  it("añade una segunda sesión sin perder la primera", async () => {
    await saveSessions(uid, [mk("a"), mk("b")]);
    expect(await subIds()).toEqual(["a", "b"]);
    const loaded = await loadSessions(uid);
    expect(loaded.map(s => s.id).sort()).toEqual(["a", "b"]);
  });

  it("edita una sesión y el cambio se refleja en la subcolección", async () => {
    await saveSessions(uid, [mk("a", { workout: "Pull" }), mk("b")]);
    const aDoc = await getDoc(doc(db, "users", uid, "sessions", "a"));
    expect(aDoc.data().workout).toBe("Pull");
  });

  it("borra una sesión y desaparece de la subcolección y de la carga", async () => {
    await saveSessions(uid, [mk("b")]); // se quita "a"
    expect(await subIds()).toEqual(["b"]);
    expect((await loadSessions(uid)).map(s => s.id)).toEqual(["b"]);
  });

  it("no duplica al combinar legacy + subcolección", async () => {
    await saveSessions(uid, [mk("b"), mk("c")]);
    const ids = (await loadSessions(uid)).map(s => s.id).sort();
    expect(ids).toEqual(["b", "c"]); // sin repetidos aunque estén en ambos modelos
  });
});

describe("backfill — usuario existente con historial solo en legacy", () => {
  let legacyUid;

  beforeAll(async () => {
    // signInAnonymously reutiliza el usuario anónimo actual; cerramos sesión para
    // obtener un uid nuevo y limpio (sin subcolección de los tests anteriores).
    await signOut(auth);
    const cred = await signInAnonymously(auth);
    legacyUid = cred.user.uid;
    // Simular un usuario previo a la migración: historial SOLO en el documento legacy.
    await setDoc(doc(db, "sessions", legacyUid), {
      list: [mk("h1"), mk("h2"), mk("h3")],
      _archiveChunks: 0,
    });
  });

  it("backfillLegacySessions copia el historial faltante a la subcolección", async () => {
    const before = await getDocs(collection(db, "users", legacyUid, "sessions"));
    expect(before.size).toBe(0); // sub vacía al inicio

    const { migrated } = await backfillLegacySessions(legacyUid);
    expect(migrated).toBe(3);

    const after = await getDocs(collection(db, "users", legacyUid, "sessions"));
    expect(after.docs.map(d => d.id).sort()).toEqual(["h1", "h2", "h3"]);
  });

  it("es idempotente: un segundo backfill no copia nada", async () => {
    const { migrated } = await backfillLegacySessions(legacyUid);
    expect(migrated).toBe(0);
  });
});
