import { useState, useEffect } from "react";
import { EXERCISE_DB } from "../exerciseDb";
import { getWeeklyChallenge } from "../utils/gymCalcs";
import { load } from "../utils/helpers";
import { teamsGet } from "../utils/firebaseService";

export const WEEKLY_CHALLENGES = [
  { id:"vol10", emoji:"🏋️", title:"10,000 kg de volumen", desc:"Levanta un total de 10,000 kg esta semana", check:(sessions, weekStart) => {
    return Math.round(sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
      const sets=ex.sets?.length>0?ex.sets:[{weight:ex.weight,reps:ex.reps}];
      return a+sets.reduce((sv,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sv,0);
    },0),0));
  }, target:10000, unit:"kg", format: v => `${v.toLocaleString()} / 10,000 kg` },
  { id:"ses5", emoji:"📅", title:"5 sesiones esta semana", desc:"Entrena 5 días distintos esta semana", check:(sessions, weekStart) =>
    sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).length,
    target:5, unit:"sesiones", format: v => `${v} / 5 sesiones` },
  { id:"mus4", emoji:"💪", title:"4 grupos musculares", desc:"Entrena al menos 4 grupos musculares distintos", check:(sessions, weekStart) => {
    const muscles = new Set();
    sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).forEach(s=>(s.exercises||[]).forEach(ex=>{
      const db=EXERCISE_DB.find(e=>e.name===ex.name); if(db) muscles.add(db.muscle);
    }));
    return muscles.size;
  }, target:4, unit:"grupos", format: v => `${v} / 4 grupos musculares` },
  { id:"sets30", emoji:"🔢", title:"30 series completadas", desc:"Completa un total de 30 series esta semana", check:(sessions, weekStart) =>
    sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>a+(ex.sets?.length||1),0),0),
    target:30, unit:"series", format: v => `${v} / 30 series` },
  { id:"streak3", emoji:"🔥", title:"3 días seguidos", desc:"Entrena 3 días consecutivos esta semana", check:(sessions, weekStart) => {
    const days = new Set(sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).map(s=>s.date));
    let best=0, cur=0;
    for(let i=0;i<7;i++){
      const d=new Date(weekStart); d.setDate(d.getDate()+i);
      const ds=d.toISOString().slice(0,10);
      if(days.has(ds)){cur++;best=Math.max(best,cur);}else cur=0;
    }
    return best;
  }, target:3, unit:"días", format: v => `${v} / 3 días seguidos` },
  { id:"pr2", emoji:"🏆", title:"2 récords personales", desc:"Supera 2 récords personales esta semana", check:(sessions, weekStart) => {
    const weekSess = sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart);
    const prSet = new Set();
    weekSess.forEach(s=>{
      const sTs = new Date(s.date+"T00:00:00").getTime();
      (s.exercises||[]).forEach(ex=>{
        const w=ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
        const prev=sessions
          .filter(ps => new Date(ps.date+"T00:00:00").getTime() < sTs)
          .flatMap(ps=>(ps.exercises||[]).filter(pe=>pe.name===ex.name))
          .reduce((b,pe)=>{
            const pw=pe.sets?.length>0?Math.max(...pe.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(pe.weight)||0;
            return Math.max(b,pw);
          },0);
        if(w>prev&&w>0) prSet.add(s.id+"__"+ex.name);
      });
    });
    return prSet.size;
  }, target:2, unit:"PRs", format: v => `${v} / 2 récords` },
];

const CHALLENGE_DONE_KEY = "gym_challenge_rewarded_week";

function getCurrentWeekKey() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  return d.toISOString().slice(0, 10);
}

export default function TeamChallengeModal({ user, sessions, onClose, onChallengeComplete }) {
  const [myTeams] = useState(() => load(`gym_teams_${user.email}`, []));
  const [activeTeam, setActiveTeam] = useState(myTeams[0] || null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState("volume");

  const weekStart = new Date(); weekStart.setHours(0,0,0,0);
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1));
  const weekSessions = sessions.filter(s => new Date(s.date+"T00:00:00") >= weekStart);
  const myWeekVol = Math.round(weekSessions.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
    const w=ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1);
    return a+w;
  },0),0)/1000*10)/10;
  const myWeekSessions = weekSessions.length;

  async function loadChallenge(t) {
    setLoading(true);
    try {
      const data = await teamsGet(`team_${t.code}`);
      setTeamData(data);
    } catch {}
    setLoading(false);
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (activeTeam) loadChallenge(activeTeam); }, [activeTeam]);

  // 🛡️ Detectar primera vez que el reto se completa esta semana
  useEffect(() => {
    if (!onChallengeComplete) return;
    const challenge = getWeeklyChallenge(WEEKLY_CHALLENGES);
    const ws = new Date(); ws.setHours(0,0,0,0);
    ws.setDate(ws.getDate() - (ws.getDay() === 0 ? 6 : ws.getDay() - 1));
    const progress = challenge.check(sessions, ws);
    const done = progress >= challenge.target;
    if (!done) return;
    const weekKey = getCurrentWeekKey();
    const alreadyRewarded = localStorage.getItem(CHALLENGE_DONE_KEY) === weekKey;
    if (!alreadyRewarded) {
      localStorage.setItem(CHALLENGE_DONE_KEY, weekKey);
      onChallengeComplete();
    }
  }, [sessions]);

  const members = teamData ? Object.values(teamData.members) : [];
  const ranked = [...members].sort((a,b) => metric==="volume" ? b.volume-a.volume : b.sessions-a.sessions);
  const myRank = ranked.findIndex(m=>m.email===user.email)+1;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{ maxHeight:"85vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">⚔️ Reto de equipo</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {myTeams.length === 0 ? (
          <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👥</div>
            <p style={{ fontSize:14 }}>Primero únete a un team desde <b>GymTeams</b> para ver los retos.</p>
          </div>
        ) : (
          <>
            {myTeams.length > 1 && (
              <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                {myTeams.map(t => (
                  <button key={t.code} className={`muscle-chip ${activeTeam?.code===t.code?"active":""}`} onClick={()=>setActiveTeam(t)}>{t.name}</button>
                ))}
              </div>
            )}

            {(() => {
              const challenge = getWeeklyChallenge(WEEKLY_CHALLENGES);
              const weekStart2 = new Date(); weekStart2.setHours(0,0,0,0);
              weekStart2.setDate(weekStart2.getDate() - (weekStart2.getDay() === 0 ? 6 : weekStart2.getDay() - 1));
              const progress = challenge.check(sessions, weekStart2);
              const pct = Math.min(progress / challenge.target * 100, 100);
              const done = progress >= challenge.target;
              return (
                <div style={{ background: done?"rgba(34,197,94,0.08)":"rgba(59,130,246,0.06)", border:`1px solid ${done?"rgba(34,197,94,0.3)":"rgba(59,130,246,0.2)"}`, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color: done?"#22c55e":"var(--accent)", textTransform:"uppercase", marginBottom:6 }}>
                    {done?"✅":"⚔️"} Reto de la semana
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{challenge.emoji} {challenge.title}</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{challenge.desc}</div>
                    </div>
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:900, color: done?"#22c55e":"var(--accent)", marginLeft:12, flexShrink:0 }}>{Math.round(pct)}%</div>
                  </div>
                  <div style={{ background:"var(--border)", borderRadius:20, height:7, overflow:"hidden" }}>
                    <div style={{ height:"100%", background: done?"#22c55e":"var(--accent)", width:`${pct}%`, borderRadius:20, transition:"width 0.6s ease" }}/>
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:5, textAlign:"right" }}>{challenge.format(progress)}</div>
                </div>
              );
            })()}

            <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:12, padding:"16px", marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>Tu semana actual</div>
              <div style={{ display:"flex", justifyContent:"center", gap:24 }}>
                <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900 }}>{myWeekSessions}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>sesiones</div></div>
                <div style={{ width:1, background:"var(--border)" }}/>
                <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900 }}>{myWeekVol}t</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>volumen</div></div>
                {myRank > 0 && <><div style={{ width:1, background:"var(--border)" }}/><div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900, color:"#f59e0b" }}>#{myRank}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>ranking</div></div></>}
              </div>
            </div>

            <div style={{ display:"flex", gap:8, marginBottom:14 }}>
              <button className={`muscle-chip ${metric==="volume"?"active":""}`} onClick={()=>setMetric("volume")}>🏋️ Volumen total</button>
              <button className={`muscle-chip ${metric==="sessions"?"active":""}`} onClick={()=>setMetric("sessions")}>📋 Sesiones</button>
            </div>

            {loading && <div style={{ textAlign:"center", color:"var(--text-muted)", padding:20 }}>Cargando...</div>}
            {!loading && ranked.map((m,i) => {
              const isMe = m.email===user.email;
              const val = metric==="volume" ? `${m.volume}t` : `${m.sessions} ses.`;
              const pct = ranked[0] ? (metric==="volume"?m.volume/ranked[0].volume:m.sessions/ranked[0].sessions)*100 : 0;
              return (
                <div key={m.email} style={{ padding:"12px 14px", background:isMe?"rgba(59,130,246,0.08)":"var(--input-bg)", border:`1px solid ${isMe?"rgba(59,130,246,0.35)":"var(--border)"}`, borderRadius:12, marginBottom:8 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
                    <span style={{ fontSize:i<3?24:14, fontWeight:800, width:32, textAlign:"center" }}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</span>
                    <div style={{ width:32, height:32, borderRadius:"50%", background:isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"white", flexShrink:0 }}>{m.name?.[0]?.toUpperCase()||"?"}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{m.name} {isMe&&<span style={{ fontSize:10, color:"var(--accent)" }}>(tú)</span>}</div>
                    </div>
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800, color:i===0?"#f59e0b":"var(--text)" }}>{val}</div>
                  </div>
                  <div style={{ background:"var(--border)", borderRadius:4, height:5, overflow:"hidden" }}>
                    <div style={{ height:"100%", background:i===0?"#f59e0b":i===1?"#94a3b8":isMe?"var(--accent)":"#64748b", width:`${pct}%`, transition:"width 0.6s ease", borderRadius:4 }} />
                  </div>
                </div>
              );
            })}
            <p style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", marginTop:10 }}>💡 El ranking usa los últimos datos sincronizados en GymTeams.</p>
          </>
        )}
      </div>
    </div>
  );
}