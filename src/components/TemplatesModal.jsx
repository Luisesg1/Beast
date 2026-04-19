import { useState, useEffect } from "react";
import { useConfirm } from "./ConfirmModal";
import ExerciseGif from "./ExerciseGif";
import { EXERCISE_DB, MUSCLES, registerCustomExercise } from "../exerciseDb";

import { uid, fmtDate, todayStr, lettersOnly, store, load } from "../utils/helpers";

// ─── Encode / Decode de plantillas compartidas ────────────────────────────────
function encodeTemplate(t) {
  try {
    const mini = {
      n: t.name, d: t.day ?? "",
      e: (t.exercises || []).map(ex => ({
        n: ex.name, w: ex.weight, r: ex.reps,
        s: ex.series || ex.sets?.length || 3,
      })),
    };
    const bytes = new TextEncoder().encode(JSON.stringify(mini));
    return btoa(String.fromCharCode(...bytes)).replace(/=/g, "");
  } catch { return null; }
}

function decodeTemplate(code) {
  try {
    const padded = code + "===".slice(0, (4 - code.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || typeof obj.n !== "string") return null;
    return {
      id: uid(), name: obj.n.slice(0, 100), workout: obj.n.slice(0, 100),
      day: obj.d ?? "",
      exercises: (Array.isArray(obj.e) ? obj.e : []).slice(0, 50).map(e => ({
        id: uid(),
        name: typeof e.n === "string" ? e.n.slice(0, 100) : "",
        weight: e.w || "", reps: e.r || "", series: String(e.s || 3), sets: [],
      })),
      createdAt: todayStr(),
    };
  } catch { return null; }
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function TemplatesModal({ sessions, onLoad, onClose }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const [templates, setTemplates] = useState(() => load("gym_templates", []));
  const [tab, setTab] = useState("mine");

  // Editor de plantilla
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editExercises, setEditExercises] = useState([]);
  const [editError, setEditError] = useState("");

  // Nuevo ejercicio en editor
  const [newExercise, setNewExercise] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newSeries, setNewSeries] = useState("3");
  const [exCustomInput, setExCustomInput] = useState("");
  const [exCustomMuscleTpl, setExCustomMuscleTpl] = useState("");
  const [tplMuscleFilter, setTplMuscleFilter] = useState("Todos");

  // Compartir / importar
  const [shareCode, setShareCode] = useState(null);
  const [importCode, setImportCode] = useState("");
  const [importMsg, setImportMsg] = useState("");

  // Selector de modo (en vivo / registrar)
  const [modePickerFor, setModePickerFor] = useState(null);

  // ── helpers internos ──────────────────────────────────────────────────────
  function saveTemplates(t) { setTemplates(t); store("gym_templates", t); }
  function deleteTemplate(id) { saveTemplates(templates.filter(t => t.id !== id)); }
  function loadTemplate(t, mode = "live") { onLoad(t.workout, t.exercises, mode); onClose(); }

  const recentWorkouts = [...new Map(sessions.map(s => [s.workout, s])).values()].slice(0, 5);

  function saveFromSession(s) {
    if (!s.workout) return;
    const t = {
      id: uid(), name: s.workout, workout: s.workout,
      exercises: (s.exercises || []).map(e => {
        const bestSet = e.sets?.length > 0
          ? e.sets.reduce((best, st) =>
              (parseFloat(st.weight) || 0) > (parseFloat(best.weight) || 0) ? st : best,
              e.sets[0])
          : null;
        return {
          ...e, id: uid(), sets: [],
          weight: bestSet ? String(bestSet.weight || "") : String(e.weight || ""),
          reps:   bestSet ? String(bestSet.reps   || "") : String(e.reps   || ""),
          series: String(e.sets?.length || e.series || 3),
        };
      }),
      createdAt: todayStr(),
    };
    saveTemplates([...templates, t]);
  }

  function openEditor(t) {
    setEditingTemplate(t);
    setEditName(t.name);
    setEditDay(t.day || "");
    setEditExercises(t.exercises || []);
    setNewExercise("");
  }

  function openNew() {
    openEditor({ id: uid(), name: "", workout: "", exercises: [], createdAt: todayStr() });
  }

  function saveEdit() {
    if (!editName.trim()) { setEditError("⚠️ Agrega un nombre a la plantilla"); return; }
    setEditError("");
    const updated = { ...editingTemplate, name: editName, workout: editName, day: editDay, exercises: editExercises };
    const exists = templates.find(t => t.id === updated.id);
    if (exists) saveTemplates(templates.map(t => t.id === updated.id ? updated : t));
    else         saveTemplates([...templates, updated]);
    setEditingTemplate(null);
  }

  function addExercise() {
    const finalName = newExercise === "__custom__" ? exCustomInput.trim() : newExercise.trim();
    if (!finalName) return;
    if (newExercise === "__custom__" && exCustomMuscleTpl && !EXERCISE_DB.find(e => e.name === finalName)) {
      // saveCustomExercise(finalName, exCustomMuscleTpl); // descomenta cuando tengas el import
      registerCustomExercise(finalName, exCustomMuscleTpl);
    }
    setEditExercises(prev => [
      ...prev,
      { id: uid(), name: finalName, sets: [], weight: newWeight || "0", reps: newReps || "0", series: newSeries || "3" },
    ]);
    setNewExercise(""); setExCustomInput(""); setExCustomMuscleTpl("");
    setNewWeight(""); setNewReps(""); setNewSeries("3");
  }

  function removeExercise(id) {
    setEditExercises(prev => prev.filter(e => e.id !== id));
  }

  useEffect(() => {
    if (!importMsg) return;
    const _t = setTimeout(() => setImportMsg(""), 3000);
    return () => clearTimeout(_t);
  }, [importMsg]);

  function handleImport() {
    const t = decodeTemplate(importCode.trim());
    if (!t) { setImportMsg("❌ Código inválido. Verifica que sea correcto."); return; }
    if (templates.find(x => x.name === t.name)) { setImportMsg("⚠️ Ya tienes una plantilla con ese nombre."); return; }
    saveTemplates([...templates, t]);
    setImportCode("");
    setImportMsg(`✅ Plantilla "${t.name}" importada!`);
  }

  // ── Vista: editor de plantilla ────────────────────────────────────────────
  if (editingTemplate) return (
    <div className="overlay" onClick={() => setEditingTemplate(null)}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 {editingTemplate.name || "Nueva plantilla"}</h3>
          <button className="close-btn" onClick={() => setEditingTemplate(null)}>✕</button>
        </div>

        {/* Nombre */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Nombre</div>
          <input className="input" value={editName}
            onChange={e => setEditName(e.target.value.slice(0, 25))}
            maxLength={25}
            placeholder="Ej: Push Day, Piernas..."
            style={{ width: "100%" }} />
        </div>

        {/* Día asignado */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">
            Día asignado <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>(opcional)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d, i) => (
              <button key={d}
                onClick={() => setEditDay(editDay === String(i) ? "" : String(i))}
                style={{
                  padding: "8px 4px", borderRadius: 10, border: "1px solid",
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                  borderColor: editDay === String(i) ? "var(--accent)" : "var(--border)",
                  background:  editDay === String(i) ? "rgba(59,130,246,0.15)" : "var(--input-bg)",
                  color:       editDay === String(i) ? "var(--accent)" : "var(--text-muted)",
                  transition: "all 0.15s",
                }}>
                {d}
              </button>
            ))}
          </div>
          {editDay !== "" && (
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
              📅 Esta plantilla se sugerirá los {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábados","Domingos"][editDay]}
            </div>
          )}
        </div>

        {/* Ejercicios agregados */}
        {editExercises.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="card-label">Ejercicios ({editExercises.length})</div>
            {editExercises.map(ex => (
              <div key={ex.id} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                  <ExerciseGif exName={ex.name} size={36} />
                  <span style={{ fontWeight: 700, fontSize: 13, flex: 1 }}>{ex.name}</span>
                  <button className="btn-ghost small danger" onClick={() => removeExercise(ex.id)}>🗑️</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "8px 12px" }}>
                  {[["PESO (kg)", "weight"], ["REPS", "reps"], ["SERIES", "series"]].map(([label, field]) => (
                    <div key={field}>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>{label}</label>
                      <input className="input" type="number" inputMode="decimal"
                        placeholder={field === "series" ? "3" : "0"}
                        value={ex[field] || ""}
                        onChange={e => setEditExercises(prev =>
                          prev.map(x => x.id !== ex.id ? x : { ...x, [field]: e.target.value })
                        )}
                        style={{ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "6px 4px" }} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agregar ejercicio */}
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div className="card-label" style={{ marginBottom: 12 }}>Agregar ejercicio</div>

          {/* Filtros músculo */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(88px,1fr))", gap: 6, marginBottom: 12 }}>
            {["Todos", ...MUSCLES].map(m => (
              <button key={m} className={`muscle-chip ${tplMuscleFilter === m ? "active" : ""}`}
                style={{ padding: "3px 9px", fontSize: 11 }}
                onClick={() => { setTplMuscleFilter(m); setNewExercise(""); }}>
                {m}
              </button>
            ))}
          </div>

          {/* Selector ejercicio */}
          <div className="field" style={{ marginBottom: 10 }}>
            <label className="field-label">Ejercicio</label>
            <select className="input" value={newExercise} onChange={e => {
              const name = e.target.value;
              setNewExercise(name);
              if (name && name !== "__custom__" && sessions?.length > 0) {
                const allUses = sessions
                  .slice().sort((a, b) => b.date.localeCompare(a.date))
                  .flatMap(s => (s.exercises || []).filter(ex => ex.name === name));
                if (allUses.length > 0) {
                  const last = allUses[0];
                  setNewWeight(last.sets?.length > 0
                    ? String(Math.max(...last.sets.map(st => parseFloat(st.weight) || 0)))
                    : String(last.weight || ""));
                  setNewReps(last.sets?.length > 0
                    ? String(Math.max(...last.sets.map(st => parseFloat(st.reps) || 0)))
                    : String(last.reps || ""));
                  setNewSeries(last.sets?.length > 0
                    ? String(last.sets.length)
                    : String(last.series || "3"));
                }
              }
            }}>
              <option value="">— Selecciona —</option>
              {(tplMuscleFilter === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === tplMuscleFilter))
                .map(ex => <option key={ex.name} value={ex.name}>{ex.name}</option>)}
              <option value="__custom__">✏️ Personalizado... (escribe el tuyo)</option>
            </select>
            {newExercise === "__custom__" && (
              <>
                <input className="input" style={{ marginTop: 6 }}
                  placeholder="Escribe el nombre de tu ejercicio..."
                  value={exCustomInput}
                  onChange={e => setExCustomInput(lettersOnly(e.target.value))}
                  autoFocus />
                <select className="input" style={{ marginTop: 6 }}
                  value={exCustomMuscleTpl}
                  onChange={e => setExCustomMuscleTpl(e.target.value)}>
                  <option value="">— Músculo principal —</option>
                  {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </>
            )}
          </div>

          {/* Preview + campos peso/reps/series */}
          {newExercise && newExercise !== "__custom__" ? (
            <div style={{ padding: 14, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                <ExerciseGif exName={newExercise} size={72} />
                <div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 800 }}>{newExercise}</div>
                  {newWeight && <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>📋 Pre-rellenado con tu último entreno</div>}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[["Peso (kg)", newWeight, setNewWeight], ["Reps", newReps, setNewReps], ["Series", newSeries, setNewSeries]].map(([label, val, set]) => (
                  <div key={label} className="field">
                    <label className="field-label">{label}</label>
                    <input className="input" placeholder={label === "Series" ? "3" : "0"}
                      value={val} onChange={e => set(e.target.value)}
                      type="number" inputMode="decimal" />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
              {[["Peso (kg)", newWeight, setNewWeight], ["Reps", newReps, setNewReps], ["Series", newSeries, setNewSeries]].map(([label, val, set]) => (
                <div key={label} className="field">
                  <label className="field-label">{label}</label>
                  <input className="input" placeholder={label === "Series" ? "3" : "0"}
                    value={val} onChange={e => set(e.target.value)}
                    type="number" inputMode="decimal" />
                </div>
              ))}
            </div>
          )}

          <button className="btn-add-ex" onClick={addExercise}>+ Agregar ejercicio</button>
        </div>

        {editError && <div className="err-msg" style={{ marginBottom: 10 }}>{editError}</div>}
        <button className="btn-primary" style={{ width: "100%", fontSize: 15 }} onClick={saveEdit}>
          💾 Guardar plantilla
        </button>
      </div>
    </div>
  );

  // ── Vista: listado de plantillas ──────────────────────────────────────────
  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 Plantillas</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tab-row" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab === "mine"   ? "active" : ""}`} onClick={() => setTab("mine")}>Mis plantillas</button>
          <button className={`tab-btn ${tab === "quick"  ? "active" : ""}`} onClick={() => setTab("quick")}>Desde historial</button>
          <button className={`tab-btn ${tab === "import" ? "active" : ""}`} onClick={() => setTab("import")}>🔗 Importar</button>
        </div>

        {/* ── Tab: Mis plantillas ── */}
        {tab === "mine" && (
          <div>
            <button className="btn-primary" style={{ width: "100%", marginBottom: 16, fontSize: 15 }} onClick={openNew}>
              + Crear plantilla
            </button>
            {templates.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                Aún no tienes plantillas. Crea una o guarda una desde "Desde historial".
              </p>
            )}
            {templates.map(t => (
              <div key={t.id} style={{ marginBottom: 10 }}>
                <div style={{ padding: "12px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12 }}>
                  {/* Nombre + badges */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>{t.name}</div>
                    {t.day !== undefined && t.day !== "" && (
                      <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
                        📅 {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][t.day]}
                      </span>
                    )}
                  </div>
                  {/* Metadata */}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                    {(t.exercises || []).length} ejercicios · {fmtDate(t.createdAt)}
                  </div>
                  {/* Acciones 2x2 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button className="btn-ghost small" onClick={() => openEditor(t)}>✏️ Editar</button>
                    <button className="btn-ghost small"
                      onClick={() => setModePickerFor(modePickerFor?.id === t.id ? null : t)}
                      style={{
                        background:  modePickerFor?.id === t.id ? "var(--accent-dim)" : undefined,
                        borderColor: modePickerFor?.id === t.id ? "var(--accent)" : undefined,
                        color:       modePickerFor?.id === t.id ? "var(--accent)" : undefined,
                      }}>
                      ▶ Usar
                    </button>
                    <button className="btn-ghost small"
                      onClick={() => setShareCode(shareCode?.id === t.id ? null : { id: t.id, code: encodeTemplate(t), name: t.name })}
                      title="Compartir">
                      🔗 Compartir
                    </button>
                    <button className="btn-ghost small danger" onClick={async () => { const ok = await askConfirm(`¿Eliminar la plantilla "${t.name}"?`); if (ok) deleteTemplate(t.id); }}>🗑️ Eliminar</button>
                  </div>
                </div>

                {modePickerFor?.id === t.id && (
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--input-bg)", border: "1px solid var(--accent)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>¿Cómo quieres entrenar?</span>
                    <button className="btn-primary" style={{ fontSize: 13, padding: "7px 14px" }} onClick={() => loadTemplate(t, "live")}>⚡ En vivo</button>
                    <button className="btn-ghost small" onClick={() => loadTemplate(t, "register")}>📝 Registrar</button>
                  </div>
                )}

                {shareCode?.id === t.id && (
                  <div style={{ marginTop: 8, padding: "12px 14px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#a855f7", fontWeight: 700, marginBottom: 8 }}>🔗 Código para compartir — {shareCode.name}</div>
                    <code style={{ display: "block", fontSize: 10, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", wordBreak: "break-all", color: "var(--text)", marginBottom: 8, lineHeight: 1.6 }}>
                      {shareCode.code}
                    </code>
                    <button className="btn-ghost small" style={{ width: "100%" }} onClick={e => {
                      navigator.clipboard.writeText(shareCode.code);
                      const btn = e.currentTarget;
                      btn.textContent = "✓ Copiado";
                      btn.style.color = "#22c55e"; btn.style.borderColor = "#22c55e";
                      setTimeout(() => { btn.textContent = "📋 Copiar código"; btn.style.color = ""; btn.style.borderColor = ""; }, 1500);
                    }}>📋 Copiar código</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Importar ── */}
        {tab === "import" && (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
              Pega el código que te compartieron para importar su plantilla directamente.
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">Código de plantilla</label>
              <textarea className="input textarea"
                placeholder="Pega el código aquí..."
                value={importCode}
                onChange={e => setImportCode(e.target.value)}
                style={{ minHeight: 80, fontFamily: "monospace", fontSize: 12 }} />
            </div>
            <button className="btn-primary" style={{ width: "100%" }} onClick={handleImport}>
              📥 Importar plantilla
            </button>
            {importMsg && (
              <div style={{
                marginTop: 12, padding: "10px 14px",
                background: importMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)",
                border: `1px solid ${importMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
                borderRadius: 10, fontSize: 13,
                color: importMsg.startsWith("✅") ? "#22c55e" : "#ef4444",
              }}>
                {importMsg}
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Desde historial ── */}
        {tab === "quick" && (
          <div>
            <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
              Guarda una sesión reciente como plantilla reutilizable:
            </p>
            {recentWorkouts.length === 0 && (
              <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>Sin sesiones aún.</p>
            )}
            {recentWorkouts.map(s => (
              <div key={s.id} style={{ marginBottom: 8 }}>
                <div style={{ padding: "12px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10 }}>
                  {/* Nombre */}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.workout}</div>
                  </div>
                  {/* Metadata */}
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 10 }}>
                    {(s.exercises || []).length} ejercicios · {fmtDate(s.date)}
                  </div>
                  {/* Acciones 2x2 */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    <button className="btn-ghost small"
                      onClick={() => setModePickerFor(modePickerFor?.id === s.id ? null : s)}
                      style={{
                        background:  modePickerFor?.id === s.id ? "var(--accent-dim)" : undefined,
                        borderColor: modePickerFor?.id === s.id ? "var(--accent)" : undefined,
                        color:       modePickerFor?.id === s.id ? "var(--accent)" : undefined,
                      }}>
                      ▶ Usar
                    </button>
                    <button className="btn-ghost small" onClick={() => saveFromSession(s)}>💾 Guardar</button>
                    <button className="btn-ghost small"
                      onClick={() => setShareCode(shareCode?.id === s.id ? null : { id: s.id, code: encodeTemplate(s), name: s.workout })}>
                      🔗 Compartir
                    </button>
                    <button className="btn-ghost small danger" onClick={async () => { const ok = await askConfirm(`¿Eliminar "${s.workout}" del historial?`); if (ok) saveTemplates(templates.filter(t => t.id !== s.id)); }}>🗑️ Eliminar</button>
                  </div>
                </div>
                {modePickerFor?.id === s.id && (
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--input-bg)", border: "1px solid var(--accent)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>¿Cómo quieres entrenar?</span>
                    <button className="btn-primary" style={{ fontSize: 13, padding: "7px 14px" }} onClick={() => loadTemplate(s, "live")}>⚡ En vivo</button>
                    <button className="btn-ghost small" onClick={() => loadTemplate(s, "register")}>📝 Registrar</button>
                  </div>
                )}
                {shareCode?.id === s.id && (
                  <div style={{ marginTop: 8, padding: "12px 14px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 12 }}>
                    <div style={{ fontSize: 11, color: "#a855f7", fontWeight: 700, marginBottom: 8 }}>🔗 Código para compartir — {shareCode.name}</div>
                    <code style={{ display: "block", fontSize: 10, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", wordBreak: "break-all", color: "var(--text)", marginBottom: 8, lineHeight: 1.6 }}>
                      {shareCode.code}
                    </code>
                    <button className="btn-ghost small" style={{ width: "100%" }} onClick={e => {
                      navigator.clipboard.writeText(shareCode.code);
                      const btn = e.currentTarget;
                      btn.textContent = "✓ Copiado";
                      btn.style.color = "#22c55e"; btn.style.borderColor = "#22c55e";
                      setTimeout(() => { btn.textContent = "📋 Copiar código"; btn.style.color = ""; btn.style.borderColor = ""; }, 1500);
                    }}>📋 Copiar código</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    {confirmModal}
    </>
  );
}