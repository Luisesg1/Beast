import { describe, it, expect } from "vitest";
import {
  calc1RM,
  calcSessionVolume,
  detectNewPRs,
  getPRs,
  getStreak,
} from "./gymCalcs.js";
// Copia duplicada usada por InsightsModal/AdminExercisesModal/StreakModal.
// Debe quedar sincronizada hasta unificar en Etapa 4.
import {
  getPRs as getPRsDup,
  calcSessionVolume as calcVolDup,
  getStreak as getStreakDup,
} from "../components/utils.js";

describe("calc1RM (Epley)", () => {
  it("1 rep devuelve el peso exacto", () => expect(calc1RM(100, 1)).toBe(100));
  it("5 reps con 100kg ≈ 117", () => expect(calc1RM(100, 5)).toBe(117));
  it("peso o reps inválidos devuelven 0", () => {
    expect(calc1RM(0, 5)).toBe(0);
    expect(calc1RM(100, 0)).toBe(0);
  });
});

describe("detectNewPRs", () => {
  it("usa el mejor 1RM por serie, no peso×reps cruzados", () => {
    // 100kg×5 (1RM≈117) vs 60kg×12 (1RM≈84). El cruce daría 100×12 (≈140) — incorrecto.
    const session = { exercises: [{ name: "Press", sets: [
      { weight: 100, reps: 5, done: true },
      { weight: 60, reps: 12, done: true },
    ] }] };
    const prs = detectNewPRs(session, []);
    expect(prs).toHaveLength(1);
    expect(prs[0].rm).toBe(117);
    expect(prs[0].weight).toBe(100);
    expect(prs[0].reps).toBe(5);
  });

  it("no reporta PR si no supera el récord previo", () => {
    const prev = [{ exercises: [{ name: "Press", sets: [{ weight: 120, reps: 3 }] }] }]; // ≈132
    const session = { exercises: [{ name: "Press", sets: [{ weight: 100, reps: 5, done: true }] }] }; // ≈117
    expect(detectNewPRs(session, prev)).toHaveLength(0);
  });
});

describe("getPRs", () => {
  const sessions = [{ date: "2026-06-01", exercises: [{ name: "Sentadilla", sets: [
    { weight: 140, reps: 4 }, // ≈159
    { weight: 100, reps: 10 }, // ≈133
  ] }] }];
  it("toma el mejor 1RM real entre series", () => {
    expect(getPRs(sessions)["Sentadilla"].rm).toBe(159);
  });
  it("la copia duplicada se comporta igual", () => {
    expect(getPRsDup(sessions)["Sentadilla"].rm).toBe(159);
  });
});

describe("calcSessionVolume", () => {
  const session = { exercises: [{ name: "x", sets: [
    { weight: 100, reps: 5 }, // 500
    { weight: 50, reps: "" },  // 0, no 50
  ] }] };
  it("una serie sin reps aporta 0 volumen", () => {
    expect(calcSessionVolume(session)).toBe(500);
  });
  it("la copia duplicada se comporta igual", () => {
    expect(calcVolDup(session)).toBe(500);
  });
});

describe("getStreak (robustez de fechas)", () => {
  const dirty = [{ date: "no-es-fecha" }, { date: "" }, { date: null }];
  it("ignora fechas inválidas sin lanzar", () => {
    expect(() => getStreak(dirty, 3)).not.toThrow();
  });
  it("la copia duplicada tampoco lanza", () => {
    expect(() => getStreakDup(dirty, 3)).not.toThrow();
  });
});
