import { calc1RM, getStreak, getStreakStatus, calcSessionVolume } from "../utils/gymCalcs";
import { todayStr } from "../utils/helpers";
import { generateInsights } from "./InsightsModal";
import StatsBanner from "./StatsBanner";
import { StreakRiskBanner } from "./StreakWidgets";
import BeastMascot from "./BeastMascot";
import { MuscleBalance } from "./ProgressWidgets";
import WeekComparison from "./WeekComparison";
import { Dumbbell, ClipboardList, BookOpen, Sparkles, ChevronRight, Trophy } from "lucide-react";

export default function Dashboard({ sessions, bodyStats, weeklyGoal, onGoalClick, onBadgesClick, onStartSession, onRegisterSession, onGoHome, onInsightsClick, onStatsProClick, onStatsUnlockedClick, coachRoutines = [], onOpenCoach, onStartCoachRoutine, user, showCompletedBanner = false, isPro = false, newBadgesCount = 0, onMuscleMapClick, onOpenStreak, onLibrary, onAIChat }) {
  // ── Stats ──────────────────────────────────────────────────────────────────
  const weeklyTarget = weeklyGoal?.target || 3;
  const streak = getStreak(sessions, weeklyTarget);
  const todayStr2 = todayStr();
  const firstName = (user?.name || "").split(" ")[0] || "Bestia";

  const now = new Date(); now.setHours(0,0,0,0);
  const sessionsThisMonth = sessions.filter(s => {
    const d = new Date(s.date + "T00:00:00");
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  // Semana actual
  const status = getStreakStatus(sessions, weeklyTarget);
  const sessionsThisWeek = status.sessionsThisWeek || 0;
  const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekSessions = sessions.filter(s => new Date(s.date + "T00:00:00") >= monday);
  const weekVolume = weekSessions.reduce((a, s) => a + calcSessionVolume(s), 0);
  const weekMinutes = Math.round(weekSessions.reduce((a, s) => a + (s.durationSecs || 0), 0) / 60);

  // PRs (mejor 1RM por serie)
  const prs = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
    const rm = Math.max(0, ...sets.map(st => calc1RM(parseFloat(st.weight)||0, parseFloat(st.reps)||0)));
    if (rm > 0 && (!prs[ex.name] || rm > prs[ex.name].rm)) prs[ex.name] = { rm, date: s.date };
  }));
  const totalPRs = Object.keys(prs).length;

  // Último peso corporal
  const weightEntries = bodyStats?.entries || [];
  const lastWeight = weightEntries.length > 0
    ? [...weightEntries].sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0]?.weight
    : null;

  // Nivel / XP (derivado de sesiones — sin features nuevas)
  const totalSessions = sessions.length;
  const level = Math.floor(totalSessions / 10) + 1;
  const xpInLevel = totalSessions % 10;
  const xpPct = Math.round((xpInLevel / 10) * 100);

  // Recomendación del día (primer insight)
  const allInsights = generateInsights(sessions, bodyStats);
  const topInsight = allInsights[0] || null;

  // Últimas 3 sesiones
  const recentSessions = [...sessions].sort((a, b) => (b.date||"").localeCompare(a.date||"")).slice(0, 3);

  // Coach routine de hoy
  const todayDow = (new Date().getDay() + 6) % 7;
  const todayCoachRoutine = coachRoutines.length > 0
    ? (coachRoutines.find(r => Number(r.dayOfWeek) === todayDow) || coachRoutines[0])
    : null;
  const isCoachRoutineForToday = todayCoachRoutine ? Number(todayCoachRoutine.dayOfWeek) === todayDow : false;
  const coachRoutineDone = todayCoachRoutine
    ? sessions.some(s => s.date === todayStr2 && s.coachRoutineDocId === todayCoachRoutine._docId)
    : false;

  const todayName = todayCoachRoutine?.name || todayCoachRoutine?.routineName || null;
  const todayExCount = (todayCoachRoutine?.exercises || []).length;
  const todayMinEst = todayExCount > 0 ? todayExCount * 7 : null;

  const CARD = { background:"var(--card)", border:"1px solid var(--border)", borderRadius:16, boxShadow:"var(--shadow)" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

      {/* ══ HEADER ════════════════════════════════════════════════════════════ */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
        <div>
          <div style={{ fontSize:13, color:"var(--text-muted)", fontWeight:500 }}>Hola, {firstName} 👋</div>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:24, fontWeight:800, lineHeight:1.1, letterSpacing:0.5 }}>
            ¿Listo para entrenar?
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={onOpenStreak} style={{ ...CARD, padding:"7px 11px", display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
            <span style={{ fontSize:14 }}>🔥</span>
            <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:16, color: streak>0 ? "#f97316" : "var(--text-muted)" }}>{streak}</span>
          </button>
          <button onClick={() => onGoalClick && onGoalClick("goal")} style={{ ...CARD, padding:"7px 11px", display:"flex", alignItems:"center", gap:5, cursor:"pointer" }}>
            <span style={{ fontSize:14 }}>🎯</span>
            <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:16 }}>{sessionsThisWeek}/{weeklyTarget}</span>
          </button>
        </div>
      </div>

      {/* ══ STREAK RISK (retención) ═══════════════════════════════════════════ */}
      <StreakRiskBanner
        sessions={sessions} weeklyTarget={weeklyTarget}
        onOpenStreak={onOpenStreak}
        onStartSession={() => onStartSession && onStartSession("Todos")}
        onRegisterSession={onRegisterSession} onGoHome={onGoHome}
      />

      {/* ══ CARD PRINCIPAL — Entrenamiento de hoy ═════════════════════════════ */}
      <div style={{ ...CARD, padding:0, overflow:"hidden", borderColor: todayCoachRoutine && !coachRoutineDone ? "var(--accent)" : "var(--border)" }}>
        <div style={{ padding:"16px 18px" }}>
          <div style={{ fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", color:"var(--accent)", marginBottom:8, fontFamily:"Barlow Condensed, sans-serif" }}>
            {todayCoachRoutine && isCoachRoutineForToday ? "⚡ Tu coach · hoy" : "Entrenamiento de hoy"}
          </div>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:30, fontWeight:900, lineHeight:1, textTransform:"uppercase", letterSpacing:0.5, marginBottom:8 }}>
            {todayName || "Entrenamiento libre"}
          </div>
          <div style={{ display:"flex", gap:14, color:"var(--text-muted)", fontSize:13, fontWeight:500, marginBottom:16 }}>
            <span>{todayExCount > 0 ? `${todayExCount} ejercicios` : "Tú eliges los ejercicios"}</span>
            {todayMinEst && <span>· ~{todayMinEst} min</span>}
          </div>
          {todayCoachRoutine && coachRoutineDone ? (
            <div style={{ display:"flex", alignItems:"center", gap:8, color:"var(--success)", fontWeight:700, fontSize:14 }}>
              ✅ Completado hoy
              {coachRoutines.length > 1 && <button onClick={onOpenCoach} style={{ marginLeft:"auto", background:"none", border:"none", color:"var(--accent)", fontWeight:700, fontSize:12, cursor:"pointer" }}>Ver todas →</button>}
            </div>
          ) : (
            <button
              onClick={() => todayCoachRoutine ? (onStartCoachRoutine && onStartCoachRoutine(todayCoachRoutine)) : (onStartSession && onStartSession("Todos"))}
              style={{ width:"100%", background:"var(--accent)", border:"none", borderRadius:12, color:"#09090B", fontFamily:"Barlow Condensed, sans-serif", fontWeight:900, fontSize:17, letterSpacing:1.5, textTransform:"uppercase", padding:"14px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}
            >
              <Dumbbell size={19} strokeWidth={2.5} /> Continuar entrenamiento
            </button>
          )}
        </div>
      </div>

      {/* ══ RESUMEN RÁPIDO — grid 2x2 ═════════════════════════════════════════ */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {[
          { icon:"🔥", value: streak, label:"Racha (semanas)", onClick:onOpenStreak },
          { icon:"🎯", value:`${sessionsThisWeek}/${weeklyTarget}`, label:"Meta semanal", onClick:()=>onGoalClick&&onGoalClick("goal") },
          { icon:"📈", value: totalPRs, label:"Récords (PRs)", onClick:onStatsProClick },
          { icon:"⚖️", value: lastWeight ? `${lastWeight}` : "—", label: lastWeight ? "Peso (kg)" : "Sin registro", onClick:null },
        ].map((s, i) => (
          <div key={i} onClick={s.onClick} style={{ ...CARD, padding:"14px 16px", cursor:s.onClick?"pointer":"default", display:"flex", alignItems:"center", gap:12 }}>
            <span style={{ fontSize:22 }}>{s.icon}</span>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:24, fontWeight:900, lineHeight:1, color:"var(--text)" }}>{s.value}</div>
              <div style={{ fontSize:10.5, color:"var(--text-muted)", fontWeight:600, marginTop:3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ PROGRESO SEMANAL ══════════════════════════════════════════════════ */}
      <div style={{ ...CARD, padding:"16px 18px" }}>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", color:"var(--text-muted)", marginBottom:14, fontFamily:"Barlow Condensed, sans-serif" }}>
          Esta semana
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:4 }}>
          {[
            { value: sessionsThisWeek, label:"entrenos" },
            { value: weekVolume >= 1000 ? `${(weekVolume/1000).toFixed(1)}t` : `${Math.round(weekVolume)}`, label: weekVolume>=1000?"volumen":"kg movidos" },
            { value: weekMinutes > 0 ? weekMinutes : "—", label:"minutos" },
          ].map((s, i) => (
            <div key={i} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:900, color:"var(--accent)", lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:10, color:"var(--text-muted)", fontWeight:600, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:8 }}><WeekComparison sessions={sessions} /></div>
      </div>

      {/* ══ BEAST COACH — recomendación reducida ══════════════════════════════ */}
      {topInsight && (
        <button onClick={onInsightsClick} style={{ ...CARD, padding:"13px 16px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", textAlign:"left", width:"100%" }}>
          <span style={{ fontSize:20, flexShrink:0 }}>🤖</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:11, fontWeight:800, color:"var(--accent)", letterSpacing:1, textTransform:"uppercase", marginBottom:2 }}>Recomendación del día</div>
            <div style={{ fontSize:13, color:"var(--text)", fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{topInsight.title}</div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink:0 }} />
        </button>
      )}

      {/* ══ ACCIONES RÁPIDAS — grid 2x2 ═══════════════════════════════════════ */}
      <div>
        <div style={{ fontSize:10, fontWeight:800, letterSpacing:2, textTransform:"uppercase", color:"var(--text-muted)", marginBottom:10, fontFamily:"Barlow Condensed, sans-serif" }}>
          Acciones rápidas
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
          {[
            { Icon: Dumbbell, label:"Entrenar", onClick:()=>onStartSession&&onStartSession("Todos") },
            { Icon: ClipboardList, label:"Registrar", onClick:onRegisterSession },
            { Icon: BookOpen, label:"Biblioteca", onClick:onLibrary },
            { Icon: Sparkles, label:"IA Coach", onClick:onAIChat },
          ].map(({ Icon, label, onClick }, i) => (
            <button key={i} onClick={onClick} style={{ ...CARD, padding:"16px 14px", display:"flex", alignItems:"center", gap:12, cursor:"pointer", textAlign:"left" }}>
              <span style={{ width:38, height:38, borderRadius:10, background:"var(--accent-dim)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Icon size={20} color="var(--accent)" strokeWidth={2.2} />
              </span>
              <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontWeight:800, fontSize:16, textTransform:"uppercase", letterSpacing:0.5 }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ══ GAMIFICACIÓN — nivel · XP · logros ════════════════════════════════ */}
      <button onClick={onBadgesClick} style={{ ...CARD, padding:"16px 18px", cursor:"pointer", textAlign:"left", width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
          <span style={{ width:42, height:42, borderRadius:12, background:"var(--accent-dim)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Trophy size={22} color="var(--accent)" />
          </span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:900, lineHeight:1, textTransform:"uppercase" }}>Nivel {level}</div>
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:3 }}>{xpInLevel}/10 entrenos al siguiente nivel{newBadgesCount > 0 ? ` · ${newBadgesCount} logro${newBadgesCount>1?"s":""} nuevo${newBadgesCount>1?"s":""}` : ""}</div>
          </div>
          {newBadgesCount > 0 && <span style={{ background:"var(--accent)", color:"#09090B", fontWeight:900, fontSize:11, borderRadius:20, padding:"2px 9px" }}>{newBadgesCount} 🆕</span>}
        </div>
        <div style={{ height:8, background:"var(--input-bg)", borderRadius:20, overflow:"hidden" }}>
          <div style={{ width:`${xpPct}%`, height:"100%", background:"var(--accent)", borderRadius:20, transition:"width 0.4s ease" }} />
        </div>
      </button>

      {/* ══ STATS PRO BANNER ══════════════════════════════════════════════════ */}
      <StatsBanner isPro={isPro} onProClick={onStatsProClick} onUnlocked={onStatsProClick} onVideoUnlocked={onStatsUnlockedClick} />

      {/* ══ ÚLTIMAS SESIONES ══════════════════════════════════════════════════ */}
      {recentSessions.length > 0 && (
        <div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", fontFamily:"Barlow Condensed, sans-serif" }}>Actividad reciente</span>
            <button onClick={() => typeof onGoalClick === "function" && onGoalClick("history")} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:11, fontWeight:700, cursor:"pointer", padding:0 }}>Ver todo →</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {recentSessions.map(s => {
              const vol = calcSessionVolume(s);
              const volStr = vol >= 1000 ? `${(vol/1000).toFixed(1)}t` : vol > 0 ? `${Math.round(vol)}kg` : null;
              const [y,m,d] = (s.date||"").split("-");
              const dateLabel = s.date ? ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][new Date(+y,+m-1,+d).getDay()] + ` ${+d}/${+m}` : "";
              return (
                <div key={s.id} style={{ ...CARD, borderRadius:12, padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:16, fontWeight:800, color:"var(--text)" }}>{s.workout || "Sesión"}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", gap:10, marginTop:2 }}>
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

      {/* ══ BALANCE MUSCULAR + MAPA ═══════════════════════════════════════════ */}
      <MuscleBalance sessions={sessions} />
      <button onClick={onMuscleMapClick} style={{ ...CARD, padding:"14px 18px", cursor:"pointer", display:"flex", alignItems:"center", gap:14, textAlign:"left", width:"100%" }}>
        <span style={{ fontSize:24 }}>💪</span>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:15, fontWeight:800, textTransform:"uppercase", letterSpacing:0.5 }}>Mapa muscular</div>
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>Volumen y recuperación por músculo</div>
        </div>
        <ChevronRight size={18} color="var(--text-muted)" />
      </button>

      {/* ══ BRUX (motivación, ahora secundario) ═══════════════════════════════ */}
      <BeastMascot sessions={sessions} todayPlanned={""} streak={streak} onStartSession={onStartSession} />
    </div>
  );
}
