import { useState, useEffect } from "react";
import { useConfirm } from "./ConfirmModal";
import { todayStr, fmtDate, numBodyW, numHeight, numAge } from "../utils/helpers";
import { saveMeasuresToDB, loadMeasuresFromDB } from "../utils/firebaseService";
import { getStreak, getPRs, calc1RM } from "../utils/gymCalcs";
import InfoPill from "./InfoPill";
import PhotoProgressModal from "./PhotoProgressModal";

export default function BodyStatsModal({ stats, onSave, onClose, uid, isGuest, isPro, sessions = [], userName, initialTab = "stats" }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState(stats.height || "170");
  const [gender, setGender] = useState(stats.gender || "male");
  const [age, setAge] = useState(stats.age || "25");
  const [activity, setActivity] = useState(stats.activity || "moderate");
  const [goal, setGoal] = useState(stats.goal || "maintain");
  const [goalWeight, setGoalWeight] = useState(stats.goalWeight || "");
  const [saved, setSaved] = useState(false);
  const [photoTab, setPhotoTab] = useState(initialTab === "medidas");
  const [activeTab, setActiveTab] = useState(initialTab);
  const [measureEntries, setMeasureEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gym_measure_entries") || "[]"); } catch { return []; }
  });
  const [measureForm, setMeasureForm] = useState({});

  useEffect(() => {
    if (isGuest || !uid) return;
    loadMeasuresFromDB(uid).then(entries => {
      if (entries && entries.length > 0) {
        setMeasureEntries(entries);
        try { localStorage.setItem("gym_measure_entries", JSON.stringify(entries)); } catch {}
      }
    });
  }, [uid]);

  function saveMeasures(updated) {
    setMeasureEntries(updated);
    try { localStorage.setItem("gym_measure_entries", JSON.stringify(updated)); } catch {}
    if (!isGuest && uid) saveMeasuresToDB(uid, updated);
  }

  function save() {
    if (!weight) return;
    const w = parseFloat(weight);
    if (isNaN(w) || w < 20 || w > 300) return;
    const newEntry = { date: todayStr(), weight: w };
    const newHeight = parseFloat(height) || stats.height;
    const newStats = {
      height: newHeight, gender, age: parseFloat(age)||stats.age||25, activity, goal,
      goalWeight: parseFloat(goalWeight) || null,
      entries: [...(stats.entries || []), ...(weight ? [newEntry] : [])]
    };
    onSave(newStats);
    setWeight("");
    setSaved(true);
    const _st = setTimeout(() => setSaved(false), 2000); return () => clearTimeout(_st);
  }

  const entries = [...(stats.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
  const vals = entries.map(e => e.weight).filter(Boolean);
  const currentWeight = vals.length > 0 ? vals[vals.length - 1] : null;
  const W = 400, H = 100;

  const bmi = stats.height && currentWeight
    ? (currentWeight / Math.pow(stats.height / 100, 2)).toFixed(1) : null;
  const bmiFeedback = !bmi ? null
    : bmi < 18.5 ? { label: "Bajo peso", color: "#60a5fa" }
    : bmi < 25   ? { label: "Normal ✓",  color: "#22c55e" }
    : bmi < 30   ? { label: "Sobrepeso", color: "#f97316" }
    :               { label: "Obesidad",  color: "#ef4444" };

  const activityMultipliers = { sedentary: 1.2, moderate: 1.55, active: 1.725 };
  let tdee = null;
  const effectiveHeight = parseFloat(height) || parseFloat(stats.height) || 170;
  const effectiveAge = parseFloat(age) || parseFloat(stats.age) || 25;
  const effectiveActivity = activity || stats.activity || "moderate";
  const effectiveGender = gender || stats.gender || "male";
  if (currentWeight && effectiveHeight) {
    const w = currentWeight, h = effectiveHeight, a = effectiveAge;
    const bmr = effectiveGender === "female"
      ? 10*w + 6.25*h - 5*a - 161
      : 10*w + 6.25*h - 5*a + 5;
    tdee = Math.round(bmr * (activityMultipliers[effectiveActivity]));
  }

  const goalConfig = {
    deficit:  { label: "Déficit",      emoji: "⬇️", color: "#22c55e", kcalAdj: -400, proteinPerKg: 2.2, desc: "Perder grasa" },
    maintain: { label: "Mantenimiento",emoji: "➡️", color: "#3b82f6", kcalAdj: 0,    proteinPerKg: 1.6, desc: "Mantener peso" },
    bulk:     { label: "Volumen",      emoji: "⬆️", color: "#f97316", kcalAdj: +350, proteinPerKg: 1.8, desc: "Ganar músculo" },
  };
  const gc = goalConfig[stats.goal || "maintain"];
  const targetKcal = tdee ? tdee + gc.kcalAdj : null;
  const targetProtein = currentWeight ? Math.round(currentWeight * gc.proteinPerKg) : null;

  let prediction = null;
  if (entries.length >= 3) {
    const t0 = new Date(entries[0].date + "T00:00:00").getTime();
    const xs = entries.map(e => (new Date(e.date + "T00:00:00").getTime() - t0) / 86400000);
    const ys = entries.map(e => e.weight);
    const n = xs.length;
    const sumX = xs.reduce((a,b)=>a+b,0), sumY = ys.reduce((a,b)=>a+b,0);
    const sumXY = xs.reduce((s,x,i)=>s+x*ys[i],0), sumX2 = xs.reduce((s,x)=>s+x*x,0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX);
    const intercept = (sumY - slope*sumX) / n;
    const lastX = xs[xs.length - 1];
    const pred30 = Math.round((intercept + slope*(lastX+30))*10)/10;
    const pred90 = Math.round((intercept + slope*(lastX+90))*10)/10;
    const weeklyChange = Math.round(slope*7*10)/10;
    const weeklyKg = Math.abs(slope * 7);
    let trendAlert = null;
    if (weeklyKg > 3) {
      trendAlert = { msg: "⚠️ Variación semanal irreal. Verifica que los pesos registrados sean correctos.", color: "#f87171" };
    } else if (stats.goal === "deficit" && slope > 0.03) {
      trendAlert = { msg: "⚠️ Estás ganando peso, no perdiendo. Revisa tu alimentación.", color: "#f87171" };
    } else if (stats.goal === "bulk" && slope < -0.03) {
      trendAlert = { msg: "⚠️ Estás perdiendo peso. Aumenta las calorías.", color: "#f87171" };
    } else if (stats.goal === "maintain" && Math.abs(slope) > 0.07) {
      trendAlert = { msg: "⚠️ Tu peso está variando bastante. Ajusta tu ingesta.", color: "#fbbf24" };
    } else {
      trendAlert = { msg: "✅ Tu tendencia va acorde a tu objetivo.", color: "#22c55e" };
    }
    prediction = { pred30, pred90, weeklyChange, slope, trendAlert };
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⚖️ Peso & Estatura</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display:"flex", gap:0, marginBottom:20, background:"var(--input-bg)", borderRadius:10, padding:3 }}>
          {[["stats","📊 Stats"],["medidas","📐 Medidas"]].map(([key,label]) => (
            <button key={key} onClick={() => { setActiveTab(key); setPhotoTab(key === "medidas"); }}
              style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: activeTab===key ? "var(--accent)" : "transparent", color: activeTab===key ? "#09090B" : "var(--text-muted)", fontWeight:700, fontSize:12, cursor:"pointer", transition:"all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* MEDIDAS TAB */}
        {activeTab === "medidas" && (() => {
          const FIELDS = [
            { key:"bodyFat", label:"% Grasa",  unit:"%",  color:"#f97316", info:true, min:1,   max:60  },
            { key:"chest",   label:"Pecho",    unit:"cm", color:"#3b82f6",            min:50,  max:200 },
            { key:"waist",   label:"Cintura",  unit:"cm", color:"#22c55e",            min:40,  max:200 },
            { key:"hip",     label:"Cadera",   unit:"cm", color:"#a855f7",            min:50,  max:200 },
            { key:"arm",     label:"Brazo",    unit:"cm", color:"#ec4899",            min:10,  max:80  },
            { key:"thigh",   label:"Muslo",    unit:"cm", color:"#06b6d4",            min:20,  max:120 },
          ];
          const last  = measureEntries[measureEntries.length - 1] || {};
          const first = measureEntries[0] || {};

          function MiniChart({ field, color }) {
            const pts = measureEntries.map(e => parseFloat(e[field.key])).filter(v => !isNaN(v));
            if (pts.length < 2) return <div style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", padding:"8px 0" }}>Más registros necesarios</div>;
            const W=220, H=55, pad=8;
            const min=Math.min(...pts), max=Math.max(...pts), range=max-min||1;
            const coords = pts.map((v,i) => {
              const x = pad + (i/(pts.length-1))*(W-pad*2);
              const y = H - pad - ((v-min)/range)*(H-pad*2);
              return `${x},${y}`;
            });
            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
                <polyline points={coords.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                {coords.map((c,i) => { const [x,y]=c.split(","); return <circle key={i} cx={x} cy={y} r="3" fill={color}/>; })}
              </svg>
            );
          }

          return (
            <div>
              <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:14, marginBottom:16 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.5, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>
                  ➕ Nuevo registro · {fmtDate(todayStr())}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
                  {FIELDS.map(f => {
                    const val = parseFloat(measureForm[f.key]);
                    const outOfRange = measureForm[f.key] && !isNaN(val) && (val < f.min || val > f.max);
                    return (
                      <div key={f.key}>
                        <label style={{ fontSize:10, color:"var(--text-muted)", display:"flex", alignItems:"center", marginBottom:3 }}>{f.label} ({f.unit}){f.info && <InfoPill title="¿Cómo medir la grasa corporal?" color="#f97316" lines={["El % de grasa indica qué parte de tu peso es grasa.","📏 Pliegues cutáneos: mide el grosor de la piel en puntos clave.","⚖️ Bioimpedancia: báscula eléctrica, menos precisa pero fácil.","🔬 DEXA scan: el más preciso, disponible en clínicas.","📊 Hombre: Atlético 6–13% · Fitness 14–17% · Promedio 18–24%","  Mujer: Atlético 14–20% · Fitness 21–24% · Promedio 25–31%"]} />}</label>
                        <input className="input" placeholder="—" inputMode="decimal"
                          value={measureForm[f.key]||""}
                          onChange={e => {
                            const raw = e.target.value.slice(0, 3).replace(/[^0-9.]/g,"").replace(/(\..*)\./, "$1");
                            setMeasureForm(p => ({...p, [f.key]: raw}));
                          }}
                          style={{ textAlign:"center", fontSize:14, fontWeight:700,
                            borderColor: outOfRange ? "#ef4444" : undefined,
                            color: outOfRange ? "#ef4444" : undefined,
                          }}
                        />
                        {outOfRange && <div style={{ fontSize:9, color:"#ef4444", marginTop:2, textAlign:"center" }}>{f.min}–{f.max}{f.unit}</div>}
                      </div>
                    );
                  })}
                </div>
                <button className="btn-primary" style={{ width:"100%", fontSize:14 }} onClick={() => {
                  const hasError = FIELDS.some(f => {
                    const val = parseFloat(measureForm[f.key]);
                    return measureForm[f.key] && !isNaN(val) && (val < f.min || val > f.max);
                  });
                  if (hasError) return;
                  const entry = { date: todayStr(), ...measureForm };
                  const updated = [...measureEntries.filter(e => e.date !== todayStr()), entry].sort((a,b)=>a.date.localeCompare(b.date));
                  saveMeasures(updated);
                  setMeasureForm({});
                }}>Guardar medidas</button>
              </div>

              {measureEntries.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                  {FIELDS.map(f => {
                    const val = parseFloat(last[f.key]);
                    const ini = parseFloat(first[f.key]);
                    const delta = !isNaN(val) && !isNaN(ini) && measureEntries.length > 1 ? (val-ini).toFixed(1) : null;
                    return (
                      <div key={f.key} style={{ background:"var(--card)", border:`1px solid ${f.color}40`, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:2 }}>{f.label}</div>
                        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800, color:isNaN(val)?"var(--text-muted)":f.color }}>
                          {isNaN(val) ? "—" : `${val}${f.unit}`}
                        </div>
                        {delta !== null && (
                          <div style={{ fontSize:10, fontWeight:700, color:parseFloat(delta)<0?"#22c55e":parseFloat(delta)>0?"#f97316":"var(--text-muted)" }}>
                            {parseFloat(delta)>0?"+":""}{delta}{f.unit}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {measureEntries.length >= 2 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Evolución</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                    {FIELDS.map(f => (
                      <div key={f.key} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px" }}>
                        <div style={{ fontSize:11, fontWeight:700, color:f.color, marginBottom:6 }}>{f.label}</div>
                        <MiniChart field={f} color={f.color}/>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {measureEntries.length > 0 && (
                <div>
                  <div style={{ fontSize:9, fontWeight:800, letterSpacing:3, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:6, opacity:0.5 }}>Historial</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                    {[...measureEntries].reverse().map((e,i) => (
                      <div key={e.date} style={{ display:"flex", alignItems:"center", gap:8, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:8, padding:"8px 12px" }}>
                        <div style={{ fontSize:11, color:"var(--accent)", fontWeight:700, minWidth:70 }}>{fmtDate(e.date)}</div>
                        <div style={{ display:"flex", gap:8, flex:1, flexWrap:"wrap" }}>
                          {FIELDS.map(f => e[f.key] ? (
                            <span key={f.key} style={{ fontSize:11, color:"var(--text-muted)" }}>
                              <span style={{ color:f.color, fontWeight:700 }}>{e[f.key]}{f.unit}</span> {f.label}
                            </span>
                          ) : null)}
                        </div>
                        <button onClick={() => {
                          const updated = [...measureEntries].reverse().filter((_,j)=>j!==i).reverse();
                          saveMeasures(updated);
                        }} style={{ background:"none", border:"none", color:"var(--text-muted)", cursor:"pointer", fontSize:13, padding:"0 4px" }}>🗑️</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {measureEntries.length === 0 && (
                <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>
                  <div style={{ fontSize:40, marginBottom:10 }}>📐</div>
                  <p style={{ fontSize:13 }}>Registra tus medidas semanalmente<br/>para ver tu progreso real.</p>
                </div>
              )}
            </div>
          );
        })()}

        {/* STATS TAB */}
        {activeTab === "stats" && (<>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label className="field-label">Estatura (cm)</label>
              <input className="input" placeholder="170" value={height}
                onChange={e => setHeight(numHeight(e.target.value.slice(0, 3)))}
                inputMode="decimal"
                style={{ borderColor: height && (parseFloat(height) < 50 || parseFloat(height) > 220) ? "#ef4444" : undefined, color: height && (parseFloat(height) < 50 || parseFloat(height) > 220) ? "#ef4444" : undefined }}
              />
              {height && (parseFloat(height) < 50 || parseFloat(height) > 220) && <div style={{ fontSize:10, color:"#ef4444", marginTop:3 }}>Rango: 50–220 cm</div>}
            </div>
            <div className="field">
              <label className="field-label">Peso hoy (kg)</label>
              <input className="input" placeholder="70.5" value={weight}
                onChange={e => setWeight(numBodyW(e.target.value.slice(0, 5)))}
                onKeyDown={e => e.key==="Enter"&&save()}
                style={{ borderColor: weight && (parseFloat(weight) < 20 || parseFloat(weight) > 300) ? "#ef4444" : undefined, color: weight && (parseFloat(weight) < 20 || parseFloat(weight) > 300) ? "#ef4444" : undefined }}
              />
              {weight && (parseFloat(weight) < 20 || parseFloat(weight) > 300) && <div style={{ fontSize:10, color:"#ef4444", marginTop:3 }}>Rango: 20–300 kg</div>}
            </div>
            <div className="field" style={{ maxWidth: 70 }}>
              <label className="field-label">Edad</label>
              <input className="input" placeholder="25" value={age}
                onChange={e => setAge(numAge(e.target.value.slice(0, 3)))}
                style={{ borderColor: age && (parseInt(age) < 5 || parseInt(age) > 120) ? "#ef4444" : undefined, color: age && (parseInt(age) < 5 || parseInt(age) > 120) ? "#ef4444" : undefined }}
              />
              {age && (parseInt(age) < 5 || parseInt(age) > 120) && <div style={{ fontSize:9, color:"#ef4444", marginTop:2 }}>5–120</div>}
            </div>
            <button className="btn-primary" style={{ alignSelf:"flex-end", padding:"10px 16px", fontSize:15, background: saved?"#22c55e":"var(--accent)" }} onClick={save}>
              {saved ? "✓" : "Guardar"}
            </button>
          </div>

          <div className="form-row" style={{ marginBottom: 14 }}>
            <div className="field">
              <label className="field-label">Sexo</label>
              <div style={{ display:"flex", gap:6 }}>
                {[["male","♂️ Hombre"],["female","♀️ Mujer"]].map(([v,l]) => (
                  <button key={v} onClick={() => setGender(v)} style={{ flex:1, padding:"8px", borderRadius:8, border:`1px solid ${gender===v?"var(--accent)":"var(--border)"}`, background: gender===v?"var(--accent-dim)":"var(--input-bg)", color: gender===v?"var(--accent)":"var(--text-muted)", cursor:"pointer", fontSize:13, fontWeight:600 }}>{l}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Actividad física</label>
              <select className="input" value={activity} onChange={e => setActivity(e.target.value)}>
                <option value="sedentary">🪑 Sedentario</option>
                <option value="moderate">🚶 Moderado</option>
                <option value="active">🏃 Muy activo</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label className="field-label" style={{ marginBottom:8, display:"block" }}>Objetivo actual</label>
            <div style={{ display:"flex", gap:8 }}>
              {Object.entries(goalConfig).map(([key, cfg]) => (
                <button key={key} onClick={() => setGoal(key)} style={{ flex:1, padding:"10px 8px", borderRadius:10, border:`2px solid ${goal===key?cfg.color:"var(--border)"}`, background: goal===key?`${cfg.color}18`:"var(--input-bg)", cursor:"pointer", textAlign:"center", transition:"all 0.2s" }}>
                  <div style={{ fontSize:20 }}>{cfg.emoji}</div>
                  <div style={{ fontSize:12, fontWeight:700, color: goal===key?cfg.color:"var(--text-muted)", marginTop:3 }}>{cfg.label}</div>
                  <div style={{ fontSize:10, color:"var(--text-muted)" }}>{cfg.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {bmi && (
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              <div style={{ flex:1, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>Peso</div>
                <div style={{ fontSize:15, fontWeight:800, fontFamily:"Barlow Condensed, sans-serif", color:"var(--accent)" }}>{currentWeight} kg</div>
              </div>
              <div style={{ flex:1, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3, display:"flex", alignItems:"center", justifyContent:"center" }}>IMC<InfoPill title="¿Qué es el IMC?" color="#3b82f6" lines={["El IMC relaciona peso y estatura para estimar si estás en un rango saludable.","📊 Fórmula: peso (kg) ÷ estatura² (m)","🔵 < 18.5 → Bajo peso","🟢 18.5–24.9 → Normal","🟠 25–29.9 → Sobrepeso","🔴 ≥ 30 → Obesidad","⚠️ No distingue músculo de grasa — atletas pueden tener IMC alto sin sobrepeso."]} /></div>
                <div style={{ fontSize:15, fontWeight:800, fontFamily:"Barlow Condensed, sans-serif", color:bmiFeedback?.color }}>{bmi}</div>
              </div>
              <div style={{ flex:1, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>Estado</div>
                <div style={{ fontSize:15, fontWeight:800, fontFamily:"Barlow Condensed, sans-serif", color:bmiFeedback?.color }}>{bmiFeedback?.label||"—"}</div>
              </div>
            </div>
          )}

          {targetKcal && (
            <div style={{ background:`${gc.color}10`, border:`1px solid ${gc.color}40`, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:gc.color, textTransform:"uppercase", marginBottom:10 }}>
                {gc.emoji} Plan {gc.label} — Objetivos diarios
              </div>
              <div style={{ display:"flex", gap:12 }}>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:800, color:gc.color }}>{targetKcal}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>kcal/día</div>
                </div>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:800, color:"var(--text)" }}>{targetProtein}g</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>proteína/día</div>
                </div>
                <div style={{ flex:1, textAlign:"center" }}>
                  <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:800, color:"var(--text)" }}>{tdee}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", display:"flex", alignItems:"center", justifyContent:"center", gap:2 }}>TDEE base<InfoPill title="¿Qué es el TDEE?" color="#f59e0b" lines={["TDEE es el total de calorías que quemas en un día, incluyendo ejercicio y actividad diaria.","📉 Déficit: Come menos que tu TDEE para perder grasa.","⚖️ Mantenimiento: Come igual para mantener el peso.","📈 Volumen: Come más para ganar músculo.","Calculado con la fórmula Mifflin-St Jeor (peso, estatura, edad, actividad)."]} /></div>
                </div>
              </div>
              {gc.kcalAdj !== 0 && (
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:8, textAlign:"center" }}>
                  {gc.kcalAdj > 0 ? `+${gc.kcalAdj}` : gc.kcalAdj} kcal sobre tu mantenimiento ({tdee} kcal)
                </div>
              )}
            </div>
          )}
          {!targetKcal && currentWeight && (
            <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", marginBottom:14, fontStyle:"italic" }}>
              Ingresa tu edad y estatura para ver los objetivos nutricionales
            </div>
          )}

          {prediction && (
            <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:12, padding:"12px 16px", marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>📈 Proyección si sigues así</div>
              <div style={{ display:"flex", gap:10, marginBottom:10 }}>
                {[
                  ["Cambio/semana", `${prediction.weeklyChange>0?"+":""}${prediction.weeklyChange} kg`, prediction.slope<0?"#22c55e":"#f97316"],
                  ["En 30 días",   `${prediction.pred30} kg`, "var(--text)"],
                  ["En 90 días",   `${prediction.pred90} kg`, "var(--text)"],
                ].map(([l,v,c]) => (
                  <div key={l} style={{ flex:1, textAlign:"center" }}>
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800, color:c }}>{v}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)" }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, padding:"8px 12px", background:`${prediction.trendAlert.color}15`, border:`1px solid ${prediction.trendAlert.color}40`, borderRadius:8, color:prediction.trendAlert.color, textAlign:"center" }}>
                {prediction.trendAlert.msg}
              </div>
            </div>
          )}
          {entries.length < 3 && entries.length > 0 && (
            <div style={{ fontSize:12, color:"var(--text-muted)", textAlign:"center", marginBottom:12, fontStyle:"italic" }}>
              Necesitas al menos 3 registros para ver la proyección
            </div>
          )}

          {currentWeight && effectiveHeight && (() => {
            const h = effectiveHeight;
            const baseIdeal = effectiveGender === "female"
              ? 45.5 + 2.3 * ((h - 152.4) / 2.54)
              : 50   + 2.3 * ((h - 152.4) / 2.54);
            const idealMin = Math.round(baseIdeal * 0.92);
            const idealMax = goal === "bulk"
              ? Math.round(baseIdeal * 1.18)
              : goal === "deficit"
              ? Math.round(baseIdeal * 1.00)
              : Math.round(baseIdeal * 1.08);
            const suggestedGoal = goal === "bulk" ? idealMax : idealMin;
            const userGoal = parseFloat(goalWeight) || suggestedGoal;
            const totalToLose = currentWeight - userGoal;
            const weeksNeeded = prediction?.slope && Math.abs(prediction.slope) > 0.01
              ? Math.round(Math.abs(totalToLose) / Math.abs(prediction.slope * 7))
              : null;
            const progressPct = goal === "bulk"
              ? Math.min(Math.max((currentWeight - (stats.entries?.[0]?.weight || currentWeight)) / (userGoal - (stats.entries?.[0]?.weight || currentWeight)), 0), 1) * 100
              : (1 - Math.max(0, Math.min(1, (currentWeight - userGoal) / (((stats.entries?.[0]?.weight||currentWeight)) - userGoal)))) * 100;
            const reached = goal === "bulk" ? currentWeight >= userGoal : currentWeight <= userGoal;
            return (
              <div style={{ background:"rgba(168,85,247,0.07)", border:"1px solid rgba(168,85,247,0.25)", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#a855f7", textTransform:"uppercase", marginBottom:10 }}>🎯 Meta de peso</div>
                <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10, lineHeight:1.6 }}>
                  Para tu altura <strong style={{color:"var(--text)"}}>{h}cm</strong> en modo <strong style={{color:gc.color}}>{gc.label}</strong>,
                  tu rango recomendado es <strong style={{color:"#a855f7"}}>{idealMin}–{idealMax} kg</strong>.
                  {currentWeight < idealMin && goal !== "bulk" && <span style={{color:"#22c55e"}}> ✓ Ya estás dentro del rango.</span>}
                </div>
                <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
                  <div style={{ flex:1 }}>
                    <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>Tu meta de peso (kg)</label>
                    <input className="input" type="number" inputMode="decimal" placeholder={String(suggestedGoal)} value={goalWeight}
                      onChange={e => setGoalWeight(e.target.value)}
                      style={{ width:"100%", textAlign:"center", fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800 }}
                    />
                    <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:3 }}>Rango válido: 20–300 kg</div>
                  </div>
                  <div style={{ textAlign:"center", minWidth:90 }}>
                    <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:2 }}>Diferencia</div>
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800, color: totalToLose > 0 ? "#22c55e" : totalToLose < 0 ? "#f97316" : "#a855f7" }}>
                      {totalToLose > 0 ? "-" : totalToLose < 0 ? "+" : ""}{Math.abs(Math.round(totalToLose*10)/10)} kg
                    </div>
                  </div>
                  {weeksNeeded != null && weeksNeeded < 200 && (
                    <div style={{ textAlign:"center", minWidth:90 }}>
                      <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:2 }}>Estimado</div>
                      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800, color:"var(--accent)" }}>{weeksNeeded}sem</div>
                    </div>
                  )}
                </div>
                {!reached ? (
                  <div>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"var(--text-muted)", marginBottom:4 }}>
                      <span>Progreso hacia la meta</span>
                      <span style={{fontWeight:700}}>{Math.round(Math.max(0, Math.min(100, progressPct)))}%</span>
                    </div>
                    <div style={{ height:8, background:"var(--border)", borderRadius:20, overflow:"hidden" }}>
                      <div style={{ height:"100%", background:"#a855f7", borderRadius:20, width:`${Math.max(0,Math.min(100,progressPct))}%`, transition:"width 0.5s" }} />
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign:"center", padding:"8px 0", color:"#22c55e", fontWeight:700, fontSize:14 }}>🎉 ¡Alcanzaste tu meta de peso!</div>
                )}
              </div>
            );
          })()}

          {entries.length >= 2 && (() => {
            const goalW = parseFloat(goalWeight) || null;
            const chartMin = Math.min(...vals, goalW || Infinity) - 1;
            const chartMax = Math.max(...vals, goalW || -Infinity) + 1;
            const chartRange = chartMax - chartMin || 1;
            const px = (i) => 40 + (i / (entries.length - 1)) * (W - 50);
            const py = (w) => H - ((w - chartMin) / chartRange) * (H - 16) - 2;
            return (
              <>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"var(--accent)", marginBottom:6 }}>Evolución de peso</div>
                <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 8px 8px", marginBottom:12 }}>
                  <svg width="100%" viewBox={`0 0 ${W+4} ${H+36}`} style={{ display:"block" }}>
                    {[0,0.25,0.5,0.75,1].map(t => {
                      const y = py(chartMin + t * chartRange);
                      return <g key={t}>
                        <line x1={40} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4"/>
                        <text x={34} y={y+4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{(chartMin + t*chartRange).toFixed(1)}</text>
                      </g>;
                    })}
                    {goalW && (
                      <g>
                        <line x1={40} y1={py(goalW)} x2={W} y2={py(goalW)} stroke="#a855f7" strokeWidth={1.5} strokeDasharray="6 3"/>
                        <text x={W+2} y={py(goalW)+4} fill="#a855f7" fontSize={9} fontWeight={700}>Meta</text>
                      </g>
                    )}
                    <polygon points={[...entries.map((e,i)=>`${px(i)},${py(e.weight)}`), `${px(entries.length-1)},${H}`,`${px(0)},${H}`].join(" ")} fill="rgba(59,130,246,0.07)"/>
                    <polyline points={entries.map((e,i)=>`${px(i)},${py(e.weight)}`).join(" ")} fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                    {entries.map((e,i) => {
                      const x = px(i); const y = py(e.weight);
                      const isFirst = i === 0, isLast = i === entries.length - 1;
                      const prev = entries[i-1];
                      const trend = prev ? (e.weight < prev.weight ? "down" : e.weight > prev.weight ? "up" : "same") : "same";
                      const dotColor = isLast ? "#22c55e" : trend === "down" ? "#22c55e" : trend === "up" ? "#f97316" : "var(--accent)";
                      return <g key={i}>
                        <circle cx={x} cy={y} r={isLast||isFirst ? 5 : 3.5} fill={dotColor} stroke="var(--card)" strokeWidth={1.5}/>
                        {(isLast || isFirst) && <text x={x} y={y-10} textAnchor="middle" fill={dotColor} fontSize={10} fontWeight={700}>{e.weight}kg</text>}
                        <text x={x} y={H+20} textAnchor="middle" fill="var(--text-muted)" fontSize={8}>{fmtDate(e.date)}</text>
                      </g>;
                    })}
                  </svg>
                </div>
              </>
            );
          })()}

          {entries.length > 0 && (
            <div style={{ maxHeight:160, overflowY:"auto" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:6 }}>Historial de registros</div>
              {[...entries].reverse().map((e, i) => {
                const realIdx = entries.length - 1 - i;
                const prev = entries[realIdx - 1];
                const diff = prev ? Math.round((e.weight - prev.weight) * 10) / 10 : null;
                return (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 4px", borderBottom:"1px solid var(--border)", fontSize:13 }}>
                    <span style={{ color:"var(--text-muted)" }}>{fmtDate(e.date)}</span>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      {diff !== null && (
                        <span style={{ fontSize:11, fontWeight:600, color: diff < 0 ? "#22c55e" : diff > 0 ? "#f97316" : "var(--text-muted)" }}>
                          {diff > 0 ? "+" : ""}{diff} kg
                        </span>
                      )}
                      <span style={{ fontWeight:700 }}>{e.weight} kg</span>
                      <button onClick={() => {
                        askConfirm(`¿Eliminar el registro de ${e.weight}kg del ${fmtDate(e.date)}?`, () => {
                          const newEntries = entries.filter((_, j) => j !== realIdx);
                          onSave({ ...stats, entries: newEntries });
                        });
                      }} style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:14, padding:"2px 4px", opacity:0.6, lineHeight:1 }} title="Eliminar registro">🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {entries.length===0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center" }}>Aún no hay registros de peso.</p>}
        </>)}

        {/* FOTOS TAB */}

      </div>
      {confirmModal}
    </div>
  );
}