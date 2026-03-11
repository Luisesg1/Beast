// ─── Shared utility functions ─────────────────────────────────────────────────

export function calc1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  const w = parseFloat(weight), r = parseFloat(reps);
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

export function calcSessionVolume(session) {
  return (session.exercises || []).reduce((acc, ex) => {
    if (ex.sets?.length > 0) {
      return acc + ex.sets.reduce((s, st) => s + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||1), 0);
    }
    return acc + (parseFloat(ex.weight)||0) * (parseFloat(ex.reps)||1);
  }, 0);
}

export function detectNewPRs(newSession, existingSessions) {
  const newPRs = [];
  (newSession.exercises || []).forEach(ex => {
    const doneSets = (ex.sets || []).filter(s => s.done !== false);
    if (doneSets.length === 0 && !ex.weight) return;
    const newW = doneSets.length > 0
      ? Math.max(...doneSets.map(st => parseFloat(st.weight) || 0))
      : parseFloat(ex.weight) || 0;
    const newR = doneSets.length > 0
      ? Math.max(...doneSets.map(st => parseFloat(st.reps) || 0))
      : parseFloat(ex.reps) || 0;
    if (newW <= 0) return;
    const new1RM = calc1RM(newW, newR);
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

export function getPRs(sessions) {
  const prs = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
    const r = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps)||0)) : parseFloat(ex.reps)||0;
    const rm = calc1RM(w, r);
    if (!prs[ex.name] || rm > prs[ex.name].rm) prs[ex.name] = { rm, date: s.date };
  }));
  return prs;
}

export function calcBestStreak(sessions, weeklyTarget = 3) {
  const getMonday = (d) => {
    const date = new Date(d); date.setHours(0,0,0,0);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date.toISOString().slice(0,10);
  };
  const weekMap = {};
  sessions.forEach(s => { const mon = getMonday(s.date+"T00:00:00"); weekMap[mon]=(weekMap[mon]||0)+1; });
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
  const getMonday = (d) => {
    const date = new Date(d); date.setHours(0,0,0,0);
    const day = date.getDay();
    date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day));
    return date.toISOString().slice(0,10);
  };
  const weekMap = {};
  sessions.forEach(s => { const w = getMonday(s.date + "T00:00:00"); weekMap[w] = (weekMap[w]||0) + 1; });
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