import { useState } from "react";
import { calc1RM } from "../utils/gymCalcs";
import { fmtDate } from "../utils/helpers";

function ExerciseSessionsTab({ exName, sessions }) {
  const [filterPeriod, setFilterPeriod] = useState("all");
  const periodDays = { "1m": 30, "3m": 90, "6m": 180, "1y": 365, all: 99999 };
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - (periodDays[filterPeriod] || 99999));

  const sessionsWithEx = sessions
    .filter(s => (s.exercises||[]).some(ex => ex.name.toLowerCase() === exName.toLowerCase()))
    .filter(s => new Date(s.date+"T00:00:00") >= cutoff)
    .sort((a,b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
        {[["1m","1 mes"],["3m","3 meses"],["6m","6 meses"],["1y","1 año"],["all","Todo"]].map(([k,l]) => (
          <button key={k} onClick={() => setFilterPeriod(k)} style={{
            padding:"5px 12px", borderRadius:20, fontSize:12, fontWeight:700, cursor:"pointer",
            border:`1px solid ${filterPeriod===k?"var(--accent)":"var(--border)"}`,
            background: filterPeriod===k?"var(--accent-dim)":"transparent",
            color: filterPeriod===k?"var(--accent)":"var(--text-muted)",
          }}>{l}</button>
        ))}
        <span style={{ marginLeft:"auto", fontSize:12, color:"var(--text-muted)", alignSelf:"center" }}>
          {sessionsWithEx.length} sesión{sessionsWithEx.length!==1?"es":""}
        </span>
      </div>
      {sessionsWithEx.length === 0 ? (
        <p className="text-muted">Sin sesiones en este período.</p>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {sessionsWithEx.map(s => {
            const ex = (s.exercises||[]).find(e => e.name.toLowerCase() === exName.toLowerCase());
            if (!ex) return null;
            const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
            const maxW = Math.max(...sets.map(st => parseFloat(st.weight)||0));
            const totalVol = Math.round(sets.reduce((a,st) => a+(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1), 0));
            const rm = calc1RM(maxW, Math.max(...sets.map(st=>parseFloat(st.reps)||0)));
            const [y,m,d] = s.date.split("-");
            const dow = new Date(+y,+m-1,+d).getDay();
            const dayName = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"][dow];
            return (
              <div key={s.id} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid var(--border)" }}>
                  <div>
                    <span style={{ fontSize:12, color:"var(--text-muted)" }}>{dayName} {d}/{m}/{y}</span>
                    <span style={{ fontSize:13, fontWeight:700, marginLeft:10 }}>{s.workout}</span>
                  </div>
                  <div style={{ display:"flex", gap:8, fontSize:12 }}>
                    <span style={{ color:"var(--accent)", fontWeight:700 }}>1RM ~{rm}kg</span>
                    <span style={{ color:"var(--text-muted)" }}>{totalVol}kg vol</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, padding:"10px 14px", flexWrap:"wrap" }}>
                  {sets.map((st, i) => {
                    const w = parseFloat(st.weight)||0;
                    const r = parseFloat(st.reps)||0;
                    const isTop = w === maxW;
                    return (
                      <div key={st.id||i} style={{
                        padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:700,
                        background: isTop?"rgba(59,130,246,0.12)":"var(--card)",
                        border:`1px solid ${isTop?"rgba(59,130,246,0.4)":"var(--border)"}`,
                        color: isTop?"var(--accent)":"var(--text)",
                      }}>
                        S{i+1}: {w||"—"}kg × {r||"—"}
                        {isTop && <span style={{ fontSize:9, marginLeft:4, opacity:0.7 }}>▲</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ProgressModal({ exName, sessions, onClose, onBack }) {
  const [tab, setTab] = useState("progress");
  const [view, setView] = useState("weight");

  const history = [];
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    if (ex.name.toLowerCase() === exName.toLowerCase()) {
      const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
      const weight = Math.max(...sets.map(st => parseFloat(st.weight) || 0));
      const reps = Math.max(...sets.map(st => parseFloat(st.reps) || 0));
      const vol = sets.reduce((s,st) => s + (parseFloat(st.weight)||0)*(parseFloat(st.reps)||1), 0);
      const rm = calc1RM(weight, reps);
      const rpeVals = sets.map(st => parseFloat(st.rpe)).filter(v => !isNaN(v) && v > 0);
      const avgRpe = rpeVals.length > 0
        ? Math.round((rpeVals.reduce((a,b) => a+b, 0) / rpeVals.length) * 10) / 10
        : null;
      history.push({ date: s.date, weight, reps, vol: Math.round(vol), rm, avgRpe });
    }
  }));
  history.sort((a, b) => a.date.localeCompare(b.date));

  const prEntry = history.length > 0 ? history.reduce((best,h) => h.rm > best.rm ? h : best, history[0]) : null;
  const W = 420, H = 140;
  const vals = history.map(h => view==="rm1"?h.rm : view==="reps"?h.reps : view==="volume"?h.vol : h.weight);
  const minV = Math.min(...vals), maxV = Math.max(...vals, minV+1), rangeV = maxV - minV || 1;
  const px = (i) => 40 + (i / Math.max(history.length-1,1)) * (W - 50);
  const py = (v) => H - ((v - minV) / rangeV) * (H - 20) - 4;
  const viewLabels = { weight:"💪 Peso (kg)", rm1:"🏆 1RM estimado", reps:"🔄 Reps", volume:"📦 Volumen (kg)" };

  const trend = history.length >= 3 ? (() => {
    const n = history.length, v = vals;
    const xs = v.map((_,i)=>i), ys = v;
    const sx=xs.reduce((a,b)=>a+b,0), sy=ys.reduce((a,b)=>a+b,0);
    const sxy=xs.reduce((s,x,i)=>s+x*ys[i],0), sx2=xs.reduce((s,x)=>s+x*x,0);
    const slope=(n*sxy-sx*sy)/(n*sx2-sx*sx);
    return slope > 0.2 ? "📈 Tendencia positiva" : slope < -0.2 ? "📉 Tendencia a la baja" : "➡️ Estable";
  })() : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          {onBack && <button className="btn-ghost small" onClick={onBack} style={{ marginRight:8 }}>← Volver</button>}
          <h3 className="modal-title">📈 {exName}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div style={{ display:"flex", gap:0, marginBottom:16, background:"var(--input-bg)", borderRadius:10, padding:3 }}>
          {[["progress","📈 Progreso"],["sesiones","📋 Sesiones"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: tab===k?"var(--accent)":"transparent", color: tab===k?"#000":"var(--text-muted)", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>{l}</button>
          ))}
        </div>

        {tab === "sesiones" && <ExerciseSessionsTab exName={exName} sessions={sessions} />}

        {tab !== "sesiones" && history.length < 2 && (
          <p className="text-muted" style={{ fontSize:14 }}>Necesitas al menos 2 registros para ver el progreso.</p>
        )}

        {tab !== "sesiones" && history.length >= 2 && tab === "progress" && (<>
          {prEntry && (
            <div style={{ background:"linear-gradient(135deg,rgba(251,191,36,0.15),rgba(251,191,36,0.04))", border:"1px solid rgba(251,191,36,0.4)", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", gap:14, alignItems:"center" }}>
              <span style={{ fontSize:28 }}>🏆</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase" }}>Récord Personal</div>
                <div style={{ fontFamily:"Inter, sans-serif", fontSize:22, fontWeight:900 }}>
                  {prEntry.weight}kg × {prEntry.reps} reps
                  <span style={{ fontSize:14, color:"#f59e0b", marginLeft:10 }}>1RM ≈ {prEntry.rm}kg</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{fmtDate(prEntry.date)} {trend && <span style={{ marginLeft:10 }}>{trend}</span>}</div>
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
            {Object.entries(viewLabels).map(([k,l]) => (
              <button key={k} onClick={() => setView(k)} style={{
                padding:"5px 12px", borderRadius:20, border:`1px solid ${view===k?"var(--accent)":"var(--border)"}`,
                background: view===k?"var(--accent-dim)":"transparent", color: view===k?"var(--accent)":"var(--text-muted)",
                fontSize:12, fontWeight:700, cursor:"pointer"
              }}>{l}</button>
            ))}
          </div>

          {(() => {
            // RPE overlay — solo si hay al menos 2 puntos con RPE
            const rpePoints = history.map((h,i) => ({ i, v: h.avgRpe })).filter(p => p.v !== null);
            const hasRpe = rpePoints.length >= 2;
            const minRpe = hasRpe ? Math.min(...rpePoints.map(p=>p.v)) : 1;
            const maxRpe = hasRpe ? Math.max(...rpePoints.map(p=>p.v), minRpe+1) : 10;
            const rangeRpe = maxRpe - minRpe || 1;
            const pyRpe = v => H - ((v - minRpe) / rangeRpe) * (H - 20) - 4;
            return (
              <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 8px 6px", marginBottom:14 }}>
                {hasRpe && (
                  <div style={{ display:"flex", alignItems:"center", gap:10, paddingLeft:10, marginBottom:4 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:16, height:2, background: view==="rm1"?"#f59e0b":"var(--accent)", borderRadius:2 }}/>
                      <span style={{ fontSize:9, color:"var(--text-muted)", fontWeight:700 }}>{viewLabels[view].split(" ")[0]}</span>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                      <div style={{ width:16, height:2, background:"rgba(223,255,0,0.6)", borderRadius:2, borderTop:"1px dashed rgba(223,255,0,0.6)" }}/>
                      <span style={{ fontSize:9, color:"rgba(223,255,0,0.6)", fontWeight:700 }}>RPE</span>
                    </div>
                  </div>
                )}
                <svg width="100%" viewBox={`0 0 ${W+8} ${H+36}`} style={{ display:"block" }}>
                  {[0,0.25,0.5,0.75,1].map(t => {
                    const y = py(minV + t*rangeV);
                    return <g key={t}>
                      <line x1={40} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3"/>
                      <text x={34} y={y+4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{(minV+t*rangeV).toFixed(0)}</text>
                    </g>;
                  })}
                  <polygon points={[...history.map((_,i)=>`${px(i)},${py(vals[i])}`), `${px(history.length-1)},${H+4}`, `${px(0)},${H+4}`].join(" ")} fill={view==="rm1"?"rgba(245,158,11,0.08)":"rgba(59,130,246,0.07)"}/>
                  <polyline points={history.map((_,i)=>`${px(i)},${py(vals[i])}`).join(" ")} fill="none" stroke={view==="rm1"?"#f59e0b":"var(--accent)"} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                  {history.map((h,i) => {
                    const x=px(i), y=py(vals[i]);
                    const isPR = h===prEntry && view==="rm1";
                    const isLast = i===history.length-1;
                    const dotColor = isPR?"#f59e0b":isLast?"#22c55e":"var(--accent)";
                    return <g key={i}>
                      <circle cx={x} cy={y} r={isPR||isLast?5.5:3.5} fill={dotColor} stroke="var(--card)" strokeWidth={1.5}/>
                      {isPR && <text x={x} y={y-12} textAnchor="middle" fill="#f59e0b" fontSize={9} fontWeight={800}>PR</text>}
                      {isLast && <text x={x} y={y-12} textAnchor="middle" fill="#22c55e" fontSize={9} fontWeight={800}>{vals[i]}</text>}
                      <text x={x} y={H+24} textAnchor="middle" fill="var(--text-muted)" fontSize={8}>{fmtDate(h.date)}</text>
                    </g>;
                  })}
                  {/* RPE line — eje derecho, color amarillo */}
                  {hasRpe && <>
                    <polyline
                      points={rpePoints.map(p=>`${px(p.i)},${pyRpe(p.v)}`).join(" ")}
                      fill="none" stroke="rgba(223,255,0,0.55)" strokeWidth={1.8}
                      strokeDasharray="5 3" strokeLinecap="round" strokeLinejoin="round"
                    />
                    {rpePoints.map(p => (
                      <g key={p.i}>
                        <circle cx={px(p.i)} cy={pyRpe(p.v)} r={3} fill="rgba(223,255,0,0.8)" stroke="var(--card)" strokeWidth={1}/>
                        {(p.i === rpePoints[rpePoints.length-1].i) && (
                          <text x={px(p.i)+6} y={pyRpe(p.v)+3} fill="rgba(223,255,0,0.7)" fontSize={8} fontWeight={800}>{p.v}</text>
                        )}
                      </g>
                    ))}
                    {/* Eje Y derecho para RPE */}
                    {[minRpe, maxRpe].map((v,i) => (
                      <text key={i} x={W+6} y={pyRpe(v)+3} textAnchor="start" fill="rgba(223,255,0,0.4)" fontSize={8}>{v}</text>
                    ))}
                  </>}
                </svg>
              </div>
            );
          })()}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
            {[
              ["Máx peso", `${Math.max(...history.map(h=>h.weight))}kg`, "var(--accent)"],
              ["Mejor 1RM", `${Math.max(...history.map(h=>h.rm))}kg`, "#f59e0b"],
              ["Registros", history.length, "var(--text)"],
              ["Mejora total", (() => { const f=vals[0],l=vals[vals.length-1]; const p=Math.round((l-f)/f*100); return `${p>0?"+":""}${p}%`; })(), vals[vals.length-1]>=vals[0]?"#22c55e":"#f97316"],
            ].map(([label,val,color]) => (
              <div key={label} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ fontFamily:"Inter, sans-serif", fontSize:18, fontWeight:800, color }}>{val}</div>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>
          {(() => {
            const rpeAll = history.map(h => h.avgRpe).filter(v => v !== null);
            if (rpeAll.length === 0) return null;
            const rpeAvg = Math.round((rpeAll.reduce((a,b)=>a+b,0)/rpeAll.length)*10)/10;
            const rpeLast = history[history.length-1]?.avgRpe;
            const rpeTrend = rpeAll.length >= 2
              ? rpeLast > rpeAll[0] ? "↑ Más esfuerzo" : rpeLast < rpeAll[0] ? "↓ Más fácil" : "→ Estable"
              : null;
            const trendColor = rpeAll.length >= 2
              ? rpeLast > rpeAll[0] ? "#f87171" : rpeLast < rpeAll[0] ? "#22c55e" : "var(--text-muted)"
              : "var(--text-muted)";
            return (
              <div style={{ background:"rgba(223,255,0,0.04)", border:"1px solid rgba(223,255,0,0.2)", borderRadius:10, padding:"10px 14px", marginBottom:14, display:"flex", alignItems:"center", gap:14 }}>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"Inter, sans-serif", fontSize:24, fontWeight:900, color:"var(--accent)" }}>{rpeLast ?? rpeAvg}</div>
                  <div style={{ fontSize:9, color:"rgba(223,255,0,0.5)", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>RPE última</div>
                </div>
                <div style={{ width:1, height:32, background:"var(--border)" }}/>
                <div style={{ textAlign:"center" }}>
                  <div style={{ fontFamily:"Inter, sans-serif", fontSize:24, fontWeight:900, color:"rgba(223,255,0,0.6)" }}>{rpeAvg}</div>
                  <div style={{ fontSize:9, color:"rgba(223,255,0,0.4)", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>RPE prom.</div>
                </div>
                {rpeTrend && <>
                  <div style={{ width:1, height:32, background:"var(--border)" }}/>
                  <div style={{ fontSize:12, color:trendColor, fontWeight:700 }}>{rpeTrend}</div>
                </>}
              </div>
            );
          })()}

          <div style={{ fontSize:9, fontWeight:800, letterSpacing:3, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:6, opacity:0.5 }}>Historial</div>
          <div style={{ maxHeight:180, overflowY:"auto" }}>
            {[...history].reverse().map((h,i) => {
              const prev = history[history.length-2-i];
              const improved = prev && h.rm > prev.rm;
              return (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 4px", borderBottom:"1px solid var(--border)", fontSize:12 }}>
                  <span style={{ color:"var(--text-muted)", minWidth:70 }}>{fmtDate(h.date)}</span>
                  <span style={{ flex:1, color:"var(--text)" }}>{h.weight}kg × {h.reps} reps</span>
                  <span style={{ color:"#f59e0b", fontWeight:700, minWidth:60, textAlign:"right" }}>1RM {h.rm}kg</span>
                  {h.avgRpe !== null && <span style={{ fontSize:10, color:"rgba(223,255,0,0.7)", fontWeight:700, marginLeft:6 }}>@{h.avgRpe}</span>}
                  {improved && <span style={{ fontSize:10, color:"#22c55e", marginLeft:8 }}>↑</span>}
                  {h===prEntry && <span style={{ fontSize:10, background:"rgba(245,158,11,0.15)", color:"#f59e0b", borderRadius:4, padding:"1px 5px", marginLeft:6, fontWeight:800 }}>PR</span>}
                </div>
              );
            })}
          </div>
        </>)}

      </div>
    </div>
  );
}