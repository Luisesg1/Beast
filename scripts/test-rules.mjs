// Pruebas de las reglas de seguridad de Firestore (firestore.rules).
// Se ejecuta contra el emulador:  npm run test:rules
//
// Verifica los escenarios críticos de Etapa 0: aislamiento de datos por dueño,
// inmutabilidad de `plan`/`isAdmin` desde el cliente, bloqueo de ai_usage y el
// flujo coach↔atleta. No pretende cobertura total — cubre lo que romper sería
// catastrófico.

import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { setDoc, getDoc, doc, setLogLevel } from "firebase/firestore";

setLogLevel("error"); // silenciar ruido del SDK

const COACH = "coach1";
const ATHLETE = "ath1";
const OTHER = "other1";

let testEnv;
let passed = 0;
let failed = 0;

async function check(name, promise) {
  try {
    await promise;
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`  ✗ ${name}\n      ${e.message}`);
    failed++;
  }
}

// Helper: contexto Firestore para un uid (o sin autenticar).
function db(uid) {
  return uid
    ? testEnv.authenticatedContext(uid).firestore()
    : testEnv.unauthenticatedContext().firestore();
}

async function main() {
  testEnv = await initializeTestEnvironment({
    projectId: "gymtracker-rules-test",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });

  // Sembrar datos con reglas desactivadas.
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore();
    await setDoc(doc(d, "users", ATHLETE), { uid: ATHLETE, plan: "free", name: "Ath" });
    await setDoc(doc(d, "users", COACH), { uid: COACH, plan: "coach", isCoach: true });
    await setDoc(doc(d, "users", OTHER), { uid: OTHER, plan: "free" });
    // Vínculo coach↔atleta
    await setDoc(doc(d, "athlete_coaches", ATHLETE, "coaches", COACH), { coachUid: COACH });
    // Una sesión del atleta
    await setDoc(doc(d, "sessions", ATHLETE), { list: [], _archiveChunks: 0 });
    // Contador IA
    await setDoc(doc(d, "ai_usage", ATHLETE), { count: 3, date: "2026-06-21" });
  });

  console.log("\nPLAN / PRIVILEGIOS");
  await check("dueño lee su propio perfil",
    assertSucceeds(getDoc(doc(db(ATHLETE), "users", ATHLETE))));
  await check("usuario NO puede subir su plan a 'pro'",
    assertFails(setDoc(doc(db(ATHLETE), "users", ATHLETE), { uid: ATHLETE, plan: "pro" }, { merge: true })));
  await check("usuario NO puede ponerse isAdmin",
    assertFails(setDoc(doc(db(ATHLETE), "users", ATHLETE), { uid: ATHLETE, isAdmin: true }, { merge: true })));
  await check("usuario SÍ puede editar su nombre (sin tocar plan)",
    assertSucceeds(setDoc(doc(db(ATHLETE), "users", ATHLETE), { uid: ATHLETE, plan: "free", name: "Nuevo" }, { merge: true })));
  await check("usuario nuevo crea perfil con plan free",
    assertSucceeds(setDoc(doc(db("nuevo"), "users", "nuevo"), { uid: "nuevo", plan: "free", name: "N" })));
  await check("usuario nuevo NO puede crear perfil con plan pro",
    assertFails(setDoc(doc(db("nuevo2"), "users", "nuevo2"), { uid: "nuevo2", plan: "pro" })));

  console.log("\nSESIONES (aislamiento por dueño)");
  await check("dueño lee sus sesiones",
    assertSucceeds(getDoc(doc(db(ATHLETE), "sessions", ATHLETE))));
  await check("dueño escribe sus sesiones",
    assertSucceeds(setDoc(doc(db(ATHLETE), "sessions", ATHLETE), { list: [], _archiveChunks: 0 })));
  await check("dueño escribe su chunk de archivo",
    assertSucceeds(setDoc(doc(db(ATHLETE), "sessions", ATHLETE, "archive", "chunk_0"), { list: [] })));
  await check("extraño NO lee sesiones ajenas",
    assertFails(getDoc(doc(db(OTHER), "sessions", ATHLETE))));
  await check("extraño NO escribe sesiones ajenas",
    assertFails(setDoc(doc(db(OTHER), "sessions", ATHLETE), { list: [] })));
  await check("coach vinculado SÍ lee sesiones del atleta",
    assertSucceeds(getDoc(doc(db(COACH), "sessions", ATHLETE))));
  await check("coach NO escribe sesiones del atleta",
    assertFails(setDoc(doc(db(COACH), "sessions", ATHLETE), { list: [] })));

  console.log("\nSESIONES — subcolección nueva users/{uid}/sessions (Etapa 4-A)");
  await check("dueño escribe una sesión en la subcolección",
    assertSucceeds(setDoc(doc(db(ATHLETE), "users", ATHLETE, "sessions", "s1"), { id: "s1", workout: "Push" })));
  await check("dueño lee su subcolección de sesiones",
    assertSucceeds(getDoc(doc(db(ATHLETE), "users", ATHLETE, "sessions", "s1"))));
  await check("coach vinculado lee las sesiones del atleta",
    assertSucceeds(getDoc(doc(db(COACH), "users", ATHLETE, "sessions", "s1"))));
  await check("extraño NO lee sesiones ajenas (subcolección)",
    assertFails(getDoc(doc(db(OTHER), "users", ATHLETE, "sessions", "s1"))));
  await check("extraño NO escribe sesiones ajenas (subcolección)",
    assertFails(setDoc(doc(db(OTHER), "users", ATHLETE, "sessions", "s2"), { id: "s2" })));
  await check("coach NO escribe sesiones del atleta (subcolección)",
    assertFails(setDoc(doc(db(COACH), "users", ATHLETE, "sessions", "s3"), { id: "s3" })));

  console.log("\nAI_USAGE (anti-bypass de límite)");
  await check("dueño lee su contador IA",
    assertSucceeds(getDoc(doc(db(ATHLETE), "ai_usage", ATHLETE))));
  await check("cliente NO puede escribir ai_usage (resetear límite)",
    assertFails(setDoc(doc(db(ATHLETE), "ai_usage", ATHLETE), { count: 0 })));

  console.log("\nDATOS PERSONALES");
  await check("dueño escribe su body_stats",
    assertSucceeds(setDoc(doc(db(ATHLETE), "body_stats", ATHLETE), { height: 180 })));
  await check("coach vinculado lee body_stats del atleta",
    assertSucceeds(getDoc(doc(db(COACH), "body_stats", ATHLETE))));
  await check("extraño NO lee body_stats ajeno",
    assertFails(getDoc(doc(db(OTHER), "body_stats", ATHLETE))));

  console.log("\nFLUJO COACH ↔ ATLETA");
  await check("coach asigna rutina a su atleta",
    assertSucceeds(setDoc(doc(db(COACH), "athlete_routines", ATHLETE, "routines", "r1"), { coachUid: COACH, completed: false })));
  await check("atleta marca rutina completada",
    assertSucceeds(setDoc(doc(db(ATHLETE), "athlete_routines", ATHLETE, "routines", "r1"), { completed: true }, { merge: true })));
  await check("extraño NO asigna rutinas al atleta",
    assertFails(setDoc(doc(db(OTHER), "athlete_routines", ATHLETE, "routines", "r2"), { coachUid: OTHER })));
  await check("coach escribe su propia rutina",
    assertSucceeds(setDoc(doc(db(COACH), "coaches", COACH, "routines", "rt1"), { name: "Push" })));
  await check("atleta vinculado lee la rutina del coach",
    assertSucceeds(getDoc(doc(db(ATHLETE), "coaches", COACH, "routines", "rt1"))));
  await check("extraño NO escribe rutinas del coach",
    assertFails(setDoc(doc(db(OTHER), "coaches", COACH, "routines", "rt2"), { name: "x" })));

  console.log("\nDENEGACIÓN POR DEFECTO");
  await check("colección no declarada queda bloqueada",
    assertFails(setDoc(doc(db(ATHLETE), "coleccion_random", "x"), { a: 1 })));

  await testEnv.cleanup();

  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron.`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Error fatal en el test:", e);
  process.exit(1);
});
