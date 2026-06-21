import { describe, it, expect } from "vitest";
import { buildSnapshot, diffSessions } from "./sessionDiff.js";

const S = (id, extra = {}) => ({ id, date: "2026-06-01", workout: "Push", ...extra });

describe("diffSessions — escritura incremental a la subcolección", () => {
  it("alta: una sesión nueva va en sets", () => {
    const prev = buildSnapshot([S("a")]);
    const { sets, deletes } = diffSessions(prev, [S("a"), S("b")]);
    expect(sets.map(s => s.id)).toEqual(["b"]);
    expect(deletes).toEqual([]);
  });

  it("sin cambios: nada que escribir ni borrar", () => {
    const prev = buildSnapshot([S("a"), S("b")]);
    const { sets, deletes } = diffSessions(prev, [S("a"), S("b")]);
    expect(sets).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it("edición: solo la sesión modificada va en sets", () => {
    const prev = buildSnapshot([S("a"), S("b")]);
    const { sets, deletes } = diffSessions(prev, [S("a", { workout: "Pull" }), S("b")]);
    expect(sets.map(s => s.id)).toEqual(["a"]);
    expect(deletes).toEqual([]);
  });

  it("baja: una sesión eliminada va en deletes", () => {
    const prev = buildSnapshot([S("a"), S("b")]);
    const { sets, deletes } = diffSessions(prev, [S("a")]);
    expect(sets).toEqual([]);
    expect(deletes).toEqual(["b"]);
  });

  it("alta + edición + baja combinadas", () => {
    const prev = buildSnapshot([S("a"), S("b"), S("c")]);
    const next = [S("a"), S("b", { workout: "Legs" }), S("d")]; // c borrada, b editada, d nueva
    const { sets, deletes } = diffSessions(prev, next);
    expect(sets.map(s => s.id).sort()).toEqual(["b", "d"]);
    expect(deletes).toEqual(["c"]);
  });

  it("ignora sesiones sin id (no rompe)", () => {
    const prev = buildSnapshot([S("a")]);
    const { sets, deletes } = diffSessions(prev, [S("a"), { date: "2026-06-02" }, null]);
    expect(sets).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it("primer guardado sin snapshot previo escribe todo", () => {
    const { sets, deletes } = diffSessions(new Map(), [S("a"), S("b")]);
    expect(sets.map(s => s.id).sort()).toEqual(["a", "b"]);
    expect(deletes).toEqual([]);
  });
});
