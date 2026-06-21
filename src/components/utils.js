// ─── Shared utility functions ─────────────────────────────────────────────────
// NOTA: estas funciones están duplicadas con src/utils/gymCalcs.js (deuda de
// Etapa 4: unificar en una sola fuente). Mantener AMBAS sincronizadas hasta
// entonces — las correcciones de cálculo de Etapa 1 están aplicadas en las dos.

// Parsea una fecha de sesión de forma robusta. Devuelve null si es inválida en
// vez de un Invalid Date que rompería los cálculos de racha.
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

// Lunes de la semana de `d` como clave 'YYYY-MM-DD'. null si la fecha es inválida.
function getMonday(d) {
  const date = parseDate(d instanceof Date ? d.toISOString() : d);
  if (!date) return null;
  const day = date.getDay();
  date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
  return date.toISOString().slice(0, 10);
}

export function calc1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  const w = parseFloat(weight), r = parseFloat(reps);
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

export function calcSessionVolume(session) {
  // Volumen = peso × reps. Sin reps el aporte es 0 (no se inventa 1 rep).
  return (session.exercises || []).reduce((acc, ex) => {
    if (ex.sets?.length > 0) {
      return acc + ex.sets.reduce((s, st) => s + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||0), 0);
    }
    return acc + (parseFloat(ex.weight)||0) * (parseFloat(ex.reps)||0);
  }, 0);
}

export function detectNewPRs(newSession, existingSessions) {
  const newPRs = [];
  (newSession.exercises || []).forEach(ex => {
    const doneSets = (ex.sets || []).filter(s => s.done !== false);
    if (doneSets.length === 0 && !ex.weight) return;

    // Mejor 1RM por serie (no cruzar peso máximo con reps máximas de series distintas).
    const candidates = doneSets.length > 0 ? doneSets : [{ weight: ex.weight, reps: ex.reps }];
    let best = { rm: 0, weight: 0, reps: 0 };
    for (const st of candidates) {
      const w = parseFloat(st.weight) || 0;
      const r = parseFloat(st.reps) || 0;
      const rm = calc1RM(w, r);
      if (rm > best.rm) best = { rm, weight: w, reps: r };
    }
    if (best.weight <= 0) return;

    const prevBest1RM = existingSessions
      .flatMap(s => (s.exercises || []).filter(e => e.name === ex.name))
      .reduce((acc, e) => {
        const sets = e.sets?.length > 0 ? e.sets : [{ weight: e.weight, reps: e.reps }];
        const best1rm = Math.max(0, ...sets.map(st => calc1RM(parseFloat(st.weight) || 0, parseFloat(st.reps) || 0)));
        return Math.max(acc, best1rm);
      }, 0);

    if (best.rm > prevBest1RM && best.rm > 0) {
      newPRs.push({ name: ex.name, rm: best.rm, weight: best.weight, reps: best.reps });
    }
  });
  return newPRs;
}

export function getPRs(sessions) {
  const prs = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    // Mejor 1RM real entre las series (no max-peso × max-reps cruzados).
    const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
    const rm = Math.max(0, ...sets.map(st => calc1RM(parseFloat(st.weight)||0, parseFloat(st.reps)||0)));
    if (rm > 0 && (!prs[ex.name] || rm > prs[ex.name].rm)) prs[ex.name] = { rm, date: s.date };
  }));
  return prs;
}

export function calcBestStreak(sessions, weeklyTarget = 3) {
  const weekMap = {};
  sessions.forEach(s => { const mon = getMonday(s.date); if (!mon) return; weekMap[mon]=(weekMap[mon]||0)+1; });
  const weekKeys = Object.keys(weekMap).sort();
  let best = 0, cur = 0;
  for (let i = 0; i < weekKeys.length; i++) {
    if (weekMap[weekKeys[i]] >= weeklyTarget) {
      if (i > 0) {
        const prev = new Date(weekKeys[i-1]+"T00:00:00");
        const curr = new Date(weekKeys[i]+"T00:00:00");
        const diff = Math.round((curr-prev)/604800000);
        cur = diff === 1 ? cur + 1 : 1;
      } else { cur = 1; }
      best = Math.max(best, cur);
    } else { cur = 0; }
  }
  return best;
}

export function getStreak(sessions, weeklyTarget = 3) {
  const weekMap = {};
  sessions.forEach(s => { const w = getMonday(s.date); if (!w) return; weekMap[w] = (weekMap[w]||0) + 1; });
  const weeks = Object.keys(weekMap).sort((a,b) => b.localeCompare(a));
  let streak = 0;
  const todayMonday = getMonday(new Date());
  for (const w of weeks) {
    if (w > todayMonday) continue;
    if (weekMap[w] >= weeklyTarget) streak++;
    else break;
  }
  return streak;
}
