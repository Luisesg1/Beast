export default function WeekComparison({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const now = new Date(); now.setHours(0,0,0,0);
  const getWeekSessions = (daysAgoStart, daysAgoEnd) =>
    sessions.filter(s => {
      const d = new Date(s.date + "T00:00:00");
      const ago = Math.round((now - d) / 86400000);
      return ago >= daysAgoStart && ago < daysAgoEnd;
    });

  const thisWeek = getWeekSessions(0, 7);
  const lastWeek = getWeekSessions(7, 14);

  if (thisWeek.length === 0 && lastWeek.length === 0) return null;

  const calcVol = (ss) => ss.reduce((acc, s) =>
    acc + (s.exercises || []).reduce((a, ex) => {
      const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
      return a + sets.reduce((sv, st) => sv + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||1), 0);
    }, 0), 0);

  const thisVol = Math.round(calcVol(thisWeek));
  const lastVol = Math.round(calcVol(lastWeek));

  const calcPRs = (ss) => {
    const prs = new Set();
    ss.forEach(s => (s.exercises||[]).forEach(ex => {
      const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
      const sTs1 = new Date(s.date+"T00:00:00").getTime();
      const prevBest = sessions
        .filter(ps => new Date(ps.date+"T00:00:00").getTime() < sTs1)
        .flatMap(ps => (ps.exercises||[]).filter(pe => pe.name === ex.name))
        .reduce((b, pe) => Math.max(b, parseFloat(pe.weight)||0), 0);
      if (w > prevBest && w > 0) prs.add(`${s.id}-${ex.name}`);
    }));
    return prs.size;
  };

  const thisPRs = calcPRs(thisWeek);
  const lastPRs = calcPRs(lastWeek);

  const metrics = [
    { label: "Sesiones", this: thisWeek.length, last: lastWeek.length, fmt: v => v },
    { label: "Volumen", this: thisVol, last: lastVol, fmt: v => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${v}kg` },
    { label: "PRs", this: thisPRs, last: lastPRs, fmt: v => v },
  ];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-label">📊 Esta semana vs semana anterior</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {metrics.map(m => {
          const diff = m.this - m.last;
          const pct = m.last > 0 ? Math.round((diff / m.last) * 100) : null;
          const better = diff > 0;
          const same = diff === 0;
          const color = same ? "var(--text-muted)" : better ? "#22c55e" : "#f97316";
          return (
            <div key={m.label} style={{ background: "var(--input-bg)", border: `1px solid ${same ? "var(--border)" : better ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 900, color }}>
                {m.fmt(m.this)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                vs {m.fmt(m.last)} sem. ant.
              </div>
              {pct !== null && (
                <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4 }}>
                  {better ? "▲" : diff < 0 ? "▼" : "="} {pct !== null ? `${Math.abs(pct)}%` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}