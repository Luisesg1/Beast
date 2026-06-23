import { getStreak, getStreakStatus, getShields } from "../utils/gymCalcs";

export function StreakRiskBanner({ sessions, weeklyTarget = 3, onOpenStreak, onStartSession, onRegisterSession, onGoHome }) {
  const { status, sessionsThisWeek, sessionsNeeded, daysLeftInWeek } = getStreakStatus(sessions, weeklyTarget);
  const shields = getShields();

  // Banner "perdiste" solo se muestra lunes y martes (primeros 2 días tras perder)
  const dayOfWeek = (new Date().getDay() + 6) % 7; // 0=Lun, 6=Dom
  if (status === "ok") return null;
  if (status === "lost" && dayOfWeek > 1) return null;

  const isLost = status === "lost";
  const color = isLost ? "#ef4444" : "#f97316";
  const bg = isLost ? "rgba(239,68,68,0.08)" : "rgba(249,115,22,0.08)";
  const border = isLost ? "rgba(239,68,68,0.3)" : "rgba(249,115,22,0.3)";

  // ¿Es posible aún cumplir la meta esta semana?
  const daysAvailable = daysLeftInWeek != null ? daysLeftInWeek + 1 : 7;
  const canStillRecover = isLost && sessionsNeeded <= daysAvailable;
  const weeklyTarget2 = weeklyTarget; // alias para usar en JSX

  const title = isLost
    ? canStillRecover
      ? "💔 Perdiste tu racha esta semana"
      : "💔 Esta semana ya no se puede recuperar"
    : "🔥 ¡Tu racha está en riesgo!";

  const subtitle = isLost
    ? canStillRecover
      ? shields > 0
        ? `Tienes ${shields} 🛡️ escudo${shields > 1 ? "s" : ""}. Necesitas ${sessionsNeeded} sesión${sessionsNeeded > 1 ? "es" : ""} más esta semana`
        : `Necesitas ${sessionsNeeded} sesión${sessionsNeeded > 1 ? "es" : ""} más en ${daysAvailable} día${daysAvailable > 1 ? "s" : ""} — ¡todavía puedes!`
      : `La próxima semana empieza de cero. Meta: ${weeklyTarget2} sesiones`
    : `Necesitas ${sessionsNeeded} sesión${sessionsNeeded > 1 ? "es" : ""} más${daysLeftInWeek != null ? ` (quedan ${daysLeftInWeek + 1} días)` : ""}`;

  return (
    <div onClick={onOpenStreak} style={{ cursor: "pointer", background: bg, border: `1px solid ${border}`, borderRadius: 14, padding: "12px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>{isLost ? (canStillRecover ? "💔" : "😔") : "⚠️"}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color, marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{subtitle}</div>
        </div>
      </div>
      {isLost && canStillRecover && (
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            className="btn-primary"
            style={{ flex: 1, fontSize: 12, padding: "9px 0", background: color, borderColor: color }}
            onClick={e => { e.stopPropagation(); onGoHome?.(); }}>
            💪 Recuperar racha
          </button>
        </div>
      )}
      {isLost && !canStillRecover && (
        <div style={{ marginTop: 10 }}>
          <button
            className="btn-primary"
            style={{ width: "100%", fontSize: 12, padding: "9px 0", background: "#6366f1", borderColor: "#6366f1" }}
            onClick={e => { e.stopPropagation(); onGoHome?.(); }}>
            🚀 Preparar la próxima semana
          </button>
        </div>
      )}
      {!isLost && (
        <div style={{ marginTop: 10 }}>
          <button
            className="btn-primary"
            style={{ width: "100%", fontSize: 12, padding: "9px 0", background: color, borderColor: color }}
            onClick={e => { e.stopPropagation(); onGoHome?.(); }}>
            ⚡ Entrenar
          </button>
        </div>
      )}
    </div>
  );
}



export function StreakBanner({ sessions }) {
  const streak = getStreak(sessions);
  if (streak < 1) return null;
  const color = streak >= 90 ? "#f97316" : streak >= 30 ? "#a855f7" : streak >= 14 ? "#3b82f6" : streak >= 7 ? "#22c55e" : "#f59e0b";
  const msg   = streak >= 365 ? "¡LEYENDA VIVIENTE!" : streak >= 90 ? "¡IMPARABLE!" : streak >= 30 ? "¡INCENDIO TOTAL!" : streak >= 14 ? "¡En llamas!" : streak >= 7 ? "¡Semana perfecta!" : "¡Sigue así!";
  const milestones = [3,7,14,30,90,365];
  const nextMilestone = milestones.find(m => m > streak) || null;
  const prevMilestone = [...milestones].reverse().find(m => m <= streak) || 0;
  const pct = nextMilestone ? ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100 : 100;

  return (
    <div style={{ background:`linear-gradient(135deg,${color}15,${color}05)`, border:`1px solid ${color}40`, borderRadius:16, padding:"14px 18px", marginBottom:18, boxShadow:`0 4px 24px ${color}15` }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ fontSize:36, lineHeight:1, filter:`drop-shadow(0 0 8px ${color}80)` }}>🔥</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"Inter, sans-serif", fontSize:10, fontWeight:800, color, letterSpacing:2, textTransform:"uppercase", marginBottom:1 }}>{msg}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"Inter, sans-serif", fontSize:38, fontWeight:900, color, lineHeight:1 }}>{streak}</span>
            <span style={{ fontSize:13, color:"var(--text-muted)", fontWeight:500 }}>semanas seguidas</span>
          </div>
        </div>
        {nextMilestone && (
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:9, color:"var(--text-muted)", fontWeight:600, marginBottom:4 }}>Próximo hito</div>
            <div style={{ fontFamily:"Inter, sans-serif", fontSize:20, fontWeight:900, color, lineHeight:1 }}>{nextMilestone}sem</div>
            <div style={{ fontSize:9, color:"var(--text-muted)" }}>faltan {nextMilestone-streak}</div>
          </div>
        )}
      </div>
      {nextMilestone && (
        <div style={{ marginTop:10 }}>
          <div style={{ background:"var(--border)", borderRadius:20, height:5, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${color}80,${color})`, borderRadius:20, transition:"width 0.6s ease", boxShadow:`0 0 6px ${color}60` }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:8, color:"var(--text-muted)" }}>{prevMilestone}sem</span>
            <span style={{ fontSize:8, color:"var(--text-muted)" }}>{nextMilestone}sem</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function StreakChip({ sessions, compact = false }) {
  const streak = getStreak(sessions);
  if (streak < 2) return null;
  const color = streak >= 30 ? "#f97316" : streak >= 14 ? "#a855f7" : streak >= 7 ? "#3b82f6" : "#f59e0b";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:`${color}18`, border:`1px solid ${color}50`, borderRadius:20, padding: compact ? "2px 7px" : "3px 10px", fontSize: compact ? 10 : 11, fontWeight:700, color, flexShrink:0 }}>
      🔥 {streak}sem
    </span>
  );
}