import { useState } from "react";

export default function WeeklyGoalModal({ goal, onSave, onClose, sessions }) {
  const [target, setTarget] = useState(goal?.target || 4);
const lunes = new Date(); lunes.setHours(0,0,0,0); lunes.setDate(lunes.getDate() - (lunes.getDay() === 0 ? 6 : lunes.getDay() - 1));
const thisWeek = new Set(sessions.filter(s => new Date(s.date+"T00:00:00") >= lunes).map(s => s.date)).size;
  const pct = Math.min(thisWeek / target, 1);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🎯 Meta semanal</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:48, fontWeight:800, fontFamily:"Barlow Condensed, sans-serif", color: pct>=1?"#22c55e":"var(--accent)" }}>
            {thisWeek}<span style={{ fontSize:24, color:"var(--text-muted)" }}>/{target}</span>
          </div>
          <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:12 }}>sesiones esta semana</div>
          <div style={{ background:"var(--border)", borderRadius:20, height:10, overflow:"hidden", marginBottom:8 }}>
            <div style={{ height:"100%", background: pct>=1?"#22c55e":"var(--accent)", width:`${pct*100}%`, borderRadius:20, transition:"width 0.5s ease" }} />
          </div>
          {pct>=1 && <div style={{ color:"#22c55e", fontWeight:700, fontSize:14 }}>🎉 ¡Meta cumplida!</div>}
        </div>
        <div className="field" style={{ marginBottom:20 }}>
          <label className="field-label">Sesiones por semana (meta)</label>
          <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
            {[2,3,4,5,6,7].map(n => (
              <button key={n} className={`muscle-chip ${target===n?"active":""}`} onClick={() => setTarget(n)} style={{ width:40, justifyContent:"center" }}>{n}</button>
            ))}
          </div>
        </div>
        <button className="btn-primary" style={{ width:"100%" }} onClick={() => { onSave({ target }); onClose(); }}>
          💾 Guardar meta
        </button>
      </div>
    </div>
  );
}