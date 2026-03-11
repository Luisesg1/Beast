import { useState, useEffect, useRef } from "react";
import { calc1RM } from "./utils";

const LIVE_DRAFT_KEY = "gym_live_draft";
const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const numDot    = (v, max = 9999) => { const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); const n = parseFloat(s); if (isNaN(n) || n < 0) return ""; return n > max ? String(max) : s; };
const numWeight = (v) => numDot(v, 9999);
const numReps   = (v) => numDot(v, 100);
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load  = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };

const BRUX_MOODS = {
  happy:    { face: "happy",    color: "#e8ff00", glow: "#e8ff0025", label: "Feliz" },
  proud:    { face: "proud",    color: "#f59e0b", glow: "#f59e0b25", label: "Orgulloso" },
  celebrate:{ face: "celebrate",color: "#f97316", glow: "#f9731625", label: "Celebrando" },
};

function LiveTrainMode({
  exercises, workout, date, notes, unit, sessions,
  onSaveSession, onBack,
  floatTimer, setFloatTimer,
  ExerciseGif,
}) {
  // Restore draft if available
  const draft = (() => { try { const d = localStorage.getItem(LIVE_DRAFT_KEY); return d ? JSON.parse(d) : null; } catch { return null; } })();
  const draftMatches = draft && draft.workout === workout && draft.date === date;

  const [elapsed, setElapsed] = useState(() => draftMatches ? (draft.elapsed || 0) : 0);
  const [running, setRunning] = useState(true);
  const [currentEx, setCurrentEx] = useState(() => draftMatches ? (draft.currentEx || 0) : 0);
  const [exData, setExData] = useState(() => {
    if (draftMatches && draft.exData) return draft.exData;
    return exercises.map(ex => ({
      ...ex,
      restSecs: ex.restSecs || null,
      sets: ex.sets?.length
        ? ex.sets.map(s => ({ ...s, done: false }))
        : Array.from({ length: parseInt(ex.series) || 3 }, () => ({
            id: uid(), weight: ex.weight || "", reps: ex.reps || "", done: false
          })),
    }));
  });
  const [restoredDraft] = useState(draftMatches);
  const [showSummary, setShowSummary] = useState(false);
  const timerRef = useRef();
  const restRef = useRef();
  const [restTimer, setRestTimer] = useState(null); // null | { total, left }

  // Countdown de descanso
  useEffect(() => {
    if (restTimer && restTimer.left > 0) {
      restRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (!prev || prev.left <= 1) { clearInterval(restRef.current); return prev ? { ...prev, left: 0 } : null; }
          return { ...prev, left: prev.left - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer?.total, restTimer?.left]);

  function startRest(secs) {
    clearInterval(restRef.current);
    setRestTimer({ total: secs, left: secs });
  }

  const REST_OPTS_LIVE = [
    { label: "1m", secs: 60 },
    { label: "1.5m", secs: 90 },
    { label: "2m", secs: 120 },
    { label: "3m", secs: 180 },
  ];
  const [defaultRest, setDefaultRest] = useState(() => load("gym_default_rest", 90));

  function saveDefaultRest(secs) {
    setDefaultRest(secs);
    store("gym_default_rest", secs);
  }

  useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running]);

  // Autosave draft on every change
  useEffect(() => {
    try {
      localStorage.setItem(LIVE_DRAFT_KEY, JSON.stringify({ workout, date, elapsed, currentEx, exData }));
    } catch {}
  }, [exData, elapsed, currentEx]);

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const [showRestoredBanner, setShowRestoredBanner] = useState(restoredDraft);
  useEffect(() => {
    if (showRestoredBanner) { const t = setTimeout(() => setShowRestoredBanner(false), 3500); return () => clearTimeout(t); }
  }, [showRestoredBanner]);
  const totalSets = exData.reduce((a, e) => a + e.sets.length, 0);
  const doneSets  = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const pct = totalSets > 0 ? doneSets / totalSets : 0;

  function toggleSet(exIdx, setIdx) {
    const wasDone = exData[exIdx].sets[setIdx].done;
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done }),
      }
    ));
    // Auto-lanzar timer de descanso al COMPLETAR una serie
    if (!wasDone) {
      const exRestSecs = exData[exIdx]?.restSecs ?? defaultRest;
      startRest(exRestSecs);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }

  function updateSet(exIdx, setIdx, field, val) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val }),
      }
    ));
  }

  function addSet(exIdx) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: [...ex.sets, {
          id: uid(),
          weight: ex.sets[ex.sets.length - 1]?.weight || "",
          reps:   ex.sets[ex.sets.length - 1]?.reps   || "",
          done:   false,
        }],
      }
    ));
  }

  function removeSet(exIdx) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx || ex.sets.length <= 1 ? ex : {
        ...ex, sets: ex.sets.slice(0, -1),
      }
    ));
  }

  // ── PANTALLA RESUMEN ────────────────────────────────────────────────────────
  if (showSummary) {
    const totalVol = exData.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.done)
        .reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1), 0), 0);
    const completedSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
    const completionPct = exData.length > 0 ? Math.round(completedSets / exData.reduce((a,e)=>a+e.sets.length,0) * 100) : 0;

    // Pick celebration mood based on performance
    const celebMood = completionPct >= 90 ? BRUX_MOODS.celebrate
      : completionPct >= 60 ? BRUX_MOODS.proud
      : BRUX_MOODS.happy;

    const celebMessages = completionPct >= 90
      ? [
          "¡Lo completaste todo! Eso es nivel élite 🔥",
          "¡100%! Eres una bestia del gym 🏆",
          "¡Brutal! Brux está sin palabras. Buenas, claro. 💪",
          "Sesión perfecta. Así se construye un cuerpo de acero. 🔩",
          "Todo completado. Cada rep contó. Brux lo vio todo.",
          "¡Imparable! Eso no lo hace cualquiera. Bien hecho. 🎯",
          "Nivel desbloqueado. Brux actualiza tu expediente. 📋",
          "¿100%? Brux se quita el sombrero. Literalmente. 🎩",
          "Completaste todo. El gym te debe una reverencia. 🙇",
        ]
      : completionPct >= 60
      ? [
          "¡Buen trabajo! Cada serie cuenta 👊",
          "¡Sesión completada! Mañana más 💪",
          "¡Así se hace! Consistencia es la clave 🗝️",
          "Más de la mitad bien ejecutada. Eso se llama progreso real.",
          "Sólido. No todos los días son perfectos y está bien. ✅",
          "Trabajo hecho. Brux anota el esfuerzo, no solo el resultado.",
          "Buen ritmo hoy. Con esto se construyen hábitos de hierro. 🏗️",
          "Sesión cerrada. Tu yo del futuro te lo va a agradecer. ⏳",
          "No fue el 100%, pero fue tuyo. Y eso vale mucho. 💛",
        ]
      : [
          "Algo es algo. Lo importante es aparecer 💯",
          "¡Viniste y eso ya es una victoria! 🌟",
          "El primer paso siempre es el más difícil. ¡Seguí! 🚀",
          "Días difíciles también cuentan. Brux lo respeta.",
          "Hoy no fue tu mejor día y de todas formas entrenaste. Eso es carácter. 💪",
          "Medio entrenamiento sigue siendo mejor que ninguno. Siempre.",
          "El cuerpo no siempre coopera. Lo que importa es que volviste. 🔄",
          "Brux sabe que no fue fácil hoy. Por eso vale más. 🙌",
          "Apareciste. Eso ya te pone en el top. El resto viene solo. 📈",
        ];
    const celebMsg = celebMessages[Math.floor(Date.now()/86400000) % celebMessages.length];

    return (
      <div style={{
        minHeight: "calc(100vh - 60px)", background: "var(--bg)",
        display: "flex", flexDirection: "column", padding: "28px 20px",
        animation: "fadeIn 0.4s ease",
      }}>
        {/* Mascota celebrando — animada */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <style>{`
            @keyframes dumbbellCelebrate {
              0%   { transform: scale(1) rotate(0deg); }
              15%  { transform: scale(1.3) rotate(-15deg); }
              30%  { transform: scale(1.2) rotate(12deg); }
              45%  { transform: scale(1.25) rotate(-10deg); }
              60%  { transform: scale(1.15) rotate(8deg); }
              75%  { transform: scale(1.1) rotate(-5deg); }
              100% { transform: scale(1) rotate(0deg); }
            }
            @keyframes confettiFall {
              0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
              100% { transform: translateY(60px) rotate(360deg); opacity:0; }
            }
          `}</style>

          {/* Confetti particles */}
          <div style={{ position: "relative", display: "inline-block" }}>
            {["🎊","✨","🌟","💥","🎉","⭐","🔥","💫"].map((e, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${10 + (i * 11) % 80}%`,
                top: `${(i * 17) % 40}%`,
                fontSize: 16 + (i % 3) * 4,
                animation: `confettiFall ${0.8 + (i % 4) * 0.3}s ease-out ${i * 0.1}s forwards`,
                pointerEvents: "none",
              }}>{e}</div>
            ))}

          {/* Personaje celebrando */}
          <div style={{ animation: "dumbbellCelebrate 1s ease-out 0.2s both", display: "inline-block" }}>
            <svg viewBox="0 0 80 88" width="120" height="132">
              <defs>
                <filter id="glowCelebrate"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="neonCelebrate"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              {/* Aura glow */}
              <ellipse cx="40" cy="44" rx="36" ry="40" fill={`${celebMood.color}20`} filter="url(#glowCelebrate)"/>
              {/* HEAD */}
              <path d="M22 8 L58 8 L60 14 L60 36 L54 42 L26 42 L20 36 L20 14 Z"
                fill="#0a0a0a" stroke={celebMood.color} strokeWidth="2.2" strokeLinejoin="miter" filter="url(#glowCelebrate)"/>
              <path d="M24 8 L56 8 L58 10 L22 10 Z" fill={celebMood.color}/>
              <path d="M26 16 L54 16 L56 20 L56 36 L52 39 L28 39 L24 36 L24 20 Z"
                fill="#111" stroke={`${celebMood.color}70`} strokeWidth="1" strokeLinejoin="miter"/>
              {/* Star eyes */}
              {completionPct >= 90
                ? (<>
                    <text x="27" y="27" fontSize="9" textAnchor="middle" fill={celebMood.color} fontWeight="900">★</text>
                    <text x="37" y="27" fontSize="9" textAnchor="middle" fill={celebMood.color} fontWeight="900">★</text>
                  </>)
                : (<>
                    <rect x="24" y="21" width="7" height="5" rx="1" fill={celebMood.color}/>
                    <rect x="33" y="21" width="7" height="5" rx="1" fill={celebMood.color}/>
                    <rect x="25" y="22" width="2" height="2" fill="#0a0a0a"/>
                    <rect x="34" y="22" width="2" height="2" fill="#0a0a0a"/>
                  </>)
              }
              {/* Big angular grin */}
              <path d="M25 30 L32 36 L39 30" stroke={celebMood.color} strokeWidth="2.8" fill={`${celebMood.color}35`} strokeLinecap="square" strokeLinejoin="miter"/>
              <line x1="29" y1="30" x2="30" y2="34" stroke={celebMood.color} strokeWidth="1.2" opacity="0.6"/>
              <line x1="32" y1="30.5" x2="32" y2="36" stroke={celebMood.color} strokeWidth="1.2" opacity="0.6"/>
              <line x1="35" y1="30" x2="34" y2="34" stroke={celebMood.color} strokeWidth="1.2" opacity="0.6"/>
              {/* Jaw accents */}
              <line x1="20" y1="32" x2="26" y2="36" stroke={celebMood.color} strokeWidth="1.5" opacity="0.6"/>
              <line x1="60" y1="32" x2="54" y2="36" stroke={celebMood.color} strokeWidth="1.5" opacity="0.6"/>
              {/* NECK */}
              <rect x="33" y="42" width="14" height="7" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.5"/>
              {/* TORSO */}
              <path d="M14 49 L66 49 L62 76 L18 76 Z"
                fill="#0a0a0a" stroke={celebMood.color} strokeWidth="2.2" strokeLinejoin="miter" filter="url(#neonCelebrate)"/>
              <path d="M18 49 L40 49 L38 62 L20 62 Z" fill={`${celebMood.color}25`} stroke={`${celebMood.color}60`} strokeWidth="1"/>
              <path d="M62 49 L40 49 L42 62 L60 62 Z" fill={`${celebMood.color}25`} stroke={`${celebMood.color}60`} strokeWidth="1"/>
              <line x1="40" y1="49" x2="40" y2="76" stroke={celebMood.color} strokeWidth="1.5" opacity="0.7"/>
              <line x1="21" y1="62" x2="59" y2="62" stroke={celebMood.color} strokeWidth="1" opacity="0.35"/>
              <line x1="22" y1="69" x2="58" y2="69" stroke={celebMood.color} strokeWidth="1" opacity="0.35"/>
              {/* LEFT ARM */}
              <path d="M14 49 L4 44 L0 34 L6 32 L10 40 L18 47 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <path d="M0 34 L-2 22 L4 18 L8 28 L6 32 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <rect x="-6" y="11" width="18" height="6" rx="0" fill={celebMood.color} filter="url(#glowCelebrate)"/>
              <rect x="-8" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="8" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="-9" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              <rect x="14" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              {/* RIGHT ARM */}
              <path d="M66 49 L76 44 L80 34 L74 32 L70 40 L62 47 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <path d="M80 34 L82 22 L76 18 L72 28 L74 32 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <rect x="68" y="11" width="18" height="6" rx="0" fill={celebMood.color} filter="url(#glowCelebrate)"/>
              <rect x="66" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="80" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="64" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              <rect x="83" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              {/* LEGS */}
              <path d="M18 76 L28 76 L26 88 L16 88 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <path d="M52 76 L62 76 L64 88 L54 88 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <rect x="14" y="86" width="14" height="4" fill={celebMood.color} opacity="0.9"/>
              <rect x="52" y="86" width="14" height="4" fill={celebMood.color} opacity="0.9"/>
              {/* FX */}
              <text x="14" y="6" fontSize="10">✨</text>
              <text x="56" y="5" fontSize="10">🎉</text>
            </svg>
          </div>
          </div>

          {/* Mensaje de celebración */}
          <div style={{ marginTop: 12, padding: "10px 20px", background: `${celebMood.color}15`, border: `1px solid ${celebMood.color}40`, borderRadius: 14, display: "inline-block", maxWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: celebMood.color, textTransform: "uppercase", marginBottom: 2 }}>🏋️ tu compañero de gym</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{celebMsg}</div>
          </div>
        </div>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 38, fontWeight: 900, letterSpacing: 1, marginBottom: 4 }}>
            ¡Sesión completada!
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{workout} · {fmt(elapsed)}</div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 12, marginBottom: 28, maxWidth: 560, width: "100%", margin: "0 auto 28px",
        }}>
          {[
            { icon: "⏱️", label: "Tiempo",      value: fmt(elapsed) },
            { icon: "🏋️", label: "Ejercicios",  value: exData.length },
            { icon: "🔢", label: "Series",       value: completedSets },
            { icon: "📦", label: "Volumen",
              value: totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}t` : `${Math.round(totalVol)}kg` },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "16px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 28, fontWeight: 800, color: "var(--accent)",
              }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Per-exercise breakdown */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", marginBottom: 28 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12,
          }}>
            Resumen por ejercicio
          </div>
          {exData.map((ex, i) => {
            const doneS  = ex.sets.filter(s => s.done);
            const maxW   = doneS.length > 0 ? Math.max(...doneS.map(s => parseFloat(s.weight) || 0)) : 0;
            const best1rm = doneS.length > 0
              ? Math.max(...doneS.map(s => calc1RM(parseFloat(s.weight) || 0, parseFloat(s.reps) || 0)))
              : 0;
            return (
              <div key={i} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                display: "flex", gap: 12, alignItems: "center",
              }}>
                <ExerciseGif exName={ex.name} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                    {doneS.length > 0 ? "✓ " : "○ "}{ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doneS.length}/{ex.sets.length} series
                    {maxW > 0 && ` · máx ${maxW}kg`}
                    {best1rm > 0 && ` · ~${best1rm}kg 1RM`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 150, justifyContent: "flex-end" }}>
                  {doneS.map((s, j) => (
                    <span key={j} style={{
                      fontSize: 11, padding: "2px 7px",
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                      borderRadius: 6, color: "#22c55e", fontWeight: 600,
                    }}>
                      {s.weight || "—"}×{s.reps || "—"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", display: "flex", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              flex: 1, background: "var(--card)", border: "1px solid var(--border)",
              color: "var(--text-muted)", borderRadius: 12, padding: 14,
              fontFamily: "Barlow, sans-serif", fontSize: 14, cursor: "pointer",
            }}
          >
            ✕ Descartar
          </button>
          <button
            onClick={() => {
              const finalExercises = exData
                .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.weight || s.reps) }))
                .filter(ex => ex.sets.length > 0);
              onSaveSession(finalExercises, elapsed);
            }}
            style={{
              flex: 2, background: "var(--accent)", border: "none",
              color: "#0a0a0a", borderRadius: 12, padding: 14,
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 20, fontWeight: 900, letterSpacing: 1, cursor: "pointer",
              boxShadow: "0 0 24px rgba(232,255,0,0.3)",
            }}
          >
            ✅ GUARDAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  // ── PANTALLA PRINCIPAL DE ENTRENAMIENTO ─────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 400, overflowY: "auto" }}>
      {/* ── Sticky header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0, position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
      }}>
        <button
          onClick={() => {
            const hasDone = exData.some(ex => ex.sets.some(s => s.done));
            try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {}
            if (hasDone) {
              if (!window.confirm("¿Salir del entrenamiento? El borrador guardado se eliminará.")) return;
            }
            onBack();
          }}
          style={{
            background: "none", border: "1px solid var(--border)",
            color: "var(--text-muted)", borderRadius: 8, padding: "6px 10px",
            cursor: "pointer", fontSize: 12, flexShrink: 0,
          }}
        >← Salir</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 800,
            letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            ⚡ {workout || "Entrenamiento"}
            {showRestoredBanner && (
              <span style={{ marginLeft: 8, fontSize: 11, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", borderRadius: 6, padding: "2px 8px", fontWeight: 700, letterSpacing: 0.5, verticalAlign: "middle" }}>
                ✅ Sesión restaurada
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {doneSets}/{totalSets} series completadas
          </div>
        </div>

        {/* Cronómetro + pausar en línea */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 800,
            letterSpacing: 2, color: running ? "var(--accent)" : "var(--text-muted)",
          }}>
            {fmt(elapsed)}
          </div>
          <button
            onClick={() => setRunning(r => !r)}
            style={{
              background: "var(--input-bg)", border: "1px solid var(--border)",
              color: "var(--text-muted)", borderRadius: 8, padding: "5px 10px",
              fontSize: 12, cursor: "pointer", fontFamily: "Barlow, sans-serif",
              fontWeight: 600, flexShrink: 0,
            }}
          >
            {running ? "⏸" : "▶"}
          </button>
        </div>
      </div>

      {/* Spacer para el header fixed */}
      <div style={{ height: 57, flexShrink: 0 }} />
      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--border)", flexShrink: 0 }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, var(--accent), #22c55e)",
          width: `${pct * 100}%`,
          transition: "width 0.4s ease", borderRadius: 2,
        }} />
      </div>

      {/* Exercise tabs */}
      <div style={{
        display: "flex", gap: 6, padding: "10px 16px 0",
        overflowX: "auto", flexShrink: 0, scrollbarWidth: "none",
      }}>
        {exData.map((ex, i) => {
          const allDone = ex.sets.every(s => s.done) && ex.sets.length > 0;
          const anyDone = ex.sets.some(s => s.done);
          return (
            <button key={i} onClick={() => setCurrentEx(i)} style={{
              background: currentEx === i ? "var(--accent)"
                : allDone ? "rgba(232,255,0,0.08)"
                : anyDone ? "rgba(232,255,0,0.04)"
                : "var(--card)",
              border: `1px solid ${currentEx === i ? "var(--accent)" : allDone ? "rgba(232,255,0,0.3)" : "var(--border)"}`,
              color: currentEx === i ? "#0a0a0a" : allDone ? "var(--accent)" : "var(--text-muted)",
              borderRadius: 4, padding: "6px 12px", cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 900,
              whiteSpace: "nowrap", flexShrink: 0, letterSpacing: 1, textTransform: "uppercase",
            }}>
              {allDone ? "✓ " : anyDone ? "◑ " : ""}{ex.name}
            </button>
          );
        })}
      </div>

      {/* Current exercise panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {exData[currentEx] && (() => {
          const ex = exData[currentEx];
          const doneCount = ex.sets.filter(s => s.done).length;

          // PR anterior
          const bestPrev = sessions
            .flatMap(s => (s.exercises || [])
              .filter(e => e.name === ex.name)
              .map(e => {
                const w = e.sets?.length > 0 ? Math.max(...e.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(e.weight) || 0;
                const r = e.sets?.length > 0 ? Math.max(...e.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(e.reps) || 0;
                return calc1RM(w, r);
              })
            ).reduce((best, v) => Math.max(best, v), 0);

          return (
            <div style={{ maxWidth: 580, margin: "0 auto" }}>

              {/* Exercise header */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18, gap: 8 }}>
                  <ExerciseGif exName={ex.name} size={100} />
                  <div style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 28, fontWeight: 800,
                  }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doneCount}/{ex.sets.length} series
                  </div>
                  {bestPrev > 0 && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--accent-dim)", border: "1px solid rgba(232,255,0,0.3)",
                      borderRadius: 4, padding: "4px 10px", fontSize: 12, color: "var(--accent)",
                    }}>
                      ★ MEJOR: {bestPrev}kg 1RM
                    </div>
                  )}
                  {/* Per-exercise rest time selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 800, letterSpacing: 3, textTransform:"uppercase" }}>DESCANSO</span>
                    {[60, 90, 120, 180].map(secs => {
                      const active = (ex.restSecs ?? defaultRest) === secs;
                      return (
                        <button key={secs} onClick={() => setExData(prev => prev.map((e, i) => i !== currentEx ? e : { ...e, restSecs: secs }))}
                          style={{
                            background: active ? "var(--accent)" : "var(--input-bg)",
                            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                            color: active ? "#0a0a0a" : "var(--text-muted)",
                            borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                          }}>
                          {secs < 120 ? `${secs}s` : `${secs/60}m`}
                        </button>
                      );
                    })}
                  </div>
              </div>

              {/* Sets table */}
              <div style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 14, overflow: "hidden", marginBottom: 10,
              }}>
                {/* Header row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 1fr 56px",
                  gap: 8, padding: "9px 14px",
                  background: "var(--input-bg)", borderBottom: "1px solid var(--border)",
                }}>
                  {["#", `Peso (${unit})`, "Reps", "✓"].map(h => (
                    <div key={h} style={{
                      fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                      textAlign: "center", letterSpacing: 1, textTransform: "uppercase",
                    }}>{h}</div>
                  ))}
                </div>

                {/* Set rows */}
                {ex.sets.map((s, j) => (
                  <div key={s.id} style={{
                    display: "grid", gridTemplateColumns: "36px 1fr 1fr 56px",
                    gap: 8, padding: "9px 14px", alignItems: "center",
                    background: s.done ? "rgba(34,197,94,0.05)" : "transparent",
                    borderBottom: j < ex.sets.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.25s",
                  }}>
                    <div style={{
                      textAlign: "center", fontWeight: 800, fontSize: 14,
                      fontFamily: "Barlow Condensed, sans-serif",
                      color: s.done ? "var(--accent)" : "var(--text-muted)",
                    }}>
                      S{j + 1}
                    </div>
                    <input
                      value={s.weight}
                      onChange={e => updateSet(currentEx, j, "weight", numWeight(e.target.value))}
                      placeholder="—"
                      style={{
                        background: "var(--input-bg)",
                        border: `1px solid ${s.done ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                        borderRadius: 8, padding: "8px", color: "var(--text)",
                        fontFamily: "Barlow, sans-serif", fontSize: 16, fontWeight: 700,
                        textAlign: "center", outline: "none", width: "100%",
                      }}
                    />
                    <input
                      value={s.reps}
                      onChange={e => updateSet(currentEx, j, "reps", numReps(e.target.value))}
                      placeholder="—"
                      style={{
                        background: "var(--input-bg)",
                        border: `1px solid ${s.done ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                        borderRadius: 8, padding: "8px", color: "var(--text)",
                        fontFamily: "Barlow, sans-serif", fontSize: 16, fontWeight: 700,
                        textAlign: "center", outline: "none", width: "100%",
                      }}
                    />
                    <button
                      onClick={() => toggleSet(currentEx, j)}
                      style={{
                        width: 50, height: 38, margin: "0 auto",
                        background: s.done ? "#22c55e" : "var(--input-bg)",
                        border: `2px solid ${s.done ? "#22c55e" : "var(--border)"}`,
                        borderRadius: 10, cursor: "pointer", fontSize: 18,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s", transform: s.done ? "scale(1.05)" : "scale(1)",
                      }}
                    >
                      {s.done ? "✓" : "○"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Add / remove series */}
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button
                  onClick={() => addSet(currentEx)}
                  style={{
                    flex: 1, background: "none", border: "1px dashed var(--border)",
                    color: "var(--text-muted)", borderRadius: 10, padding: 9,
                    cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 13,
                  }}
                >
                  + Añadir serie
                </button>
                {ex.sets.length > 1 && (
                  <button
                    onClick={() => removeSet(currentEx)}
                    style={{
                      background: "none", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#ef4444", borderRadius: 10, padding: "9px 14px",
                      cursor: "pointer", fontSize: 13,
                    }}
                  >
                    − Quitar
                  </button>
                )}
              </div>

              {/* Inline rest timer */}
              <div style={{
                background: "var(--card)", border: `1px solid ${restTimer ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 12, padding: "11px 14px", marginBottom: 18,
                transition: "border-color 0.3s",
              }}>
                {restTimer ? (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>DESCANSANDO</div>
                    <div style={{ height: 5, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", background: "var(--accent)", borderRadius: 10, width: `${(restTimer.left / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <button onClick={() => setRestTimer(t => ({ ...t, left: Math.max(0, t.left - 15), total: Math.max(15, t.total - 15) }))}
                        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>−15s</button>
                      <div style={{ flex: 1, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 34, fontWeight: 800, color: "var(--accent)" }}>
                        {restTimer.left === 0 ? "¡Listo!" : fmt(restTimer.left)}
                      </div>
                      <button onClick={() => setRestTimer(t => ({ ...t, left: t.left + 15, total: t.total + 15 }))}
                        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+15s</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {REST_OPTS_LIVE.map(o => (
                        <button key={o.label} onClick={() => startRest(o.secs)}
                          style={{ background: restTimer.total === o.secs ? "var(--accent)" : "var(--input-bg)", border: `1px solid ${restTimer.total === o.secs ? "var(--accent)" : "var(--border)"}`, color: restTimer.total === o.secs ? "#0a0a0a" : "var(--text-muted)", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          {o.label}
                        </button>
                      ))}
                      <button onClick={() => setRestTimer(null)}
                        style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>
                        ✕ Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 3, textTransform: "uppercase" }}>DESCANSO</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          Auto: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{defaultRest < 60 ? `${defaultRest}s` : `${defaultRest/60}m`}</span>
                          <span style={{ margin: "0 4px", opacity: 0.4 }}>·</span>
                          {REST_OPTS_LIVE.map(o => (
                            <button key={o.secs} onClick={() => saveDefaultRest(o.secs)}
                              style={{ background: defaultRest === o.secs ? "var(--accent-dim)" : "none", border: "none", color: defaultRest === o.secs ? "var(--accent)" : "var(--text-muted)", borderRadius: 4, padding: "1px 5px", cursor: "pointer", fontSize: 10, fontWeight: defaultRest === o.secs ? 800 : 400 }}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {REST_OPTS_LIVE.map(o => (
                          <button key={o.label} onClick={() => startRest(o.secs)}
                            style={{ background: o.secs === defaultRest ? "var(--accent-dim)" : "var(--input-bg)", border: `1px solid ${o.secs === defaultRest ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: o.secs === defaultRest ? "var(--accent)" : "var(--text-muted)", fontSize: 11, fontWeight: o.secs === defaultRest ? 700 : 600 }}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Previous / Next navigation */}
              <div style={{ display: "flex", gap: 10 }}>
                {currentEx > 0 && (
                  <button
                    onClick={() => setCurrentEx(i => i - 1)}
                    style={{
                      flex: 1, background: "var(--card)", border: "1px solid var(--border)",
                      color: "var(--text-muted)", borderRadius: 10, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 13,
                    }}
                  >
                    ← Anterior
                  </button>
                )}
                {currentEx < exData.length - 1 ? (
                  <button
                    onClick={() => setCurrentEx(i => i + 1)}
                    style={{
                      flex: 2, background: "var(--accent)", border: "none",
                      color: "#0a0a0a", borderRadius: 10, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 17, fontWeight: 700,
                    }}
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    onClick={() => { setRunning(false); setShowSummary(true); }}
                    style={{
                      flex: 2, background: "var(--accent)",
                      border: "none", color: "#0a0a0a", borderRadius: 4, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 17, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase",
                      boxShadow: "0 0 20px rgba(232,255,0,0.2)",
                    }}
                  >
                    FINALIZAR →
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}


export default LiveTrainMode;