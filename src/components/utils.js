// ─── Shared utility functions ─────────────────────────────────────────────────
// Unificación (Etapa 4): las funciones de cálculo idénticas viven en una sola
// fuente — src/utils/gymCalcs.js — y se reexportan aquí para no duplicar lógica.
// Esto elimina la causa por la que un bug corregido reaparecía (Etapa 1).
//
// Se conservan AQUÍ solo getStreak y calcBestStreak, que tienen un comportamiento
// de racha propio distinto al getStreak de gymCalcs (el de gymCalcs no rompe la
// racha si la semana en curso aún no está completa; estos componentes —StreakModal,
// AdminExercisesModal— esperan la versión simple). Unificar también la racha
// requiere validar el número mostrado en la UI; se deja para esa revisión.

export { calc1RM, calcSessionVolume, detectNewPRs, getPRs } from "../utils/gymCalcs";

// Parsea una fecha de sesión de forma robusta. null si es inválida.
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
