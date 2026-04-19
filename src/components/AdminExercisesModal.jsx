import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./ConfirmModal";
import { doc, getDoc, collection, getDocsFromServer, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { EXERCISE_DB, MUSCLES } from "../exerciseDb";
import { calc1RM, getPRs, getStreak } from "./utils";
import { loadCustomExercises, updateCustomExerciseGif, updateCustomExerciseMeta, deleteCustomExercise } from "../utils/firebaseService";

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);
const numDot = (v, max = 9999) => { const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); const n = parseFloat(s); if (isNaN(n) || n < 0) return ""; return n > max ? String(max) : s; };

function AdminExercisesModal({ onClose, user, setGif = () => {} }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  // Guard: only admins can use this panel
  if (!user?.isAdmin) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Acceso restringido</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 20 }}>Solo los administradores pueden acceder a este panel.</div>
          <button className="btn-ghost" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    );
  }
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gifInputs, setGifInputs] = useState({});
  const [saving, setSaving] = useState({});
  const [gifErrors, setGifErrors] = useState({});
  const [filter, setFilter] = useState("");
  const [uploadMode, setUploadMode] = useState({});
  const [uploadPreviews, setUploadPreviews] = useState({});
  const fileInputRefs = useRef({});
  const [editing, setEditing] = useState({});
  const [savingMeta, setSavingMeta] = useState({});
  const [adminTab, setAdminTab] = useState("exercises");
  const [diagRunning, setDiagRunning] = useState(false);
  const [diagResults, setDiagResults] = useState(null);

  async function runDiagnostics() {
    setDiagRunning(true);
    setDiagResults(null);
    const results = [];
    try {
      // Obtener todos los coaches
      const coachesSnap = await getDocsFromServer(collection(db, "coaches"));
      for (const coachDoc of coachesSnap.docs) {
        const coachData = coachDoc.data();
        const coachUid = coachDoc.id;
        const athletes = Object.values(coachData.athletes || {});
        for (const a of athletes) {
          try {
            const snap = await getDocsFromServer(collection(db, "athlete_routines", a.uid, "routines"));
            for (const d of snap.docs) {
              const r = { ...d.data(), _docId: d.id };
              if (!r.coachUid || !r.routineId) {
                results.push({ athlete: a.name || a.email, athleteUid: a.uid, coachUid, _docId: r._docId, issue: "📄 Doc fantasma (sin coachUid o routineId)", routineName: r.routineName || "—", canFix: true });
                continue;
              }
              if (r.coachUid !== coachUid) continue;
              try {
                const rSnap = await getDoc(doc(db, "coaches", r.coachUid, "routines", r.routineId));
                if (!rSnap.exists()) {
                  results.push({ athlete: a.name || a.email, athleteUid: a.uid, coachUid, _docId: r._docId, issue: "🔗 Rutina no encontrada en panel coach", routineName: r.routineName || r.routineId, canFix: true });
                }
              } catch(e) {
                results.push({ athlete: a.name || a.email, athleteUid: a.uid, coachUid, _docId: r._docId, issue: "❓ Error al verificar rutina", routineName: r.routineName || "—", canFix: false });
              }
            }
          } catch(e) {
            results.push({ athlete: a.name || a.email, athleteUid: a.uid, coachUid, _docId: null, issue: "⚠️ Error al leer rutinas del atleta", routineName: "—", canFix: false });
          }
        }
      }
    } catch(e) {
      results.push({ athlete: "—", athleteUid: null, _docId: null, issue: "❌ Error al cargar coaches: " + e.message, routineName: "—", canFix: false });
    }
    setDiagResults(results);
    setDiagRunning(false);
  }

  async function fixDiagIssue(item) {
    if (!item._docId || !item.athleteUid) return;
    try {
      await deleteDoc(doc(db, "athlete_routines", item.athleteUid, "routines", item._docId));
      setDiagResults(prev => prev.filter(r => !(r._docId === item._docId && r.athleteUid === item.athleteUid)));
    } catch(e) { console.error("Fix error:", e); }
  }

  async function fixAllDiagIssues() {
    const fixable = (diagResults || []).filter(r => r.canFix && r._docId && r.athleteUid);
    await Promise.all(fixable.map(item =>
      deleteDoc(doc(db, "athlete_routines", item.athleteUid, "routines", item._docId)).catch(() => {})
    ));
    setDiagResults(prev => prev.filter(r => !r.canFix || !r._docId));
  }

  useEffect(() => {
    async function loadAll() {
      try {
        const allExercises = [];

        // 1) Ejercicios globales (usuarios sin coach)
        const globalSnap = await getDocsFromServer(collection(db, "custom_exercises"));
        globalSnap.docs.forEach(d => {
          allExercises.push({
            id: d.id,
            _coachUid: null,
            _coachName: null,
            ...d.data(),
          });
        });

        // 2) Ejercicios privados de cada coach
        const coachesSnap = await getDocsFromServer(collection(db, "coaches"));
        await Promise.all(coachesSnap.docs.map(async coachDoc => {
          const sub = await getDocsFromServer(
            collection(db, "coaches", coachDoc.id, "custom_exercises")
          );
          sub.docs.forEach(d => {
            allExercises.push({
              id: d.id,
              _coachUid: coachDoc.id,
              _coachName: coachDoc.data().name || coachDoc.id,
              ...d.data(),
            });
          });
        }));

        setExercises(allExercises);
        const inputs = {};
        allExercises.forEach(e => { inputs[e.id] = e.gifUrl || ""; });
        setGifInputs(inputs);
      } catch(e) {
        console.error("[AdminExercisesModal] loadAll ERROR:", e);
      }
      setLoading(false);
    }
    loadAll();
  }, []);

  function getMode(id) { return uploadMode[id] || "url"; }
  function setMode(id, mode) { setUploadMode(p => ({ ...p, [id]: mode })); }

  function startEdit(ex) {
    setEditing(p => ({ ...p, [ex.id]: { name: ex.name, muscle: ex.muscle } }));
  }
  function cancelEdit(id) {
    setEditing(p => { const n = { ...p }; delete n[id]; return n; });
  }
  async function saveEdit(ex) {
    const { name, muscle } = editing[ex.id];
    if (!name.trim()) return;
    setSavingMeta(s => ({ ...s, [ex.id]: true }));
    await updateCustomExerciseMeta(ex._coachUid || null, ex.id, name.trim(), muscle.trim());
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, name: name.trim(), muscle: muscle.trim() } : e));
    setSavingMeta(s => ({ ...s, [ex.id]: false }));
    cancelEdit(ex.id);
  }

  function handleFileChange(ex, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setGifErrors(p => ({ ...p, [ex.id]: "⚠️ Solo se admiten imágenes/GIFs" }));
      return;
    }
    setGifErrors(p => ({ ...p, [ex.id]: "" }));
    setUploadPreviews(p => ({ ...p, [ex.id]: URL.createObjectURL(file) }));
    setGifInputs(p => ({ ...p, [ex.id]: file }));
  }

  async function handleSaveGif(ex) {
    setSaving(s => ({ ...s, [ex.id]: true }));
    let url = gifInputs[ex.id] || "";
    try {
      if (url instanceof File) {
        url = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(url);
        });
      }
      const ok = await updateCustomExerciseGif(ex._coachUid || null, ex.id, url);
      if (!ok) {
        setGifErrors(p => ({ ...p, [ex.id]: "❌ Error al guardar." }));
        setSaving(s => ({ ...s, [ex.id]: false }));
        return;
      }
      setGifInputs(p => ({ ...p, [ex.id]: url }));
      setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, gifUrl: url } : e));
      setGif(ex.name, url);
      setGifErrors(p => ({ ...p, [ex.id]: "" }));
    } catch(e) {
      console.error(e);
      setGifErrors(p => ({ ...p, [ex.id]: "❌ Error al subir el GIF: " + e.message }));
    }
    setSaving(s => ({ ...s, [ex.id]: false }));
  }

  async function handleDelete(ex) {
    const ok = await askConfirm(`¿Eliminar "${ex.name}"?`); if (!ok) return;
    await deleteCustomExercise(ex._coachUid || null, ex.id);
    setExercises(prev => prev.filter(e => e.id !== ex.id));
  }

  const filtered = exercises.filter(e =>
    e.name?.toLowerCase().includes(filter.toLowerCase()) ||
    e.muscle?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">⚙️ Panel de administración</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
          {[["exercises","🏋️ Ejercicios"], ["diag","🔍 Diagnóstico"]].map(([key, label]) => (
            <button key={key} onClick={() => setAdminTab(key)}
              style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "Barlow, sans-serif", fontWeight: 700, fontSize: 13,
                background: adminTab === key ? "var(--accent)" : "var(--input-bg)",
                color: adminTab === key ? "white" : "var(--text-muted)",
                transition: "all 0.15s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── TAB: Ejercicios ── */}
        {adminTab === "exercises" && (<>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Ejercicios creados por usuarios. Sube un GIF local o pega una URL para que aparezca en la app.
        </div>
        <input className="input" placeholder="🔍 Filtrar por nombre o músculo..."
          value={filter} onChange={e => setFilter(e.target.value)} style={{ marginBottom: 14 }} />
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>⏳ Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            {exercises.length === 0 ? "Aún no hay ejercicios personalizados." : "Sin resultados."}
          </div>
        ) : filtered.map(ex => {
          const mode = getMode(ex.id);
          const preview = uploadPreviews[ex.id] || ex.gifUrl;
          const inputVal = gifInputs[ex.id] || "";
          const isSaved = ex.gifUrl && inputVal === ex.gifUrl;
          const isEditing = !!editing[ex.id];
          return (
            <div key={ex.id} style={{ background: "var(--input-bg)", border: `1px solid ${ex.gifUrl ? "rgba(34,197,94,0.4)" : "var(--border)"}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input className="input" style={{ fontSize: 13, fontWeight: 700, padding: "5px 10px" }}
                        placeholder="Nombre del ejercicio"
                        value={editing[ex.id].name}
                        onChange={e => setEditing(p => ({ ...p, [ex.id]: { ...p[ex.id], name: e.target.value } }))} />
                      <select className="input" style={{ fontSize: 12, padding: "5px 10px" }}
                        value={editing[ex.id].muscle}
                        onChange={e => setEditing(p => ({ ...p, [ex.id]: { ...p[ex.id], muscle: e.target.value } }))}>
                        {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => saveEdit(ex)} disabled={savingMeta[ex.id]}
                          className="btn-primary" style={{ fontSize: 11, padding: "5px 12px" }}>
                          {savingMeta[ex.id] ? "⏳" : "✅ Guardar"}
                        </button>
                        <button onClick={() => cancelEdit(ex.id)}
                          style={{ fontSize: 11, padding: "5px 12px", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>💪 {ex.muscle} · {ex.createdAt}{ex._coachName ? <span style={{ marginLeft: 6, color: "var(--accent)", opacity: 0.7 }}>· 🧑‍💼 {ex._coachName}</span> : <span style={{ marginLeft: 6, color: "var(--text-muted)", opacity: 0.6 }}>· 👤 Usuario</span>}</div>
                      </div>
                      <button onClick={() => startEdit(ex)}
                        title="Editar nombre y músculo"
                        style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {preview && (
                    <img src={preview} alt={ex.name}
                      style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", border: "1px solid var(--accent)" }}
                      onError={e => { e.target.style.display = "none"; }} />
                  )}
                  <button onClick={() => handleDelete(ex)}
                    style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                      borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>🗑️</button>
                </div>
              </div>

              {/* Toggle URL / Archivo local */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => setMode(ex.id, "url")}
                  style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 8, cursor: "pointer", fontFamily: "Barlow, sans-serif", fontWeight: 600,
                    background: mode === "url" ? "var(--accent)" : "none",
                    color: mode === "url" ? "white" : "var(--text-muted)",
                    border: `1px solid ${mode === "url" ? "var(--accent)" : "var(--border)"}`,
                    transition: "all 0.15s" }}>
                  🔗 URL
                </button>
                <button onClick={() => setMode(ex.id, "file")}
                  style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 8, cursor: "pointer", fontFamily: "Barlow, sans-serif", fontWeight: 600,
                    background: mode === "file" ? "var(--accent)" : "none",
                    color: mode === "file" ? "white" : "var(--text-muted)",
                    border: `1px solid ${mode === "file" ? "var(--accent)" : "var(--border)"}`,
                    transition: "all 0.15s" }}>
                  📁 Archivo local
                </button>
              </div>

              {mode === "url" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" style={{ flex: 1, fontSize: 12 }}
                    placeholder="URL del GIF (https://...gif)"
                    value={inputVal.startsWith("data:") ? "" : inputVal}
                    onChange={e => {
                      setGifInputs(p => ({ ...p, [ex.id]: e.target.value }));
                      setUploadPreviews(p => ({ ...p, [ex.id]: null }));
                    }} />
                  <button onClick={() => handleSaveGif(ex)} disabled={saving[ex.id]}
                    className="btn-primary" style={{ fontSize: 12, padding: "8px 14px", flexShrink: 0 }}>
                    {saving[ex.id] ? "⏳" : ex.gifUrl ? "✏️ Actualizar" : "💾 Guardar"}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/gif,image/webp,image/png,image/jpeg"
                    ref={el => { fileInputRefs.current[ex.id] = el; }}
                    style={{ display: "none" }}
                    onChange={e => handleFileChange(ex, e.target.files[0])}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => fileInputRefs.current[ex.id]?.click()}
                      style={{ flex: 1, background: "var(--input-bg)", border: "1.5px dashed var(--border)", color: "var(--text-muted)",
                        borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Barlow, sans-serif",
                        textAlign: "left", transition: "border-color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                      {uploadPreviews[ex.id] ? "✅ GIF cargado — click para cambiar" : "📂 Seleccionar GIF local (máx. 3 MB)"}
                    </button>
                    <button onClick={() => handleSaveGif(ex)} disabled={saving[ex.id] || !gifInputs[ex.id]}
                      className="btn-primary" style={{ fontSize: 12, padding: "8px 14px", flexShrink: 0 }}>
                      {saving[ex.id] ? "⏳" : ex.gifUrl ? "✏️ Actualizar" : "💾 Guardar"}
                    </button>
                  </div>
                  {uploadPreviews[ex.id] && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                      Vista previa ↑ · Se subirá a Firebase Storage
                    </div>
                  )}
                </div>
              )}

              {gifErrors[ex.id] && (
                <div className="err-msg" style={{ marginTop: 6, fontSize: 12 }}>{gifErrors[ex.id]}</div>
              )}
              {isSaved && !uploadPreviews[ex.id] && (
                <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6 }}>✅ GIF asignado</div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(59,130,246,0.08)", borderRadius: 10, fontSize: 12, color: "var(--text-muted)" }}>
          💡 GIFs gratis en <a href="https://giphy.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>giphy.com</a> o <a href="https://tenor.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>tenor.com</a> — o sube directamente desde tu dispositivo
        </div>
        </>)}

        {/* ── TAB: Diagnóstico ── */}
        {adminTab === "diag" && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
              Escanea todos los atletas de todos los coaches y detecta rutinas rotas, fantasmas o huérfanas.
            </div>
            <button className="btn-primary" style={{ width: "100%", marginBottom: 16 }}
              onClick={runDiagnostics} disabled={diagRunning}>
              {diagRunning ? "⏳ Analizando..." : "▶ Ejecutar diagnóstico"}
            </button>

            {diagResults !== null && (
              diagResults.length === 0 ? (
                <div style={{ textAlign: "center", padding: 24, color: "#22c55e", fontWeight: 700, fontSize: 14 }}>
                  ✅ Todo en orden — no se encontraron problemas
                </div>
              ) : (
                <>
                  <div style={{ fontSize: 13, color: "#f87171", fontWeight: 700, marginBottom: 12 }}>
                    ⚠️ {diagResults.length} problema{diagResults.length > 1 ? "s" : ""} encontrado{diagResults.length > 1 ? "s" : ""}
                  </div>
                  {diagResults.map((item, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "10px 14px", background: "rgba(239,68,68,0.06)",
                      border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, marginBottom: 8, gap: 8, flexWrap: "wrap"
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{item.athlete}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{item.issue}</div>
                        <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 2, fontStyle: "italic" }}>Rutina: {item.routineName}</div>
                      </div>
                      {item.canFix && (
                        <button onClick={() => fixDiagIssue(item)}
                          style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171",
                            borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontSize: 12,
                            fontFamily: "Barlow, sans-serif", whiteSpace: "nowrap" }}>
                          🗑️ Eliminar
                        </button>
                      )}
                    </div>
                  ))}
                  {diagResults.some(r => r.canFix) && (
                    <button className="btn-primary"
                      style={{ width: "100%", marginTop: 8, background: "#ef4444", borderColor: "#ef4444" }}
                      onClick={fixAllDiagIssues}>
                      🔧 Reparar todo automáticamente
                    </button>
                  )}
                </>
              )
            )}
          </div>
        )}

      </div>
    </div>
    {confirmModal}
  </>
  );
}



export default AdminExercisesModal;