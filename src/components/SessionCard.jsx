import { useState, useRef, useMemo } from "react";
import { useConfirm } from "./ConfirmModal";
import { calcSessionVolume } from "../utils/gymCalcs";
import { uid, numWeight, numReps } from "../utils/helpers";
import { EXERCISE_DB } from "../exerciseDb";
import { StreakChip } from "./StreakWidgets";

// ─── Superset helpers (copiados de App.jsx) ───────────────────────────────────
const SS_COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];

function getSupersetGroups(exercises) {
  const groups = {};
  exercises.forEach((ex, i) => {
    if (ex.supersetGroup) {
      if (!groups[ex.supersetGroup]) groups[ex.supersetGroup] = [];
      groups[ex.supersetGroup].push(i);
    }
  });
  return Object.entries(groups).map(([groupId, indices]) => ({ groupId, indices }));
}

function getSupersetColor(groupId, exercises) {
  const groups = getSupersetGroups(exercises);
  const idx = groups.findIndex(g => g.groupId === groupId);
  return idx >= 0 ? SS_COLORS[idx % SS_COLORS.length] : SS_COLORS[0];
}

export default function SessionCard({ s, unit, onDelete, onEdit, onDuplicate, onProgress, onShare, getProgressData, expanded, onToggle, allSessions, onUpdate, onRenameAll, prWeightMap }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const u = unit;
  const sessionUnit = s.unit || "kg"; // sesiones viejas sin unit se asumen kg
  // Convierte el peso guardado en la sesión a la unidad global actual
  function convertWeight(w) {
    const val = parseFloat(w) || 0;
    if (!val) return w;
    if (sessionUnit === unit) return String(val); // misma unidad, no convertir
    if (sessionUnit === "kg" && unit === "lbs") return (val * 2.20462).toFixed(1);
    if (sessionUnit === "lbs" && unit === "kg") return (val / 2.20462).toFixed(1);
    return String(val);
  }
  const [editingExId, setEditingExId] = useState(null);
  const [expandedNotes, setExpandedNotes] = useState({});
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(s.workout || "");
  const [showAddEx, setShowAddEx] = useState(false);
  const [addExSearch, setAddExSearch] = useState("");
  const nameInputRef = useRef(null);

  function saveName() {
    const trimmed = nameVal.trim()
      .split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    if (trimmed && trimmed !== s.workout) onRenameAll(s.workout, trimmed);
    else setNameVal(s.workout || "");
    setEditingName(false);
  }

  const sessionVol = calcSessionVolume(s);
  const sessionVolConverted = (sessionUnit === "kg" && unit === "lbs")
    ? sessionVol * 2.20462
    : (sessionUnit === "lbs" && unit === "kg")
    ? sessionVol / 2.20462
    : sessionVol;
  const volDisplay = sessionVolConverted >= 1000
    ? `${(sessionVolConverted/1000).toFixed(1)}t`
    : sessionVolConverted > 0 ? `${Math.round(sessionVolConverted)}${unit}` : null;

  // Detect PRs in this session (O(n) usando prWeightMap precalculado en GymApp)
  const prs = useMemo(() => {
    const set = new Set();
    if (!prWeightMap) return set;
    (s.exercises || []).forEach(ex => {
      const sessWeight = ex.sets?.length > 0
        ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0))
        : parseFloat(ex.weight) || 0;
      if (sessWeight > 0 && prWeightMap[ex.name] && sessWeight >= prWeightMap[ex.name]) {
        set.add(ex.name);
      }
    });
    return set;
  }, [s, prWeightMap]);

  function updateExField(exId, field, val) {
    const updated = { ...s, exercises: s.exercises.map(e => e.id === exId ? { ...e, [field]: val } : e) };
    onUpdate(updated);
  }
  function updateSetField(exId, setId, field, val) {
    const updated = { ...s, exercises: s.exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(st => st.id === setId ? { ...st, [field]: val } : st) }) };
    onUpdate(updated);
  }
  function addSetToEx(exId) {
    const ex = s.exercises.find(e => e.id === exId);
    const lastSet = ex?.sets?.[ex.sets.length - 1];
    const newSet = { id: uid(), weight: lastSet?.weight || ex?.weight || "", reps: lastSet?.reps || ex?.reps || "" };
    const updated = { ...s, exercises: s.exercises.map(e => e.id !== exId ? e : { ...e, sets: [...(e.sets || [{ id: uid(), weight: e.weight||"", reps: e.reps||"" }]), newSet] }) };
    onUpdate(updated);
  }
  function removeSetFromEx(exId, setId) {
    const updated = { ...s, exercises: s.exercises.filter(e => e.id !== exId).length === 0 ? s.exercises : s.exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.filter(st => st.id !== setId) }) };
    onUpdate(updated);
  }
  function removeExercise(exId, exName) {
    askConfirm(`¿Eliminar "${exName}" de esta sesión?`, () => {
      const updated = { ...s, exercises: s.exercises.filter(e => e.id !== exId) };
      onUpdate(updated);
    });
  }
  function addExerciseInline(name) {
    const newEx = { id: uid(), name, weight: "", reps: "", sets: [{ id: uid(), weight: "", reps: "" }] };
    const updated = { ...s, exercises: [...(s.exercises || []), newEx] };
    onUpdate(updated);
    setShowAddEx(false);
    setAddExSearch("");
    setEditingExId(newEx.id);
  }

  return (
    <>
    <div className="card session-card">
      <div className="session-header" onClick={onToggle} style={prs.size > 0 ? { borderLeft: "3px solid #f59e0b", paddingLeft: 10 } : {}}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="session-date">
            {s.date ? (() => {
              const [y,m,d] = s.date.split("-");
              const dow = new Date(+y, +m-1, +d).getDay();
              const dayName = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][dow];
              const monthName = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][+m-1];
              return `${dayName} ${+d} de ${monthName} del ${y}`;
            })() : ""}
          </span>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={nameVal}
              onChange={e => setNameVal(e.target.value.slice(0, 25))}
              maxLength={25}
              onBlur={saveName}
              onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setNameVal(s.workout||""); setEditingName(false); } }}
              onClick={e => e.stopPropagation()}
              style={{
                fontFamily: "Inter, sans-serif", fontWeight: 800,
                fontSize: 15, letterSpacing: 0.5,
                background: "var(--input-bg)", border: "1.5px solid var(--accent)",
                color: "var(--text)", borderRadius: 8, padding: "3px 10px",
                outline: "none", minWidth: 120, maxWidth: 220,
              }}
              autoFocus
            />
          ) : (
            <span
              className="session-workout"
              title="Toca para editar el nombre"
              onClick={e => { e.stopPropagation(); setEditingName(true); setNameVal(s.workout||""); setTimeout(() => nameInputRef.current?.focus(), 50); }}
              style={{ cursor: "text", borderBottom: "1px dashed var(--border)", paddingBottom: 1, textTransform: "none" }}
            >
              {s.workout} ✏️
            </span>
          )}
          {prs.size > 0 && (
            <span style={{ fontSize: 11, background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.6)", color: "#f59e0b", borderRadius: 8, padding: "3px 9px", fontWeight: 800, display:"flex", alignItems:"center", gap:4 }}>
              🏆 {prs.size} PR{prs.size > 1 ? "s" : ""} — {[...prs].join(", ")}
            </span>
          )}
          <StreakChip sessions={allSessions} compact />        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {volDisplay && (
            <span className="ex-count" style={{ color:"var(--accent)", borderColor:"rgba(59,130,246,0.3)" }}>
              🏋️ {volDisplay}
            </span>
          )}
          {(() => {
            const rpeVals = (s.exercises||[]).flatMap(ex =>
              (ex.sets||[]).map(st => parseFloat(st.rpe)).filter(v => !isNaN(v) && v > 0)
            );
            if (rpeVals.length === 0) return null;
            const avg = Math.round((rpeVals.reduce((a,b)=>a+b,0)/rpeVals.length)*10)/10;
            return (
              <span className="ex-count" style={{ color:"var(--accent)", borderColor:"rgba(223,255,0,0.25)", background:"rgba(223,255,0,0.05)" }}>
                🎯 RPE {avg}
              </span>
            );
          })()}
          <span className="ex-count">{(s.exercises || []).length} ejerc.</span>
          <span className="chevron">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div className="session-body">
          {s.notes && <p className="session-notes">{s.notes}</p>}
          {(s.exercises || []).map((ex, exIdx) => {
            const isEditing = editingExId === ex.id;
            const hasMultiSets = ex.sets?.length > 1;
            const displayWeight = ex.sets?.length > 0 ? ex.sets[0].weight : ex.weight;
            const displayReps = ex.sets?.length > 0 ? ex.sets[0].reps : ex.reps;
            return (
              <div key={ex.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                {/* Row header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="ex-name">{ex.name}</span>
                    {prs.has(ex.name) && <span style={{ fontSize: 9, background: "rgba(251,191,36,0.15)", color: "#f59e0b", borderRadius: 4, padding: "1px 5px", marginLeft: 6, fontWeight: 800 }}>PR</span>}
                    {ex.supersetGroup && (
                      <span style={{ fontSize: 8, background: getSupersetColor(ex.supersetGroup, s.exercises || []), color: "#09090B", borderRadius: 3, padding: "1px 5px", marginLeft: 5, fontWeight: 900, letterSpacing: 1, verticalAlign: "middle" }}>SS</span>
                    )}
                  </div>
                  <button className="icon-action" title="Ver progreso" onClick={() => onProgress(ex.name)}>📈</button>
              <button className="btn-ghost small" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setEditingExId(isEditing ? null : ex.id)}>
                  {isEditing ? "✓ Listo" : "✏️ Editar"}
                </button>
              <button onClick={() => removeExercise(ex.id, ex.name)} title="Quitar ejercicio" style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:16, padding:"0 2px", lineHeight:1 }}>×</button>
              </div>

              {/* View mode: just show summary */}
              {!isEditing && (
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                  {hasMultiSets
                    ? ex.sets.map((st, i) => <span key={st.id} style={{ marginRight: 10 }}>S{i+1}: <b style={{ color: "var(--text)" }}>{convertWeight(st.weight)||"—"}{u}×{st.reps||"—"}</b></span>)
                    : <span><b style={{ color: (displayWeight && displayWeight !== "0") ? "var(--text)" : "var(--accent)" }}>{(displayWeight && displayWeight !== "0") ? `${convertWeight(displayWeight)}${u} × ${displayReps}` : "⚠️ Sin peso/reps — pulsa Editar"}</b></span>
                  }
                </div>
              )}
              {!isEditing && ex.notes && (() => {
                const noteKey = ex.id || exIdx;
                const isExpanded = !!expandedNotes[noteKey];
                const isLong = ex.notes.length > 80;
                return (
                  <div style={{ marginTop: 5 }}>
                    <div style={{
                      fontSize: 11, color: "var(--text-muted)", fontStyle: "italic",
                      display: "flex", alignItems: "flex-start", gap: 5,
                    }}>
                      <span style={{ flexShrink: 0 }}>📝</span>
                      <span style={{
                        overflow: "hidden", wordBreak: "break-word",
                        display: "-webkit-box",
                        WebkitLineClamp: isExpanded ? "unset" : 2,
                        WebkitBoxOrient: "vertical",
                      }}>{ex.notes}</span>
                    </div>
                    {isLong && (
                      <button
                        onClick={() => setExpandedNotes(prev => ({ ...prev, [noteKey]: !isExpanded }))}
                        style={{
                          background: "none", border: "none", padding: "2px 0 0 20px",
                          color: "rgba(223,255,0,0.5)", fontSize: 10, fontWeight: 700,
                          cursor: "pointer", fontFamily: "Barlow, sans-serif", letterSpacing: 1,
                        }}
                      >
                        {isExpanded ? "▲ ver menos" : "▼ ver más"}
                      </button>
                    )}
                  </div>
                );
              })()}
                {/* Edit mode */}
                {isEditing && (
                  <div style={{ marginTop: 8 }}>
                    {(hasMultiSets ? ex.sets : [{ id: ex.sets?.[0]?.id || uid(), weight: displayWeight||"", reps: displayReps||"" }]).map((st, i) => (
                      <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", width: 24, flexShrink: 0 }}>S{i+1}</span>
                        <input className="input" style={{ flex: 1, padding: "6px 10px", fontSize: 13 }} placeholder={`Peso (${u})`} value={st.weight||""} onChange={e => {
                          if (hasMultiSets) updateSetField(ex.id, st.id, "weight", numWeight(e.target.value));
                          else updateExField(ex.id, "weight", numWeight(e.target.value));
                        }} inputMode="decimal" />
                        <span style={{ color: "var(--text-muted)" }}>×</span>
                        <input className="input" style={{ flex: 1, padding: "6px 10px", fontSize: 13 }} placeholder="Reps" value={st.reps||""} onChange={e => {
                          if (hasMultiSets) updateSetField(ex.id, st.id, "reps", numReps(e.target.value));
                          else updateExField(ex.id, "reps", numReps(e.target.value));
                        }} inputMode="numeric" />
                        {hasMultiSets && ex.sets.length > 1 && <button className="chip-del" onClick={() => removeSetFromEx(ex.id, st.id)}>×</button>}
                      </div>
                    ))}
                    <button className="btn-ghost small" style={{ fontSize: 11, marginTop: 2 }} onClick={() => addSetToEx(ex.id)}>+ Añadir set</button>
                  </div>
                )}
              </div>
            );
          })}
          {/* ── Resumen de sesión ── */}
          {(() => {
            const totalSets = (s.exercises||[]).reduce((a, ex) => a + (ex.sets?.length || 1), 0);
            const totalVol  = Math.round(calcSessionVolume(s));
            const durMins   = s.durationSecs > 0
              ? s.durationSecs < 60
                ? `${s.durationSecs}s`
                : `${Math.round(s.durationSecs / 60)} min`
              : null;
            const topEx     = (s.exercises||[]).reduce((best, ex) => {
              const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
              return w > (best?.w||0) ? { name: ex.name, w } : best;
            }, null);
            const stats = [
              { icon: "⏱", label: "Duración",  value: durMins ?? "—" },
              totalVol  && { icon: "🏋️", label: "Volumen",   value: totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)}t` : `${totalVol}kg` },
              { icon: "🔁", label: "Series",    value: `${totalSets} series` },
              { icon: "💪", label: "Ejercicios", value: `${(s.exercises||[]).length}` },
              topEx     && { icon: "⭐", label: "Top peso",  value: `${topEx.name} ${topEx.w}kg` },
              prs.size  && { icon: "🏆", label: "PRs",       value: `${[...prs].join(", ")}` },
              (() => {
                const rpeVals = (s.exercises||[]).flatMap(ex =>
                  (ex.sets||[]).map(st => parseFloat(st.rpe)).filter(v => !isNaN(v) && v > 0)
                );
                if (rpeVals.length === 0) return null;
                const avg = Math.round((rpeVals.reduce((a,b)=>a+b,0)/rpeVals.length)*10)/10;
                return { icon: "🎯", label: "RPE prom.", value: `${avg} / 10` };
              })(),
            ].filter(Boolean);
            return (
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 8, margin: "14px 0 10px",
                padding: "12px 14px",
                background: "var(--input-bg)", borderRadius: 12,
                border: "1px solid var(--border)",
              }}>
                {stats.map((st, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{st.icon} {st.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* ── Agregar ejercicio inline ── */}
          <div style={{ marginBottom: 10 }}>
            {!showAddEx ? (
              <button className="btn-ghost" style={{ width:"100%", justifyContent:"center" }} onClick={() => setShowAddEx(true)}>
                + Agregar ejercicio
              </button>
            ) : (
              <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:12 }}>
                <input
                  autoFocus
                  placeholder="Buscar ejercicio..."
                  value={addExSearch}
                  onChange={e => setAddExSearch(e.target.value)}
                  style={{ width:"100%", background:"var(--card)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 12px", color:"var(--text)", fontSize:13, outline:"none", boxSizing:"border-box" }}
                />
                <div style={{ maxHeight:180, overflowY:"auto", marginTop:8 }}>
                  {EXERCISE_DB
                    .filter(e => !addExSearch || e.name.toLowerCase().includes(addExSearch.toLowerCase()))
                    .slice(0, 20)
                    .map(e => (
                      <div key={e.name}
                        onClick={() => addExerciseInline(e.name)}
                        style={{ padding:"8px 10px", cursor:"pointer", borderRadius:6, fontSize:13, display:"flex", justifyContent:"space-between", alignItems:"center" }}
                        onMouseEnter={ev => ev.currentTarget.style.background="var(--card)"}
                        onMouseLeave={ev => ev.currentTarget.style.background="transparent"}
                      >
                        <span>{e.name}</span>
                        <span style={{ fontSize:10, color:"var(--text-muted)" }}>{e.muscle}</span>
                      </div>
                    ))
                  }
                  {EXERCISE_DB.filter(e => !addExSearch || e.name.toLowerCase().includes(addExSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding:"8px 10px", fontSize:12, color:"var(--text-muted)" }}>Sin resultados</div>
                  )}
                </div>
                <button className="btn-ghost" style={{ marginTop:8, width:"100%", justifyContent:"center" }} onClick={() => { setShowAddEx(false); setAddExSearch(""); }}>
                  Cancelar
                </button>
              </div>
            )}
          </div>
          <div className="session-actions">
            <button className="btn-ghost" onClick={() => onShare(s)}>📤 Compartir</button>
            <button className="btn-ghost danger" onClick={() => onDelete(s.id)}>🗑️ Eliminar</button>
          </div>
        </div>
      )}
    </div>
    {confirmModal}
    </>
  );
}