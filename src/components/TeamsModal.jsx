import { useState, useEffect } from "react";
import { useConfirm } from "./ConfirmModal";
import { useAuth } from "./AuthContext";
import { calc1RM, getStreak } from "../utils/gymCalcs";
import { load, store, todayStr } from "../utils/helpers";
import { teamsGet, teamsSet } from "../utils/firebaseService";
import { auth } from "../firebase";
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

export default function TeamsModal({ user, sessions, onClose, initialJoinCode }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const { logout } = useAuth();
  const [tab, setTab] = useState("home");
  const [myTeams, setMyTeams] = useState(() => load(`gym_teams_${user.email}`, []));
  const [activeTeam, setActiveTeam] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teamPreviews, setTeamPreviews] = useState({});
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState(initialJoinCode || "");
  const [joinPreview, setJoinPreview] = useState(null);
  const [joinPreviewing, setJoinPreviewing] = useState(false);
  const [err, setErr] = useState("");
  const [rankMetric, setRankMetric] = useState("volume");

  function saveMyTeams(t) { setMyTeams(t); store(`gym_teams_${user.email}`, t); }

  // Stats for this user
  const myStats = (() => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const thisWeekRMs = {}, lastWeekRMs = {};
    sessions.forEach(s => {
      const d = new Date(s.date + "T00:00:00");
      const isThisWeek = d >= weekAgo;
      const isLastWeek = d >= twoWeeksAgo && d < weekAgo;
      (s.exercises||[]).forEach(ex => {
        const w = ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
        const r = ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)):parseFloat(ex.reps)||0;
        const rm = calc1RM(w,r);
        if (rm <= 0) return;
        if (isThisWeek) thisWeekRMs[ex.name] = Math.max(thisWeekRMs[ex.name]||0, rm);
        if (isLastWeek) lastWeekRMs[ex.name] = Math.max(lastWeekRMs[ex.name]||0, rm);
      });
    });
    const improvements = Object.entries(thisWeekRMs)
      .filter(([name]) => lastWeekRMs[name] > 0)
      .map(([name, rm]) => ({ name, pct: Math.round(((rm - lastWeekRMs[name]) / lastWeekRMs[name]) * 1000) / 10 }));
    const weeklyProgress = improvements.length > 0
      ? Math.round(improvements.reduce((s,i) => s+i.pct, 0) / improvements.length * 10) / 10 : 0;
    const bestImprovement = improvements.sort((a,b) => b.pct-a.pct)[0] || null;
    return {
      name: user.name, email: user.email, sessions: sessions.length,
      volume: Math.round(sessions.reduce((acc,s) => acc+(s.exercises||[]).reduce((a,ex)=>{
        const w = ex.sets?.length>0 ? ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0) : (parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1);
        return a+w;
      },0),0)/1000 * 10)/10,
      prs: (() => {
        const p={}; sessions.forEach(s=>(s.exercises||[]).forEach(ex=>{
          const w=ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
          const r=ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)):parseFloat(ex.reps)||0;
          const rm=calc1RM(w,r); if(!p[ex.name]||rm>p[ex.name])p[ex.name]=rm;
        })); return Object.keys(p).length;
      })(),
      streak: getStreak(sessions), weeklyProgress, bestImprovement,
      thisWeekSessions: sessions.filter(s => new Date(s.date+"T00:00:00") >= weekAgo).length,
      lastUpdate: todayStr(), lastSync: Date.now(),
    };
  })();

  async function shareInviteLink(code) {
    const url = `https://gymtracker-app-2c603.web.app/join/${code}`;
    const text = `¡Únete a mi GymTeam "${activeTeam?.name}"! 💪`;
    if (Capacitor.isNativePlatform()) {
      await Share.share({ title: text, text, url, dialogTitle: "Invitar al team" });
    } else {
      try { await navigator.share({ title: text, text, url }); }
      catch { await navigator.clipboard.writeText(url); setErr("✅ Link copiado al portapapeles"); setTimeout(() => setErr(""), 2500); }
    }
  }

  async function previewJoin(code) {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setJoinPreview(null); return; }
    if (myTeams.find(t => t.code === c)) { setErr("Ya eres miembro de este equipo"); setJoinPreview(null); return; }
    setJoinPreviewing(true); setErr("");
    const data = await teamsGet(`team_${c}`);
    setJoinPreviewing(false);
    if (data) setJoinPreview(data); else setJoinPreview(null);
  }

  // Si se abrió desde un deep link, disparar preview automáticamente
  useEffect(() => {
    if (initialJoinCode && initialJoinCode.length >= 4) {
      previewJoin(initialJoinCode);
    }
  }, [initialJoinCode]);

  useEffect(() => {
    const savedTeams = load(`gym_teams_${user.email}`, []);
    if (savedTeams.length === 0) return;

    const syncAll = async () => {
      const results = await Promise.all(
        savedTeams.map(async t => {
          const data = await teamsGet(`team_${t.code}`);
          if (data) {
            const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
            await teamsSet(`team_${t.code}`, updated);
            return { code: t.code, updated };
          }
          return { code: t.code, updated: null };
        })
      );

      const newPreviews = {};
      results.forEach(({ code, updated }) => { newPreviews[code] = updated; });
      setTeamPreviews(newPreviews);

      if (activeTeam) {
        const active = results.find(r => r.code === activeTeam.code);
        if (active?.updated) setTeamData(active.updated);
      }
    };

    syncAll();
  }, [sessions.length]);

  async function loadTeam(code) {
    setLoading(true);
    const fullKey = code.startsWith("team_") ? code : `team_${code}`;
    const data = await teamsGet(fullKey);
    setTeamData(data); setLoading(false);
  }

  async function createTeam() {
    if (!createName.trim()) { setErr("Agrega un nombre al equipo"); return; }
    if (myTeams.length >= 3) { setErr("Puedes estar en un máximo de 3 teams."); return; }
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const team = { code, name: createName.trim(), createdBy: user.name, members: { [user.email]: myStats }, createdAt: todayStr() };
    await teamsSet(`team_${code}`, team);
    const newTeam = { code, name: createName.trim() };
    saveMyTeams([...myTeams, newTeam]);
    setTeamPreviews(prev => ({ ...prev, [code]: team }));
    setActiveTeam(newTeam); await loadTeam(code); setTab("team"); setCreateName(""); setErr("");
  }

  async function joinTeam() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setErr("Ingresa el código"); return; }
    if (!user.isGuest && auth.currentUser && !auth.currentUser.emailVerified) {
      setErr("⚠️ Verifica tu email antes de unirte a un team."); return;
    }
    if (myTeams.length >= 3) { setErr("Puedes estar en un máximo de 3 teams."); return; }
    setLoading(true);
    const data = await teamsGet(`team_${code}`);
    setLoading(false);
    if (!data) { setErr("Team no encontrado. Verifica el código."); return; }
    const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
    await teamsSet(`team_${code}`, updated);
    saveMyTeams([...myTeams.filter(t=>t.code!==code), { code, name: data.name }]);
    setActiveTeam({ code, name: data.name }); setTeamData(updated); setTab("team");
    setJoinCode(""); setJoinPreview(null); setErr("");
  }

  async function syncStats() {
    if (!activeTeam) return; setLoading(true);
    const data = await teamsGet(`team_${activeTeam.code}`);
    if (data) {
      const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
      await teamsSet(`team_${activeTeam.code}`, updated); setTeamData(updated);
    }
    setLoading(false);
  }

  async function openTeam(t) { setActiveTeam(t); await loadTeam(t.code); setTab("team"); }

  async function leaveTeam(code) {
    const ok = await askConfirm("¿Seguro que quieres salir de este equipo?"); if (!ok) return;
    setLoading(true);
    try {
      const data = await teamsGet(`team_${code}`);
      if (data) { const updated = { ...data, members: { ...data.members } }; delete updated.members[user.email]; await teamsSet(`team_${code}`, updated); }
    } catch(e) {}
    const updated = myTeams.filter(t => t.code !== code); saveMyTeams(updated);
    setTeamPreviews(prev => { const n = {...prev}; delete n[code]; return n; });
    if (activeTeam?.code === code) { setActiveTeam(null); setTeamData(null); setTab("home"); }
    setLoading(false);
  }

  const members = teamData ? Object.values(teamData.members) : [];
  const sorted = [...members].sort((a,b) => {
    if (rankMetric === "volume") return b.volume - a.volume;
    if (rankMetric === "sessions") return b.sessions - a.sessions;
    if (rankMetric === "prs") return b.prs - a.prs;
    if (rankMetric === "progress") return (b.weeklyProgress||0) - (a.weeklyProgress||0);
    return b.streak - a.streak;
  });
  const eligibleForChamp = members.filter(m => (m.weeklyProgress||0) > 0 || (m.thisWeekSessions||0) > 0);
  const weeklyChamp = eligibleForChamp.length > 0
    ? eligibleForChamp.reduce((best, m) => (m.weeklyProgress||0) > (best.weeklyProgress||0) ? m : best, eligibleForChamp[0]) : null;
  const medals = ["🥇","🥈","🥉"];

  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">👥 GymTeams</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {tab === "home" && (
          <div>
            {user.isGuest ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>🔒</div>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:24, fontWeight:800, marginBottom:8 }}>Cuenta requerida</div>
                <p style={{ fontSize:14, color:"var(--text-muted)", marginBottom:20, lineHeight:1.6 }}>
                  Para crear o unirte a un GymTeam necesitas una cuenta registrada.
                </p>
                <button className="btn-primary" style={{ fontSize:16, padding:"12px 28px" }} onClick={() => { onClose(); logout(true); }}>
                  Crear cuenta gratis →
                </button>
              </div>
            ) : (
              <>
                {myTeams.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>Mis Teams ({myTeams.length})</div>
                    {myTeams.map(t => {
                      const cached = teamPreviews[t.code];
                      const memberList = cached ? Object.values(cached.members || {}) : [];
                      return (
                        <div key={t.code} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px" }}>
                            <div>
                              <div style={{ fontWeight:700, fontSize:15 }}>{t.name}</div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"monospace", marginTop:2 }}>
                                Código: <span style={{ color:"var(--accent)", letterSpacing:2, fontWeight:700 }}>{t.code}</span>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:6 }}>
                              <button className="btn-ghost small" onClick={() => openTeam(t)}>Ver ranking →</button>
                              <button className="btn-ghost small danger" onClick={() => leaveTeam(t.code)}>🚪</button>
                            </div>
                          </div>
                          {memberList.length > 0 && (
                            <div style={{ borderTop:"1px solid var(--border)", padding:"10px 16px", background:"rgba(59,130,246,0.03)" }}>
                              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>
                                {memberList.length} miembro{memberList.length !== 1 ? "s" : ""}
                              </div>
                              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                {memberList.map(m => {
                                  const isMe = m.email === user.email;
                                  return (
                                    <div key={m.email} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background: isMe?"rgba(59,130,246,0.12)":"var(--card)", border:`1px solid ${isMe?"rgba(59,130,246,0.4)":"var(--border)"}`, borderRadius:20 }}>
                                      <div style={{ width:20, height:20, borderRadius:"50%", background: isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"white", flexShrink:0 }}>
                                        {m.name?.[0]?.toUpperCase()||"?"}
                                      </div>
                                      <span style={{ fontSize:12, fontWeight: isMe?700:500, color: isMe?"var(--accent)":"var(--text)" }}>
                                        {m.name}{isMe?" (tú)":""}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:16, marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🆕 Crear team</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="input" placeholder="Nombre del team..." value={createName} onChange={e=>setCreateName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createTeam()} style={{ flex:1 }} />
                    <button className="btn-primary" style={{ fontSize:14, padding:"10px 16px", whiteSpace:"nowrap" }} onClick={createTeam}>Crear</button>
                  </div>
                </div>

                <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🔗 Unirse a un team</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="input" placeholder="Código (ej: ABC123)" value={joinCode}
                      onChange={e => { const v = e.target.value.toUpperCase(); setJoinCode(v); setJoinPreview(null); setErr(""); if (v.length >= 4) previewJoin(v); }}
                      onKeyDown={e => e.key === "Enter" && (joinPreview ? joinTeam() : previewJoin(joinCode))}
                      style={{ flex:1, fontFamily:"monospace", letterSpacing:3, fontSize:16 }} maxLength={6} />
                    {!joinPreview
                      ? <button className="btn-ghost" style={{ whiteSpace:"nowrap" }} onClick={() => previewJoin(joinCode)} disabled={joinPreviewing}>{joinPreviewing ? "⏳" : "🔍 Buscar"}</button>
                      : <button className="btn-primary" style={{ fontSize:14, padding:"10px 16px", whiteSpace:"nowrap" }} onClick={joinTeam} disabled={loading}>{loading ? "⏳" : "✅ Unirse"}</button>
                    }
                  </div>
                  {joinPreview && !joinPreviewing && (
                    <div style={{ marginTop:12, background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                        <span style={{ fontSize:24 }}>🏟️</span>
                        <div>
                          <div style={{ fontWeight:800, fontSize:17 }}>{joinPreview.name}</div>
                          <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                            Creado por {joinPreview.createdBy} · {Object.keys(joinPreview.members||{}).length} miembro{Object.keys(joinPreview.members||{}).length!==1?"s":""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {Object.values(joinPreview.members||{}).map(m => (
                          <div key={m.email} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:20 }}>
                            <div style={{ width:22, height:22, borderRadius:"50%", background:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:11, color:"white", flexShrink:0 }}>{m.name?.[0]?.toUpperCase()||"?"}</div>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600 }}>{m.name}</div>
                              <div style={{ fontSize:10, color:"var(--text-muted)" }}>{m.sessions} ses · {m.volume}t</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {joinCode.length >= 4 && !joinPreview && !joinPreviewing && !err && (
                    <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)", textAlign:"center" }}>No se encontró ningún equipo con ese código.</div>
                  )}
                </div>
                {err && <div className="err-msg" style={{ marginTop:10 }}>{err}</div>}
              </>
            )}
          </div>
        )}

        {tab === "team" && activeTeam && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
              <button className="btn-ghost small" onClick={() => setTab("home")}>← Volver</button>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost small" onClick={syncStats} disabled={loading}>{loading?"⏳":"🔄 Mis stats"}</button>
                <button className="btn-ghost small" onClick={() => shareInviteLink(activeTeam.code)}>🔗 Invitar</button>
                <button className="btn-ghost small" onClick={() => loadTeam(activeTeam.code)} disabled={loading}>↺</button>
                <button className="btn-ghost small danger" onClick={() => leaveTeam(activeTeam.code)}>🚪 Salir</button>
              </div>
            </div>

            <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:14, padding:"14px 18px", marginBottom:16 }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800 }}>{activeTeam.name}</div>
              <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>
                Código para invitar:{" "}
                <span style={{ background:"var(--accent-dim)", color:"var(--accent)", fontFamily:"monospace", fontWeight:800, letterSpacing:3, padding:"2px 10px", borderRadius:6, fontSize:14 }}>{activeTeam.code}</span>
                {" "}· {members.length} miembro{members.length!==1?"s":""}
              </div>
            </div>

            {loading && <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>⏳ Cargando...</div>}

            {!loading && (
              <>
                {weeklyChamp && (
                  <div style={{ background:"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(245,158,11,0.06))", border:"2px solid rgba(251,191,36,0.45)", borderRadius:16, padding:"16px 18px", marginBottom:18 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase", marginBottom:10 }}>👑 Campeón de la semana</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#f59e0b,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"white", flexShrink:0, boxShadow:"0 4px 16px rgba(245,158,11,0.4)" }}>
                        {weeklyChamp.name?.[0]?.toUpperCase()||"?"}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800 }}>
                          {weeklyChamp.name}
                          {weeklyChamp.email === user.email && <span style={{ fontSize:12, color:"#f59e0b", marginLeft:8 }}>¡Eres tú! 🔥</span>}
                        </div>
                        {(weeklyChamp.weeklyProgress||0) > 0 ? (
                          <div style={{ fontSize:13, color:"#fbbf24", marginTop:2 }}>
                            Subió <b style={{ fontSize:16 }}>+{weeklyChamp.weeklyProgress}%</b> su fuerza esta semana
                          </div>
                        ) : (
                          <div style={{ fontSize:13, color:"#fbbf24" }}>{weeklyChamp.thisWeekSessions||0} sesiones esta semana 💪</div>
                        )}
                      </div>
                      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:36, fontWeight:900, color:"#f59e0b", flexShrink:0 }}>
                        {(weeklyChamp.weeklyProgress||0) > 0 ? `+${weeklyChamp.weeklyProgress}%` : `${weeklyChamp.thisWeekSessions||0} 🏋️`}
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>👥 Miembros ({members.length})</div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {members.map(m => {
                      const isMe = m.email === user.email;
                      const isChamp = weeklyChamp?.email === m.email;
                      return (
                        <div key={m.email} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background: isChamp?"rgba(251,191,36,0.08)":isMe?"rgba(59,130,246,0.1)":"var(--input-bg)", border:`1px solid ${isChamp?"rgba(251,191,36,0.4)":isMe?"rgba(59,130,246,0.4)":"var(--border)"}`, borderRadius:24 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background: isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:11, color:"white", flexShrink:0 }}>
                            {m.name?.[0]?.toUpperCase()||"?"}
                          </div>
                          <span style={{ fontSize:12, fontWeight: isMe?700:500 }}>{isChamp?"👑 ":""}{m.name}{isMe?" (tú)":""}</span>
                        </div>
                      );
                    })}
                    {members.length === 0 && <p style={{ fontSize:13, color:"var(--text-muted)" }}>Solo tú. ¡Comparte el código!</p>}
                  </div>
                </div>

                {members.length > 0 && (
                  <>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>🏆 Ranking</div>
                    <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
                      {[["progress","📈 Progreso %"],["volume","🏋️ Volumen"],["sessions","📋 Sesiones"],["prs","⭐ PRs"],["streak","🔥 Racha"]].map(([m,l])=>(
                        <button key={m} className={`muscle-chip ${rankMetric===m?"active":""}`} onClick={()=>setRankMetric(m)}>{l}</button>
                      ))}
                    </div>
                    {sorted.map((m, i) => {
                      const isMe = m.email === user.email;
                      const isChamp = weeklyChamp?.email === m.email && rankMetric === "progress";
                      let val, myVal, maxVal;
                      if (rankMetric === "progress") { val = (m.weeklyProgress||0) > 0 ? `+${m.weeklyProgress}%` : (m.thisWeekSessions||0) > 0 ? `${m.thisWeekSessions} ses.` : "—"; myVal = m.weeklyProgress||0; maxVal = Math.max(...sorted.map(x => x.weeklyProgress||0), 0.1); }
                      else if (rankMetric === "volume") { val = `${m.volume}t`; myVal = m.volume; maxVal = Math.max(...sorted.map(x=>x.volume),0.1); }
                      else if (rankMetric === "sessions") { val = `${m.sessions} ses.`; myVal = m.sessions; maxVal = Math.max(...sorted.map(x=>x.sessions),1); }
                      else if (rankMetric === "prs") { val = `${m.prs} PRs`; myVal = m.prs; maxVal = Math.max(...sorted.map(x=>x.prs),1); }
                      else { val = `${m.streak}sem`; myVal = m.streak; maxVal = Math.max(...sorted.map(x=>x.streak),1); }
                      const barPct = maxVal > 0 ? Math.min((myVal/maxVal)*100, 100) : 0;
                      const barColor = i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":isMe?"var(--accent)":"#475569";
                      return (
                        <div key={m.email} style={{ padding:"12px 14px", background: isChamp?"rgba(251,191,36,0.06)":isMe?"rgba(59,130,246,0.08)":"var(--input-bg)", border:`2px solid ${isChamp?"rgba(251,191,36,0.45)":isMe?"var(--accent)":"var(--border)"}`, borderRadius:12, marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
                            <div style={{ width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", fontSize: i<3?20:12, fontWeight:800, flexShrink:0 }}>
                              {i < 3 ? medals[i] : <span style={{ color:"var(--text-muted)" }}>#{i+1}</span>}
                            </div>
                            <div style={{ width:34, height:34, borderRadius:"50%", background: isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:"white", flexShrink:0 }}>
                              {m.name?.[0]?.toUpperCase()||"?"}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:13, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                {isChamp && "👑 "}{m.name}
                                {isMe && <span style={{ fontSize:10, background:"var(--accent)", color:"white", borderRadius:5, padding:"1px 6px" }}>TÚ</span>}
                              </div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
                                {m.sessions} ses · {m.volume}t · {m.prs} PRs · {m.streak}sem
                              </div>
                            </div>
                            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800, color: i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":isMe?"var(--accent)":"var(--text)", flexShrink:0 }}>{val}</div>
                          </div>
                          <div style={{ background:"var(--border)", borderRadius:4, height:4, overflow:"hidden" }}>
                            <div style={{ height:"100%", background:barColor, width:`${barPct}%`, borderRadius:4, transition:"width 0.6s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
    {confirmModal}
    </>
  );
}