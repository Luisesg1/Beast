import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./ConfirmModal";
import { calc1RM } from "./utils";
import { showInterstitial } from "../useAdMob";
import { usePlan } from "./usePlan";

const LIVE_DRAFT_KEY = "gym_live_draft";
const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const numDot    = (v, max = 9999) => { const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); const n = parseFloat(s); if (isNaN(n) || n < 0) return ""; return n > max ? String(max) : s; };
const numWeight = (v) => numDot(v, 500);
const numReps   = (v) => numDot(v, 100);

// ── Superset helpers ──────────────────────────────────────────────────────────
// Returns array of groups: [{ groupId, indices }]
function getSupersetGroups(exData) {
  const groups = {};
  exData.forEach((ex, i) => {
    if (ex.supersetGroup) {
      if (!groups[ex.supersetGroup]) groups[ex.supersetGroup] = [];
      groups[ex.supersetGroup].push(i);
    }
  });
  return Object.entries(groups).map(([groupId, indices]) => ({ groupId, indices }));
}

// Given an exercise index, returns its group { groupId, indices } or null
function getSupersetGroupForIndex(exData, idx) {
  if (!exData[idx]?.supersetGroup) return null;
  const groupId = exData[idx].supersetGroup;
  const indices = exData.map((ex, i) => ex.supersetGroup === groupId ? i : -1).filter(i => i >= 0);
  return { groupId, indices };
}

// Is this exercise index the LAST one in its superset group?
function isLastInSupersetGroup(exData, idx) {
  const g = getSupersetGroupForIndex(exData, idx);
  if (!g) return true; // not in a superset, always "last"
  return g.indices[g.indices.length - 1] === idx;
}

// Returns a color accent for superset group (cycles through palette)
const SS_COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];
function getSupersetColor(groupId, exData) {
  const groups = getSupersetGroups(exData);
  const idx = groups.findIndex(g => g.groupId === groupId);
  return SS_COLORS[idx % SS_COLORS.length];
}
const numSeries = (v) => { const n = parseInt(v.replace(/[^0-9]/g, "")); return isNaN(n) ? "" : String(Math.min(Math.max(n, 1), 20)); };
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load  = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };

const BRUX_MOODS = {
  happy:    { face: "happy",    color: "#e8ff00", glow: "#e8ff0025", label: "Feliz" },
  proud:    { face: "proud",    color: "#f59e0b", glow: "#f59e0b25", label: "Orgulloso" },
  celebrate:{ face: "celebrate",color: "#f97316", glow: "#f9731625", label: "Celebrando" },
};

// ── Exercise history helpers ──────────────────────────────────────────────────

function getDaysAgo(dateStr) {
  if (!dateStr) return null;
  const sessionDate = new Date(dateStr);
  if (isNaN(sessionDate.getTime())) return null;
  const now = new Date();
  const diffMs = now - sessionDate;
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  const weeks = Math.round(diffDays / 7);
  if (weeks === 1) return "Hace 1 semana";
  if (diffDays < 30) return `Hace ${weeks} semanas`;
  const months = Math.round(diffDays / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

function formatSetsCompact(sets, unit = "kg") {
  if (!sets || sets.length === 0) return null;
  const done = sets.filter(s => parseFloat(s.reps) > 0);
  if (done.length === 0) return null;

  // Try to compress: detect if all sets have same weight & reps
  const groups = [];
  for (const s of done) {
    const w = parseFloat(s.weight) || 0;
    const r = parseFloat(s.reps) || 0;
    const last = groups[groups.length - 1];
    if (last && last.w === w && last.r === r) {
      last.count++;
    } else {
      groups.push({ w, r, count: 1 });
    }
  }

  // If everything is one unique group: "80kg x 8 x 3"
  if (groups.length === 1) {
    const g = groups[0];
    const wStr = g.w > 0 ? `${g.w}${unit}` : "PC";
    return g.count > 1 ? `${wStr} × ${g.r} × ${g.count}` : `${wStr} × ${g.r}`;
  }

  // Otherwise list first 3 sets: "80kg×8, 80kg×6, 75kg×8"
  return done.slice(0, 3).map(s => {
    const w = parseFloat(s.weight) || 0;
    const r = parseFloat(s.reps) || 0;
    const wStr = w > 0 ? `${w}${unit}` : "PC";
    return `${wStr}×${r}`;
  }).join(", ") + (done.length > 3 ? "…" : "");
}

function getRecentExerciseHistory(sessions, exName, unit = "kg") {
  if (!sessions || sessions.length === 0) return [];
  const relevant = sessions
    .filter(s => s.date && (s.exercises || []).some(e => e.name === exName))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 3);

  return relevant.map(s => {
    const ex = (s.exercises || []).find(e => e.name === exName);
    const label = getDaysAgo(s.date);
    const setsStr = formatSetsCompact(ex?.sets, unit);
    return { label, setsStr, date: s.date };
  }).filter(r => r.label && r.setsStr);
}

// ── ExerciseHistoryBadge component ───────────────────────────────────────────
function ExerciseHistoryBadge({ sessions, exName, unit = "kg" }) {
  const [collapsed, setCollapsed] = useState(false);
  const history = getRecentExerciseHistory(sessions, exName, unit);

  const isFirstTime = history.length === 0;

  return (
    <div style={{ width: "100%", marginBottom: 6 }}>
      {isFirstTime ? (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "rgba(232,255,0,0.06)",
          border: "1px solid rgba(232,255,0,0.18)",
          borderRadius: 8, padding: "5px 12px",
          fontSize: 11, color: "rgba(232,255,0,0.7)",
          fontFamily: "Barlow, sans-serif", fontWeight: 600,
        }}>
          💪 Primera vez
        </div>
      ) : (
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--border)",
          borderRadius: 10, overflow: "hidden",
          width: "100%",
        }}>
          {/* Header / toggle row */}
          <button
            onClick={() => setCollapsed(c => !c)}
            style={{
              width: "100%", background: "none", border: "none",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "6px 12px", cursor: "pointer", gap: 8,
            }}
          >
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: 1,
              color: "var(--text-muted)", textTransform: "uppercase",
              fontFamily: "Barlow Condensed, sans-serif",
            }}>
              📊 Historial reciente
            </span>
            <span style={{
              fontSize: 10, color: "var(--text-muted)",
              transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)",
              transition: "transform 0.2s",
              lineHeight: 1,
            }}>▾</span>
          </button>

          {/* History rows */}
          {!collapsed && (
            <div style={{ padding: "0 12px 8px", display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "baseline",
                  gap: 6, flexWrap: "wrap", justifyContent: "center",
                  textAlign: "center", width: "100%",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: i === 0 ? "rgba(232,255,0,0.55)" : "var(--text-muted)",
                    fontFamily: "Barlow Condensed, sans-serif",
                    letterSpacing: 0.5, flexShrink: 0,
                  }}>
                    {h.label}:
                  </span>
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: i === 0 ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.45)",
                    fontFamily: "Barlow, sans-serif",
                  }}>
                    {h.setsStr}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveTrainMode({
  exercises, workout, date, notes, unit, sessions,
  onSaveSession, onBack,
  floatTimer, setFloatTimer,
  ExerciseGif,
  onShowPaywall,
}) {
  const { isFree } = usePlan();
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const [showAdOverlay, setShowAdOverlay] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const [showProBanner, setShowProBanner] = useState(false);
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
        ? ex.sets.map(s => ({ ...s, done: false, rpe: s.rpe ?? "" }))
        : Array.from({ length: parseInt(ex.series) || 3 }, () => ({
            id: uid(), weight: ex.weight || "", reps: ex.reps || "", done: false, rpe: "",
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
    if (!restTimer || restTimer.left <= 0) return;
    restRef.current = setInterval(() => {
      setRestTimer(prev => {
        if (!prev || prev.left <= 1) { clearInterval(restRef.current); return prev ? { ...prev, left: 0 } : null; }
        return { ...prev, left: prev.left - 1 };
      });
    }, 1000);
    return () => clearInterval(restRef.current);
  }, [restTimer?.startedAt]);

  function startRest(secs) {
    clearInterval(restRef.current);
    setRestTimer({ total: secs, left: secs, startedAt: Date.now() });
  }

  const REST_OPTS_LIVE = [
    { label: "1min", secs: 60 },
    { label: "1.5min", secs: 90 },
    { label: "2min", secs: 120 },
    { label: "3min", secs: 180 },
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

  // Ad countdown for free users
  useEffect(() => {
    if (!showAdOverlay) return;
    if (adCountdown <= 0) { setShowAdOverlay(false); setShowProBanner(true); return; }
    const t = setTimeout(() => setAdCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showAdOverlay, adCountdown]);

  // Autosave draft on every change
  useEffect(() => {
  if (showSummary) return;
  try {
    localStorage.setItem(LIVE_DRAFT_KEY, JSON.stringify({ workout, date, elapsed, currentEx, exData }));
  } catch {}
}, [exData, elapsed, currentEx, showSummary]);

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

    // Si intenta marcar como hecha, validar que tenga reps (peso es opcional — ejercicios de peso corporal)
    if (!wasDone) {
      const s = exData[exIdx].sets[setIdx];
      const hasReps = parseFloat(s.reps) > 0;
      if (!hasReps) {
        alert("⚠️ Ingresa las repeticiones antes de marcar la serie.");
        return;
      }
    }

    setExData(prev => {
      const next = prev.map((ex, i) =>
        i !== exIdx ? ex : {
          ...ex,
          sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done }),
        }
      );

      // Auto-lanzar timer de descanso al COMPLETAR una serie
      if (!wasDone) {
        const group = getSupersetGroupForIndex(next, exIdx);

        if (group) {
          // En superset: solo lanzar descanso si TODAS las series de todos
          // los ejercicios del grupo en esa "ronda" están completas.
          // Detectamos la ronda como el índice de setIdx (misma posición en todos).
          const allGroupDoneThisRound = group.indices.every(gIdx => {
            const s = next[gIdx].sets[setIdx];
            return s ? s.done : true; // si no existe esa serie, no cuenta
          });

          if (allGroupDoneThisRound) {
            const exRestSecs = next[exIdx]?.restSecs ?? defaultRest;
            startRest(exRestSecs);
            if ("Notification" in window && Notification.permission === "default") {
              Notification.requestPermission();
            }
          } else {
            // Avanzar automáticamente al siguiente ejercicio del grupo
            const myPosInGroup = group.indices.indexOf(exIdx);
            const nextInGroup = group.indices[myPosInGroup + 1];
            if (nextInGroup !== undefined) {
              setTimeout(() => setCurrentEx(nextInGroup), 120);
            }
          }
        } else {
          // Comportamiento normal: descanso al completar cualquier serie
          const exRestSecs = next[exIdx]?.restSecs ?? defaultRest;
          startRest(exRestSecs);
          if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
          }
        }
      }

      return next;
    });
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
          rpe:    "",
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

  // ── Superset management ───────────────────────────────────────────────────
  function groupAsSuperset(idxA, idxB) {
    const existing = exData[idxA]?.supersetGroup || exData[idxB]?.supersetGroup || uid().slice(0, 8);
    setExData(prev => prev.map((ex, i) =>
      i === idxA || i === idxB ? { ...ex, supersetGroup: existing } : ex
    ));
  }

  function removeFromSuperset(idx) {
    setExData(prev => {
      const groupId = prev[idx]?.supersetGroup;
      if (!groupId) return prev;
      const members = prev.filter(ex => ex.supersetGroup === groupId);
      const newData = prev.map((ex, i) => i === idx ? { ...ex, supersetGroup: null } : ex);
      if (members.length <= 2) {
        return newData.map(ex => ex.supersetGroup === groupId ? { ...ex, supersetGroup: null } : ex);
      }
      return newData;
    });
  }

  function addToExistingSuperset(groupId, idx) {
    setExData(prev => prev.map((ex, i) =>
      i === idx ? { ...ex, supersetGroup: groupId } : ex
    ));
  }

  // ── Exercise notes ────────────────────────────────────────────────────────
  const [noteOpen, setNoteOpen] = useState({});

  // ── Warmup suggestions ────────────────────────────────────────────────────
  const [warmupOpen, setWarmupOpen] = useState({});

  function toggleWarmup(exIdx) {
    setWarmupOpen(prev => ({ ...prev, [exIdx]: !prev[exIdx] }));
  }

  // Calculates warmup sets based on a working weight
  function getWarmupSets(workingWeight) {
    if (!workingWeight || workingWeight <= 0) {
      return [
        { pct: 40, reps: 10, label: "Activación" },
        { pct: 60, reps: 5,  label: "Potenciación" },
        { pct: 80, reps: 3,  label: "Rampa" },
      ].map(s => ({ ...s, weight: null }));
    }
    return [
      { pct: 40, reps: 10, label: "Activación",   weight: Math.round(workingWeight * 0.4 / 2.5) * 2.5 },
      { pct: 60, reps: 5,  label: "Potenciación", weight: Math.round(workingWeight * 0.6 / 2.5) * 2.5 },
      { pct: 80, reps: 3,  label: "Rampa",        weight: Math.round(workingWeight * 0.8 / 2.5) * 2.5 },
    ];
  }

  // Gets the base weight for warmup: first set weight > 0, or best historical weight
  function getWarmupBaseWeight(exIdx) {
    const ex = exData[exIdx];
    // Try current set weights first
    for (const s of ex.sets) {
      const w = parseFloat(s.weight);
      if (w > 0) return w;
    }
    // Fall back to best historical weight
    const histWeights = sessions.flatMap(s =>
      (s.exercises || [])
        .filter(e => e.name === ex.name)
        .flatMap(e => (e.sets || []).map(st => parseFloat(st.weight) || 0))
    ).filter(w => w > 0);
    if (histWeights.length > 0) return Math.max(...histWeights);
    return 0;
  }

  function updateExNote(exIdx, val) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : { ...ex, notes: val.slice(0, 200) }
    ));
  }

  function toggleNote(exIdx) {
    setNoteOpen(prev => ({ ...prev, [exIdx]: !prev[exIdx] }));
  }

  // ── PRO BANNER (solo free, después del anuncio) ─────────────────────────────
  if (showProBanner) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#0a0a0a",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 9999, padding: "32px 24px",
      }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⚡</div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 28, fontWeight: 900, color: "#e8ff00",
          letterSpacing: 3, textAlign: "center", marginBottom: 8,
        }}>
          ELIMINA LOS ANUNCIOS
        </div>
        <div style={{
          color: "rgba(255,255,255,0.5)", fontSize: 14,
          textAlign: "center", marginBottom: 28, lineHeight: 1.6,
        }}>
          Hazte Pro y entrena sin interrupciones.{"\n"}
          Además desbloqueas gráficos, PRs avanzados y mucho más.
        </div>

        <button
          onClick={() => { setShowProBanner(false); if (onShowPaywall) onShowPaywall(); else setShowSummary(true); }}
          style={{
            width: "100%", maxWidth: 320, padding: "16px 0",
            borderRadius: 14, background: "#e8ff00",
            color: "#000", fontWeight: 900, fontSize: 18,
            border: "none", cursor: "pointer",
            fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
            marginBottom: 10,
          }}
        >
          ⚡ HAZTE PRO
        </button>

        <button
          onClick={() => { setShowProBanner(false); setShowSummary(true); }}
          style={{
            width: "100%", maxWidth: 320, padding: "12px 0",
            borderRadius: 14, background: "transparent",
            color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer", fontSize: 13,
          }}
        >
          Ahora no
        </button>
      </div>
    );
  }

  // ── ANUNCIO INTERSTICIAL (solo free) ────────────────────────────────────────
  if (showAdOverlay) {
    return (
      <div style={{
        position: "fixed", inset: 0, background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        zIndex: 9999,
      }}>
        {/* Espacio reservado para el anuncio nativo de AdMob */}
        <div style={{
          width: "100%", maxWidth: 360, aspectRatio: "1 / 1",
          background: "#111", borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          border: "1px solid #222",
        }}>
          <div style={{ color: "#444", fontSize: 13, fontFamily: "Barlow, sans-serif" }}>
            Anuncio
          </div>
        </div>

        {/* Botón saltar */}
        <button
          onClick={() => { setShowAdOverlay(false); setShowProBanner(true); }}
          style={{
            marginTop: 20,
            background: adCountdown > 0 ? "#1a1a1a" : "var(--accent)",
            border: `1px solid ${adCountdown > 0 ? "#333" : "var(--accent)"}`,
            color: adCountdown > 0 ? "#555" : "#0a0a0a",
            borderRadius: 10, padding: "10px 24px",
            fontFamily: "Barlow Condensed, sans-serif",
            fontSize: 16, fontWeight: 700, cursor: adCountdown > 0 ? "default" : "pointer",
            transition: "all 0.3s",
            pointerEvents: adCountdown > 0 ? "none" : "auto",
          }}
        >
          {adCountdown > 0 ? `Saltar en ${adCountdown}s` : "Saltar →"}
        </button>
      </div>
    );
  }

  // ── PANTALLA RESUMEN ────────────────────────────────────────────────────────
  if (showSummary) {
    const totalVol = exData.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.done)
        .reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1), 0), 0);
    const completedSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
    const completionPct = exData.length > 0 ? Math.round(completedSets / exData.reduce((a,e)=>a+e.sets.length,0) * 100) : 0;

    // RPE promedio global de la sesión (solo sets completados con RPE registrado)
    const allRpeValues = exData.flatMap(ex =>
      ex.sets.filter(s => s.done).map(s => parseFloat(s.rpe)).filter(v => !isNaN(v) && v > 0)
    );
    const sessionAvgRpe = allRpeValues.length > 0
      ? Math.round((allRpeValues.reduce((a, b) => a + b, 0) / allRpeValues.length) * 10) / 10
      : null;

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
        position: "fixed", inset: 0, background: "var(--bg)",
        display: "flex", flexDirection: "column",
        overflowY: "auto", overflowX: "hidden",
        padding: "28px 20px 100px",
        animation: "fadeIn 0.4s ease",
        zIndex: 400,
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
          gap: 12, maxWidth: 560, width: "100%",
          margin: "0 auto", marginBottom: 28,
        }}>
          {[
            { icon: "⏱️", label: "Tiempo",      value: fmt(elapsed) },
            { icon: "🏋️", label: "Ejercicios",  value: exData.length },
            { icon: "🔢", label: "Series",       value: completedSets },
            { icon: "📦", label: "Volumen",
              value: totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}t` : `${Math.round(totalVol)}kg` },
          ].concat(sessionAvgRpe !== null ? [
            { icon: "🎯", label: "RPE prom.", value: sessionAvgRpe },
          ] : []).map(s => (
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
            const rpeValues = doneS.map(s => parseFloat(s.rpe)).filter(v => !isNaN(v) && v > 0);
            const avgRpe = rpeValues.length > 0
              ? Math.round((rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length) * 10) / 10
              : null;
            const ssCol = ex.supersetGroup ? getSupersetColor(ex.supersetGroup, exData) : null;
            return (
              <div key={i} style={{
                background: "var(--card)",
                border: `1px solid ${ssCol ? ssCol + "40" : "var(--border)"}`,
                borderLeft: ssCol ? `3px solid ${ssCol}` : undefined,
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
              }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <ExerciseGif exName={ex.name} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                      {doneS.length > 0 ? "✓ " : "○ "}{ex.name}
                      {ssCol && (
                        <span style={{ background: ssCol, color: "#0a0a0a", fontSize: 8, fontWeight: 900, padding: "1px 5px", borderRadius: 3, letterSpacing: 1 }}>SS</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {doneS.length}/{ex.sets.length} series
                      {maxW > 0 && ` · máx ${maxW}kg`}
                      {best1rm > 0 && ` · ~${best1rm}kg 1RM`}
                      {avgRpe !== null && (
                        <span style={{
                          marginLeft: 6,
                          color: "rgba(232,255,0,0.8)",
                          fontWeight: 700,
                        }}>
                          · RPE {avgRpe}
                        </span>
                      )}
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
                        {s.rpe ? <span style={{ color: "rgba(232,255,0,0.7)", marginLeft: 3 }}>@{s.rpe}</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
                {ex.notes && (
                  <div style={{
                    marginTop: 8, paddingTop: 8,
                    borderTop: "1px solid var(--border)",
                    fontSize: 12, color: "var(--text-muted)",
                    fontStyle: "italic",
                    display: "flex", alignItems: "flex-start", gap: 6,
                  }}>
                    <span style={{ flexShrink: 0 }}>📝</span>
                    <span>{ex.notes}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Action buttons — sticky al fondo */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          padding: "12px 20px calc(12px + env(safe-area-inset-bottom, 0px))",
          background: "linear-gradient(to top, var(--bg) 80%, transparent)",
          display: "flex", gap: 12, maxWidth: 560, margin: "0 auto",
          width: "100%", boxSizing: "border-box",
          zIndex: 10,
        }}>
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
                .map(ex => ({
                  ...ex,
                  sets: ex.sets.filter(s => {
                    const w = parseFloat(s.weight) || 0;
                    const r = parseFloat(s.reps) || 0;
                    return w > 0 || r > 0;
                  })
                }))
                .filter(ex => ex.sets.length > 0);

              if (finalExercises.length === 0) {
                alert("⚠️ Agrega al menos una serie con peso o repeticiones antes de guardar.");
                return;
              }

              if (isFree) {
                showInterstitial().finally(() => {
                  onSaveSession(finalExercises, elapsed);
                });
              } else {
                onSaveSession(finalExercises, elapsed);
              }
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
    <>
<div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 400, overflowY: "auto", paddingBottom: 70 }}>      {/* ── Sticky header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", paddingTop: "calc(10px + env(safe-area-inset-top, 0px))",
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0, position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
      }}>
        <button
          onClick={async () => {
            const hasDone = exData.some(ex => ex.sets.some(s => s.done));
            if (hasDone) {
              const ok = await askConfirm("¿Salir del entrenamiento? El borrador guardado se eliminará.");
              if (!ok) return;
            }
            try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {}
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
      <div style={{ height: "calc(57px + env(safe-area-inset-top, 0px))", flexShrink: 0 }} />
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
        display: "flex", gap: 4, padding: "10px 16px 0",
        overflowX: "auto", flexShrink: 0, scrollbarWidth: "none", alignItems: "center",
      }}>
        {exData.map((ex, i) => {
          const allDone = ex.sets.every(s => s.done) && ex.sets.length > 0;
          const anyDone = ex.sets.some(s => s.done);
          const ssGroup = getSupersetGroupForIndex(exData, i);
          const ssColor = ssGroup ? getSupersetColor(ssGroup.groupId, exData) : null;
          const isFirstInGroup = ssGroup && ssGroup.indices[0] === i;
          const isLastInGroup = ssGroup && ssGroup.indices[ssGroup.indices.length - 1] === i;

          return (
            <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              {/* Superset bracket: left side */}
              {isFirstInGroup && (
                <div style={{
                  width: 4, height: 32, borderTop: `2px solid ${ssColor}`,
                  borderLeft: `2px solid ${ssColor}`, borderBottom: `none`,
                  borderRadius: "4px 0 0 0", marginRight: 2, opacity: 0.7,
                }} />
              )}
              {ssGroup && !isFirstInGroup && (
                <div style={{ width: 4, borderLeft: `2px solid ${ssColor}`, height: 32, marginRight: 2, opacity: 0.5 }} />
              )}

              <button onClick={() => setCurrentEx(i)} style={{
                background: currentEx === i
                  ? (ssColor || "var(--accent)")
                  : allDone ? "rgba(232,255,0,0.08)"
                  : anyDone ? "rgba(232,255,0,0.04)"
                  : "var(--card)",
                border: `1px solid ${currentEx === i
                  ? (ssColor || "var(--accent)")
                  : ssColor && (allDone || anyDone) ? ssColor + "60"
                  : ssColor ? ssColor + "40"
                  : allDone ? "rgba(232,255,0,0.3)"
                  : "var(--border)"}`,
                color: currentEx === i ? "#0a0a0a" : allDone ? "var(--accent)" : "var(--text-muted)",
                borderRadius: 4, padding: "6px 10px", cursor: "pointer",
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 900,
                whiteSpace: "nowrap", letterSpacing: 1, textTransform: "uppercase",
                position: "relative",
              }}>
                {ssGroup && (
                  <span style={{
                    position: "absolute", top: -6, right: -4,
                    background: ssColor, color: "#0a0a0a",
                    fontSize: 7, fontWeight: 900, padding: "1px 4px",
                    borderRadius: 3, letterSpacing: 0.5,
                  }}>SS</span>
                )}
                {allDone ? "✓ " : anyDone ? "◑ " : ""}{ex.name}
              </button>

              {/* Superset bracket: right side */}
              {isLastInGroup && (
                <div style={{
                  width: 4, height: 32, borderTop: `2px solid ${ssColor}`,
                  borderRight: `2px solid ${ssColor}`, borderBottom: `none`,
                  borderRadius: "0 4px 0 0", marginLeft: 2, opacity: 0.7,
                }} />
              )}
              {ssGroup && !isLastInGroup && (
                <div style={{ width: 4, borderRight: `2px solid ${ssColor}`, height: 32, marginLeft: 2, opacity: 0.5 }} />
              )}
            </div>
          );
        })}
      </div>


      {/* Current exercise panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {exData[currentEx] && (() => {
          const ex = exData[currentEx];
          const doneCount = ex.sets.filter(s => s.done).length;
          const ssGroup = getSupersetGroupForIndex(exData, currentEx);
          const ssColor = ssGroup ? getSupersetColor(ssGroup.groupId, exData) : null;
          const myPosInGroup = ssGroup ? ssGroup.indices.indexOf(currentEx) : -1;
          const nextInGroupIdx = ssGroup ? ssGroup.indices[myPosInGroup + 1] : null;
          const prevInGroupIdx = ssGroup ? ssGroup.indices[myPosInGroup - 1] : null;

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

              {/* ── SUPERSET BANNER ── */}
              {ssGroup && (
                <div style={{
                  background: `${ssColor}12`,
                  border: `1px solid ${ssColor}50`,
                  borderRadius: 10, padding: "8px 14px", marginBottom: 14,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    background: ssColor, color: "#0a0a0a",
                    fontSize: 9, fontWeight: 900, padding: "2px 8px",
                    borderRadius: 4, letterSpacing: 1.5, flexShrink: 0,
                  }}>
                    SUPERSET
                  </div>
                  <div style={{ flex: 1, fontSize: 11, color: "var(--text-muted)", lineHeight: 1.3 }}>
                    {ssGroup.indices.map((idx, pos) => (
                      <span key={idx}>
                        <span
                          onClick={() => setCurrentEx(idx)}
                          style={{
                            color: idx === currentEx ? ssColor : "var(--text-muted)",
                            fontWeight: idx === currentEx ? 800 : 400,
                            cursor: "pointer",
                            textDecoration: idx === currentEx ? "none" : "underline transparent",
                          }}
                        >
                          {exData[idx]?.name}
                        </span>
                        {pos < ssGroup.indices.length - 1 && (
                          <span style={{ margin: "0 6px", opacity: 0.4 }}>→</span>
                        )}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 10, color: ssColor, fontWeight: 700, flexShrink: 0 }}>
                    {myPosInGroup + 1}/{ssGroup.indices.length}
                  </div>
                </div>
              )}

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

                  {/* ── Historial reciente del ejercicio ── */}
                  <ExerciseHistoryBadge
                    sessions={sessions}
                    exName={ex.name}
                    unit={unit || "kg"}
                  />

              </div>

              {/* ── CALENTAMIENTO SUGERIDO ── */}
              {(() => {
                const baseWeight = getWarmupBaseWeight(currentEx);
                const warmupSets = getWarmupSets(baseWeight);
                const isOpen = warmupOpen[currentEx];
                const hasHistory = baseWeight > 0;
                const histBased = (() => {
                  const ex = exData[currentEx];
                  for (const s of ex.sets) { if (parseFloat(s.weight) > 0) return false; }
                  return hasHistory;
                })();
                return (
                  <div style={{ marginBottom: 14 }}>
                    {/* Toggle button */}
                    <button
                      onClick={() => toggleWarmup(currentEx)}
                      style={{
                        width: "100%",
                        background: isOpen
                          ? "rgba(255,140,0,0.08)"
                          : "none",
                        border: isOpen
                          ? "1px solid rgba(255,140,0,0.35)"
                          : "1px dashed rgba(255,140,0,0.3)",
                        borderRadius: isOpen ? "12px 12px 0 0" : 12,
                        padding: "9px 14px",
                        cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 8,
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: 16, flexShrink: 0 }}>🔥</span>
                      <span style={{
                        flex: 1, textAlign: "left",
                        fontFamily: "Barlow Condensed, sans-serif",
                        fontSize: 14, fontWeight: 800, letterSpacing: 1,
                        color: "rgba(255,160,0,0.9)",
                        textTransform: "uppercase",
                      }}>
                        Calentamiento sugerido
                      </span>
                      {histBased && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
                          color: "rgba(255,140,0,0.6)",
                          background: "rgba(255,140,0,0.1)",
                          border: "1px solid rgba(255,140,0,0.25)",
                          borderRadius: 4, padding: "2px 6px",
                          textTransform: "uppercase",
                        }}>
                          Basado en historial
                        </span>
                      )}
                      {!hasHistory && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, letterSpacing: 1,
                          color: "rgba(255,255,255,0.3)",
                          textTransform: "uppercase",
                        }}>
                          Ingresa un peso para ver kg
                        </span>
                      )}
                      <span style={{
                        fontSize: 12, color: "rgba(255,160,0,0.6)",
                        transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s", flexShrink: 0,
                      }}>▼</span>
                    </button>

                    {/* Expanded warmup panel */}
                    {isOpen && (
                      <div style={{
                        background: "rgba(255,140,0,0.04)",
                        border: "1px solid rgba(255,140,0,0.25)",
                        borderTop: "none",
                        borderRadius: "0 0 12px 12px",
                        padding: "2px 0 10px",
                        overflow: "hidden",
                      }}>
                        {/* Info strip */}
                        <div style={{
                          padding: "7px 14px 10px",
                          borderBottom: "1px solid rgba(255,140,0,0.12)",
                          marginBottom: 6,
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", lineHeight: 1.4 }}>
                            {hasHistory
                              ? `Basado en ${baseWeight}${unit} de trabajo${histBased ? " (historial)" : ""} · No se guarda en la sesión`
                              : "Porcentajes genéricos · Ingresa un peso arriba para ver kg reales · No se guarda en la sesión"}
                          </span>
                        </div>

                        {/* Column headers */}
                        <div style={{
                          display: "grid", gridTemplateColumns: "36px 1fr 1fr 1fr",
                          gap: 6, padding: "0 14px 4px",
                        }}>
                          {["#", `Peso (${unit})`, "Reps", "Tipo"].map(h => (
                            <div key={h} style={{
                              fontSize: 9, fontWeight: 700,
                              color: "rgba(255,140,0,0.4)",
                              textAlign: "center", letterSpacing: 1,
                              textTransform: "uppercase",
                            }}>{h}</div>
                          ))}
                        </div>

                        {/* Warmup rows */}
                        {warmupSets.map((ws, wi) => (
                          <div key={wi} style={{
                            display: "grid", gridTemplateColumns: "36px 1fr 1fr 1fr",
                            gap: 6, padding: "5px 14px",
                            alignItems: "center",
                            borderBottom: wi < warmupSets.length - 1 ? "1px solid rgba(255,140,0,0.08)" : "none",
                          }}>
                            {/* Series number */}
                            <div style={{
                              textAlign: "center",
                              fontFamily: "Barlow Condensed, sans-serif",
                              fontSize: 13, fontWeight: 800,
                              color: "rgba(255,140,0,0.5)",
                            }}>
                              W{wi + 1}
                            </div>

                            {/* Weight */}
                            <div style={{
                              background: "rgba(255,140,0,0.07)",
                              border: "1px solid rgba(255,140,0,0.18)",
                              borderRadius: 8, padding: "7px 4px",
                              textAlign: "center",
                              fontFamily: "Barlow Condensed, sans-serif",
                              fontSize: 15, fontWeight: 800,
                              color: ws.weight ? "rgba(255,160,0,0.85)" : "rgba(255,255,255,0.25)",
                            }}>
                              {ws.weight ? ws.weight : `${ws.pct}%`}
                            </div>

                            {/* Reps */}
                            <div style={{
                              background: "rgba(255,140,0,0.07)",
                              border: "1px solid rgba(255,140,0,0.18)",
                              borderRadius: 8, padding: "7px 4px",
                              textAlign: "center",
                              fontFamily: "Barlow Condensed, sans-serif",
                              fontSize: 15, fontWeight: 800,
                              color: "rgba(255,160,0,0.75)",
                            }}>
                              {ws.reps}
                            </div>

                            {/* Label */}
                            <div style={{
                              textAlign: "center",
                              fontSize: 9, fontWeight: 700,
                              letterSpacing: 0.8,
                              textTransform: "uppercase",
                              color: "rgba(255,140,0,0.45)",
                              lineHeight: 1.3,
                            }}>
                              {ws.label}
                              <div style={{ fontSize: 8, opacity: 0.7, fontWeight: 600, letterSpacing: 0, textTransform: "none" }}>
                                {ws.pct}% 1RM
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Footer note */}
                        <div style={{
                          margin: "8px 14px 0",
                          padding: "6px 10px",
                          background: "rgba(255,140,0,0.06)",
                          border: "1px solid rgba(255,140,0,0.12)",
                          borderRadius: 8,
                          fontSize: 10, color: "rgba(255,255,255,0.3)",
                          display: "flex", alignItems: "center", gap: 6,
                        }}>
                          <span style={{ flexShrink: 0, opacity: 0.6 }}>💡</span>
                          Completa las series W antes de comenzar tus series reales. Aumenta el peso gradualmente.
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Sets table */}
              <div style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 14, overflow: "hidden", marginBottom: 10,
              }}>
                {/* Header row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 1fr 44px 56px",
                  gap: 6, padding: "9px 14px",
                  background: "var(--input-bg)", borderBottom: "1px solid var(--border)",
                }}>
                  {["#", `Peso (${unit})`, "Reps", "RPE", "✓"].map(h => (
                    <div key={h} style={{
                      fontSize: 10, fontWeight: 700,
                      color: h === "RPE" ? "rgba(232,255,0,0.5)" : "var(--text-muted)",
                      textAlign: "center", letterSpacing: 1, textTransform: "uppercase",
                    }}>
                      {h}
                      {h === "RPE" && (
                        <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: 0, marginTop: 1, opacity: 0.6, textTransform: "none" }}>
                          1–10
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Set rows */}
                {ex.sets.map((s, j) => (
                  <div key={s.id} style={{
                    display: "grid", gridTemplateColumns: "36px 1fr 1fr 44px 56px",
                    gap: 6, padding: "9px 14px", alignItems: "center",
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
                    {/* RPE — campo opcional compacto */}
                    <input
                      value={s.rpe || ""}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        const n = parseInt(raw);
                        const val = raw === "" ? "" : isNaN(n) ? "" : String(Math.min(Math.max(n, 1), 10));
                        updateSet(currentEx, j, "rpe", val);
                      }}
                      placeholder="—"
                      inputMode="numeric"
                      maxLength={2}
                      style={{
                        background: s.rpe ? "rgba(232,255,0,0.06)" : "var(--input-bg)",
                        border: `1px solid ${s.rpe ? "rgba(232,255,0,0.35)" : "var(--border)"}`,
                        borderRadius: 8, padding: "8px 4px", color: s.rpe ? "var(--accent)" : "var(--text-muted)",
                        fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, fontWeight: 800,
                        textAlign: "center", outline: "none", width: "100%",
                        transition: "border-color 0.2s, color 0.2s",
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

              {/* ── Nota del ejercicio ── */}
              <div style={{ marginBottom: 18 }}>
                {!noteOpen[currentEx] ? (
                  <button
                    onClick={() => toggleNote(currentEx)}
                    style={{
                      background: "none",
                      border: ex.notes ? "1px solid rgba(232,255,0,0.25)" : "1px dashed rgba(255,255,255,0.1)",
                      color: ex.notes ? "var(--accent)" : "var(--text-muted)",
                      borderRadius: 10, padding: "7px 14px",
                      cursor: "pointer", fontFamily: "Barlow, sans-serif",
                      fontSize: 12, fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 6,
                      width: "100%",
                    }}
                  >
                    <span>📝</span>
                    <span>{ex.notes ? ex.notes.slice(0, 40) + (ex.notes.length > 40 ? "…" : "") : "Agregar nota"}</span>
                  </button>
                ) : (
                  <div style={{
                    background: "var(--card)",
                    border: "1px solid rgba(232,255,0,0.2)",
                    borderRadius: 12, padding: "10px 12px",
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", marginBottom: 8,
                    }}>
                      <span style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: 2,
                        color: "rgba(232,255,0,0.6)", textTransform: "uppercase",
                      }}>📝 Nota</span>
                      <button
                        onClick={() => toggleNote(currentEx)}
                        style={{
                          background: "none", border: "none",
                          color: "var(--text-muted)", cursor: "pointer",
                          fontSize: 12, padding: "0 4px",
                        }}
                      >✕</button>
                    </div>
                    <textarea
                      autoFocus
                      value={ex.notes || ""}
                      onChange={e => updateExNote(currentEx, e.target.value)}
                      placeholder="ej: sentí el hombro raro · grip neutro · subir peso próxima vez"
                      maxLength={200}
                      rows={3}
                      style={{
                        width: "100%", background: "var(--input-bg)",
                        border: "1px solid var(--border)",
                        borderRadius: 8, padding: "8px 10px",
                        color: "var(--text)", fontFamily: "Barlow, sans-serif",
                        fontSize: 13, lineHeight: 1.5,
                        outline: "none", resize: "none", boxSizing: "border-box",
                      }}
                    />
                    <div style={{
                      textAlign: "right", fontSize: 10,
                      color: (ex.notes?.length || 0) >= 180 ? "#ef4444" : "var(--text-muted)",
                      marginTop: 4,
                    }}>
                      {ex.notes?.length || 0}/200
                    </div>
                  </div>
                )}
              </div>

              {/* Inline rest timer */}
              <div style={{
                background: "var(--card)", border: `1px solid ${restTimer ? (ssColor || "var(--accent)") : "var(--border)"}`,
                borderRadius: 12, padding: "11px 14px", marginBottom: 18,
                transition: "border-color 0.3s",
              }}>
                {restTimer ? (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: ssColor || "var(--accent)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 4 }}>
                      {ssGroup ? "⚡ DESCANSANDO ENTRE RONDAS" : "DESCANSANDO"}
                    </div>
                    {ssGroup && (
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, lineHeight: 1.4 }}>
                        Completaste la ronda del superset. Descansa y vuelve a empezar.
                      </div>
                    )}
                    <div style={{ height: 5, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", background: ssColor || "var(--accent)", borderRadius: 10, width: `${(restTimer.left / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <button onClick={() => setRestTimer(t => ({ ...t, left: Math.max(0, t.left - 15), total: Math.max(15, t.total - 15) }))}
                        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>−15s</button>
                      <div style={{ flex: 1, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 34, fontWeight: 800, color: ssColor || "var(--accent)" }}>
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
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>DESCANSO</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {REST_OPTS_LIVE.map(o => {
                        const isDefault = o.secs === defaultRest;
                        return (
                          <button key={o.label}
                            onClick={() => { saveDefaultRest(o.secs); startRest(o.secs); }}
                            style={{
                              background: isDefault ? "var(--accent-dim)" : "var(--input-bg)",
                              border: `1px solid ${isDefault ? "var(--accent)" : "var(--border)"}`,
                              borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                              color: isDefault ? "var(--accent)" : "var(--text-muted)",
                              fontSize: 12, fontWeight: isDefault ? 800 : 600,
                              fontFamily: "Barlow, sans-serif",
                            }}>
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Superset grouping controls ── */}
              <div style={{ marginBottom: 14 }}>
                {ssGroup ? (
                  // Already in a superset — show "remove from superset" option
                  <button
                    onClick={() => removeFromSuperset(currentEx)}
                    style={{
                      width: "100%", background: "none",
                      border: `1px solid ${ssColor}40`,
                      color: ssColor, borderRadius: 10, padding: "8px 12px",
                      cursor: "pointer", fontFamily: "Barlow, sans-serif",
                      fontSize: 12, fontWeight: 600, display: "flex",
                      alignItems: "center", justifyContent: "center", gap: 6,
                    }}
                  >
                    <span style={{ opacity: 0.7 }}>⊖</span> Quitar del superset
                  </button>
                ) : (
                  // Not in a superset — offer to group with adjacent exercise
                  <div style={{ display: "flex", gap: 6 }}>
                    {currentEx > 0 && !exData[currentEx - 1]?.supersetGroup && (
                      <button
                        onClick={() => groupAsSuperset(currentEx - 1, currentEx)}
                        style={{
                          flex: 1, background: "none",
                          border: "1px dashed rgba(232,255,0,0.25)",
                          color: "var(--text-muted)", borderRadius: 10, padding: "8px 6px",
                          cursor: "pointer", fontFamily: "Barlow, sans-serif",
                          fontSize: 11, fontWeight: 600, textAlign: "center",
                        }}
                      >
                        ⚡ SS con anterior
                      </button>
                    )}
                    {currentEx > 0 && exData[currentEx - 1]?.supersetGroup && (
                      <button
                        onClick={() => addToExistingSuperset(exData[currentEx - 1].supersetGroup, currentEx)}
                        style={{
                          flex: 1, background: "none",
                          border: `1px dashed ${getSupersetColor(exData[currentEx - 1].supersetGroup, exData)}60`,
                          color: getSupersetColor(exData[currentEx - 1].supersetGroup, exData),
                          borderRadius: 10, padding: "8px 6px",
                          cursor: "pointer", fontFamily: "Barlow, sans-serif",
                          fontSize: 11, fontWeight: 600, textAlign: "center",
                        }}
                      >
                        + Unir al SS anterior
                      </button>
                    )}
                    {currentEx < exData.length - 1 && !exData[currentEx + 1]?.supersetGroup && (
                      <button
                        onClick={() => groupAsSuperset(currentEx, currentEx + 1)}
                        style={{
                          flex: 1, background: "none",
                          border: "1px dashed rgba(232,255,0,0.25)",
                          color: "var(--text-muted)", borderRadius: 10, padding: "8px 6px",
                          cursor: "pointer", fontFamily: "Barlow, sans-serif",
                          fontSize: 11, fontWeight: 600, textAlign: "center",
                        }}
                      >
                        ⚡ SS con siguiente
                      </button>
                    )}
                    {currentEx < exData.length - 1 && exData[currentEx + 1]?.supersetGroup && (
                      <button
                        onClick={() => addToExistingSuperset(exData[currentEx + 1].supersetGroup, currentEx)}
                        style={{
                          flex: 1, background: "none",
                          border: `1px dashed ${getSupersetColor(exData[currentEx + 1].supersetGroup, exData)}60`,
                          color: getSupersetColor(exData[currentEx + 1].supersetGroup, exData),
                          borderRadius: 10, padding: "8px 6px",
                          cursor: "pointer", fontFamily: "Barlow, sans-serif",
                          fontSize: 11, fontWeight: 600, textAlign: "center",
                        }}
                      >
                        + Unir al SS siguiente
                      </button>
                    )}
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
                    onClick={() => {
                      const ex = exData[currentEx];
                      const hasAnySeries = ex.sets.some(s => s.done);
                      if (!hasAnySeries) {
                        alert("⚠️ Completa al menos una serie antes de continuar.");
                        return;
                      }
                      setCurrentEx(i => i + 1);
                    }}
                    style={{
                      flex: 2,
                      background: ssGroup && nextInGroupIdx !== null && exData[nextInGroupIdx] ? `${ssColor}20` : "var(--accent)",
                      border: ssGroup && nextInGroupIdx !== null && exData[nextInGroupIdx] ? `2px solid ${ssColor}` : "none",
                      color: ssGroup && nextInGroupIdx !== null && exData[nextInGroupIdx] ? ssColor : "#0a0a0a",
                      borderRadius: 10, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 17, fontWeight: 700,
                    }}
                  >
                    {(() => {
                      const isNextInSS = ssGroup && nextInGroupIdx !== null && exData[nextInGroupIdx];
                      if (isNextInSS) return `⚡ ${exData[nextInGroupIdx].name} →`;
                      return "Siguiente →";
                    })()}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const ex = exData[currentEx];
                      const hasAnySeries = ex.sets.some(s => s.done);
                      if (!hasAnySeries) {
                        alert("⚠️ Completa al menos una serie antes de finalizar.");
                        return;
                      }
                      setRunning(false);
                      setShowSummary(true);
                    }}
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
      {confirmModal}
    </>
  );
}


export default LiveTrainMode;