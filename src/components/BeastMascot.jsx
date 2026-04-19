import { useState, useEffect } from "react";
import { EXERCISE_DB, MUSCLES } from "../exerciseDb";

// ── DEBUG: pon en true para ciclar moods cada 5s ─────────────
const DEBUG_MOODS = false;

// ── Sprites (pon todos en src/assets/) ───────────────────────
import beastHype      from "../assets/beast_hype.png";
import beastAngry     from "../assets/beast_angry.png";
import beastWarning   from "../assets/beast_warning.png";
import beastFire      from "../assets/beast_fire.png";
import beastSleepy    from "../assets/beast_sleepy.png";
import beastJump      from "../assets/beast_jump.png";
import beastChill     from "../assets/beast_chill.png";
import beastCelebrate from "../assets/beast_celebrate.png";
import beastBoxing    from "../assets/beast_boxing.png";
import beastBench     from "../assets/beast_bench.png";

const SPRITE = {
  hype:      beastJump,
  happy:     beastHype,
  proud:     beastCelebrate,
  celebrate: beastCelebrate,
  fire:      beastBench,
  shocked:   beastAngry,
  warning:   beastBoxing,
  sarcastic: beastWarning,
  chill:     beastChill,
  sleepy:    beastSleepy,
  coach:     beastFire,
};

const BRUX_MOODS = {
  hype:      { color: "#84cc16", glow: "#84cc1620", label: "¡Vamos!" },
  happy:     { color: "#22c55e", glow: "#22c55e20", label: "¡Sí!" },
  proud:     { color: "#facc15", glow: "#facc1520", label: "¡Bestia!" },
  warning:   { color: "#f97316", glow: "#f9731620", label: "¡Ey!" },
  shocked:   { color: "#ef4444", glow: "#ef444420", label: "¡Oye!" },
  chill:     { color: "#86efac", glow: "#86efac20", label: "Tranqui" },
  sleepy:    { color: "#9ca3af", glow: "#9ca3af20", label: "Descansa" },
  celebrate: { color: "#fbbf24", glow: "#fbbf2420", label: "¡Fuego!" },
  fire:      { color: "#ef4444", glow: "#ef444420", label: "¡Épico!" },
  coach:     { color: "#22d3ee", glow: "#22d3ee20", label: "¡Ojo!" },
  sarcastic: { color: "#a3e635", glow: "#a3e63520", label: "¡Anda ya!" },
};

const MOOD_KEYS = Object.keys(BRUX_MOODS);

const CSS = `
@keyframes beast-float {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  25%      { transform: translateY(-5px) rotate(1deg); }
  75%      { transform: translateY(-2px) rotate(-1deg); }
}
@keyframes beast-float-slow {
  0%,100% { transform: translateY(0px); }
  50%      { transform: translateY(-3px); }
}
@keyframes beast-jump {
  0%,100% { transform: translateY(0px) scaleY(1); }
  20%      { transform: translateY(-10px) scaleY(1.05); }
  50%      { transform: translateY(-14px) scaleY(1.08); }
  80%      { transform: translateY(-6px) scaleY(1.02); }
}
@keyframes beast-shake {
  0%,100% { transform: translateX(0) rotate(0deg); }
  20%     { transform: translateX(-5px) rotate(-3deg); }
  40%     { transform: translateX(5px)  rotate(3deg); }
  60%     { transform: translateX(-3px) rotate(-2deg); }
  80%     { transform: translateX(3px)  rotate(2deg); }
}
@keyframes beast-bounce {
  0%   { transform: scale(1)    translateY(0px) rotate(0deg); }
  25%  { transform: scale(1.2)  translateY(-12px) rotate(-5deg); }
  55%  { transform: scale(0.9)  translateY(3px) rotate(2deg); }
  75%  { transform: scale(1.05) translateY(-3px); }
  100% { transform: scale(1)    translateY(0px) rotate(0deg); }
}
@keyframes beast-celebrate {
  0%,100% { transform: rotate(-3deg) scale(1); }
  25%      { transform: rotate(3deg) scale(1.06) translateY(-4px); }
  75%      { transform: rotate(-2deg) scale(1.03) translateY(-2px); }
}
@keyframes beast-glow-pulse {
  0%,100% { opacity: 0.35; transform: scale(0.95); }
  50%      { opacity: 0.75; transform: scale(1.08); }
}
`;

function injectCSS() {
  if (typeof document !== "undefined" && !document.getElementById("beast-css")) {
    const s = document.createElement("style");
    s.id = "beast-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }
}

export function BeastAvatar({ moodKey, bounce, size = 80 }) {
  injectCSS();

  const img   = SPRITE[moodKey] || beastHype;
  const color = BRUX_MOODS[moodKey]?.color || "#84cc16";

  const isAngry     = ["fire","warning","shocked"].includes(moodKey);
  const isExcited   = ["hype","celebrate","proud","fire"].includes(moodKey);
  const isSleepy    = moodKey === "sleepy";
  const isJumping   = moodKey === "hype";
  const isCelebrate = ["celebrate","proud"].includes(moodKey);

  let animation = "beast-float 2.4s ease-in-out infinite";
  if (bounce)           animation = "beast-bounce 0.55s cubic-bezier(.36,.07,.19,.97) both";
  else if (isJumping)   animation = "beast-jump 1.2s ease-in-out infinite";
  else if (isCelebrate) animation = "beast-celebrate 1s ease-in-out infinite";
  else if (isAngry)     animation = "beast-shake 0.5s ease-in-out infinite";
  else if (isSleepy)    animation = "beast-float-slow 3.5s ease-in-out infinite";

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      {isExcited && (
        <div style={{
          position: "absolute",
          inset: -8,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}50 0%, transparent 70%)`,
          animation: "beast-glow-pulse 1.6s ease-in-out infinite",
          pointerEvents: "none",
        }}/>
      )}
      <img
        src={img}
        alt="Beast"
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          animation,
          transformOrigin: "bottom center",
          display: "block",
          position: "relative",
          zIndex: 1,
          filter: isExcited
            ? `drop-shadow(0 0 10px ${color}99)`
            : isAngry
            ? `drop-shadow(0 0 6px ${color}77)`
            : `drop-shadow(0 2px 4px #00000055)`,
        }}
      />
    </div>
  );
}

export function getBeastContext(sessions, todayPlanned, streak, inNewSession = false) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const lastSession = sorted[0];
  const daysSinceLast = lastSession
    ? Math.round((today - new Date(lastSession.date + "T00:00:00")) / 86400000)
    : 999;
  const trainedToday = sessions.some(s => s.date === todayStr);
  const hour = new Date().getHours();
  const totalSessions = sessions.length;
  const seed = (parseInt(todayStr.replace(/-/g, "")) + sessions.length * 3) % 17;

  const lastTrained = {};
  sessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      const db = EXERCISE_DB.find(e => e.name === ex.name);
      if (db?.muscle && (!lastTrained[db.muscle] || s.date > lastTrained[db.muscle]))
        lastTrained[db.muscle] = s.date;
    });
  });

  const muscleAge = MUSCLES.filter(m => m !== "Cardio").map(m => {
    if (!lastTrained[m]) return { muscle: m, days: 999, never: true };
    return { muscle: m, days: Math.round((today - new Date(lastTrained[m] + "T00:00:00")) / 86400000), never: false };
  }).sort((a, b) => b.days - a.days);
  const neglected = muscleAge[0];

  const weekSessions = sessions.filter(s => (today - new Date(s.date + "T00:00:00")) / 86400000 <= 7);
  const weekMuscles = {};
  weekSessions.forEach(s => (s.exercises || []).forEach(ex => {
    const db = EXERCISE_DB.find(e => e.name === ex.name);
    if (db?.muscle) weekMuscles[db.muscle] = (weekMuscles[db.muscle] || 0) + 1;
  }));
  const mostThisWeek = Object.entries(weekMuscles).sort((a, b) => b[1] - a[1])[0]?.[0];

  const recentPRs = [];
  sessions.filter(s => (today - new Date(s.date + "T00:00:00")) / 86400000 <= 14).forEach(s => {
    (s.exercises || []).forEach(ex => {
      const w = ex.sets?.length > 0
        ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0))
        : parseFloat(ex.weight) || 0;
      const prevBest = sessions
        .filter(ps => ps.date < s.date)
        .flatMap(ps => (ps.exercises || []).filter(pe => pe.name === ex.name))
        .reduce((b, pe) => Math.max(b, parseFloat(pe.weight) || 0), 0);
      if (w > prevBest && w > 0)
        recentPRs.push({ name: ex.name, weight: w, muscle: EXERCISE_DB.find(e => e.name === ex.name)?.muscle });
    });
  });

  const exCount = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => { exCount[ex.name] = (exCount[ex.name] || 0) + 1; }));
  const favEx = Object.entries(exCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const favCount = favEx ? exCount[favEx] : 0;

  if (sessions.length === 0) return { mood: "hype", title: "¡Bienvenido, campeón! 🔥", message: "Beast está aquí para gritar más fuerte que nadie cuando levantes. Registra tu primera sesión y arranca. 💪", cta: null };

  if (trainedToday && !inNewSession) {
    const ts = sorted.find(s => s.date === todayStr);
    const muscle = ts?.exercises?.[0]?.name ? EXERCISE_DB.find(e => e.name === ts.exercises[0].name)?.muscle : null;
    const exCnt = ts?.exercises?.length || 0;
    const hasPR = recentPRs.some(p => p.muscle === muscle);
    if (hasPR) {
      const pr = recentPRs.find(p => p.muscle === muscle);
      return { mood: "celebrate", title: `¡NUEVO PR en ${pr.name}! 🏆`, message: `${pr.weight}kg. ¡BEAST LO SABÍA! Toda la semana voy a gritar esto. ¡MERECES UN ESTADIO! 🏟️`, cta: null };
    }
    const msgs = muscle ? [
      `¡${exCnt} ejercicios de ${muscle.toLowerCase()}! ¡ESO ES LO QUE QUIERO VER! 🔥`,
      `¡${muscle} DESTRUIDO! Beast está en el suelo de la emoción. ¡Descansa, leyenda! 💤`,
      `¡${muscle} registrado! Beast grita desde las gradas. ¡Recupérate para mañana! 💪`,
    ] : [
      "¡SESIÓN REGISTRADA! Beast está de pie aplaudiendo. ¡Orgulloso de ti! 👏",
      "¡Hecho! ¡Bien hecho! Ahora a descansar, campeón. 💪",
    ];
    return { mood: "proud", title: ts?.workout ? `✅ ${ts.workout} — ¡listo!` : "✅ ¡Entrenamiento registrado!", message: msgs[seed % msgs.length], cta: null };
  }

  if (trainedToday && inNewSession) {
    const msgs = ["¡DOBLE SESIÓN! Beast no puede creerlo. ¡Eres un animal! 🦁", "¡Volviste por más! ¡VAMOS!", "¡Dos veces hoy! Eso es lo que separa a los BESTIAS del resto. 🔑"];
    return { mood: "happy", title: "¿Doble sesión hoy? 💪", message: msgs[seed % msgs.length], cta: null };
  }

  if (todayPlanned) {
    const prev = sessions.filter(s => s.workout?.toLowerCase() === todayPlanned.toLowerCase())[0];
    const planMsg = prev
      ? `La última vez que hiciste ${todayPlanned} fue el ${prev.date}. ¡Beast quiere que lo superes HOY! 💥`
      : `¡Primera vez con ${todayPlanned}! Beast está en primera fila. ¡No lo decepciones! 👀`;
    return { mood: "hype", title: `¡Hoy toca ${todayPlanned.toLowerCase()}! 📅`, message: planMsg, cta: todayPlanned };
  }

  if (daysSinceLast >= 14) return { mood: "shocked", title: `¡${daysSinceLast} días sin verte! 😱`, message: `¡Beast estuvo en el gym todos los días esperándote. ¡VUELVE HOY! 🙏`, cta: null };
  if (daysSinceLast >= 7)  return { mood: "shocked", title: `¡${daysSinceLast} días sin entrenar! 😱`, message: "¡Una semana entera! El cuerpo te extraña, Beast te extraña más. 💪", cta: null };
  if (daysSinceLast >= 3)  return { mood: "warning", title: `${daysSinceLast} días sin entrenar...`, message: `¡Beast entiende, pero ya quiere verte levantar. ¡Hoy volvemos! 💪`, cta: null };

  if (streak >= 14) return { mood: "fire",  title: `🔥 ¡${streak} semanas seguidas!`, message: `¡${streak} SEMANAS! ¡BESTIA ABSOLUTA! 🏆`, cta: null };
  if (streak >= 7)  return { mood: "fire",  title: `🔥 Racha de ${streak} semanas`,   message: `¡Casi dos meses! Beast está temblando de emoción. ¡MÁQUINA! 🤖💪`, cta: null };
  if (daysSinceLast === 1 && streak >= 3) return { mood: "happy", title: `¡${streak} semanas en racha! 🔥`, message: `Beast lleva la cuenta y está ORGULLOSO. ¡No pares ahora! 🔥`, cta: null };
  if (recentPRs.length > 0) {
    const pr = recentPRs[0];
    return { mood: "celebrate", title: `¡Récord en ${pr.name}! 🏆`, message: `¡${pr.weight}kg! ¡BEAST LO VIO! ¡Vas a necesitar un estante más grande! 🏆🔥`, cta: null };
  }
  if (neglected?.days >= 10 && !neglected.never) return { mood: "sarcastic", title: `${neglected.muscle} lleva ${neglected.days} días esperando`, message: `¡Beast se pone de pie: ese músculo merece respeto! 😤`, cta: neglected.muscle };
  if (mostThisWeek && (weekMuscles[mostThisWeek] || 0) >= 3) return { mood: "coach", title: `Ojo con ${mostThisWeek}... 📋`, message: `¡${weekMuscles[mostThisWeek]} sesiones esta semana! ¡Dale a otro músculo hoy! 💥`, cta: null };
  if ([10, 25, 50, 100, 200].includes(totalSessions)) return { mood: "celebrate", title: `¡${totalSessions} SESIONES! 🎉`, message: `¡BEAST EXPLOTA DE ORGULLO! ¡ESO NO LO HACE CUALQUIERA! 🎉`, cta: null };
  if (favEx && favCount >= 5 && daysSinceLast <= 1 && seed % 4 === 0) return { mood: "proud", title: `¡${favEx} es tu trademark! 🏆`, message: `Beast sabe que ${favEx} es tu favorito (¡${favCount} veces!). ¿Hoy lo superas? 💪`, cta: null };

  const morningMsgs = ["¡Los que entrenan temprano tienen el día GANADO! 🌅", "Buenos días. El gimnasio vacío de mañana es tuyo.", "¡Beast también madruga! ¡A entrenar, campeón! 💪"];
  const dayMsgs     = ["¡Otro día, otra oportunidad! ¡Sin excusas! 🚫", "El entrenamiento perfecto es el que haces.", "Beast espera. Con la camiseta puesta. ¡Vamos! 👕"];
  const nightMsgs   = ["¡Entreno nocturno! ¡Menos gente, más BEAST! 🌙", "Terminar el día en el gym tiene algo especial.", "¡El único mal entreno es el que NO se hace! ⚡"];

  if (hour < 7)  return { mood: "sleepy", title: "¡Madrugador! 🌅",       message: "¡Beast todavía está calentando pero ya te aplaude! 👏", cta: null };
  if (hour < 12) return { mood: "hype",   title: "¡Buenos días! ⚡",       message: morningMsgs[seed % morningMsgs.length], cta: null };
  if (hour < 19) return { mood: "happy",  title: "¡A darlo todo hoy! 💪", message: dayMsgs[seed % dayMsgs.length], cta: null };
  return               { mood: "chill",   title: "¡Entreno nocturno! 🌙", message: nightMsgs[seed % nightMsgs.length], cta: null };
}

export default function BeastMascot({ sessions, todayPlanned, streak, onStartSession, inNewSession = false }) {
  const [bounce, setBounce]     = useState(false);
  const [prevMood, setPrevMood] = useState(null);
  const [debugIdx, setDebugIdx] = useState(0);

  const ctx      = getBeastContext(sessions, todayPlanned, streak, inNewSession);
  const activeMood = DEBUG_MOODS ? MOOD_KEYS[debugIdx] : ctx.mood;
  const mood     = BRUX_MOODS[activeMood] || BRUX_MOODS.happy;

  // Cicla moods en debug
  useEffect(() => {
    if (!DEBUG_MOODS) return;
    const t = setInterval(() => {
      setDebugIdx(i => (i + 1) % MOOD_KEYS.length);
      setBounce(true);
      setTimeout(() => setBounce(false), 560);
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Bounce normal al cambiar mood real
  useEffect(() => {
    if (DEBUG_MOODS) return;
    if (ctx.mood !== prevMood) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 560);
      setPrevMood(ctx.mood);
      return () => clearTimeout(t);
    }
  }, [ctx.mood]);

  return (
    <div style={{
      background: `linear-gradient(145deg, ${mood.glow}, transparent 70%)`,
      border: `1.5px solid ${mood.color}35`,
      borderRadius: 20,
      padding: "14px 16px",
      marginBottom: 18,
      position: "relative",
      overflow: "hidden",
      transition: "background 0.4s ease, border-color 0.4s ease",
    }}>
      {/* Badge debug */}
      {DEBUG_MOODS && (
        <div style={{ position: "absolute", top: 6, right: 8, fontSize: 9, color: mood.color, opacity: 0.6, fontWeight: 700 }}>
          DEBUG: {activeMood}
        </div>
      )}
      <div style={{ position: "absolute", right: -20, bottom: -20, fontSize: 90, opacity: 0.03, userSelect: "none", pointerEvents: "none", transform: "rotate(-15deg)" }}>🏋️</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <BeastAvatar moodKey={activeMood} bounce={bounce} size={86} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: mood.color, textTransform: "uppercase" }}>BEAST · TU FAN</div>
            <div style={{ fontSize: 9, padding: "1px 6px", borderRadius: 10, background: `${mood.color}20`, color: mood.color, fontWeight: 700 }}>{mood.label}</div>
          </div>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 900, color: "var(--text)", lineHeight: 1.15, marginBottom: 3 }}>
            {DEBUG_MOODS ? `Mood: ${activeMood}` : ctx.title}
          </div>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.55 }}>
            {DEBUG_MOODS ? "Cambia cada 5 segundos — pon DEBUG_MOODS = false cuando estés listo." : ctx.message}
          </div>
        </div>
      </div>
    </div>
  );
}