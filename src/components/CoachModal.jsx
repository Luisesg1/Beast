import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./ConfirmModal";
import { doc, getDoc, setDoc, collection, getDocs, getDocsFromServer, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";



import { EXERCISE_DB, MUSCLES, registerCustomExercise } from "../exerciseDb";
import { calc1RM, getPRs } from "../utils/gymCalcs";
import { getFunctions, httpsCallable } from "firebase/functions";

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);
const DAYS_ES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const numDot = (v, max = 9999) => { const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); const n = parseFloat(s); if (isNaN(n) || n < 0) return ""; return n > max ? String(max) : s; };
const numWeight = (v) => numDot(v, 500);
const numReps   = (v) => numDot(v, 100);
const lettersOnly = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");


function calcSessionVolume(session) {
  return (session.exercises || []).reduce((acc, ex) => {
    if (ex.sets?.length > 0) {
      return acc + ex.sets.reduce((s, st) => s + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||1), 0);
    }
    return acc + (parseFloat(ex.weight)||0) * (parseFloat(ex.reps)||1);
  }, 0);
}

function getStreak(sessions, weeklyTarget = 3) {
  if (!sessions || sessions.length === 0) return 0;
  // Get the Monday of a given date
  const getMonday = (d) => {
    const date = new Date(d); date.setHours(0,0,0,0);
    const day = date.getDay(); // 0=Sun
    const diff = (day === 0 ? -6 : 1 - day);
    date.setDate(date.getDate() + diff);
    return date;
  };
  const toKey = (d) => d.toISOString().slice(0, 10);

  // Count sessions per week (keyed by Monday date)
  const weekMap = {};
  sessions.forEach(s => {
    const mon = toKey(getMonday(new Date(s.date + "T00:00:00")));
    weekMap[mon] = (weekMap[mon] || 0) + 1;
  });

  // Walk backwards week by week from current week
  const today = new Date(); today.setHours(0,0,0,0);
  let cursor = getMonday(today);
  let streak = 0;

  while (true) {
    const key = toKey(cursor);
    const count = weekMap[key] || 0;
    const isCurrentWeek = key === toKey(getMonday(today));

    if (count >= weeklyTarget) {
      streak++;
    } else if (isCurrentWeek) {
      // Current week not yet completed — don't break, just don't count it
    } else {
      break;
    }

    // Go to previous week
    cursor.setDate(cursor.getDate() - 7);
    // Safety: stop after 10 years
    if (streak > 520) break;
  }

  return streak;
}


const BADGE_DEFS = [
  // ⭐ NIVEL 1 — Bronce
  { id: "first",      stars: 1, icon: "🏋️", name: "Primera sesión",     desc: "Completaste tu primera sesión",           check: (s) => s.length >= 1 },
  { id: "sessions5",  stars: 1, icon: "🔥", name: "En racha",            desc: "5 sesiones completadas",                  check: (s) => s.length >= 5 },
  { id: "pr1",        stars: 1, icon: "⭐", name: "Primer PR",           desc: "Superaste un récord personal",            check: (s, prs) => Object.keys(prs).length >= 1 },
  { id: "variety10",  stars: 1, icon: "🎯", name: "Explorador",          desc: "10 ejercicios distintos registrados",     check: (s) => new Set(s.flatMap(x => (x.exercises||[]).map(e=>e.name))).size >= 10 },
  { id: "streak3",    stars: 1, icon: "🔑", name: "3 semanas seguidas",   desc: "Cumpliste tu meta 3 semanas consecutivas",    check: (s) => getStreak(s) >= 3 },
  { id: "sunday",     stars: 1, icon: "☀️", name: "Dominguero",          desc: "Entrenaste un domingo",                   check: (s) => s.some(x => new Date(x.date+"T00:00:00").getDay() === 0) },
  { id: "holiday",    stars: 1, icon: "🎉", name: "Sin excusas",         desc: "Entrenaste en día 1 de enero o 25 dic",  check: (s) => s.some(x => { const d=new Date(x.date+"T00:00:00"); return (d.getMonth()===0&&d.getDate()===1)||(d.getMonth()===11&&d.getDate()===25); }) },
  { id: "minimalist", stars: 1, icon: "🔬", name: "Minimalista",         desc: "Sesión completa con solo 3 ejercicios",  check: (s) => s.some(x => (x.exercises||[]).length === 3) },

  // ⭐⭐ NIVEL 2 — Plata
  { id: "sessions10", stars: 2, icon: "💪", name: "Dedicado",            desc: "10 sesiones completadas",                 check: (s) => s.length >= 10 },
  { id: "sessions25", stars: 2, icon: "🦾", name: "Consistente",         desc: "25 sesiones completadas",                 check: (s) => s.length >= 25 },
  { id: "sessions50", stars: 2, icon: "🏅", name: "Veterano",            desc: "50 sesiones completadas",                 check: (s) => s.length >= 50 },
  { id: "pr5",        stars: 2, icon: "🌟", name: "Máquina de PRs",      desc: "5 PRs en ejercicios distintos",           check: (s, prs) => Object.keys(prs).length >= 5 },
  { id: "streak7",    stars: 2, icon: "🗓️", name: "2 meses seguidos",    desc: "Cumpliste tu meta 7 semanas consecutivas",    check: (s) => getStreak(s) >= 7 },
  { id: "heavy",      stars: 2, icon: "🏗️", name: "Pesado",             desc: "Registraste 100kg+ en un ejercicio",      check: (s) => s.some(x => (x.exercises||[]).some(e => parseFloat(e.weight)>=100 || (e.sets||[]).some(st=>parseFloat(st.weight)>=100))) },
  { id: "streak14",   stars: 2, icon: "🔥", name: "En llamas",           desc: "Cumpliste tu meta 14 semanas consecutivas",  check: (s) => getStreak(s) >= 14 },
  { id: "beast5in7",  stars: 2, icon: "⚡", name: "Modo bestia",         desc: "5 sesiones en 7 días",                    check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); return s.filter(x=>new Date(x.date+"T00:00:00")>=w).length>=5; } },
  { id: "variety25",  stars: 2, icon: "🧭", name: "Variado",             desc: "25 ejercicios distintos registrados",     check: (s) => new Set(s.flatMap(x=>(x.exercises||[]).map(e=>e.name))).size>=25 },
  { id: "volume_ses", stars: 2, icon: "💥", name: "Volumen serio",       desc: "10.000 kg movidos en una sesión",         check: (s) => s.some(x=>calcSessionVolume(x)>=10000) },
  { id: "early5",     stars: 2, icon: "🌅", name: "Madrugador",          desc: "5 sesiones registradas antes de las 8am", check: (s) => false },
  { id: "night",      stars: 2, icon: "🦉", name: "Ave nocturna",        desc: "Sesión registrada después de las 10pm",  check: (s) => false },

  // ⭐⭐⭐ NIVEL 3 — Oro
  { id: "sessions100",stars: 3, icon: "💯", name: "Leyenda",             desc: "100 sesiones completadas",                check: (s) => s.length >= 100 },
  { id: "pr10",       stars: 3, icon: "🏆", name: "Rompe récords",       desc: "PR en 10 ejercicios distintos",           check: (s, prs) => Object.keys(prs).length >= 10 },
  { id: "streak30",   stars: 3, icon: "🔥", name: "Disciplina total",    desc: "Cumpliste tu meta 30 semanas consecutivas",  check: (s) => getStreak(s) >= 30 },
  { id: "leg20",      stars: 3, icon: "🦵", name: "Piernas de acero",    desc: "20 sesiones de pierna",                   check: (s) => s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral","Glúteos","Pantorrillas"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length>=20 },
  { id: "chest20",    stars: 3, icon: "💪", name: "Rey del press",       desc: "20 sesiones de pecho",                    check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Pecho")).length>=20 },
  { id: "back20",     stars: 3, icon: "🏋️", name: "Espalda ancha",      desc: "20 sesiones de espalda",                  check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Espalda")).length>=20 },
  { id: "core15",     stars: 3, icon: "🪨", name: "Core de piedra",      desc: "15 sesiones con trabajo abdominal",       check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Core")).length>=15 },
  { id: "balanced",   stars: 3, icon: "⚖️", name: "Equilibrado",        desc: "Todos los grupos musculares en 1 semana", check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); const ms=new Set(s.filter(x=>new Date(x.date+"T00:00:00")>=w).flatMap(x=>(x.exercises||[]).map(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle)).filter(Boolean)); return ["Pecho","Espalda","Cuádriceps","Core","Hombros"].every(m=>ms.has(m)); } },
  { id: "variety50",  stars: 3, icon: "🎓", name: "Maestro técnico",     desc: "50 ejercicios distintos registrados",     check: (s) => new Set(s.flatMap(x=>(x.exercises||[]).map(e=>e.name))).size>=50 },
  { id: "90days",     stars: 3, icon: "🧬", name: "Nueva versión",       desc: "90 días de actividad acumulada",          check: (s) => { const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); if(sorted.length<30) return false; const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); return (last-first)/86400000>=90; } },
  { id: "vol_100k",   stars: 3, icon: "📦", name: "Toneladas movidas",   desc: "100.000 kg acumulados en total",          check: (s) => s.reduce((acc,x)=>acc+calcSessionVolume(x),0)>=100000 },
  { id: "perfect_mo", stars: 3, icon: "📅", name: "Mes perfecto",        desc: "Entrenaste 20+ días en un mes",           check: (s) => { const m=new Date().getMonth(),y=new Date().getFullYear(); return s.filter(x=>{const d=new Date(x.date+"T00:00:00"); return d.getMonth()===m&&d.getFullYear()===y;}).length>=20; } },

  // ⭐⭐⭐⭐ NIVEL 4 — Platino
  { id: "sessions200",stars: 4, icon: "🗡️", name: "Veterano del hierro", desc: "200 sesiones completadas",               check: (s) => s.length >= 200 },
  { id: "streak90",   stars: 4, icon: "💎", name: "90 semanas seguidas", desc: "Cumpliste tu meta 90 semanas consecutivas",  check: (s) => getStreak(s) >= 90 },
  { id: "180days",    stars: 4, icon: "🔮", name: "Cambio real",         desc: "180 días de actividad acumulada",         check: (s) => { const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); if(sorted.length<60) return false; const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); return (last-first)/86400000>=180; } },
  { id: "leg100",     stars: 4, icon: "🦾", name: "Especialista piernas", desc: "100 sesiones de pierna",                 check: (s) => s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral","Glúteos","Pantorrillas"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length>=100 },
  { id: "sessions500",stars: 4, icon: "⚔️", name: "500 batallas",        desc: "500 sesiones completadas",               check: (s) => s.length >= 500 },
  { id: "6months",    stars: 4, icon: "🔱", name: "Medio año imparable", desc: "6 meses con 12+ sesiones cada uno",       check: (s) => { let c=0; for(let i=0;i<6;i++){const d=new Date(); d.setMonth(d.getMonth()-i); const m=d.getMonth(),y=d.getFullYear(); if(s.filter(x=>{const sd=new Date(x.date+"T00:00:00"); return sd.getMonth()===m&&sd.getFullYear()===y;}).length>=12) c++;} return c>=6; } },
  { id: "architect",  stars: 4, icon: "🏛️", name: "Arquitecto del físico", desc: "50+ sesiones de pecho, espalda y pierna", check: (s) => { const ch=s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Pecho")).length; const ba=s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Espalda")).length; const le=s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length; return ch>=50&&ba>=50&&le>=50; } },
  { id: "reinvention",stars: 4, icon: "🔄", name: "Reinvención",         desc: "Volviste tras 3+ meses y completaste 30 sesiones", check: (s) => { if(s.length<31) return false; const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); for(let i=1;i<sorted.length;i++){const gap=(new Date(sorted[i].date+"T00:00:00")-new Date(sorted[i-1].date+"T00:00:00"))/86400000; if(gap>=90) return sorted.slice(i).length>=30;} return false; } },
  { id: "year_iron",  stars: 4, icon: "🏆", name: "Año de hierro",       desc: "12 meses distintos con sesiones registradas", check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=12 },
  { id: "pr20",       stars: 4, icon: "👑", name: "Coleccionista de PRs", desc: "PRs en 20 ejercicios distintos",         check: (s, prs) => Object.keys(prs).length >= 20 },

  // ⭐⭐⭐⭐⭐ NIVEL 5 — Legendario
  { id: "sessions1000",stars:5, icon: "💀", name: "Mil batallas",        desc: "1000 sesiones registradas",               check: (s) => s.length >= 1000 },
  { id: "streak365",  stars: 5, icon: "🌞", name: "365 semanas seguidas", desc: "Cumpliste tu meta 365 semanas consecutivas", check: (s) => getStreak(s) >= 365 },
  { id: "year_full",  stars: 5, icon: "💫", name: "Transformación total", desc: "1 año sin pausas mayores a 2 semanas",   check: (s) => { if(s.length<100) return false; const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); if((last-first)/86400000<365) return false; for(let i=1;i<sorted.length;i++){if((new Date(sorted[i].date+"T00:00:00")-new Date(sorted[i-1].date+"T00:00:00"))/86400000>14) return false;} return true; } },
  { id: "5years",     stars: 5, icon: "🏟️", name: "Leyenda del gimnasio", desc: "5 años activo (60 meses con sesiones)", check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=60 },
  { id: "10years",    stars: 5, icon: "🔮", name: "ADN de hierro",       desc: "10 años registrado (120 meses)",          check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=120 },
  { id: "icon10k",    stars: 5, icon: "⚜️", name: "Ícono eterno",        desc: "10.000 sesiones registradas",             check: (s) => s.length >= 10000 },
  { id: "vol_1m",     stars: 5, icon: "🌍", name: "Un millón de kilos",  desc: "1.000.000 kg acumulados en total",        check: (s) => s.reduce((acc,x)=>acc+calcSessionVolume(x),0)>=1000000 },
  { id: "iron_gen",   stars: 5, icon: "🧬", name: "Generación hierro",   desc: "3 años entrenando 3+ veces/semana",       check: (s) => { const ref=new Date(); ref.setFullYear(ref.getFullYear()-3); const recent=s.filter(x=>new Date(x.date+"T00:00:00")>=ref); const weeks={}; recent.forEach(x=>{const d=new Date(x.date+"T00:00:00"); const wk=Math.floor((d-ref)/604800000); weeks[wk]=(weeks[wk]||0)+1;}); return Object.values(weeks).filter(c=>c>=3).length>=125; } },
];

// registerCustomExercise is imported from ../exerciseDb

async function saveCustomExercise(name, muscle, coachUid) {
  try {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    // Escritura en subcolección privada del coach — no es visible para otros coaches
    await setDoc(doc(db, "coaches", coachUid, "custom_exercises", id), {
      name, muscle, equipment: "Personalizado", machine: false,
      gifUrl: "", createdAt: new Date().toISOString().slice(0, 10)
    }, { merge: true });
  } catch(e) {}
}

function compressImage(file, maxWidth = 300, quality = 0.7) {
  if (!file || !file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    // Safety timeout: if image never loads, resolve with null instead of hanging
    const timeout = setTimeout(() => { URL.revokeObjectURL(url); resolve(null); }, 10000);
    img.onload = () => {
      clearTimeout(timeout);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

async function unassignRoutineFromAthlete(athleteUid, routineId) {
  try {
    await deleteDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId));
    return true;
  } catch(e) { return false; }
}

async function getCoachProfile(uid) {
  try {
    const snap=await getDoc(doc(db,"coaches",uid));
    if (!snap.exists()) return null;
    const data=snap.data();
    const athletes = data.athletes
      ? Object.values(data.athletes).reduce((acc,a)=>{const k=a.email?.toLowerCase()||a.uid;if(!acc[k]||(a.addedAt||"")>(acc[k].addedAt||""))acc[k]=a;return acc;},{})
      : data.athletes;
    return { ...data, athletes };
  } catch(e){return null;}
}

async function createCoachProfile(uid, name, email) {
  const code = "COACH-" + Math.random().toString(36).slice(2,8).toUpperCase();
  const profile = { uid, name, email, code, athletes: {}, createdAt: todayStr() };
  try {
    await setDoc(doc(db, "coaches", uid), profile);
    await setDoc(doc(db, "users", uid), { isCoach: true }, { merge: true });
    return profile;
  } catch(e) { return null; }
}

async function getRoutinesByCoach(coachUid) {
  try {
    const snap = await getDocs(collection(db, "coaches", coachUid, "routines"));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch(e) { return []; }
}

async function saveCoachRoutine(coachUid, routine) {
  try {
    const ref = routine.id
      ? doc(db, "coaches", coachUid, "routines", routine.id)
      : doc(collection(db, "coaches", coachUid, "routines"));
    await setDoc(ref, { ...routine, id: ref.id, updatedAt: todayStr() });
    return ref.id;
  } catch(e) { return null; }
}

async function deleteCoachRoutine(coachUid, routineId) {
  try {
    await deleteDoc(doc(db, "coaches", coachUid, "routines", routineId));
    return true;
  } catch(e) { return false; }
}

async function assignRoutineToAthlete(coachUid, athleteEmail, routineId, routineName, dayOfWeek = -1) {
  try {
    const usersQ = query(collection(db, "users"), where("email", "==", athleteEmail.trim().toLowerCase()));
    const usersSnap = await getDocs(usersQ);
    const athleteDoc = usersSnap.empty ? null : usersSnap.docs[0];
    if (!athleteDoc) return { ok: false, msg: "Atleta no encontrado. Asegúrate de que el email sea correcto y que el atleta tenga cuenta." };
    const athleteUid = athleteDoc.id;

    // 1. Agregar atleta al doc del coach
    await setDoc(doc(db, "coaches", coachUid), {
      athletes: { [athleteUid]: { email: athleteEmail.trim().toLowerCase(), name: athleteDoc.data().name, uid: athleteUid, addedAt: todayStr() } }
    }, { merge: true });

    // 2. Escribir en athlete_coaches para que el atleta vea al coach
    const coachUserSnap = await getDoc(doc(db, "users", coachUid));
    const coachName = coachUserSnap.exists() ? (coachUserSnap.data().name || "") : "";
    const coachEmail = coachUserSnap.exists() ? (coachUserSnap.data().email || "") : "";
    await setDoc(doc(db, "athlete_coaches", athleteUid, "coaches", coachUid), {
      coachUid, coachName, coachEmail, addedAt: todayStr()
    }, { merge: true });

    // 3. Solo escribir rutina si se especificó una
    if (routineId || routineName) {
      const docId = uid(); // Siempre único — permite asignar la misma rutina en días distintos
      await setDoc(doc(db, "athlete_routines", athleteUid, "routines", docId), {
        routineId: routineId || docId,  // ID real de la rutina en coaches/.../routines/
        coachUid,
        coachName: coachName,
        routineName,
        assignedAt: todayStr(),
        completed: false,
        dayOfWeek: dayOfWeek ?? -1
      }, { merge: true });
    }

    return { ok: true, athleteUid };
  } catch(e) { return { ok: false, msg: e.message || "Error al asignar" }; }
}

async function getAthleteRoutines(athleteUid) {
  try {
    const snap = await getDocsFromServer(collection(db, "athlete_routines", athleteUid, "routines"));
    const allRoutines = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));

    // Limpiar documentos fantasma (sin coachUid o routineId válido)
    const phantoms = allRoutines.filter(r => !r.coachUid || !r.routineId);
    if (phantoms.length > 0) {
      await Promise.all(phantoms.map(r =>
        deleteDoc(doc(db, "athlete_routines", athleteUid, "routines", r._docId)).catch(() => {})
      ));
    }
    const routines = allRoutines.filter(r => r.coachUid && r.routineId);

    // Reset automatico semanal: si completedAt es anterior al lunes de esta semana,
    // o si está marcada completed:true pero sin completedAt (dato inconsistente)
    const now = new Date();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    lastMonday.setHours(0, 0, 0, 0);
    const lastMondayStr = lastMonday.toISOString().slice(0, 10);

    const toReset = routines.filter(r => {
      if (!r.completed) return false;
      // Sin completedAt → dato inconsistente, resetear siempre
      if (!r.completedAt) return true;
      // Comparar strings YYYY-MM-DD directamente (evita timezone issues)
      return r.completedAt < lastMondayStr;
    });

    // Forzar reset de todas las marcadas esta semana si ya pasó el lunes
    // (cubre casos donde completedAt existe pero es de esta semana pasada)

    if (toReset.length > 0) {
      await Promise.all(toReset.map(r =>
        setDoc(doc(db, "athlete_routines", athleteUid, "routines", r._docId),
          { completed: false, completedAt: null }, { merge: true })
      ));
      return routines.map(r =>
        toReset.find(tr => tr._docId === r._docId)
          ? { ...r, completed: false, completedAt: null }
          : r
      );
    }

    return routines;
  } catch(e) { return []; }
}

// Reset manual de todas las rutinas completadas (para el botón de refresh)
async function resetAthleteRoutinesCompleted(athleteUid) {
  try {
    const snap = await getDocsFromServer(collection(db, "athlete_routines", athleteUid, "routines"));
    const toReset = snap.docs.filter(d => d.data().completed === true);
    if (toReset.length === 0) return 0;
    await Promise.all(toReset.map(d =>
      setDoc(doc(db, "athlete_routines", athleteUid, "routines", d.id),
        { completed: false, completedAt: null }, { merge: true })
    ));
    return toReset.length;
  } catch(e) { return 0; }
}

async function getAthleteData(athleteUid) {
  try {
    const [sessSnap, userSnap, bodySnap] = await Promise.all([
      getDoc(doc(db, "sessions", athleteUid)),
      getDoc(doc(db, "users", athleteUid)),
      getDoc(doc(db, "body_stats", athleteUid)),
    ]);
    return {
      sessions: sessSnap.exists() ? (sessSnap.data().list || []) : [],
      user: userSnap.exists() ? userSnap.data() : {},
      bodyStats: bodySnap.exists() ? bodySnap.data() : {},
    };
  } catch(e) { return { sessions: [], user: {}, bodyStats: {} }; }
}


const SS_COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];

function CoachModal({ user, sessions, onClose, embedded, ExerciseGif, onActivated }) {
  const sendPushToAthlete = httpsCallable(getFunctions(), "sendPushToAthlete");
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const [tab, setTab] = useState("dashboard");
  const [coachProfile, setCoachProfile] = useState(null);
  const [readNotes, setReadNotes] = useState({}); // { "sessionId:exName": true }
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [activateError, setActivateError] = useState("");
  const [routines, setRoutines] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteData, setAthleteData] = useState(null);
  const [athleteLoading, setAthleteLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
const [athleteRoutinesMap, setAthleteRoutinesMap] = useState({});
  const [athleteQuickStats, setAthleteQuickStats] = useState({});
  const [editBio, setEditBio] = useState("");
  const [editSpecialty, setEditSpecialty] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [coachPhotoURL, setCoachPhotoURL] = useState(user.photoURL || null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef(null);

  // Routine editor state
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [routineName, setRoutineName] = useState("");
  const [routineNotes, setRoutineNotes] = useState("");
  const [routineExercises, setRoutineExercises] = useState([]);
  const [rExName, setRExName] = useState("");
  const [rExMuscle, setRExMuscle] = useState("Todos");
  const [rExWeight, setRExWeight] = useState("");
  const [rExReps, setRExReps] = useState("");
  const [rExNumSeries, setRExNumSeries] = useState("3");
  const [rExSets, setRExSets] = useState([]);
  const [rExComment, setRExComment] = useState("");
  const [rExCustom, setRExCustom] = useState("");
  const [rExCustomMuscle, setRExCustomMuscle] = useState("");
  const [assignRoutineId, setAssignRoutineId] = useState("");
  const [assignEmail, setAssignEmail] = useState("");
  const [assignMsg, setAssignMsg] = useState("");
  const [assignDay, setAssignDay] = useState(-1);
  const [addAthleteEmail, setAddAthleteEmail] = useState("");
  const [addAthleteMsg, setAddAthleteMsg] = useState("");
  const [err, setErr] = useState("");
  const [customExercises, setCustomExercises] = useState([]);
  // SS: id del grupo activo que se está construyendo en el editor
  const [pendingSsGroup, setPendingSsGroup] = useState(null);
  // Rutina preview en dashboard
  const [previewRoutine, setPreviewRoutine] = useState(null);

  useEffect(() => { loadCoach(); }, []);

  async function loadCoach() {
    setLoading(true);
    const profile = await getCoachProfile(user.uid);
    setCoachProfile(profile);
    // Cargar notas leídas desde el perfil del coach
    setReadNotes(profile?.readNotes || {});
    if (profile) {
      setEditBio(profile.bio || "");
      setEditSpecialty(profile.specialty || "");
      const r = await getRoutinesByCoach(user.uid);
      setRoutines(r);
      const customSnap = await getDocsFromServer(collection(db, "coaches", user.uid, "custom_exercises")).catch(() => ({ docs: [] }));
      setCustomExercises(customSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const athletesList = Object.values(profile.athletes || {});
      const map = {};
      const quickStats = {};
      await Promise.all(athletesList.map(async (a) => {
        const [routinesSnap, data] = await Promise.all([
          getDocsFromServer(collection(db, "athlete_routines", a.uid, "routines")).catch(() => ({ docs: [] })),
          getAthleteData(a.uid),
        ]);
        // Filtrar fantasmas y guardar con _docId
        map[a.uid] = routinesSnap.docs
          .map(d => ({ ...d.data(), _docId: d.id }))
          .filter(r => r.coachUid === user.uid && r.routineId);

        // Calcular stats rápidas
        const allSessions = data.sessions || [];
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); weekAgo.setHours(0,0,0,0);
        const sessionsThisWeek = allSessions.filter(s => new Date(s.date + "T00:00:00") >= weekAgo).length;
        const lastSession = [...allSessions].sort((a,b) => b.date.localeCompare(a.date))[0];
        const daysSinceLast = lastSession
          ? Math.round((now - new Date(lastSession.date + "T00:00:00")) / 86400000)
          : null;
        const bodyEntries = data.bodyStats?.entries || [];
        const lastWeight = bodyEntries.length > 0
          ? bodyEntries[bodyEntries.length - 1].weight
          : null;

        // Notas del atleta en la última sesión (excluir las ya leídas)
        const lastNotes = (lastSession?.exercises || [])
          .filter(ex => ex.notes && ex.notes.trim())
          .filter(ex => !((profile?.readNotes || {})[`${lastSession?.id}:${ex.name}`]))
          .map(ex => ({ exName: ex.name, note: ex.notes, sessionId: lastSession?.id }));
        quickStats[a.uid] = { sessionsThisWeek, daysSinceLast, lastWeight, totalSessions: allSessions.length, lastWorkout: lastSession?.workout, lastNotes };
      }));
      setAthleteRoutinesMap(map);
      setAthleteQuickStats(quickStats);
    }
    setLoading(false);
  }

  async function activateCoach() {
    // Lee Firestore directamente para evitar falsos negativos por timing de RC/estado en memoria
    let hasCoachPlan = ["coach", "gym"].includes(user.plan);
    if (!user.isAdmin && !hasCoachPlan) {
      try {
        const freshSnap = await getDoc(doc(db, "users", user.uid));
        if (freshSnap.exists()) {
          const freshPlan = freshSnap.data().plan;
          hasCoachPlan = ["coach", "gym"].includes(freshPlan);
        }
      } catch (e) {
        console.error("[CoachModal] activateCoach: error leyendo Firestore:", e);
      }
    }
    if (!user.isAdmin && !hasCoachPlan) {
      setActivateError("❌ Necesitas el plan Coach para activar este modo.");
      return;
    }
    setActivateError("");
    setActivating(true);
    const profile = await createCoachProfile(user.uid, user.name, user.email);
    if (!profile) {
      setActivateError("❌ No se pudo activar el modo Coach. Verifica los permisos en Firestore.");
      setActivating(false);
      return;
    }
    setCoachProfile(profile);
    setActivating(false);
    if (onActivated) onActivated();
  }
  async function loadAthleteData(athlete) {
    setSelectedAthlete(athlete);
    setAthleteData(null);
    setAthleteLoading(true);
    const data = await getAthleteData(athlete.uid);
    setAthleteData(data);
    setAthleteLoading(false);
    setTab("athlete");
  }

  function startNewRoutine() {
    setEditingRoutine(null);
    setRoutineName(""); setRoutineNotes(""); setRoutineExercises([]);
    setRExName(""); setRExWeight(""); setRExReps(""); setRExSets([]); setRExComment("");
    setTab("editor");
  }

  function startEditRoutine(r) {
    setEditingRoutine(r);
    setRoutineName(r.name || ""); setRoutineNotes(r.notes || "");
    setRoutineExercises(r.exercises || []);
    setTab("editor");
  }

  function addRSet() {
    if (!rExReps) return;
    setRExSets(p => [...p, { id: uid(), weight: rExWeight, reps: rExReps }]);
    setRExWeight(""); setRExReps("");
  }

  function addRExercise() {
    const finalName = rExName === "__custom__" ? rExCustom.trim() : rExName;
    if (!finalName) return;
    if (rExName === "__custom__" && rExCustomMuscle && !EXERCISE_DB.find(e => e.name === finalName)) {
      saveCustomExercise(finalName, rExCustomMuscle, user.uid);
      registerCustomExercise(finalName, rExCustomMuscle);
    }
    const n = Math.max(1, Math.min(10, parseInt(rExNumSeries) || 3));
    const sets = Array.from({ length: n }, () => ({ id: uid(), weight: rExWeight, reps: rExReps }));
    const newEx = {
      id: uid(), name: finalName, sets,
      weight: rExWeight, reps: rExReps, comment: rExComment,
      supersetGroup: pendingSsGroup || null,
    };
    setRoutineExercises(p => [...p, newEx]);
    setRExName(""); setRExCustom(""); setRExCustomMuscle(""); setRExWeight(""); setRExReps(""); setRExNumSeries("3"); setRExSets([]); setRExComment("");
    // After adding to an SS group, keep group active so coach can add more
    // If no pending group, don't touch it
  }

  async function saveRoutine() {
    if (!routineName.trim()) { setErr("Agrega un nombre a la rutina"); return; }
    if (routineExercises.length === 0) { setErr("Agrega al menos un ejercicio"); return; }
    setErr("");
    const routine = {
      id: editingRoutine?.id || null,
      name: routineName, notes: routineNotes,
      exercises: routineExercises, createdAt: editingRoutine?.createdAt || todayStr(),
    };
    const id = await saveCoachRoutine(user.uid, routine);
    if (id) {
      const updated = await getRoutinesByCoach(user.uid);
      setRoutines(updated);
      setTab("routines");
    }
  }

  async function deleteRoutine(id) {
    askConfirm("¿Eliminar esta rutina?", async () => {
      await deleteCoachRoutine(user.uid, id);
      setRoutines(r => r.filter(x => x.id !== id));
    });
  }

  async function handleAssign() {
    if (!assignRoutineId || !assignEmail) { setAssignMsg("Selecciona rutina e ingresa email"); return; }
    const routine = routines.find(r => r.id === assignRoutineId);
    const result = await assignRoutineToAthlete(user.uid, assignEmail, assignRoutineId, routine?.name || "", assignDay);
    const msg = result.ok ? "✅ Rutina asignada correctamente" : `❌ ${result.msg}`;
    setAssignMsg(msg);
    if (result.ok) {
      setTimeout(() => setAssignMsg(""), 3000);
      // Enviar push al atleta
      try {
        const athlete = athletes.find(a => a.email?.toLowerCase() === assignEmail.trim().toLowerCase());
        if (athlete?.uid) {
          sendPushToAthlete({
            athleteUid: athlete.uid,
            type: "routine_assigned",
            routineName: routine?.name || "",
            coachName: user.name || "Tu coach",
          }).catch(() => {}); // No bloquear UI si falla el push
        }
      } catch(_) {}
    }
  }
  async function handleAddAthlete() {
    if (!addAthleteEmail) return;
    if (!user.isGuest && auth.currentUser && !auth.currentUser.emailVerified) {
      setAddAthleteMsg("⚠️ Verifica tu email para usar funciones de coach. Revisa tu bandeja de entrada.");
      return;
    }
    const athletesList = coachProfile ? Object.values(coachProfile.athletes || {}) : [];
    if (athletesList.some(a=>a.email?.toLowerCase()===addAthleteEmail.trim().toLowerCase())){setAddAthleteMsg("⚠️ Este atleta ya está en tu lista");return;}
    const result=await assignRoutineToAthlete(user.uid,addAthleteEmail.trim(),"","");
    if (result.ok){setAddAthleteMsg("✅ Atleta agregado");setAddAthleteEmail("");const p=await getCoachProfile(user.uid);setCoachProfile(p);}
    else setAddAthleteMsg(`❌ ${result.msg}`);
  }
  async function removeAthlete(athleteUid) {
    askConfirm("¿Eliminar este atleta? Podrá volver a unirse con tu código.", async () => {
      try {
      // 1. Eliminar de coaches/{coachUid}.athletes
      const coachSnap = await getDoc(doc(db, "coaches", user.uid));
      if (coachSnap.exists()) {
        const updated = { ...coachSnap.data().athletes };
        delete updated[athleteUid];
        await updateDoc(doc(db, "coaches", user.uid), { athletes: updated });
      }
      // 2. Eliminar rutinas asignadas por este coach al atleta
      try {
        const routinesSnap = await getDocsFromServer(collection(db, "athlete_routines", athleteUid, "routines"));
        await Promise.all(
          routinesSnap.docs
            .filter(d => d.data().coachUid === user.uid)
            .map(d => deleteDoc(d.ref))
        );
      } catch(e2) { /* silenced */ }
      // 3. Eliminar de athlete_coaches/{athleteUid}/coaches/{coachUid}
      try {
        await deleteDoc(doc(db, "athlete_coaches", athleteUid, "coaches", user.uid));
      } catch(e3) { /* silenced */ }

      // Actualizar UI inmediatamente y recargar desde servidor
      setCoachProfile(prev => {
        const updated = { ...prev.athletes };
        delete updated[athleteUid];
        return { ...prev, athletes: updated };
      });
      const refreshed = await getCoachProfile(user.uid);
      if (refreshed) setCoachProfile(refreshed);
    } catch(e) {
      console.error("Error eliminando atleta:", e);
    }
    });
  }

  async function uploadCoachPhoto(file) {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const base64 = await compressImage(file);
      if (!base64) throw new Error("No se pudo comprimir la imagen");
      await Promise.all([
        updateDoc(doc(db, "users", user.uid), { photoURL: base64 }),
        updateDoc(doc(db, "coaches", user.uid), { photoURL: base64 }),
      ]);
      setCoachPhotoURL(base64);
    } catch(e) { console.error(e); }
    setUploadingPhoto(false);
  }

  async function saveCoachProfileData() {
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, "coaches", user.uid), { bio: editBio.trim(), specialty: editSpecialty.trim() });
      setCoachProfile(prev => ({ ...prev, bio: editBio.trim(), specialty: editSpecialty.trim() }));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch(e) { console.error(e); }
    setSavingProfile(false);
  }

  function copyCode() {
    const code = coachProfile.code;
    // Capacitor-safe clipboard: try modern API first, fallback to execCommand
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).catch(() => {
        const el = document.createElement("textarea");
        el.value = code; el.style.position = "fixed"; el.style.opacity = "0";
        document.body.appendChild(el); el.select();
        try { document.execCommand("copy"); } catch(_) {}
        document.body.removeChild(el);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = code; el.style.position = "fixed"; el.style.opacity = "0";
      document.body.appendChild(el); el.select();
      try { document.execCommand("copy"); } catch(_) {}
      document.body.removeChild(el);
    }
    setCodeCopied(true);
    const _cct = setTimeout(() => setCodeCopied(false), 2000);
    return () => clearTimeout(_cct);
  }

  const athletes=coachProfile?Object.values(Object.values(coachProfile.athletes||{}).reduce((acc,a)=>{const k=a.email?.toLowerCase()||a.uid;if(!acc[k]||(a.addedAt||"")>(acc[k].addedAt||""))acc[k]=a;return acc;},{})):[];

  // ── Athlete stats helpers ──
  function getAthletePRs(sessions) { return getPRs(sessions); }
  function getAthleteStreak(sessions) { return getStreak(sessions); }

  if (loading) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
        <div style={{ color: "var(--text-muted)" }}>Cargando...</div>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🏅 Panel Coach</h3>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={loadCoach} title="Actualizar" style={{ background:"none", border:"1px solid var(--border)", color:"var(--text-muted)", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>↻</button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Activate coach */}
        {!coachProfile && (
          <div style={{ textAlign: "center", padding: "30px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>🏋️</div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 800, marginBottom: 8 }}>Activar modo Coach</div>
            <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>
              Como coach podrás crear rutinas, asignarlas a tus atletas<br/>y ver su progreso, PRs e historial completo.
            </p>
            <button className="btn-primary" style={{ fontSize: 18, padding: "14px 32px" }} onClick={activateCoach} disabled={activating}>
              {activating ? "⏳ Activando..." : "⚡ Activar modo Coach"}
            </button>
            {activateError && <div className="err-msg" style={{ marginTop: 12 }}>{activateError}</div>}
          </div>
        )}

        {coachProfile && (
          <>
            {/* Coach code banner */}
            <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: "12px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase" }}>Tu código de coach</div>
                <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 800, letterSpacing: 3, color: "var(--text)", marginTop: 2 }}>{coachProfile.code}</div>
              </div>
              <button className="btn-ghost small" onClick={copyCode}>{codeCopied ? "✅ Copiado" : "📋 Copiar código"}</button>
            </div>

            {/* Tabs */}
            <div style={{ display:"flex", gap:4, marginBottom:20, background:"var(--input-bg)", borderRadius:12, padding:4 }}>
              {[["dashboard","📊","Dashboard"],["routines","📋","Rutinas"],["athletes","👥","Atletas"],["profile","👤","Perfil"]].map(([id, icon, label]) => (
                <button key={id} onClick={() => setTab(id)} style={{
                  flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3,
                  padding:"8px 4px", border:"none", cursor:"pointer", borderRadius:8,
                  background: tab===id ? "var(--accent)" : "transparent",
                  color: tab===id ? "#000" : "var(--text-muted)",
                  fontFamily:"Barlow Condensed, sans-serif",
                  fontWeight: tab===id ? 900 : 600,
                  fontSize:10, letterSpacing:0.5, textTransform:"uppercase",
                  transition:"all 0.15s",
                }}>
                  <span style={{ fontSize:18, lineHeight:1 }}>{icon}</span>
                  {label}
                </button>
              ))}
            </div>

            {/* ── DASHBOARD ── */}
            {tab === "dashboard" && (
              <div>
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
                  {[
                    { icon: "👥", label: "Atletas", value: athletes.length },
                    { icon: "📋", label: "Rutinas", value: routines.length },
                  ].map(s => (
                    <div key={s.label} style={{ flex: "1 1 120px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px", textAlign: "center" }}>
                      <div style={{ fontSize: 28 }}>{s.icon}</div>
                      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{s.value}</div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Mis atletas</div>
                {athletes.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                    Aún no tienes atletas. Comparte tu código o agrégalos por email.
                  </p>
                ) : athletes.map(a => {
                  const qs = athleteQuickStats[a.uid];
                  const inactive = qs?.daysSinceLast != null && qs.daysSinceLast >= 7;
                  const veryInactive = qs?.daysSinceLast != null && qs.daysSinceLast >= 14;
                  return (
                  <div key={a.uid} style={{ padding: "14px 16px", background: "var(--input-bg)", border: `1px solid ${veryInactive ? "rgba(239,68,68,0.4)" : inactive ? "rgba(245,158,11,0.35)" : "var(--border)"}`, borderRadius: 14, marginBottom: 10 }}>
                    {/* Header atleta */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: "50%", background: veryInactive ? "#ef4444" : inactive ? "#f59e0b" : "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "white", fontSize: 15 }}>
                          {a.name?.[0]?.toUpperCase()}
                        </div>
                        <div><div style={{fontWeight:700,fontSize:14}}>{a.name}</div></div>
                      </div>
                      <button className="btn-ghost small" onClick={() => loadAthleteData(a)}>Ver detalle →</button>
                    </div>

                    {/* Stats rápidas */}
                    {qs ? (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 10 }}>
                        {[
                          { icon: "📅", label: "Últimos 7 días", value: `${qs.sessionsThisWeek} sesiones`, color: qs.sessionsThisWeek === 0 ? "#ef4444" : qs.sessionsThisWeek >= 3 ? "#22c55e" : "var(--text)" },
                          { icon: "🕐", label: "Última sesión", value: qs.daysSinceLast == null ? "Nunca" : qs.daysSinceLast === 0 ? "Hoy" : qs.daysSinceLast === 1 ? "Ayer" : `Hace ${qs.daysSinceLast}d`, color: veryInactive ? "#ef4444" : inactive ? "#f59e0b" : "#22c55e" },
                          { icon: "⚖️", label: "Peso actual", value: qs.lastWeight ? `${qs.lastWeight}kg` : "—", color: "var(--text)" },
                          { icon: "🏋️", label: "Total sesiones", value: qs.totalSessions, color: "var(--accent)" },
                        ].map(s => (
                          <div key={s.label} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                            <div style={{ fontSize: 14 }}>{s.icon}</div>
                            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 8 }}>Cargando stats...</div>
                    )}

                    {/* Última rutina + alerta inactividad */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {qs?.lastWorkout && <span>Último: <strong style={{ color: "var(--text)" }}>{qs.lastWorkout}</strong></span>}
                        {(athleteRoutinesMap[a.uid] || []).map(r => (
                          <span key={r._docId || r.routineId} style={{ display:"inline-flex", alignItems:"center", gap:4, marginLeft: 8,
                            background: r.completed ? "rgba(34,197,94,0.08)" : "var(--card)",
                            border: r.completed ? "1px solid rgba(34,197,94,0.35)" : "1px solid var(--border)",
                            borderRadius:6, padding:"2px 6px 2px 8px" }}>
                            <span style={{ color: r.completed ? "#22c55e" : "var(--accent)", fontSize:11, fontWeight:700 }}>
                              {r.completed ? "✅ " : ""}{r.routineName}{r.dayOfWeek >= 0 ? ` · ${DAYS_ES[r.dayOfWeek]}` : ""}
                              {r.completed && r.completedAt ? <span style={{ color:"var(--text-muted)", fontWeight:400 }}> · {(() => { const [,m,d] = r.completedAt.split("-"); const meses=["","ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]; return `${parseInt(d)} ${meses[parseInt(m)]}`; })()}</span> : null}
                            </span>
                            <button onClick={() => {
                              askConfirm(`¿Quitar "${r.routineName}" de ${a.name}?`, async () => {
                              await unassignRoutineFromAthlete(a.uid, r._docId || r.routineId);
                              const updated = await Promise.all(athletes.map(async at => {
                                const rts = await getDocsFromServer(collection(db, "athlete_routines", at.uid, "routines"));
                                return [at.uid, rts.docs.map(d => ({...d.data(), _docId: d.id})).filter(x => x.coachUid === user.uid && x.routineId)];
                              }));
                              setAthleteRoutinesMap(Object.fromEntries(updated));
                              });
                            }} style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer",
                              fontSize:12, padding:"0 2px", lineHeight:1 }}>✕</button>
                          </span>
                        ))}
                      </div>
                      {veryInactive && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>🚨 Sin entrenar {qs.daysSinceLast} días</span>}
                      {inactive && !veryInactive && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>⚠️ Inactivo esta semana</span>}
                      {qs?.lastNotes?.length > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6,
                          background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.25)",
                          borderRadius: 6, padding: "2px 8px" }}>
                          <span style={{ fontSize: 11, color: "#60a5fa", fontWeight: 700 }}>
                            💬 {qs.lastNotes.length} nota{qs.lastNotes.length > 1 ? "s" : ""}
                          </span>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newRead = { ...readNotes };
                              qs.lastNotes.forEach(n => { newRead[`${n.sessionId}:${n.exName}`] = true; });
                              setReadNotes(newRead);
                              // Actualizar quickStats para que desaparezca el badge
                              setAthleteQuickStats(prev => ({ ...prev, [a.uid]: { ...prev[a.uid], lastNotes: [] } }));
                              // Persistir en Firestore
                              try {
                                await setDoc(doc(db, "coaches", user.uid), { readNotes: newRead }, { merge: true });
                              } catch(e) { console.error("Error guardando readNotes:", e); }
                            }}
                            style={{ background: "none", border: "none", cursor: "pointer",
                              fontSize: 11, color: "rgba(96,165,250,0.6)", padding: "0 2px",
                              fontFamily: "Barlow, sans-serif", fontWeight: 700 }}
                            title="Marcar como leída"
                          >✓ Leída</button>
                        </span>
                      )}
                    </div>
                  </div>
                );})}
              </div>
            )}

            {/* ── ROUTINES ── */}
            {tab === "routines" && (
              <div>
                {/* Routine preview modal */}
                {previewRoutine && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
                    onClick={() => setPreviewRoutine(null)}>
                    <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 20, maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto" }}
                      onClick={e => e.stopPropagation()}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800 }}>{previewRoutine.name}</div>
                        <button onClick={() => setPreviewRoutine(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 20 }}>✕</button>
                      </div>
                      {previewRoutine.notes && (
                        <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 14, padding: "8px 12px", background: "var(--input-bg)", borderRadius: 8 }}>{previewRoutine.notes}</div>
                      )}
                      {(() => {
                        const exs = previewRoutine.exercises || [];
                        const ssGroups = {};
                        exs.forEach(ex => { if (ex.supersetGroup) { if (!ssGroups[ex.supersetGroup]) ssGroups[ex.supersetGroup]=[]; ssGroups[ex.supersetGroup].push(ex.id); }});
                        const ssGroupKeys = Object.keys(ssGroups);
                        const ssColor = (gid) => SS_COLORS[ssGroupKeys.indexOf(gid) % SS_COLORS.length];
                        return exs.map((ex, i) => {
                          const col = ex.supersetGroup ? ssColor(ex.supersetGroup) : null;
                          const isFirst = col && ssGroups[ex.supersetGroup]?.[0] === ex.id;
                          const isLast  = col && ssGroups[ex.supersetGroup]?.slice(-1)[0] === ex.id;
                          return (
                            <div key={ex.id} style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 6 }}>
                              {col && <div style={{ width: 4, flexShrink: 0, marginRight: 8, background: col, borderRadius: isFirst?"4px 4px 0 0":isLast?"0 0 4px 4px":"0", opacity: 0.8 }} />}
                              <div style={{ flex: 1, padding: "10px 12px", background: col ? `${col}0d` : "var(--input-bg)", border: `1px solid ${col ? col+"40" : "var(--border)"}`, borderRadius: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {ExerciseGif && <ExerciseGif exName={ex.name} size={44} />}
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                                      {ex.name}
                                      {col && <span style={{ background: col, color: "#0a0a0a", fontSize: 8, fontWeight: 900, padding: "1px 5px", borderRadius: 3, letterSpacing: 1 }}>SS</span>}
                                    </div>
                                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                                      {ex.sets?.length > 0 ? `${ex.sets.length} series · ${ex.sets[0].weight||"—"}kg × ${ex.sets[0].reps||"—"} reps` : ex.weight ? `${ex.weight}kg × ${ex.reps}` : "Sin peso definido"}
                                    </div>
                                    {ex.comment && (
                                      <div style={{ fontSize: 11, marginTop: 4, color: "var(--accent)", display: "flex", gap: 4 }}>
                                        <span>💬</span><span>{ex.comment}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

                <button className="btn-primary" style={{ width: "100%", marginBottom: 16, fontSize: 16 }} onClick={startNewRoutine}>+ Crear nueva rutina</button>
                {routines.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin rutinas aún.</p>}
                {routines.map(r => {
                  const ssCount = new Set((r.exercises||[]).map(e=>e.supersetGroup).filter(Boolean)).size;
                  return (
                  <div key={r.id} style={{ padding: "14px 16px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-ghost small" onClick={() => setPreviewRoutine(r)}>👁 Ver</button>
                        <button className="btn-ghost small" onClick={() => startEditRoutine(r)}>✏️ Editar</button>
                        <button className="btn-ghost small danger" onClick={() => deleteRoutine(r.id)}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                      {(r.exercises||[]).length} ejercicios
                      {ssCount > 0 && <span style={{ marginLeft: 8, color: "#a78bfa", fontWeight: 700 }}>⚡ {ssCount} superset{ssCount > 1 ? "s" : ""}</span>}
                      {" · "}creada {fmtDate(r.createdAt)}
                    </div>
                    {r.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginBottom: 6 }}>{r.notes}</div>}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {(r.exercises||[]).map(ex => {
                        const ssGid = ex.supersetGroup;
                        const ssGroups = {};
                        (r.exercises||[]).forEach(e => { if(e.supersetGroup){if(!ssGroups[e.supersetGroup])ssGroups[e.supersetGroup]=[];ssGroups[e.supersetGroup].push(e.id);}});
                        const col = ssGid ? SS_COLORS[Object.keys(ssGroups).indexOf(ssGid) % SS_COLORS.length] : null;
                        return (
                          <span key={ex.id} style={{ fontSize: 11, padding: "2px 8px", background: col ? `${col}18` : "rgba(59,130,246,0.1)", border: `1px solid ${col ? col+"50" : "rgba(59,130,246,0.2)"}`, borderRadius: 10, color: col || "var(--text-muted)" }}>
                            {col && "⚡ "}{ex.name}{ex.sets?.length > 0 ? ` · ${ex.sets.length}s` : ex.weight ? ` · ${ex.weight}kg` : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );})}
              </div>
            )}

            {/* ── ROUTINE EDITOR ── */}
            {tab === "editor" && (
              <div>
                <button className="btn-ghost small" style={{ marginBottom: 16 }} onClick={() => setTab("routines")}>← Volver</button>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800, marginBottom: 16 }}>
                  {editingRoutine ? "✏️ Editar rutina" : "➕ Nueva rutina"}
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="field-label">Nombre de la rutina</label>
                  <input className="input" placeholder="Push Day, Piernas, Full Body..." value={routineName} onChange={e => setRoutineName(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="field-label">Notas / instrucciones generales</label>
                  <textarea className="input textarea" placeholder="Indicaciones para el atleta..." value={routineNotes} onChange={e => setRoutineNotes(e.target.value)} />
                </div>

                {/* Add exercise */}
                <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>Agregar ejercicio</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, marginBottom: 8 }}>
                    {["Todos", ...MUSCLES].map(m => (
                      <button key={m} className={`muscle-chip ${rExMuscle===m?"active":""}`} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => { setRExMuscle(m); setRExName(""); }}>{m}</button>
                    ))}
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <div className="field" style={{ flex: 2 }}>
                      <select className="input" style={{ fontSize: 13 }} value={rExName} onChange={e => setRExName(e.target.value)}>
                        <option value="">— Ejercicio —</option>
                        {(rExMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === rExMuscle)).map(ex => (
                          <option key={ex.name} value={ex.name}>{ex.name}</option>
                        ))}
                        {customExercises.filter(e => rExMuscle === "Todos" || e.muscle === rExMuscle).map(ex => (
                          <option key={"custom_" + ex.id} value={ex.name}>✏️ {ex.name}</option>
                        ))}
                        <option value="__custom__">✏️ Personalizado... (escribe el tuyo)</option>
                      </select>
                      {rExName === "__custom__" && (
                        <>
                          <input className="input" style={{ marginTop: 6, fontSize: 13 }} placeholder="Escribe el nombre de tu ejercicio..." value={rExCustom} onChange={e => setRExCustom(lettersOnly(e.target.value))} autoFocus />
                          <select className="input" style={{ marginTop: 6, fontSize: 13 }} value={rExCustomMuscle} onChange={e => setRExCustomMuscle(e.target.value)}>
                            <option value="">— Músculo principal —</option>
                            {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                  </div>

                  {/* GIF preview */}
                  {ExerciseGif && rExName && rExName !== "__custom__" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "10px 12px", background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10 }}>
                      <ExerciseGif exName={rExName} size={72} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{rExName}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                          {EXERCISE_DB.find(e => e.name === rExName)?.muscle || ""}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <div className="field" style={{ flex: 1 }}>
                      <input className="input" style={{ fontSize: 13 }} placeholder="Peso kg" value={rExWeight} onChange={e => setRExWeight(numWeight(e.target.value))} inputMode="decimal" />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <input className="input" style={{ fontSize: 13 }} placeholder="Reps" value={rExReps} onChange={e => setRExReps(numReps(e.target.value))} inputMode="decimal" />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <input className="input" style={{ fontSize: 13 }} placeholder="Series" value={rExNumSeries} onChange={e => setRExNumSeries(e.target.value.replace(/[^0-9]/g,""))} inputMode="numeric" />
                    </div>
                  </div>
                  {rExWeight && rExReps && rExNumSeries && (
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>→ {rExNumSeries} × {rExWeight}kg × {rExReps} reps</div>
                  )}
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label className="field-label">Comentario del coach para este ejercicio</label>
                    <input className="input" style={{ fontSize: 13 }} placeholder="Ej: Baja lento, 3 segundos de excéntrica..." value={rExComment} onChange={e => setRExComment(e.target.value)} />
                  </div>

                  {/* Superset toggle */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <button
                      onClick={() => setPendingSsGroup(g => g ? null : uid().slice(0, 8))}
                      style={{
                        background: pendingSsGroup ? "rgba(167,139,250,0.15)" : "none",
                        border: `1px ${pendingSsGroup ? "solid" : "dashed"} ${pendingSsGroup ? "#a78bfa" : "rgba(255,255,255,0.2)"}`,
                        color: pendingSsGroup ? "#a78bfa" : "var(--text-muted)",
                        borderRadius: 8, padding: "6px 12px", cursor: "pointer",
                        fontFamily: "Barlow Condensed, sans-serif", fontSize: 12, fontWeight: 800,
                        letterSpacing: 1, display: "flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <span>⚡</span>
                      {pendingSsGroup ? "Modo SUPERSET activo — próximo ejercicio se une" : "Agregar al superset"}
                    </button>
                    {pendingSsGroup && (
                      <button onClick={() => setPendingSsGroup(null)}
                        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12 }}>
                        ✕ Cancelar SS
                      </button>
                    )}
                  </div>

                  <button className="btn-add-ex" onClick={addRExercise}>+ Agregar ejercicio</button>
                </div>

                {/* Exercise list */}
                {routineExercises.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>
                      Ejercicios ({routineExercises.length})
                    </div>
                    {/* Build SS group colors */}
                    {(() => {
                      const ssGroups = {};
                      routineExercises.forEach(ex => {
                        if (ex.supersetGroup) {
                          if (!ssGroups[ex.supersetGroup]) ssGroups[ex.supersetGroup] = [];
                          ssGroups[ex.supersetGroup].push(ex.id);
                        }
                      });
                      const ssGroupKeys = Object.keys(ssGroups);
                      const ssColor = (groupId) => SS_COLORS[ssGroupKeys.indexOf(groupId) % SS_COLORS.length];

                      return routineExercises.map((ex, i) => {
                        const col = ex.supersetGroup ? ssColor(ex.supersetGroup) : null;
                        const isFirstInGroup = ex.supersetGroup && ssGroups[ex.supersetGroup]?.[0] === ex.id;
                        const isLastInGroup  = ex.supersetGroup && ssGroups[ex.supersetGroup]?.slice(-1)[0] === ex.id;
                        return (
                          <div key={ex.id} style={{ display: "flex", alignItems: "stretch", gap: 0, marginBottom: 6 }}>
                            {/* SS bracket */}
                            {col && (
                              <div style={{
                                width: 4, flexShrink: 0, marginRight: 8,
                                background: col,
                                borderRadius: isFirstInGroup ? "4px 4px 0 0" : isLastInGroup ? "0 0 4px 4px" : "0",
                                opacity: 0.8,
                              }} />
                            )}
                            <div style={{
                              flex: 1, padding: "10px 12px",
                              background: col ? `${col}0d` : "var(--input-bg)",
                              border: `1px solid ${col ? col + "40" : "var(--border)"}`,
                              borderRadius: 10,
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {ExerciseGif && <ExerciseGif exName={ex.name} size={36} />}
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                                      {ex.name}
                                      {col && (
                                        <span style={{ background: col, color: "#0a0a0a", fontSize: 8, fontWeight: 900, padding: "1px 5px", borderRadius: 3, letterSpacing: 1 }}>SS</span>
                                      )}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                                      {ex.sets?.length > 0 ? ex.sets.map((s,i) => `S${i+1}: ${s.weight||"—"}kg×${s.reps||"—"}`).join(" · ") : ex.weight ? `${ex.weight}kg × ${ex.reps}` : "Sin peso"}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 4 }}>
                                  {/* Toggle SS membership */}
                                  <button
                                    title={ex.supersetGroup ? "Quitar del superset" : "Añadir a superset"}
                                    onClick={() => setRoutineExercises(p => p.map((x, j) => j !== i ? x : {
                                      ...x, supersetGroup: x.supersetGroup ? null :
                                        (routineExercises[i-1]?.supersetGroup || routineExercises[i+1]?.supersetGroup || uid().slice(0,8))
                                    }))}
                                    style={{
                                      background: col ? `${col}20` : "none",
                                      border: `1px solid ${col ? col + "60" : "rgba(255,255,255,0.15)"}`,
                                      color: col || "var(--text-muted)",
                                      borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13,
                                      display: "flex", alignItems: "center", justifyContent: "center",
                                    }}
                                  >⚡</button>
                                  <button
                                    title="Subir"
                                    onClick={() => { if (i === 0) return; setRoutineExercises(p => { const n=[...p]; [n[i-1],n[i]]=[n[i],n[i-1]]; return n; }); }}
                                    disabled={i === 0}
                                    style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13, opacity: i===0?0.3:1 }}>↑</button>
                                  <button
                                    title="Bajar"
                                    onClick={() => { if (i === routineExercises.length-1) return; setRoutineExercises(p => { const n=[...p]; [n[i],n[i+1]]=[n[i+1],n[i]]; return n; }); }}
                                    disabled={i === routineExercises.length - 1}
                                    style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, width: 28, height: 28, cursor: "pointer", fontSize: 13, opacity: i===routineExercises.length-1?0.3:1 }}>↓</button>
                                  <button className="chip-del" style={{ fontSize: 16 }} onClick={() => setRoutineExercises(p => p.filter(e => e.id !== ex.id))}>✕</button>
                                </div>
                              </div>
                              <input
                                className="input"
                                style={{ fontSize: 12, padding: "5px 8px" }}
                                placeholder="💬 Nota del coach para este ejercicio..."
                                value={ex.comment || ""}
                                onChange={e => setRoutineExercises(p => p.map((x, j) => j !== i ? x : { ...x, comment: e.target.value }))}
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}

                {err && <div className="err-msg">{err}</div>}
                <button className="btn-primary" style={{ width: "100%" }} onClick={saveRoutine}>💾 Guardar rutina</button>
              </div>
            )}

            {/* ── ATHLETES ── */}
            {tab === "athletes" && (
              <div>
                <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>➕ Agregar atleta por email</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input className="input" placeholder="email@atleta.com" value={addAthleteEmail} onChange={e => setAddAthleteEmail(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn-primary" style={{ fontSize: 14, padding: "10px 16px" }} onClick={handleAddAthlete}>Agregar</button>
                  </div>
                  {addAthleteMsg && <div style={{ marginTop: 8, fontSize: 13, color: addAthleteMsg.startsWith("✅") ? "#22c55e" : "#f87171" }}>{addAthleteMsg}</div>}
                </div>


                {athletes.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 20 }}>Sin atletas aún.</p>
                ) : athletes.map(a => (
                  <div key={a.uid} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 14px",background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:12,marginBottom:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:36,height:36,borderRadius:"50%",background:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"white"}}>{a.name?.[0]?.toUpperCase()}</div>
                      <div style={{fontWeight:700}}>{a.name}</div>
                    </div>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <button className="btn-ghost small" onClick={()=>loadAthleteData(a)}>Ver progreso →</button>
                      <button className="btn-ghost small" style={{color:"#ef4444",borderColor:"rgba(239,68,68,0.3)"}} onClick={()=>removeAthlete(a.uid)}>🗑️</button>
                    </div>
                  </div>
                ))}

                {/* ── Asignar rutina inline ── */}
                {athletes.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>📨 Asignar rutina a atleta</div>
                    <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                      <select className="input" value={assignRoutineId} onChange={e => setAssignRoutineId(e.target.value)}>
                        <option value="">— Elige una rutina —</option>
                        {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select className="input" value={assignEmail} onChange={e => setAssignEmail(e.target.value)}>
                        <option value="">— Elige atleta —</option>
                        {athletes.map(a => <option key={a.uid} value={a.email}>{a.name}</option>)}
                      </select>
                      <select className="input" value={assignDay} onChange={e => setAssignDay(parseInt(e.target.value))}>
                        <option value={-1}>— Sin día fijo (opcional) —</option>
                        {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                      </select>
                      <button className="btn-primary" style={{ width: "100%" }} onClick={handleAssign}>📨 Asignar rutina</button>
                      {assignMsg && <div style={{ fontSize: 13, color: assignMsg.startsWith("✅") ? "#22c55e" : "#f87171", textAlign: "center" }}>{assignMsg}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ASSIGN (legacy, hidden) ── */}
            {tab === "assign" && (
              <div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Asigna una rutina directamente a un atleta por su email.</div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="field-label">Seleccionar rutina</label>
                  <select className="input" value={assignRoutineId} onChange={e => setAssignRoutineId(e.target.value)}>
                    <option value="">— Elige una rutina —</option>
                    {routines.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
                  <label className="field-label">Email del atleta</label>
                  <select className="input" value={assignEmail} onChange={e => setAssignEmail(e.target.value)}>
                    <option value="">— Elige atleta —</option>
                    {athletes.map(a => <option key={a.uid} value={a.email}>{a.name} ({a.email})</option>)}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 16 }}>
  <label className="field-label">Día de la semana (opcional)</label>
  <select className="input" value={assignDay} onChange={e => setAssignDay(parseInt(e.target.value))}>
    <option value={-1}>— Sin día fijo —</option>
    {DAYS_ES.map((d, i) => <option key={i} value={i}>{d}</option>)}
  </select>
</div>
                <button className="btn-primary" style={{ width: "100%" }} onClick={handleAssign}>📨 Asignar rutina</button>
                {assignMsg && <div style={{ marginTop: 12, fontSize: 13, color: assignMsg.startsWith("✅") ? "#22c55e" : "#f87171", textAlign: "center" }}>{assignMsg}</div>}
              </div>
            )}

            {/* ── ATHLETE DETAIL ── */}
            {tab === "athlete" && selectedAthlete && (
              <div>
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
  <button className="btn-ghost small" onClick={() => setTab("dashboard")}>← Volver</button>
  <button className="btn-ghost small" onClick={() => loadAthleteData(selectedAthlete)}>🔄 Recargar</button>
</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 20, color: "white" }}>{selectedAthlete.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800 }}>{selectedAthlete.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedAthlete.email}</div>
                  </div>
                </div>

                {athleteLoading ? (
                  <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)" }}>⏳ Cargando datos...</div>
                ) : athleteData && (
                  <>
                    {/* Stats */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px,1fr))", gap: 10, marginBottom: 20 }}>
                      {[
                        { icon: "🏋️", label: "Sesiones", value: athleteData.sessions.length },
                        { icon: "🔥", label: "Racha", value: `${getAthleteStreak(athleteData.sessions)}sem` },
                        { icon: "⭐", label: "PRs", value: Object.keys(getAthletePRs(athleteData.sessions)).length },
                        { icon: "⚖️", label: "Peso actual", value: athleteData.bodyStats?.entries?.length > 0 ? `${athleteData.bodyStats.entries[athleteData.bodyStats.entries.length-1].weight}kg` : "—" },
                      ].map(s => (
                        <div key={s.label} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                          <div style={{ fontSize: 22 }}>{s.icon}</div>
                          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 800, color: "var(--accent)" }}>{s.value}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Top PRs */}
                    {Object.keys(getAthletePRs(athleteData.sessions)).length > 0 && (
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>🏆 Top PRs</div>
                        {Object.entries(getAthletePRs(athleteData.sessions)).sort((a,b) => b[1].rm - a[1].rm).slice(0,5).map(([name, data]) => (
                          <div key={name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13 }}>
                            <span>{name}</span>
                            <span style={{ fontWeight: 800, color: "var(--accent)" }}>{data.rm} kg 1RM</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Recent sessions */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>📋 Últimas sesiones</div>
                      {athleteData.sessions.slice(0,5).map(s => (
                        <div key={s.id} style={{ padding: "10px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 6 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 700 }}>{s.workout}</span>
                            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{fmtDate(s.date)}</span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{(s.exercises||[]).length} ejercicios</div>
                          {(s.exercises||[]).filter(ex => ex.notes && ex.notes.trim()).map((ex, ni) => {
                            const noteKey = `${s.id}:${ex.name}`;
                            const isRead = readNotes[noteKey];
                            return (
                              <div key={ni} style={{
                                marginTop: 6, padding: "6px 10px",
                                background: isRead ? "rgba(255,255,255,0.03)" : "rgba(96,165,250,0.07)",
                                border: `1px solid ${isRead ? "rgba(255,255,255,0.08)" : "rgba(96,165,250,0.25)"}`,
                                borderRadius: 7,
                                transition: "all 0.2s",
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                  <div style={{ fontSize: 10, fontWeight: 700, color: isRead ? "var(--text-muted)" : "#60a5fa", textTransform: "uppercase", letterSpacing: 0.5 }}>
                                    💬 {ex.name}
                                  </div>
                                  {!isRead ? (
                                    <button
                                      onClick={async () => {
                                        const newRead = { ...readNotes, [noteKey]: true };
                                        setReadNotes(newRead);
                                        setAthleteQuickStats(prev => ({
                                          ...prev,
                                          [selectedAthlete.uid]: {
                                            ...prev[selectedAthlete.uid],
                                            lastNotes: (prev[selectedAthlete.uid]?.lastNotes || []).filter(n => n.exName !== ex.name || n.sessionId !== s.id),
                                          }
                                        }));
                                        try {
                                          await setDoc(doc(db, "coaches", user.uid), { readNotes: newRead }, { merge: true });
                                        } catch(e) { console.error(e); }
                                      }}
                                      style={{ background: "none", border: "1px solid rgba(96,165,250,0.3)", borderRadius: 4,
                                        color: "#60a5fa", fontSize: 10, fontWeight: 700, padding: "1px 7px",
                                        cursor: "pointer", fontFamily: "Barlow, sans-serif" }}
                                    >✓ Leída</button>
                                  ) : (
                                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>✓ Leída</span>
                                  )}
                                </div>
                                <div style={{ fontSize: 12, color: isRead ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.75)", lineHeight: 1.4 }}>
                                  {ex.notes}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      {athleteData.sessions.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin sesiones registradas aún.</p>}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* ── PERFIL ── */}
            {tab === "profile" && (
              <div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:16 }}>Tu perfil público</div>
                <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"16px", marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                    <div style={{ position:"relative" }}>
                      {coachPhotoURL ? (
                        <img src={coachPhotoURL} alt="foto" style={{ width:64, height:64, borderRadius:"50%", objectFit:"cover", border:"2px solid var(--accent)" }} />
                      ) : (
                        <div style={{ width:64, height:64, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:24, color:"white" }}>
                          {user.name?.[0]?.toUpperCase()||"?"}
                        </div>
                      )}
                      <label style={{ position:"absolute", bottom:-2, right:-2, width:22, height:22, borderRadius:"50%", background:"var(--card-bg)", border:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:12 }}
                        title="Cambiar foto">
                        {uploadingPhoto ? "⏳" : "📷"}
                        <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { if(e.target.files[0]) uploadCoachPhoto(e.target.files[0]); }} />
                      </label>
                    </div>
                    <div>
                      <div style={{ fontWeight:800, fontSize:16 }}>{user.name}</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)" }}>{user.email}</div>
                      <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2, cursor:"pointer" }} onClick={() => photoInputRef.current && photoInputRef.current.click()}>
                        {uploadingPhoto ? "Subiendo..." : "Cambiar foto"}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom:14 }}>
                    <label style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Especialidad</label>
                    <input className="input" placeholder="Ej: Fuerza, CrossFit, Pérdida de peso..."
                      value={editSpecialty} onChange={e => setEditSpecialty(e.target.value)}
                      maxLength={60} style={{ width:"100%" }} />
                  </div>

                  <div style={{ marginBottom:16 }}>
                    <label style={{ fontSize:11, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase", display:"block", marginBottom:6 }}>Bio</label>
                    <textarea className="input" placeholder="Cuéntale a tus atletas sobre ti, tu experiencia y metodología..."
                      value={editBio} onChange={e => setEditBio(e.target.value)}
                      maxLength={300} rows={4}
                      style={{ width:"100%", resize:"vertical", fontFamily:"inherit", lineHeight:1.5 }} />
                    <div style={{ fontSize:11, color:"var(--text-muted)", textAlign:"right", marginTop:4 }}>{editBio.length}/300</div>
                  </div>

                  <button className="btn-primary" style={{ width:"100%" }} onClick={saveCoachProfileData} disabled={savingProfile}>
                    {savingProfile ? "⏳ Guardando..." : profileSaved ? "✅ Guardado" : "Guardar perfil"}
                  </button>
                </div>

                <div style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", lineHeight:1.6 }}>
                  Esta información la verán tus atletas al consultar tu perfil.
                </div>
              </div>
            )}

          </>
        )}
      </div>
      {confirmModal}
    </div>
  );
}


export { getAthleteRoutines, resetAthleteRoutinesCompleted };
export default CoachModal;