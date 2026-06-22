import { calc1RM, getStreak } from "../utils/gymCalcs";
import { calcSessionVolume } from "../utils/gymCalcs";
import { todayStr } from "../utils/helpers";
import { generateInsights } from "./InsightsModal";
import StatsBanner from "./StatsBanner";
import { StreakRiskBanner } from "./StreakWidgets";
import BeastMascot from "./BeastMascot";
import { MuscleBalance } from "./ProgressWidgets";
import WeekComparison from "./WeekComparison";

export default function Dashboard({ sessions, bodyStats, weeklyGoal, onGoalClick, onBadgesClick, onStartSession, onRegisterSession, onGoHome, onInsightsClick, onStatsProClick, onStatsUnlockedClick, coachRoutines = [], onOpenCoach, onStartCoachRoutine, user, showCompletedBanner = false, isPro = false, newBadgesCount = 0, onMuscleMapClick, onOpenStreak }) {
  // ── Stats ──────────────────────────────────────────────────────────────────
  const weeklyTarget = weeklyGoal?.target || 3;
  const streak = getStreak(sessions, weeklyTarget);
  const todayStr2 = todayStr();

  // Sesiones este mes
  const now = new Date(); now.setHours(0,0,0,0);
  const sessionsThisMonth = sessions.filter(s => {
    const d = new Date(s.date + "T00:00:00");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // PRs este mes
  const prs = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    const rm = calc1RM(
      ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(ex.weight) || 0,
      ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(ex.reps) || 0
    );
    if (!prs[ex.name] || rm > prs[ex.name].rm) prs[ex.name] = { rm, date: s.date };
  }));
  const totalPRs = Object.keys(prs).length;
  // PRs conseguidos este mes
  const prsThisMonth = Object.values(prs).filter(p => {
    const d = new Date(p.date + "T00:00:00");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Últimas 3 sesiones
  const recentSessions = [...sessions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  // Top 2 insights
  const allInsights = generateInsights(sessions, bodyStats);
  const topInsights = allInsights.slice(0, 2);

  // Coach routine for today — muestra la de hoy si existe, si no la primera asignada
  const todayDow = (new Date().getDay() + 6) % 7;
  const todayCoachRoutine = coachRoutines.length > 0
    ? (coachRoutines.find(r => Number(r.dayOfWeek) === todayDow) || coachRoutines[0])
    : null;
  const isCoachRoutineForToday = todayCoachRoutine
    ? Number(todayCoachRoutine.dayOfWeek) === todayDow
    : false;
  const coachRoutineDone = todayCoachRoutine
    ? sessions.some(s => s.date === todayStr2 && s.coachRoutineDocId === todayCoachRoutine._docId)
    : false;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>

      {/* ══ 0. STREAK RISK BANNER ════════════════════════════════════════════ */}
      <StreakRiskBanner
        sessions={sessions}
        weeklyTarget={weeklyTarget}
        onOpenStreak={onOpenStreak}
        onStartSession={() => onStartSession && onStartSession("Todos")}
        onRegisterSession={onRegisterSession}
        onGoHome={onGoHome}
      />

      {/* ══ 1. BRUX ═══════════════════════════════════════════════════════════ */}
      <BeastMascot sessions={sessions} todayPlanned={""} streak={streak} onStartSession={onStartSession} />

      {/* ══ 2. FILA COMPACTA: mes · racha · PRs ═══════════════════════════════ */}
      <div style={{
        display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:20,
      }}>
        {[
          { value: sessionsThisMonth, label: "sesiones este mes", icon: "🗓️", onClick: null },
          {
            value: streak > 0 ? `${streak}` : "0",
            label: streak === 1 ? "semana de racha" : "semanas de racha",
            icon: "🔥",
            onClick: null,
            accent: streak >= 7,
          },
          { value: prsThisMonth > 0 ? `+${prsThisMonth}` : totalPRs, label: prsThisMonth > 0 ? "PRs este mes 🆕" : "PRs totales", icon: "🏆", onClick: null },
        ].map((stat, i) => (
          <div
            key={i}
            onClick={stat.onClick}
            style={{
              background:"var(--card)", border:`1px solid ${stat.accent ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
              borderRadius:14, padding:"14px 10px", textAlign:"center",
              cursor: stat.onClick ? "pointer" : "default",
              boxShadow: stat.accent ? "0 0 16px rgba(249,115,22,0.12)" : "none",
            }}
          >
            <div style={{ fontSize:22, marginBottom:4 }}>{stat.icon}</div>
            <div style={{
              fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:900, lineHeight:1,
              color: stat.accent ? "#f97316" : "var(--accent)", marginBottom:4,
            }}>{stat.value}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600, lineHeight:1.3 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ══ 3. COACH ROUTINE (si aplica) ══════════════════════════════════════ */}
      {todayCoachRoutine && !coachRoutineDone && (
        <div style={{
          background:"rgba(207,255,77,0.04)", border:"2px solid var(--accent)",
          borderRadius:12, marginBottom:20, overflow:"hidden",
          boxShadow:"0 0 24px rgba(207,255,77,0.12)",
        }}>
          <div style={{ background:"rgba(207,255,77,0.12)", padding:"7px 14px", borderBottom:"1px solid rgba(207,255,77,0.15)" }}>
            <span style={{ fontSize:10, fontWeight:900, letterSpacing:2, textTransform:"uppercase", color:"var(--accent)" }}>
              {isCoachRoutineForToday ? "⚡ TU COACH TE MANDÓ RUTINA PARA HOY" : "🏋️ TU COACH TE ASIGNÓ UNA RUTINA"}
            </span>
          </div>
          <div style={{ padding:"14px 16px", display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:900, letterSpacing:1, textTransform:"uppercase", marginBottom:6 }}>
                {todayCoachRoutine.name || todayCoachRoutine.routineName || "Entrenamiento"}
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                {(todayCoachRoutine.exercises||[]).slice(0,4).map((ex,i) => (
                  <span key={i} style={{ fontSize:10, background:"var(--card)", border:"1px solid var(--border)", borderRadius:4, padding:"2px 8px", color:"var(--text-muted)", fontWeight:600 }}>
                    {ex.name||ex}
                  </span>
                ))}
                {(todayCoachRoutine.exercises||[]).length > 4 && <span style={{ fontSize:10, color:"var(--text-muted)" }}>+{todayCoachRoutine.exercises.length-4} más</span>}
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onStartCoachRoutine && onStartCoachRoutine(todayCoachRoutine); }}
              style={{ background:"var(--accent)", border:"none", borderRadius:10, color:"#0E0F13", fontWeight:900, fontSize:13, padding:"10px 16px", cursor:"pointer", flexShrink:0, letterSpacing:1, fontFamily:"Barlow Condensed, sans-serif", textTransform:"uppercase", boxShadow:"0 0 16px rgba(207,255,77,0.3)" }}
            >⚡ INICIAR</button>
          </div>
        </div>
      )}
      {todayCoachRoutine && coachRoutineDone && showCompletedBanner && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", marginBottom:20, background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:10, animation:"fadeOutBanner 5s forwards" }}>
          <span style={{ fontSize:13, color:"#22c55e", fontWeight:700 }}>✅ {todayCoachRoutine.name || todayCoachRoutine.routineName} completada hoy</span>
          {coachRoutines.length > 1 && (
            <button onClick={onOpenCoach} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:11, fontWeight:700, cursor:"pointer", padding:0 }}>
              Ver todas ({coachRoutines.length}) →
            </button>
          )}
        </div>
      )}



      {/* ══ 5. INSIGHTS (máx. 2) ══════════════════════════════════════════════ */}
      {topInsights.length > 0 && (
        <div style={{ marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", fontFamily:"Barlow Condensed, sans-serif" }}>
              💡 Insights
            </span>
            {allInsights.length > 2 && (
              <button onClick={onInsightsClick} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:11, fontWeight:700, cursor:"pointer", padding:0 }}>
                Ver todos ({allInsights.length}) →
              </button>
            )}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {topInsights.map(ins => (
              <div
                key={ins.id}
                onClick={onInsightsClick}
                style={{ display:"flex", gap:10, alignItems:"center", background:`${ins.color}0d`, border:`1px solid ${ins.color}30`, borderRadius:12, padding:"11px 14px", cursor:"pointer" }}
              >
                <span style={{ fontSize:18, flexShrink:0 }}>{ins.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:ins.color }}>{ins.title}</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ins.msg}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ 6. STATS PRO BANNER ═══════════════════════════════════════════════ */}
      <StatsBanner isPro={isPro} onProClick={onStatsProClick} onUnlocked={onStatsProClick} onVideoUnlocked={onStatsUnlockedClick} />

      {/* ══ 7. ÚLTIMAS 3 SESIONES ════════════════════════════════════════════ */}
      {recentSessions.length > 0 && (
        <div style={{ marginTop:4 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", fontFamily:"Barlow Condensed, sans-serif" }}>
              Últimas sesiones
            </span>
            <button
              onClick={() => {
                // Navegar a historial — usamos el setter expuesto por el padre vía onStartSession hack:
                // En realidad llamamos a un truco: disparamos un evento custom que GymApp captura
                // Pero como no tenemos prop directa, navegamos a través de onGoalClick que no se usa aquí,
                // lo más limpio es emitir desde aquí. Ver nota abajo*.
                typeof onGoalClick === "function" && onGoalClick("history");
              }}
              style={{ background:"none", border:"none", color:"var(--accent)", fontSize:11, fontWeight:700, cursor:"pointer", padding:0 }}
            >
              Ver todo →
            </button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recentSessions.map(s => {
              const vol = calcSessionVolume(s);
              const volStr = vol >= 1000 ? `${(vol/1000).toFixed(1)}t` : vol > 0 ? `${Math.round(vol)}kg` : null;
              const [y,m,d] = (s.date||"").split("-");
              const dateLabel = s.date ? (() => {
                const dow = new Date(+y,+m-1,+d).getDay();
                return ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][dow] + ` ${+d}/${+m}`;
              })() : "";
              const hasPR = (() => {
                const ts = new Date(s.date+"T00:00:00").getTime();
                return (s.exercises||[]).some(ex => {
                  const w = ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
                  const prevBest = sessions.filter(ps=>new Date(ps.date+"T00:00:00").getTime()<ts)
                    .flatMap(ps=>(ps.exercises||[]).filter(pe=>pe.name===ex.name))
                    .reduce((b,pe)=>Math.max(b,parseFloat(pe.weight)||0),0);
                  return w>prevBest && w>0;
                });
              })();
              return (
                <div key={s.id} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                      <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:16, fontWeight:800, color:"var(--text)" }}>
                        {s.workout || "Sesión"}
                      </span>
                      {hasPR && <span style={{ fontSize:9, background:"rgba(251,191,36,0.18)", border:"1px solid rgba(251,191,36,0.5)", color:"#f59e0b", borderRadius:6, padding:"1px 6px", fontWeight:800 }}>🏆 PR</span>}
                    </div>
                    <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", gap:10 }}>
                      <span>{dateLabel}</span>
                      {(s.exercises||[]).length > 0 && <span>{(s.exercises||[]).length} ejerc.</span>}
                      {volStr && <span>{volStr}</span>}
                      {s.durationSecs && <span>{Math.round(s.durationSecs/60)} min</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ BALANCE MUSCULAR ═════════════════════════════════════════════════ */}
      <div style={{ marginTop:16 }}>
        <MuscleBalance sessions={sessions} />
      </div>

      {/* ══ MAPA MUSCULAR ════════════════════════════════════════════════════ */}
      <WeekComparison sessions={sessions} />

      <button
        onClick={onMuscleMapClick}
        style={{ width:"100%", marginTop:16, padding:"14px 18px", borderRadius:14, border:"1px solid var(--border)", background:"var(--card)", cursor:"pointer", display:"flex", alignItems:"center", gap:14, textAlign:"left" }}
      >
        <span style={{ fontSize:28 }}>💪</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:14, fontWeight:800, color:"var(--text)", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:1, textTransform:"uppercase" }}>Mapa Muscular</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Volumen y recuperación por músculo</div>
        </div>
        <span style={{ color:"var(--text-muted)", fontSize:16 }}>→</span>
      </button>
    </div>
  );
}