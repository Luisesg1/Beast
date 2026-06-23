import { useState } from "react";
import { EXERCISE_DB } from "../exerciseDb";
import { calc1RM } from "../utils/gymCalcs";
import { fmtDate } from "../utils/helpers";

export function ProgressPrediction({ sessions }) {
  const [selected, setSelected] = useState("");
  const [view, setView] = useState("rm1"); // rm1 | weight | reps | volume

  const exMap = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
    const weight = Math.max(...sets.map(st => parseFloat(st.weight)||0));
    const reps   = Math.max(...sets.map(st => parseFloat(st.reps)||0));
    const vol    = sets.reduce((a,st) => a + (parseFloat(st.weight)||0)*(parseFloat(st.reps)||1), 0);
    const rm     = calc1RM(weight, reps);
    if (!exMap[ex.name]) exMap[ex.name] = [];
    if (rm > 0 || weight > 0) exMap[ex.name].push({ date: s.date, weight, reps, vol: Math.round(vol), rm: Math.round(rm) });
  }));

  const validExercises = Object.entries(exMap)
    .filter(([,v]) => v.length >= 2)
    .map(([k]) => k)
    .sort();

  const ex = selected || validExercises[0] || "";
  const history = ex
    ? (exMap[ex] || []).sort((a,b) => a.date.localeCompare(b.date))
    : [];

  const viewLabels = { rm1:"1RM", weight:"Peso", reps:"Reps", volume:"Vol." };
  const viewColors = { rm1:"#f59e0b", weight:"var(--accent)", reps:"#22c55e", volume:"#a855f7" };
  const vals = history.map(h => view==="rm1"?h.rm : view==="reps"?h.reps : view==="volume"?h.vol : h.weight);

  const prEntry  = history.length > 0 ? history.reduce((b,h) => h.rm > b.rm ? h : b, history[0]) : null;
  const last     = history[history.length - 1];
  const first    = history[0];
  const improved = last && first && last.rm > first.rm;
  const pct      = first?.rm > 0 ? Math.round((last.rm - first.rm) / first.rm * 100) : 0;

  let trend = null;
  if (vals.length >= 3) {
    const n = vals.length;
    const xs = vals.map((_,i)=>i), ys = vals;
    const sx=xs.reduce((a,b)=>a+b,0), sy=ys.reduce((a,b)=>a+b,0);
    const sxy=xs.reduce((s,x,i)=>s+x*ys[i],0), sx2=xs.reduce((s,x)=>s+x*x,0);
    const slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
    trend = slope > 0.3 ? { label:"📈 Subiendo", color:"#22c55e" }
          : slope < -0.3 ? { label:"📉 Bajando",  color:"#f87171" }
          : { label:"➡️ Estable", color:"var(--text-muted)" };
  }

  const W=400, H=110, padL=34, padR=12, padT=10, padB=24;
  const minV = vals.length ? Math.min(...vals) : 0;
  const maxV = vals.length ? Math.max(...vals, minV+1) : 1;
  const rangeV = maxV - minV || 1;
  const px = i => padL + (i / Math.max(history.length-1,1)) * (W - padL - padR);
  const py = v  => padT + (1 - (v - minV) / rangeV) * (H - padT - padB);
  const color = viewColors[view];
  const points = history.map((_,i) => `${px(i)},${py(vals[i])}`).join(" ");

  if (validExercises.length === 0) return (
    <div className="card">
      <div className="card-label">📊 Progreso por ejercicio</div>
      <div style={{ textAlign:"center", padding:"24px 0", color:"var(--text-muted)" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>📈</div>
        <p style={{ fontSize:13 }}>Registra al menos 2 sesiones con el mismo ejercicio para ver tu progreso.</p>
      </div>
    </div>
  );

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div className="card-label" style={{ margin:0 }}>📊 Progreso por ejercicio</div>
        <select className="input" style={{ width:"auto", fontSize:12, padding:"5px 10px" }}
          value={ex} onChange={e => setSelected(e.target.value)}>
          {validExercises.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      <div style={{ display:"flex", gap:5, marginBottom:12 }}>
        {Object.entries(viewLabels).map(([k,l]) => (
          <button key={k} onClick={() => setView(k)} style={{
            flex:1, padding:"5px 0", borderRadius:8, border:`1px solid ${view===k?viewColors[k]:"var(--border)"}`,
            background: view===k?`${viewColors[k]}18`:"transparent",
            color: view===k?viewColors[k]:"var(--text-muted)",
            fontSize:11, fontWeight:700, cursor:"pointer", transition:"all 0.15s"
          }}>{l}</button>
        ))}
      </div>

      {history.length >= 2 ? (
        <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"8px 4px 2px", marginBottom:12 }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
            {[0, 0.5, 1].map(t => {
              const y = py(minV + t * rangeV);
              return <g key={t}>
                <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3"/>
                <text x={padL-4} y={y+3} textAnchor="end" fill="var(--text-muted)" fontSize={8}>{Math.round(minV+t*rangeV)}</text>
              </g>;
            })}
            <polygon
              points={`${px(0)},${py(minV)} ${points} ${px(history.length-1)},${py(minV)}`}
              fill={color} fillOpacity={0.08}
            />
            <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            {history.map((h,i) => {
              const x=px(i), y=py(vals[i]);
              const isPR  = h === prEntry && view === "rm1";
              const isLast = i === history.length-1;
              const dc = isPR ? "#f59e0b" : isLast ? "#22c55e" : color;
              const showLabel = isPR || isLast || history.length <= 6;
              return <g key={i}>
                <circle cx={x} cy={y} r={isPR||isLast?5:3} fill={dc} stroke="var(--card)" strokeWidth={1.5}/>
                {showLabel && <text x={x} y={y-8} textAnchor="middle" fill={dc} fontSize={8} fontWeight={800}>{vals[i]}</text>}
                {isPR && <text x={x} y={y-17} textAnchor="middle" fill="#f59e0b" fontSize={7} fontWeight={800}>PR</text>}
                {(i===0 || i===history.length-1 || i%3===0) && (
                  <text x={x} y={H-4} textAnchor="middle" fill="var(--text-muted)" fontSize={7}>{fmtDate(h.date)}</text>
                )}
              </g>;
            })}
          </svg>
        </div>
      ) : (
        <div style={{ textAlign:"center", padding:"16px 0", color:"var(--text-muted)", fontSize:12 }}>
          Agrega más sesiones para ver la gráfica
        </div>
      )}

      {history.length >= 2 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:10 }}>
          {[
            { label:"1RM actual",  val:`${last?.rm}kg`,   color:"var(--accent)" },
            { label:"Mejor 1RM",   val:`${prEntry?.rm}kg`, color:"#f59e0b" },
            { label:"Registros",   val:history.length,    color:"var(--text)" },
            { label:"Mejora total",val:`${pct>0?"+":""}${pct}%`, color:improved?"#22c55e":"#f87171" },
          ].map(s => (
            <div key={s.label} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
              <div style={{ fontFamily:"Inter, sans-serif", fontSize:16, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:9, color:"var(--text-muted)", marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {trend && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11 }}>
          <span style={{ color:trend.color, fontWeight:700 }}>{trend.label}</span>
          {prEntry && <span style={{ color:"var(--text-muted)" }}>🏆 PR el {fmtDate(prEntry.date)}</span>}
        </div>
      )}
    </div>
  );
}

export function MuscleBalance({ sessions }) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const counts = {};
  sessions.filter(s => new Date(s.date+"T00:00:00") >= cutoff).forEach(s =>
    (s.exercises||[]).forEach(ex => {
      const db = EXERCISE_DB.find(e => e.name === ex.name);
      if (db) counts[db.muscle] = (counts[db.muscle]||0) + 1;
    })
  );

  const groups = {
    "Empuje 🔵": ["Pecho","Hombros","Tríceps"],
    "Tirón 🟢":  ["Espalda","Bíceps"],
    "Piernas 🔴":["Cuádriceps","Femoral","Glúteos","Pantorrillas"],
    "Core 🟡":   ["Core"],
  };

  const groupTotals = Object.entries(groups).map(([gname, muscles]) => ({
    name: gname,
    total: muscles.reduce((s,m)=>s+(counts[m]||0),0),
    muscles: muscles.map(m=>({ name:m, count:counts[m]||0 })).filter(m=>m.count>0),
  }));

  const maxTotal = Math.max(...groupTotals.map(g=>g.total), 1);
  const totalAll = groupTotals.reduce((s,g)=>s+g.total,0);

  const push = groupTotals.find(g=>g.name.startsWith("Empuje"))?.total||0;
  const pull = groupTotals.find(g=>g.name.startsWith("Tirón"))?.total||0;
  const legs = groupTotals.find(g=>g.name.startsWith("Piernas"))?.total||0;
  const warnings = [];
  if (push > 0 && pull > 0 && push / pull > 1.8) warnings.push("⚠️ Entrenas mucho más empuje que tirón. Riesgo de lesión de hombros.");
  if (pull > 0 && push > 0 && pull / push > 2) warnings.push("⚠️ Mucho más tirón que empuje. Considera balancear.");
  if (totalAll > 0 && legs / totalAll < 0.15) warnings.push("🦵 Estás descuidando las piernas. El equilibrio muscular es clave.");
  if (totalAll === 0) warnings.push("Sin datos este mes.");

  const colors = { "Empuje 🔵":"#3b82f6","Tirón 🟢":"#22c55e","Piernas 🔴":"#ef4444","Core 🟡":"#f59e0b" };

  return (
    <div className="card">
      <div className="card-label">⚖️ Balance muscular (últimos 30 días)</div>
      {totalAll === 0 ? (
        <p style={{ fontSize:13, color:"var(--text-muted)", textAlign:"center" }}>Sin sesiones este mes.</p>
      ) : (
        <>
          <div style={{ display:"flex", height:14, borderRadius:8, overflow:"hidden", marginBottom:16, gap:2 }}>
            {groupTotals.filter(g=>g.total>0).map(g => (
              <div key={g.name} style={{ flex:g.total, background:colors[g.name], transition:"flex 0.5s" }} title={`${g.name}: ${g.total}`} />
            ))}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10, marginBottom:16 }}>
            {groupTotals.map(g => (
              <div key={g.name} style={{ flex:"1 1 140px", background:"var(--input-bg)", border:`1px solid ${colors[g.name]}33`, borderRadius:10, padding:"10px 12px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:13, fontWeight:700 }}>{g.name}</span>
                  <span style={{ fontFamily:"Inter, sans-serif", fontSize:18, fontWeight:800, color:colors[g.name] }}>{g.total}</span>
                </div>
                <div style={{ background:"var(--border)", borderRadius:4, height:5, overflow:"hidden" }}>
                  <div style={{ height:"100%", background:colors[g.name], width:`${(g.total/maxTotal)*100}%`, transition:"width 0.5s" }} />
                </div>
                {g.muscles.length>0 && <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:5 }}>{g.muscles.map(m=>`${m.name}(${m.count})`).join(" · ")}</div>}
              </div>
            ))}
          </div>
          {warnings.map((w,i) => (
            <div key={i} style={{ background:"rgba(245,158,11,0.07)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:8, padding:"9px 12px", fontSize:12, color:"#fbbf24", marginBottom:6 }}>{w}</div>
          ))}
        </>
      )}
    </div>
  );
}