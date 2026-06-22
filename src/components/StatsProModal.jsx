import { useState, useMemo, useEffect, useCallback } from "react";
import { EXERCISE_DB, MUSCLES } from "../exerciseDb";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { showRewardedAd } from "../useAdMob";
import { ProgressPrediction } from "./ProgressWidgets";

// ─── Helpers ──────────────────────────────────────────────────────────────
const calc1RM = (w, r) => { if (!w || !r || r <= 0) return 0; const ww = parseFloat(w), rr = parseFloat(r); if (rr === 1) return ww; return Math.round(ww * (1 + rr / 30)); };
const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);

function getVolByMuscle(sessions, days = 30) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const out = {};
  sessions.filter(s => new Date(s.date + "T00:00:00") >= cutoff)
    .forEach(s => (s.exercises || []).forEach(ex => {
      const m = EXERCISE_DB.find(e => e.name === ex.name)?.muscle || "Otro";
      const vol = ex.sets?.length
        ? ex.sets.reduce((a, st) => a + (parseFloat(st.weight) || 0) * (parseFloat(st.reps) || 1), 0)
        : (parseFloat(ex.weight) || 0) * (parseFloat(ex.reps) || 1);
      out[m] = (out[m] || 0) + vol;
    }));
  return out;
}

function getExerciseHistory(exName, sessions) {
  return sessions
    .flatMap(s => (s.exercises || []).filter(e => e.name === exName).map(e => ({
      date: s.date,
      weight: e.sets?.length ? Math.max(...e.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(e.weight) || 0,
      reps: e.sets?.length ? Math.max(...e.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(e.reps) || 0,
      rm: calc1RM(
        e.sets?.length ? Math.max(...e.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(e.weight) || 0,
        e.sets?.length ? Math.max(...e.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(e.reps) || 0
      )
    })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function detectStagnation(sessions) {
  const alerts = [];
  const exercises = [...new Set(sessions.flatMap(s => (s.exercises || []).map(e => e.name)))];
  exercises.forEach(name => {
    const history = getExerciseHistory(name, sessions);
    if (history.length < 4) return;
    const last4 = history.slice(-4);
    const maxRM = Math.max(...last4.map(h => h.rm));
    const minRM = Math.min(...last4.map(h => h.rm));
    if (maxRM > 0 && (maxRM - minRM) / maxRM < 0.03) {
      alerts.push({ name, rm: maxRM, sessions: last4.length });
    }
  });
  return alerts.slice(0, 5);
}

// ─── Radar SVG ────────────────────────────────────────────────────────────────
function RadarChart({ data }) {
  const MUSCLES = ["Pecho", "Espalda", "Cuádriceps", "Hombros", "Bíceps", "Core"];
  const labels =  ["Pecho", "Espalda", "Piernas",    "Hombros", "Brazos", "Core"];
  const size = 200, cx = 100, cy = 105, r = 72;
  const total = Object.values(data).reduce((a, b) => a + b, 0) || 1;

  const points = MUSCLES.map((m, i) => {
    const angle = (Math.PI * 2 * i) / MUSCLES.length - Math.PI / 2;
    const val = Math.min((data[m] || 0) / total, 1);
    const scaled = val * 6; // amplify for visibility
    const capped = Math.min(scaled, 1);
    return {
      x: cx + Math.cos(angle) * r * capped,
      y: cy + Math.sin(angle) * r * capped,
      lx: cx + Math.cos(angle) * (r + 22),
      ly: cy + Math.sin(angle) * (r + 22),
      label: labels[i],
      pct: Math.round((data[m] || 0) / total * 100),
    };
  });

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1].map(frac => ({
    points: MUSCLES.map((_, i) => {
      const angle = (Math.PI * 2 * i) / MUSCLES.length - Math.PI / 2;
      return `${cx + Math.cos(angle) * r * frac},${cy + Math.sin(angle) * r * frac}`;
    }).join(" ")
  }));

  const polyPoints = points.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg width="100%" viewBox="0 0 200 210" style={{ maxWidth: 260, margin: "0 auto", display: "block" }}>
      {/* Grid rings */}
      {rings.map((rng, i) => (
        <polygon key={i} points={rng.points} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      ))}
      {/* Grid lines */}
      {MUSCLES.map((_, i) => {
        const angle = (Math.PI * 2 * i) / MUSCLES.length - Math.PI / 2;
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="rgba(255,255,255,0.07)" strokeWidth="1" />;
      })}
      {/* Data polygon */}
      <polygon points={polyPoints} fill="rgba(223,255,0,0.12)" stroke="#DFFF00" strokeWidth="2" strokeLinejoin="round" />
      {/* Data points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#DFFF00" />
      ))}
      {/* Labels */}
      {points.map((p, i) => (
        <text key={i} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle"
          fill={p.pct > 0 ? "#DFFF00" : "rgba(255,255,255,0.3)"}
          fontSize="9" fontWeight="700" fontFamily="Barlow Condensed, sans-serif">
          {p.label}
          {p.pct > 0 && <tspan x={p.lx} dy="10" fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="400">{p.pct}%</tspan>}
        </text>
      ))}
    </svg>
  );
}

// ─── Mini Line Chart SVG ──────────────────────────────────────────────────────
function LineChart({ data, color = "#DFFF00", height = 80 }) {
  if (!data || data.length < 2) return <div style={{ height, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.3)", fontSize: 12 }}>Pocos datos</div>;
  const w = 300, h = height, pad = 8;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const pts = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: h - pad - ((d.value - min) / range) * (h - pad * 2),
    ...d
  }));
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = `${path} L${pts[pts.length - 1].x},${h} L${pts[0].x},${h} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`grad_${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad_${color.replace("#","")})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} />
      ))}
    </svg>
  );
}

// ─── Consistency Heatmap ──────────────────────────────────────────────────────
function ConsistencyMap({ sessions }) {
  const weeks = 18;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sessionDates = new Set(sessions.map(s => s.date));

  const cells = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const weekCells = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() - (w * 7 + (6 - d)));
      const dateStr = date.toISOString().slice(0, 10);
      const isFuture = date > today;
      const trained = sessionDates.has(dateStr);
      weekCells.push({ dateStr, trained, isFuture });
    }
    cells.push(weekCells);
  }

  const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

  return (
    <div>
      <div style={{ display: "flex", gap: 3, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 4, marginTop: 0 }}>
          {DIAS.map(d => (
            <div key={d} style={{ fontSize: 8, color: "rgba(255,255,255,0.3)", width: 10, height: 10, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Barlow Condensed, sans-serif" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 3, flexWrap: "nowrap", overflowX: "auto" }}>
          {cells.map((week, wi) => (
            <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {week.map((cell, di) => (
                <div key={di} title={cell.dateStr} style={{
                  width: 10, height: 10, borderRadius: 2,
                  background: cell.isFuture ? "transparent" : cell.trained ? "#DFFF00" : "rgba(255,255,255,0.06)",
                  border: cell.isFuture ? "none" : `1px solid ${cell.trained ? "#DFFF00" : "rgba(255,255,255,0.04)"}`,
                  transition: "transform 0.1s",
                  cursor: cell.trained ? "pointer" : "default",
                }} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.04)" }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Sin entrenar</span>
        <div style={{ width: 10, height: 10, borderRadius: 2, background: "#DFFF00", marginLeft: 8 }} />
        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>Entrenado</span>
      </div>
    </div>
  );
}

// ─── Goals ────────────────────────────────────────────────────────────────────
function GoalsSection({ sessions, uid, onPickExercise, isPro = false }) {
  const [goals, setGoals] = useState([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ exercise: "", target: "", unit: "kg" });
  const [loading, setLoading] = useState(true);

  // All exercises: EXERCISE_DB + custom ones from sessions
  const exercises = useMemo(() => {
    const fromDB = EXERCISE_DB.map(e => e.name);
    const fromSessions = sessions.flatMap(s => (s.exercises || []).map(e => e.name));
    return [...new Set([...fromDB, ...fromSessions])].sort();
  }, [sessions]);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, "user_goals", uid)).then(snap => {
      if (snap.exists()) setGoals(snap.data().goals || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [uid]);

  async function saveGoals(updated) {
    setGoals(updated);
    await setDoc(doc(db, "user_goals", uid), { goals: updated });
  }

  function getCurrentValue(exercise) {
    const history = getExerciseHistory(exercise, sessions);
    if (!history.length) return 0;
    return history[history.length - 1].rm;
  }

  async function addGoal() {
    if (!form.exercise || !form.target) return;
    const current = getCurrentValue(form.exercise);
    const newGoal = {
      id: Date.now().toString(),
      exercise: form.exercise,
      target: parseFloat(form.target),
      unit: form.unit,
      current,
      createdAt: todayStr(),
    };
    await saveGoals([...goals, newGoal]);
    setForm({ exercise: "", target: "", unit: "kg" });
    setAdding(false);
  }

  async function deleteGoal(id) {
    await saveGoals(goals.filter(g => g.id !== id));
  }

  // Update current values from sessions
  const goalsWithCurrent = goals.map(g => ({
    ...g,
    current: getCurrentValue(g.exercise),
  }));

  if (loading) return <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: 20 }}>Cargando metas...</div>;

  if (!isPro) return (
    <div style={{ textAlign: "center", padding: "32px 16px" }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Metas de Progreso</div>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 24, lineHeight: 1.6 }}>
        Define metas de fuerza por ejercicio,<br />sigue tu progreso y recibe alertas<br />cuando las alcances.
      </div>
      <div style={{ background: "rgba(223,255,0,0.05)", border: "1px solid rgba(223,255,0,0.15)", borderRadius: 14, padding: "16px", marginBottom: 20, textAlign: "left" }}>
        {["📈 Metas personalizadas por ejercicio", "🔔 Alertas al alcanzar tu objetivo", "📊 Historial de progreso", "⚡ Comparación con tu 1RM actual"].map(f => (
          <div key={f} style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>{f}</div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Disponible en plan Pro · desde $4.99/mes</div>
    </div>
  );

  return (
    <div>
      {goalsWithCurrent.length === 0 && !adding && (
        <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🎯</div>
          <div style={{ fontSize: 13 }}>Sin metas aún. ¡Agrega una!</div>
        </div>
      )}

      {goalsWithCurrent.map(g => {
        const pct = Math.min((g.current / g.target) * 100, 100);
        const done = pct >= 100;
        return (
          <div key={g.id} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${done ? "rgba(223,255,0,0.4)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 800 }}>{g.exercise}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>
                  Meta: <strong style={{ color: done ? "#DFFF00" : "rgba(255,255,255,0.7)" }}>{g.target} {g.unit} 1RM</strong>
                  {" · "}Actual: <strong style={{ color: "#DFFF00" }}>{g.current} {g.unit}</strong>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {done && <span style={{ fontSize: 18 }}>🏆</span>}
                <button onClick={() => deleteGoal(g.id)} style={{ background: "none", border: "none", color: "rgba(255,100,100,0.5)", cursor: "pointer", fontSize: 16, padding: 0 }}>✕</button>
              </div>
            </div>
            {/* Progress bar */}
            <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: done ? "#DFFF00" : "linear-gradient(90deg, rgba(223,255,0,0.6), #DFFF00)", borderRadius: 6, transition: "width 0.6s ease" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>0</span>
              <span style={{ fontSize: 10, color: done ? "#DFFF00" : "rgba(255,255,255,0.5)", fontWeight: 700 }}>{Math.round(pct)}%</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{g.target} {g.unit}</span>
            </div>
          </div>
        );
      })}

      {adding ? (
        <div style={{ background: "rgba(223,255,0,0.04)", border: "1px solid rgba(223,255,0,0.2)", borderRadius: 14, padding: 16, marginBottom: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#DFFF00", marginBottom: 12, letterSpacing: 1, textTransform: "uppercase" }}>Nueva meta</div>
          <button onClick={() => onPickExercise(ex => setForm(f => ({ ...f, exercise: ex })))}
            style={{ width: "100%", marginBottom: 10, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "10px 14px", color: form.exercise ? "white" : "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{form.exercise || "Selecciona ejercicio..."}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📚</span>
          </button>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <input type="number" placeholder="Peso objetivo (1RM)" value={form.target}
              onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
              style={{ flex: 1, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "8px 12px", color: "white", fontSize: 13 }} />
            <button onClick={() => setForm(f => {
                const isKg = f.unit === "kg";
                const converted = f.target ? (isKg ? Math.round(parseFloat(f.target) * 2.205) : Math.round(parseFloat(f.target) / 2.205)) : f.target;
                return { ...f, unit: isKg ? "lb" : "kg", target: converted ? String(converted) : f.target };
              })} style={{
                background: "rgba(223,255,0,0.12)",
                border: "1px solid rgba(223,255,0,0.35)",
                color: "#DFFF00",
                borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 800, cursor: "pointer",
                minWidth: 52, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1
              }}>{form.unit}</button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={addGoal} style={{ flex: 1, background: "#DFFF00", color: "#000", border: "none", borderRadius: 8, padding: "10px", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1 }}>GUARDAR</button>
            <button onClick={() => setAdding(false)} style={{ flex: 1, background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "10px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)} style={{ width: "100%", background: "rgba(223,255,0,0.07)", border: "1px dashed rgba(223,255,0,0.3)", borderRadius: 12, padding: "12px", color: "#DFFF00", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1 }}>
          + AGREGAR META
        </button>
      )}
    </div>
  );
}

// ─── Helpers de unlock temporal ───────────────────────────────────────────────
const UNLOCK_KEY = "gym_statspro_unlock";
const UNLOCK_HOURS = 1;

function getUnlock() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return null;
    const { until } = JSON.parse(raw);
    if (Date.now() < until) return until;
    localStorage.removeItem(UNLOCK_KEY);
    return null;
  } catch { return null; }
}

function saveUnlock() {
  const until = Date.now() + UNLOCK_HOURS * 60 * 60 * 1000;
  localStorage.setItem(UNLOCK_KEY, JSON.stringify({ until }));
  return until;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
function StatsProModal({ sessions, bodyStats, user, onClose, onPickExercise, isPro = false }) {
  const [tab, setTab] = useState("radar");
  const [selectedExercise, setSelectedExercise] = useState("");
  const [radarPeriod, setRadarPeriod] = useState(30);

  // ── Guard: acceso por plan o unlock temporal ──
  const [unlockUntil, setUnlockUntil] = useState(() => getUnlock());
  const [watchingAd, setWatchingAd] = useState(false);
  const hasAccess = isPro || !!unlockUntil;

  // Cuenta regresiva visible
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!unlockUntil) return;
    const tick = () => {
      const diff = unlockUntil - Date.now();
      if (diff <= 0) { setUnlockUntil(null); localStorage.removeItem(UNLOCK_KEY); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [unlockUntil]);

  async function handleWatchAd() {
    setWatchingAd(true);
    const rewarded = await showRewardedAd();
    setWatchingAd(false);
    if (rewarded) {
      const until = saveUnlock();
      setUnlockUntil(until);
    }
  }

  // Pantalla de paywall para Free sin unlock
  if (!hasAccess) {
    return (
      <div className="overlay" onClick={onClose}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 340, textAlign: "center", padding: "32px 24px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 900, color: "#DFFF00", letterSpacing: 2, marginBottom: 6 }}>
            ESTADÍSTICAS PRO
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 24, lineHeight: 1.6 }}>
            Radar muscular, evolución de PRs, mapa de consistencia, detección de estancamiento y más.
          </div>
          <button
            onClick={handleWatchAd}
            disabled={watchingAd}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12, marginBottom: 10,
              background: watchingAd ? "rgba(255,255,255,0.1)" : "rgba(223,255,0,0.12)",
              border: "1px solid rgba(223,255,0,0.4)",
              color: watchingAd ? "rgba(255,255,255,0.4)" : "#DFFF00",
              fontWeight: 800, fontSize: 15, cursor: watchingAd ? "not-allowed" : "pointer",
              fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1,
            }}
          >
            {watchingAd ? "⏳ Cargando video..." : `▶ Ver video — acceso ${UNLOCK_HOURS}h gratis`}
          </button>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "11px 0", borderRadius: 12,
              background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.35)", fontSize: 13, cursor: "pointer",
            }}
          >
            Ahora no
          </button>
        </div>
      </div>
    );
  }

  const exercises = useMemo(() => {
    const fromDB = EXERCISE_DB.map(e => e.name);
    const fromSessions = sessions.flatMap(s => (s.exercises || []).map(e => e.name));
    return [...new Set([...fromDB, ...fromSessions])].sort();
  }, [sessions]);

  // Set default exercise
  useMemo(() => {
    if (exercises.length > 0 && !selectedExercise) setSelectedExercise(exercises[0]);
  }, [exercises]);

  const radarData = useMemo(() => getVolByMuscle(sessions, radarPeriod), [sessions, radarPeriod]);
  const exerciseHistory = useMemo(() => getExerciseHistory(selectedExercise, sessions), [selectedExercise, sessions]);
  const stagnation = useMemo(() => detectStagnation(sessions), [sessions]);

  const lineData = exerciseHistory.slice(-12).map(h => ({ value: h.rm, label: fmtDate(h.date) }));

  const tabs = [
    { id: "radar",       icon: "⬡", label: "Músculos" },
    { id: "progress",    icon: "📈", label: "Progreso" },
    { id: "consistency", icon: "📅", label: "Constancia" },
    { id: "stagnation",  icon: "⚠️", label: "Alertas" },
    { id: "goals",       icon: "🎯", label: "Metas" },
    { id: "prediction",  icon: "🔮", label: "Predicción" },
  ];

  // Stats summary
  const totalSessions = sessions.length;
  const last30 = sessions.filter(s => { const d = new Date(s.date + "T00:00:00"); const ago = new Date(); ago.setDate(ago.getDate() - 30); return d >= ago; }).length;
  const totalVolume = sessions.reduce((acc, s) => acc + (s.exercises || []).reduce((a, ex) =>
    a + (ex.sets?.length ? ex.sets.reduce((sum, st) => sum + (parseFloat(st.weight) || 0) * (parseFloat(st.reps) || 1), 0) : (parseFloat(ex.weight) || 0) * (parseFloat(ex.reps) || 1)), 0), 0);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header */}
        <div className="modal-header" style={{ borderBottom: "1px solid rgba(223,255,0,0.15)", paddingBottom: 14, marginBottom: 0 }}>
          <div>
            <h3 className="modal-title" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ background: "rgba(223,255,0,0.12)", border: "1px solid rgba(223,255,0,0.3)", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 800, color: "#DFFF00", letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>PRO</span>
              Estadísticas Avanzadas
            </h3>
            {!isPro && unlockUntil && timeLeft && (
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                ⏱ Acceso temporal: <span style={{ color: "#DFFF00", fontWeight: 700 }}>{timeLeft}</span>
              </div>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, padding: "14px 0 10px" }}>
          {[
            { icon: "🏋️", label: "Total sesiones", value: totalSessions },
            { icon: "📅", label: "Últimos 30 días", value: `${last30} sesiones` },
            { icon: "⚡", label: "Volumen total", value: `${(totalVolume / 1000).toFixed(1)}t` },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 18, marginBottom: 2 }}>{s.icon}</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 800, color: "#DFFF00" }}>{s.value}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex: 1, background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? "#DFFF00" : "transparent"}`,
              color: tab === t.id ? "#DFFF00" : "rgba(255,255,255,0.35)",
              padding: "8px 2px 10px", cursor: "pointer", fontSize: 9, fontWeight: 800,
              letterSpacing: 0.5, textTransform: "uppercase", fontFamily: "Barlow Condensed, sans-serif",
              transition: "all 0.2s", display: "flex", flexDirection: "column", alignItems: "center", gap: 3
            }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── RADAR ── */}
        {tab === "radar" && (
          <div>
            <div style={{ display: "flex", gap: 6, marginBottom: 16, justifyContent: "center" }}>
              {[
                { v: 7, l: "7 días" },
                { v: 30, l: "30 días" },
                { v: 90, l: "90 días" },
              ].map(p => (
                <button key={p.v} onClick={() => setRadarPeriod(p.v)} style={{
                  background: radarPeriod === p.v ? "rgba(223,255,0,0.12)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${radarPeriod === p.v ? "rgba(223,255,0,0.4)" : "rgba(255,255,255,0.08)"}`,
                  color: radarPeriod === p.v ? "#DFFF00" : "rgba(255,255,255,0.4)",
                  borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer"
                }}>{p.l}</button>
              ))}
            </div>

            {Object.keys(radarData).length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>Sin datos en este período</div>
            ) : (
              <>
                <RadarChart data={radarData} />
                {/* Muscle breakdown */}
                <div style={{ marginTop: 16 }}>
                  {Object.entries(radarData).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([muscle, vol]) => {
                    const total = Object.values(radarData).reduce((a, b) => a + b, 1);
                    const pct = Math.round((vol / total) * 100);
                    return (
                      <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                        <div style={{ width: 80, fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>{muscle}</div>
                        <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: "#DFFF00", borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 32, fontSize: 11, color: "#DFFF00", fontWeight: 800, textAlign: "right" }}>{pct}%</div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── PROGRESS ── */}
        {tab === "progress" && (
          <div>
            <button onClick={() => onPickExercise(ex => setSelectedExercise(ex))}
              style={{ width: "100%", marginBottom: 12, background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "10px 14px", color: selectedExercise ? "white" : "rgba(255,255,255,0.4)", fontSize: 13, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{selectedExercise || "Selecciona ejercicio..."}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>📚</span>
            </button>

            {lineData.length < 2 ? (
              <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                Necesitas al menos 2 registros de "{selectedExercise}" para ver la gráfica
              </div>
            ) : (
              <>
                <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "16px 12px", marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 12 }}>Evolución 1RM estimado</div>
                  <LineChart data={lineData} color="#DFFF00" height={100} />
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{lineData[0]?.label}</span>
                    <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)" }}>{lineData[lineData.length - 1]?.label}</span>
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
                  {[
                    { label: "Máximo 1RM", value: `${Math.max(...lineData.map(d => d.value))} kg` },
                    { label: "Actual", value: `${lineData[lineData.length - 1]?.value} kg` },
                    { label: "Progreso", value: `${lineData[lineData.length - 1]?.value - lineData[0]?.value > 0 ? "+" : ""}${lineData[lineData.length - 1]?.value - lineData[0]?.value} kg` },
                  ].map(s => (
                    <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 800, color: "#DFFF00" }}>{s.value}</div>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* History list */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 10 }}>Historial</div>
                  {exerciseHistory.slice(-8).reverse().map((h, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 }}>
                      <span style={{ color: "rgba(255,255,255,0.5)" }}>{fmtDate(h.date)}</span>
                      <span>{h.weight} kg × {h.reps} reps</span>
                      <span style={{ fontWeight: 800, color: "#DFFF00" }}>{h.rm} kg 1RM</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── CONSISTENCY ── */}
        {tab === "consistency" && (
          <div>

            {/* ── ESTA SEMANA VS ANTERIOR ── */}
            {(() => {
              const now = new Date(); now.setHours(0,0,0,0);
              // Lunes de esta semana
              const thisMonday = new Date(now);
              thisMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
              // Lunes semana anterior
              const lastMonday = new Date(thisMonday);
              lastMonday.setDate(thisMonday.getDate() - 7);

              const thisWeekSessions = sessions.filter(s => {
                const d = new Date(s.date + "T00:00:00");
                return d >= thisMonday && d <= now;
              });
              const lastWeekSessions = sessions.filter(s => {
                const d = new Date(s.date + "T00:00:00");
                return d >= lastMonday && d < thisMonday;
              });

              const calcVol = (list) => list.reduce((acc, s) =>
                acc + (s.exercises||[]).reduce((a, ex) =>
                  a + (ex.sets?.length ? ex.sets.reduce((sum, st) => sum + (parseFloat(st.weight)||0)*(parseFloat(st.reps)||1), 0) : (parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1)), 0), 0);

              const thisVol = calcVol(thisWeekSessions);
              const lastVol = calcVol(lastWeekSessions);
              const volDiff = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;
              const sessDiff = thisWeekSessions.length - lastWeekSessions.length;

              // PRs esta semana
              const thisPRs = [];
              thisWeekSessions.forEach(s => {
                (s.exercises||[]).forEach(ex => {
                  const w = ex.sets?.length>0 ? Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
                  const prevBest = sessions
                    .filter(ps => new Date(ps.date+"T00:00:00") < thisMonday)
                    .flatMap(ps => (ps.exercises||[]).filter(pe => pe.name === ex.name))
                    .reduce((b, pe) => Math.max(b, parseFloat(pe.weight)||0), 0);
                  if (w > prevBest && w > 0) thisPRs.push(ex.name);
                });
              });

              const metrics = [
                {
                  label: "Sesiones",
                  this: thisWeekSessions.length,
                  last: lastWeekSessions.length,
                  diff: sessDiff,
                  fmt: v => v,
                  unit: "",
                },
                {
                  label: "Volumen",
                  this: thisVol,
                  last: lastVol,
                  diff: volDiff,
                  fmt: v => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${Math.round(v)}kg`,
                  unit: volDiff !== null ? `${volDiff > 0 ? "+" : ""}${volDiff}%` : "—",
                  isPercent: true,
                },
              ];

              return (
                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 12 }}>Esta semana vs anterior</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    {metrics.map(m => {
                      const up = m.isPercent ? (m.diff > 0) : (m.diff > 0);
                      const neutral = m.isPercent ? m.diff === 0 || m.diff === null : m.diff === 0;
                      const color = neutral ? "rgba(255,255,255,0.4)" : up ? "#22c55e" : "#f97316";
                      return (
                        <div key={m.label} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", marginBottom: 8 }}>{m.label}</div>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 900, color: "#DFFF00", lineHeight: 1 }}>{m.fmt(m.this)}</span>
                            {!neutral && (
                              <span style={{ fontSize: 13, fontWeight: 800, color }}>{up ? "▲" : "▼"} {m.isPercent ? `${Math.abs(m.diff)}%` : Math.abs(m.diff)}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)" }}>vs {m.fmt(m.last)} semana anterior</div>
                        </div>
                      );
                    })}
                  </div>
                  {thisPRs.length > 0 && (
                    <div style={{ background: "rgba(223,255,0,0.06)", border: "1px solid rgba(223,255,0,0.2)", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                      🏆 <strong style={{ color: "#DFFF00" }}>{thisPRs.length} PR{thisPRs.length > 1 ? "s" : ""}</strong> esta semana: {thisPRs.slice(0, 3).join(", ")}{thisPRs.length > 3 ? ` +${thisPRs.length - 3} más` : ""}
                    </div>
                  )}
                  {thisWeekSessions.length === 0 && (
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "8px 0" }}>Sin sesiones esta semana todavía.</div>
                  )}
                </div>
              );
            })()}

            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 16 }}>Últimas 18 semanas</div>
            <div style={{ overflowX: "auto" }}>
              <ConsistencyMap sessions={sessions} />
            </div>

            {/* Monthly breakdown */}
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "rgba(255,255,255,0.3)", textTransform: "uppercase", marginBottom: 12 }}>Por mes</div>
              {Array.from({ length: 6 }, (_, i) => {
                const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
                const y = d.getFullYear(), m = d.getMonth();
                const count = sessions.filter(s => { const sd = new Date(s.date + "T00:00:00"); return sd.getFullYear() === y && sd.getMonth() === m; }).length;
                const daysInMonth = new Date(y, m + 1, 0).getDate();
                const pct = Math.round((count / 20) * 100); // 20 = ideal sessions/month
                const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 36, fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>{months[m]}</div>
                    <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 8, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: count >= 12 ? "#DFFF00" : count >= 6 ? "#3b82f6" : "#f97316", borderRadius: 4 }} />
                    </div>
                    <div style={{ width: 60, fontSize: 12, color: "rgba(255,255,255,0.5)", textAlign: "right" }}>{count} sesiones</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── STAGNATION ── */}
        {tab === "stagnation" && (
          <div>
            {stagnation.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>¡Sin estancamientos!</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Tus ejercicios están progresando bien.</div>
              </div>
            ) : (
              <>
                <div style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>
                  ⚠️ Llevas varias sesiones sin mejorar en estos ejercicios. Considera cambiar la técnica, aumentar volumen o tomar un deload.
                </div>
                {stagnation.map((s, i) => (
                  <div key={i} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 800 }}>{s.name}</div>
                      <div style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 6, padding: "2px 8px", fontSize: 11, color: "#f97316", fontWeight: 700 }}>ESTANCADO</div>
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                      Últimas {s.sessions} sesiones sin cambio significativo · 1RM: <strong style={{ color: "rgba(255,255,255,0.7)" }}>{s.rm} kg</strong>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* ── GOALS ── */}
        {tab === "goals" && (
          <GoalsSection sessions={sessions} uid={user?.uid} onPickExercise={onPickExercise} isPro={isPro} />
        )}

        {/* ── PREDICCIÓN ── */}
        {tab === "prediction" && (
          <ProgressPrediction sessions={sessions} />
        )}

      </div>
    </div>
  );
}

export default StatsProModal;