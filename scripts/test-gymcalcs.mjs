// Pruebas de gymCalcs.js — valida las correcciones de Etapa 1.
// Ejecutar: npm run test:calcs   (Node puro, sin emulador)

import assert from "node:assert/strict";
import {
  calc1RM,
  calcSessionVolume,
  detectNewPRs,
  getPRs,
  getStreak,
} from "../src/utils/gymCalcs.js";

let passed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) { console.error(`  ✗ ${name}\n      ${e.message}`); process.exitCode = 1; }
}

console.log("\ncalc1RM (Epley)");
test("1 rep = peso exacto", () => assert.equal(calc1RM(100, 1), 100));
test("5 reps con 100kg = 117", () => assert.equal(calc1RM(100, 5), 117));
test("peso o reps inválidos = 0", () => { assert.equal(calc1RM(0, 5), 0); assert.equal(calc1RM(100, 0), 0); });

console.log("\ndetectNewPRs (bug: no mezclar max-peso con max-reps de series distintas)");
test("PR usa el mejor 1RM por serie, no peso×reps cruzados", () => {
  // 100kg×5 (1RM≈117) vs 60kg×12 (1RM≈84). El cruce daría 100×12 (1RM≈140) — incorrecto.
  const session = { exercises: [{ name: "Press", sets: [
    { weight: 100, reps: 5, done: true },
    { weight: 60, reps: 12, done: true },
  ] }] };
  const prs = detectNewPRs(session, []);
  assert.equal(prs.length, 1);
  assert.equal(prs[0].rm, 117, "el 1RM no debe inflarse cruzando series");
  assert.equal(prs[0].weight, 100);
  assert.equal(prs[0].reps, 5);
});
test("no hay PR si no supera el récord previo", () => {
  const prev = [{ exercises: [{ name: "Press", sets: [{ weight: 120, reps: 3 }] }] }]; // 1RM≈132
  const session = { exercises: [{ name: "Press", sets: [{ weight: 100, reps: 5, done: true }] }] }; // 1RM≈117
  assert.equal(detectNewPRs(session, prev).length, 0);
});

console.log("\ngetPRs");
test("mejor 1RM real entre series", () => {
  const sessions = [{ date: "2026-06-01", exercises: [{ name: "Sentadilla", sets: [
    { weight: 140, reps: 4 }, // 1RM≈159
    { weight: 100, reps: 10 }, // 1RM≈133
  ] }] }];
  assert.equal(getPRs(sessions)["Sentadilla"].rm, 159);
});

console.log("\ncalcSessionVolume (bug: reps faltante no debe contar como 1)");
test("serie sin reps aporta 0 volumen", () => {
  const session = { exercises: [{ name: "x", sets: [
    { weight: 100, reps: 5 }, // 500
    { weight: 50, reps: "" },  // 0, no 50
  ] }] };
  assert.equal(calcSessionVolume(session), 500);
});

console.log("\ngetStreak (bug: fecha inválida no debe romper el cálculo)");
test("ignora fechas inválidas sin lanzar", () => {
  const sessions = [
    { date: "no-es-fecha" },
    { date: "" },
    { date: null },
  ];
  assert.doesNotThrow(() => getStreak(sessions, 3));
});

console.log(`\nTotal: ${passed} pruebas pasaron.`);
