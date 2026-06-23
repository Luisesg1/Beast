import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./ConfirmModal";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { showCoachIARewardedAd } from "../useAdMob";
import { calc1RM } from "../utils/gymCalcs";
import { track } from "../utils/analytics";

// ── Helpers ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);


function getPRs(sessions) {
  const prs = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(ex.weight) || 0;
    const r = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(ex.reps) || 0;
    const rm = calc1RM(w, r);
    if (!prs[ex.name] || rm > prs[ex.name].rm) prs[ex.name] = { rm, weight: w, reps: r, date: s.date };
  }));
  return prs;
}

function buildContext(sessions, bodyStats) {
  const recent = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20);
  const prs = getPRs(sessions);
  const today = new Date();

  // Frecuencia por músculo (últimas 4 semanas)
  const muscleMap = {};
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 28);
  recent.forEach(s => {
    if (new Date(s.date + "T00:00:00") >= cutoff) {
      (s.exercises || []).forEach(ex => {
        const m = ex.muscle || "Otro";
        muscleMap[m] = (muscleMap[m] || 0) + 1;
      });
    }
  });

  // Días desde última sesión
  const lastDate = recent[0]?.date;
  const daysSince = lastDate ? Math.floor((today - new Date(lastDate + "T00:00:00")) / 86400000) : null;

  // Volumen últimas 2 semanas
  const vol2w = recent
    .filter(s => (today - new Date(s.date + "T00:00:00")) / 86400000 <= 14)
    .reduce((acc, s) => acc + (s.exercises || []).reduce((a, ex) => {
      if (ex.sets?.length > 0) return a + ex.sets.reduce((x, st) => x + (parseFloat(st.weight) || 0) * (parseFloat(st.reps) || 1), 0);
      return a + (parseFloat(ex.weight) || 0) * (parseFloat(ex.reps) || 1);
    }, 0), 0);

  const sessionsSummary = recent.slice(0, 10).map(s => ({
    date: s.date,
    workout: s.workout,
    exercises: (s.exercises || []).map(ex => ({
      name: ex.name,
      sets: ex.sets ? ex.sets.map(st => `${st.weight}kg×${st.reps}`).join(", ") : `${ex.weight}kg×${ex.reps}`,
    })),
  }));

  const topPRs = Object.entries(prs)
    .sort((a, b) => b[1].rm - a[1].rm)
    .slice(0, 10)
    .map(([name, d]) => `${name}: ${d.rm}kg 1RM`);

  const latestWeight = bodyStats?.entries?.slice(-1)[0]?.weight;

  return `Eres BRUX, coach de gimnasio experto dentro de la app GymTracker. Hablas en español neutro latino — sin "vos", sin "che", sin "boludo", sin expresiones argentinas ni rioplatenses. Usa "tú" siempre. Eres directo, motivador y conciso — máximo 3-4 oraciones por respuesta salvo que te pidan un plan detallado. No uses asteriscos para negritas, usa mayúsculas para énfasis si acaso.

IMPORTANTE: Solo respondes preguntas sobre entrenamiento, gimnasio, nutrición deportiva, recuperación, progreso físico y datos del usuario. Si te preguntan algo fuera de ese ámbito (política, tecnología, etc.), responde: "Solo puedo ayudarte con tu entrenamiento. ¿Qué quieres mejorar hoy?"

RUTINAS USABLES: Cuando el usuario pida una rutina o plan de entrenamiento para ejecutar (no solo informativo), DEBES incluir al final de tu respuesta un bloque JSON con este formato EXACTO (sin espacios extra, en una sola línea):
ROUTINE_JSON:{"name":"Nombre del entrenamiento","exercises":[{"name":"Nombre Ejercicio","sets":3,"weight":"20","reps":"10"}]}
- "name": nombre corto del entrenamiento (ej: "Pecho y Tríceps", "Full Body", "Piernas")
- "exercises": array con cada ejercicio. "sets" es número entero, "weight" y "reps" son strings.
- Usa pesos realistas basados en el historial del usuario si están disponibles, si no usa valores iniciales moderados.
- Solo incluye el bloque ROUTINE_JSON cuando sea una rutina ejecutable, no en consejos generales.

DATOS DEL USUARIO:
- Total sesiones: ${sessions.length}
- Última sesión: ${lastDate || "nunca"} (${daysSince !== null ? `hace ${daysSince} días` : "sin datos"})
- Volumen últimas 2 semanas: ${Math.round(vol2w / 1000 * 10) / 10}t
- Peso corporal: ${latestWeight ? latestWeight + "kg" : "no registrado"}
- Músculos trabajados (últimas 4 semanas): ${Object.entries(muscleMap).map(([m, n]) => `${m}(${n})`).join(", ") || "ninguno"}
- Top PRs: ${topPRs.join(", ") || "ninguno aún"}

ÚLTIMAS 10 SESIONES:
${sessionsSummary.map(s => `[${s.date}] ${s.workout}: ${s.exercises.map(e => `${e.name}(${e.sets})`).join(" | ")}`).join("\n")}`;
}

const FREE_DAILY_LIMIT = 3;
const STORAGE_KEY = "gym_ai_usage";
const CHAT_HISTORY_KEY = "gym_ai_history";
const MAX_SAVED_MESSAGES = 30; // guardar últimos 30 mensajes

function getUsageKey(uid) {
  return uid ? `${STORAGE_KEY}_${uid}` : STORAGE_KEY;
}
function getUsage(uid) {
  try {
    const raw = localStorage.getItem(getUsageKey(uid));
    if (!raw) return { date: todayStr(), count: 0 };
    const parsed = JSON.parse(raw);
    if (parsed.date !== todayStr()) return { date: todayStr(), count: 0 };
    return parsed;
  } catch { return { date: todayStr(), count: 0 }; }
}

function incrementUsage(uid) {
  const u = getUsage(uid);
  const next = { date: todayStr(), count: u.count + 1 };
  localStorage.setItem(getUsageKey(uid), JSON.stringify(next));
  return next.count;
}

function loadHistory(userId) {
  try {
    const key = `${CHAT_HISTORY_KEY}_${userId || "guest"}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(userId, messages) {
  try {
    const key = `${CHAT_HISTORY_KEY}_${userId || "guest"}`;
    const toSave = messages.slice(-MAX_SAVED_MESSAGES);
    localStorage.setItem(key, JSON.stringify(toSave));
  } catch {}
}

// ── Simple markdown renderer ──────────────────────────────────────────────────
function renderMessage(text) {
  const lines = text.split("\n");
  const elements = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) { i++; continue; }

    // Heading **Día X: ...**
    if (line.startsWith("**") && line.endsWith("**")) {
      const content = line.slice(2, -2);
      elements.push(
        <div key={i} style={{ fontWeight: 800, fontSize: 13, color: "var(--accent)", marginTop: elements.length > 0 ? 10 : 0, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {content}
        </div>
      );
      i++; continue;
    }

    // Bold inline **text** anywhere in line
    const hasBold = line.includes("**");
    if (hasBold && !line.startsWith("-")) {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      elements.push(
        <div key={i} style={{ fontWeight: 800, fontSize: 13, color: "var(--accent)", marginTop: 10, marginBottom: 4 }}>
          {parts.map((p, j) => j % 2 === 1 ? <span key={j} style={{ fontWeight: 800 }}>{p}</span> : p)}
        </div>
      );
      i++; continue;
    }

    // List item
    if (line.startsWith("- ") || line.startsWith("• ")) {
      const content = line.slice(2);
      // Render inline bold within list items
      const parts = content.split(/\*\*(.*?)\*\*/g);
      elements.push(
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 3, fontSize: 13 }}>
          <span style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }}>·</span>
          <span>{parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}</span>
        </div>
      );
      i++; continue;
    }

    // Normal paragraph
    const parts = line.split(/\*\*(.*?)\*\*/g);
    elements.push(
      <p key={i} style={{ margin: "0 0 6px", fontSize: 14, lineHeight: 1.5 }}>
        {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

// ── Parse routine from AI response ───────────────────────────────────────────
function parseRoutine(text) {
  const match = text.match(/ROUTINE_JSON:(\{.*\})/);
  if (!match) return null;
  try {
    const data = JSON.parse(match[1]);
    if (!data.name || !Array.isArray(data.exercises) || data.exercises.length === 0) return null;
    return data;
  } catch { return null; }
}

function stripRoutineJson(text) {
  return text.replace(/ROUTINE_JSON:\{.*\}/, "").trim();
}

const QUICK_SUGGESTIONS = [
  { label: "¿Qué músculo descuidé?", emoji: "⚖️" },
  { label: "¿Estoy progresando bien?", emoji: "📈" },
  { label: "Dame una rutina para hoy", emoji: "💪" },
  { label: "¿Cuándo subir peso?", emoji: "🏋️" },
  { label: "¿Estoy en riesgo de sobreentrenamiento?", emoji: "⚠️" },
  { label: "Analiza mis últimas sesiones", emoji: "🔍" },
];

// ── Brux Avatar ─────────────────────────────────────────────────────────────
function BruxAvatar({ size = 32 }) {
  const vb = "5 10 90 90";
  return (
    <svg width={size} height={size} viewBox={vb} xmlns="http://www.w3.org/2000/svg">
      {/* Torso */}
      <rect x="28" y="52" width="44" height="38" rx="4" fill="#1a1a1a" stroke="#222" strokeWidth="1.5"/>
      {/* Shoulders */}
      <ellipse cx="22" cy="58" rx="12" ry="10" fill="#1d1d1d" stroke="#222" strokeWidth="1"/>
      <ellipse cx="78" cy="58" rx="12" ry="10" fill="#1d1d1d" stroke="#222" strokeWidth="1"/>
      {/* Upper arms */}
      <rect x="8" y="56" width="16" height="28" rx="6" fill="#161616" stroke="#1e1e1e" strokeWidth="1"/>
      <rect x="76" y="56" width="16" height="28" rx="6" fill="#161616" stroke="#1e1e1e" strokeWidth="1"/>
      {/* Bicep bumps */}
      <ellipse cx="16" cy="66" rx="7" ry="9" fill="#202020" stroke="#2a2a2a" strokeWidth="0.8"/>
      <ellipse cx="84" cy="66" rx="7" ry="9" fill="#202020" stroke="#2a2a2a" strokeWidth="0.8"/>
      {/* Fists */}
      <rect x="9" y="82" width="14" height="10" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="1"/>
      <rect x="77" y="82" width="14" height="10" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="1"/>
      {/* Pecs */}
      <path d="M30 55 Q30 72 48 74 L50 74 L50 55 Z" fill="#202020" stroke="#282828" strokeWidth="0.5"/>
      <path d="M70 55 Q70 72 52 74 L50 74 L50 55 Z" fill="#1e1e1e" stroke="#282828" strokeWidth="0.5"/>
      {/* Abs */}
      <rect x="33" y="76" width="13" height="8" rx="2" fill="#161616" stroke="#1e1e1e" strokeWidth="0.5"/>
      <rect x="54" y="76" width="13" height="8" rx="2" fill="#161616" stroke="#1e1e1e" strokeWidth="0.5"/>
      {/* Neck */}
      <rect x="42" y="42" width="16" height="12" rx="2" fill="#161616"/>
      {/* Head */}
      <rect x="30" y="14" width="40" height="30" rx="7" fill="#1a1a1a" stroke="#222" strokeWidth="1.5"/>
      {/* Face screen */}
      <rect x="34" y="18" width="32" height="22" rx="4" fill="#16a34a"/>
      {/* Eyes */}
      <rect x="37" y="21" width="10" height="7" rx="2" fill="#DFFF00"/>
      <rect x="53" y="21" width="10" height="7" rx="2" fill="#DFFF00"/>
      {/* Pupils */}
      <rect x="40" y="23" width="4" height="3" rx="1" fill="#09090B"/>
      <rect x="56" y="23" width="4" height="3" rx="1" fill="#09090B"/>
      {/* Mouth grill */}
      <rect x="38" y="31" width="24" height="7" rx="2" fill="#0a1a0f"/>
      <line x1="40" y1="33" x2="60" y2="33" stroke="#22c55e" strokeWidth="0.8" opacity="0.8"/>
      <line x1="40" y1="36" x2="60" y2="36" stroke="#22c55e" strokeWidth="0.8" opacity="0.5"/>
      {/* Chest lights */}
      <circle cx="38" cy="60" r="2" fill="#22c55e"/>
      <circle cx="62" cy="60" r="2" fill="#22c55e"/>
      {/* Legs */}
      <rect x="32" y="88" width="16" height="10" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="0.8"/>
      <rect x="52" y="88" width="16" height="10" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="0.8"/>
      {/* Boots */}
      <rect x="30" y="96" width="20" height="4" rx="2" fill="#DFFF00" opacity="0.7"/>
      <rect x="50" y="96" width="20" height="4" rx="2" fill="#DFFF00" opacity="0.7"/>
    </svg>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AIChatModal({ onClose, sessions, bodyStats, user, isPro, onUseRoutine, onSaveRoutine }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const [messages, setMessages] = useState(() => loadHistory(user?.uid));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState(getUsage(user?.uid));
  const [showAdPrompt, setShowAdPrompt] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [adWatched, setAdWatched] = useState(false);
  const [adUnlockMsg, setAdUnlockMsg] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const initializedRef = useRef(false);

  // Guardar historial cada vez que cambian los mensajes
  useEffect(() => {
    if (messages.length > 0) saveHistory(user?.uid, messages);
  }, [messages]);

  const remaining = isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - usage.count);
  const canAsk = isPro || remaining > 0 || adWatched;

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Opening analysis — solo si no hay historial previo
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    if (messages.length > 0) return; // ya hay historial, no repetir saludo
    if (sessions.length === 0) {
      setMessages([{
        role: "assistant",
        text: "No hay sesiones registradas todavía. Registra tu primer entrenamiento y vuelve para que pueda analizarlo.",
      }]);
      return;
    }
    // Mensaje inicial dinámico según contexto del usuario
    const today = new Date();
    const lastSession = [...sessions].sort((a,b) => b.date.localeCompare(a.date))[0];
    const daysSince = lastSession ? Math.floor((today - new Date(lastSession.date + "T00:00:00")) / 86400000) : null;
    const hour = today.getHours();

    const prompts = [
      "Saluda con una frase motivadora corta y pregunta qué necesita el usuario hoy. Una sola oración de saludo, una de pregunta. Sin listar opciones.",
      `El usuario lleva ${daysSince ?? "varios"} días sin entrenar. Motívalo de forma directa y pregunta si está listo para volver. Máximo 2 oraciones.`,
      `Analiza el músculo más trabajado recientemente y sugiere en qué enfocarse hoy para equilibrar. Máximo 2 oraciones, termina con una pregunta.`,
      "Da una frase motivadora potente sobre consistencia y progreso, luego pregunta en qué te puede ayudar hoy. Máximo 2 oraciones.",
      `Basándote en el historial, da UN consejo concreto de mejora para la próxima sesión. Termina preguntando si quiere profundizar. Máximo 2 oraciones.`,
      hour < 12
        ? "Es por la mañana. Saluda con energía para el entrenamiento del día y pregunta qué va a trabajar hoy. Máximo 2 oraciones."
        : hour < 17
        ? "Es por la tarde. Di algo motivador sobre entrenar en este horario y pregunta cómo puedes ayudar. Máximo 2 oraciones."
        : "Es de noche. Felicita al usuario por entrenar tarde y pregunta en qué necesita ayuda. Máximo 2 oraciones.",
    ];

    const seed = today.getDate() + today.getMonth() + sessions.length;
    const prompt = prompts[seed % prompts.length];
    askOpenAI(prompt, true);
  }, []);

  async function askOpenAI(userMessage, isSystem = false) {
    const systemPrompt = buildContext(sessions, bodyStats);
    const history = messages.map(m => ({ role: m.role, content: m.text }));

    if (!isSystem) {
      setMessages(prev => [...prev, { role: "user", text: userMessage }]);
    }
    setLoading(true);

    try {
      const functions = getFunctions();
      const askCoach = httpsCallable(functions, "askCoach");
      const result = await askCoach({
        messages: [
          ...history,
          { role: "user", content: userMessage },
        ],
        systemPrompt,
      });
      const { reply } = result.data;

      setMessages(prev => [...prev, { role: "assistant", text: reply }]);

      if (!isSystem && !isPro) {
        const newCount = incrementUsage(user?.uid);
        setUsage({ date: todayStr(), count: newCount });
        setAdWatched(false);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: "assistant",
        text: "Hubo un error al conectar. Verifica tu conexión e intenta de nuevo.",
        isError: true,
      }]);
    } finally {
      setLoading(false);
      setInitializing(false);
    }
  }

  function handleSend(text) {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    if (!canAsk) {
      setShowAdPrompt(true);
      return;
    }

    setInput("");
    track("ai_chat", { length: msg.length });
    askOpenAI(msg);
  }

  async function handleWatchAd() {
    setWatchingAd(true);
    const rewarded = await showCoachIARewardedAd();
    setWatchingAd(false);
    if (rewarded) {
      setAdWatched(true);
      setShowAdPrompt(false);
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0,
      bottom: "var(--banner-height, 0px)",
      zIndex: 1000,
      background: "rgba(0,0,0,0.85)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      backdropFilter: "blur(4px)",
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        width: "100%", maxWidth: 480,
        height: "85vh",
        background: "var(--bg)",
        borderRadius: "24px 24px 0 0",
        border: "1px solid var(--border)",
        borderBottom: "none",
        display: "flex", flexDirection: "column",
        overflow: "hidden",
        animation: "slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      }}>

        {/* Header */}
        <div style={{
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--border)",
          background: "linear-gradient(135deg, rgba(34,197,94,0.06), transparent)",
          flexShrink: 0,
        }}>
          {/* Fila 1: avatar + nombre + cerrar */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg, #22c55e, #16a34a)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, boxShadow: "0 0 16px rgba(34,197,94,0.35)",
            }}><BruxAvatar size={34} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 1, lineHeight: 1 }}>
                BRUX IA
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                Coach personal · Analiza tu historial
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", fontSize: 22, padding: "4px 6px", lineHeight: 1, flexShrink: 0,
            }}>✕</button>
          </div>
          {/* Fila 2: badge + reiniciar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {!isPro && (
              <div style={{
                fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20,
                background: adWatched ? "rgba(34,197,94,0.15)" : remaining > 0 ? "rgba(223,255,0,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${adWatched ? "rgba(34,197,94,0.4)" : remaining > 0 ? "rgba(223,255,0,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: adWatched ? "#22c55e" : remaining > 0 ? "var(--accent)" : "#ef4444",
              }}>
                {adWatched ? "✅ 1 consulta disponible" : remaining > 0 ? `${remaining} consultas restantes` : "Sin consultas hoy"}
              </div>
            )}
            {isPro && (
              <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#a855f7" }}>
                ✨ {user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : "Pro"} — Ilimitado
              </div>
            )}
            <div style={{ flex: 1 }} />
            {messages.length > 0 && (
              <button onClick={() => {
                askConfirm("¿Reiniciar el chat? Se borrará la conversación.", () => {
                  saveHistory(user?.uid, []);
                  setMessages([]);
                  initializedRef.current = false;
                });
              }} style={{
                background: "none", border: "1px solid var(--border)", borderRadius: 20,
                color: "var(--text-muted)", cursor: "pointer", fontSize: 11,
                fontWeight: 600, padding: "4px 12px", display: "flex", alignItems: "center", gap: 4,
              }}>↺ Reiniciar chat</button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px" }}>

          {/* Initializing */}
          {initializing && (
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BruxAvatar size={28} /></div>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", maxWidth: "80%" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: "50%", background: "var(--accent)",
                      animation: `bounce 1.2s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex", gap: 10, marginBottom: 14,
              flexDirection: m.role === "user" ? "row-reverse" : "row",
            }}>
              {m.role === "assistant" && (
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, alignSelf: "flex-end" }}><BruxAvatar size={28} /></div>
              )}
              <div style={{ maxWidth: "80%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  background: m.role === "user"
                    ? "linear-gradient(135deg, var(--accent), #b8e600)"
                    : m.isError ? "rgba(239,68,68,0.1)" : "var(--card)",
                  border: `1px solid ${m.role === "user" ? "transparent" : m.isError ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
                  borderRadius: m.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  padding: "10px 14px",
                  fontSize: 14, lineHeight: 1.5,
                  color: m.role === "user" ? "#09090B" : "var(--text)",
                  fontWeight: m.role === "user" ? 600 : 400,
                }}>
                  {m.role === "assistant" ? renderMessage(stripRoutineJson(m.text)) : m.text}
                </div>
                {m.role === "assistant" && (() => {
                  const routine = parseRoutine(m.text);
                  if (!routine) return null;
                  return (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {onUseRoutine && (
                        <button
                          onClick={() => { onUseRoutine(routine); onClose(); }}
                          style={{
                            padding: "10px 16px", borderRadius: 12, border: "none",
                            background: "linear-gradient(135deg, var(--accent), #b8e600)",
                            color: "#09090B", fontWeight: 800, fontSize: 13,
                            cursor: "pointer", display: "flex", alignItems: "center",
                            gap: 6, boxShadow: "0 4px 12px rgba(223,255,0,0.3)",
                          }}
                        >
                          💪 Entrenar ahora
                        </button>
                      )}
                      {onSaveRoutine && (
                        <button
                          onClick={() => { onSaveRoutine(routine); }}
                          style={{
                            padding: "10px 16px", borderRadius: 12,
                            border: "1px solid var(--accent)",
                            background: "transparent",
                            color: "var(--accent)", fontWeight: 800, fontSize: 13,
                            cursor: "pointer", display: "flex", alignItems: "center",
                            gap: 6,
                          }}
                        >
                          📋 Guardar rutina
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}

          {/* Loading */}
          {loading && !initializing && (
            <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><BruxAvatar size={28} /></div>
              <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "4px 16px 16px 16px", padding: "12px 16px" }}>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions — solo si hay pocos mensajes */}
        {messages.length <= 2 && !loading && (
          <div style={{ padding: "0 16px 8px", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {QUICK_SUGGESTIONS.map(s => (
                <button key={s.label}
                  onClick={() => canAsk ? handleSend(s.label) : setShowAdPrompt(true)}
                  style={{
                    padding: "6px 12px", borderRadius: 20, cursor: "pointer",
                    background: "var(--card)", border: "1px solid var(--border)",
                    color: "var(--text-muted)", fontSize: 12, fontWeight: 600,
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => { e.target.style.borderColor = "var(--accent)"; e.target.style.color = "var(--accent)"; }}
                  onMouseLeave={e => { e.target.style.borderColor = "var(--border)"; e.target.style.color = "var(--text-muted)"; }}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ad prompt */}
        {showAdPrompt && (
          <div style={{
            margin: "0 16px 8px",
            background: "linear-gradient(135deg, rgba(251,191,36,0.1), rgba(251,191,36,0.05))",
            border: "1px solid rgba(251,191,36,0.3)",
            borderRadius: 14, padding: "14px 16px", flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 6, color: "var(--text)", fontFamily: "Inter, sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
              ⚡ Consultas agotadas por hoy
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
              ¿Qué vas a entrenar mañana? Hazte Pro y pregúntale a Brux cuando quieras — sin límites, sin esperas.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleWatchAd} disabled={watchingAd} style={{
                flex: 2, padding: "9px 0", borderRadius: 10, cursor: watchingAd ? "not-allowed" : "pointer",
                background: "rgba(251,191,36,0.2)", border: "1px solid rgba(251,191,36,0.4)",
                color: "#f59e0b", fontWeight: 700, fontSize: 13,
              }}>
                {watchingAd ? "⏳ Cargando video..." : "▶ Ver video (+1 consulta)"}
              </button>
              <button onClick={() => setShowAdPrompt(false)} style={{
                flex: 1, padding: "9px 0", borderRadius: 10, cursor: "pointer",
                background: "var(--accent)", border: "none",
                color: "#09090B", fontWeight: 800, fontSize: 13,
              }}>
                Pro ✨
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div style={{
          padding: "8px 16px 20px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 8, flexShrink: 0,
          background: "var(--bg)",
        }}>
          <input
            ref={inputRef}
            className="input"
            placeholder={canAsk ? "Pregunta lo que quieras..." : "Sin consultas hoy — mira un video para continuar"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={loading}
            style={{ flex: 1, fontSize: 14, opacity: canAsk ? 1 : 0.5 }}
          />
          <button
            onClick={() => canAsk ? handleSend() : setShowAdPrompt(true)}
            disabled={loading || !input.trim()}
            style={{
              width: 44, height: 44, borderRadius: 12, border: "none",
              background: input.trim() && !loading ? "var(--accent)" : "var(--input-bg)",
              color: input.trim() && !loading ? "#09090B" : "var(--text-muted)",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: 18, flexShrink: 0, transition: "all 0.15s",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ➤
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      {confirmModal}
    </div>
  );
}

export function DraggableAIButton({ onOpen, avatar }) {
  const dragRef = useRef(null);
  const posRef = useRef(null);
  const wasDragged = useRef(false);

  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;

    // Posicion inicial
    const initX = window.innerWidth - 68;
    const initY = window.innerHeight - 140;
    posRef.current = { x: initX, y: initY };
    el.style.left = initX + "px";
    el.style.top = initY + "px";

    let startX = 0, startY = 0, offX = 0, offY = 0, moved = false;

    function applyPos(x, y, animate) {
      posRef.current = { x, y };
      if (animate) el.style.transition = "left 0.25s ease, top 0.25s ease";
      el.style.left = x + "px";
      el.style.top = y + "px";
      if (animate) setTimeout(() => { el.style.transition = ""; }, 300);
    }

    function onTouchStart(e) {
      const t = e.touches[0];
      const pos = posRef.current;
      startX = t.clientX;
      startY = t.clientY;
      offX = t.clientX - pos.x;
      offY = t.clientY - pos.y;
      moved = false;
      wasDragged.current = false;
    }

    function onTouchMove(e) {
      const t = e.touches[0];
      if (!moved) {
        const dx = Math.abs(t.clientX - startX);
        const dy = Math.abs(t.clientY - startY);
        if (dx < 10 && dy < 10) return;
        moved = true;
        wasDragged.current = true;
      }
      e.preventDefault();
      const x = Math.min(Math.max(t.clientX - offX, 0), window.innerWidth - 52);
      const y = Math.min(Math.max(t.clientY - offY, 0), window.innerHeight - 52);
      applyPos(x, y, false);
    }

    function onTouchEnd() {
      if (!moved) {
        // tap — NO llamamos onOpen aqui, lo maneja onClick de React
        wasDragged.current = false;
        return;
      }
      // drag terminado — snap al borde
      const pos = posRef.current;
      const margin = 8, size = 52;
      const snapX = pos.x + size / 2 < window.innerWidth / 2 ? margin : window.innerWidth - size - margin;
      const snapY = Math.min(Math.max(pos.y, margin), window.innerHeight - size - margin);
      applyPos(snapX, snapY, true);
      // Resetear despues de un momento para no bloquear el click
      setTimeout(() => { wasDragged.current = false; }, 300);
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  function handleClick() {
    // Solo abrir si NO fue un drag
    if (!wasDragged.current) {
      onOpen();
    }
  }

  return (
    <div
      ref={dragRef}
      onClick={handleClick}
      style={{
        position: "fixed", left: 0, top: 0, zIndex: 200,
        width: 52, height: 52, borderRadius: "50%",
        background: "linear-gradient(135deg, #22c55e, #16a34a)",
        cursor: "pointer", boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
        userSelect: "none", WebkitTapHighlightColor: "transparent",
        outline: "none",
      }}
      title="Coach IA"
    >
      {avatar || <span style={{ fontSize: 26 }}>🤖</span>}
    </div>
  );
}