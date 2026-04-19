import { useState } from "react";

// ─── Sparkline ────────────────────────────────────────────────────────────────
export function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  const vals = data.map(d => parseFloat(d.weight) || 0);
  const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
  const W = 70, H = 24;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - ((v - min) / range) * (H - 4) - 2}`);
  const up = vals[vals.length - 1] >= vals[vals.length - 2];
  const color = up ? "#22c55e" : "#f87171";
  return (
    <svg width={W} height={H} style={{ display: "block", flexShrink: 0 }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => { const [x, y] = p.split(","); return <circle key={i} cx={x} cy={y} r={i === vals.length - 1 ? 3 : 1.5} fill={color} />; })}
    </svg>
  );
}

// ─── Training Calendar ────────────────────────────────────────────────────────
const REST_MSGS = [
  "Día de descanso 😴 El músculo crece cuando recuperas.",
  "Sin entreno — ¡el descanso también es parte del plan! 🛋️",
  "Día libre. Hidrátate y duerme bien. 💧",
  "Recovery day 💆 Tu cuerpo te lo agradece.",
  "Descanso activo: camina, estira, respira. 🌿",
  "Sin sesión registrada. ¡Mañana puede ser el día! 🔥",
  "Día de recarga. La constancia es una maratón, no un sprint. 🏃",
  "Off day — incluso los campeones descansan. 🏆",
];

export function TrainingCalendar({ sessions, joinedAt }) {
  const todayRef = new Date(); todayRef.setHours(0,0,0,0);
  const joinedDate = joinedAt ? (() => { const d = new Date(joinedAt+"T00:00:00"); d.setHours(0,0,0,0); return d; })() : null;
  const [viewYear, setViewYear] = useState(todayRef.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayRef.getMonth());
  const [selected, setSelected] = useState(null);

  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();
  const startOffset = (new Date(viewYear, viewMonth, 1).getDay()+6)%7;
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleString("es",{month:"long",year:"numeric"});
  const cells = [...Array(startOffset).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)];

  const sessionsByDate = {};
  sessions.forEach(s => { if (!sessionsByDate[s.date]) sessionsByDate[s.date]=[]; sessionsByDate[s.date].push(s); });

  const isCurrentMonth = viewYear===todayRef.getFullYear() && viewMonth===todayRef.getMonth();
  const todayDay = todayRef.getDate();

  function prevMonth() {
    if (viewMonth===0) { setViewYear(y=>y-1); setViewMonth(11); } else setViewMonth(m=>m-1);
    setSelected(null);
  }
  function nextMonth() {
    if (viewMonth===11) { setViewYear(y=>y+1); setViewMonth(0); } else setViewMonth(m=>m+1);
    setSelected(null);
  }

  function handleDay(day) {
    const ds = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
    const dayDate = new Date(viewYear, viewMonth, day); dayDate.setHours(0,0,0,0);
    const daySessions = sessionsByDate[ds] || [];
    const restMsg = REST_MSGS[Math.floor(Math.abs(day*(viewMonth+1)*viewYear) % REST_MSGS.length)];
    setSelected(sel => sel?.ds===ds ? null : { ds, sessions: daySessions, restMsg, dayDate });
  }

  const monthSessions = sessions.filter(s => s.date.startsWith(`${viewYear}-${String(viewMonth+1).padStart(2,"0")}`));

  return (
    <div className="card" style={{marginBottom:12, padding:0, overflow:"hidden"}}>
      {/* Calendar header banner */}
      <div style={{
        background:"#111",
        padding:"10px 14px",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        borderBottom:"1px solid var(--border)",
      }}>
        <div style={{
          display:"flex", alignItems:"center", gap:8,
          fontFamily:"Barlow Condensed, sans-serif",
          fontSize:13, fontWeight:900, letterSpacing:3,
          textTransform:"uppercase", color:"var(--accent)",
        }}>
          <span style={{fontSize:15}}>📅</span>
          CALENDARIO DE ENTRENOS
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--border)",color:"var(--text-muted)",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <span style={{fontSize:11,color:"var(--text-muted)",textTransform:"capitalize",minWidth:100,textAlign:"center"}}>{monthName}</span>
          <button onClick={nextMonth} style={{background:"none",border:"1px solid var(--border)",color:"var(--text-muted)",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
      </div>
      <div style={{padding:"12px 14px"}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:4}}>
        {["L","M","X","J","V","S","D"].map(d=><div key={d} style={{textAlign:"center",fontSize:9,fontWeight:700,color:"var(--text-muted)"}}>{d}</div>)}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
        {cells.map((day,i)=>{
          if (!day) return <div key={`e${i}`}/>;
          const ds = `${viewYear}-${String(viewMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const dayDate = new Date(viewYear, viewMonth, day); dayDate.setHours(0,0,0,0);
          const trained = !!sessionsByDate[ds];
          const isToday = isCurrentMonth && day===todayDay;
          const isFuture = dayDate > todayRef;
          const beforeJoin = joinedDate && dayDate < joinedDate;
          const isSelected = selected?.ds===ds;
          return (
            <div key={day} onClick={()=>handleDay(day)} style={{
              aspectRatio:"1",display:"flex",alignItems:"center",justifyContent:"center",
              borderRadius:6,fontSize:10,fontWeight:trained||isToday?800:400,cursor:"pointer",
              background:isSelected?"var(--accent)":trained?(isToday?"var(--accent)":"rgba(59,130,246,0.3)"):(isToday?"rgba(59,130,246,0.15)":"transparent"),
              border:isSelected?"1.5px solid var(--accent)":isToday?"1.5px solid var(--accent)":trained?"1px solid rgba(59,130,246,0.5)":"1px solid transparent",
              color:isSelected?"white":trained?(isToday?"white":"var(--accent)"):"var(--text)",
              opacity:isFuture?0.2:beforeJoin?0.25:1,
              position:"relative",transition:"transform 0.1s",transform:isSelected?"scale(1.15)":"scale(1)",
            }}>
              {trained&&!isToday&&!isSelected&&<span style={{position:"absolute",top:1,right:1,fontSize:6}}>🔥</span>}
              {day}
            </div>
          );
        })}
      </div>

      {selected && (
        <div style={{marginTop:12,background:"var(--surface)",borderRadius:10,padding:"10px 12px",border:"1px solid var(--border)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
            <span style={{fontSize:11,fontWeight:700,color:"var(--accent)"}}>
              {new Date(selected.ds+"T12:00:00").toLocaleDateString("es",{weekday:"long",day:"numeric",month:"long"})}
            </span>
            <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:"var(--text-muted)",cursor:"pointer",fontSize:13}}>✕</button>
          </div>
          {selected.dayDate > todayRef ? (
            <div style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>⏳ Todavía no ha llegado este día.</div>
          ) : joinedDate && selected.dayDate < joinedDate ? (
            <div style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>👣 Aún no te habías unido a GymTracker este día.</div>
          ) : selected.sessions.length > 0 ? (
            selected.sessions.map((s,si) => {
              const totalSets = (s.exercises||[]).reduce((a,e)=>a+(e.sets?.length||0),0);
              const vol = (s.exercises||[]).reduce((a,ex)=>a+(ex.sets||[]).reduce((b,st)=>b+(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1),0),0);
              return (
                <div key={si} style={{marginBottom:si<selected.sessions.length-1?8:0}}>
                  <div style={{fontWeight:700,fontSize:13,marginBottom:3}}>💪 {s.workout||"Entrenamiento"}</div>
                  <div style={{fontSize:11,color:"var(--text-muted)",marginBottom:4}}>{(s.exercises||[]).map(e=>e.name).join(" · ")}</div>
                  <div style={{display:"flex",gap:10,fontSize:11,flexWrap:"wrap"}}>
                    <span style={{color:"var(--accent)",fontWeight:700}}>{(s.exercises||[]).length} ejercicios</span>
                    <span style={{color:"var(--text-muted)"}}>{totalSets} series</span>
                    {vol>0&&<span style={{color:"var(--text-muted)"}}>{Math.round(vol).toLocaleString()} kg vol.</span>}
                    {s.durationSecs>0&&<span style={{color:"var(--text-muted)"}}>{Math.floor(s.durationSecs/60)}min</span>}
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{fontSize:12,color:"var(--text-muted)",fontStyle:"italic"}}>{selected.restMsg}</div>
          )}
        </div>
      )}

      <div style={{display:"flex",gap:12,marginTop:10,fontSize:10,color:"var(--text-muted)",alignItems:"center"}}>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:3,background:"rgba(59,130,246,0.3)",border:"1px solid rgba(59,130,246,0.5)",display:"inline-block"}}/>Entrenado</span>
        <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,borderRadius:3,background:"var(--accent)",display:"inline-block"}}/>Hoy</span>
        <span style={{marginLeft:"auto",fontWeight:700,color:"var(--accent)"}}>{monthSessions.length} este mes</span>
      </div>
      </div>
    </div>
  );
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────────
export function WeeklyChart({ sessions }) {
  const [period, setPeriod] = useState("week");
  const [metric, setMetric] = useState("count");

  function buildData() {
    if (period === "day") {
      return Array.from({length:14},(_,i)=>{
        const d = new Date(); d.setDate(d.getDate()-(13-i));
        const ds = d.toISOString().slice(0,10);
        const ss = sessions.filter(s=>s.date===ds);
        const vol = ss.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
          return a+(ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1));
        },0),0);
        return {label:d.getDate()+"/"+(d.getMonth()+1), count:ss.length, vol:Math.round(vol)};
      });
    }
    if (period === "week") {
      return Array.from({length:8},(_,i)=>{
        const start=new Date(); start.setDate(start.getDate()-(7-i)*7); start.setHours(0,0,0,0);
        const end=new Date(start); end.setDate(end.getDate()+7);
        const ss=sessions.filter(s=>{const d=new Date(s.date+"T00:00:00");return d>=start&&d<end;});
        const vol=ss.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
          return a+(ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1));
        },0),0);
        return {label:i===7?"Esta":`S-${7-i}`, count:ss.length, vol:Math.round(vol)};
      });
    }
    if (period === "month") {
      return Array.from({length:12},(_,i)=>{
        const d=new Date(); d.setMonth(d.getMonth()-(11-i));
        const y=d.getFullYear(),m=d.getMonth();
        const ss=sessions.filter(s=>{const sd=new Date(s.date+"T00:00:00");return sd.getFullYear()===y&&sd.getMonth()===m;});
        const vol=ss.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
          return a+(ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1));
        },0),0);
        const months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        return {label:months[m], count:ss.length, vol:Math.round(vol)};
      });
    }
    return Array.from({length:4},(_,i)=>{
      const y=new Date().getFullYear()-(3-i);
      const ss=sessions.filter(s=>s.date.startsWith(y));
      const vol=ss.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
        return a+(ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1));
      },0),0);
      return {label:String(y), count:ss.length, vol:Math.round(vol)};
    });
  }

  const data = buildData();
  const vals = data.map(d=>metric==="count"?d.count:d.vol);
  const maxVal = Math.max(...vals,1);
  const total = vals.reduce((a,b)=>a+b,0);
  const avg = data.length > 0 ? (total / data.length).toFixed(metric==="vol"?1:1) : 0;

  return (
    <div className="card">
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div className="card-label" style={{margin:0}}>📈 Progreso</div>
          <div style={{display:"flex",gap:4}}>
            {[["count","Sesiones"],["vol","Volumen"]].map(([v,l])=>(
              <button key={v} onClick={()=>setMetric(v)} style={{padding:"3px 10px",fontSize:11,borderRadius:20,border:"1px solid",borderColor:metric===v?"var(--accent)":"var(--border)",background:metric===v?"var(--accent)":"transparent",color:metric===v?"#000":"var(--text-muted)",cursor:"pointer",fontWeight:700,transition:"all 0.2s"}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
          {[["day","Día"],["week","Semana"],["month","Mes"],["year","Año"]].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)} style={{flex:1,padding:"5px 4px",fontSize:11,borderRadius:8,border:"1px solid",borderColor:period===v?"var(--accent)":"var(--border)",background:period===v?"var(--accent)":"transparent",color:period===v?"#000":"var(--text-muted)",cursor:"pointer",fontWeight:period===v?800:500,transition:"all 0.2s"}}>{l}</button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",gap:12,marginBottom:14}}>
        <div style={{flex:1,background:"var(--input-bg)",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Total</div>
          <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:20,fontWeight:800,color:"var(--accent)"}}>{metric==="vol"?`${(total/1000).toFixed(1)}t`:total}</div>
        </div>
        <div style={{flex:1,background:"var(--input-bg)",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Promedio</div>
          <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:20,fontWeight:800,color:"var(--text)"}}>{metric==="vol"?`${(Number(avg)/1000).toFixed(1)}t`:Number(avg).toFixed(1)}</div>
        </div>
        <div style={{flex:1,background:"var(--input-bg)",borderRadius:10,padding:"8px 12px",textAlign:"center"}}>
          <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:700,letterSpacing:1,textTransform:"uppercase",marginBottom:2}}>Mejor</div>
          <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:20,fontWeight:800,color:"#22c55e"}}>{metric==="vol"?`${(maxVal/1000).toFixed(1)}t`:maxVal}</div>
        </div>
      </div>

      <div style={{width:"100%"}}>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${data.length},1fr)`,gap:3,alignItems:"flex-end",height:100,marginBottom:4}}>
          {data.map((d,i)=>{
            const val=metric==="count"?d.count:d.vol;
            const pct=maxVal>0?(val/maxVal):0;
            const barH=Math.max(pct*92, val>0?6:2);
            const isLast=i===data.length-1;
            const isEmpty=val===0;
            return (
              <div key={i} title={`${d.label}: ${metric==="vol"?(val/1000).toFixed(1)+"t":val+" ses"}`}
                style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:2,cursor:"default"}}>
                <div style={{fontSize:8,color:isEmpty?"transparent":isLast?"var(--accent)":"var(--text-muted)",fontWeight:700,lineHeight:1}}>
                  {metric==="vol"?`${(val/1000).toFixed(1)}t`:val}
                </div>
                <div style={{
                  width:"100%",height:barH,
                  background:isEmpty?"var(--border)":isLast?"var(--accent)":"rgba(59,130,246,0.45)",
                  borderRadius:"4px 4px 0 0",
                  transition:"height 0.5s ease",
                  boxShadow:isLast&&!isEmpty?"0 0 8px var(--accent)40":undefined
                }}/>
              </div>
            );
          })}
        </div>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${data.length},1fr)`,gap:3,borderTop:"1px solid var(--border)",paddingTop:4}}>
          {data.map((d,i)=>{
            const isLast=i===data.length-1;
            return (
              <div key={i} style={{fontSize:8,color:isLast?"var(--accent)":"var(--text-muted)",fontWeight:isLast?700:400,textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                {d.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}