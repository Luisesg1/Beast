import { EXERCISE_DB } from "../exerciseDb";
import { calc1RM, getPRs } from "./utils";

// ─── Progression Suggestion ───────────────────────────────────────────────────
export function getProgressionSuggestion(exName, sessions) {
  if (!exName || exName === "__custom__") return null;
  const history = sessions
    .flatMap(s => (s.exercises||[]).filter(e=>e.name===exName).map(e=>({date:s.date,...e})))
    .sort((a,b)=>b.date.localeCompare(a.date));
  if (history.length === 0) return null;
  const last = history[0];
  const lastWeight = parseFloat(last.sets?.length ? Math.max(...last.sets.map(st=>parseFloat(st.weight)||0)) : last.weight)||0;
  const lastReps   = parseFloat(last.sets?.length ? Math.max(...last.sets.map(st=>parseFloat(st.reps)||0)) : last.reps)||0;
  const lastSeries = last.sets?.length||3;
  const targetReps = 12;
  if (!lastWeight||!lastReps) return null;
  let sugWeight=lastWeight, sugReps=lastReps, reason="", type="maintain";
  if (history.length >= 2) {
    const prev=history[1];
    const prevWeight=parseFloat(prev.sets?.length?Math.max(...prev.sets.map(st=>parseFloat(st.weight)||0)):prev.weight)||0;
    const prevReps  =parseFloat(prev.sets?.length?Math.max(...prev.sets.map(st=>parseFloat(st.reps)||0)):prev.reps)||0;
    if (history.length>=3) {
      const third=history[2];
      const thirdWeight=parseFloat(third.sets?.length?Math.max(...third.sets.map(st=>parseFloat(st.weight)||0)):third.weight)||0;
      if (lastWeight<prevWeight && prevWeight<thirdWeight) {
        sugWeight=prevWeight; sugReps=Math.max(lastReps-1,6);
        reason="Rendimiento bajando — prueba un peso intermedio"; type="deload";
      }
    }
    if (type!=="deload") {
      if (lastReps>=targetReps) {
        const inc=lastWeight>=60?5:lastWeight>=30?2.5:1.25;
        sugWeight=lastWeight+inc; sugReps=Math.max(lastReps-4,6);
        reason=`Llegaste a ${lastReps} reps — hora de subir peso`; type="up_weight";
      } else if (lastWeight>prevWeight||lastReps>prevReps) {
        sugWeight=lastWeight; sugReps=Math.min(lastReps+1,targetReps);
        reason="Buen progreso — sube 1 rep más"; type="up_reps";
      } else {
        sugWeight=lastWeight; sugReps=Math.min(lastReps+1,targetReps);
        reason="Estancado — intenta 1 rep extra"; type="up_reps";
      }
    }
  } else {
    sugReps=lastReps<targetReps?lastReps+1:lastReps;
    reason="Basado en tu último registro"; type="up_reps";
  }
  const colors={up_weight:"#22c55e",up_reps:"#3b82f6",maintain:"#a855f7",deload:"#f97316"};
  const icons ={up_weight:"⬆️",up_reps:"🔁",maintain:"✅",deload:"⚠️"};
  return {sugWeight,sugReps,lastSeries,reason,type,color:colors[type],icon:icons[type]};
}

// ─── Insights Engine ──────────────────────────────────────────────────────────
export function generateInsights(sessions, bodyStats) {
  const insights = [];
  if (sessions.length < 3) return insights;
  const now = new Date();
  const daysSince = d => Math.round((now - new Date(d+"T00:00:00"))/86400000);
  const volByMuscle = (d1,d2) => {
    const out={};
    sessions.filter(s=>{const d=daysSince(s.date);return d>=d1&&d<d2;})
      .forEach(s=>(s.exercises||[]).forEach(ex=>{
        const m=EXERCISE_DB.find(e=>e.name===ex.name)?.muscle||"Otro";
        const vol=(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1);
        out[m]=(out[m]||0)+vol;
      }));
    return out;
  };
  const recent=volByMuscle(0,14), prev=volByMuscle(14,28);
  const lastByMuscle={};
  sessions.forEach(s=>(s.exercises||[]).forEach(ex=>{
    const m=EXERCISE_DB.find(e=>e.name===ex.name)?.muscle||"Otro";
    if(!lastByMuscle[m]||s.date>lastByMuscle[m]) lastByMuscle[m]=s.date;
  }));
  Object.entries(lastByMuscle).forEach(([muscle,date])=>{
    const d=daysSince(date);
    if(d>=10) insights.push({id:`neglect_${muscle}`,category:"frecuencia",icon:"😴",color:"#f97316",
      title:`${muscle} sin entrenar`,msg:`Llevas ${d} días sin trabajar ${muscle}.`,priority:d>=14?3:2});
  });
  Object.entries(prev).forEach(([muscle,prevVol])=>{
    const recVol=recent[muscle]||0;
    const drop=((prevVol-recVol)/prevVol)*100;
    if(drop>30&&prevVol>0) insights.push({id:`vol_drop_${muscle}`,category:"volumen",icon:"📉",color:"#ef4444",
      title:`Volumen de ${muscle} bajó`,msg:`Cayó un ${Math.round(drop)}% vs las 2 semanas anteriores.`,priority:2});
  });
  Object.entries(recent).forEach(([muscle,recVol])=>{
    const prevVol=prev[muscle]||0;
    if(prevVol>0){const rise=((recVol-prevVol)/prevVol)*100;
      if(rise>20) insights.push({id:`vol_rise_${muscle}`,category:"volumen",icon:"📈",color:"#22c55e",
        title:`${muscle} en racha`,msg:`Volumen subió ${Math.round(rise)}% esta quincena.`,priority:1});}
  });
  const recentSessions=sessions.filter(s=>daysSince(s.date)<=14).length;
  if(recentSessions<=2&&sessions.length>=5) insights.push({id:"low_freq",category:"hábitos",icon:"⚠️",color:"#f59e0b",
    title:"Frecuencia baja",msg:`Solo ${recentSessions} sesión${recentSessions===1?"":"es"} en 14 días.`,priority:3});
  const byDay=[0,0,0,0,0,0,0];
  sessions.forEach(s=>{byDay[new Date(s.date+"T00:00:00").getDay()]++;});
  const bestDayIdx=byDay.indexOf(Math.max(...byDay));
  const DIAS=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  if(Math.max(...byDay)>=3) insights.push({id:"best_day",category:"hábitos",icon:"📅",color:"#3b82f6",
    title:"Tu mejor día",msg:`El ${DIAS[bestDayIdx]} es cuando más entrenas.`,priority:1});
  const prs=getPRs(sessions);
  const recentPRs=sessions.filter(s=>daysSince(s.date)<=7)
    .flatMap(s=>(s.exercises||[]).filter(ex=>{
      const rm=calc1RM(ex.sets?.length?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0,
        ex.sets?.length?Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)):parseFloat(ex.reps)||0);
      return prs[ex.name]&&rm>=prs[ex.name].rm;
    }));
  if(recentPRs.length>0) insights.push({id:"recent_pr",category:"rendimiento",icon:"🏆",color:"#a855f7",
    title:`${recentPRs.length} PR${recentPRs.length>1?"s":""}  esta semana`,
    msg:`Récord en: ${recentPRs.slice(0,3).map(e=>e.name).join(", ")}.`,priority:1});
  const entries=bodyStats?.entries||[];
  if(entries.length>=3){
    const diff=(entries[entries.length-1].weight-entries[entries.length-3].weight).toFixed(1);
    if(Math.abs(diff)>=0.5) insights.push({id:"weight_trend",category:"cuerpo",
      icon:parseFloat(diff)<0?"⬇️":"⬆️",color:parseFloat(diff)<0?"#22c55e":"#f97316",
      title:parseFloat(diff)<0?"Bajando de peso":"Subiendo de peso",
      msg:`${parseFloat(diff)<0?"Perdiste":"Ganaste"} ${Math.abs(diff)} kg en los últimos registros.`,priority:1});
  }
  return insights.sort((a,b)=>b.priority-a.priority);
}

// ─── InsightsModal ─────────────────────────────────────────────────────────────
function InsightsModal({ sessions, bodyStats, onClose }) {
  const insights = generateInsights(sessions, bodyStats);
  const categories = ["rendimiento","volumen","frecuencia","hábitos","cuerpo"];
  const catLabels = {rendimiento:"🏋️ Rendimiento",volumen:"📊 Volumen",frecuencia:"🔁 Frecuencia",hábitos:"📅 Hábitos",cuerpo:"⚖️ Cuerpo"};
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">💡 Insights Premium</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {insights.length === 0 ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:"var(--text-muted)" }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
            <p style={{ fontSize:14 }}>Registra al menos 5 sesiones para ver tus insights.</p>
          </div>
        ) : (
          <div>
            {categories.map(cat=>{
              const items=insights.filter(i=>i.category===cat);
              if(!items.length) return null;
              return (
                <div key={cat} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>{catLabels[cat]}</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {items.map(ins=>(
                      <div key={ins.id} style={{ display:"flex", gap:12, alignItems:"flex-start", background:`${ins.color}0d`, border:`1px solid ${ins.color}30`, borderRadius:12, padding:"12px 14px" }}>
                        <div style={{ fontSize:22, flexShrink:0 }}>{ins.icon}</div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:700, color:ins.color, marginBottom:3 }}>{ins.title}</div>
                          <div style={{ fontSize:13, color:"var(--text)", lineHeight:1.5 }}>{ins.msg}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default InsightsModal;