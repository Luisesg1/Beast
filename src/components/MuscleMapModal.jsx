import { useState } from "react";
import Body from "react-muscle-highlighter";
import { EXERCISE_DB } from "../exerciseDb";
import { MUSCLE_GROUPS } from "../utils/constants";

// Mapeo de nombres en español → slugs de react-muscle-highlighter
const MUSCLE_TO_SLUG = {
  "Pecho":        "chest",
  "Espalda":      ["upper-back", "lower-back"],
  "Trapecios":    "trapezius",
  "Hombros":      "deltoids",
  "Bíceps":       "biceps",
  "Antebrazo":    "forearm",
  "Tríceps":      "triceps",
  "Core":         ["abs", "obliques"],
  "Cuádriceps":   "quadriceps",
  "Aductores":    "adductors",
  "Femoral":      "hamstring",
  "Tibial":       "tibialis",
  "Glúteos":      "gluteal",
  "Pantorrillas": "calves",
  "Cuello":       "neck",
  // "Cardio" no tiene representación muscular — se omite del mapa
};

const SLUG_TO_MUSCLE = {};
Object.entries(MUSCLE_TO_SLUG).forEach(([muscle, slug]) => {
  const slugs = Array.isArray(slug) ? slug : [slug];
  slugs.forEach(s => { SLUG_TO_MUSCLE[s] = muscle; });
});

// Colores de fallback por músculo (por si MUSCLE_GROUPS no tiene .fill definido)
const MUSCLE_COLOR = {
  "Pecho":        "#DFFF00",
  "Espalda":      "#3b82f6",
  "Trapecios":    "#8b5cf6",
  "Hombros":      "#a855f7",
  "Bíceps":       "#f59e0b",
  "Antebrazo":    "#fb923c",
  "Tríceps":      "#f97316",
  "Core":         "#ec4899",
  "Cuádriceps":   "#22c55e",
  "Aductores":    "#06b6d4",
  "Femoral":      "#14b8a6",
  "Tibial":       "#84cc16",
  "Glúteos":      "#ef4444",
  "Pantorrillas": "#64748b",
  "Cuello":       "#94a3b8",
};

function muscleColor(muscle, groups) {
  return groups?.[muscle]?.fill || MUSCLE_COLOR[muscle] || "#64748b";
}

export default function MuscleMapModal({ sessions, onClose }) {
  const [period,  setPeriod]  = useState("week");
  const [view,    setView]    = useState("volume");
  const [hover,   setHover]   = useState(null);
  const [side,    setSide]    = useState("front");

  const today = new Date(); today.setHours(0,0,0,0);

  const cutoff = new Date();
  if (period === "week")       cutoff.setDate(cutoff.getDate() - 7);
  else if (period === "month") cutoff.setDate(cutoff.getDate() - 30);
  else                         cutoff.setFullYear(2000);

  const muscleCounts = {};
  sessions
    .filter(s => new Date(s.date + "T00:00:00") >= cutoff)
    .forEach(s => (s.exercises||[]).forEach(ex => {
      const dbEx = EXERCISE_DB.find(e => e.name === ex.name);
      if (dbEx) muscleCounts[dbEx.muscle] = (muscleCounts[dbEx.muscle]||0) + 1;
    }));

  const lastTrained = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const dbEx = EXERCISE_DB.find(e => e.name === ex.name);
    if (dbEx?.muscle) {
      if (!lastTrained[dbEx.muscle] || s.date > lastTrained[dbEx.muscle])
        lastTrained[dbEx.muscle] = s.date;
    }
  }));

  const daysSince = (muscle) => {
    if (!lastTrained[muscle]) return 999;
    return Math.round((today - new Date(lastTrained[muscle] + "T00:00:00")) / 86400000);
  };

  const RECOVERY_DAYS = {
    "Bíceps":       { rest: 1, ready: 2 },
    "Tríceps":      { rest: 1, ready: 2 },
    "Hombros":      { rest: 1, ready: 2 },
    "Core":         { rest: 1, ready: 2 },
    "Pantorrillas": { rest: 1, ready: 2 },
    "Antebrazo":    { rest: 1, ready: 2 },
    "Cuello":       { rest: 1, ready: 2 },
    "Tibial":       { rest: 1, ready: 2 },
    "Pecho":        { rest: 2, ready: 3 },
    "Espalda":      { rest: 2, ready: 3 },
    "Trapecios":    { rest: 2, ready: 3 },
    "Glúteos":      { rest: 2, ready: 3 },
    "Aductores":    { rest: 2, ready: 3 },
    "Femoral":      { rest: 2, ready: 4 },
    "Cuádriceps":   { rest: 2, ready: 4 },
    "Cardio":       { rest: 1, ready: 2 },
  };

  const recoveryColor = (muscle) => {
    const d = daysSince(muscle);
    const { rest, ready } = RECOVERY_DAYS[muscle] || { rest: 1, ready: 2 };
    if (d === 999) return "#374151";
    if (d <= rest)  return "#ef4444";
    if (d <= ready) return "#f59e0b";
    if (d <= ready + 2) return "#22c55e";
    return "#3b82f6";
  };

  const recoveryLabel = (muscle, d) => {
    const { rest, ready } = RECOVERY_DAYS[muscle] || { rest: 1, ready: 2 };
    if (d === 999)      return "Nunca entrenado";
    if (d <= rest)      return `Necesita descanso (${rest - d + 1}d más)`;
    if (d <= ready)     return `Recuperando (${ready - d}d más)`;
    if (d <= ready + 2) return "✅ Listo para entrenar";
    return "💪 ¡En su punto!";
  };

  const maxCount = Math.max(...Object.values(muscleCounts), 1);
  const sorted   = Object.entries(muscleCounts).sort((a,b) => b[1]-a[1]);

  // Construir bodyData para react-muscle-highlighter
  const bodyData = [];
  // Primero agregar todos los músculos conocidos en gris tenue (sin datos)
  Object.entries(MUSCLE_TO_SLUG).forEach(([muscle, slugs]) => {
    const slugArr = Array.isArray(slugs) ? slugs : [slugs];
    slugArr.forEach(slug => {
      bodyData.push({ slug, color: "#2a2a2a", intensity: 1 });
    });
  });
  // Luego sobrescribir con los que sí tienen datos
  Object.entries(muscleCounts).forEach(([muscle, count]) => {
    const slugs = MUSCLE_TO_SLUG[muscle];
    if (!slugs) return;
    const slugArr = Array.isArray(slugs) ? slugs : [slugs];
    const color = view === "recovery"
      ? recoveryColor(muscle)
      : (muscleColor(muscle, MUSCLE_GROUPS));
    const intensity = view === "recovery"
      ? 2
      : Math.max(1, Math.ceil((count / maxCount) * 3));
    slugArr.forEach(slug => {
      const idx = bodyData.findIndex(b => b.slug === slug);
      if (idx >= 0) bodyData[idx] = { slug, color, intensity };
      else bodyData.push({ slug, color, intensity });
    });
  });

  // Hover info
  const hoveredInfo = hover ? {
    muscle: hover,
    count:  muscleCounts[hover] || 0,
    days:   daysSince(hover),
    color:  view === "recovery" ? recoveryColor(hover) : (muscleColor(hover, MUSCLE_GROUPS)),
  } : null;

  const handleBodyPartPress = (part) => {
    const muscle = SLUG_TO_MUSCLE[part.slug];
    if (muscle) setHover(h => h === muscle ? null : muscle);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}
        style={{ maxHeight:"92vh", overflowY:"auto", maxWidth:480 }}>
        <div className="modal-header">
          <h3 className="modal-title">💪 Mapa muscular</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Periodo + Vista */}
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <div style={{ display:"flex", flex:1, gap:4 }}>
            {[["week","Semana"],["month","Mes"],["all","Todo"]].map(([v,l]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{ flex:1, padding:"6px 4px", fontSize:11, borderRadius:8, border:"1px solid", borderColor:period===v?"var(--accent)":"var(--border)", background:period===v?"var(--accent)":"transparent", color:period===v?"#000":"var(--text-muted)", cursor:"pointer", fontWeight:period===v?700:500, transition:"all 0.2s" }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {[["volume","📊 Volumen"],["recovery","🔄 Recuperación"]].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:"6px 10px", fontSize:11, borderRadius:8, border:"1px solid", borderColor:view===v?"var(--accent)":"var(--border)", background:view===v?"var(--accent)":"transparent", color:view===v?"#000":"var(--text-muted)", cursor:"pointer", fontWeight:view===v?700:500, transition:"all 0.2s", whiteSpace:"nowrap" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Toggle Frente / Espalda */}
        <div style={{ display:"flex", marginBottom:16, borderRadius:12, overflow:"hidden", border:"1px solid var(--border)" }}>
          {[["front","👤 Frente"],["back","🔄 Espalda"]].map(([v,l]) => (
            <button key={v} onClick={() => { setSide(v); setHover(null); }} style={{ flex:1, padding:"11px 0", fontSize:13, fontWeight:800, border:"none", background:side===v?"var(--accent)":"transparent", color:side===v?"#000":"var(--text-muted)", cursor:"pointer", transition:"all 0.2s", fontFamily:"Inter, sans-serif", letterSpacing:1 }}>{l}</button>
          ))}
        </div>

        {/* Tooltip */}
        <div style={{ minHeight:48, marginBottom:8 }}>
          {hoveredInfo && (
            <div style={{ padding:"10px 14px", background:`${hoveredInfo.color}15`, border:`1px solid ${hoveredInfo.color}40`, borderRadius:10, display:"flex", alignItems:"center", gap:12 }}>
              <div style={{ width:12, height:12, borderRadius:"50%", background:hoveredInfo.color, flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <span style={{ fontWeight:800, fontSize:14, color:"var(--text)" }}>{hoveredInfo.muscle}</span>
                {view === "volume"
                  ? <span style={{ fontSize:12, color:"var(--text-muted)", marginLeft:8 }}>{hoveredInfo.count} series en este período</span>
                  : <span style={{ fontSize:12, color:hoveredInfo.color, marginLeft:8, fontWeight:600 }}>{hoveredInfo.days === 999 ? "Nunca entrenado" : `Hace ${hoveredInfo.days}d · ${recoveryLabel(hover, hoveredInfo.days)}`}</span>
                }
              </div>
            </div>
          )}
        </div>

        {/* Figura con react-muscle-highlighter */}
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <Body
            data={bodyData}
            side={side}
            gender="male"
            scale={1.4}
            onBodyPartPress={handleBodyPartPress}
          />
        </div>

        {/* Recovery legend */}
        {view === "recovery" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>Leyenda</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
              {[["#ef4444","Descansando"],["#f59e0b","Recuperando"],["#22c55e","Listo"],["#3b82f6","¡En su punto!"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--text-muted)" }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:c, flexShrink:0 }}/>{l}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Volume list */}
        {view === "volume" && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Músculos trabajados</div>
            {sorted.length === 0
              ? <p style={{ color:"var(--text-muted)", fontSize:13 }}>Sin sesiones en este período.</p>
              : sorted.map(([muscle, count]) => {
                  const color = muscleColor(muscle, MUSCLE_GROUPS);
                  return (
                    <div key={muscle} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:9, cursor:"pointer" }}
                      onMouseEnter={() => setHover(muscle)} onMouseLeave={() => setHover(null)}>
                      <div style={{ width:10, height:10, borderRadius:"50%", background:color, flexShrink:0 }}/>
                      <div style={{ flex:1, fontSize:13, fontWeight:600 }}>{muscle}</div>
                      <div style={{ width:90, height:6, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", background:color, width:`${(count/maxCount)*100}%`, borderRadius:3, transition:"width 0.5s" }}/>
                      </div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", width:20, textAlign:"right", fontWeight:700 }}>{count}</div>
                    </div>
                  );
                })
            }
            {Object.keys(MUSCLE_GROUPS).filter(m => !muscleCounts[m]).length > 0 && (
              <div style={{ marginTop:12, padding:"10px 12px", background:"rgba(239,68,68,0.06)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:8, fontSize:12, color:"#f87171" }}>
                💡 Sin trabajar: {Object.keys(MUSCLE_GROUPS).filter(m => !muscleCounts[m]).join(", ")}
              </div>
            )}
          </div>
        )}

        {/* Recovery list */}
        {view === "recovery" && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Estado por músculo</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
              {Object.keys(MUSCLE_GROUPS).map(muscle => {
                const d = daysSince(muscle);
                const c = recoveryColor(muscle);
                return (
                  <div key={muscle}
                    style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", background:`${c}10`, border:`1px solid ${c}30`, borderRadius:10, cursor:"pointer", transition:"all 0.2s" }}
                    onMouseEnter={() => setHover(muscle)} onMouseLeave={() => setHover(null)}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background:c, flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:"var(--text)" }}>{muscle}</div>
                      <div style={{ fontSize:10, color:c, fontWeight:600 }}>{recoveryLabel(muscle, d)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}