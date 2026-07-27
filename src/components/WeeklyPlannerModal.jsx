import { useState } from "react";
import { EXERCISE_DB, MUSCLES } from "../exerciseDb";
import { DAYS_ES, PRESETS } from "../utils/constants";
import { uid } from "../utils/helpers";
import { numWeight, numReps } from "../utils/helpers";
import GIF_MAP from "../assets/gif/gifMap.js";

function ExerciseEditor({ dayKey, exercises, isWeekly, removeExFromDay, addExToDay }) {
  const [exMuscle, setExMuscle] = useState("Todos");
  const [exName, setExName] = useState("");
  const [exCustomInput, setExCustomInput] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSeriesCount, setExSeriesCount] = useState("3");
  const filteredDB = exMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === exMuscle);
  const selectedExName = exName === "__custom__" ? exCustomInput : exName;

  function handleAdd() {
    if (!selectedExName) return;
    const count = Math.max(1, parseInt(exSeriesCount) || 3);
    const sets = Array.from({ length: count }, () => ({ id: uid(), weight: exWeight, reps: exReps }));
    addExToDay(dayKey, isWeekly, exName, exCustomInput, exWeight, exReps, sets);
    setExName(""); setExCustomInput(""); setExWeight(""); setExReps(""); setExSeriesCount("3");
  }

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>Ejercicios del día</div>
      {exercises?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {exercises.map(ex => (
            <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--input-bg)", borderRadius: 8, marginBottom: 6, border: "1px solid var(--border)" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</span>
                {ex.sets?.length > 0
                  ? <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{ex.sets.length} series · {ex.sets.map((s,i)=>`${s.weight}kg×${s.reps}`).join(", ")}</span>
                  : ex.weight ? <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{ex.weight}kg × {ex.reps} reps</span> : null
                }
              </div>
              <button className="chip-del" onClick={() => removeExFromDay(dayKey, ex.id, isWeekly)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, marginBottom: 8 }}>
        {["Todos", ...MUSCLES].map(m => (
          <button key={m} className={`muscle-chip ${exMuscle===m?"active":""}`} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => { setExMuscle(m); setExName(""); }}>{m}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ flex: 2, minWidth: 140 }}>
          <select className="input" style={{ fontSize: 12, padding: "7px 10px" }} value={exName} onChange={e => setExName(e.target.value)}>
            <option value="">— Ejercicio —</option>
            {filteredDB.map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
            <option value="__custom__">✏️ Personalizado... (escribe el tuyo)</option>
          </select>
          {exName === "__custom__" && <input className="input" style={{ marginTop: 4, fontSize: 12 }} placeholder="Escribe tu ejercicio..." value={exCustomInput} onChange={e => setExCustomInput(e.target.value)} />}
        </div>
        <div style={{ flex: 1, minWidth: 70 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Peso kg" value={exWeight} onChange={e => setExWeight(numWeight(e.target.value))} inputMode="decimal" />
        </div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Reps" value={exReps} onChange={e => setExReps(numReps(e.target.value))} inputMode="decimal" />
        </div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Series" value={exSeriesCount} onChange={e => { const n = parseInt(e.target.value.replace(/[^0-9]/g, "")); setExSeriesCount(isNaN(n) ? "" : String(Math.min(n, 20))); }} inputMode="numeric" />
        </div>
      </div>
      <button className="btn-add-ex" style={{ fontSize: 12, padding: "7px" }} onClick={handleAdd}>+ Agregar ejercicio</button>
    </div>
  );
}

export default function WeeklyPlannerModal({ plan, onSave, onClose, sessions, weeklyGoal, onSaveGoal, initTab }) {
  const [mode, setMode] = useState(plan.mode || "weekly");
  const [plannerTab, setPlannerTab] = useState(initTab === "goal" ? "goal" : "plan");

  const migrateWeekly = (w) => {
    if (!w) return {};
    const out = {};
    Object.entries(w).forEach(([k, v]) => {
      if (typeof v === "string") out[k] = { name: v, exercises: [] };
      else out[k] = v;
    });
    return out;
  };
  const [weekly, setWeekly] = useState(() => migrateWeekly(plan.weekly));

  const migrateCycle = (c) => {
    if (!c?.length) return [{ id: uid(), name: "", exercises: [] }];
    return c.map(d => typeof d === "string"
      ? { id: uid(), name: d, exercises: [] }
      : { exercises: [], ...d }
    );
  };
  const [cycle, setCycle] = useState(() => migrateCycle(plan.cycle));
  const [cyclePos, setCyclePos] = useState(plan.cyclePos || 0);
  const [expandedDay, setExpandedDay] = useState(null);
  const [exCustomInput, setExCustomInput] = useState("");
  // Días marcados explícitamente como "Entrenamiento" (incluye los que aún no tienen nombre).
  const [trainingMode, setTrainingMode] = useState(() => {
    const s = new Set();
    Object.entries(migrateWeekly(plan.weekly)).forEach(([k, v]) => {
      if (v?.name && v.name !== "Descanso") s.add(`w${k}`);
    });
    return s;
  });

  // ── Estilos de tarjeta reutilizables (formulario mobile-first) ──
  const fieldLabel = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: "var(--text-muted)", padding: "0 4px 6px" };
  const cardBase = { width: "100%", boxSizing: "border-box", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", fontSize: 15, fontWeight: 600, color: "var(--text)", fontFamily: "Inter, sans-serif", outline: "none" };
  const chevron = { position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--text-muted)", fontSize: 12 };

  const workouts = ["Todas", ...new Set(
    sessions.map(s => s.workout).filter(Boolean).map(w => w.trim())
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
  )];
  const todayDow = (new Date().getDay() + 6) % 7;

  function addExToDay(dayKey, isWeekly, exNameVal, exCustomVal, exWeightVal, exRepsVal, exSetsVal) {
    const finalName = exNameVal === "__custom__" ? exCustomVal : exNameVal;
    if (!finalName) return;
    const sets = exSetsVal && exSetsVal.length > 0 ? exSetsVal : (exWeightVal || exRepsVal ? [{ id: uid(), weight: exWeightVal, reps: exRepsVal }] : []);
    const newEx = { id: uid(), name: finalName, sets, weight: exWeightVal, reps: exRepsVal };
    if (isWeekly) setWeekly(w => ({ ...w, [dayKey]: { ...w[dayKey], exercises: [...(w[dayKey]?.exercises||[]), newEx] } }));
    else setCycle(c => c.map((d, i) => i !== dayKey ? d : { ...d, exercises: [...(d.exercises||[]), newEx] }));
  }

  function removeExFromDay(dayKey, exId, isWeekly) {
    if (isWeekly) {
      setWeekly(w => ({ ...w, [dayKey]: { ...w[dayKey], exercises: (w[dayKey]?.exercises||[]).filter(e => e.id !== exId) } }));
    } else {
      setCycle(c => c.map((d, i) => i !== dayKey ? d : { ...d, exercises: d.exercises.filter(e => e.id !== exId) }));
    }
  }

  function saveCycle() { onSave({ mode, weekly, cycle, cyclePos }); onClose(); }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📅 Planificador</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tab-row" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${plannerTab === "plan" && mode === "weekly" ? "active" : ""}`} onClick={() => { setPlannerTab("plan"); setMode("weekly"); }}>7 días fijos</button>
          <button className={`tab-btn ${plannerTab === "plan" && mode === "cycle" ? "active" : ""}`} onClick={() => { setPlannerTab("plan"); setMode("cycle"); }}>Ciclo Personalizado</button>
          <button className={`tab-btn ${plannerTab === "goal" ? "active" : ""}`} onClick={() => setPlannerTab("goal")}>🎯 Meta</button>
        </div>

        {/* Meta Semanal tab */}
        {plannerTab === "goal" && (() => {
          const target = weeklyGoal?.target || 4;
const lunes = new Date(); lunes.setHours(0,0,0,0); lunes.setDate(lunes.getDate() - (lunes.getDay() === 0 ? 6 : lunes.getDay() - 1));
const thisWeek = new Set(sessions.filter(s => new Date(s.date+"T00:00:00") >= lunes).map(s => s.date)).size;
          const pct = Math.min(thisWeek / target, 1);
          const done = pct >= 1;
          return (
            <div>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontFamily:"Inter, sans-serif", fontSize:64, fontWeight:900, color: done?"#22c55e":"var(--accent)", lineHeight:1 }}>
                  {thisWeek}<span style={{ fontSize:32, color:"var(--text-muted)" }}>/{target}</span>
                </div>
                <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:14 }}>sesiones esta semana</div>
                <div style={{ background:"var(--border)", borderRadius:20, height:12, overflow:"hidden", marginBottom:10, maxWidth:300, margin:"0 auto 10px" }}>
                  <div style={{ height:"100%", background:done?"#22c55e":"var(--accent)", width:`${pct*100}%`, borderRadius:20, transition:"width 0.5s ease" }}/>
                </div>
                {done && <div style={{ color:"#22c55e", fontWeight:700, fontSize:16 }}>🎉 ¡Meta cumplida esta semana!</div>}
              </div>
              <div className="field" style={{ marginBottom:20 }}>
                <label className="field-label">Sesiones por semana (meta)</label>
                <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                  {[2,3,4,5,6,7].map(n => (
                    <button key={n} onClick={() => onSaveGoal({ target: n })}
                      style={{ width:48, height:48, borderRadius:12, border:"2px solid", borderColor:(weeklyGoal?.target||4)===n?"var(--accent)":"var(--border)", background:(weeklyGoal?.target||4)===n?"var(--accent)":"var(--input-bg)", color:(weeklyGoal?.target||4)===n?"white":"var(--text)", fontFamily:"Inter, sans-serif", fontSize:22, fontWeight:800, cursor:"pointer", transition:"all 0.2s" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding:"12px 16px", background:"var(--input-bg)", borderRadius:12, fontSize:13, color:"var(--text-muted)", textAlign:"center" }}>
                💡 La semana se cuenta desde hoy hacia los últimos 7 días
              </div>
            </div>
          );
        })()}

        {plannerTab === "plan" && mode === "weekly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {DAYS_ES.map((day, i) => {
              const dayData = weekly[i] || { name: "", exercises: [] };
              const isToday = todayDow === i;
              const isOpen = expandedDay === `w${i}`;
              const isRest = dayData.name === "Descanso";
              const isTraining = trainingMode.has(`w${i}`) || (!!dayData.name && !isRest);
              const estado = isRest ? "Descanso" : isTraining ? "Entrenamiento" : "";
              const exCount = (dayData.exercises || []).length;

              const setEstado = (v) => {
                if (v === "Descanso") {
                  setWeekly(w => ({ ...w, [i]: { ...dayData, name: "Descanso" } }));
                  setTrainingMode(s => { const n = new Set(s); n.delete(`w${i}`); return n; });
                  if (isOpen) setExpandedDay(null);
                } else if (v === "Entrenamiento") {
                  setTrainingMode(s => new Set(s).add(`w${i}`));
                  setWeekly(w => ({ ...w, [i]: { ...dayData, name: isRest ? "" : dayData.name } }));
                } else {
                  setTrainingMode(s => { const n = new Set(s); n.delete(`w${i}`); return n; });
                  setWeekly(w => ({ ...w, [i]: { ...dayData, name: "" } }));
                  if (isOpen) setExpandedDay(null);
                }
              };

              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10, paddingBottom: i < DAYS_ES.length - 1 ? 22 : 0, borderBottom: i < DAYS_ES.length - 1 ? "1px solid var(--border)" : "none" }}>
                  {/* ── Título del día (bloque simple, sin caja) ── */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 9, fontFamily: "Inter, sans-serif", fontSize: 17, fontWeight: 800, color: isToday ? "var(--accent)" : "var(--text)" }}>
                      <span style={{ fontSize: 18 }}>📅</span> {day}
                    </span>
                    {isToday && <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, color: "var(--accent)", textTransform: "uppercase" }}>Hoy 📍</span>}
                  </div>

                  {/* ── Estado ── */}
                  <div>
                    <label style={fieldLabel}>Estado</label>
                    <div style={{ position: "relative" }}>
                      <select
                        style={{ ...cardBase, appearance: "none", WebkitAppearance: "none", MozAppearance: "none", paddingRight: 44, cursor: "pointer" }}
                        value={estado}
                        onChange={e => setEstado(e.target.value)}
                      >
                        <option value="">— Elegir estado —</option>
                        <option value="Descanso">💤 Descanso</option>
                        <option value="Entrenamiento">💪 Entrenamiento</option>
                      </select>
                      <span style={chevron}>▼</span>
                    </div>
                  </div>

                  {/* ── Tarjeta: Entrenamiento (nombre) ── */}
                  {isTraining && (
                    <div>
                      <label style={fieldLabel}>Entrenamiento</label>
                      <input
                        className="input"
                        style={{ ...cardBase }}
                        placeholder="Pecho, Push Day, Piernas…"
                        value={isRest ? "" : (dayData.name || "")}
                        onChange={e => setWeekly(w => ({ ...w, [i]: { ...dayData, name: e.target.value } }))}
                      />
                    </div>
                  )}

                  {/* ── Tarjeta: Ejercicios ── */}
                  {isTraining && (
                    <div>
                      <label style={fieldLabel}>Ejercicios</label>
                      <button
                        style={{ ...cardBase, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", textAlign: "left" }}
                        onClick={() => setExpandedDay(isOpen ? null : `w${i}`)}
                      >
                        <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <span style={{ fontSize: 16 }}>💪</span>
                          {exCount > 0 ? `${exCount} ejercicio${exCount > 1 ? "s" : ""}` : "Agregar ejercicios"}
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{isOpen ? "▲" : "▼"}</span>
                      </button>
                      {isOpen && <ExerciseEditor dayKey={i} exercises={dayData.exercises || []} isWeekly={true} addExToDay={addExToDay} removeExFromDay={removeExFromDay} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {plannerTab === "plan" && mode === "cycle" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {cycle.map((d, i) => {
                const isActive = cyclePos === i;
                const isOpen = expandedDay === `c${i}`;
                return (
                  <div key={d.id} style={{ background: isActive ? "var(--accent-dim)" : "var(--input-bg)", border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px" }}>
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: isActive ? "var(--accent)" : "var(--border)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                      <input className="input" style={{ flex: 1, padding: "7px 12px", fontSize: 13 }} placeholder={`Día ${i+1} (ej: Push Day)`} value={d.name} onChange={e => setCycle(c => c.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} list={`cy-dl-${i}`} />
                      <datalist id={`cy-dl-${i}`}>{workouts.map(n => <option key={n} value={n} />)}{Object.keys(PRESETS).map(n => <option key={n} value={n} />)}</datalist>
                      <button className="btn-ghost small" style={{ whiteSpace: "nowrap", fontSize: 11 }} onClick={() => setExpandedDay(isOpen ? null : `c${i}`)}>
                        {isOpen ? "▲ Cerrar" : `💪 ${(d.exercises||[]).length > 0 ? `${(d.exercises||[]).length} ej.` : "Ejercicios"}`}
                      </button>
                      {cycle.length > 1 && <button className="chip-del" style={{ fontSize: 16 }} onClick={() => { setCycle(c => c.filter((_, j) => j !== i)); if (cyclePos >= i) setCyclePos(p => Math.max(0, p-1)); }}>✕</button>}
                    </div>
                    {isOpen && <ExerciseEditor dayKey={i} exercises={d.exercises||[]} isWeekly={false} addExToDay={addExToDay} removeExFromDay={removeExFromDay} />}
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <button className="btn-ghost small" onClick={() => setCycle(c => [...c, { id: uid(), name: "", exercises: [] }])}>+ Agregar día</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Día activo:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {cycle.map((_, i) => (
                  <button key={i} onClick={() => setCyclePos(i)} style={{ width: 28, height: 28, borderRadius: "50%", background: cyclePos === i ? "var(--accent)" : "var(--border)", border: "none", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{i+1}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: "8px 12px" }}>
              💡 Al guardar una sesión, el ciclo avanza automáticamente al siguiente día.
            </div>
          </div>
        )}

        {plannerTab === "plan" && (
          <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={saveCycle}>💾 Guardar planificador</button>
        )}
      </div>
    </div>
  );
}