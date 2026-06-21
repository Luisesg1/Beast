// ─── gymCalcs.js ──────────────────────────────────────────────────────────────
// Funciones utilitarias de cálculo. Sin UI, sin dependencias externas.
// Importar donde se necesiten: import { calc1RM, getPRs, getStreak, ... } from "../utils/gymCalcs";

// ─── Helpers internos de fecha (no exportados) ────────────────────────────────
function getMonday(d) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date;
}

function toKey(d) {
  return d.toISOString().slice(0, 10);
}

// Parsea una fecha de sesión de forma robusta a una Date local a medianoche.
// Acepta 'YYYY-MM-DD' (formato esperado) e ISO con hora; devuelve null si es
// inválida en vez de un `Invalid Date` que rompería los cálculos de racha.
function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── 1RM Calculator ───────────────────────────────────────────────────────────
export function calc1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  const w = parseFloat(weight), r = parseFloat(reps);
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

// ─── Session Volume ───────────────────────────────────────────────────────────
export function calcSessionVolume(session) {
  // Volumen = peso × reps. Si faltan reps, el aporte es 0 (no se inventa 1 rep,
  // que inflaba el volumen de series a medio registrar).
  return (session.exercises || []).reduce((acc, ex) => {
    if (ex.sets?.length > 0) {
      return acc + ex.sets.reduce((s, st) => s + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||0), 0);
    }
    return acc + (parseFloat(ex.weight)||0) * (parseFloat(ex.reps)||0);
  }, 0);
}

// ─── PR Detection ─────────────────────────────────────────────────────────────
export function detectNewPRs(newSession, existingSessions) {
  const newPRs = [];
  (newSession.exercises || []).forEach(ex => {
    // Solo sets marcados como done en modo live
    const doneSets = (ex.sets || []).filter(s => s.done !== false);
    if (doneSets.length === 0 && !ex.weight) return;

    // Calcular el 1RM de CADA serie y quedarse con la mejor. No se puede combinar
    // el peso máximo de una serie con las reps máximas de otra: eso estima un 1RM
    // de una serie que nunca ocurrió (ej. 100kg×5 + 60kg×12 daría 100kg×12).
    const candidates = doneSets.length > 0
      ? doneSets
      : [{ weight: ex.weight, reps: ex.reps }];

    let best = { rm: 0, weight: 0, reps: 0 };
    for (const st of candidates) {
      const w = parseFloat(st.weight) || 0;
      const r = parseFloat(st.reps) || 0;
      const rm = calc1RM(w, r);
      if (rm > best.rm) best = { rm, weight: w, reps: r };
    }

    if (best.weight <= 0) return;

    const newW = best.weight;
    const newR = best.reps;
    const new1RM = best.rm;

    const prevBest1RM = existingSessions
      .flatMap(s => (s.exercises || []).filter(e => e.name === ex.name))
      .reduce((best, e) => {
        const sets = e.sets?.length > 0 ? e.sets : [{ weight: e.weight, reps: e.reps }];
        const best1rm = Math.max(...sets.map(st => calc1RM(parseFloat(st.weight) || 0, parseFloat(st.reps) || 0)));
        return Math.max(best, best1rm);
      }, 0);

    if (new1RM > prevBest1RM && new1RM > 0) {
      newPRs.push({ name: ex.name, rm: new1RM, weight: newW, reps: newR });
    }
  });
  return newPRs;
}

// ─── Streak (semanas consecutivas cumpliendo meta) ────────────────────────────
export function getStreak(sessions, weeklyTarget = 3) {
  if (!sessions || sessions.length === 0) return 0;

  const weekMap = {};
  sessions.forEach(s => {
    const pd = parseDate(s.date);
    if (!pd) return; // ignorar sesiones con fecha inválida en vez de romper la racha
    const mon = toKey(getMonday(pd));
    weekMap[mon] = (weekMap[mon] || 0) + 1;
  });

  const today = new Date(); today.setHours(0,0,0,0);
  let cursor = getMonday(today);
  let streak = 0;

  while (true) {
    const key = toKey(cursor);
    const count = weekMap[key] || 0;
    const isCurrentWeek = key === toKey(getMonday(today));

    if (count >= weeklyTarget) {
      streak++;
    } else if (isCurrentWeek) {
      // Semana en curso aún no completada — no rompe la racha
    } else {
      break;
    }

    cursor.setDate(cursor.getDate() - 7);
    if (streak > 520) break; // safety: max ~10 años
  }

  return streak;
}

// ─── PRs (mejor 1RM por ejercicio en todo el historial) ──────────────────────
export function getPRs(sessions) {
  const prs = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    // Mejor 1RM real entre las series (no max-peso × max-reps de series distintas).
    const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
    const rm = Math.max(0, ...sets.map(st => calc1RM(parseFloat(st.weight)||0, parseFloat(st.reps)||0)));
    if (rm > 0 && (!prs[ex.name] || rm > prs[ex.name].rm)) prs[ex.name] = { rm, date: s.date };
  }));
  return prs;
}

// ─── Streak Status (en riesgo / perdida / ok) ────────────────────────────────
// Retorna: { status: "ok" | "at_risk" | "lost", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone }
export function getStreakStatus(sessions, weeklyTarget = 3) {
  const today = new Date(); today.setHours(0,0,0,0);
  const currentMonday = getMonday(today);
  const currentWeekKey = toKey(currentMonday);

  // Sesiones semana actual
  const sessionsThisWeek = sessions.filter(s => {
    const pd = parseDate(s.date);
    return pd && toKey(getMonday(pd)) === currentWeekKey;
  }).length;

  const isCurrentWeekDone = sessionsThisWeek >= weeklyTarget;

  // Semana pasada
  const lastMonday = new Date(currentMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastWeekKey = toKey(lastMonday);
  const sessionsLastWeek = sessions.filter(s => {
    const pd = parseDate(s.date);
    return pd && toKey(getMonday(pd)) === lastWeekKey;
  }).length;

  // Día de la semana actual (0=Lun ... 6=Dom)
  const dayOfWeek = (today.getDay() + 6) % 7; // 0=Lun, 6=Dom
  const daysLeftInWeek = 6 - dayOfWeek; // días restantes incluyendo hoy

  // ¿Todavía se puede llegar a la meta esta semana?
  const sessionsNeeded = weeklyTarget - sessionsThisWeek;
  const canStillReach = sessionsNeeded <= daysLeftInWeek + 1;

  // Racha actual (reutilizamos getStreak)
  const streak = getStreak(sessions, weeklyTarget);

  // Racha perdida: tenía racha (semana pasada cumplió meta) pero esta semana ya no puede llegar
  if (streak === 0 && sessionsLastWeek >= weeklyTarget && !isCurrentWeekDone) {
    return { status: "lost", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone, sessionsLastWeek, daysLeftInWeek };
  }

  // Racha perdida legacy: semana pasada tuvo sesiones pero no llegó a la meta
  if (streak === 0 && sessionsLastWeek > 0 && sessionsLastWeek < weeklyTarget && !isCurrentWeekDone) {
    return { status: "lost", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone, sessionsLastWeek, daysLeftInWeek };
  }

  // En riesgo: semana actual y quedan pocos días para cumplir la meta
  if (!isCurrentWeekDone && !canStillReach) {
    return { status: "at_risk", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone, daysLeftInWeek };
  }

  // En riesgo leve: es jueves o después y falta más de 1 sesión
  if (!isCurrentWeekDone && dayOfWeek >= 3 && sessionsNeeded >= 2) {
    return { status: "at_risk", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone, daysLeftInWeek };
  }

  // En riesgo: tiene racha activa y esta semana aún no ha empezado (0 sesiones, lunes o martes)
  if (streak > 0 && sessionsThisWeek === 0 && dayOfWeek >= 1) {
    return { status: "at_risk", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone, daysLeftInWeek };
  }

  return { status: "ok", sessionsThisWeek, sessionsNeeded, isCurrentWeekDone };
}

// ─── Shields (escudos de protección de racha) ────────────────────────────────
const SHIELDS_KEY = "gym_streak_shields";
const SHIELDS_LOG_KEY = "gym_shields_log";

export function getShields() {
  try { return Math.min(2, parseInt(localStorage.getItem(SHIELDS_KEY) || "0")); }
  catch { return 0; }
}

export function addShield(reason = "") {
  try {
    const current = getShields();
    if (current >= 2) return false; // máximo 2
    localStorage.setItem(SHIELDS_KEY, String(current + 1));
    // Log
    const log = JSON.parse(localStorage.getItem(SHIELDS_LOG_KEY) || "[]");
    log.push({ date: new Date().toISOString().slice(0, 10), reason });
    localStorage.setItem(SHIELDS_LOG_KEY, JSON.stringify(log.slice(-20)));
    return true;
  } catch { return false; }
}

export function useShield() {
  try {
    const current = getShields();
    if (current <= 0) return false;
    localStorage.setItem(SHIELDS_KEY, String(current - 1));
    // Log uso
    const log = JSON.parse(localStorage.getItem(SHIELDS_LOG_KEY) || "[]");
    log.push({ date: new Date().toISOString().slice(0, 10), reason: "used" });
    localStorage.setItem(SHIELDS_LOG_KEY, JSON.stringify(log.slice(-20)));
    return true;
  } catch { return false; }
}

export function wasShieldUsedThisWeek() {
  try {
    const currentWeek = toKey(getMonday(new Date()));
    const log = JSON.parse(localStorage.getItem(SHIELDS_LOG_KEY) || "[]");
    return log.some(l => {
      const pd = parseDate(l.date);
      return l.reason === "used" && pd && toKey(getMonday(pd)) === currentWeek;
    });
  } catch { return false; }
}

// ─── Weekly Challenge (rota cada semana del año) ──────────────────────────────
// Requiere que le pases el array WEEKLY_CHALLENGES como argumento
// para evitar dependencia circular con App.jsx
export function getWeeklyChallenge(challenges) {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.floor((now - startOfYear) / (7 * 86400000));
  return challenges[weekNum % challenges.length];
}