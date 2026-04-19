import { useState, useEffect } from "react";
import { getStreak, calcBestStreak } from "./utils";
import { getStreakStatus, getShields, useShield, wasShieldUsedThisWeek } from "../utils/gymCalcs";

function StreakModal({ sessions, user, weeklyTarget = 3, onClose, onStartSession }) {
  const [teamStreaks, setTeamStreaks] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [shieldUsed, setShieldUsed] = useState(false);
  const [shields, setShields] = useState(getShields());

  const streak = getStreak(sessions, weeklyTarget);
  const streakStatus = getStreakStatus(sessions, weeklyTarget);
  const alreadyUsedThisWeek = wasShieldUsedThisWeek();
  const color = streak >= 90 ? "#f97316" : streak >= 30 ? "#a855f7" : streak >= 14 ? "#3b82f6" : streak >= 7 ? "#22c55e" : "#f59e0b";
  const milestones = [3, 7, 14, 30, 90, 180, 365];
  const nextMilestone = milestones.find(m => m > streak) || null;
  const prevMilestone = [...milestones].reverse().find(m => m <= streak) || 0;
  const pct = nextMilestone ? ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100 : 100;

  // Build last 12 weeks calendar (84 days)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sessionDates = new Set(sessions.map(s => s.date));

  // Build 12 weeks grid starting from monday 11 weeks ago
  const startDay = new Date(today);
  const dow = (today.getDay() + 6) % 7; // 0=Mon
  startDay.setDate(startDay.getDate() - dow - 77); // go back 11 full weeks + current week

  const weeks = [];
  for (let w = 0; w < 12; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + w * 7 + d);
      const ds = day.toISOString().slice(0, 10);
      const isToday = ds === today.toISOString().slice(0, 10);
      const trained = sessionDates.has(ds);
      const isFuture = day > today;
      week.push({ ds, trained, isToday, isFuture, dayNum: day.getDate(), month: day.getMonth() });
    }
    weeks.push(week);
  }

  // Month labels
  const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const monthLabels = weeks.map((week, wi) => {
    const firstDay = week[0];
    if (wi === 0 || firstDay.dayNum <= 7) return { wi, label: monthNames[firstDay.month] };
    return null;
  }).filter(Boolean);

  // Count active days & best streak
  const totalActiveDays = sessions.length;
  const bestStreak = calcBestStreak(sessions);

  // Load team streaks
  useEffect(() => {
    async function loadTeams() {
      setLoadingTeam(true);
      try {
        const raw = localStorage.getItem("gym_my_teams");
        const myTeams = raw ? JSON.parse(raw) : [];
        const allMembers = [];
        for (const t of myTeams.slice(0, 2)) {
          // Read cached team member data from localStorage (keyed by team code)
          const teamRaw = localStorage.getItem(`gym_team_${t.code}`);
          const data = teamRaw ? JSON.parse(teamRaw) : null;
          if (data?.members) {
            Object.values(data.members).forEach(m => {
              if (m.email !== user.email && m.streak != null) {
                if (!allMembers.find(x => x.email === m.email)) {
                  allMembers.push({ name: m.name || m.email.split("@")[0], streak: m.streak, email: m.email });
                }
              }
            });
          }
        }
        // Add self
        const all = [{ name: "Tú", streak, email: user.email, isMe: true }, ...allMembers]
          .sort((a, b) => b.streak - a.streak);
        setTeamStreaks(all);
      } catch(e) { setTeamStreaks([{ name: "Tú", streak, isMe: true }]); }
      setLoadingTeam(false);
    }
    loadTeams();
  }, []);

  const DAY_LABELS = ["L","M","X","J","V","S","D"];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, width: "100%" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🔥 Mi Racha</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* ── Alerta racha en riesgo / perdida ── */}
        {(streakStatus.status === "at_risk" || streakStatus.status === "lost") && !shieldUsed && (
          <div style={{
            background: streakStatus.status === "lost" ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)",
            border: `1px solid ${streakStatus.status === "lost" ? "rgba(239,68,68,0.35)" : "rgba(249,115,22,0.35)"}`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 18,
          }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: streakStatus.status === "lost" ? "#ef4444" : "#f97316", marginBottom: 6 }}>
              {streakStatus.status === "lost" ? "💔 ¡Racha perdida esta semana!" : "⚠️ ¡Tu racha está en riesgo!"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.5 }}>
              {streakStatus.status === "lost"
                ? `No llegaste a tu meta de ${weeklyTarget} sesiones la semana pasada.`
                : `Te faltan ${streakStatus.sessionsNeeded} sesión${streakStatus.sessionsNeeded > 1 ? "es" : ""} para cumplir tu meta de ${weeklyTarget} esta semana.`}
            </div>

            {/* Opciones */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn-primary" style={{ fontSize: 13, padding: "8px 16px", flex: 1 }}
                onClick={() => { onClose(); onStartSession?.(); }}>
                ⚡ Entrenar ahora
              </button>

              {shields > 0 && !alreadyUsedThisWeek && (
                <button
                  className="btn-ghost small"
                  style={{ fontSize: 13, padding: "8px 16px", flex: 1, borderColor: "#f59e0b", color: "#f59e0b" }}
                  onClick={() => {
                    if (useShield()) {
                      setShields(getShields());
                      setShieldUsed(true);
                    }
                  }}>
                  🛡️ Usar escudo ({shields})
                </button>
              )}
            </div>

            {shields === 0 && !alreadyUsedThisWeek && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10 }}>
                💡 Gana escudos completando el reto semanal o manteniendo 4 semanas seguidas
              </div>
            )}
            {alreadyUsedThisWeek && (
              <div style={{ fontSize: 11, color: "#f59e0b", marginTop: 10 }}>
                🛡️ Ya usaste un escudo esta semana
              </div>
            )}
          </div>
        )}

        {shieldUsed && (
          <div style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 14, padding: "14px 16px", marginBottom: 18, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🛡️</div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#f59e0b", marginBottom: 4 }}>¡Racha protegida!</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Tu escudo absorbió la semana. Te quedan {shields} escudo{shields !== 1 ? "s" : ""}.</div>
          </div>
        )}

        {/* ── Panel de escudos ── */}
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 14, padding: "12px 16px", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 20 }}>🛡️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 13 }}>Escudos de protección</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Protegen tu racha si fallas una semana</div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[0, 1].map(i => (
                <div key={i} style={{
                  width: 28, height: 28, borderRadius: 8, fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  background: i < shields ? "rgba(245,158,11,0.15)" : "var(--border)",
                  border: `1px solid ${i < shields ? "rgba(245,158,11,0.5)" : "var(--border)"}`,
                  filter: i < shields ? "none" : "grayscale(1)",
                  opacity: i < shields ? 1 : 0.4,
                }}>🛡️</div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>
            <span style={{ color: "#22c55e", fontWeight: 700 }}>+1</span> completando el reto semanal &nbsp;·&nbsp;
            <span style={{ color: "#22c55e", fontWeight: 700 }}>+1</span> con 4 semanas seguidas &nbsp;·&nbsp;
            <span style={{ color: "var(--accent)", fontWeight: 700 }}>Máx. 2</span>
          </div>
        </div>

        {/* Hero streak */}
        <div style={{ textAlign: "center", padding: "10px 0 20px", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase", marginBottom: 4 }}>
            {streak >= 90 ? "¡IMPARABLE!" : streak >= 30 ? "¡EN LLAMAS!" : streak >= 7 ? "¡Semana perfecta!" : "¡Sigue así!"}
          </div>
          <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 72, fontWeight: 900, color, lineHeight: 1, filter: `drop-shadow(0 0 20px ${color}60)` }}>
            {streak}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>semanas seguidas</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--input-bg)", borderRadius: 8, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            ℹ️ La racha cuenta semanas donde cumpliste tu meta de días
          </div>

          {/* Progress toward next milestone */}
          {nextMilestone && (
            <div style={{ maxWidth: 280, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                <span>{prevMilestone}sem</span>
                <span style={{ color, fontWeight: 700 }}>→ {nextMilestone}sem</span>
              </div>
              <div style={{ background: "var(--border)", borderRadius: 20, height: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, borderRadius: 20, boxShadow: `0 0 10px ${color}60`, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                {nextMilestone - streak === 1 ? "¡La semana que viene llegas al hito! 🎯" : `Faltan ${nextMilestone - streak} semanas para el próximo hito`}
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
          {[
            { label: "Racha actual", value: `${streak}sem`, color },
            { label: "Mejor racha", value: `${bestStreak}sem`, color: "#f59e0b" },
            { label: "Días activos", value: totalActiveDays, color: "#3b82f6" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Calendar heatmap */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>
            📅 Últimas 12 semanas
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 280 }}>
              {/* Day labels */}
              <div style={{ display: "flex", gap: 3, marginBottom: 4, paddingLeft: 28 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ width: 20, fontSize: 9, color: "var(--text-muted)", textAlign: "center", fontWeight: 600, flexShrink: 0 }}>{d}</div>
                ))}
              </div>
              {/* Weeks as rows */}
              {weeks.map((week, wi) => {
                const monthLabel = monthLabels.find(m => m.wi === wi);
                return (
                  <div key={wi} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                    {/* Month label col */}
                    <div style={{ width: 24, fontSize: 8, color: "var(--text-muted)", fontWeight: 700, flexShrink: 0, textAlign: "right", paddingRight: 4 }}>
                      {monthLabel ? monthLabel.label : ""}
                    </div>
                    {week.map(day => (
                      <div
                        key={day.ds}
                        title={day.ds}
                        style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          background: day.isFuture
                            ? "transparent"
                            : day.trained
                              ? color
                              : "var(--border)",
                          opacity: day.isFuture ? 0.2 : 1,
                          border: day.isToday ? `2px solid ${color}` : "2px solid transparent",
                          boxShadow: day.trained && !day.isFuture ? `0 0 6px ${color}60` : undefined,
                          transition: "all 0.2s",
                          cursor: "default",
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              {/* Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 28, fontSize: 10, color: "var(--text-muted)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--border)" }} />
                <span>Sin entreno</span>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color, boxShadow: `0 0 6px ${color}60` }} />
                <span>Entrenado</span>
                <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${color}`, background: "transparent" }} />
                <span>Hoy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team streaks leaderboard */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>
            👥 Racha entre amigos
          </div>
          {loadingTeam ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>Cargando equipo...</div>
          ) : teamStreaks.length <= 1 && !teamStreaks[0]?.isMe ? (
            <div style={{ textAlign: "center", padding: "16px", background: "var(--input-bg)", borderRadius: 12, fontSize: 13, color: "var(--text-muted)" }}>
              Únete a un GymTeam para comparar rachas con amigos 💪
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teamStreaks.map((m, i) => {
                const mColor = m.streak >= 30 ? "#f97316" : m.streak >= 14 ? "#a855f7" : m.streak >= 7 ? "#3b82f6" : m.streak >= 3 ? "#22c55e" : "#6b7280";
                const maxStreak = Math.max(...teamStreaks.map(x => x.streak), 1);
                const barPct = (m.streak / maxStreak) * 100;
                const medals = ["🥇","🥈","🥉"];
                return (
                  <div key={m.email || i} style={{
                    background: m.isMe ? `${color}10` : "var(--input-bg)",
                    border: `1px solid ${m.isMe ? color + "40" : "var(--border)"}`,
                    borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{medals[i] || "🔥"}</span>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: m.isMe ? color : "var(--text)" }}>
                        {m.name} {m.isMe && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>(tú)</span>}
                      </div>
                      <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 22, fontWeight: 900, color: mColor }}>
                        {m.streak}sem
                      </div>
                    </div>
                    {/* Mini bar */}
                    <div style={{ background: "var(--border)", borderRadius: 20, height: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: mColor, borderRadius: 20, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}


export default StreakModal;