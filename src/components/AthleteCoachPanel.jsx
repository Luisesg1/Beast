import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc, serverTimestamp, collection, getDocs, getDocsFromServer, deleteDoc, query, where } from "firebase/firestore";
import { db, auth } from "../firebase";
import { getAthleteRoutines } from "./CoachModal";

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const colors = ["#e8ff00","#22c55e","#f97316","#ffffff","#a3e635","#facc15","#34d399","#fb923c"];

  function burst(cx, cy, count, speedMult) {
    return Array.from({length: count}, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 8) * speedMult;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 4,
        r: 3 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        shape: ["rect","circle","triangle"][Math.floor(Math.random()*3)],
        alpha: 1, gravity: 0.15 + Math.random() * 0.1, trail: [],
      };
    });
  }

  let particles = [];
  particles.push(...burst(W/2, H*0.45, 80, 1.4));
  setTimeout(() => particles.push(...burst(W*0.2, H*0.5, 40, 1.1)), 200);
  setTimeout(() => particles.push(...burst(W*0.8, H*0.5, 40, 1.1)), 350);
  setTimeout(() => particles.push(...burst(W/2, H*0.3, 50, 1.6)), 500);

  let frame;
  const startTime = performance.now();
  const duration = 3500;

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    const elapsed = ts - startTime;
    particles.forEach(p => {
      p.trail.push({x: p.x, y: p.y});
      if (p.trail.length > 5) p.trail.shift();
      p.vx *= 0.98; p.vy += p.gravity; p.x += p.vx; p.y += p.vy;
      p.angle += p.spin;
      p.alpha = Math.max(0, 1 - elapsed / duration * 1.3);
      if (p.trail.length > 1) {
        ctx.save(); ctx.globalAlpha = p.alpha * 0.3; ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r * 0.5; ctx.beginPath();
        p.trail.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      if (p.shape === "rect") ctx.fillRect(-p.r, -p.r*0.5, p.r*2, p.r);
      else if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0,-p.r); ctx.lineTo(p.r*0.866,p.r*0.5); ctx.lineTo(-p.r*0.866,p.r*0.5); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    });
    particles = particles.filter(p => p.y < H + 50 && p.alpha > 0.01);
    if (elapsed < duration) frame = requestAnimationFrame(draw);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }
  frame = requestAnimationFrame(draw);
}

// ─── Helpers locales ──────────────────────────────────────────────────────────
const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayStr = () => new Date().toISOString().slice(0, 10);
const load = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const numDot = (v, max = 9999) => { const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); const n = parseFloat(s); if (isNaN(n) || n < 0) return ""; return n > max ? String(max) : s; };
const numWeight = (v) => numDot(v, 500);
const numReps   = (v) => numDot(v, 100);
const DAYS_ES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const LIVE_DRAFT_KEY = "gym_live_draft";

// ─── Firebase helpers ─────────────────────────────────────────────────────────
async function joinCoachByCode(athleteUid, athleteName, athleteEmail, code) {
  try {
    const q = query(collection(db, "coaches"), where("code", "==", code));
    const coachesSnap = await getDocs(q);
    if (coachesSnap.empty) return { ok: false, msg: "Código de coach no encontrado" };
    const coachDoc = coachesSnap.docs[0];
    const coachData = coachDoc.data();

    await setDoc(doc(db, "coaches", coachData.uid), {
      athletes: { [athleteUid]: { email: athleteEmail, name: athleteName, uid: athleteUid, addedAt: todayStr() } }
    }, { merge: true });

    await setDoc(doc(db, "athlete_coaches", athleteUid, "coaches", coachData.uid), {
      coachUid: coachData.uid, coachName: coachData.name, coachEmail: coachData.email, addedAt: todayStr()
    });

    return { ok: true, coachData };
  } catch(e) { return { ok: false, msg: "Error al conectar con coach" }; }
}

async function getMyCoaches(athleteUid) {
  try {
    const snap = await getDocsFromServer(collection(db, "athlete_coaches", athleteUid, "coaches"));
    return snap.docs.map(d => d.data());
  } catch(e) { return []; }
}

async function getFullRoutine(coachUid, routineId) {
  try {
    if (!coachUid || !routineId) return null;
    const snap = await getDoc(doc(db, "coaches", coachUid, "routines", routineId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data(), coachUid, routineId };
  } catch(e) {
    console.error("[getFullRoutine] ERROR:", e.code, e.message, { coachUid, routineId });
    return null;
  }
}

async function markRoutineCompleted(athleteUid, routineId) {
  if (!athleteUid || !routineId) return false;
  try {
    await setDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId),
      { completed: true, completedAt: todayStr() }, { merge: true });
    return true;
  } catch(e) { return false; }
}

// ─── AthleteWorkoutRunner ─────────────────────────────────────────────────────
function AthleteWorkoutRunner({ routine, onClose, onSave, ExerciseGif }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [currentEx, setCurrentEx] = useState(0);
  const [restTimer, setRestTimer] = useState(null);
  const [exData, setExData] = useState(
    (routine.exercises || []).map(ex => ({
      ...ex,
      restSecs: ex.restSecs || null,
      sets: ex.sets?.length
        ? ex.sets.map(s => ({ ...s, id: s.id || uid(), done: false }))
        : Array.from({ length: parseInt(ex.series) || 3 }, () => ({ id: uid(), weight: ex.weight || "", reps: ex.reps || "", done: false }))
    }))
  );
  const mainRef = useRef();
  const restRef = useRef();

  useEffect(() => {
    if (running) { mainRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else clearInterval(mainRef.current);
    return () => clearInterval(mainRef.current);
  }, [running]);

  useEffect(() => {
    if (restTimer && restTimer.left > 0) {
      restRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (!prev || prev.left <= 1) {
            clearInterval(restRef.current);
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              [0, 0.2, 0.4].forEach((t, i) => {
                const osc = ctx.createOscillator(), gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = i === 2 ? 880 : 660; osc.type = "sine";
                gain.gain.setValueAtTime(0.35, ctx.currentTime + t);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
                osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.18);
              });
            } catch(e) {}
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e) {}
            try {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("¡Tiempo de descanso terminado! 💪", {
                  body: "Listo para la siguiente serie.",
                  tag: "rest-timer", renotify: true,
                });
              }
            } catch(e) {}
            return null;
          }
          return { ...prev, left: prev.left - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer?.total]);

  const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const totalSets = exData.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const ex = exData[currentEx];
  const defaultRest = load("gym_default_rest", 90);

  const REST_OPTS = [
    { label: "1M", secs: 60 },
    { label: "1.5M", secs: 90 },
    { label: "2M", secs: 120 },
    { label: "3M", secs: 180 },
  ];

  function toggleSet(exIdx, setIdx) {
    const wasDone = exData[exIdx]?.sets[setIdx]?.done;
    setExData(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done })
    }));
    if (!wasDone) {
      const exRestSecs = exData[exIdx]?.restSecs ?? defaultRest;
      setRestTimer(prev => prev ? prev : null);
      setTimeout(() => startRest(exRestSecs), 50);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }

  function updateSet(exIdx, setIdx, field, val) {
    setExData(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val })
    }));
  }

  function addSet(exIdx) {
    setExData(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: [...e.sets, { id: uid(), weight: e.sets[e.sets.length-1]?.weight || "", reps: e.sets[e.sets.length-1]?.reps || "", done: false }]
    }));
  }

  function removeSet(exIdx) {
    setExData(prev => prev.map((e, i) => i !== exIdx || e.sets.length <= 1 ? e : {
      ...e, sets: e.sets.slice(0, -1)
    }));
  }

  function startRest(secs) {
    clearInterval(restRef.current);
    setRestTimer({ total: secs, left: secs });
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 3000, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <button onClick={() => {
          const hasDone = exData.some(ex => ex.sets.some(s => s.done));
          if (hasDone) {
            if (!window.confirm("¿Salir del entrenamiento? Perderás el progreso no guardado.")) return;
          }
          onClose();
        }} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12, display:"flex", alignItems:"center", gap:4, fontWeight: 600 }}>← Salir</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800 }}>⚡ {routine.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{doneSets}/{totalSets} series completadas</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{fmt(elapsed)}</div>
          <button onClick={() => setRunning(r => !r)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>{running ? "⏸" : "▶"}</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--border)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${totalSets > 0 ? (doneSets/totalSets)*100 : 0}%`, transition: "width 0.4s" }} />
      </div>

      {/* Exercise tabs */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", overflowX: "auto", flexShrink: 0 }}>
        {exData.map((e, i) => {
          const done = e.sets.every(s => s.done) && e.sets.length > 0;
          return (
            <button key={i} onClick={() => setCurrentEx(i)} style={{
              background: currentEx === i ? "var(--accent)" : done ? "rgba(232,255,0,0.08)" : "var(--card)",
              border: `1px solid ${currentEx === i ? "var(--accent)" : done ? "rgba(232,255,0,0.3)" : "var(--border)"}`,
              color: currentEx === i ? "#0a0a0a" : done ? "var(--accent)" : "var(--text-muted)",
              borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", flexShrink: 0, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif"
            }}>
              {done ? "✓ " : ""}{e.name}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 16px" }}>
        {ex && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>

            {/* GIF + nombre */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
              <div style={{ background: "var(--card)", borderRadius: 8, padding: 4, border: "1px solid var(--border)" }}>
                <ExerciseGif exName={ex.name} size={112} style={{ display:"block", borderRadius:6 }} />
              </div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 900, marginTop: 10, textAlign: "center", color: "var(--text)", letterSpacing: 1, textTransform: "uppercase" }}>{ex.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{doneSets}/{totalSets} series · {ex.sets.filter(s=>s.done).length}/{ex.sets.length} de este ejercicio</div>
              {ex.comment && (
                <div style={{ fontSize: 13, fontStyle: "italic", marginTop: 8, padding: "6px 12px", background: "rgba(232,255,0,0.07)", borderRadius: 8, border: "1px solid rgba(232,255,0,0.2)", textAlign: "center" }}>
                  💬 <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>Nota del coach:</span> <span style={{ color: "var(--accent)" }}>{ex.comment}</span>
                </div>
              )}
            </div>

            {/* Tabla series */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 52px", gap: 0, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800, letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>#</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800, letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>PESO (KG)</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800, letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>REPS</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800 }}>✓</div>
              </div>
              {ex.sets.map((s, j) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 52px", gap: 8, padding: "8px 12px", alignItems: "center", background: s.done ? "rgba(232,255,0,0.05)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ textAlign: "center", fontWeight: 800, fontSize: 14, color: s.done ? "var(--accent)" : "var(--text-muted)" }}>S{j+1}</div>
                  <input value={s.weight} onChange={e => updateSet(currentEx, j, "weight", numWeight(e.target.value))} inputMode="decimal"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 4px", color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", width: "100%" }} placeholder="0" />
                  <input value={s.reps} onChange={e => updateSet(currentEx, j, "reps", numReps(e.target.value))} inputMode="decimal"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 4px", color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", width: "100%" }} placeholder="0" />
                  <button onClick={() => toggleSet(currentEx, j)} style={{ width: 44, height: 40, background: s.done ? "var(--accent)" : "var(--input-bg)", border: `2px solid ${s.done ? "var(--accent)" : "var(--border)"}`, borderRadius: 4, cursor: "pointer", fontSize: 18, margin: "0 auto", color: s.done ? "#0a0a0a" : "var(--text-muted)" }}>
                    {s.done ? "✓" : "○"}
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 0 }}>
                <button onClick={() => addSet(currentEx)} style={{ flex: 1, background: "none", border: "none", borderTop: "1px dashed var(--border)", color: "var(--text-muted)", padding: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Añadir serie</button>
                <button onClick={() => removeSet(currentEx)} style={{ background: "none", border: "none", borderTop: "1px dashed var(--border)", borderLeft: "1px solid var(--border)", color: "#ef4444", padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>− Quitar</button>
              </div>
            </div>

            {/* Timer de descanso */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", marginBottom: 16 }}>
              {restTimer ? (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>DESCANSANDO</div>
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ height: "100%", background: "var(--accent)", borderRadius: 10, width: `${(restTimer.left / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button onClick={() => setRestTimer(t => ({ ...t, left: Math.max(0, t.left - 15), total: Math.max(15, t.total - 15) }))}
                      style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>−15s</button>
                    <div style={{ flex: 1, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 36, fontWeight: 800, color: "var(--accent)" }}>
                      {restTimer.left === 0 ? "¡Listo!" : fmt(restTimer.left)}
                    </div>
                    <button onClick={() => setRestTimer(t => ({ ...t, left: t.left + 15, total: t.total + 15 }))}
                      style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+15s</button>
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {REST_OPTS.map(o => (
                      <button key={o.label} onClick={() => startRest(o.secs)}
                        style={{ background: restTimer.total === o.secs ? "var(--accent)" : "var(--input-bg)", border: `1px solid ${restTimer.total === o.secs ? "var(--accent)" : "var(--border)"}`, color: restTimer.total === o.secs ? "#0a0a0a" : "var(--text-muted)", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        {o.label}
                      </button>
                    ))}
                    <button onClick={() => setRestTimer(null)}
                      style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>
                      ✕ Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 10, fontWeight: 800, letterSpacing: 4, fontFamily: "Barlow Condensed, sans-serif", textTransform:"uppercase" }}>DESCANSO</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {REST_OPTS.map(o => (
                      <button key={o.label} onClick={() => startRest(o.secs)} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 3, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nav ejercicios */}
            <div style={{ display: "flex", gap: 10 }}>
              {currentEx > 0 && <button onClick={() => setCurrentEx(i => i-1)} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Anterior</button>}
              {currentEx < exData.length - 1 && <button onClick={() => setCurrentEx(i => i+1)} style={{ flex: 1, background: "var(--accent)", border: "none", color: "#0a0a0a", borderRadius: 4, padding: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", boxShadow: "0 0 20px rgba(232,255,0,0.25)" }}>SIGUIENTE →</button>}
              {currentEx === exData.length - 1 && <button onClick={() => { setRunning(false); try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {} fireConfetti(); onSave(exData, elapsed); }} style={{ flex: 1, background: "var(--accent)", border: "none", color: "#0a0a0a", borderRadius: 4, padding: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", boxShadow: "0 0 24px rgba(232,255,0,0.2)" }}>FINALIZAR →</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AthleteCoachPanel ────────────────────────────────────────────────────────
function AthleteCoachPanel({ user, onClose, initialRoutine = null, ExerciseGif, sessions = [] }) {
  const [tab, setTab] = useState("routines");
  const [coaches, setCoaches] = useState([]);
  const [assignedRoutines, setAssignedRoutines] = useState([]);
  const [fullRoutines, setFullRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [pendingInitialDocId] = useState(initialRoutine?._docId || null);
  const [workoutSummary, setWorkoutSummary] = useState(null);
  const [newRoutineCount, setNewRoutineCount] = useState(0);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [coachProfileData, setCoachProfileData] = useState(null);
  const [loadingCoachProfile, setLoadingCoachProfile] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [myCoaches, myRoutines] = await Promise.all([
      getMyCoaches(user.uid),
      getAthleteRoutines(user.uid),
    ]);
    const enrichedCoaches = await Promise.all(myCoaches.map(async (c) => {
      try {
        const coachSnap = await getDoc(doc(db, "coaches", c.coachUid));
        const coachData = coachSnap.exists() ? coachSnap.data() : {};
        return { ...c, photoURL: coachData.photoURL || c.photoURL || null };
      } catch(e) { return c; }
    }));
    setCoaches(enrichedCoaches);
    setAssignedRoutines(myRoutines);
    const full = await Promise.all(
      myRoutines
        .filter(r => r.coachUid && r.routineId)
        .map(r =>
          getFullRoutine(r.coachUid, r.routineId).then(routine =>
            routine ? { ...routine, _docId: r._docId, routineId: r.routineId, coachUid: r.coachUid, dayOfWeek: r.dayOfWeek ?? -1 } : null
          ).catch(() => null)
        )
    );
    const validFull = full.filter(Boolean).sort((a, b) => {
      const da = a.dayOfWeek >= 0 ? a.dayOfWeek : 999;
      const db = b.dayOfWeek >= 0 ? b.dayOfWeek : 999;
      return da - db;
    });
    setFullRoutines(validFull);
    const lastSeen = parseInt(localStorage.getItem(`lastSeenRoutines_${user.uid}`) || "0");
    setNewRoutineCount(Math.max(0, validFull.length - lastSeen));
    setLoading(false);
    // If opened from banner, use fresh routine data (with coach comments)
    if (pendingInitialDocId) {
      const fresh = validFull.find(r => r._docId === pendingInitialDocId);
      if (fresh) setActiveWorkout(fresh);
      else if (initialRoutine) setActiveWorkout(initialRoutine); // fallback
    }
  }

  async function loadCoachProfile(coachUid) {
    setLoadingCoachProfile(true);
    try {
      const [coachSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "coaches", coachUid)),
        getDoc(doc(db, "users", coachUid)),
      ]);
      const coachData = coachSnap.exists() ? coachSnap.data() : {};
      const userData = userSnap.exists() ? userSnap.data() : {};
      setCoachProfileData({ ...coachData, ...userData, uid: coachUid });
    } catch(e) { setCoachProfileData(null); }
    setLoadingCoachProfile(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setJoinMsg("Ingresa un código"); return; }
    if (!user.isGuest && auth.currentUser && !auth.currentUser.emailVerified) {
      setJoinMsg("⚠️ Verifica tu email antes de conectarte con un coach. Revisa tu bandeja de entrada.");
      return;
    }
    setJoining(true);
    const result = await joinCoachByCode(user.uid, user.name, user.email, joinCode.trim().toUpperCase());
    setJoining(false);
    if (result.ok) { setJoinMsg("✅ Conectado con tu coach!"); loadData(); }
    else setJoinMsg(`❌ ${result.msg}`);
  }

  if (loading) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign:"center", padding:40 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
        <div style={{ color:"var(--text-muted)" }}>Cargando...</div>
      </div>
    </div>
  );

  if (activeWorkout) {
    return (
      <AthleteWorkoutRunner
        routine={activeWorkout}
        onClose={() => setActiveWorkout(null)}
        ExerciseGif={ExerciseGif}
        onSave={async (exercises, elapsed) => {
          const snap = await getDoc(doc(db, "sessions", user.uid));
          const existing = snap.exists() ? (snap.data().list || []) : [];
          const alreadyToday = existing.some(s => s.date === todayStr() && s.workout === activeWorkout.name);
          if (alreadyToday) {
            if (!window.confirm(`Ya entrenaste "${activeWorkout.name}" hoy. ¿Quieres guardarlo de todas formas?`)) return;
          }

          setWorkoutSummary({ exercises, elapsed, routineName: activeWorkout.name });

          const newSession = {
            id: uid(),
            date: todayStr(),
            workout: activeWorkout.name,
            notes: "",
            exercises,
            unit: "kg",
            coachRoutineDocId: activeWorkout._docId || null,
          };

          try {
            await setDoc(doc(db, "sessions", user.uid), {
              list: [newSession, ...existing],
              updatedAt: serverTimestamp()
            });
          } catch(e) {
            console.error("❌ Error guardando sesión:", e);
          }

          await markRoutineCompleted(user.uid, activeWorkout._docId || activeWorkout.routineId || activeWorkout.id);
          const updated = await getAthleteRoutines(user.uid);
          setAssignedRoutines(updated);
          setActiveWorkout(null);
        }}
      />
    );
  }

  if (workoutSummary) {
    const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
    const totalVol = workoutSummary.exercises.reduce((acc, ex) =>
      acc + (ex.sets||[]).reduce((a, s) => a + (parseFloat(s.weight)||0) * (parseFloat(s.reps)||1), 0), 0);
    const totalSeries = workoutSummary.exercises.reduce((acc, ex) => acc + (ex.sets||[]).length, 0);

    return (
      <div style={{ position:"fixed", inset:0, background:"var(--bg)", zIndex:3000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
        <div style={{ fontSize:64, marginBottom:8 }}>🏆</div>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900, letterSpacing:1, marginBottom:4 }}>
          ¡Rutina completada!
        </div>
        <div style={{ fontSize:14, color:"var(--text-muted)", marginBottom:28 }}>{workoutSummary.routineName}</div>

        <div style={{ display:"flex", gap:12, marginBottom:28, flexWrap:"wrap", justifyContent:"center" }}>
          {[
            { icon:"⏱️", label:"Tiempo", value: fmt(workoutSummary.elapsed) },
            { icon:"🏋️", label:"Ejercicios", value: workoutSummary.exercises.length },
            { icon:"🔢", label:"Series", value: totalSeries },
            { icon:"📦", label:"Volumen", value: `${Math.round(totalVol)}kg` },
          ].map(s => (
            <div key={s.label} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:14, padding:"16px 20px", textAlign:"center", minWidth:90 }}>
              <div style={{ fontSize:24 }}>{s.icon}</div>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800, color:"var(--accent)" }}>{s.value}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ width:"100%", maxWidth:480, maxHeight:260, overflowY:"auto", marginBottom:24 }}>
          {workoutSummary.exercises.map((ex, i) => (
            <div key={i} style={{ padding:"12px 16px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>✓ {ex.name}</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {(ex.sets||[]).map((s, j) => (
                  <span key={j} style={{ fontSize:12, padding:"3px 10px", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:8, color:"#22c55e", fontWeight:600 }}>
                    S{j+1}: {s.weight||"—"}kg × {s.reps||"—"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-primary" style={{ fontSize:18, padding:"14px 40px" }}
          onClick={() => setWorkoutSummary(null)}>
          Volver a mis rutinas
        </button>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🎽 Mi Coach</h3>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={loadData} title="Actualizar" style={{ background:"none", border:"1px solid var(--border)", color:"var(--text-muted)", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>↻</button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="tab-row" style={{ marginBottom:20 }}>
          <button className={`tab-btn ${tab==="routines"?"active":""}`} onClick={()=>{ setTab("routines"); setNewRoutineCount(0); localStorage.setItem(`lastSeenRoutines_${user.uid}`, String(fullRoutines.length)); }} style={{ position:"relative" }}>
            📋 Rutinas
            {newRoutineCount > 0 && <span style={{ position:"absolute", top:-4, right:-4, background:"#ef4444", color:"white", borderRadius:"50%", width:16, height:16, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{newRoutineCount}</span>}
          </button>
          <button className={`tab-btn ${tab==="coaches"?"active":""}`} onClick={()=>setTab("coaches")}>👥 Mis coaches</button>
          <button className={`tab-btn ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>🔗 Unirme</button>
        </div>

        {/* Modal perfil coach */}
        {selectedCoach && (
          <div className="overlay" onClick={() => { setSelectedCoach(null); setCoachProfileData(null); }} style={{ zIndex:1100 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:360 }}>
              <div className="modal-header">
                <h3 className="modal-title">Perfil del Coach</h3>
                <button className="close-btn" onClick={() => { setSelectedCoach(null); setCoachProfileData(null); }}>✕</button>
              </div>
              {loadingCoachProfile ? (
                <div style={{ textAlign:"center", padding:30, color:"var(--text-muted)" }}>⏳ Cargando...</div>
              ) : coachProfileData ? (
                <div style={{ textAlign:"center", padding:"10px 0 20px" }}>
                  {coachProfileData.photoURL ? (
                    <img src={coachProfileData.photoURL} alt="coach" style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover", marginBottom:12, border:"2px solid var(--accent)" }} />
                  ) : (
                    <div style={{ width:72, height:72, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:28, color:"white", margin:"0 auto 12px" }}>
                      {coachProfileData.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>{coachProfileData.name || "Coach"}</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:8 }}>{coachProfileData.email || selectedCoach.coachEmail}</div>
                  {coachProfileData.specialty && <div style={{ fontSize:12, color:"var(--accent)", fontWeight:700, marginBottom:12 }}>💪 {coachProfileData.specialty}</div>}
                  {coachProfileData.bio && (
                    <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.6, background:"var(--input-bg)", borderRadius:10, padding:"10px 14px", marginBottom:12, textAlign:"left" }}>
                      {coachProfileData.bio}
                    </div>
                  )}
                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                    {Object.keys(coachProfileData.athletes || {}).length} atletas activos
                  </div>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:30, color:"var(--text-muted)" }}>No se pudo cargar el perfil.</div>
              )}
            </div>
          </div>
        )}

        {tab === "routines" && (
          <div>
            {fullRoutines.length === 0 ? (
              <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <p style={{ fontSize:14 }}>Aún no tienes rutinas asignadas.<br/>Únete a un coach con su código.</p>
              </div>
            ) : fullRoutines.map(r => {
              const assigned = assignedRoutines.find(ar => ar._docId === r._docId);
              const todayDow = (new Date().getDay() + 6) % 7;
              const isToday = r.dayOfWeek >= 0 && r.dayOfWeek === todayDow;
              const dayLabel = r.dayOfWeek >= 0 ? DAYS_ES[r.dayOfWeek] : null;
              const todayDateStr = new Date().toISOString().slice(0,10);
              const routineName = r.name || r.routineName || "";
              const doneToday = (sessions||[]).some(s => s.date === todayDateStr &&
                (s.coachRoutineDocId ? s.coachRoutineDocId === r._docId : s.workout === routineName && r.dayOfWeek === todayDow));
              const isCompleted = assigned?.completed || doneToday;

              // Estilos según estado
              let cardBorder, cardBg, cardOpacity;
              if (isCompleted) {
                cardBorder = "1px solid rgba(34,197,94,0.4)";
                cardBg = "rgba(34,197,94,0.05)";
                cardOpacity = 0.7;
              } else if (isToday) {
                cardBorder = "2px solid var(--accent)";
                cardBg = "rgba(232,255,0,0.04)";
                cardOpacity = 1;
              } else {
                cardBorder = "1px solid var(--border)";
                cardBg = "var(--input-bg)";
                cardOpacity = 0.55;
              }

              return (
                <div key={r._docId} style={{ padding:"14px 16px", background:cardBg, border:cardBorder, borderRadius:12, marginBottom:10, opacity:cardOpacity, transition:"opacity 0.2s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontWeight:700, fontSize:15 }}>{r.name}</div>
                        {isToday && !isCompleted && (
                          <span style={{ fontSize:9, fontWeight:900, letterSpacing:1.5, textTransform:"uppercase",
                            background:"var(--accent)", color:"#0a0a0a", borderRadius:4, padding:"2px 6px" }}>HOY</span>
                        )}
                      </div>
                      {dayLabel && (
                        <div style={{ fontSize:11, color: isToday ? "var(--accent)" : "var(--text-muted)", marginTop:3 }}>
                          📅 {dayLabel}
                        </div>
                      )}
                    </div>
                    {isCompleted ? (
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>✅ Completada</span>
                        <button className="btn-ghost small" onClick={() => setActiveWorkout(r)}>↺ Repetir</button>
                      </div>
                    ) : (
                      <button className="btn-primary" style={{ fontSize:14, padding:"8px 16px",
                        boxShadow: isToday ? "0 0 16px rgba(232,255,0,0.3)" : "none" }}
                        onClick={() => {
                          if (!isToday && r.dayOfWeek >= 0) {
                            const hoy = DAYS_ES[todayDow];
                            if (!window.confirm(`Esta rutina es para el ${dayLabel}. Hoy es ${hoy}.\n¿Iniciar igual?`)) return;
                          }
                          setActiveWorkout(r);
                        }}>▶ Iniciar</button>
                    )}
                  </div>
                  {r.notes && <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic", marginBottom:8 }}>{r.notes}</div>}
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {(r.exercises||[]).map(ex => (
                      <span key={ex.id} title={ex.comment || undefined} style={{ fontSize:11, padding:"2px 8px", background:"rgba(59,130,246,0.1)", border: ex.comment ? "1px solid rgba(232,255,0,0.35)" : "1px solid rgba(59,130,246,0.2)", borderRadius:10, color: ex.comment ? "var(--accent)" : "var(--text-muted)", cursor: ex.comment ? "help" : "default" }}>
                        {ex.comment ? "💬 " : ""}{ex.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "coaches" && (
          <div>
            {coaches.length === 0 ? (
              <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center", padding:"20px 0" }}>Sin coaches aún.</p>
            ) : coaches.map(c => (
              <div key={c.coachUid} onClick={() => { setSelectedCoach(c); loadCoachProfile(c.coachUid); }}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, marginBottom:8, cursor:"pointer", transition:"border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
                {c.photoURL ? (
                  <img src={c.photoURL} alt="coach" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:"1px solid var(--accent)" }} />
                ) : (
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"white" }}>
                    {c.coachName?.[0]?.toUpperCase()||"?"}
                  </div>
                )}
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700 }}>{c.coachName}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{c.coachEmail}</div>
                </div>
                <div style={{ fontSize:12, color:"var(--text-muted)" }}>Ver perfil →</div>
              </div>
            ))}
          </div>
        )}

        {tab === "join" && (
          <div>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6 }}>
              Pídele a tu coach su código y escríbelo aquí para conectarte y recibir rutinas.
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input className="input" placeholder="Código del coach (ej: COACH-ABC123)"
                value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{ flex:1, fontFamily:"monospace", letterSpacing:2, fontSize:15 }}
                onKeyDown={e => e.key==="Enter" && handleJoin()} />
              <button className="btn-primary" style={{ fontSize:15, padding:"10px 20px" }}
                onClick={handleJoin} disabled={joining}>
                {joining ? "⏳" : "Unirme"}
              </button>
            </div>
            {joinMsg && (
              <div style={{ fontSize:13, color: joinMsg.startsWith("✅")?"#22c55e":"#f87171", textAlign:"center", marginTop:8 }}>
                {joinMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AthleteCoachPanel;