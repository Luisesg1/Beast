import { useState, useEffect } from "react";
import { getPRs } from "../utils/gymCalcs";
import { EXERCISE_DB } from "../exerciseDb";
import { calcSessionVolume, getStreak } from "../utils/gymCalcs";

const SEEN_KEY = "gym_badges_seen";

function getSeenBadges() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
}
function markBadgesSeen(ids) {
  try {
    const seen = getSeenBadges();
    ids.forEach(id => seen.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
}

// ─── Badge definitions ────────────────────────────────────────────────────────
export const BADGE_DEFS = [
  // ⭐ NIVEL 1 — Bronce
  { id: "first",       stars: 1, icon: "🏋️", name: "Primera sesión",      desc: "Completaste tu primera sesión",                    check: (s) => s.length >= 1 },
  { id: "sessions5",   stars: 1, icon: "🔥", name: "En racha",             desc: "5 sesiones completadas",                           check: (s) => s.length >= 5 },
  { id: "pr1",         stars: 1, icon: "⭐", name: "Primer PR",            desc: "Superaste un récord personal",                     check: (s, prs) => Object.keys(prs).length >= 1 },
  { id: "variety10",   stars: 1, icon: "🎯", name: "Explorador",           desc: "10 ejercicios distintos registrados",               check: (s) => new Set(s.flatMap(x => (x.exercises||[]).map(e=>e.name))).size >= 10 },
  { id: "streak3",     stars: 1, icon: "🔑", name: "3 semanas seguidas",   desc: "Cumpliste tu meta 3 semanas consecutivas",          check: (s) => getStreak(s) >= 3 },
  { id: "sunday",      stars: 1, icon: "☀️", name: "Dominguero",           desc: "Entrenaste un domingo",                            check: (s) => s.some(x => new Date(x.date+"T00:00:00").getDay() === 0) },
  { id: "holiday",     stars: 1, icon: "🎉", name: "Sin excusas",          desc: "Entrenaste en día 1 de enero o 25 dic",            check: (s) => s.some(x => { const d=new Date(x.date+"T00:00:00"); return (d.getMonth()===0&&d.getDate()===1)||(d.getMonth()===11&&d.getDate()===25); }) },
  { id: "minimalist",  stars: 1, icon: "🔬", name: "Minimalista",          desc: "Sesión completa con solo 3 ejercicios",            check: (s) => s.some(x => (x.exercises||[]).length === 3) },
  // IA
  { id: "ai_first",    stars: 1, icon: "🤖", name: "Hola, Coach IA",       desc: "Habla por primera vez con tu entrenador virtual",   check: (s, prs, u, ex) => (ex?.aiUses||0) >= 1 },
  // Teams
  { id: "team_first",  stars: 1, icon: "🏘️", name: "Primer equipo",        desc: "Únete a tu primer equipo. ¡Juntos se llega más lejos!", check: (s, prs, u) => !!u?.teamId },
  // Coach
  { id: "coach_first", stars: 1, icon: "📋", name: "Primera victoria",     desc: "Completa tu primera rutina asignada por un coach", check: (s) => s.some(x => !!x.coachRoutineDocId) },
  // Foto
  { id: "photo_first", stars: 1, icon: "📸", name: "Sin miedo a la cámara", desc: "Sube tu primera foto de progreso. ¡El cambio comienza hoy!", check: (s, prs, u, ex) => (ex?.photoCount||0) >= 1 },

  // ⭐⭐ NIVEL 2 — Plata
  { id: "sessions10",  stars: 2, icon: "💪", name: "Dedicado",             desc: "10 sesiones completadas",                          check: (s) => s.length >= 10 },
  { id: "sessions25",  stars: 2, icon: "🦾", name: "Consistente",          desc: "25 sesiones completadas",                          check: (s) => s.length >= 25 },
  { id: "sessions50",  stars: 2, icon: "🏅", name: "Veterano",             desc: "50 sesiones completadas",                          check: (s) => s.length >= 50 },
  { id: "pr5",         stars: 2, icon: "🌟", name: "Máquina de PRs",       desc: "5 PRs en ejercicios distintos",                    check: (s, prs) => Object.keys(prs).length >= 5 },
  { id: "streak7",     stars: 2, icon: "🗓️", name: "2 meses seguidos",     desc: "Cumpliste tu meta 7 semanas consecutivas",          check: (s) => getStreak(s) >= 7 },
  { id: "heavy",       stars: 2, icon: "🏗️", name: "Pesado",              desc: "Registraste 100kg+ en un ejercicio",               check: (s) => s.some(x => (x.exercises||[]).some(e => parseFloat(e.weight)>=100 || (e.sets||[]).some(st=>parseFloat(st.weight)>=100))) },
  { id: "streak14",    stars: 2, icon: "🔥", name: "En llamas",            desc: "Cumpliste tu meta 14 semanas consecutivas",         check: (s) => getStreak(s) >= 14 },
  { id: "beast5in7",   stars: 2, icon: "⚡", name: "Modo bestia",          desc: "5 sesiones en 7 días",                             check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); return s.filter(x=>new Date(x.date+"T00:00:00")>=w).length>=5; } },
  { id: "variety25",   stars: 2, icon: "🧭", name: "Variado",              desc: "25 ejercicios distintos registrados",               check: (s) => new Set(s.flatMap(x=>(x.exercises||[]).map(e=>e.name))).size>=25 },
  { id: "volume_ses",  stars: 2, icon: "💥", name: "Volumen serio",        desc: "10.000 kg movidos en una sesión",                  check: (s) => s.some(x=>calcSessionVolume(x)>=10000) },
  // IA
  { id: "ai_5",        stars: 2, icon: "🤖", name: "Preguntón fitness",    desc: "5 preguntas al Coach IA. La curiosidad también quema calorías 😉", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 5 },
  // Teams
  { id: "team_reto",   stars: 2, icon: "⚔️", name: "Espíritu competitivo", desc: "Participa en tu primer reto. ¡Que empiece el juego! 🔥", check: (s, prs, u) => !!u?.teamId },
  // Coach
  { id: "coach_3",     stars: 2, icon: "💪", name: "En marcha",            desc: "Completa 3 rutinas asignadas por tu coach",        check: (s) => s.filter(x=>!!x.coachRoutineDocId).length >= 3 },
  // Foto
  { id: "photo_3",     stars: 2, icon: "📷", name: "Registro activo",      desc: "Sube 3 fotos de progreso. ¡Documentando tu evolución!", check: (s, prs, u, ex) => (ex?.photoCount||0) >= 3 },

  // ⭐⭐⭐ NIVEL 3 — Oro
  { id: "sessions100", stars: 3, icon: "💯", name: "Leyenda",              desc: "100 sesiones completadas",                         check: (s) => s.length >= 100 },
  { id: "pr10",        stars: 3, icon: "🏆", name: "Rompe récords",        desc: "PR en 10 ejercicios distintos",                    check: (s, prs) => Object.keys(prs).length >= 10 },
  { id: "streak30",    stars: 3, icon: "🔥", name: "Disciplina total",     desc: "Cumpliste tu meta 30 semanas consecutivas",         check: (s) => getStreak(s) >= 30 },
  { id: "leg20",       stars: 3, icon: "🦵", name: "Piernas de acero",     desc: "20 sesiones de pierna",                            check: (s) => s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral","Glúteos","Pantorrillas"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length>=20 },
  { id: "chest20",     stars: 3, icon: "💪", name: "Rey del press",        desc: "20 sesiones de pecho",                             check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Pecho")).length>=20 },
  { id: "back20",      stars: 3, icon: "🏋️", name: "Espalda ancha",       desc: "20 sesiones de espalda",                           check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Espalda")).length>=20 },
  { id: "core15",      stars: 3, icon: "🪨", name: "Core de piedra",       desc: "15 sesiones con trabajo abdominal",                check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Core")).length>=15 },
  { id: "balanced",    stars: 3, icon: "⚖️", name: "Equilibrado",         desc: "Todos los grupos musculares en 1 semana",          check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); const ms=new Set(s.filter(x=>new Date(x.date+"T00:00:00")>=w).flatMap(x=>(x.exercises||[]).map(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle)).filter(Boolean)); return ["Pecho","Espalda","Cuádriceps","Core","Hombros"].every(m=>ms.has(m)); } },
  { id: "variety50",   stars: 3, icon: "🎓", name: "Maestro técnico",      desc: "50 ejercicios distintos registrados",               check: (s) => new Set(s.flatMap(x=>(x.exercises||[]).map(e=>e.name))).size>=50 },
  { id: "90days",      stars: 3, icon: "🧬", name: "Nueva versión",        desc: "90 días de actividad acumulada",                   check: (s) => { const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); if(sorted.length<30) return false; const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); return (last-first)/86400000>=90; } },
  { id: "vol_100k",    stars: 3, icon: "📦", name: "Toneladas movidas",    desc: "100.000 kg acumulados en total",                   check: (s) => s.reduce((acc,x)=>acc+calcSessionVolume(x),0)>=100000 },
  { id: "perfect_mo",  stars: 3, icon: "📅", name: "Mes perfecto",         desc: "Entrenaste 20+ días en un mes",                    check: (s) => { const byMonth = {}; s.forEach(x => { const k = x.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1; }); return Object.values(byMonth).some(c => c >= 20); } },
  // IA
  { id: "ai_expert",   stars: 3, icon: "🧠", name: "Modo experto activado", desc: "Usaste el Coach IA 20 veces. ¡Constancia digital, resultados reales!", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 20 },
  // Coach
  { id: "coach_week",  stars: 3, icon: "🏆", name: "Sin excusas",          desc: "5 rutinas de coach completadas en una semana",     check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); return s.filter(x=>!!x.coachRoutineDocId&&new Date(x.date+"T00:00:00")>=w).length>=5; } },
  // Foto
  { id: "photo_antes", stars: 3, icon: "🔄", name: "Antes y después",      desc: "Sube fotos en diferentes momentos. ¡El cambio es real!", check: (s, prs, u, ex) => (ex?.photoCount||0) >= 5 },

  // ⭐⭐⭐⭐ NIVEL 4 — Platino
  { id: "sessions200", stars: 4, icon: "🗡️", name: "Veterano del hierro",  desc: "200 sesiones completadas",                         check: (s) => s.length >= 200 },
  { id: "streak90",    stars: 4, icon: "💎", name: "90 semanas seguidas",   desc: "Cumpliste tu meta 90 semanas consecutivas",         check: (s) => getStreak(s) >= 90 },
  { id: "180days",     stars: 4, icon: "🔮", name: "Cambio real",           desc: "180 días de actividad acumulada",                   check: (s) => { const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); if(sorted.length<60) return false; const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); return (last-first)/86400000>=180; } },
  { id: "leg100",      stars: 4, icon: "🦾", name: "Especialista piernas",  desc: "100 sesiones de pierna",                           check: (s) => s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral","Glúteos","Pantorrillas"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length>=100 },
  { id: "sessions500", stars: 4, icon: "⚔️", name: "500 batallas",          desc: "500 sesiones completadas",                         check: (s) => s.length >= 500 },
  { id: "6months",     stars: 4, icon: "🔱", name: "Medio año imparable",   desc: "6 meses con 12+ sesiones cada uno",                check: (s) => { let c=0; for(let i=0;i<6;i++){const d=new Date(); d.setMonth(d.getMonth()-i); const m=d.getMonth(),y=d.getFullYear(); if(s.filter(x=>{const sd=new Date(x.date+"T00:00:00"); return sd.getMonth()===m&&sd.getFullYear()===y;}).length>=12) c++;} return c>=6; } },
  { id: "architect",   stars: 4, icon: "🏛️", name: "Arquitecto del físico", desc: "50+ sesiones de pecho, espalda y pierna",          check: (s) => { const ch=s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Pecho")).length; const ba=s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Espalda")).length; const le=s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length; return ch>=50&&ba>=50&&le>=50; } },
  { id: "reinvention", stars: 4, icon: "🔄", name: "Reinvención",           desc: "Volviste tras 3+ meses y completaste 30 sesiones", check: (s) => { if(s.length<31) return false; const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); for(let i=1;i<sorted.length;i++){const gap=(new Date(sorted[i].date+"T00:00:00")-new Date(sorted[i-1].date+"T00:00:00"))/86400000; if(gap>=90) return sorted.slice(i).length>=30;} return false; } },
  { id: "year_iron",   stars: 4, icon: "🏆", name: "Año de hierro",         desc: "12 meses distintos con sesiones registradas",      check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=12 },
  { id: "pr20",        stars: 4, icon: "👑", name: "Coleccionista de PRs",  desc: "PRs en 20 ejercicios distintos",                   check: (s, prs) => Object.keys(prs).length >= 20 },
  // IA
  { id: "ai_50",       stars: 4, icon: "🤖", name: "IAdependiente",         desc: "Usaste el Coach IA 50 veces. Admítelo: ya no puedes vivir sin él 😎", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 50 },
  // Teams
  { id: "team_alma",   stars: 4, icon: "🏅", name: "Alma del equipo",       desc: "Llevas más de 10 sesiones siendo parte de un equipo. ¡Eres el motor del grupo!", check: (s, prs, u) => !!u?.teamId && s.length >= 10 },
  // Coach
  { id: "coach_15",    stars: 4, icon: "🐯", name: "Modo bestia",           desc: "15 rutinas de coach completadas. ¡Tu cuerpo ya lo nota!",  check: (s) => s.filter(x=>!!x.coachRoutineDocId).length >= 15 },
  // Foto
  { id: "photo_mes",   stars: 4, icon: "🗓️", name: "Archivo fitness",       desc: "10 fotos de progreso subidas. ¡Tu disciplina se ve!",  check: (s, prs, u, ex) => (ex?.photoCount||0) >= 10 },

  // ⭐⭐⭐⭐⭐ NIVEL 5 — Legendario
  { id: "sessions1000",stars: 5, icon: "💀", name: "Mil batallas",          desc: "1000 sesiones registradas",                        check: (s) => s.length >= 1000 },
  { id: "streak365",   stars: 5, icon: "🌞", name: "365 semanas seguidas",  desc: "Cumpliste tu meta 365 semanas consecutivas",        check: (s) => getStreak(s) >= 365 },
  { id: "year_full",   stars: 5, icon: "💫", name: "Transformación total",  desc: "1 año sin pausas mayores a 2 semanas",             check: (s) => { if(s.length<100) return false; const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); if((last-first)/86400000<365) return false; for(let i=1;i<sorted.length;i++){if((new Date(sorted[i].date+"T00:00:00")-new Date(sorted[i-1].date+"T00:00:00"))/86400000>14) return false;} return true; } },
  { id: "5years",      stars: 5, icon: "🏟️", name: "Leyenda del gimnasio", desc: "5 años activo (60 meses con sesiones)",            check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=60 },
  { id: "10years",     stars: 5, icon: "🔮", name: "ADN de hierro",         desc: "10 años registrado (120 meses)",                   check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=120 },
  { id: "icon10k",     stars: 5, icon: "⚜️", name: "Ícono eterno",          desc: "10.000 sesiones registradas",                      check: (s) => s.length >= 10000 },
  { id: "vol_1m",      stars: 5, icon: "🌍", name: "Un millón de kilos",    desc: "1.000.000 kg acumulados en total",                  check: (s) => s.reduce((acc,x)=>acc+calcSessionVolume(x),0)>=1000000 },
  { id: "iron_gen",    stars: 5, icon: "🧬", name: "Generación hierro",     desc: "3 años entrenando 3+ veces/semana",                check: (s) => { const ref=new Date(); ref.setFullYear(ref.getFullYear()-3); const recent=s.filter(x=>new Date(x.date+"T00:00:00")>=ref); const weeks={}; recent.forEach(x=>{const d=new Date(x.date+"T00:00:00"); const wk=Math.floor((d-ref)/604800000); weeks[wk]=(weeks[wk]||0)+1;}); return Object.values(weeks).filter(c=>c>=3).length>=125; } },
  // IA
  { id: "ai_legend",   stars: 5, icon: "🧬", name: "Confidente del hierro", desc: "Usaste el Coach IA 100 veces. ¡Tu progreso empieza en la mente!", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 100 },
  // Teams
  { id: "team_legend", stars: 5, icon: "🏆", name: "Leyenda del squad",     desc: "Llevas más de 50 sesiones siendo parte de un equipo. ¡Gloria compartida!", check: (s, prs, u) => !!u?.teamId && s.length >= 50 },
  // Coach
  { id: "coach_50",    stars: 5, icon: "🔥", name: "Máquina imparable",     desc: "50 rutinas de coach completadas. ¡Eres pura consistencia!",  check: (s) => s.filter(x=>!!x.coachRoutineDocId).length >= 50 },
  // Foto
  { id: "photo_legend",stars: 5, icon: "✨", name: "Transformación legendaria", desc: "20 fotos de progreso subidas. ¡Inspiración total!",  check: (s, prs, u, ex) => (ex?.photoCount||0) >= 20 },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BadgesModal({ sessions, bodyStats, user, extras = {}, onClose }) {
  const prs = getPRs(sessions);
  const [filterLevel, setFilterLevel] = useState(0);
  const [seenSnapshot] = useState(() => {
    const s = getSeenBadges();
    return s;
  });

  const starColors = {
    1: { bg:"rgba(148,163,184,0.1)", border:"rgba(148,163,184,0.4)", color:"#94a3b8", label:"Bronce" },
    2: { bg:"rgba(234,179,8,0.1)",   border:"rgba(234,179,8,0.4)",   color:"#eab308", label:"Plata" },
    3: { bg:"rgba(59,130,246,0.1)",  border:"rgba(59,130,246,0.4)",  color:"#3b82f6", label:"Oro" },
    4: { bg:"rgba(168,85,247,0.12)", border:"rgba(168,85,247,0.5)",  color:"#a855f7", label:"Platino" },
    5: { bg:"rgba(245,158,11,0.15)", border:"rgba(245,158,11,0.6)",  color:"#f59e0b", label:"Legendario" },
  };

  function Stars({ n }) {
    return (
      <div style={{ display:"flex", gap:2, justifyContent:"center" }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ fontSize:10, opacity: i<=n ? 1 : 0.18 }}>⭐</span>
        ))}
      </div>
    );
  }

  const allBadges = BADGE_DEFS.map(b => ({
    ...b,
    unlocked: b.check(sessions, prs, user, extras),
  }));

  const unlockedIds = allBadges.filter(b => b.unlocked).map(b => b.id);
  const newBadges = unlockedIds.filter(id => !seenSnapshot.has(id));

  useEffect(() => {
    markBadgesSeen(unlockedIds);
  }, []);

  const shown    = filterLevel === 0 ? allBadges : allBadges.filter(b => b.stars === filterLevel);
  const earned   = shown.filter(b => b.unlocked);
  const locked   = shown.filter(b => !b.unlocked);
  const totalEarned = allBadges.filter(b => b.unlocked).length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🏅 Logros</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Progreso global */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <div style={{ flex:"0 0 auto", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:12, padding:"10px 18px", textAlign:"center" }}>
            <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:30, fontWeight:800, color:"#f59e0b", lineHeight:1 }}>{totalEarned}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)" }}>de {BADGE_DEFS.length} logros</div>
          </div>
          <div style={{ flex:1, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"10px 16px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6 }}>
              <span style={{ color:"var(--text-muted)" }}>Progreso general</span>
              <span style={{ fontWeight:700, color:"var(--accent)" }}>{Math.round((totalEarned/BADGE_DEFS.length)*100)}%</span>
            </div>
            <div style={{ height:8, background:"var(--border)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"linear-gradient(90deg,#f59e0b,#a855f7)", width:`${(totalEarned/BADGE_DEFS.length)*100}%`, borderRadius:4, transition:"width 0.6s" }} />
            </div>
          </div>
        </div>

        {/* Filtros por nivel */}
        <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
          <button className={`muscle-chip ${filterLevel===0?"active":""}`} style={{ fontSize:12 }} onClick={() => setFilterLevel(0)}>Todos</button>
          {[1,2,3,4,5].map(n => {
            const sc = starColors[n];
            const cnt = allBadges.filter(b=>b.stars===n&&b.unlocked).length;
            const tot = allBadges.filter(b=>b.stars===n).length;
            return (
              <button key={n} onClick={() => setFilterLevel(filterLevel===n ? 0 : n)} style={{
                background: filterLevel===n ? sc.bg : "none",
                border: `1px solid ${filterLevel===n ? sc.border : "var(--border)"}`,
                color: filterLevel===n ? sc.color : "var(--text-muted)",
                borderRadius:20, padding:"5px 12px", cursor:"pointer",
                fontFamily:"Barlow,sans-serif", fontSize:12, fontWeight:600,
                display:"flex", alignItems:"center", gap:5, transition:"all 0.2s",
              }}>
                {"⭐".repeat(n)} <span style={{ opacity:0.7 }}>{cnt}/{tot}</span>
              </button>
            );
          })}
        </div>

        {/* Desbloqueados */}
        {earned.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase", marginBottom:12 }}>Desbloqueados ✨ ({earned.length})</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(148px,1fr))", gap:10, marginBottom:24 }}>
              {earned.map(b => {
                const sc = starColors[b.stars];
                const isNew = newBadges.includes(b.id);
                return (
                  <div key={b.id} style={{ position:"relative", background:sc.bg, border:`1px solid ${isNew ? "#e8ff00" : sc.border}`, borderRadius:14, padding:"14px 12px", textAlign:"center", boxShadow: isNew ? "0 0 16px rgba(232,255,0,0.2)" : "none" }}>
                    {isNew && (
                      <div style={{ position:"absolute", top:-8, right:-8, background:"#e8ff00", color:"#000", fontSize:9, fontWeight:900, padding:"2px 7px", borderRadius:20, letterSpacing:1, textTransform:"uppercase" }}>
                        NUEVO
                      </div>
                    )}
                    <div style={{ fontSize:32, marginBottom:5 }}>{b.icon}</div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:3, lineHeight:1.3 }}>{b.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)", lineHeight:1.4, marginBottom:7 }}>{b.desc}</div>
                    <Stars n={b.stars} />
                    <div style={{ fontSize:9, color:sc.color, fontWeight:700, marginTop:4, textTransform:"uppercase", letterSpacing:1 }}>{sc.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Bloqueados */}
        {locked.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:12 }}>Por desbloquear 🔒 ({locked.length})</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(148px,1fr))", gap:10 }}>
              {locked.map(b => {
                const sc = starColors[b.stars];
                return (
                  <div key={b.id} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:14, padding:"14px 12px", textAlign:"center", opacity:0.5 }}>
                    <div style={{ fontSize:32, marginBottom:5, filter:"grayscale(1)" }}>{b.icon}</div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:3, lineHeight:1.3 }}>{b.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)", lineHeight:1.4, marginBottom:7 }}>{b.desc}</div>
                    <Stars n={b.stars} />
                    <div style={{ fontSize:9, color:sc.color, fontWeight:700, marginTop:4, textTransform:"uppercase", letterSpacing:1 }}>{sc.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Exportar función para saber cuántos logros nuevos hay (para el contador en App.jsx)
export function getNewBadgesCount(sessions, prs, user, extras = {}) {
  const seen = getSeenBadges();
  return BADGE_DEFS.filter(b => b.check(sessions, prs, user, extras) && !seen.has(b.id)).length;
}