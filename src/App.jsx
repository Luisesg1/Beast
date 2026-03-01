import { useState, useEffect, useRef, createContext, useContext } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, deleteDoc, query, where, updateDoc } from "firebase/firestore";
const firebaseConfig = {
  apiKey: "AIzaSyAh3pfGv0vEpKmGtNKKRvAhma1pGtA7Alc",
  authDomain: "gymtracker-app-2c603.firebaseapp.com",
  projectId: "gymtracker-app-2c603",
  storageBucket: "gymtracker-app-2c603.firebasestorage.app",
  messagingSenderId: "1006490404310",
  appId: "1:1006490404310:web:015b3d4817304032aed077",
};
const ADMIN_EMAILS = ["luiseduardooo2000@gmail.com"]; // reemplaza con tu email real
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const ThemeCtx = createContext();
const useTheme = () => useContext(ThemeCtx);
const AuthCtx = createContext();
const useAuth = () => useContext(AuthCtx);

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);
const lettersOnly = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
const numDot = (v) => v.replace(/[^0-9.]/g, "");
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const DAYS_ES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

const ACCENT_COLORS = [
  { name: "Azul",    value: "#3b82f6", dim: "#1a2f52" },
  { name: "Verde",   value: "#22c55e", dim: "#14532d" },
  { name: "Morado",  value: "#8b5cf6", dim: "#2e1065" },
  { name: "Rosa",    value: "#ec4899", dim: "#500724" },
  { name: "Naranja", value: "#f97316", dim: "#431407" },
  { name: "Rojo",    value: "#ef4444", dim: "#450a0a" },
  { name: "Cyan",    value: "#06b6d4", dim: "#083344" },
];

const PLANS = {
  guest: { name: "Invitado", price: "Sin cuenta", color: "#f59e0b", features: ["3 sesiones", "Sin historial guardado", "Herramientas básicas"] },
  free:  { name: "GymTracker", price: "Gratis", color: "#3b82f6", features: ["Todo incluido"] },
};

const PRESETS = {
  "Push Day":  ["Press Banca", "Press Hombro", "Fondos", "Tríceps Polea", "Elevaciones Laterales"],
  "Pull Day":  ["Dominadas", "Remo con Barra", "Curl Bíceps", "Face Pull", "Pullover"],
  "Leg Day":   ["Sentadilla", "Peso Muerto", "Prensa de Pierna", "Extensión Cuádriceps", "Curl Femoral"],
  "Full Body": ["Sentadilla", "Press Banca", "Dominadas", "Peso Muerto Rumano", "Press Hombro"],
};

const EXERCISE_DB = [
  { name: "Press Banca", muscle: "Pecho", machine: false, equipment: "Barra" },
  { name: "Press Banca Inclinado", muscle: "Pecho", machine: false, equipment: "Barra" },
  { name: "Press Mancuernas", muscle: "Pecho", machine: false, equipment: "Mancuernas" },
  { name: "Aperturas Mancuernas", muscle: "Pecho", machine: false, equipment: "Mancuernas" },
  { name: "Fondos", muscle: "Pecho", machine: false, equipment: "Cuerpo" },
  { name: "Crossover Polea", muscle: "Pecho", machine: true, equipment: "Polea" },
  { name: "Press Pecho Máquina", muscle: "Pecho", machine: true, equipment: "Máquina" },
  { name: "Dominadas", muscle: "Espalda", machine: false, equipment: "Barra" },
  { name: "Remo con Barra", muscle: "Espalda", machine: false, equipment: "Barra" },
  { name: "Remo Mancuerna", muscle: "Espalda", machine: false, equipment: "Mancuernas" },
  { name: "Peso Muerto", muscle: "Espalda", machine: false, equipment: "Barra" },
  { name: "Pullover", muscle: "Espalda", machine: false, equipment: "Mancuernas" },
  { name: "Jalón al Pecho", muscle: "Espalda", machine: true, equipment: "Polea" },
  { name: "Remo Polea Baja", muscle: "Espalda", machine: true, equipment: "Polea" },
  { name: "Face Pull", muscle: "Espalda", machine: true, equipment: "Polea" },
  { name: "Press Hombro Barra", muscle: "Hombros", machine: false, equipment: "Barra" },
  { name: "Press Arnold", muscle: "Hombros", machine: false, equipment: "Mancuernas" },
  { name: "Elevaciones Laterales", muscle: "Hombros", machine: false, equipment: "Mancuernas" },
  { name: "Elevaciones Frontales", muscle: "Hombros", machine: false, equipment: "Mancuernas" },
  { name: "Pájaros", muscle: "Hombros", machine: false, equipment: "Mancuernas" },
  { name: "Press Hombro Máquina", muscle: "Hombros", machine: true, equipment: "Máquina" },
  { name: "Curl Bíceps Barra", muscle: "Bíceps", machine: false, equipment: "Barra" },
  { name: "Curl Mancuernas", muscle: "Bíceps", machine: false, equipment: "Mancuernas" },
  { name: "Curl Martillo", muscle: "Bíceps", machine: false, equipment: "Mancuernas" },
  { name: "Curl Concentrado", muscle: "Bíceps", machine: false, equipment: "Mancuernas" },
  { name: "Curl Polea", muscle: "Bíceps", machine: true, equipment: "Polea" },
  { name: "Press Francés", muscle: "Tríceps", machine: false, equipment: "Barra" },
  { name: "Extensión Tríceps Mancuerna", muscle: "Tríceps", machine: false, equipment: "Mancuernas" },
  { name: "Fondos Tríceps", muscle: "Tríceps", machine: false, equipment: "Cuerpo" },
  { name: "Tríceps Polea", muscle: "Tríceps", machine: true, equipment: "Polea" },
  { name: "Sentadilla", muscle: "Cuádriceps", machine: false, equipment: "Barra" },
  { name: "Sentadilla Goblet", muscle: "Cuádriceps", machine: false, equipment: "Mancuernas" },
  { name: "Zancadas", muscle: "Cuádriceps", machine: false, equipment: "Mancuernas" },
  { name: "Prensa de Pierna", muscle: "Cuádriceps", machine: true, equipment: "Máquina" },
  { name: "Extensión Cuádriceps", muscle: "Cuádriceps", machine: true, equipment: "Máquina" },
  { name: "Peso Muerto Rumano", muscle: "Femoral", machine: false, equipment: "Barra" },
  { name: "Curl Femoral Tumbado", muscle: "Femoral", machine: true, equipment: "Máquina" },
  { name: "Hip Thrust", muscle: "Glúteos", machine: false, equipment: "Barra" },
  { name: "Abductores", muscle: "Glúteos", machine: true, equipment: "Máquina" },
  { name: "Pantorrillas Máquina", muscle: "Pantorrillas", machine: true, equipment: "Máquina" },
  { name: "Elevación de Talones", muscle: "Pantorrillas", machine: false, equipment: "Cuerpo" },
  { name: "Plancha", muscle: "Core", machine: false, equipment: "Cuerpo" },
  { name: "Crunch", muscle: "Core", machine: false, equipment: "Cuerpo" },
  { name: "Elevación de Piernas", muscle: "Core", machine: false, equipment: "Cuerpo" },
  { name: "Crunch Polea", muscle: "Core", machine: true, equipment: "Polea" },
  { name: "Rueda Abdominal", muscle: "Core", machine: false, equipment: "Accesorio" },
  { name: "Cinta Correr", muscle: "Cardio", machine: true, equipment: "Máquina" },
  { name: "Bicicleta Estática", muscle: "Cardio", machine: true, equipment: "Máquina" },
  { name: "Elíptica", muscle: "Cardio", machine: true, equipment: "Máquina" },
  { name: "Burpees", muscle: "Cardio", machine: false, equipment: "Cuerpo" },
  { name: "Saltar Cuerda", muscle: "Cardio", machine: false, equipment: "Accesorio" },
];
const MUSCLES = [...new Set(EXERCISE_DB.map(e => e.muscle))];

// ─── Exercise GIF Hook ────────────────────────────────────────────────────────
function useExerciseGif(exName) {
  const [gifUrl, setGifUrl] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!exName || exName === "__custom__") { setGifUrl(null); return; }
    setLoading(true);
    setGifUrl(null);

    const nameMap = {
      "Press Banca":                 "barbell bench press",
      "Press Banca Inclinado":       "incline bench press",
      "Press Mancuernas":            "dumbbell bench press",
      "Aperturas Mancuernas":        "dumbbell fly",
      "Fondos":                      "chest dip",
      "Crossover Polea":             "cable crossover",
      "Press Pecho Máquina":         "machine chest press",
      "Dominadas":                   "pull-up",
      "Remo con Barra":              "barbell bent over row",
      "Remo Mancuerna":              "dumbbell one arm row",
      "Peso Muerto":                 "barbell deadlift",
      "Pullover":                    "dumbbell pullover",
      "Jalón al Pecho":              "cable lat pulldown",
      "Remo Polea Baja":             "seated cable row",
      "Face Pull":                   "cable face pull",
      "Press Hombro Barra":          "barbell overhead press",
      "Press Arnold":                "arnold press",
      "Elevaciones Laterales":       "dumbbell lateral raise",
      "Elevaciones Frontales":       "dumbbell front raise",
      "Pájaros":                     "dumbbell reverse fly",
      "Press Hombro Máquina":        "machine shoulder press",
      "Curl Bíceps Barra":           "barbell curl",
      "Curl Mancuernas":             "dumbbell bicep curl",
      "Curl Martillo":               "hammer curl",
      "Curl Concentrado":            "concentration curl",
      "Curl Polea":                  "cable curl",
      "Press Francés":               "skull crusher",
      "Extensión Tríceps Mancuerna": "dumbbell tricep extension",
      "Fondos Tríceps":              "tricep dip",
      "Tríceps Polea":               "triceps pushdown",
      "Sentadilla":                  "barbell squat",
      "Sentadilla Goblet":           "dumbbell goblet squat",
      "Zancadas":                    "barbell lunge",
      "Prensa de Pierna":            "leg press",
      "Extensión Cuádriceps":        "leg extension",
      "Peso Muerto Rumano":          "romanian deadlift",
      "Curl Femoral Tumbado":        "lying leg curl",
      "Hip Thrust":                  "barbell hip thrust",
      "Abductores":                  "hip abduction",
      "Pantorrillas Máquina":        "calf raise",
      "Elevación de Talones":        "standing calf raise",
      "Plancha":                     "plank",
      "Crunch":                      "crunch",
      "Elevación de Piernas":        "hanging leg raise",
      "Crunch Polea":                "cable crunch",
      "Rueda Abdominal":             "ab wheel roller",
      "Burpees":                     "burpee",
      "Saltar Cuerda":               "jump rope",
      "Cinta Correr":                "run",
      "Bicicleta Estática":          "stationary bike",
      "Elíptica":                    "elliptical",
    };

    const searchName = nameMap[exName] || exName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
    fetch(`https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(searchName)}?limit=1&offset=0`, {
      method: "GET",
      headers: {
        "x-rapidapi-key": "process.env.RAPIDAPI_KEY",
        "x-rapidapi-host": "exercisedb.p.rapidapi.com"
      }
    })
    .then(r => r.json())
    .then(data => {
      console.log("ExerciseDB response:", data);
console.log("gifUrl:", data[0]?.gifUrl);
console.log("FULL OBJECT:", JSON.stringify(data[0]));
      if (Array.isArray(data) && data.length > 0 && data[0].id) {
  setGifUrl(`https://v1.exercisedb.io/image/${data[0].id}.gif`);
      } else {
        setGifUrl(null);
      }
      setLoading(false);
    })
    .catch((err) => {
      console.log("ExerciseDB error:", err);
      setGifUrl(null);
      setLoading(false);
    });
  }, [exName]);

  return { gifUrl, loading };
}

// ─── Exercise GIF Display ─────────────────────────────────────────────────────
function ExerciseGif({ exName, size = 120 }) {
  const { gifUrl, loading } = useExerciseGif(exName);
  if (!exName || exName === "__custom__") return null;
  return (
    <div style={{
      width: size, height: size, borderRadius: 12, overflow: "hidden",
      background: "var(--input-bg)", border: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0
    }}>
      {loading && <div style={{ fontSize: 24 }}>⏳</div>}
      {!loading && gifUrl && (
        <img
          src={gifUrl} alt={exName}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={e => { e.target.style.display = "none"; }}
        />
      )}
      {!loading && !gifUrl && <div style={{ fontSize: 24 }}>🏋️</div>}
    </div>
  );
}

// ─── 1RM Calculator ───────────────────────────────────────────────────────────
function calc1RM(weight, reps) {
  if (!weight || !reps || reps <= 0) return 0;
  const w = parseFloat(weight), r = parseFloat(reps);
  if (r === 1) return w;
  return Math.round(w * (1 + r / 30));
}

// ─── Session Volume & PR Detection ───────────────────────────────────────────
function calcSessionVolume(session) {
  return (session.exercises || []).reduce((acc, ex) => {
    if (ex.sets?.length > 0) {
      return acc + ex.sets.reduce((s, st) => s + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||1), 0);
    }
    return acc + (parseFloat(ex.weight)||0) * (parseFloat(ex.reps)||1);
  }, 0);
}

function detectNewPRs(newSession, existingSessions) {
  const newPRs = [];
  (newSession.exercises || []).forEach(ex => {
    const newW = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
    const newR = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)) : parseFloat(ex.reps)||0;
    const new1RM = calc1RM(newW, newR);
    if (new1RM <= 0) return;
    const prevBest = existingSessions
      .flatMap(s => (s.exercises||[]).filter(e => e.name === ex.name))
      .reduce((best, e) => {
        const w = e.sets?.length>0 ? Math.max(...e.sets.map(st=>parseFloat(st.weight)||0)) : parseFloat(e.weight)||0;
        const r = e.sets?.length>0 ? Math.max(...e.sets.map(st=>parseFloat(st.reps)||0)) : parseFloat(e.reps)||0;
        return Math.max(best, calc1RM(w, r));
      }, 0);
    if (new1RM > prevBest) newPRs.push({ name: ex.name, rm: new1RM });
  });
  return newPRs;
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data }) {
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

// ─── PR Confetti ──────────────────────────────────────────────────────────────
function PRConfetti({ prs, onDone }) {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const COLORS = ["#3b82f6","#f59e0b","#22c55e","#ec4899","#8b5cf6","#f97316","#ffffff"];
    const particles = Array.from({ length: 160 }, () => ({
      x: canvas.width * 0.2 + Math.random() * canvas.width * 0.6,
      y: -20 - Math.random() * 180,
      w: 6 + Math.random() * 9, h: 9 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 5, vy: 2.5 + Math.random() * 4.5,
      angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.25,
      opacity: 1, shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    let frame = 0, raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.99; p.angle += p.spin;
        if (frame > 90) p.opacity = Math.max(0, p.opacity - 0.016);
        ctx.save(); ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillStyle = p.color;
        if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0,0,p.w/2,0,Math.PI*2); ctx.fill(); }
        else { ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); }
        ctx.restore();
      });
      if (frame < 180) raf = requestAnimationFrame(draw);
      else { ctx.clearRect(0,0,canvas.width,canvas.height); if(onDone) onDone(); }
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9998 }} />
      <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)",
        zIndex:9999, pointerEvents:"none", textAlign:"center",
        animation:"prBannerIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>
        <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.97),rgba(251,191,36,0.97))",
          border:"2px solid rgba(255,255,255,0.3)", borderRadius:20, padding:"20px 32px",
          boxShadow:"0 20px 60px rgba(245,158,11,0.5)", maxWidth:320 }}>
          <div style={{ fontSize:40, marginBottom:6 }}>🏆</div>
          <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:28, fontWeight:900,
            color:"#0f172a", letterSpacing:1, marginBottom:8 }}>¡NUEVO RÉCORD!</div>
          {prs.slice(0,3).map(pr => (
            <div key={pr.name} style={{ fontSize:13, fontWeight:700, color:"#1e293b",
              background:"rgba(255,255,255,0.4)", borderRadius:8, padding:"4px 10px", marginBottom:4 }}>
              {pr.name} → {pr.rm} kg 1RM
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── Active Workout Mode ──────────────────────────────────────────────────────
function ActiveWorkoutModal({ exercises, onClose, onSave, unit }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [restSecs, setRestSecs] = useState(0);
  const [restRunning, setRestRunning] = useState(false);
  const [currentEx, setCurrentEx] = useState(0);
  const [exData, setExData] = useState(
    exercises.map(ex => ({ ...ex, sets: ex.sets?.length ? ex.sets.map(s => ({...s})) : [{ id: uid(), weight: "", reps: "", done: false }] }))
  );
  const [notes, setNotes] = useState({});
  const mainRef = useRef();
  const restRef = useRef();

  useEffect(() => {
    if (running) { mainRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else clearInterval(mainRef.current);
    return () => clearInterval(mainRef.current);
  }, [running]);

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.2, 0.4].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = i === 2 ? 880 : 660;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.18);
      });
    } catch(e) {}
  }

  useEffect(() => {
    if (restRunning && restSecs > 0) {
      restRef.current = setInterval(() => setRestSecs(s => {
        if (s <= 1) {
          clearInterval(restRef.current);
          setRestRunning(false);
          playBeep();
          return 0;
        }
        return s - 1;
      }), 1000);
    } else clearInterval(restRef.current);
    return () => clearInterval(restRef.current);
  }, [restRunning, restSecs]);

  const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const totalSets = exData.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const pct = totalSets > 0 ? doneSets / totalSets : 0;

  function toggleSet(exIdx, setIdx) {
    setExData(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done })
    }));
    if (!exData[exIdx].sets[setIdx].done) {
      setRestSecs(90); setRestRunning(true);
    }
  }
  function updateSet(exIdx, setIdx, field, val) {
    setExData(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val })
    }));
  }
  function addSet(exIdx) {
    setExData(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: [...ex.sets, { id: uid(), weight: ex.sets[ex.sets.length-1]?.weight || "", reps: ex.sets[ex.sets.length-1]?.reps || "", done: false }]
    }));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 2000, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>⚡ Entrenando</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{doneSets}/{totalSets} series completadas</div>
        </div>
        {/* Big timer */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 800, color: running ? "var(--accent)" : "var(--text-muted)", letterSpacing: 2 }}>{fmt(elapsed)}</div>
          <button onClick={() => setRunning(r => !r)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>{running ? "⏸ Pausar" : "▶ Reanudar"}</button>
        </div>
        <button onClick={() => { setRunning(false); onSave(exData); }} style={{ background: "var(--accent)", border: "none", color: "white", borderRadius: 10, padding: "10px 16px", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
          💾 Finalizar
        </button>
        <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 }}>✕</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--border)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "linear-gradient(90deg, var(--accent), #22c55e)", width: `${pct * 100}%`, transition: "width 0.4s ease", borderRadius: 2 }} />
      </div>

      {/* Rest timer banner */}
      {restRunning && restSecs > 0 && (
        <div style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)", margin: "8px 16px 0", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 20 }}>⏱️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "#22c55e", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Descanso</div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 800, color: "#22c55e" }}>{fmt(restSecs)}</div>
          </div>
          <button onClick={() => { setRestRunning(false); setRestSecs(0); }} style={{ background: "none", border: "1px solid #22c55e", color: "#22c55e", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12 }}>Saltar</button>
        </div>
      )}

      {/* Exercise tabs */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", overflowX: "auto", flexShrink: 0 }}>
        {exData.map((ex, i) => {
          const done = ex.sets.every(s => s.done) && ex.sets.length > 0;
          return (
            <button key={i} onClick={() => setCurrentEx(i)} style={{ background: currentEx === i ? "var(--accent)" : done ? "rgba(34,197,94,0.15)" : "var(--card)", border: `1px solid ${currentEx === i ? "var(--accent)" : done ? "#22c55e" : "var(--border)"}`, color: currentEx === i ? "white" : done ? "#22c55e" : "var(--text-muted)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
              {done ? "✓ " : ""}{ex.name}
            </button>
          );
        })}
      </div>

      {/* Current exercise */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {exData[currentEx] && (
          <div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{exData[currentEx].name}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>{exData[currentEx].sets.filter(s=>s.done).length}/{exData[currentEx].sets.length} series</div>

            {/* Sets */}
            <div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "0 4px" }}>
              <div style={{ width: 36, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Serie</div>
              <div style={{ flex: 1, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Peso ({unit})</div>
              <div style={{ flex: 1, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Reps</div>
              <div style={{ width: 64, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Hecho</div>
            </div>
            {exData[currentEx].sets.map((s, j) => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, padding: "10px 4px", background: s.done ? "rgba(34,197,94,0.08)" : "var(--card)", border: `1px solid ${s.done ? "rgba(34,197,94,0.3)" : "var(--border)"}`, borderRadius: 10 }}>
                <div style={{ width: 36, textAlign: "center", fontWeight: 800, fontSize: 15, fontFamily: "Barlow Condensed, sans-serif", color: s.done ? "#22c55e" : "var(--text-muted)" }}>S{j+1}</div>
                <input value={s.weight} onChange={e => updateSet(currentEx, j, "weight", numDot(e.target.value))} style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px", color: "var(--text)", fontFamily: "Barlow, sans-serif", fontSize: 15, fontWeight: 700, textAlign: "center", outline: "none" }} placeholder="0" />
                <input value={s.reps} onChange={e => updateSet(currentEx, j, "reps", numDot(e.target.value))} style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px", color: "var(--text)", fontFamily: "Barlow, sans-serif", fontSize: 15, fontWeight: 700, textAlign: "center", outline: "none" }} placeholder="0" />
                <button onClick={() => toggleSet(currentEx, j)} style={{ width: 64, height: 40, background: s.done ? "#22c55e" : "var(--input-bg)", border: `2px solid ${s.done ? "#22c55e" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontSize: 18, transition: "all 0.2s" }}>
                  {s.done ? "✓" : "○"}
                </button>
              </div>
            ))}
            <button onClick={() => addSet(currentEx)} style={{ width: "100%", background: "none", border: "1px dashed var(--border)", color: "var(--text-muted)", borderRadius: 10, padding: 10, cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 13, marginTop: 4 }}>+ Serie</button>

            {/* Note for exercise */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>Nota del ejercicio</div>
              <textarea value={notes[exData[currentEx].name] || ""} onChange={e => setNotes(n => ({...n, [exData[currentEx].name]: e.target.value}))} style={{ width: "100%", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", color: "var(--text)", fontFamily: "Barlow, sans-serif", fontSize: 13, resize: "none", minHeight: 60, outline: "none" }} placeholder="Observaciones, sensaciones, técnica..." />
            </div>

            {/* Next/Prev */}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {currentEx > 0 && <button onClick={() => setCurrentEx(i => i-1)} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 10, padding: "10px", cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 13 }}>← Anterior</button>}
              {currentEx < exData.length - 1 && <button onClick={() => setCurrentEx(i => i+1)} style={{ flex: 1, background: "var(--accent)", border: "none", color: "white", borderRadius: 10, padding: "10px", cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700 }}>Siguiente →</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



// ─── Templates Modal ──────────────────────────────────────────────────────────
function TemplatesModal({ sessions, onLoad, onClose }) {
  const [templates, setTemplates] = useState(() => load("gym_templates", []));
  const [tab, setTab] = useState("mine");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editName, setEditName] = useState("");
  const [editExercises, setEditExercises] = useState([]);
  const [newExercise, setNewExercise] = useState("");

  function saveTemplates(t) { setTemplates(t); store("gym_templates", t); }
  function deleteTemplate(id) { saveTemplates(templates.filter(t => t.id !== id)); }
  function loadTemplate(t) { onLoad(t.workout, t.exercises); onClose(); }

  const recentWorkouts = [...new Map(sessions.map(s => [s.workout, s])).values()].slice(0, 5);

  function saveFromSession(s) {
    if (!s.workout) return;
    const t = { id: uid(), name: s.workout, workout: s.workout, exercises: (s.exercises||[]).map(e => ({ ...e, id: uid(), sets: [], weight: "", reps: "" })), createdAt: todayStr() };
    saveTemplates([...templates, t]);
  }

  function openEditor(t) {
    setEditingTemplate(t);
    setEditName(t.name);
    setEditExercises(t.exercises || []);
    setNewExercise("");
  }

  function openNew() {
    const t = { id: uid(), name: "", workout: "", exercises: [], createdAt: todayStr() };
    openEditor(t);
  }

  function saveEdit() {
    if (!editName.trim()) return alert("Ponle un nombre a la plantilla");
    const updated = { ...editingTemplate, name: editName, workout: editName, exercises: editExercises };
    const exists = templates.find(t => t.id === updated.id);
    if (exists) saveTemplates(templates.map(t => t.id === updated.id ? updated : t));
    else saveTemplates([...templates, updated]);
    setEditingTemplate(null);
  }

const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newSeries, setNewSeries] = useState("3");
  const [exCustomInput, setExCustomInput] = useState("");
  const [exCustomMuscleTpl, setExCustomMuscleTpl] = useState("");
  function addExercise() {
    const finalName = newExercise === "__custom__" ? exCustomInput.trim() : newExercise.trim();
    if (!finalName) return;
    if (newExercise === "__custom__" && exCustomMuscleTpl && !EXERCISE_DB.find(e => e.name === finalName)) {
      EXERCISE_DB.push({ name: finalName, muscle: exCustomMuscleTpl, machine: false, equipment: "Personalizado" });
    }
    setEditExercises(prev => [...prev, { id: uid(), name: finalName, sets: [], weight: newWeight || "0", reps: newReps || "0", series: newSeries || "3" }]);
    setNewExercise(""); setExCustomInput(""); setExCustomMuscleTpl(""); setNewWeight(""); setNewReps(""); setNewSeries("3");
  }

  function removeExercise(id) {
    setEditExercises(prev => prev.filter(e => e.id !== id));
  }

  if (editingTemplate) return (
    <div className="overlay" onClick={() => setEditingTemplate(null)}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"85vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 {editingTemplate.name || "Nueva plantilla"}</h3>
          <button className="close-btn" onClick={() => setEditingTemplate(null)}>✕</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Nombre</div>
          <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ej: Push Day, Piernas..." style={{ width:"100%" }} />
        </div>
        <div className="card-label">Ejercicios</div>
        {editExercises.length === 0 && <p style={{ color:"var(--text-muted)", fontSize:13, marginBottom:12 }}>Sin ejercicios aún.</p>}
        {editExercises.map(ex => (
          <div key={ex.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, marginBottom:8 }}>
            <div>
              <span style={{ fontWeight:600, fontSize:14 }}>💪 {ex.name}</span>
              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{ex.weight}kg · {ex.reps} reps · {ex.series} series</div>
            </div>
            <button className="btn-ghost small danger" onClick={() => removeExercise(ex.id)}>🗑️</button>
          </div>
        ))}
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginTop:8, marginBottom:20 }}>
          <select className="input" value={newExercise} onChange={e => setNewExercise(e.target.value)} style={{ width:"100%" }}>
  <option value="">— Selecciona ejercicio —</option>
  {EXERCISE_DB.map(ex => (
    <option key={ex.name} value={ex.name}>{ex.muscle} · {ex.name}</option>
  ))}
  <option value="__custom__">✏️ Escribir personalizado...</option>
</select>
{newExercise === "__custom__" && (
  <>
    <input className="input" style={{ marginTop: 6 }} placeholder="Nombre del ejercicio..." value={exCustomInput} onChange={e => setExCustomInput(lettersOnly(e.target.value))} autoFocus />
    <select className="input" style={{ marginTop: 6 }} value={exCustomMuscleTpl} onChange={e => setExCustomMuscleTpl(e.target.value)}>
      <option value="">— Músculo principal —</option>
      {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
    </select>
  </>
)}          <div style={{ display:"flex", gap:8 }}>
            <input className="input" value={newWeight} onChange={e => setNewWeight(e.target.value)} placeholder="Peso (kg)" style={{ flex:1 }} type="number" />
            <input className="input" value={newReps} onChange={e => setNewReps(e.target.value)} placeholder="Reps" style={{ flex:1 }} type="number" />
            <input className="input" value={newSeries} onChange={e => setNewSeries(e.target.value)} placeholder="Series" style={{ flex:1 }} type="number" />
            <button className="btn-primary" onClick={addExercise}>+ Agregar</button>
          </div>
        </div>
        <button className="btn-primary" style={{ width:"100%", fontSize:15 }} onClick={saveEdit}>💾 Guardar plantilla</button>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"85vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 Plantillas</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tab-row" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${tab==="mine"?"active":""}`} onClick={() => setTab("mine")}>Mis plantillas</button>
          <button className={`tab-btn ${tab==="quick"?"active":""}`} onClick={() => setTab("quick")}>Desde historial</button>
        </div>

        {tab === "mine" && (
          <div>
            <button className="btn-primary" style={{ width:"100%", marginBottom:16, fontSize:15 }} onClick={openNew}>+ Crear plantilla</button>
            {templates.length === 0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center", padding:"20px 0" }}>Aún no tienes plantillas. Crea una o guarda una desde "Desde historial".</p>}
            {templates.map(t => (
              <div key={t.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{t.name}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{(t.exercises||[]).length} ejercicios · {fmtDate(t.createdAt)}</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-ghost small" onClick={() => openEditor(t)}>✏️ Editar</button>
                  <button className="btn-ghost small" onClick={() => loadTemplate(t)}>▶ Usar</button>
                  <button className="btn-ghost small danger" onClick={() => deleteTemplate(t.id)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "quick" && (
          <div>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:14 }}>Guarda una sesión reciente como plantilla reutilizable:</p>
            {recentWorkouts.length === 0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center" }}>Sin sesiones aún.</p>}
            {recentWorkouts.map(s => (
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, marginBottom:8 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>{s.workout}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{(s.exercises||[]).length} ejercicios · {fmtDate(s.date)}</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-ghost small" onClick={() => loadTemplate(s)}>▶ Usar</button>
                  <button className="btn-ghost small" onClick={() => saveFromSession(s)}>💾 Guardar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────────
function WeeklyChart({ sessions }) {
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

  return (
    <div className="card">
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}>
        <div className="card-label" style={{margin:0}}>📈 Progreso</div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          {[["day","Día"],["week","Semana"],["month","Mes"],["year","Año"]].map(([v,l])=>(
            <button key={v} className={`muscle-chip ${period===v?"active":""}`} style={{padding:"3px 10px",fontSize:11}} onClick={()=>setPeriod(v)}>{l}</button>
          ))}
        </div>
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <button className={`muscle-chip ${metric==="count"?"active":""}`} style={{padding:"3px 10px",fontSize:11}} onClick={()=>setMetric("count")}>Sesiones</button>
        <button className={`muscle-chip ${metric==="vol"?"active":""}`} style={{padding:"3px 10px",fontSize:11}} onClick={()=>setMetric("vol")}>Volumen</button>
      </div>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:90}}>
        {data.map((d,i)=>{
          const val=metric==="count"?d.count:d.vol;
          const h=maxVal>0?Math.max((val/maxVal)*82,val>0?4:0):0;
          const isLast=i===data.length-1;
          return (
            <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
              <div style={{fontSize:9,color:"var(--text-muted)",fontWeight:700,textAlign:"center"}}>{val>0?(metric==="vol"?`${(val/1000).toFixed(1)}t`:val):""}</div>
              <div style={{width:"100%",height:h,background:isLast?"var(--accent)":"rgba(59,130,246,0.35)",borderRadius:"3px 3px 0 0",transition:"height 0.4s"}}/>
              <div style={{fontSize:8,color:isLast?"var(--accent)":"var(--text-muted)",fontWeight:isLast?700:400,textAlign:"center",whiteSpace:"nowrap",overflow:"hidden",width:"100%",textOverflow:"ellipsis"}}>{d.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Weekly Goal Modal ────────────────────────────────────────────────────────
function WeeklyGoalModal({ goal, onSave, onClose, sessions }) {
  const [target, setTarget] = useState(goal?.target || 4);
  const thisWeek = sessions.filter(s => (new Date() - new Date(s.date+"T00:00:00"))/86400000 <= 7).length;
  const pct = Math.min(thisWeek / target, 1);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🎯 Meta semanal</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ textAlign:"center", marginBottom:20 }}>
          <div style={{ fontSize:48, fontWeight:800, fontFamily:"Barlow Condensed, sans-serif", color: pct>=1?"#22c55e":"var(--accent)" }}>{thisWeek}<span style={{ fontSize:24, color:"var(--text-muted)" }}>/{target}</span></div>
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
        <button className="btn-primary" style={{ width:"100%" }} onClick={() => { onSave({ target }); onClose(); }}>💾 Guardar meta</button>
      </div>
    </div>
  );
}

// ─── Badges / Logros ──────────────────────────────────────────────────────────
const BADGE_DEFS = [
  { id: "first",       icon: "🏋️", name: "Primera sesión",    desc: "Completaste tu primera sesión",          check: (s) => s.length >= 1 },
  { id: "sessions5",   icon: "🔥", name: "En racha",          desc: "5 sesiones completadas",                 check: (s) => s.length >= 5 },
  { id: "sessions10",  icon: "💪", name: "Dedicado",          desc: "10 sesiones completadas",                check: (s) => s.length >= 10 },
  { id: "sessions25",  icon: "🦾", name: "Consistente",       desc: "25 sesiones completadas",                check: (s) => s.length >= 25 },
  { id: "sessions50",  icon: "🏆", name: "Veterano",          desc: "50 sesiones completadas",                check: (s) => s.length >= 50 },
  { id: "pr1",         icon: "⭐", name: "Primer PR",         desc: "Superaste un récord personal",           check: (s, prs) => Object.keys(prs).length >= 1 },
  { id: "pr5",         icon: "🌟", name: "Máquina de PRs",    desc: "5 récords personales distintos",         check: (s, prs) => Object.keys(prs).length >= 5 },
  { id: "variety",     icon: "🎯", name: "Variado",           desc: "10 ejercicios distintos registrados",    check: (s) => new Set(s.flatMap(x => (x.exercises||[]).map(e=>e.name))).size >= 10 },
  { id: "streak3",     icon: "🔑", name: "3 días seguidos",   desc: "Entrenaste 3 días consecutivos",         check: (s) => getStreak(s) >= 3 },
  { id: "streak7",     icon: "🗓️", name: "Semana perfecta",  desc: "7 días consecutivos entrenando",         check: (s) => getStreak(s) >= 7 },
  { id: "heavy",       icon: "🏗️", name: "Pesado",           desc: "Registraste 100kg+ en un ejercicio",     check: (s) => s.some(x => (x.exercises||[]).some(e => parseFloat(e.weight) >= 100 || (e.sets||[]).some(st => parseFloat(st.weight) >= 100))) },
  { id: "early",       icon: "🌅", name: "Madrugador",        desc: "Sesión registrada antes de las 8am",     check: (s) => false }, // can't detect time easily, just decorative
];

function getStreak(sessions) {
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  let check = new Date(); check.setHours(0,0,0,0);
  for (let d of dates) {
    const sd = new Date(d + "T00:00:00");
    const diff = Math.round((check - sd) / 86400000);
    if (diff <= 1) { streak++; check = sd; } else break;
  }
  return streak;
}

function getPRs(sessions) {
  const prs = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
    const r = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps)||0)) : parseFloat(ex.reps)||0;
    const rm = calc1RM(w, r);
    if (!prs[ex.name] || rm > prs[ex.name].rm) prs[ex.name] = { rm, date: s.date };
  }));
  return prs;
}

function BadgesModal({ sessions, onClose }) {
  const prs = getPRs(sessions);
  const earned = BADGE_DEFS.filter(b => b.check(sessions, prs));
  const locked = BADGE_DEFS.filter(b => !b.check(sessions, prs));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "85vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🏅 Logros</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>{earned.length} de {BADGE_DEFS.length} logros desbloqueados</div>
        
        {earned.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#f59e0b", textTransform: "uppercase", marginBottom: 12 }}>Desbloqueados ✨</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 24 }}>
              {earned.map(b => (
                <div key={b.id} style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.35)", borderRadius: 12, padding: "14px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 32, marginBottom: 6 }}>{b.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {locked.length > 0 && (
          <>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Bloqueados 🔒</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {locked.map(b => (
                <div key={b.id} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 12px", textAlign: "center", opacity: 0.5 }}>
                  <div style={{ fontSize: 32, marginBottom: 6, filter: "grayscale(1)" }}>{b.icon}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{b.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{b.desc}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}


// ─── Muscle Map ───────────────────────────────────────────────────────────────
const MUSCLE_GROUPS = {
  "Pecho":       { fill: "#3b82f6", paths: ["M 120 110 Q 140 100 155 115 Q 145 135 125 140 Q 108 130 110 115 Z", "M 180 110 Q 160 100 145 115 Q 155 135 175 140 Q 192 130 190 115 Z"] },
  "Hombros":     { fill: "#8b5cf6", paths: ["M 105 100 Q 95 90 100 80 Q 115 75 120 90 Q 115 100 108 103 Z", "M 195 100 Q 205 90 200 80 Q 185 75 180 90 Q 185 100 192 103 Z"] },
  "Bíceps":      { fill: "#ec4899", paths: ["M 95 115 Q 85 125 86 140 Q 96 145 104 135 Q 108 120 100 112 Z", "M 205 115 Q 215 125 214 140 Q 204 145 196 135 Q 192 120 200 112 Z"] },
  "Tríceps":     { fill: "#f97316", paths: ["M 92 115 Q 80 125 82 142 Q 90 150 96 140 Q 98 125 96 113 Z", "M 208 115 Q 220 125 218 142 Q 210 150 204 140 Q 202 125 204 113 Z"] },
  "Espalda":     { fill: "#10b981", paths: ["M 115 110 Q 150 105 185 110 Q 185 145 150 155 Q 115 145 115 110 Z"] },
  "Core":        { fill: "#f59e0b", paths: ["M 128 150 Q 150 147 172 150 Q 172 175 150 178 Q 128 175 128 150 Z"] },
  "Cuádriceps":  { fill: "#06b6d4", paths: ["M 120 190 Q 112 200 114 225 Q 130 230 136 215 Q 138 198 128 190 Z", "M 180 190 Q 188 200 186 225 Q 170 230 164 215 Q 162 198 172 190 Z"] },
  "Femoral":     { fill: "#84cc16", paths: ["M 118 190 Q 108 205 112 228 Q 122 235 128 220 Q 130 205 122 192 Z", "M 182 190 Q 192 205 188 228 Q 178 235 172 220 Q 170 205 178 192 Z"] },
  "Glúteos":     { fill: "#a855f7", paths: ["M 125 178 Q 150 172 175 178 Q 178 195 150 198 Q 122 195 125 178 Z"] },
  "Pantorrillas":{ fill: "#14b8a6", paths: ["M 116 240 Q 110 255 114 268 Q 124 270 128 258 Q 130 244 120 240 Z", "M 184 240 Q 190 255 186 268 Q 176 270 172 258 Q 170 244 180 240 Z"] },
  "Cardio":      { fill: "#ef4444", paths: ["M 140 108 Q 150 100 160 108 Q 162 120 150 128 Q 138 120 140 108 Z"] },
};

function MuscleMapModal({ sessions, onClose }) {
  const [period, setPeriod] = useState("week");
  
  const cutoff = new Date();
  if (period === "week") cutoff.setDate(cutoff.getDate() - 7);
  else if (period === "month") cutoff.setDate(cutoff.getDate() - 30);
  else cutoff.setFullYear(2000);

  const muscleCounts = {};
  sessions
    .filter(s => new Date(s.date + "T00:00:00") >= cutoff)
    .forEach(s => (s.exercises||[]).forEach(ex => {
      const dbEx = EXERCISE_DB.find(e => e.name === ex.name);
      if (dbEx) muscleCounts[dbEx.muscle] = (muscleCounts[dbEx.muscle] || 0) + 1;
    }));

  const maxCount = Math.max(...Object.values(muscleCounts), 1);
  const sorted = Object.entries(muscleCounts).sort((a,b) => b[1]-a[1]);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">💪 Mapa muscular</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tab-row" style={{ marginBottom: 20 }}>
          {[["week","Esta semana"],["month","Este mes"],["all","Todo"]].map(([v,l]) => (
            <button key={v} className={`tab-btn ${period===v?"active":""}`} onClick={() => setPeriod(v)}>{l}</button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {/* SVG Body */}
          <div style={{ flex: "0 0 auto" }}>
            <svg width={300} height={340} viewBox="0 0 300 340" style={{ display: "block" }}>
              {/* Body outline */}
              <ellipse cx={150} cy={72} rx={28} ry={28} fill="var(--border)" stroke="var(--border)" strokeWidth={1}/>
              <rect x={118} y={98} width={64} height={90} rx={10} fill="var(--border)"/>
              <rect x={90} y={100} width={28} height={75} rx={8} fill="var(--border)"/>
              <rect x={182} y={100} width={28} height={75} rx={8} fill="var(--border)"/>
              <rect x={80} y={170} width={22} height={55} rx={7} fill="var(--border)"/>
              <rect x={198} y={170} width={22} height={55} rx={7} fill="var(--border)"/>
              <rect x={120} y={188} width={26} height={90} rx={8} fill="var(--border)"/>
              <rect x={154} y={188} width={26} height={90} rx={8} fill="var(--border)"/>
              <rect x={122} y={276} width={22} height={55} rx={7} fill="var(--border)"/>
              <rect x={156} y={276} width={22} height={55} rx={7} fill="var(--border)"/>

              {/* Colored muscle groups */}
              {Object.entries(MUSCLE_GROUPS).map(([muscle, { fill, paths }]) => {
                const count = muscleCounts[muscle] || 0;
                const opacity = count > 0 ? 0.3 + (count / maxCount) * 0.65 : 0;
                return paths.map((d, i) => (
                  <path key={`${muscle}-${i}`} d={d} fill={fill} opacity={opacity} style={{ transition: "opacity 0.5s ease" }}>
                    <title>{muscle}: {count} series</title>
                  </path>
                ));
              })}

              {/* Labels for active muscles */}
              {Object.entries(muscleCounts).slice(0,3).map(([m]) => {
                const positions = { "Pecho":[150,127],"Hombros":[150,87],"Bíceps":[90,133],"Tríceps":[90,133],"Espalda":[150,132],"Core":[150,163],"Cuádriceps":[150,210],"Femoral":[150,210],"Glúteos":[150,188],"Pantorrillas":[150,255],"Cardio":[150,115] };
                return null; // keep clean, legend handles labels
              })}
            </svg>
          </div>

          {/* Legend & stats */}
          <div style={{ flex: 1, minWidth: 160 }}>
            {sorted.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin sesiones en este período.</p>
            ) : (
              <>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>Músculos trabajados</div>
                {sorted.map(([muscle, count]) => {
                  const color = MUSCLE_GROUPS[muscle]?.fill || "#64748b";
                  return (
                    <div key={muscle} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{muscle}</div>
                      <div style={{ width: 80, height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", background: color, width: `${(count/maxCount)*100}%`, borderRadius: 3 }} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", width: 20, textAlign: "right" }}>{count}</div>
                    </div>
                  );
                })}
                {Object.keys(MUSCLE_GROUPS).filter(m => !muscleCounts[m]).length > 0 && (
                  <div style={{ marginTop: 16, padding: "10px 12px", background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 12, color: "#f87171" }}>
                    💡 Sin trabajar: {Object.keys(MUSCLE_GROUPS).filter(m => !muscleCounts[m]).join(", ")}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Custom Timer Input ───────────────────────────────────────────────────────
function CustomTimerInput({ onApply }) {
  const [val, setVal] = useState("");
  function apply() {
    const n = parseInt(val);
    if (n >= 5) { onApply(n); setVal(""); }
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
      <input
        type="number" min={5} max={600} placeholder="ej: 150 seg"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && apply()}
        style={{ width: 100, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--text)", fontFamily: "Barlow, sans-serif", fontSize: 14, textAlign: "center", outline: "none" }}
      />
      <button className="btn-ghost small" onClick={apply}>Aplicar</button>
    </div>
  );
}

// ─── Rest Timer ───────────────────────────────────────────────────────────────
function RestTimer({ onClose }) {
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.2, 0.4].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = i === 2 ? 880 : 660;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.18);
      });
    } catch(e) {}
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= seconds) {
            clearInterval(intervalRef.current);
            setRunning(false);
            playBeep();
            return e + 1;
          }
          return e + 1;
        });
      }, 1000);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, seconds]);

  const remaining = Math.max(0, seconds - elapsed);
  const pct = elapsed / seconds;
  const r = 52, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  const done = elapsed >= seconds;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 300, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⏱️ Descanso</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <svg width={120} height={120} style={{ margin: "0 auto 16px", display: "block" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={done ? "#22c55e" : "var(--accent)"} strokeWidth={6}
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 1s linear" }} />
          <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text)" fontSize={22} fontWeight={800} fontFamily="Barlow Condensed, sans-serif">
            {done ? "✓" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>{done ? "Listo!" : "restante"}</text>
        </svg>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" }}>
          {[[60,"Cardio"],[90,"Hipertrofia ⭐"],[120,"Fuerza"],[180,"Pesado"]].map(([t, label]) => (
            <button key={t} className={`muscle-chip ${seconds === t ? "active" : ""}`} onClick={() => { setSeconds(t); setElapsed(0); setRunning(false); }} title={label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"6px 10px" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t < 60 ? `${t}s` : `${t/60}m`}</span>
              <span style={{ fontSize: 9, opacity: 0.75 }}>{label}</span>
            </button>
          ))}
        </div>
        <CustomTimerInput onApply={(v) => { setSeconds(v); setElapsed(0); setRunning(false); }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginBottom: 14 }}>
          💡 <b>Recomendación:</b> 60s cardio · 90s hipertrofia · 2-3m fuerza/pesado
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn-primary" style={{ fontSize: 15, padding: "10px 28px" }} onClick={() => { if (done) { setElapsed(0); setRunning(true); } else setRunning(r => !r); }}>
            {done ? "↺ Reiniciar" : running ? "⏸ Pausar" : "▶ Iniciar"}
          </button>
          {!done && elapsed > 0 && <button className="btn-ghost" onClick={() => { setElapsed(0); setRunning(false); }}>↺</button>}
        </div>
      </div>
    </div>
  );
}

// ─── 1RM Modal ────────────────────────────────────────────────────────────────
function OneRMModal({ onClose }) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const result = calc1RM(weight, reps);
  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🧮 Calculadora 1RM</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Fórmula de Epley: peso × (1 + reps / 30)</p>
        <div className="form-row">
          <div className="field">
            <label className="field-label">Peso (kg)</label>
            <input className="input" placeholder="0" value={weight} onChange={e => setWeight(numDot(e.target.value))} />
          </div>
          <div className="field">
            <label className="field-label">Repeticiones</label>
            <input className="input" placeholder="0" value={reps} onChange={e => setReps(numDot(e.target.value))} />
          </div>
        </div>
        {result > 0 && (
          <div>
            <div style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>1RM Estimado</div>
              <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "Barlow Condensed, sans-serif", color: "var(--text)" }}>{result} kg</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {percentages.map(p => (
                <div key={p} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p}%</div>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{Math.round(result * p / 100)} kg</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Body Stats Modal ─────────────────────────────────────────────────────────
function BodyStatsModal({ stats, onSave, onClose }) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState(stats.height || "170");
  const [gender, setGender] = useState(stats.gender || "male");
const [age, setAge] = useState(stats.age || "25");
  const [activity, setActivity] = useState(stats.activity || "moderate");
  const [goal, setGoal] = useState(stats.goal || "maintain");
  const [saved, setSaved] = useState(false);

  function save() {
    if (!weight) return;
    const newEntry = { date: todayStr(), weight: parseFloat(weight) || null };
    const newHeight = parseFloat(height) || stats.height;
    const newStats = {
      height: newHeight, gender, age: parseFloat(age)||stats.age||25, activity, goal,
      entries: [...(stats.entries || []), ...(weight ? [newEntry] : [])]
    };
    onSave(newStats);
    setWeight("");
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const entries = [...(stats.entries || [])].sort((a, b) => a.date.localeCompare(b.date));
  const vals = entries.map(e => e.weight).filter(Boolean);
  const currentWeight = vals.length > 0 ? vals[vals.length - 1] : null;
  const min = Math.min(...vals, 0), max = Math.max(...vals, 1), range = max - min || 1;
  const W = 400, H = 100;

  const bmi = stats.height && currentWeight
    ? (currentWeight / Math.pow(stats.height / 100, 2)).toFixed(1) : null;
  const bmiFeedback = !bmi ? null
    : bmi < 18.5 ? { label: "Bajo peso", color: "#60a5fa" }
    : bmi < 25   ? { label: "Normal ✓",  color: "#22c55e" }
    : bmi < 30   ? { label: "Sobrepeso", color: "#f97316" }
    :               { label: "Obesidad",  color: "#ef4444" };

  // TDEE calculation (Mifflin-St Jeor)
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

  // Weight prediction
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

    // Check if trend matches goal
    let trendAlert = null;
    if (stats.goal === "deficit" && slope > 0.03) trendAlert = { msg: "⚠️ Estás ganando peso, no perdiendo. Revisa tu alimentación.", color: "#f87171" };
    else if (stats.goal === "bulk" && slope < -0.03) trendAlert = { msg: "⚠️ Estás perdiendo peso. Aumenta las calorías.", color: "#f87171" };
    else if (stats.goal === "maintain" && Math.abs(slope) > 0.07) trendAlert = { msg: "⚠️ Tu peso está variando bastante. Ajusta la ingesta.", color: "#fbbf24" };
    else trendAlert = { msg: "✅ Tu tendencia va acorde a tu objetivo.", color: "#22c55e" };

    prediction = { pred30, pred90, weeklyChange, slope, trendAlert };
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⚖️ Peso & Estatura</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Basic inputs */}
        <div className="form-row" style={{ marginBottom: 10 }}>
          <div className="field">
            <label className="field-label">Estatura (cm)</label>
            <input className="input" placeholder="170" value={height} onChange={e => setHeight(numDot(e.target.value))} />
          </div>
          <div className="field">
            <label className="field-label">Peso hoy (kg)</label>
            <input className="input" placeholder="70.5" value={weight} onChange={e => setWeight(numDot(e.target.value))} onKeyDown={e => e.key==="Enter"&&save()} />
          </div>
          <div className="field" style={{ maxWidth: 70 }}>
            <label className="field-label">Edad</label>
            <input className="input" placeholder="25" value={age} onChange={e => setAge(e.target.value.replace(/[^0-9]/g,""))} />
          </div>
          <button className="btn-primary" style={{ alignSelf:"flex-end", padding:"10px 16px", fontSize:15, background: saved?"#22c55e":"var(--accent)" }} onClick={save}>
            {saved ? "✓" : "Guardar"}
          </button>
        </div>

        {/* Gender + Activity */}
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

        {/* Goal selector */}
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

        {/* Stats row */}
        {bmi && (
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {[
              ["Peso", `${currentWeight} kg`, "var(--accent)"],
              ["IMC",  bmi,                    bmiFeedback?.color],
              ["Estado", bmiFeedback?.label||"—", bmiFeedback?.color],
            ].map(([l,v,c]) => (
              <div key={l} style={{ flex:1, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginBottom:3 }}>{l}</div>
                <div style={{ fontSize:15, fontWeight:800, fontFamily:"Barlow Condensed, sans-serif", color:c }}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {/* Nutrition targets */}
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
                <div style={{ fontSize:11, color:"var(--text-muted)" }}>TDEE base</div>
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

        {/* Prediction */}
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

        {/* Chart */}
        {entries.length >= 2 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"var(--accent)", marginBottom:6 }}>Evolución de peso</div>
            <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 8px 4px", marginBottom:12 }}>
              <svg width="100%" viewBox={`0 0 ${W+4} ${H+36}`} style={{ display:"block" }}>
                {[0,0.25,0.5,0.75,1].map(t => {
                  const y = H - t*(H-10) - 2;
                  return <g key={t}>
                    <line x1={36} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4"/>
                    <text x={30} y={y+4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{(min+t*range).toFixed(1)}</text>
                  </g>;
                })}
                <polygon points={[
                  ...entries.map((e,i)=>`${36+(i/(entries.length-1))*(W-36)},${H-((e.weight-min)/range)*(H-12)-2}`),
                  `${W},${H}`,`36,${H}`
                ].join(" ")} fill="rgba(59,130,246,0.07)"/>
                <polyline points={entries.map((e,i)=>`${36+(i/(entries.length-1))*(W-36)},${H-((e.weight-min)/range)*(H-12)-2}`).join(" ")}
                  fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                {entries.map((e,i) => {
                  const x = 36+(i/(entries.length-1))*(W-36);
                  const y = H-((e.weight-min)/range)*(H-12)-2;
                  const isLast = i===entries.length-1;
                  return <g key={i}>
                    <circle cx={x} cy={y} r={isLast?5:3.5} fill={isLast?"#22c55e":"var(--accent)"} stroke="var(--card)" strokeWidth={1.5}/>
                    {isLast && <text x={x} y={y-10} textAnchor="middle" fill="#22c55e" fontSize={10} fontWeight={700}>{e.weight}kg</text>}
                    <text x={x} y={H+20} textAnchor="middle" fill="var(--text-muted)" fontSize={8}>{fmtDate(e.date)}</text>
                  </g>;
                })}
              </svg>
            </div>
          </>
        )}

        {/* History */}
        {entries.length > 0 && (
          <div style={{ maxHeight:120, overflowY:"auto" }}>
            {[...entries].reverse().map((e,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid var(--border)", fontSize:13 }}>
                <span style={{ color:"var(--text-muted)" }}>{fmtDate(e.date)}</span>
                <span style={{ fontWeight:700 }}>{e.weight} kg</span>
              </div>
            ))}
          </div>
        )}
        {entries.length===0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center" }}>Aún no hay registros de peso.</p>}
      </div>
    </div>
  );
}

function ExerciseEditor({ dayKey, exercises, isWeekly, removeExFromDay, addExToDay }) {
  const [exMuscle, setExMuscle] = useState("Todos");
  const [exName, setExName] = useState("");
  const [exCustomInput, setExCustomInput] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSets, setExSets] = useState([]);

  function addSet() { if (!exReps) return; setExSets(p => [...p, { id: uid(), weight: exWeight, reps: exReps }]); setExWeight(""); setExReps(""); }

  const filteredDB = exMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === exMuscle);

  return (
    <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--bg)", borderRadius: 10, border: "1px solid var(--border)" }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>Ejercicios del día</div>
      {exercises?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {exercises.map(ex => (
            <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", background: "var(--input-bg)", borderRadius: 8, marginBottom: 6, border: "1px solid var(--border)" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{ex.name}</span>
                {ex.sets?.length > 0
                  ? <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{ex.sets.length} series · {ex.sets.map((s,i)=>`${s.weight}kg×${s.reps}`).join(", ")}</span>
                  : ex.weight ? <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 8 }}>{ex.weight}kg × {ex.reps} reps</span> : null
                }
              </div>
              <button className="chip-del" onClick={() => removeExFromDay(dayKey, ex.id, isWeekly)}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {["Todos", ...MUSCLES].map(m => (
          <button key={m} className={`muscle-chip ${exMuscle===m?"active":""}`} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => { setExMuscle(m); setExName(""); }}>{m}</button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 6 }}>
        <div style={{ flex: 2, minWidth: 140 }}>
          <select className="input" style={{ fontSize: 12, padding: "7px 10px" }} value={exName} onChange={e => setExName(e.target.value)}>
            <option value="">— Ejercicio —</option>
            {filteredDB.map(ex => <option key={ex.name} value={ex.name}>{ex.name}{ex.machine?" 🔧":""}</option>)}
            <option value="__custom__">✏️ Personalizado...</option>
          </select>
          {exName === "__custom__" && <input className="input" style={{ marginTop: 4, fontSize: 12 }} placeholder="Nombre..." value={exCustomInput} onChange={e => setExCustomInput(e.target.value)} />}
        </div>
        <div style={{ flex: 1, minWidth: 70 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Peso kg" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} />
        </div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Reps" value={exReps} onChange={e => setExReps(numDot(e.target.value))} />
        </div>
        <button className="btn-ghost small" onClick={addSet}>+ Serie</button>
      </div>
      {exSets.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {exSets.map((s, i) => (
            <span key={s.id} className="set-chip">S{i+1}: {s.weight}kg×{s.reps}
              <button className="chip-del" onClick={() => setExSets(p => p.filter(x => x.id !== s.id))}>×</button>
            </span>
          ))}
        </div>
      )}
      <button className="btn-add-ex" style={{ fontSize: 12, padding: "7px" }} onClick={() => addExToDay(dayKey, isWeekly)}>+ Agregar ejercicio</button>
    </div>
  );
}
// ─── Weekly Planner Modal ─────────────────────────────────────────────────────
function WeeklyPlannerModal({ plan, onSave, onClose, sessions }) {
  const [mode, setMode] = useState(plan.mode || "weekly");
  // weekly: { 0: { name:"", exercises:[] }, ... }
  // Migrate old string format
  const migrateWeekly = (w) => {
    if (!w) return {};
    const out = {};
    Object.entries(w).forEach(([k, v]) => {
      if (typeof v === "string") out[k] = { name: v, exercises: [] };
      else out[k] = v;
    });
    return out;
  };
  const [weekly, setWeekly] = useState(() => migrateWeekly(plan.weekly));
  // cycle: [{ id, name, exercises:[] }]
  const migrateCycle = (c) => {
    if (!c?.length) return [{ id: uid(), name: "", exercises: [] }];
    return c.map(d => typeof d === "string"
      ? { id: uid(), name: d, exercises: [] }
      : { exercises: [], ...d }
    );
  };
  const [cycle, setCycle] = useState(() => migrateCycle(plan.cycle));
  const [cyclePos, setCyclePos] = useState(plan.cyclePos || 0);
  const [expandedDay, setExpandedDay] = useState(null); // which day is open for exercise editing
  const [exMuscle, setExMuscle] = useState("Todos");
  const [exName, setExName] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSets, setExSets] = useState([]);
  const [exSeriesCount, setExSeriesCount] = useState("3");
  const [exNote, setExNote] = useState("");
  const workoutNames = [...new Set(sessions.map(s => s.workout).filter(Boolean))];
  const todayDow = (new Date().getDay() + 6) % 7;

  function addExToDay(dayKey, isWeekly) {
    const finalName = exName === "__custom__" ? exCustomInput : exName;
    if (!finalName) return;
    const sets = exSets.length > 0 ? exSets : (exWeight || exReps ? [{ id: uid(), weight: exWeight, reps: exReps }] : []);
    const newEx = { id: uid(), name: finalName, sets, weight: exWeight, reps: exReps };
    if (isWeekly) {
      setWeekly(w => ({ ...w, [dayKey]: { ...w[dayKey], exercises: [...(w[dayKey]?.exercises||[]), newEx] } }));
    } else {
      setCycle(c => c.map((d, i) => i !== dayKey ? d : { ...d, exercises: [...(d.exercises||[]), newEx] }));
    }
    setExName(""); setExWeight(""); setExReps(""); setExSets([]);
  }

  function removeExFromDay(dayKey, exId, isWeekly) {
    if (isWeekly) {
      setWeekly(w => ({ ...w, [dayKey]: { ...w[dayKey], exercises: (w[dayKey]?.exercises||[]).filter(e => e.id !== exId) } }));
    } else {
      setCycle(c => c.map((d, i) => i !== dayKey ? d : { ...d, exercises: d.exercises.filter(e => e.id !== exId) }));
    }
  }

  function addSet() { if (!exReps) return; setExSets(p => [...p, { id: uid(), weight: exWeight, reps: exReps }]); setExWeight(""); setExReps(""); }

  const [exCustomInput, setExCustomInput] = useState("");

  function saveCycle() { onSave({ mode, weekly, cycle, cyclePos }); onClose(); }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📅 Planificador</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="tab-row" style={{ marginBottom: 20 }}>
          <button className={`tab-btn ${mode === "weekly" ? "active" : ""}`} onClick={() => setMode("weekly")}>7 días fijos</button>
          <button className={`tab-btn ${mode === "cycle" ? "active" : ""}`} onClick={() => setMode("cycle")}>Ciclo personalizado</button>
        </div>

        {mode === "weekly" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {DAYS_ES.map((day, i) => {
              const dayData = weekly[i] || { name: "", exercises: [] };
              const isToday = todayDow === i;
              const isOpen = expandedDay === `w${i}`;
              return (
                <div key={i} style={{ background: isToday ? "var(--accent-dim)" : "var(--input-bg)", border: `1px solid ${isToday ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
                    <span style={{ width: 90, fontSize: 13, fontWeight: 600, color: isToday ? "var(--accent)" : "var(--text-muted)", flexShrink: 0 }}>{day}{isToday ? " 📍" : ""}</span>
                    <input className="input" style={{ flex: 1, padding: "7px 12px", fontSize: 13 }} placeholder="Descanso / Push Day / Piernas…" value={dayData.name || ""} onChange={e => setWeekly(w => ({ ...w, [i]: { ...dayData, name: e.target.value } }))} list={`wk-dl-${i}`} />
                    <datalist id={`wk-dl-${i}`}>{workoutNames.map(n => <option key={n} value={n} />)}{Object.keys(PRESETS).map(n => <option key={n} value={n} />)}</datalist>
                    <button className="btn-ghost small" style={{ whiteSpace: "nowrap", fontSize: 11 }} onClick={() => setExpandedDay(isOpen ? null : `w${i}`)}>
                      {isOpen ? "▲ Cerrar" : `💪 ${(dayData.exercises||[]).length > 0 ? `${(dayData.exercises||[]).length} ej.` : "Ejercicios"}`}
                    </button>
                  </div>
{isOpen && <ExerciseEditor dayKey={i} exercises={dayData.exercises||[]} isWeekly={true} addExToDay={addExToDay} removeExFromDay={removeExFromDay} />}                </div>
              );
            })}
          </div>
        )}

        {mode === "cycle" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
              {cycle.map((d, i) => {
                const isActive = cyclePos === i;
                const isOpen = expandedDay === `c${i}`;
                return (
                  <div key={d.id} style={{ background: isActive ? "var(--accent-dim)" : "var(--input-bg)", border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`, borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "10px 14px" }}>
                      <span style={{ width: 28, height: 28, borderRadius: "50%", background: isActive ? "var(--accent)" : "var(--border)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                      <input className="input" style={{ flex: 1, padding: "7px 12px", fontSize: 13 }} placeholder={`Día ${i+1} (ej: Push Day)`} value={d.name} onChange={e => setCycle(c => c.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} list={`cy-dl-${i}`} />
                      <datalist id={`cy-dl-${i}`}>{workoutNames.map(n => <option key={n} value={n} />)}{Object.keys(PRESETS).map(n => <option key={n} value={n} />)}</datalist>
                      <button className="btn-ghost small" style={{ whiteSpace: "nowrap", fontSize: 11 }} onClick={() => setExpandedDay(isOpen ? null : `c${i}`)}>
                        {isOpen ? "▲ Cerrar" : `💪 ${(d.exercises||[]).length > 0 ? `${(d.exercises||[]).length} ej.` : "Ejercicios"}`}
                      </button>
                      {cycle.length > 1 && <button className="chip-del" style={{ fontSize: 16 }} onClick={() => { setCycle(c => c.filter((_, j) => j !== i)); if (cyclePos >= i) setCyclePos(p => Math.max(0, p-1)); }}>✕</button>}
                    </div>
{isOpen && <ExerciseEditor dayKey={i} exercises={d.exercises||[]} isWeekly={false} addExToDay={addExToDay} removeExFromDay={removeExFromDay} />}                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
              <button className="btn-ghost small" onClick={() => setCycle(c => [...c, { id: uid(), name: "", exercises: [] }])}>+ Agregar día</button>
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Día activo:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {cycle.map((_, i) => (
                  <button key={i} onClick={() => setCyclePos(i)} style={{ width: 28, height: 28, borderRadius: "50%", background: cyclePos === i ? "var(--accent)" : "var(--border)", border: "none", color: "white", fontWeight: 800, fontSize: 12, cursor: "pointer" }}>{i+1}</button>
                ))}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)", borderRadius: 8, padding: "8px 12px" }}>
              💡 Al guardar una sesión, el ciclo avanza automáticamente al siguiente día.
            </div>
          </div>
        )}

        <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={saveCycle}>💾 Guardar planificador</button>
      </div>
    </div>
  );
}


// ─── Progress Modal ───────────────────────────────────────────────────────────
function ProgressModal({ exName, sessions, onClose }) {
  const history = [];
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    if (ex.name.toLowerCase() === exName.toLowerCase()) {
      const weight = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(ex.weight) || 0;
      history.push({ date: s.date, weight, reps: ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(ex.reps) || 0 });
    }
  }));
  history.sort((a, b) => a.date.localeCompare(b.date));
  const vals = history.map(h => h.weight);
  const min = Math.min(...vals, 0), max = Math.max(...vals, 1), range = max - min || 1;
  const W = 400, H = 130;
  const prEntry = history.reduce((best, h) => calc1RM(h.weight, h.reps) > calc1RM(best.weight, best.reps) ? h : best, history[0] || { weight: 0, reps: 0 });

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📈 {exName}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        {history.length < 2
          ? <p className="text-muted" style={{ fontSize: 14 }}>Necesitas al menos 2 registros para ver progreso.</p>
          : <>
            {prEntry && <div style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.12), rgba(251,191,36,0.04))", border: "1px solid rgba(251,191,36,0.4)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, display: "flex", gap: 16, alignItems: "center" }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "#f59e0b", textTransform: "uppercase" }}>Récord personal</div>
                <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "Barlow Condensed, sans-serif" }}>{prEntry.weight} kg × {prEntry.reps} reps → 1RM ≈ {calc1RM(prEntry.weight, prEntry.reps)} kg</div>
              </div>
            </div>}
            <svg width="100%" viewBox={`0 0 ${W + 4} ${H + 30}`} style={{ display: "block", margin: "8px 0 12px" }}>
              {[0, 0.5, 1].map(t => {
                const y = H - t * H;
                return <g key={t}>
                  <line x1={36} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} />
                  <text x={30} y={y + 4} textAnchor="end" fill="var(--text-muted)" fontSize={10}>{(min + t * range).toFixed(1)}</text>
                </g>;
              })}
              <polyline points={history.map((h, i) => `${36 + (i / (history.length - 1)) * (W - 36)},${H - ((h.weight - min) / range) * H}`).join(" ")} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinecap="round" />
              {history.map((h, i) => {
                const x = 36 + (i / (history.length - 1)) * (W - 36);
                const y = H - ((h.weight - min) / range) * H;
                const isPR = h === prEntry;
                return <g key={i}>
                  <circle cx={x} cy={y} r={isPR ? 6 : 4} fill={isPR ? "#f59e0b" : "#3b82f6"} />
                  <text x={x} y={H + 22} textAnchor="middle" fill="var(--text-muted)" fontSize={9}>{fmtDate(h.date)}</text>
                </g>;
              })}
            </svg>
            <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
              {[["Máx", `${max}kg`], ["Mín", `${min}kg`], ["Registros", history.length], ["1RM est.", `${calc1RM(prEntry.weight, prEntry.reps)}kg`]].map(([l, v]) =>
                <span key={l} className="text-muted">{l}: <b style={{ color: "var(--text)" }}>{v}</b></span>
              )}
            </div>
          </>
        }
      </div>
    </div>
  );
}

// ─── Plans Modal ──────────────────────────────────────────────────────────────
function PlansModal({ currentPlan, onSelect, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⚡ Elige tu plan</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="plans-grid">
          {Object.entries(PLANS).map(([key, plan]) => (
            <div key={key} className={`plan-card ${currentPlan === key ? "plan-active" : ""}`} style={{ "--pc": plan.color }}>
              <div className="plan-name">{plan.name}</div>
              <div className="plan-price" style={{ color: plan.color }}>{plan.price}</div>
              <ul className="plan-features">{plan.features.map(f => <li key={f}>✓ {f}</li>)}</ul>
              <button className="plan-btn" style={{ borderColor: plan.color, background: currentPlan === key ? plan.color : "transparent", color: currentPlan === key ? "white" : plan.color }} onClick={() => { onSelect(key); onClose(); }}>
                {currentPlan === key ? "Plan actual" : "Seleccionar"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Exercise Library ─────────────────────────────────────────────────────────
function ExerciseLibrary({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Todos");
  const [machineFilter, setMachineFilter] = useState("Todos");

  const filtered = EXERCISE_DB.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = muscleFilter === "Todos" || ex.muscle === muscleFilter;
    const matchMachine = machineFilter === "Todos" || (machineFilter === "Máquina" ? ex.machine : !ex.machine);
    return matchSearch && matchMuscle && matchMachine;
  });

  const grouped = MUSCLES.reduce((acc, m) => {
    const exs = filtered.filter(e => e.muscle === m);
    if (exs.length > 0) acc[m] = exs;
    return acc;
  }, {});

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-library" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📚 Ejercicios</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="lib-filters">
          <input className="input" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <select className="input" value={machineFilter} onChange={e => setMachineFilter(e.target.value)} style={{ width: "auto" }}>
            <option>Todos</option>
            <option>Máquina</option>
            <option>Sin máquina</option>
          </select>
        </div>
        <div className="muscle-chips">
          {["Todos", ...MUSCLES].map(m => (
            <button key={m} className={`muscle-chip ${muscleFilter === m ? "active" : ""}`} onClick={() => setMuscleFilter(m)}>{m}</button>
          ))}
        </div>
        <div className="lib-list">
          {Object.entries(grouped).map(([muscle, exs]) => (
            <div key={muscle} className="lib-group">
              <div className="lib-group-title">{muscle}</div>
              {exs.map(ex => (
                <button key={ex.name} className="lib-item" onClick={() => { onSelect(ex.name); onClose(); }}>
                <ExerciseGif exName={ex.name} size={52} />
                <div className="lib-info">
                  <span className="lib-name">{ex.name}</span>
                  <span className="lib-meta">{ex.equipment} · {ex.machine ? "Requiere máquina" : "Sin máquina"}</span>
                </div>
                <span className="lib-add">+</span>
              </button>
              ))}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && <p className="text-muted" style={{ padding: "20px 0", textAlign: "center" }}>Sin resultados</p>}
        </div>
      </div>
    </div>
  );
}



// ─── Progress Prediction ──────────────────────────────────────────────────────
function ProgressPrediction({ sessions }) {
  const [selected, setSelected] = useState("");

  // Build exercise list that has enough data points
  const exMap = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const w = ex.sets?.length>0 ? Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
    const r = ex.sets?.length>0 ? Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)) : parseFloat(ex.reps)||0;
    const rm = calc1RM(w, r);
    if (!exMap[ex.name]) exMap[ex.name] = [];
    if (rm > 0) exMap[ex.name].push({ date: s.date, rm });
  }));
  const validExercises = Object.entries(exMap).filter(([,v]) => v.length >= 2).map(([k]) => k);

  if (!selected && validExercises.length > 0) {
    // auto-select first
  } 
  const ex = selected || validExercises[0] || "";
  const points = ex ? (exMap[ex] || []).sort((a,b) => a.date.localeCompare(b.date)) : [];

  // Linear regression on 1RM over time (days from first session)
  let prediction = null;
  let weeklyGain = 0;
  let currentRM = 0;
  let targets = [];

  if (points.length >= 2) {
    const t0 = new Date(points[0].date + "T00:00:00").getTime();
    const xs = points.map(p => (new Date(p.date+"T00:00:00").getTime() - t0) / 86400000);
    const ys = points.map(p => p.rm);
    const n = xs.length;
    const sumX = xs.reduce((a,b)=>a+b,0), sumY = ys.reduce((a,b)=>a+b,0);
    const sumXY = xs.reduce((s,x,i)=>s+x*ys[i],0), sumX2 = xs.reduce((s,x)=>s+x*x,0);
    const slope = (n*sumXY - sumX*sumY) / (n*sumX2 - sumX*sumX); // kg/day
    const intercept = (sumY - slope*sumX) / n;
    currentRM = Math.round(points[points.length-1].rm);
    weeklyGain = Math.round(slope * 7 * 10) / 10;
    const lastX = xs[xs.length-1];

    // Predict reaching round targets
    if (slope > 0) {
      const step = currentRM < 60 ? 5 : currentRM < 100 ? 5 : 10;
const roundTargets = [1,2,3,4,5,6].map(i => Math.round((currentRM + i * step) / step) * step).filter(t => t > currentRM);
      targets = roundTargets.slice(0,3).map(target => {
        const daysNeeded = (target - intercept) / slope - lastX;
        const weeksNeeded = Math.ceil(daysNeeded / 7);
        const eta = new Date(); eta.setDate(eta.getDate() + Math.round(daysNeeded));
        return { target, weeks: weeksNeeded, eta: eta.toLocaleDateString("es-CL", { month:"short", year:"numeric" }) };
      });
    }
  }

  if (validExercises.length === 0) return (
    <div className="card">
      <div className="card-label">📈 Predicción de progreso</div>
      <p style={{ fontSize:13, color:"var(--text-muted)", textAlign:"center", padding:"12px 0" }}>Necesitas al menos 2 sesiones con el mismo ejercicio para ver predicciones.</p>
    </div>
  );

  return (
    <div className="card">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:8 }}>
        <div className="card-label" style={{ margin:0 }}>📈 Predicción de progreso</div>
        <select className="input" style={{ width:"auto", fontSize:12, padding:"5px 10px" }} value={ex} onChange={e => setSelected(e.target.value)}>
          {validExercises.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Current + weekly gain */}
      <div style={{ display:"flex", gap:12, marginBottom:16 }}>
        <div style={{ flex:1, background:"var(--input-bg)", borderRadius:10, padding:"10px 14px", border:"1px solid var(--border)" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase" }}>1RM actual</div>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:800, color:"var(--accent)" }}>{currentRM} kg</div>
        </div>
        <div style={{ flex:1, background:"var(--input-bg)", borderRadius:10, padding:"10px 14px", border:"1px solid var(--border)" }}>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase" }}>Ganancia/semana</div>
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:800, color: weeklyGain>0?"#22c55e":"#f87171" }}>
            {weeklyGain > 0 ? "+" : ""}{weeklyGain} kg
          </div>
        </div>
      </div>

      {/* Predictions */}
      {targets.length > 0 ? (
        <div>
          <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Proyección si mantienes el ritmo</div>
          {targets.map(t => (
            <div key={t.target} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 14px", background:"rgba(59,130,246,0.05)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:10, marginBottom:6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontSize:20 }}>🎯</span>
                <div>
                  <div style={{ fontWeight:700, fontSize:14 }}>Llegar a {t.target} kg</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>~{t.eta}</div>
                </div>
              </div>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:18, fontWeight:800, color:"var(--accent)" }}>
                {t.weeks <= 0 ? "¡Ya!" : `${t.weeks} sem.`}
              </div>
            </div>
          ))}
        </div>
      ) : weeklyGain <= 0 ? (
        <div style={{ fontSize:12, color:"#f87171", textAlign:"center", padding:"10px 0" }}>
          📉 Progreso estancado o descendente. ¡Sube la intensidad!
        </div>
      ) : null}
    </div>
  );
}

// ─── Muscle Balance ────────────────────────────────────────────────────────────
function MuscleBalance({ sessions }) {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
  const counts = {};
  sessions.filter(s => new Date(s.date+"T00:00:00") >= cutoff).forEach(s =>
    (s.exercises||[]).forEach(ex => {
      const db = EXERCISE_DB.find(e => e.name === ex.name);
      if (db) counts[db.muscle] = (counts[db.muscle]||0) + 1;
    })
  );

  // Group muscles into push/pull/legs/core
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

  // Detect imbalances
  const push = groupTotals.find(g=>g.name.startsWith("Empuje"))?.total||0;
  const pull = groupTotals.find(g=>g.name.startsWith("Tirón"))?.total||0;
  const legs = groupTotals.find(g=>g.name.startsWith("Piernas"))?.total||0;
  const warnings = [];
  if (push > 0 && pull > 0 && push / pull > 1.8) warnings.push("⚠️ Entrenas mucho más empuje que tirón. Riesgo de lesión de hombros.");
  if (pull > 0 && push > 0 && pull / push > 2) warnings.push("⚠️ Mucho más tirón que empuje. Considera balancear.");
  if (totalAll > 0 && legs / totalAll < 0.15) warnings.push("🦵 Estás descuidando las piernas. ¡No seas pájaro!");
  if (totalAll === 0) warnings.push("Sin datos este mes.");

  const colors = { "Empuje 🔵":"#3b82f6","Tirón 🟢":"#22c55e","Piernas 🔴":"#ef4444","Core 🟡":"#f59e0b" };

  return (
    <div className="card">
      <div className="card-label">⚖️ Balance muscular (últimos 30 días)</div>
      {totalAll === 0 ? (
        <p style={{ fontSize:13, color:"var(--text-muted)", textAlign:"center" }}>Sin sesiones este mes.</p>
      ) : (
        <>
          {/* Donut-style bar */}
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
                  <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:18, fontWeight:800, color:colors[g.name] }}>{g.total}</span>
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


// ─── Team Challenge ───────────────────────────────────────────────────────────
function TeamChallengeModal({ user, sessions, onClose }) {
  const [myTeams] = useState(() => load(`gym_teams_${user.email}`, []));
  const [activeTeam, setActiveTeam] = useState(myTeams[0] || null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [metric, setMetric] = useState("volume");

  // This week stats for current user
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7); weekStart.setHours(0,0,0,0);
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

  const members = teamData ? Object.values(teamData.members) : [];
  // For challenge we use stored stats (last sync) - could be enriched in future
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
            {/* Team selector */}
            {myTeams.length > 1 && (
              <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
                {myTeams.map(t => (
                  <button key={t.code} className={`muscle-chip ${activeTeam?.code===t.code?"active":""}`} onClick={()=>setActiveTeam(t)}>{t.name}</button>
                ))}
              </div>
            )}

            {/* My week snapshot */}
            <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--accent)", textTransform:"uppercase", marginBottom:8 }}>Tu semana actual</div>
              <div style={{ display:"flex", gap:16 }}>
                <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800 }}>{myWeekSessions}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>sesiones</div></div>
                <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800 }}>{myWeekVol}t</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>volumen</div></div>
                {myRank > 0 && <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800, color:"#f59e0b" }}>#{myRank}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>ranking</div></div>}
              </div>
            </div>

            {/* Metric toggle */}
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

// ─── Share Session Card ────────────────────────────────────────────────────────
function ShareCardModal({ session, user, unit, onClose }) {
  const canvasRef = useRef();
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const totalVol = (session.exercises||[]).reduce((acc,ex)=>{
    return acc+(ex.sets?.length>0?ex.sets.reduce((s,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+s,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1));
  },0);
  const totalSets = (session.exercises||[]).reduce((acc,ex)=>acc+(ex.sets?.length||1),0);

  useEffect(() => { drawCard(); }, []);

  function drawCard() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = 1080, H = 1080;
    canvas.width = W; canvas.height = H;

    // Background gradient
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(0.5, "#1e1b4b");
    bg.addColorStop(1, "#0f172a");
    ctx.fillStyle = bg; ctx.fillRect(0,0,W,H);

    // Accent line top
    const accent = ctx.createLinearGradient(0,0,W,0);
    accent.addColorStop(0,"#3b82f6"); accent.addColorStop(1,"#8b5cf6");
    ctx.fillStyle = accent; ctx.fillRect(0,0,W,8);

    // Logo / Brand
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 36px Arial";
    ctx.fillText("⚡ GymTracker", 80, 90);

    // Date
    ctx.fillStyle = "#94a3b8"; ctx.font = "28px Arial";
    ctx.fillText(fmtDate(session.date), 80, 135);

    // Workout name
    ctx.fillStyle = "#ffffff"; ctx.font = "bold 72px Arial";
    const wname = session.workout || "Sesión";
    ctx.fillText(wname.length > 18 ? wname.slice(0,18)+"…" : wname, 80, 240);

    // Stats boxes
    const stats = [
      { label: "Ejercicios", value: (session.exercises||[]).length },
      { label: "Series", value: totalSets },
      { label: "Volumen", value: `${Math.round(totalVol/100)/10}t` },
    ];
    stats.forEach((st,i) => {
      const x = 80 + i*320, y = 300;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath(); ctx.roundRect(x,y,290,150,20); ctx.fill();
      ctx.fillStyle = "#3b82f6"; ctx.font = "bold 56px Arial";
      ctx.fillText(String(st.value), x+30, y+90);
      ctx.fillStyle = "#94a3b8"; ctx.font = "26px Arial";
      ctx.fillText(st.label, x+30, y+130);
    });

    // Exercise list
    const exes = (session.exercises||[]).slice(0,6);
    ctx.fillStyle = "#94a3b8"; ctx.font = "24px Arial";
    ctx.fillText("EJERCICIOS", 80, 520);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.beginPath(); ctx.roundRect(80,540, W-160, exes.length*72+30, 16); ctx.fill();

    exes.forEach((ex,i) => {
      const y = 586 + i*72;
      // dot
      ctx.fillStyle = "#3b82f6";
      ctx.beginPath(); ctx.arc(120, y-8, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#ffffff"; ctx.font = "bold 30px Arial";
      const exLabel = ex.name.length > 22 ? ex.name.slice(0,22)+"…" : ex.name;
      ctx.fillText(exLabel, 148, y);
      ctx.fillStyle = "#64748b"; ctx.font = "24px Arial";
      const detail = ex.sets?.length>0 ? `${ex.sets.length} series` : (ex.weight ? `${ex.weight}${unit} × ${ex.reps}` : "");
      ctx.fillText(detail, 148, y+32);
    });
    if ((session.exercises||[]).length > 6) {
      ctx.fillStyle = "#64748b"; ctx.font = "italic 24px Arial";
      ctx.fillText(`+${(session.exercises||[]).length-6} más...`, 148, 586+6*72);
    }

    // User name
    ctx.fillStyle = "#3b82f6"; ctx.font = "bold 30px Arial";
    ctx.fillText(`@${user.name}`, 80, H-80);

    // Bottom accent
    ctx.fillStyle = accent; ctx.fillRect(0,H-8,W,8);
  }

  async function download() {
    setDownloading(true);
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `gymtracker_${session.date}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    setDownloading(false);
  }

  async function copyImage() {
    try {
      const canvas = canvasRef.current;
      canvas.toBlob(async blob => {
        await navigator.clipboard.write([new ClipboardItem({"image/png": blob})]);
        setCopied(true); setTimeout(()=>setCopied(false), 2000);
      });
    } catch { download(); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{ maxHeight:"90vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📸 Compartir sesión</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:14 }}>Imagen lista para Instagram Stories o publicación (1080×1080)</p>
        <canvas ref={canvasRef} style={{ width:"100%", borderRadius:12, border:"1px solid var(--border)", display:"block", marginBottom:16 }} />
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn-primary" style={{ flex:1, fontSize:15 }} onClick={download}>{downloading?"...":"⬇️ Descargar"}</button>
          <button className="btn-ghost" style={{ flex:1, fontSize:15 }} onClick={copyImage}>{copied?"✅ Copiada!":"📋 Copiar imagen"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Teams ────────────────────────────────────────────────────────────────────
// ─── Coach Modal ──────────────────────────────────────────────────────────────
function CoachModal({ user, sessions, onClose }) {
  const [tab, setTab] = useState("dashboard");
  const [coachProfile, setCoachProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [routines, setRoutines] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteData, setAthleteData] = useState(null);
  const [athleteLoading, setAthleteLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
const [athleteRoutinesMap, setAthleteRoutinesMap] = useState({});

  // Routine editor state
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [routineName, setRoutineName] = useState("");
  const [routineNotes, setRoutineNotes] = useState("");
  const [routineExercises, setRoutineExercises] = useState([]);
  const [rExName, setRExName] = useState("");
  const [rExMuscle, setRExMuscle] = useState("Todos");
  const [rExWeight, setRExWeight] = useState("");
  const [rExReps, setRExReps] = useState("");
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

  useEffect(() => { loadCoach(); }, []);

  async function loadCoach() {
    setLoading(true);
    const profile = await getCoachProfile(user.uid);
    setCoachProfile(profile);
    if (profile) {
      const r = await getRoutinesByCoach(user.uid);
      setRoutines(r);
      const athletesList = Object.values(profile.athletes || {});
      const map = {};
      await Promise.all(athletesList.map(async (a) => {
        const snap = await getDocs(collection(db, "athlete_routines", a.uid, "routines"));
        map[a.uid] = snap.docs.map(d => d.data());
      }));
      setAthleteRoutinesMap(map);
    }
    setLoading(false);
  }

  async function activateCoach() {
  if (!ADMIN_EMAILS.includes(user.email)) {
    alert("❌ Solo administradores pueden activar el modo Coach.");
    return;
  }
  setActivating(true);
  const profile = await createCoachProfile(user.uid, user.name, user.email);
  setCoachProfile(profile);
  setActivating(false);
}
  async function loadAthleteData(athlete) {
    setSelectedAthlete(athlete);
    setAthleteData(null);
    setAthleteLoading(true);
    console.log("Coach buscando atleta uid:", athlete.uid);
    const data = await getAthleteData(athlete.uid);
    console.log("Sesiones del atleta:", data.sessions.length);
    console.log("Data completa:", data);
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
      EXERCISE_DB.push({ name: finalName, muscle: rExCustomMuscle, machine: false, equipment: "Personalizado" });
    }
    const sets = rExSets.length > 0 ? rExSets : (rExWeight || rExReps ? [{ id: uid(), weight: rExWeight, reps: rExReps }] : []);
    setRoutineExercises(p => [...p, { id: uid(), name: finalName, sets, weight: rExWeight, reps: rExReps, comment: rExComment }]);
    setRExName(""); setRExCustom(""); setRExCustomMuscle(""); setRExWeight(""); setRExReps(""); setRExSets([]); setRExComment("");
  }

  async function saveRoutine() {
    if (!routineName.trim()) { setErr("Ponle nombre a la rutina"); return; }
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
    if (!window.confirm("¿Eliminar esta rutina?")) return;
    await deleteCoachRoutine(user.uid, id);
    setRoutines(r => r.filter(x => x.id !== id));
  }

  async function handleAssign() {
    if (!assignRoutineId || !assignEmail) { setAssignMsg("Selecciona rutina e ingresa email"); return; }
    const routine = routines.find(r => r.id === assignRoutineId);
    const result = await assignRoutineToAthlete(user.uid, assignEmail, assignRoutineId, routine?.name || "", assignDay);
    setAssignMsg(result.ok ? "✅ Rutina asignada correctamente" : `❌ ${result.msg}`);
  }
  async function handleAddAthlete() {
    if (!addAthleteEmail) return;
    const result = await assignRoutineToAthlete(user.uid, addAthleteEmail, "", "");
    if (result.ok) {
      setAddAthleteMsg("✅ Atleta agregado");
      const profile = await getCoachProfile(user.uid);
      setCoachProfile(profile);
    } else setAddAthleteMsg(`❌ ${result.msg}`);
  }
  async function removeAthlete(athleteUid) {
    if (!window.confirm("¿Eliminar este atleta de tu lista?")) return;
    try {
      const coachSnap = await getDoc(doc(db, "coaches", user.uid));
      if (coachSnap.exists()) {
        const updated = { ...coachSnap.data().athletes };
        delete updated[athleteUid];
        await updateDoc(doc(db, "coaches", user.uid), { athletes: updated });
      }
      setCoachProfile(prev => {
        const updated = { ...prev.athletes };
        delete updated[athleteUid];
        return { ...prev, athletes: updated };
      });
    } catch(e) {
      console.error("Error eliminando atleta:", e);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(coachProfile.code);
    setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000);
  }

  const athletes = coachProfile ? Object.values(coachProfile.athletes || {}) : [];

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
          <button className="close-btn" onClick={onClose}>✕</button>
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
            <div className="tab-row" style={{ marginBottom: 20 }}>
              {[["dashboard","📊 Dashboard"],["routines","📋 Rutinas"],["athletes","👥 Atletas"],["assign","📨 Asignar"]].map(([id, label]) => (
                <button key={id} className={`tab-btn ${tab===id?"active":""}`} onClick={() => setTab(id)}>{label}</button>
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
                ) : athletes.map(a => (
                  <div key={a.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "white", fontSize: 14 }}>{a.name?.[0]?.toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{a.name}</div>
<div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.email}</div>
{(athleteRoutinesMap[a.uid] || []).filter(r => r.dayOfWeek >= 0).map(r => (
  <div key={r.routineId} style={{ fontSize: 11, color: "var(--accent)", marginTop: 2 }}>
    📅 {r.routineName} → {DAYS_ES[r.dayOfWeek]}
  </div>
))}
                      </div>
                    </div>
                    <button className="btn-ghost small" onClick={() => loadAthleteData(a)}>Ver progreso →</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── ROUTINES ── */}
            {tab === "routines" && (
              <div>
                <button className="btn-primary" style={{ width: "100%", marginBottom: 16, fontSize: 16 }} onClick={startNewRoutine}>+ Crear nueva rutina</button>
                {routines.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "20px 0" }}>Sin rutinas aún.</p>}
                {routines.map(r => (
                  <div key={r.id} style={{ padding: "14px 16px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn-ghost small" onClick={() => startEditRoutine(r)}>✏️ Editar</button>
                        <button className="btn-ghost small danger" onClick={() => deleteRoutine(r.id)}>🗑️</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{(r.exercises||[]).length} ejercicios · creada {fmtDate(r.createdAt)}</div>
                    {r.notes && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{r.notes}</div>}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
                      {(r.exercises||[]).map(ex => (
                        <span key={ex.id} style={{ fontSize: 11, padding: "2px 8px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, color: "var(--text-muted)" }}>
                          {ex.name}{ex.sets?.length > 0 ? ` · ${ex.sets.length}s` : ex.weight ? ` · ${ex.weight}kg` : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
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
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {["Todos", ...MUSCLES].map(m => (
                      <button key={m} className={`muscle-chip ${rExMuscle===m?"active":""}`} style={{ padding: "3px 9px", fontSize: 11 }} onClick={() => { setRExMuscle(m); setRExName(""); }}>{m}</button>
                    ))}
                  </div>
                  <div className="form-row" style={{ marginBottom: 8 }}>
                    <div className="field" style={{ flex: 2 }}>
                      <select className="input" style={{ fontSize: 13 }} value={rExName} onChange={e => setRExName(e.target.value)}>
                        <option value="">— Ejercicio —</option>
                        {(rExMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === rExMuscle)).map(ex => (
                          <option key={ex.name} value={ex.name}>{ex.name}{ex.machine?" 🔧":""}</option>
                        ))}
                        <option value="__custom__">✏️ Escribir personalizado...</option>
                      </select>
                      {rExName === "__custom__" && (
                        <>
                          <input className="input" style={{ marginTop: 6, fontSize: 13 }} placeholder="Nombre del ejercicio..." value={rExCustom} onChange={e => setRExCustom(lettersOnly(e.target.value))} autoFocus />
                          <select className="input" style={{ marginTop: 6, fontSize: 13 }} value={rExCustomMuscle} onChange={e => setRExCustomMuscle(e.target.value)}>
                            <option value="">— Músculo principal —</option>
                            {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </>
                      )}
                    </div>
                    <div className="field">
                      <input className="input" style={{ fontSize: 13 }} placeholder="Peso kg" value={rExWeight} onChange={e => setRExWeight(numDot(e.target.value))} />
                    </div>
                    <div className="field">
                      <input className="input" style={{ fontSize: 13 }} placeholder="Reps" value={rExReps} onChange={e => setRExReps(numDot(e.target.value))} />
                    </div>
                    <button className="btn-ghost small" onClick={addRSet}>+ Serie</button>
                  </div>
                  {rExSets.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                      {rExSets.map((s, i) => (
                        <span key={s.id} className="set-chip">S{i+1}: {s.weight}kg×{s.reps}
                          <button className="chip-del" onClick={() => setRExSets(p => p.filter(x => x.id !== s.id))}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="field" style={{ marginBottom: 8 }}>
                    <label className="field-label">Comentario del coach para este ejercicio</label>
                    <input className="input" style={{ fontSize: 13 }} placeholder="Ej: Baja lento, 3 segundos de excéntrica..." value={rExComment} onChange={e => setRExComment(e.target.value)} />
                  </div>
                  <button className="btn-add-ex" onClick={addRExercise}>+ Agregar ejercicio</button>
                </div>

                {/* Exercise list */}
                {routineExercises.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>Ejercicios ({routineExercises.length})</div>
                    {routineExercises.map((ex, i) => (
                      <div key={ex.id} style={{ padding: "12px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{ex.name}</span>
                          <button className="chip-del" style={{ fontSize: 16 }} onClick={() => setRoutineExercises(p => p.filter(e => e.id !== ex.id))}>✕</button>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                          {ex.sets?.length > 0 ? ex.sets.map((s,i) => `S${i+1}: ${s.weight}kg×${s.reps}`).join(" · ") : ex.weight ? `${ex.weight}kg × ${ex.reps}` : "Sin peso definido"}
                        </div>
                        {ex.comment && <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontStyle: "italic" }}>💬 {ex.comment}</div>}
                      </div>
                    ))}
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
                  <div key={a.uid} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "white" }}>{a.name?.[0]?.toUpperCase()}</div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{a.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{a.email} · desde {fmtDate(a.addedAt)}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
  <button className="btn-ghost small" onClick={() => loadAthleteData(a)}>Ver progreso →</button>
  <button className="btn-ghost small danger" onClick={() => removeAthlete(a.uid)}>🗑️</button>
</div>
                  </div>
                ))}
              </div>
            )}

            {/* ── ASSIGN ── */}
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
                        { icon: "🔥", label: "Racha", value: `${getAthleteStreak(athleteData.sessions)}d` },
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
                        </div>
                      ))}
                      {athleteData.sessions.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Sin sesiones registradas aún.</p>}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AthleteWorkoutRunner({ routine, onClose, onSave }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(true);
  const [currentEx, setCurrentEx] = useState(0);
  const [exData, setExData] = useState(
    (routine.exercises || []).map(ex => ({
      ...ex,
      sets: ex.sets?.length ? ex.sets.map(s => ({ ...s, done: false })) : [{ id: uid(), weight: "", reps: "", done: false }]
    }))
  );
  const mainRef = useRef();

  useEffect(() => {
    if (running) { mainRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else clearInterval(mainRef.current);
    return () => clearInterval(mainRef.current);
  }, [running]);

  const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const totalSets = exData.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);

  function toggleSet(exIdx, setIdx) {
    setExData(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done })
    }));
  }

  function updateSet(exIdx, setIdx, field, val) {
    setExData(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val })
    }));
  }

  function addSet(exIdx) {
    setExData(prev => prev.map((ex, i) => i !== exIdx ? ex : {
      ...ex, sets: [...ex.sets, { id: uid(), weight: ex.sets[ex.sets.length-1]?.weight || "", reps: ex.sets[ex.sets.length-1]?.reps || "", done: false }]
    }));
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 3000, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800 }}>⚡ {routine.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{doneSets}/{totalSets} series completadas</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{fmt(elapsed)}</div>
          <button onClick={() => setRunning(r => !r)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>{running ? "⏸ Pausar" : "▶ Reanudar"}</button>
        </div>
        <button onClick={() => { setRunning(false); onSave(exData, elapsed); }} style={{ background: "var(--accent)", border: "none", color: "white", borderRadius: 10, padding: "10px 16px", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700, cursor: "pointer" }}>
          💾 Finalizar
        </button>
        <button onClick={onClose} style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "8px 12px", cursor: "pointer" }}>✕</button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--border)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${totalSets > 0 ? (doneSets/totalSets)*100 : 0}%`, transition: "width 0.4s" }} />
      </div>

      {/* Exercise tabs */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", overflowX: "auto", flexShrink: 0 }}>
        {exData.map((ex, i) => {
          const done = ex.sets.every(s => s.done) && ex.sets.length > 0;
          return (
            <button key={i} onClick={() => setCurrentEx(i)} style={{ background: currentEx === i ? "var(--accent)" : done ? "rgba(34,197,94,0.15)" : "var(--card)", border: `1px solid ${currentEx === i ? "var(--accent)" : done ? "#22c55e" : "var(--border)"}`, color: currentEx === i ? "white" : done ? "#22c55e" : "var(--text-muted)", borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", flexShrink: 0 }}>
              {done ? "✓ " : ""}{ex.name}
            </button>
          );
        })}
      </div>

      {/* Current exercise */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {exData[currentEx] && (
          <div>
            <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 800, marginBottom: 4 }}>{exData[currentEx].name}</div>
            {exData[currentEx].comment && (
              <div style={{ fontSize: 12, color: "var(--accent)", fontStyle: "italic", marginBottom: 12 }}>💬 {exData[currentEx].comment}</div>
            )}
            <div style={{ display: "flex", gap: 8, marginBottom: 8, padding: "0 4px" }}>
              <div style={{ width: 36, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Serie</div>
              <div style={{ flex: 1, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Peso (kg)</div>
              <div style={{ flex: 1, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Reps</div>
              <div style={{ width: 64, fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>Hecho</div>
            </div>
            {exData[currentEx].sets.map((s, j) => (
              <div key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, padding: "10px 4px", background: s.done ? "rgba(34,197,94,0.08)" : "var(--card)", border: `1px solid ${s.done ? "rgba(34,197,94,0.3)" : "var(--border)"}`, borderRadius: 10 }}>
                <div style={{ width: 36, textAlign: "center", fontWeight: 800, fontSize: 15, color: s.done ? "#22c55e" : "var(--text-muted)" }}>S{j+1}</div>
                <input value={s.weight} onChange={e => updateSet(currentEx, j, "weight", numDot(e.target.value))} style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text)", fontSize: 15, fontWeight: 700, textAlign: "center", outline: "none" }} placeholder="0" />
                <input value={s.reps} onChange={e => updateSet(currentEx, j, "reps", numDot(e.target.value))} style={{ flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, color: "var(--text)", fontSize: 15, fontWeight: 700, textAlign: "center", outline: "none" }} placeholder="0" />
                <button onClick={() => toggleSet(currentEx, j)} style={{ width: 64, height: 40, background: s.done ? "#22c55e" : "var(--input-bg)", border: `2px solid ${s.done ? "#22c55e" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontSize: 18 }}>
                  {s.done ? "✓" : "○"}
                </button>
              </div>
            ))}
            <button onClick={() => addSet(currentEx)} style={{ width: "100%", background: "none", border: "1px dashed var(--border)", color: "var(--text-muted)", borderRadius: 10, padding: 10, cursor: "pointer", fontSize: 13, marginTop: 4 }}>+ Serie</button>

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              {currentEx > 0 && <button onClick={() => setCurrentEx(i => i-1)} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 10, padding: 10, cursor: "pointer", fontSize: 13 }}>← Anterior</button>}
              {currentEx < exData.length - 1 && <button onClick={() => setCurrentEx(i => i+1)} style={{ flex: 1, background: "var(--accent)", border: "none", color: "white", borderRadius: 10, padding: 10, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 700 }}>Siguiente →</button>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Athlete Coach Panel ──────────────────────────────────────────────────────
function AthleteCoachPanel({ user, onClose }) {
  const [tab, setTab] = useState("routines");
  const [coaches, setCoaches] = useState([]);
  const [assignedRoutines, setAssignedRoutines] = useState([]);
  const [fullRoutines, setFullRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [workoutSummary, setWorkoutSummary] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [myCoaches, myRoutines] = await Promise.all([
      getMyCoaches(user.uid),
      getAthleteRoutines(user.uid),
    ]);
    setCoaches(myCoaches);
    setAssignedRoutines(myRoutines);
    const full = await Promise.all(myRoutines.map(r => getFullRoutine(r.coachUid, r.routineId)));
    setFullRoutines(full.filter(Boolean));
    setLoading(false);
  }

  async function handleJoin() {
    if (!joinCode.trim()) { setJoinMsg("Ingresa un código"); return; }
    setJoining(true);
    const result = await joinCoachByCode(user.uid, user.name, user.email, joinCode.trim().toUpperCase());
    setJoining(false);
    if (result.ok) { setJoinMsg("✅ Conectado con tu coach!"); loadData(); }
    else setJoinMsg(`❌ ${result.msg}`);
  }

  if (loading) return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ textAlign:"center", padding:40 }}>
        <div style={{ fontSize:32, marginBottom:12 }}>⏳</div>
        <div style={{ color:"var(--text-muted)" }}>Cargando...</div>
      </div>
    </div>
  );

  if (activeWorkout) {
  return (
    <AthleteWorkoutRunner
      routine={activeWorkout}
      onClose={() => setActiveWorkout(null)}
      onSave={async (exercises, elapsed) => {
        // Validar si ya entrenó esta rutina hoy
        const snap = await getDoc(doc(db, "sessions", user.uid));
        const existing = snap.exists() ? (snap.data().list || []) : [];
        const alreadyToday = existing.some(s => s.date === todayStr() && s.workout === activeWorkout.name);
        if (alreadyToday) {
          if (!window.confirm(`Ya entrenaste "${activeWorkout.name}" hoy. ¿Quieres guardarlo de todas formas?`)) return;
        }

        setWorkoutSummary({ exercises, elapsed, routineName: activeWorkout.name });
        
        const newSession = {
          id: uid(),
          date: todayStr(),
          workout: activeWorkout.name,
          notes: "",
          exercises: exercises,
          unit: "kg"
        };

        try {
          console.log("UID atleta:", user.uid);
          console.log("Sesiones existentes:", existing.length);
          console.log("Nueva sesión:", newSession);
          await setDoc(doc(db, "sessions", user.uid), {
            list: [newSession, ...existing],
            updatedAt: serverTimestamp()
          });
          console.log("✅ Sesión guardada en Firestore");
        } catch(e) { 
          console.error("❌ Error guardando sesión:", e); 
        }

        await markRoutineCompleted(user.uid, activeWorkout.id);
        const updated = await getAthleteRoutines(user.uid);
        setAssignedRoutines(updated);
        setActiveWorkout(null);
      }}
    />
  );
}

  if (workoutSummary) {
    const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
    const totalVol = workoutSummary.exercises.reduce((acc, ex) =>
      acc + (ex.sets||[]).reduce((a, s) => a + (parseFloat(s.weight)||0) * (parseFloat(s.reps)||1), 0), 0);
    const totalSeries = workoutSummary.exercises.reduce((acc, ex) => acc + (ex.sets||[]).length, 0);

    return (
      <div style={{ position:"fixed", inset:0, background:"var(--bg)", zIndex:3000, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
        {/* Confetti visual */}
        <div style={{ fontSize:64, marginBottom:8 }}>🏆</div>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900, letterSpacing:1, marginBottom:4 }}>
          ¡Rutina completada!
        </div>
        <div style={{ fontSize:14, color:"var(--text-muted)", marginBottom:28 }}>{workoutSummary.routineName}</div>

        {/* Stats row */}
        <div style={{ display:"flex", gap:12, marginBottom:28, flexWrap:"wrap", justifyContent:"center" }}>
          {[
            { icon:"⏱️", label:"Tiempo", value: fmt(workoutSummary.elapsed) },
            { icon:"🏋️", label:"Ejercicios", value: workoutSummary.exercises.length },
            { icon:"🔢", label:"Series", value: totalSeries },
            { icon:"📦", label:"Volumen", value: `${Math.round(totalVol)}kg` },
          ].map(s => (
            <div key={s.label} style={{ background:"var(--card)", border:"1px solid var(--border)", borderRadius:14, padding:"16px 20px", textAlign:"center", minWidth:90 }}>
              <div style={{ fontSize:24 }}>{s.icon}</div>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800, color:"var(--accent)" }}>{s.value}</div>
              <div style={{ fontSize:11, color:"var(--text-muted)" }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Exercise breakdown */}
        <div style={{ width:"100%", maxWidth:480, maxHeight:260, overflowY:"auto", marginBottom:24 }}>
          {workoutSummary.exercises.map((ex, i) => (
            <div key={i} style={{ padding:"12px 16px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:12, marginBottom:8 }}>
              <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>✓ {ex.name}</div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {(ex.sets||[]).map((s, j) => (
                  <span key={j} style={{ fontSize:12, padding:"3px 10px", background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:8, color:"#22c55e", fontWeight:600 }}>
                    S{j+1}: {s.weight||"—"}kg × {s.reps||"—"}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <button className="btn-primary" style={{ fontSize:18, padding:"14px 40px" }}
          onClick={() => { setWorkoutSummary(null); }}>
          Volver a mis rutinas
        </button>
      </div>
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🎽 Mi Coach</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="tab-row" style={{ marginBottom:20 }}>
          <button className={`tab-btn ${tab==="routines"?"active":""}`} onClick={()=>setTab("routines")}>📋 Rutinas</button>
          <button className={`tab-btn ${tab==="coaches"?"active":""}`} onClick={()=>setTab("coaches")}>👥 Mis coaches</button>
          <button className={`tab-btn ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>🔗 Unirme</button>
        </div>

        {tab === "routines" && (
          <div>
            {fullRoutines.length === 0 ? (
  <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>
    <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
    <p style={{ fontSize:14 }}>Aún no tienes rutinas asignadas.<br/>Únete a un coach con su código.</p>
  </div>
) : fullRoutines.map(r => {
  const assigned = assignedRoutines.find(ar => ar.routineId === r.id);
  const isCompleted = assigned?.completed;
  const dayLabel = assigned?.dayOfWeek >= 0 ? `📅 ${DAYS_ES[assigned.dayOfWeek]}` : null;

  return (
    <div key={r.id} style={{ padding:"14px 16px", background:"var(--input-bg)", border:`1px solid ${isCompleted ? "rgba(34,197,94,0.4)" : "var(--border)"}`, borderRadius:12, marginBottom:10 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>{r.name}</div>
          {dayLabel && <div style={{ fontSize:11, color:"var(--accent)", marginTop:3 }}>{dayLabel}</div>}
        </div>
        {isCompleted ? (
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>✅ Completada</span>
            <button className="btn-ghost small" onClick={() => setActiveWorkout(r)}>↺ Repetir</button>
          </div>
        ) : (
          <button className="btn-primary" style={{ fontSize:14, padding:"8px 16px" }}
            onClick={() => setActiveWorkout(r)}>▶ Iniciar</button>
        )}
      </div>
      {r.notes && <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic", marginBottom:8 }}>{r.notes}</div>}
      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
        {(r.exercises||[]).map(ex => (
          <span key={ex.id} style={{ fontSize:11, padding:"2px 8px", background:"rgba(59,130,246,0.1)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:10, color:"var(--text-muted)" }}>
            {ex.name}
          </span>
        ))}
      </div>
    </div>
  );
})}
        </div>
      )}

        {tab === "coaches" && (
          <div>
            {coaches.length === 0 ? (
              <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center", padding:"20px 0" }}>Sin coaches aún.</p>
            ) : coaches.map(c => (
              <div key={c.coachUid} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, marginBottom:8 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"white" }}>
                  {c.coachName?.[0]?.toUpperCase()||"?"}
                </div>
                <div>
                  <div style={{ fontWeight:700 }}>{c.coachName}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)" }}>{c.coachEmail}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "join" && (
          <div>
            <p style={{ fontSize:13, color:"var(--text-muted)", marginBottom:16, lineHeight:1.6 }}>
              Pídele a tu coach su código y escríbelo aquí para conectarte y recibir rutinas.
            </p>
            <div style={{ display:"flex", gap:8, marginBottom:12 }}>
              <input className="input" placeholder="Código del coach (ej: COACH-ABC123)"
                value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
                style={{ flex:1, fontFamily:"monospace", letterSpacing:2, fontSize:15 }}
                onKeyDown={e => e.key==="Enter" && handleJoin()} />
              <button className="btn-primary" style={{ fontSize:15, padding:"10px 20px" }}
                onClick={handleJoin} disabled={joining}>
                {joining ? "⏳" : "Unirme"}
              </button>
            </div>
            {joinMsg && (
              <div style={{ fontSize:13, color: joinMsg.startsWith("✅")?"#22c55e":"#f87171", textAlign:"center", marginTop:8 }}>
                {joinMsg}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )   
}
// ─── Coach/Athlete Functions ──────────────────────────────────────────────────
async function getCoachProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "coaches", uid));
    return snap.exists() ? snap.data() : null;
  } catch(e) { return null; }
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
    const usersSnap = await getDocs(collection(db, "users"));
    const athleteDoc = usersSnap.docs.find(d => d.data().email === athleteEmail);
    if (!athleteDoc) return { ok: false, msg: "Atleta no encontrado" };
    const athleteUid = athleteDoc.id;

    const docId = routineId && routineId !== "" ? routineId : uid();

    await setDoc(doc(db, "athlete_routines", athleteUid, "routines", docId), {
      routineId: docId,
      coachUid,
      coachName: "",
      routineName,
      assignedAt: todayStr(),
      completed: false,
      dayOfWeek: dayOfWeek ?? -1
    }, { merge: true });

    await setDoc(doc(db, "coaches", coachUid), {
      athletes: { [athleteUid]: { email: athleteEmail, name: athleteDoc.data().name, uid: athleteUid, addedAt: todayStr() } }
    }, { merge: true });

    return { ok: true, athleteUid };
  } catch(e) { return { ok: false, msg: "Error al asignar" }; }
}

async function getAthleteRoutines(athleteUid) {
  try {
    const snap = await getDocs(collection(db, "athlete_routines", athleteUid, "routines"));
    return snap.docs.map(d => d.data());
  } catch(e) { return []; }
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

async function joinCoachByCode(athleteUid, athleteName, athleteEmail, code) {
  try {
    const q = query(collection(db, "coaches"), where("code", "==", code));
    const coachesSnap = await getDocs(q);
    if (coachesSnap.empty) return { ok: false, msg: "Código de coach no encontrado" };
    const coachDoc = coachesSnap.docs[0];
    const coachData = coachDoc.data();

    // Add athlete to coach
    await setDoc(doc(db, "coaches", coachData.uid), {
      athletes: { [athleteUid]: { email: athleteEmail, name: athleteName, uid: athleteUid, addedAt: todayStr() } }
    }, { merge: true });

    // Add coach to athlete's list
    await setDoc(doc(db, "athlete_coaches", athleteUid, "coaches", coachData.uid), {
      coachUid: coachData.uid, coachName: coachData.name, coachEmail: coachData.email, addedAt: todayStr()
    });

    return { ok: true, coachData };
  } catch(e) { return { ok: false, msg: "Error al conectar con coach" }; }
}

async function getMyCoaches(athleteUid) {
  try {
    const snap = await getDocs(collection(db, "athlete_coaches", athleteUid, "coaches"));
    return snap.docs.map(d => d.data());
  } catch(e) { return []; }
}

async function getFullRoutine(coachUid, routineId) {
  try {
    const snap = await getDoc(doc(db, "coaches", coachUid, "routines", routineId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch(e) { return null; }
}

async function markRoutineCompleted(athleteUid, routineId) {
  try {
    await setDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId),
      { completed: true, completedAt: todayStr() }, { merge: true });
    return true;
  } catch(e) { return false; }
}

async function saveBodyStatsToDB(uid, stats) {
  try {
    await setDoc(doc(db, "body_stats", uid), stats);
    return true;
  } catch(e) { return false; }
}

async function teamsGet(code) {
  try {
    const snap = await getDoc(doc(db, "teams", code));
    return snap.exists() ? snap.data() : null;
  } catch(e) { console.error("teamsGet:", e); return null; }
}
async function teamsSet(code, val) {
  try {
    await setDoc(doc(db, "teams", code), val);
    return true;
  } catch(e) { console.error("teamsSet:", e); return false; }
}

function AvatarEditor({ user, onPhotoUpdate }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result;
      try {
        await updateDoc(doc(db, "users", user.uid), { photoURL: base64 });
        onPhotoUpdate(base64);
      } catch(e) { console.error(e); }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:800,color:"white",overflow:"hidden",border:"3px solid var(--accent)"}}>
        {user.photoURL
          ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : user.name?.[0]?.toUpperCase()
        }
      </div>
      <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile} />
      <button className="btn-ghost small" onClick={() => fileRef.current.click()} disabled={uploading}>
        {uploading ? "⏳ Subiendo..." : "📷 Cambiar foto"}
      </button>
    </div>
  );
}
function UserProfileModal({ user, sessions, bodyStats, onOpenBodyStats, onClose }) {
  const prs = getPRs(sessions);
  const streak = getStreak(sessions);
  const lastEntry = bodyStats.entries?.slice(-1)[0];
  const imc = lastEntry && bodyStats.height
    ? (lastEntry.weight / Math.pow(bodyStats.height/100,2)).toFixed(1) : null;
  const imcColor = !imc ? "var(--text)" : imc < 18.5 ? "#60a5fa" : imc < 25 ? "#22c55e" : imc < 30 ? "#f97316" : "#ef4444";
  const thisWeek = sessions.filter(s=>(new Date()-new Date(s.date+"T00:00:00"))/86400000<=7).length;
  const thisMonth = sessions.filter(s=>(new Date()-new Date(s.date+"T00:00:00"))/86400000<=30).length;
  const totalVol = Math.round(sessions.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
    const w=ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1);
    return a+w;
  },0),0)/1000*10)/10;
  const kcal = Math.round(totalVol * 6);
  const topPRs = Object.entries(prs).sort((a,b)=>b[1].rm-a[1].rm).slice(0,5);
  const earned = BADGE_DEFS.filter(b=>b.check(sessions,prs));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{maxHeight:"90vh",overflowY:"auto"}}>
        <div className="modal-header">
          <h3 className="modal-title">👤 Mi perfil</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{textAlign:"center",marginBottom:20}}>
          <AvatarEditor user={user} onPhotoUpdate={(url) => { user.photoURL = url; }} />
          <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:22,fontWeight:800}}>{user.name}</div>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>{user.email}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:20}}>
          {[
            {icon:"⚖️",label:"Peso",value:lastEntry?`${lastEntry.weight}kg`:"—"},
            {icon:"📏",label:"Estatura",value:bodyStats.height?`${bodyStats.height}cm`:"—"},
            {icon:"🧮",label:"IMC",value:imc||"—",color:imcColor},
            {icon:"🏋️",label:"Sesiones",value:sessions.length},
            {icon:"📅",label:"Esta semana",value:thisWeek},
            {icon:"🗓️",label:"Este mes",value:thisMonth},
            {icon:"🔥",label:"Racha",value:`${streak}d`},
            {icon:"⭐",label:"PRs",value:Object.keys(prs).length},
            {icon:"📦",label:"Volumen",value:`${totalVol}t`},
            {icon:"🔥",label:"~kcal",value:kcal},
          ].map(s=>(
            <div key={s.label} style={{background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
              <div style={{fontSize:20}}>{s.icon}</div>
              <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:20,fontWeight:800,color:s.color||"var(--accent)"}}>{s.value}</div>
              <div style={{fontSize:10,color:"var(--text-muted)"}}>{s.label}</div>
            </div>
          ))}
        </div>
        {topPRs.length>0 && <>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:"var(--accent)",textTransform:"uppercase",marginBottom:10}}>🏆 Top PRs</div>
          {topPRs.map(([name,data],i)=>(
            <div key={name} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
              <span>{["🥇","🥈","🥉","4️⃣","5️⃣"][i]} {name}</span>
              <span style={{fontWeight:800,color:"var(--accent)"}}>{data.rm}kg 1RM</span>
            </div>
          ))}
        </>}
        {earned.length>0 && <>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:"#f59e0b",textTransform:"uppercase",margin:"16px 0 10px"}}>🏅 Logros ({earned.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {earned.map(b=><span key={b.id} title={b.desc} style={{fontSize:24}}>{b.icon}</span>)}
          </div>
        </>}
        <button className="btn-ghost" style={{width:"100%",marginTop:16}} onClick={onOpenBodyStats}>⚖️ Actualizar peso y estatura</button>
      </div>
    </div>
  );
}

function TeamsModal({ user, sessions, onClose }) {
  const [tab, setTab] = useState("home");
  const [myTeams, setMyTeams] = useState(() => load(`gym_teams_${user.email}`, []));
  const [activeTeam, setActiveTeam] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teamPreviews, setTeamPreviews] = useState({});
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPreview, setJoinPreview] = useState(null);  // team preview before joining
  const [joinPreviewing, setJoinPreviewing] = useState(false);
  const [err, setErr] = useState("");
  const [rankMetric, setRankMetric] = useState("volume");

  function saveMyTeams(t) { setMyTeams(t); store(`gym_teams_${user.email}`, t); }

  async function previewJoin(code) {
    const c = code.trim().toUpperCase();
    if (c.length < 4) { setJoinPreview(null); return; }
    if (myTeams.find(t => t.code === c)) { setErr("Ya eres miembro de este equipo"); setJoinPreview(null); return; }
    setJoinPreviewing(true);
    setErr("");
    const data = await teamsGet(`team_${c}`);
    setJoinPreviewing(false);
    if (data) { setJoinPreview(data); }
    else { setJoinPreview(null); }
  }

  // Load member previews for all my teams on mount
  useEffect(() => {
    const savedTeams = load(`gym_teams_${user.email}`, []);
    savedTeams.forEach(async t => {
      const data = await teamsGet(`team_${t.code}`);
      setTeamPreviews(prev => ({ ...prev, [t.code]: data || null }));
    });
  }, []);

  // Stats for this user
  const myStats = (() => {
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Best 1RM per exercise this week and last week
    const thisWeekRMs = {}, lastWeekRMs = {};
    sessions.forEach(s => {
      const d = new Date(s.date + "T00:00:00");
      const isThisWeek = d >= weekAgo;
      const isLastWeek = d >= twoWeeksAgo && d < weekAgo;
      (s.exercises||[]).forEach(ex => {
        const w = ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
        const r = ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)):parseFloat(ex.reps)||0;
        const rm = calc1RM(w,r);
        if (rm <= 0) return;
        if (isThisWeek) thisWeekRMs[ex.name] = Math.max(thisWeekRMs[ex.name]||0, rm);
        if (isLastWeek) lastWeekRMs[ex.name] = Math.max(lastWeekRMs[ex.name]||0, rm);
      });
    });

    // Weekly progress: avg % improvement across exercises trained this week
    const improvements = Object.entries(thisWeekRMs)
      .filter(([name]) => lastWeekRMs[name] > 0)
      .map(([name, rm]) => ({ name, pct: Math.round(((rm - lastWeekRMs[name]) / lastWeekRMs[name]) * 1000) / 10 }));
    const weeklyProgress = improvements.length > 0
      ? Math.round(improvements.reduce((s,i) => s+i.pct, 0) / improvements.length * 10) / 10
      : 0;
    const bestImprovement = improvements.sort((a,b) => b.pct-a.pct)[0] || null;

    return {
      name: user.name,
      email: user.email,
      sessions: sessions.length,
      volume: Math.round(sessions.reduce((acc,s) => acc+(s.exercises||[]).reduce((a,ex)=>{
        const w = ex.sets?.length>0 ? ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0) : (parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1);
        return a+w;
      },0),0)/1000 * 10)/10,
      prs: (() => {
        const p={}; sessions.forEach(s=>(s.exercises||[]).forEach(ex=>{
          const w=ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
          const r=ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.reps)||0)):parseFloat(ex.reps)||0;
          const rm=calc1RM(w,r); if(!p[ex.name]||rm>p[ex.name])p[ex.name]=rm;
        })); return Object.keys(p).length;
      })(),
      streak: getStreak(sessions),
      weeklyProgress,           // avg % improvement this week vs last
      bestImprovement,          // { name, pct } of top exercise
      thisWeekSessions: sessions.filter(s => new Date(s.date+"T00:00:00") >= weekAgo).length,
      lastUpdate: todayStr(),
    };
  })();

  async function loadTeam(code) {
    setLoading(true);
    const fullKey = code.startsWith("team_") ? code : `team_${code}`;
    const data = await teamsGet(fullKey);
    setTeamData(data);
    setLoading(false);
  }

  async function createTeam() {
    if (!createName.trim()) { setErr("Ponle nombre al team"); return; }
    const code = Math.random().toString(36).slice(2,8).toUpperCase();
    const team = { code, name: createName.trim(), createdBy: user.name, members: { [user.email]: myStats }, createdAt: todayStr() };
    await teamsSet(`team_${code}`, team);
    const newTeam = { code, name: createName.trim() };
    saveMyTeams([...myTeams, newTeam]);
    setTeamPreviews(prev => ({ ...prev, [code]: team }));
    setActiveTeam(newTeam);
    await loadTeam(code);
    setTab("team");
    setCreateName("");
    setErr("");
  }

  async function joinTeam() {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setErr("Ingresa el código"); return; }
    setLoading(true);
    const data = await teamsGet(`team_${code}`);
    setLoading(false);
    if (!data) { setErr("Team no encontrado. Verifica el código."); return; }
    // Add member
    const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
    await teamsSet(`team_${code}`, updated);
    saveMyTeams([...myTeams.filter(t=>t.code!==code), { code, name: data.name }]);
    setActiveTeam({ code, name: data.name });
    setTeamData(updated);
    setTab("team");
    setJoinCode("");
    setJoinPreview(null);
    setErr("");
  }

  async function syncStats() {
    if (!activeTeam) return;
    setLoading(true);
    const data = await teamsGet(`team_${activeTeam.code}`);
    if (data) {
      const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
      await teamsSet(`team_${activeTeam.code}`, updated);
      setTeamData(updated);
    }
    setLoading(false);
  }

  async function openTeam(t) {
    setActiveTeam(t);
    await loadTeam(t.code);
    setTab("team");
  }

  async function leaveTeam(code) {
    if (!window.confirm("¿Seguro que quieres salir de este equipo?")) return;
    setLoading(true);
    try {
      const data = await teamsGet(`team_${code}`);
      if (data) {
        const updated = { ...data, members: { ...data.members } };
        delete updated.members[user.email];
        await teamsSet(`team_${code}`, updated);
      }
    } catch(e) {}
    const updated = myTeams.filter(t => t.code !== code);
    saveMyTeams(updated);
    setTeamPreviews(prev => { const n = {...prev}; delete n[code]; return n; });
    if (activeTeam?.code === code) { setActiveTeam(null); setTeamData(null); setTab("home"); }
    setLoading(false);
  }

  // Refresh preview for a specific team
  async function refreshPreview(code) {
    const data = await teamsGet(`team_${code}`);
    setTeamPreviews(prev => ({ ...prev, [code]: data || null }));
    if (teamData && activeTeam?.code === code) setTeamData(data);
  }

  const members = teamData ? Object.values(teamData.members) : [];
  const sorted = [...members].sort((a,b) => {
    if (rankMetric === "volume") return b.volume - a.volume;
    if (rankMetric === "sessions") return b.sessions - a.sessions;
    if (rankMetric === "prs") return b.prs - a.prs;
    if (rankMetric === "progress") return (b.weeklyProgress||0) - (a.weeklyProgress||0);
    return b.streak - a.streak;
  });

  // Weekly champion = highest weeklyProgress among members with data this week
  const eligibleForChamp = members.filter(m => (m.weeklyProgress||0) > 0 || (m.thisWeekSessions||0) > 0);
  const weeklyChamp = eligibleForChamp.length > 0
    ? eligibleForChamp.reduce((best, m) => (m.weeklyProgress||0) > (best.weeklyProgress||0) ? m : best, eligibleForChamp[0])
    : null;

  const medals = ["🥇","🥈","🥉"];

  // Check if storage is available (only in artifact/deployed context)
  const storageOk = true; // Firestore always available

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">👥 GymTeams</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {!storageOk && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:10, padding:"12px 16px", marginBottom:16, fontSize:13, color:"#f87171" }}>
            ⚠️ Los Teams necesitan que la app esté publicada en Vercel para funcionar. En local (localhost) no hay storage compartido.
          </div>
        )}

        {tab === "home" && (
          <div>
            {/* Guest wall */}
            {user.isGuest ? (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:52, marginBottom:12 }}>🔒</div>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:24, fontWeight:800, marginBottom:8 }}>Cuenta requerida</div>
                <p style={{ fontSize:14, color:"var(--text-muted)", marginBottom:20, lineHeight:1.6 }}>
                  Para crear o unirte a un GymTeam necesitas una cuenta registrada.<br/>
                  Así tu historial y ranking quedan guardados permanentemente.
                </p>
                <button className="btn-primary" style={{ fontSize:16, padding:"12px 28px" }} onClick={onClose}>
                  Crear cuenta gratis →
                </button>
                <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:12 }}>Ya tienes cuenta? Cierra sesión e inicia con tu email.</p>
              </div>
            ) : (
              <>
                {/* My teams */}
                {myTeams.length > 0 && (
                  <div style={{ marginBottom:24 }}>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>Mis Teams ({myTeams.length})</div>
                    {myTeams.map(t => {
                      const cached = teamPreviews[t.code];
                      const memberList = cached ? Object.values(cached.members || {}) : [];
                      return (
                        <div key={t.code} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, marginBottom:10, overflow:"hidden" }}>
                          {/* Header */}
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px" }}>
                            <div>
                              <div style={{ fontWeight:700, fontSize:15 }}>{t.name}</div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", fontFamily:"monospace", marginTop:2 }}>
                                Código: <span style={{ color:"var(--accent)", letterSpacing:2, fontWeight:700 }}>{t.code}</span>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:6 }}>
                          <button className="btn-ghost small" onClick={() => openTeam(t)}>Ver ranking →</button>
                          <button className="btn-ghost small danger" onClick={() => leaveTeam(t.code)}>🚪</button>
                        </div>
                          </div>
                          {/* Members preview */}
                          {memberList.length > 0 && (
                            <div style={{ borderTop:"1px solid var(--border)", padding:"10px 16px", background:"rgba(59,130,246,0.03)" }}>
                              <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>
                                {memberList.length} miembro{memberList.length !== 1 ? "s" : ""}
                              </div>
                              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                                {memberList.map(m => {
                                  const isMe = m.email === user.email;
                                  return (
                                    <div key={m.email} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", background: isMe?"rgba(59,130,246,0.12)":"var(--card)", border:`1px solid ${isMe?"rgba(59,130,246,0.4)":"var(--border)"}`, borderRadius:20 }}>
                                      <div style={{ width:20, height:20, borderRadius:"50%", background: isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, color:"white", flexShrink:0 }}>
                                        {m.name?.[0]?.toUpperCase()||"?"}
                                      </div>
                                      <span style={{ fontSize:12, fontWeight: isMe?700:500, color: isMe?"var(--accent)":"var(--text)" }}>
                                        {m.name}{isMe?" (tú)":""}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          {cached === undefined && (
                            <div style={{ borderTop:"1px solid var(--border)", padding:"8px 16px", fontSize:11, color:"var(--text-muted)" }}>
                              ⏳ Cargando miembros...
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Create */}
                <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:16, marginBottom:14 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🆕 Crear team</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input className="input" placeholder="Nombre del team..." value={createName} onChange={e=>setCreateName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createTeam()} style={{ flex:1 }} />
                    <button className="btn-primary" style={{ fontSize:14, padding:"10px 16px", whiteSpace:"nowrap" }} onClick={createTeam}>Crear</button>
                  </div>
                </div>

                {/* Join */}
                <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:16 }}>
                  <div style={{ fontSize:13, fontWeight:700, marginBottom:10 }}>🔗 Unirse a un team</div>
                  <div style={{ display:"flex", gap:8 }}>
                    <input
                      className="input"
                      placeholder="Código (ej: ABC123)"
                      value={joinCode}
                      onChange={e => {
                        const v = e.target.value.toUpperCase();
                        setJoinCode(v);
                        setJoinPreview(null);
                        setErr("");
                        if (v.length >= 4) previewJoin(v);
                      }}
                      onKeyDown={e => e.key === "Enter" && (joinPreview ? joinTeam() : previewJoin(joinCode))}
                      style={{ flex:1, fontFamily:"monospace", letterSpacing:3, fontSize:16 }}
                      maxLength={6}
                    />
                    {!joinPreview
                      ? <button className="btn-ghost" style={{ whiteSpace:"nowrap" }} onClick={() => previewJoin(joinCode)} disabled={joinPreviewing}>
                          {joinPreviewing ? "⏳" : "🔍 Buscar"}
                        </button>
                      : <button className="btn-primary" style={{ fontSize:14, padding:"10px 16px", whiteSpace:"nowrap" }} onClick={joinTeam} disabled={loading}>
                          {loading ? "⏳" : "✅ Unirse"}
                        </button>
                    }
                  </div>

                  {/* Preview card */}
                  {joinPreviewing && (
                    <div style={{ marginTop:12, padding:"12px 14px", background:"var(--card)", borderRadius:10, border:"1px solid var(--border)", fontSize:13, color:"var(--text-muted)", display:"flex", alignItems:"center", gap:8 }}>
                      <span>⏳</span> Buscando equipo...
                    </div>
                  )}

                  {joinPreview && !joinPreviewing && (
                    <div style={{ marginTop:12, background:"rgba(34,197,94,0.05)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:12, padding:"14px 16px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                        <span style={{ fontSize:24 }}>🏟️</span>
                        <div>
                          <div style={{ fontWeight:800, fontSize:17 }}>{joinPreview.name}</div>
                          <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                            Creado por {joinPreview.createdBy} · {Object.keys(joinPreview.members||{}).length} miembro{Object.keys(joinPreview.members||{}).length!==1?"s":""}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>Miembros actuales</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {Object.values(joinPreview.members||{}).map(m => (
                          <div key={m.email} style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 12px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:20 }}>
                            <div style={{ width:22, height:22, borderRadius:"50%", background:"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:11, color:"white", flexShrink:0 }}>
                              {m.name?.[0]?.toUpperCase()||"?"}
                            </div>
                            <div>
                              <div style={{ fontSize:12, fontWeight:600 }}>{m.name}</div>
                              <div style={{ fontSize:10, color:"var(--text-muted)" }}>{m.sessions} ses · {m.volume}t</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {joinCode.length >= 4 && !joinPreview && !joinPreviewing && !err && (
                    <div style={{ marginTop:10, fontSize:12, color:"var(--text-muted)", textAlign:"center" }}>
                      No se encontró ningún equipo con ese código.
                    </div>
                  )}
                </div>
                {err && <div className="err-msg" style={{ marginTop:10 }}>{err}</div>}
              </>
            )}
          </div>
        )}

        {tab === "team" && activeTeam && (
          <div>
            {/* Header con volver + acciones */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:8 }}>
              <button className="btn-ghost small" onClick={() => setTab("home")}>← Volver</button>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost small" onClick={syncStats} disabled={loading}>{loading?"⏳":"🔄 Mis stats"}</button>
                <button className="btn-ghost small" onClick={() => loadTeam(activeTeam.code)} disabled={loading}>↺</button>
                <button className="btn-ghost small danger" onClick={() => leaveTeam(activeTeam.code)}>🚪 Salir</button>
              </div>
            </div>

            {/* Team header */}
            <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:14, padding:"14px 18px", marginBottom:16 }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:26, fontWeight:800 }}>{activeTeam.name}</div>
              <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4 }}>
                Código para invitar:{" "}
                <span style={{ background:"var(--accent-dim)", color:"var(--accent)", fontFamily:"monospace", fontWeight:800, letterSpacing:3, padding:"2px 10px", borderRadius:6, fontSize:14 }}>{activeTeam.code}</span>
                {" "}· {members.length} miembro{members.length!==1?"s":""}
              </div>
            </div>

            {loading && <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>⏳ Cargando...</div>}

            {!loading && (
              <>
                {/* ── CAMPEÓN SEMANAL ── */}
                {weeklyChamp && (
                  <div style={{ background:"linear-gradient(135deg,rgba(251,191,36,0.12),rgba(245,158,11,0.06))", border:"2px solid rgba(251,191,36,0.45)", borderRadius:16, padding:"16px 18px", marginBottom:18, position:"relative", overflow:"hidden" }}>
                    <div style={{ position:"absolute", top:-20, right:-20, width:100, height:100, borderRadius:"50%", background:"rgba(251,191,36,0.08)", pointerEvents:"none" }} />
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase", marginBottom:10 }}>👑 Campeón de la semana</div>
                    <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                      <div style={{ width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#f59e0b,#f97316)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:900, color:"white", flexShrink:0, boxShadow:"0 4px 16px rgba(245,158,11,0.4)" }}>
                        {weeklyChamp.name?.[0]?.toUpperCase()||"?"}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800 }}>
                          {weeklyChamp.name}
                          {weeklyChamp.email === user.email && <span style={{ fontSize:12, color:"#f59e0b", marginLeft:8 }}>¡Eres tú! 🔥</span>}
                        </div>
                        {(weeklyChamp.weeklyProgress||0) > 0 ? (
                          <div style={{ fontSize:13, color:"#fbbf24", marginTop:2 }}>
                            Subió <b style={{ fontSize:16 }}>+{weeklyChamp.weeklyProgress}%</b> su fuerza esta semana
                            {weeklyChamp.bestImprovement && <span style={{ color:"var(--text-muted)", fontSize:11 }}> · mejor en {weeklyChamp.bestImprovement.name} (+{weeklyChamp.bestImprovement.pct}%)</span>}
                          </div>
                        ) : (
                          <div style={{ fontSize:13, color:"#fbbf24" }}>
                            {weeklyChamp.thisWeekSessions||0} sesiones esta semana 💪
                          </div>
                        )}
                      </div>
                      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:36, fontWeight:900, color:"#f59e0b", flexShrink:0 }}>
                        {(weeklyChamp.weeklyProgress||0) > 0 ? `+${weeklyChamp.weeklyProgress}%` : `${weeklyChamp.thisWeekSessions||0} 🏋️`}
                      </div>
                    </div>
                    <div style={{ marginTop:12, fontSize:11, color:"rgba(251,191,36,0.7)", lineHeight:1.5 }}>
                      ⚡ Basado en mejora de 1RM relativa a tu propio peso corporal esta semana vs la anterior
                    </div>
                  </div>
                )}

                {/* ── MIEMBROS ── */}
                <div style={{ marginBottom:18 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>
                    👥 Miembros ({members.length})
                  </div>
                  <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                    {members.map(m => {
                      const isMe = m.email === user.email;
                      const isChamp = weeklyChamp?.email === m.email;
                      return (
                        <div key={m.email} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 12px", background: isChamp?"rgba(251,191,36,0.08)":isMe?"rgba(59,130,246,0.1)":"var(--input-bg)", border:`1px solid ${isChamp?"rgba(251,191,36,0.4)":isMe?"rgba(59,130,246,0.4)":"var(--border)"}`, borderRadius:24 }}>
                          <div style={{ width:24, height:24, borderRadius:"50%", background: isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:11, color:"white", flexShrink:0 }}>
                            {m.name?.[0]?.toUpperCase()||"?"}
                          </div>
                          <span style={{ fontSize:12, fontWeight: isMe?700:500 }}>
                            {isChamp?"👑 ":""}{m.name}{isMe?" (tú)":""}
                          </span>
                        </div>
                      );
                    })}
                    {members.length === 0 && <p style={{ fontSize:13, color:"var(--text-muted)" }}>Solo tú. ¡Comparte el código!</p>}
                  </div>
                </div>

                {/* ── RANKING ── */}
                {members.length > 0 && (
                  <>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>🏆 Ranking</div>
                    <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
                      {[
                        ["progress","📈 Progreso %"],
                        ["volume","🏋️ Volumen"],
                        ["sessions","📋 Sesiones"],
                        ["prs","⭐ PRs"],
                        ["streak","🔥 Racha"],
                      ].map(([m,l])=>(
                        <button key={m} className={`muscle-chip ${rankMetric===m?"active":""}`} onClick={()=>setRankMetric(m)}>{l}</button>
                      ))}
                    </div>

                    {rankMetric === "progress" && (
                      <div style={{ background:"rgba(59,130,246,0.05)", border:"1px solid rgba(59,130,246,0.15)", borderRadius:10, padding:"10px 14px", marginBottom:12, fontSize:12, color:"var(--text-muted)", lineHeight:1.6 }}>
                        📊 <b>Progreso relativo</b>: mejora promedio de 1RM esta semana vs la anterior, normalizada por tu propio nivel. Así alguien que sube de 60→63 kg compite igual que alguien que sube de 100→105 kg.
                      </div>
                    )}

                    {sorted.map((m, i) => {
                      const isMe = m.email === user.email;
                      const isChamp = weeklyChamp?.email === m.email && rankMetric === "progress";
                      const medals = ["🥇","🥈","🥉"];

                      let val, myVal, maxVal;
                      if (rankMetric === "progress") {
                        val = (m.weeklyProgress||0) > 0 ? `+${m.weeklyProgress}%` : (m.thisWeekSessions||0) > 0 ? `${m.thisWeekSessions} ses.` : "—";
                        myVal = m.weeklyProgress||0;
                        maxVal = Math.max(...sorted.map(x => x.weeklyProgress||0), 0.1);
                      } else if (rankMetric === "volume") {
                        val = `${m.volume}t`; myVal = m.volume; maxVal = Math.max(...sorted.map(x=>x.volume),0.1);
                      } else if (rankMetric === "sessions") {
                        val = `${m.sessions} ses.`; myVal = m.sessions; maxVal = Math.max(...sorted.map(x=>x.sessions),1);
                      } else if (rankMetric === "prs") {
                        val = `${m.prs} PRs`; myVal = m.prs; maxVal = Math.max(...sorted.map(x=>x.prs),1);
                      } else {
                        val = `${m.streak}d`; myVal = m.streak; maxVal = Math.max(...sorted.map(x=>x.streak),1);
                      }
                      const barPct = maxVal > 0 ? Math.min((myVal/maxVal)*100, 100) : 0;
                      const barColor = i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":isMe?"var(--accent)":"#475569";

                      return (
                        <div key={m.email} style={{ padding:"12px 14px", background: isChamp?"rgba(251,191,36,0.06)":isMe?"rgba(59,130,246,0.08)":"var(--input-bg)", border:`2px solid ${isChamp?"rgba(251,191,36,0.45)":isMe?"var(--accent)":"var(--border)"}`, borderRadius:12, marginBottom:8 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:6 }}>
                            <div style={{ width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", fontSize: i<3?20:12, fontWeight:800, flexShrink:0 }}>
                              {i < 3 ? medals[i] : <span style={{ color:"var(--text-muted)" }}>#{i+1}</span>}
                            </div>
                            <div style={{ width:34, height:34, borderRadius:"50%", background: isMe?"var(--accent)":"var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:14, color:"white", flexShrink:0 }}>
                              {m.name?.[0]?.toUpperCase()||"?"}
                            </div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:700, fontSize:13, display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                {isChamp && "👑 "}{m.name}
                                {isMe && <span style={{ fontSize:10, background:"var(--accent)", color:"white", borderRadius:5, padding:"1px 6px" }}>TÚ</span>}
                              </div>
                              <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>
                                {m.sessions} ses · {m.volume}t · {m.prs} PRs · {m.streak}d
                                {rankMetric==="progress" && m.bestImprovement && (
                                  <span style={{ color:"#22c55e" }}> · 🏋️ {m.bestImprovement.name} +{m.bestImprovement.pct}%</span>
                                )}
                              </div>
                            </div>
                            <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800, color: i===0?"#f59e0b":i===1?"#94a3b8":i===2?"#b45309":isMe?"var(--accent)":"var(--text)", flexShrink:0 }}>
                              {val}
                            </div>
                          </div>
                          <div style={{ background:"var(--border)", borderRadius:4, height:4, overflow:"hidden" }}>
                            <div style={{ height:"100%", background:barColor, width:`${barPct}%`, borderRadius:4, transition:"width 0.6s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}

                <p style={{ fontSize:11, color:"var(--text-muted)", textAlign:"center", marginTop:14 }}>
                  💡 Pulsa "🔄 Mis stats" para actualizar tu posición.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Firebase Error Translator ─────────────────────────────────────────────────
function firebaseErrMsg(code) {
  const map = {
    "auth/email-already-in-use":   "Este email ya está registrado",
    "auth/invalid-email":          "Email inválido",
    "auth/weak-password":          "Contraseña muy débil",
    "auth/user-not-found":         "Email o contraseña incorrectos",
    "auth/wrong-password":         "Email o contraseña incorrectos",
    "auth/invalid-credential":     "Email o contraseña incorrectos",
    "auth/too-many-requests":      "Demasiados intentos. Resetea tu contraseña.",
    "auth/network-request-failed": "Sin conexión a internet",
  };
  return map[code] || "Ocurrió un error. Intenta de nuevo.";
}

// ─── Login ────────────────────────────────────────────────────────────────────
function PasswordStrength({ pass }) {
  const checks = {
    length: pass.length >= 8,
    upper: /[A-Z]/.test(pass),
    lower: /[a-z]/.test(pass),
    number: /[0-9]/.test(pass),
  };
  const score = Object.values(checks).filter(Boolean).length;
  const colors = ["#ef4444","#f97316","#eab308","#22c55e"];
  if (!pass) return null;
  return (
    <div style={{marginTop:6}}>
      <div style={{display:"flex",gap:3,marginBottom:4}}>
        {[0,1,2,3].map(i=><div key={i} style={{flex:1,height:3,borderRadius:2,background:i<score?colors[score-1]:"var(--border)"}}/>)}
      </div>
      {[{ok:checks.length,l:"8+ caracteres"},{ok:checks.upper,l:"Mayúscula"},{ok:checks.lower,l:"Minúscula"},{ok:checks.number,l:"Número"}].map(x=>(
        <div key={x.l} style={{fontSize:10,color:x.ok?"#22c55e":"var(--text-muted)"}}>{x.ok?"✓":"○"} {x.l}</div>
      ))}
    </div>
  );
}

function LoginScreen() {
  const { loginWithFirebase, registerWithFirebase, loginAsGuest, resetPassword, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  function switchMode(m) { setMode(m); setErr(""); setMsg(""); }

  async function submit() {
    setErr(""); setMsg("");
    if (mode === "forgot") {
      if (!email) { setErr("Ingresa tu email"); return; }
      setLoading(true);
      const result = await resetPassword(email);
      setLoading(false);
      if (result.ok) setMsg("✅ Revisa tu correo para restablecer la contraseña.");
      else setErr(result.msg);
      return;
    }
    if (!email || !pass) { setErr("Completa todos los campos"); return; }
    if (mode === "register") {
      if (!name.trim()) { setErr("Ingresa tu nombre"); return; }
      if (pass !== passConfirm) { setErr("Las contraseñas no coinciden"); return; }
      setLoading(true);
      const result = await registerWithFirebase(name.trim(), email, pass);
      setLoading(false);
      if (!result.ok) setErr(result.msg);
    } else {
      setLoading(true);
      const result = await loginWithFirebase(email, pass);
      setLoading(false);
      if (!result.ok) setErr(result.msg);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <div className="login-logo">
          <span style={{ fontSize: 36 }}>⚡</span>
          <span className="logo-text">GymTracker</span>
        </div>
        <p className="text-muted" style={{ marginBottom: 20, fontSize: 14 }}>Tu entrenamiento. Tu progreso.</p>

        {mode !== "forgot" && (
          <div className="tab-row" style={{ marginBottom: 20 }}>
            <button className={`tab-btn ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>Iniciar sesión</button>
            <button className={`tab-btn ${mode === "register" ? "active" : ""}`} onClick={() => switchMode("register")}>Registrarse</button>
          </div>
        )}

        {mode === "forgot" && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:20, fontWeight:700, marginBottom:6 }}>🔑 Recuperar contraseña</div>
            <p style={{ fontSize:13, color:"var(--text-muted)" }}>Te enviaremos un enlace para restablecer tu contraseña.</p>
          </div>
        )}

        {mode === "register" && (
        <div className="field">
          <label className="field-label">Nombre</label>
          <input className="input" type="text" placeholder="Tu nombre" value={name} onChange={e => setName(lettersOnly(e.target.value))} autoComplete="name" />
        </div>
      )}
        <div className="field">
          <label className="field-label">Email</label>
          
          <input className="input" type="email" placeholder="email@ejemplo.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" onKeyDown={e => e.key === "Enter" && !pass && submit()} />
        </div>

        {mode !== "forgot" && (
          <div className="field">
            <label className="field-label">Contraseña</label>
            <input className="input" type="password" placeholder="••••••••" value={pass} onChange={e => setPass(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {mode === "register" && <PasswordStrength pass={pass}/>}
          </div>
        )}
        {mode === "register" && (
  <div className="field">
    <label className="field-label">Confirmar contraseña</label>
    <input className="input" type="password" placeholder="••••••••"
      value={passConfirm} onChange={e => setPassConfirm(e.target.value)} />
    {pass && passConfirm && pass !== passConfirm && (
      <span style={{fontSize:11,color:"#f87171"}}>❌ Las contraseñas no coinciden</span>
    )}
  </div>
)}

        {err && <div className="err-msg">{err}</div>}
        {msg && <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.3)", color:"#22c55e", borderRadius:8, padding:"9px 12px", fontSize:13, marginBottom:10 }}>{msg}</div>}

        <button className="btn-primary" style={{ width:"100%", marginTop:8 }} onClick={submit} disabled={loading}>
          {loading ? "⏳ Cargando..." : mode === "login" ? "Entrar" : mode === "register" ? "Crear cuenta" : "Enviar enlace"}
        </button>

        {mode === "login" && (
  <p style={{ textAlign:"center", marginTop:10, fontSize:13 }}>
    <button className="link-btn" onClick={() => switchMode("forgot")} style={{ color:"var(--text-muted)" }}>¿Olvidaste tu contraseña?</button>
  </p>
)}
{mode === "forgot" && (
  <p style={{ textAlign:"center", marginTop:10, fontSize:13 }}>
    <button className="link-btn" onClick={() => switchMode("login")}>← Volver al inicio</button>
  </p>
)}
{mode !== "forgot" && (
  <p className="text-muted" style={{ fontSize:13, textAlign:"center", marginTop:14 }}>
    {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
    <button className="link-btn" onClick={() => switchMode(mode === "login" ? "register" : "login")}>
      {mode === "login" ? "Regístrate" : "Inicia sesión"}
    </button>
  </p>
)}
<div style={{ display:"flex", alignItems:"center", gap:12, margin:"16px 0 12px" }}>
  <div style={{ flex:1, height:1, background:"var(--border)" }} />
  <span style={{ fontSize:12, color:"var(--text-muted)", fontWeight:600 }}>O</span>
  <div style={{ flex:1, height:1, background:"var(--border)" }} />
</div>
<button onClick={() => { loginWithGoogle(); }} 
 style={{width:"100%",background:"white",border:"1px solid #d1dce8",borderRadius:12,padding:"11px 16px",display:"flex",alignItems:"center",gap:12,cursor:"pointer",marginBottom:12,fontFamily:"Barlow,sans-serif",fontSize:14,fontWeight:600,color:"#1f2937"}}>
  <img src="https://www.google.com/favicon.ico" width={18}/> Continuar con Google
</button>
<button className="btn-guest" onClick={loginAsGuest}>
  <span style={{ fontSize:18 }}>👤</span>
  <div style={{ textAlign:"left" }}>
    <div style={{ fontWeight:700, fontSize:14 }}>Entrar como invitado</div>
    <div style={{ fontSize:11, opacity:0.7, marginTop:1 }}>3 sesiones · Sin historial guardado</div>
  </div>
</button>
      </div>
    </div>
  );
}


// ─── Dashboard ────────────────────────────────────────────────────────────────
function Dashboard({ sessions, bodyStats, weeklyGoal, onGoalClick, onBadgesClick }) {
  const total = sessions.length;
  const thisWeek = sessions.filter(s => (new Date() - new Date(s.date + "T00:00:00")) / 86400000 <= 7).length;
  const exCount = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => { exCount[ex.name] = (exCount[ex.name] || 0) + 1; }));
  const topEx = Object.entries(exCount).sort((a, b) => b[1] - a[1])[0];
  const wCount = {};
  sessions.forEach(s => { wCount[s.workout] = (wCount[s.workout] || 0) + 1; });
  const topW = Object.entries(wCount).sort((a, b) => b[1] - a[1])[0];
  const totalVol = sessions.reduce((acc, s) => acc + (s.exercises || []).reduce((a, ex) => a + (parseFloat(ex.weight) || 0) * (parseFloat(ex.reps) || 1), 0), 0);

  // Streak
  const sortedDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streak = 0;
  let checkDate = new Date(); checkDate.setHours(0,0,0,0);
  for (let d of sortedDates) {
    const sd = new Date(d + "T00:00:00");
    const diff = Math.round((checkDate - sd) / 86400000);
    if (diff <= 1) { streak++; checkDate = sd; } else break;
  }

  // All PRs
  const prs = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    const rm = calc1RM(
      ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(ex.weight) || 0,
      ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(ex.reps) || 0
    );
    if (!prs[ex.name] || rm > prs[ex.name].rm) prs[ex.name] = { rm, date: s.date };
  }));
  const topPRs = Object.entries(prs).sort((a, b) => b[1].rm - a[1].rm).slice(0, 5);

  const stats = [
    { icon: "🏋️", label: "Sesiones totales", value: total },
    { icon: "🔥", label: "Esta semana", value: thisWeek },
    { icon: "🔑", label: "Racha actual", value: `${streak} días` },
    { icon: "⭐", label: "Ejercicio top", value: topEx ? topEx[0] : "—" },
    { icon: "💪", label: "Rutina favorita", value: topW ? topW[0] : "—" },
    { icon: "⚖️", label: "Volumen total", value: totalVol > 0 ? `${(totalVol / 1000).toFixed(1)}t` : "—" },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20, flexWrap:"wrap", gap:8 }}>
        <div className="section-title" style={{ margin:0 }}>Dashboard</div>
        <div style={{ display:"flex", gap:8 }}>
          {weeklyGoal?.target > 0 && (() => {
            const tw = sessions.filter(s => (new Date()-new Date(s.date+"T00:00:00"))/86400000 <= 7).length;
            const done = tw >= weeklyGoal.target;
            return <button onClick={onGoalClick} style={{ background: done?"rgba(34,197,94,0.1)":"rgba(59,130,246,0.08)", border:`1px solid ${done?"rgba(34,197,94,0.35)":"rgba(59,130,246,0.25)"}`, color:done?"#22c55e":"var(--accent)", borderRadius:10, padding:"6px 12px", fontFamily:"Barlow, sans-serif", fontSize:12, fontWeight:700, cursor:"pointer" }}>🎯 {tw}/{weeklyGoal.target}</button>;
          })()}
          <button onClick={onBadgesClick} style={{ background:"rgba(245,158,11,0.1)", border:"1px solid rgba(245,158,11,0.35)", color:"#f59e0b", borderRadius:10, padding:"6px 12px", fontFamily:"Barlow, sans-serif", fontSize:12, fontWeight:700, cursor:"pointer" }}>🏅 {BADGE_DEFS.filter(b=>b.check(sessions,getPRs(sessions))).length}/{BADGE_DEFS.length}</button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 28 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card" style={{ animationDelay: `${i * 0.07}s` }}>
            <span style={{ fontSize: 26 }}>{s.icon}</span>
            <span className="stat-value">{s.value}</span>
            <span className="text-muted" style={{ fontSize: 11 }}>{s.label}</span>
          </div>
        ))}
      </div>

      <WeeklyChart sessions={sessions} />
      <ProgressPrediction sessions={sessions} />
      <MuscleBalance sessions={sessions} />
      {topPRs.length > 0 && (
        <div className="card">
          <div className="card-label">🏆 Top Récords Personales (1RM estimado)</div>
          {topPRs.map(([name, data], i) => (
            <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < topPRs.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: i === 0 ? "#f59e0b" : i === 1 ? "#94a3b8" : i === 2 ? "#b45309" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "white", flexShrink: 0 }}>{i + 1}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{name}</span>
              </div>
              <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>{data.rm} kg</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Session Card ─────────────────────────────────────────────────────────────
function SessionCard({ s, unit, onDelete, onEdit, onDuplicate, onProgress, onShare, getProgressData, expanded, onToggle, allSessions, onUpdate }) {
  const u = s.unit || unit;
  const [editingExId, setEditingExId] = useState(null);
  const sessionVol = calcSessionVolume(s);
  const volDisplay = sessionVol >= 1000
    ? `${(sessionVol/1000).toFixed(1)}t`
    : sessionVol > 0 ? `${Math.round(sessionVol)}kg` : null;

  // Detect PRs in this session
  const prs = new Set();
  (s.exercises || []).forEach(ex => {
    const sessWeight = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(ex.weight) || 0;
    const sessReps = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(ex.reps) || 0;
    const sess1RM = calc1RM(sessWeight, sessReps);
    const prevBest = allSessions
      .filter(ps => ps.date < s.date)
      .flatMap(ps => (ps.exercises || []).filter(pe => pe.name === ex.name))
      .reduce((best, pe) => {
        const pw = pe.sets?.length > 0 ? Math.max(...pe.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(pe.weight) || 0;
        const pr = pe.sets?.length > 0 ? Math.max(...pe.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(pe.reps) || 0;
        return Math.max(best, calc1RM(pw, pr));
      }, 0);
    if (sess1RM > prevBest && sessWeight > 0) prs.add(ex.name);
  });

  function updateExField(exId, field, val) {
    const updated = { ...s, exercises: s.exercises.map(e => e.id === exId ? { ...e, [field]: val } : e) };
    onUpdate(updated);
  }
  function updateSetField(exId, setId, field, val) {
    const updated = { ...s, exercises: s.exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.map(st => st.id === setId ? { ...st, [field]: val } : st) }) };
    onUpdate(updated);
  }
  function addSetToEx(exId) {
    const ex = s.exercises.find(e => e.id === exId);
    const lastSet = ex?.sets?.[ex.sets.length - 1];
    const newSet = { id: uid(), weight: lastSet?.weight || ex?.weight || "", reps: lastSet?.reps || ex?.reps || "" };
    const updated = { ...s, exercises: s.exercises.map(e => e.id !== exId ? e : { ...e, sets: [...(e.sets || [{ id: uid(), weight: e.weight||"", reps: e.reps||"" }]), newSet] }) };
    onUpdate(updated);
  }
  function removeSetFromEx(exId, setId) {
    const updated = { ...s, exercises: s.exercises.map(e => e.id !== exId ? e : { ...e, sets: e.sets.filter(st => st.id !== setId) }) };
    onUpdate(updated);
  }

  return (
    <div className="card session-card">
      <div className="session-header" onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="session-date">{fmtDate(s.date)}</span>
          <span className="session-workout">{s.workout}</span>
          {prs.size > 0 && <span style={{ fontSize: 10, background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.5)", color: "#f59e0b", borderRadius: 6, padding: "2px 7px", fontWeight: 700 }}>🏆 {prs.size} PR</span>}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {volDisplay && (
            <span className="ex-count" style={{ color:"var(--accent)", borderColor:"rgba(59,130,246,0.3)" }}>
              🏋️ {volDisplay}
            </span>
          )}
          <span className="ex-count">{(s.exercises || []).length} ejerc.</span>
          <span className="chevron">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div className="session-body">
          {s.notes && <p className="session-notes">{s.notes}</p>}
          {(s.exercises || []).map(ex => {
            const isEditing = editingExId === ex.id;
            const hasMultiSets = ex.sets?.length > 1;
            const displayWeight = ex.sets?.length > 0 ? ex.sets[0].weight : ex.weight;
            const displayReps = ex.sets?.length > 0 ? ex.sets[0].reps : ex.reps;
            return (
              <div key={ex.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 10, marginBottom: 10 }}>
                {/* Row header */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6 }}>
                  <ExerciseGif exName={ex.name} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span className="ex-name">{ex.name}</span>
                    {prs.has(ex.name) && <span style={{ fontSize: 9, background: "rgba(251,191,36,0.15)", color: "#f59e0b", borderRadius: 4, padding: "1px 5px", marginLeft: 6, fontWeight: 800 }}>PR</span>}
                  </div>
                  <button className="icon-action" title="Ver progreso" onClick={() => onProgress(ex.name)}>📈</button>
              <button className="btn-ghost small" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => setEditingExId(isEditing ? null : ex.id)}>
                  {isEditing ? "✓ Listo" : "✏️ Editar"}
                </button>
              </div>

              {/* View mode: just show summary */}
              {!isEditing && (
                <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)" }}>
                  {hasMultiSets
                    ? ex.sets.map((st, i) => <span key={st.id} style={{ marginRight: 10 }}>S{i+1}: <b style={{ color: "var(--text)" }}>{st.weight||"—"}{u}×{st.reps||"—"}</b></span>)
                    : <span><b style={{ color: (displayWeight && displayWeight !== "0") ? "var(--text)" : "var(--accent)" }}>{(displayWeight && displayWeight !== "0") ? `${displayWeight}${u} × ${displayReps}` : "⚠️ Sin peso/reps — pulsa Editar"}</b></span>
                  }
                </div>
              )}
              {!isEditing && ex.note && (
                <div style={{ marginTop: 4, fontSize: 11, color: "var(--accent)", fontStyle: "italic", display:"flex", alignItems:"center", gap:4 }}>
                  💬 {ex.note}
                </div>
              )}
                {/* Edit mode */}
                {isEditing && (
                  <div style={{ marginTop: 8 }}>
                    {(hasMultiSets ? ex.sets : [{ id: ex.sets?.[0]?.id || uid(), weight: displayWeight||"", reps: displayReps||"" }]).map((st, i) => (
                      <div key={st.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", width: 24, flexShrink: 0 }}>S{i+1}</span>
                        <input className="input" style={{ flex: 1, padding: "6px 10px", fontSize: 13 }} placeholder={`Peso (${u})`} value={st.weight||""} onChange={e => {
                          if (hasMultiSets) updateSetField(ex.id, st.id, "weight", numDot(e.target.value));
                          else updateExField(ex.id, "weight", numDot(e.target.value));
                        }} />
                        <span style={{ color: "var(--text-muted)" }}>×</span>
                        <input className="input" style={{ flex: 1, padding: "6px 10px", fontSize: 13 }} placeholder="Reps" value={st.reps||""} onChange={e => {
                          if (hasMultiSets) updateSetField(ex.id, st.id, "reps", numDot(e.target.value));
                          else updateExField(ex.id, "reps", numDot(e.target.value));
                        }} />
                        {hasMultiSets && ex.sets.length > 1 && <button className="chip-del" onClick={() => removeSetFromEx(ex.id, st.id)}>×</button>}
                      </div>
                    ))}
                    <button className="btn-ghost small" style={{ fontSize: 11, marginTop: 2 }} onClick={() => addSetToEx(ex.id)}>+ Añadir set</button>
                  </div>
                )}
              </div>
            );
          })}
          <div className="session-actions">
            <button className="btn-ghost" onClick={() => onEdit(s)}>✏️ Editar sesión</button>
            <button className="btn-ghost" onClick={() => onDuplicate(s)}>📋 Duplicar</button>
            <button className="btn-ghost danger" onClick={() => onDelete(s.id)}>🗑️ Eliminar</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SidebarGroup({ label, items }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", color: "var(--text-muted)", padding: "10px 12px", cursor: "pointer", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" }}>
        <span>{label}</span>
        <span style={{ fontSize: 10, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>▼</span>
      </button>
      {open && (
        <div style={{ animation: "fadeIn 0.15s ease" }}>
          {items.map(item => (
            <button key={item.label} className="nav-item" onClick={item.action}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────
// RestTimerFloating.jsx
// Widget flotante de descanso. Pegar ANTES de la función GymApp.
// ─────────────────────────────────────────────────────────────────────────────

function RestTimerFloating({ timer, setTimer }) {
  const remaining = Math.max(0, timer.secs - timer.elapsed);
  const pct = Math.min(timer.elapsed / timer.secs, 1);
  const done = timer.elapsed >= timer.secs;
  const r = 20, cx = 24, cy = 24;
  const circ = 2 * Math.PI * r;
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16, zIndex: 1500,
      background: "var(--card)",
      border: `2px solid ${done ? "#22c55e" : "var(--accent)"}`,
      borderRadius: 18, padding: "12px 14px",
      boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", gap: 12, minWidth: 220,
      transition: "border-color 0.3s",
    }}>
      {/* Ring timer */}
      <svg width={48} height={48} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle
          cx={cx} cy={cy} r={r} fill="none"
          stroke={done ? "#22c55e" : "var(--accent)"}
          strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
        <text
          x={cx} y={cy + 5} textAnchor="middle"
          fill="var(--text)" fontSize={done ? 9 : 11}
          fontWeight={800} fontFamily="Barlow Condensed, sans-serif"
        >
          {done ? "¡LISTO!" : fmt(remaining)}
        </text>
      </svg>

      {/* Controls */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: done ? "#22c55e" : "var(--accent)",
          textTransform: "uppercase", marginBottom: 6,
        }}>
          {done ? "✓ Descansaste" : "⏱ Descanso"}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {!done ? (
            <button
              onClick={() => setTimer(t => ({ ...t, running: !t.running }))}
              style={{
                background: "var(--accent)", border: "none", borderRadius: 7,
                padding: "4px 10px", color: "white", fontSize: 13,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              {timer.running ? "⏸" : "▶"}
            </button>
          ) : (
            <button
              onClick={() => setTimer(t => ({ ...t, elapsed: 0, running: true }))}
              style={{
                background: "#22c55e", border: "none", borderRadius: 7,
                padding: "4px 10px", color: "white", fontSize: 13,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              ↺ Repetir
            </button>
          )}
          {[60, 90, 120].map(s => (
            <button
              key={s}
              onClick={() => setTimer(t => ({ ...t, secs: s, elapsed: 0, running: true }))}
              style={{
                background: timer.secs === s && !done ? "rgba(59,130,246,0.18)" : "var(--input-bg)",
                border: `1px solid ${timer.secs === s && !done ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 7, padding: "4px 8px",
                color: timer.secs === s && !done ? "var(--accent)" : "var(--text-muted)",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Close */}
      <button
        onClick={() => setTimer(t => ({ ...t, visible: false, running: false, elapsed: 0 }))}
        style={{
          background: "none", border: "none",
          color: "var(--text-muted)", cursor: "pointer",
          fontSize: 16, flexShrink: 0, lineHeight: 1,
        }}
      >✕</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveTrainMode.jsx
// Pantalla completa de entrenamiento en vivo. Pegar ANTES de GymApp.
// Props: exercises, workout, date, notes, unit, sessions,
//        onSaveSession(finalExercises, elapsedSecs), onBack,
//        floatTimer, setFloatTimer,
//        calc1RM, ExerciseGif, uid, numDot
// ─────────────────────────────────────────────────────────────────────────────

function LiveTrainMode({
  exercises, workout, date, notes, unit, sessions,
  onSaveSession, onBack,
  floatTimer, setFloatTimer,
  calc1RM, ExerciseGif, uid, numDot,
}) {
  const [elapsed, setElapsed] = React.useState(0);
  const [running, setRunning] = React.useState(true);
  const [currentEx, setCurrentEx] = React.useState(0);
  const [exData, setExData] = React.useState(() =>
    exercises.map(ex => ({
      ...ex,
      sets: ex.sets?.length
        ? ex.sets.map(s => ({ ...s, done: false }))
        : [{ id: uid(), weight: "", reps: "", done: false }],
    }))
  );
  const [showSummary, setShowSummary] = React.useState(false);
  const timerRef = React.useRef();

  React.useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running]);

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const totalSets = exData.reduce((a, e) => a + e.sets.length, 0);
  const doneSets  = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const pct = totalSets > 0 ? doneSets / totalSets : 0;

  function toggleSet(exIdx, setIdx) {
    const wasDone = exData[exIdx].sets[setIdx].done;
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done }),
      }
    ));
    // Auto-lanzar timer de descanso al COMPLETAR una serie
    if (!wasDone) {
      setFloatTimer(t => ({ ...t, visible: true, secs: 90, elapsed: 0, running: true }));
    }
  }

  function updateSet(exIdx, setIdx, field, val) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: ex.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val }),
      }
    ));
  }

  function addSet(exIdx) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx ? ex : {
        ...ex,
        sets: [...ex.sets, {
          id: uid(),
          weight: ex.sets[ex.sets.length - 1]?.weight || "",
          reps:   ex.sets[ex.sets.length - 1]?.reps   || "",
          done:   false,
        }],
      }
    ));
  }

  function removeSet(exIdx) {
    setExData(prev => prev.map((ex, i) =>
      i !== exIdx || ex.sets.length <= 1 ? ex : {
        ...ex, sets: ex.sets.slice(0, -1),
      }
    ));
  }

  // ── PANTALLA RESUMEN ────────────────────────────────────────────────────────
  if (showSummary) {
    const totalVol = exData.reduce((acc, ex) =>
      acc + ex.sets.filter(s => s.done)
        .reduce((a, s) => a + (parseFloat(s.weight) || 0) * (parseFloat(s.reps) || 1), 0), 0);
    const completedSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);

    return (
      <div style={{
        minHeight: "calc(100vh - 60px)", background: "var(--bg)",
        display: "flex", flexDirection: "column", padding: "28px 20px",
        animation: "fadeIn 0.4s ease",
      }}>
        {/* Trophy header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 64, marginBottom: 8 }}>🏆</div>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif",
            fontSize: 40, fontWeight: 900, letterSpacing: 1, marginBottom: 4,
          }}>
            ¡Sesión completada!
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {workout} · {fmt(elapsed)}
          </div>
        </div>

        {/* Stats grid */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
          gap: 12, marginBottom: 28, maxWidth: 560, width: "100%", margin: "0 auto 28px",
        }}>
          {[
            { icon: "⏱️", label: "Tiempo",      value: fmt(elapsed) },
            { icon: "🏋️", label: "Ejercicios",  value: exData.length },
            { icon: "🔢", label: "Series",       value: completedSets },
            { icon: "📦", label: "Volumen",
              value: totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}t` : `${Math.round(totalVol)}kg` },
          ].map(s => (
            <div key={s.label} style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "16px 12px", textAlign: "center",
            }}>
              <div style={{ fontSize: 28, marginBottom: 4 }}>{s.icon}</div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 28, fontWeight: 800, color: "var(--accent)",
              }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Per-exercise breakdown */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", marginBottom: 28 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 2,
            color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12,
          }}>
            Resumen por ejercicio
          </div>
          {exData.map((ex, i) => {
            const doneS  = ex.sets.filter(s => s.done);
            const maxW   = doneS.length > 0 ? Math.max(...doneS.map(s => parseFloat(s.weight) || 0)) : 0;
            const best1rm = doneS.length > 0
              ? Math.max(...doneS.map(s => calc1RM(parseFloat(s.weight) || 0, parseFloat(s.reps) || 0)))
              : 0;
            return (
              <div key={i} style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "12px 14px", marginBottom: 8,
                display: "flex", gap: 12, alignItems: "center",
              }}>
                <ExerciseGif exName={ex.name} size={44} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
                    {doneS.length > 0 ? "✓ " : "○ "}{ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doneS.length}/{ex.sets.length} series
                    {maxW > 0 && ` · máx ${maxW}kg`}
                    {best1rm > 0 && ` · ~${best1rm}kg 1RM`}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 150, justifyContent: "flex-end" }}>
                  {doneS.map((s, j) => (
                    <span key={j} style={{
                      fontSize: 11, padding: "2px 7px",
                      background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
                      borderRadius: 6, color: "#22c55e", fontWeight: 600,
                    }}>
                      {s.weight || "—"}×{s.reps || "—"}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action buttons */}
        <div style={{ maxWidth: 560, margin: "0 auto", width: "100%", display: "flex", gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              flex: 1, background: "var(--card)", border: "1px solid var(--border)",
              color: "var(--text-muted)", borderRadius: 12, padding: 14,
              fontFamily: "Barlow, sans-serif", fontSize: 14, cursor: "pointer",
            }}
          >
            ✕ Descartar
          </button>
          <button
            onClick={() => {
              const finalExercises = exData
                .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.done || s.weight || s.reps) }))
                .filter(ex => ex.sets.length > 0);
              onSaveSession(finalExercises, elapsed);
            }}
            style={{
              flex: 2, background: "var(--accent)", border: "none",
              color: "white", borderRadius: 12, padding: 14,
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 20, fontWeight: 800, letterSpacing: 1, cursor: "pointer",
            }}
          >
            💾 Guardar sesión
          </button>
        </div>
      </div>
    );
  }

  // ── PANTALLA PRINCIPAL DE ENTRENAMIENTO ─────────────────────────────────────
  return (
    <div style={{ minHeight: "calc(100vh - 60px)", background: "var(--bg)", display: "flex", flexDirection: "column" }}>

      {/* ── Sticky header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        flexShrink: 0, position: "sticky", top: 0, zIndex: 10,
      }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "1px solid var(--border)",
            color: "var(--text-muted)", borderRadius: 8, padding: "6px 10px",
            cursor: "pointer", fontSize: 12, flexShrink: 0,
          }}
        >← Salir</button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 800,
            letterSpacing: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            ⚡ {workout || "Entrenamiento"}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {doneSets}/{totalSets} series completadas
          </div>
        </div>

        {/* Cronómetro */}
        <div style={{ textAlign: "center", flexShrink: 0 }}>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 800,
            letterSpacing: 2, color: running ? "var(--accent)" : "var(--text-muted)",
          }}>
            {fmt(elapsed)}
          </div>
          <button
            onClick={() => setRunning(r => !r)}
            style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: 10, cursor: "pointer", fontFamily: "Barlow, sans-serif",
            }}
          >
            {running ? "⏸ pausar" : "▶ reanudar"}
          </button>
        </div>

        <button
          onClick={() => { setRunning(false); setShowSummary(true); }}
          style={{
            background: "var(--accent)", border: "none", color: "white",
            borderRadius: 10, padding: "10px 14px",
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, fontWeight: 700,
            cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
          }}
        >
          Finalizar →
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--border)", flexShrink: 0 }}>
        <div style={{
          height: "100%",
          background: "linear-gradient(90deg, var(--accent), #22c55e)",
          width: `${pct * 100}%`,
          transition: "width 0.4s ease", borderRadius: 2,
        }} />
      </div>

      {/* Exercise tabs */}
      <div style={{
        display: "flex", gap: 6, padding: "10px 16px 0",
        overflowX: "auto", flexShrink: 0, scrollbarWidth: "none",
      }}>
        {exData.map((ex, i) => {
          const allDone = ex.sets.every(s => s.done) && ex.sets.length > 0;
          const anyDone = ex.sets.some(s => s.done);
          return (
            <button key={i} onClick={() => setCurrentEx(i)} style={{
              background: currentEx === i ? "var(--accent)"
                : allDone ? "rgba(34,197,94,0.12)"
                : anyDone ? "rgba(59,130,246,0.08)"
                : "var(--card)",
              border: `1px solid ${currentEx === i ? "var(--accent)" : allDone ? "#22c55e" : "var(--border)"}`,
              color: currentEx === i ? "white" : allDone ? "#22c55e" : "var(--text-muted)",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              fontFamily: "Barlow, sans-serif", fontSize: 12, fontWeight: 600,
              whiteSpace: "nowrap", flexShrink: 0, transition: "all 0.2s",
            }}>
              {allDone ? "✓ " : anyDone ? "◑ " : ""}{ex.name}
            </button>
          );
        })}
      </div>

      {/* Current exercise panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {exData[currentEx] && (() => {
          const ex = exData[currentEx];
          const doneCount = ex.sets.filter(s => s.done).length;

          // PR anterior
          const bestPrev = sessions
            .flatMap(s => (s.exercises || [])
              .filter(e => e.name === ex.name)
              .map(e => {
                const w = e.sets?.length > 0 ? Math.max(...e.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(e.weight) || 0;
                const r = e.sets?.length > 0 ? Math.max(...e.sets.map(st => parseFloat(st.reps) || 0)) : parseFloat(e.reps) || 0;
                return calc1RM(w, r);
              })
            ).reduce((best, v) => Math.max(best, v), 0);

          return (
            <div style={{ maxWidth: 580, margin: "0 auto" }}>

              {/* Exercise header */}
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 }}>
                <ExerciseGif exName={ex.name} size={80} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 26, fontWeight: 800, marginBottom: 2,
                  }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>
                    {doneCount}/{ex.sets.length} series
                  </div>
                  {bestPrev > 0 && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)",
                      borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#fbbf24",
                    }}>
                      🏆 Mejor: {bestPrev}kg 1RM
                    </div>
                  )}
                </div>
              </div>

              {/* Sets table */}
              <div style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 14, overflow: "hidden", marginBottom: 10,
              }}>
                {/* Header row */}
                <div style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 1fr 56px",
                  gap: 8, padding: "9px 14px",
                  background: "var(--input-bg)", borderBottom: "1px solid var(--border)",
                }}>
                  {["#", `Peso (${unit})`, "Reps", "✓"].map(h => (
                    <div key={h} style={{
                      fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                      textAlign: "center", letterSpacing: 1, textTransform: "uppercase",
                    }}>{h}</div>
                  ))}
                </div>

                {/* Set rows */}
                {ex.sets.map((s, j) => (
                  <div key={s.id} style={{
                    display: "grid", gridTemplateColumns: "36px 1fr 1fr 56px",
                    gap: 8, padding: "9px 14px", alignItems: "center",
                    background: s.done ? "rgba(34,197,94,0.05)" : "transparent",
                    borderBottom: j < ex.sets.length - 1 ? "1px solid var(--border)" : "none",
                    transition: "background 0.25s",
                  }}>
                    <div style={{
                      textAlign: "center", fontWeight: 800, fontSize: 14,
                      fontFamily: "Barlow Condensed, sans-serif",
                      color: s.done ? "#22c55e" : "var(--text-muted)",
                    }}>
                      S{j + 1}
                    </div>
                    <input
                      value={s.weight}
                      onChange={e => updateSet(currentEx, j, "weight", numDot(e.target.value))}
                      placeholder="—"
                      style={{
                        background: "var(--input-bg)",
                        border: `1px solid ${s.done ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                        borderRadius: 8, padding: "8px", color: "var(--text)",
                        fontFamily: "Barlow, sans-serif", fontSize: 16, fontWeight: 700,
                        textAlign: "center", outline: "none", width: "100%",
                      }}
                    />
                    <input
                      value={s.reps}
                      onChange={e => updateSet(currentEx, j, "reps", numDot(e.target.value))}
                      placeholder="—"
                      style={{
                        background: "var(--input-bg)",
                        border: `1px solid ${s.done ? "rgba(34,197,94,0.4)" : "var(--border)"}`,
                        borderRadius: 8, padding: "8px", color: "var(--text)",
                        fontFamily: "Barlow, sans-serif", fontSize: 16, fontWeight: 700,
                        textAlign: "center", outline: "none", width: "100%",
                      }}
                    />
                    <button
                      onClick={() => toggleSet(currentEx, j)}
                      style={{
                        width: 50, height: 38, margin: "0 auto",
                        background: s.done ? "#22c55e" : "var(--input-bg)",
                        border: `2px solid ${s.done ? "#22c55e" : "var(--border)"}`,
                        borderRadius: 10, cursor: "pointer", fontSize: 18,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 0.2s", transform: s.done ? "scale(1.05)" : "scale(1)",
                      }}
                    >
                      {s.done ? "✓" : "○"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Add / remove series */}
              <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
                <button
                  onClick={() => addSet(currentEx)}
                  style={{
                    flex: 1, background: "none", border: "1px dashed var(--border)",
                    color: "var(--text-muted)", borderRadius: 10, padding: 9,
                    cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 13,
                  }}
                >
                  + Añadir serie
                </button>
                {ex.sets.length > 1 && (
                  <button
                    onClick={() => removeSet(currentEx)}
                    style={{
                      background: "none", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#ef4444", borderRadius: 10, padding: "9px 14px",
                      cursor: "pointer", fontSize: 13,
                    }}
                  >
                    − Quitar
                  </button>
                )}
              </div>

              {/* Inline rest timer shortcuts */}
              <div style={{
                background: "var(--card)", border: "1px solid var(--border)",
                borderRadius: 12, padding: "11px 14px", marginBottom: 18,
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 18 }}>⏱️</span>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
                    letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5,
                  }}>
                    Iniciar descanso
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {[[60, "Cardio"], [90, "Hiper ⭐"], [120, "Fuerza"], [180, "Pesado"]].map(([t, label]) => (
                      <button
                        key={t}
                        onClick={() => setFloatTimer(f => ({ ...f, visible: true, secs: t, elapsed: 0, running: true }))}
                        style={{
                          background: "var(--input-bg)", border: "1px solid var(--border)",
                          borderRadius: 8, padding: "5px 10px", cursor: "pointer",
                          color: "var(--text-muted)", fontSize: 11, fontWeight: 600,
                          transition: "all 0.15s",
                        }}
                      >
                        {t < 60 ? `${t}s` : `${t / 60}m`}{" "}
                        <span style={{ opacity: 0.6 }}>{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Previous / Next navigation */}
              <div style={{ display: "flex", gap: 10 }}>
                {currentEx > 0 && (
                  <button
                    onClick={() => setCurrentEx(i => i - 1)}
                    style={{
                      flex: 1, background: "var(--card)", border: "1px solid var(--border)",
                      color: "var(--text-muted)", borderRadius: 10, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow, sans-serif", fontSize: 13,
                    }}
                  >
                    ← Anterior
                  </button>
                )}
                {currentEx < exData.length - 1 ? (
                  <button
                    onClick={() => setCurrentEx(i => i + 1)}
                    style={{
                      flex: 2, background: "var(--accent)", border: "none",
                      color: "white", borderRadius: 10, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 17, fontWeight: 700,
                    }}
                  >
                    Siguiente →
                  </button>
                ) : (
                  <button
                    onClick={() => { setRunning(false); setShowSummary(true); }}
                    style={{
                      flex: 2, background: "linear-gradient(135deg, #22c55e, #16a34a)",
                      border: "none", color: "white", borderRadius: 10, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 17, fontWeight: 700,
                    }}
                  >
                    🏁 Ver resumen
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
// ─── GymApp ───────────────────────────────────────────────────────────────────
function GymApp() {
  const { dark, toggleDark } = useTheme();
  const { user, logout } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [unit, setUnit] = useState(() => load("gym_unit", "kg"));
  const [activeTab, setActiveTab] = useState("new");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Body stats
  const bodyKey = `gym_body_${user.email}`;
  const [bodyStats, setBodyStats] = useState(() => load(bodyKey, { height: null, entries: [] }));
  const [showBodyStats, setShowBodyStats] = useState(false);

  // Planner
  const plannerKey = `gym_planner_${user.email}`;
  const [weeklyPlan, setWeeklyPlan] = useState(() => load(plannerKey, { mode: "weekly", weekly: {}, cycle: [], cyclePos: 0 }));
  const [showPlanner, setShowPlanner] = useState(false);
  const goalKey = `gym_goal_${user.email}`;
  const [weeklyGoal, setWeeklyGoal] = useState(() => load(goalKey, { target: 4 }));

  // Load sessions from Firestore (or localStorage for guests)
  useEffect(() => {
    if (user.isGuest) {
      setSessions(load("gym_v3_guest", []));
      setSessionsLoading(false);
      return;
    }
    getDoc(doc(db, "sessions", user.uid)).then(snap => {
      setSessions(snap.exists() ? (snap.data().list || []) : []);
      setSessionsLoading(false);
    }).catch(() => setSessionsLoading(false));
  }, [user.uid]);

  const [date, setDate] = useState(todayStr());
  const [workout, setWorkout] = useState("");
  const [notes, setNotes] = useState("");
  const [currentExercises, setCurrentExercises] = useState([]);
  const [exName, setExName] = useState("");
  const [exMuscle, setExMuscle] = useState("Todos");
  const [exCustom, setExCustom] = useState("");
  const [exCustomMuscle, setExCustomMuscle] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSets, setExSets] = useState([]);
  const [exSeriesCount, setExSeriesCount] = useState("3");
  const [exNote, setExNote] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [expanded, setExpanded] = useState(null);
  const [filterWorkout, setFilterWorkout] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [progressEx, setProgressEx] = useState(null);
  const [showPlans, setShowPlans] = useState(false); // kept for guest only
  const [showTimer, setShowTimer] = useState(false);
  const [showOneRM, setShowOneRM] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showMuscleMap, setShowMuscleMap] = useState(false);
  const [showActiveWorkout, setShowActiveWorkout] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showWeeklyGoal, setShowWeeklyGoal] = useState(false);
  const [showTeams, setShowTeams] = useState(false);
  const [accentColor, setAccentColor] = useState(() => load("gym_accent", ACCENT_COLORS[0]));
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentColor.value);
    document.documentElement.style.setProperty("--accent-dim", accentColor.dim);
    store("gym_accent", accentColor);
  }, [accentColor]);
  const [showAccentPicker, setShowAccentPicker] = useState(false);
  const accentRef = useRef();
  const [prConfetti, setPrConfetti] = useState(null); // { prs: [...] }
  const [showProfile, setShowProfile] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
  const [showAthleteCoach, setShowAthleteCoach] = useState(false);
  const [sessionMode, setSessionMode] = useState(null); // null | "live" | "register"
  const [liveActive, setLiveActive] = useState(false);
  const [floatTimer, setFloatTimer] = useState({ visible: false, secs: 90, running: false, elapsed: 0 });
  const floatTimerRef = useRef();
  const [shareSession, setShareSession] = useState(null);
  const [toast, setToast] = useState(null);
  const presetRef = useRef();

  useEffect(() => {
    if (floatTimer.running && floatTimer.visible) {
      floatTimerRef.current = setInterval(() => {
        setFloatTimer(f => {
          if (f.elapsed + 1 >= f.secs) {
            clearInterval(floatTimerRef.current);
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              [0, 0.2, 0.4].forEach((t, i) => {
                const osc = ctx.createOscillator(), gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = i === 2 ? 880 : 660; osc.type = "sine";
                gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
                osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.18);
              });
            } catch(e) {}
            return { ...f, running: false, elapsed: f.secs };
          }
          return { ...f, elapsed: f.elapsed + 1 };
        });
      }, 1000);
    } else {
      clearInterval(floatTimerRef.current);
    }
    return () => clearInterval(floatTimerRef.current);
  }, [floatTimer.running, floatTimer.visible]);

  useEffect(() => {
    if (sessionsLoading) return;
    if (user.isGuest) { store("gym_v3_guest", sessions); return; }
    setDoc(doc(db, "sessions", user.uid), { list: sessions, updatedAt: serverTimestamp() });
  }, [sessions]);
  useEffect(() => { store("gym_unit", unit); }, [unit]);
  useEffect(() => {
  store(bodyKey, bodyStats);
  if (!user.isGuest) saveBodyStatsToDB(user.uid, bodyStats);
}, [bodyStats]);
  useEffect(() => { store(plannerKey, weeklyPlan); }, [weeklyPlan]);
  useEffect(() => { store(goalKey, weeklyGoal); }, [weeklyGoal]);
  useEffect(() => {
    const handle = (e) => { if (presetRef.current && !presetRef.current.contains(e.target)) setShowPresets(false); };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);
  useEffect(() => {
    const handle = (e) => { if (accentRef.current && !accentRef.current.contains(e.target)) setShowAccentPicker(false); };
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, []);

  const allExNames = [...new Set(sessions.flatMap(s => (s.exercises || []).map(e => e.name)))];
  const isGuest = user.isGuest;
  const canAdd = isGuest ? sessions.length < 3 : true;
  const canExport = !isGuest;
  const canCharts = !isGuest;

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2600); }

  // Today's planned workout
  const todayDow = (new Date().getDay() + 6) % 7;
  const todayPlanned = weeklyPlan.mode === "weekly"
    ? (typeof weeklyPlan.weekly?.[todayDow] === "string" ? weeklyPlan.weekly?.[todayDow] : weeklyPlan.weekly?.[todayDow]?.name) || ""
    : weeklyPlan.cycle?.[weeklyPlan.cyclePos]?.name || "";

  function handleExName(v) {
    const val = lettersOnly(v);
    setExName(val);
    if (val.length > 1) {
      const s = allExNames.filter(n => n.toLowerCase().startsWith(val.toLowerCase()));
      setSuggestions(s); setShowSugg(s.length > 0);
    } else setShowSugg(false);
  }

  function addSet() {
    if (!exReps) return;
    setExSets(prev => [...prev, { id: uid(), weight: exWeight, reps: exReps }]);
    setExWeight(""); setExReps("");
  }

  function addExercise() {
    const finalName = exName === "__custom__" ? exCustom : exName;
    if (!finalName) { showToast("⚠️ Selecciona un ejercicio"); return; }
    if (exName === "__custom__" && !exCustomMuscle) { showToast("⚠️ Selecciona el músculo del ejercicio"); return; }
    if (!exWeight) { showToast("⚠️ Ingresa el peso"); return; }
    if (!exReps) { showToast("⚠️ Ingresa las repeticiones"); return; }
    const count = Math.max(1, parseInt(exSeriesCount) || 3);
    const sets = Array.from({ length: count }, () => ({ id: uid(), weight: exWeight, reps: exReps }));
    if (exName === "__custom__" && exCustomMuscle && !EXERCISE_DB.find(e => e.name === finalName)) {
      EXERCISE_DB.push({ name: finalName, muscle: exCustomMuscle, machine: false, equipment: "Personalizado" });
    }
    setCurrentExercises(prev => [...prev, { id: uid(), name: finalName, sets, weight: exWeight, reps: exReps, note: exNote }]);
    setExName(""); setExCustom(""); setExCustomMuscle(""); setExWeight(""); setExReps(""); setExSets([]); setExSeriesCount("3"); setExNote(""); setShowSugg(false);
  }

  function applyPreset(name) {
    if (isGuest) { showToast("⚠️ Rutinas no disponibles en modo invitado"); return; }
    setWorkout(name);
    setCurrentExercises(PRESETS[name].map(n => ({ id: uid(), name: n, sets: [], weight: "", reps: "" })));
    setShowPresets(false);
    showToast(`Rutina "${name}" cargada`);
  }

  function saveSession() {
    if (!date || !workout) { showToast("⚠️ Faltan fecha o tipo de entrenamiento"); return; }
    if (currentExercises.length === 0) { showToast("⚠️ Agrega al menos un ejercicio"); return; }
    if (!canAdd && !editingId) { showToast("⚠️ Límite de 5 sesiones en plan Free"); setShowPlans(true); return; }
    if (editingId) {
      setSessions(prev => prev.map(s => s.id === editingId ? { ...s, date, workout, notes, exercises: currentExercises } : s));
      setEditingId(null); showToast("✅ Sesión actualizada");
    } else {
      const newSession = { id: uid(), date, workout, notes, exercises: currentExercises, unit };
      const newPRs = detectNewPRs(newSession, sessions);
      setSessions(prev => [newSession, ...prev]);
      if (newPRs.length > 0) {
        setPrConfetti({ prs: newPRs });
      } else {
        showToast("✅ Sesión guardada");
      }  // advance cycle
      if (weeklyPlan.mode === "cycle" && weeklyPlan.cycle?.length > 0) {
        const nextPos = (weeklyPlan.cyclePos + 1) % weeklyPlan.cycle.length;
        setWeeklyPlan(p => ({ ...p, cyclePos: nextPos }));
      }
    }
    setDate(todayStr()); setWorkout(""); setNotes(""); setCurrentExercises([]); setExSets([]);
    setSessionMode(null); setLiveActive(false);
    setActiveTab("history");
  }

  function startEdit(s) {
    setEditingId(s.id); setDate(s.date); setWorkout(s.workout); setNotes(s.notes || "");
    setCurrentExercises((s.exercises || []).map(e => ({ ...e })));
    setActiveTab("new"); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function duplicate(s) {
    setDate(todayStr()); setWorkout(s.workout); setNotes(s.notes || "");
    setCurrentExercises((s.exercises || []).map(e => ({ ...e, id: uid() })));
    setEditingId(null); setActiveTab("new");
    window.scrollTo({ top: 0, behavior: "smooth" }); showToast("📋 Sesión duplicada");
  }

  function deleteSession(id) { setSessions(prev => prev.filter(s => s.id !== id)); showToast("🗑️ Eliminada"); }

  function exportJSON() {
    if (!canExport) { showToast("⚠️ Exportar no disponible en modo invitado"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" }));
    a.download = `gym_${todayStr()}.json`; a.click(); showToast("📦 JSON exportado");
  }

  function exportCSV() {
    if (!canExport) { showToast("⚠️ Exportar no disponible en modo invitado"); return; }
    const rows = [["Fecha", "Entrenamiento", "Ejercicio", "Series", "Peso", "Reps", "Notas"]];
    sessions.forEach(s => (s.exercises?.length ? s.exercises : [{ name: "", sets: [], weight: "", reps: "" }]).forEach(ex =>
      rows.push([s.date, s.workout, ex.name, ex.sets?.length || 0, ex.weight || "", ex.reps || "", s.notes || ""])
    ));
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n")], { type: "text/csv" }));
    a.download = `gym_${todayStr()}.csv`; a.click(); showToast("📊 CSV exportado");
  }

  function getProgressData(name) {
    return sessions.flatMap(s => (s.exercises || []).filter(ex => ex.name.toLowerCase() === name.toLowerCase()).map(ex => ({ date: s.date, weight: parseFloat(ex.weight) || 0 }))).sort((a, b) => a.date.localeCompare(b.date));
  }

  const filtered = sessions.filter(s => !filterWorkout || s.workout.toLowerCase().includes(filterWorkout.toLowerCase()));

  const NAV = [
    { id: "new", icon: "➕", label: "Nueva sesión" },
    { id: "history", icon: "📋", label: "Historial" },
    { id: "dashboard", icon: "📊", label: "Dashboard" },
  ];
  
  // Earned badges count for notification dot
  const prsForBadge = getPRs(sessions);
  const earnedBadges = BADGE_DEFS.filter(b => b.check(sessions, prsForBadge)).length;

  const navClick = (id) => { setActiveTab(id); setMobileNavOpen(false); };

  return (
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <span style={{ fontSize: 20, flexShrink: 0 }}>⚡</span>
            <span className="logo-text">GymTracker</span>
          </div>
        </div>

        {/* Today's plan banner */}
        {todayPlanned && (
          <div style={{ margin: "0 12px 12px", padding: "10px 12px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 3 }}>Hoy toca</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{todayPlanned}</div>
          </div>
        )}

        <nav className="sidebar-nav">
  {NAV.map(item => (
    <button key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} onClick={() => navClick(item.id)}>
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </button>
  ))}

  {[
    { label: "📅 Planificación", items: [
      { icon: "📅", label: "Planificador", action: () => setShowPlanner(true) },
      { icon: "🎯", label: "Meta semanal", action: () => setShowWeeklyGoal(true) },
      { icon: "📋", label: "Plantillas", action: () => setShowTemplates(true) },
    ]},
    { label: "👥 Social", items: [
      { icon: "👥", label: "GymTeams", action: () => setShowTeams(true) },
      { icon: "⚔️", label: "Reto semanal", action: () => setShowChallenge(true) },
    ]},
    { label: "⚙️ Personal", items: [
      { icon: "⚖️", label: "Peso & Estatura", action: () => setShowBodyStats(true) },
      { icon: "🎽", label: "Mi Coach", action: () => setShowAthleteCoach(true) },
      ...(user.isCoach ? [{ icon: "🏅", label: "Panel Coach", action: () => setShowCoach(true) }] : []),
    ]},
  ].map(group => <SidebarGroup key={group.label} label={group.label} items={group.items} />)}
</nav>
        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar" style={{cursor:"pointer", overflow:"hidden", padding:0}} onClick={() => setShowProfile(true)}>
  {user.photoURL
    ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}} referrerPolicy="no-referrer" />
    : user.name?.[0]?.toUpperCase() || "U"}
</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">{user.name}</div>
              {isGuest ? <button className="plan-badge" style={{ "--pc": "#f59e0b" }} onClick={logout}>Invitado · Salir</button> : <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700 }}>✓ Cuenta activa</span>}
            </div>
          </div>
          <button className="nav-item" onClick={logout}>
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Salir</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Topbar */}
        <div className="topbar">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Hamburger mobile */}
            <button className="hamburger mobile-only" onClick={() => setMobileNavOpen(v => !v)}>
              <span /><span /><span />
            </button>
            <h1 className="page-title">
              {activeTab === "new"
            ? (editingId ? "✏️ Editar sesión" : `👋 Hola, ${user.name.split(" ")[0]}!`)
            : activeTab === "history" ? "📋 Historial"
            : "📊 Dashboard"}
            </h1>
          </div>
          <div className="topbar-actions">
            <button className="topbar-btn" onClick={toggleDark}>
              <span className="topbar-btn-icon">{dark ? "☀️" : "🌙"}</span>
              <span className="topbar-btn-label">{dark ? "Claro" : "Oscuro"}</span>
            </button>
            <button className="topbar-btn" onClick={() => setUnit(u => u === "kg" ? "lbs" : "kg")}>
              <span className="topbar-btn-icon">⚖️</span>
              <span className="topbar-btn-label">{unit}</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileNavOpen && (
          <div className="mobile-drawer-overlay" onClick={() => setMobileNavOpen(false)}>
            <div className="mobile-drawer" onClick={e => e.stopPropagation()}>
              <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 20 }}>⚡</span>
                  <span className="logo-text">GymTracker</span>
                </div>
                <button className="close-btn" onClick={() => setMobileNavOpen(false)}>✕</button>
              </div>

              {todayPlanned && (
                <div style={{ margin: "12px 12px 0", padding: "10px 12px", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 3 }}>Hoy toca</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>{todayPlanned}</div>
                </div>
              )}

              <nav style={{ padding: "12px 8px", flex: 1 }}>
                {NAV.map(item => (
                  <button key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`} style={{ marginBottom: 2 }} onClick={() => navClick(item.id)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                ))}
                <div style={{ height: 1, background: "var(--border)", margin: "8px 12px" }} />
                {[
                  { icon: "📅", label: "Planificador", action: () => { setShowPlanner(true); setMobileNavOpen(false); } },
                  { icon: "⚖️", label: "Peso & Estatura", action: () => { setShowBodyStats(true); setMobileNavOpen(false); } },
                  { icon: "🎯", label: "Meta semanal", action: () => { setShowWeeklyGoal(true); setMobileNavOpen(false); } },
                  { icon: "👥", label: "GymTeams", action: () => { setShowTeams(true); setMobileNavOpen(false); } },
                  { icon: "⚔️", label: "Reto semanal", action: () => { setShowChallenge(true); setMobileNavOpen(false); } },
                  ...(user.isCoach ? [{ icon: "🏅", label: "Panel Coach", action: () => { setShowCoach(true); setMobileNavOpen(false); } }] : []),
                  { icon: "🎽", label: "Mi Coach", action: () => { setShowAthleteCoach(true); setMobileNavOpen(false); } },
                ].map(({ icon, label, action }) => (
                  <button key={label} className="nav-item" style={{ marginBottom: 2 }} onClick={action}>
                    <span className="nav-icon">{icon}</span>
                    <span className="nav-label">{label}</span>
                  </button>
                ))}
              </nav>

              <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 4 }}>
                  <div className="user-avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
                  <div>
                    <div className="user-name">{user.name}</div>
                    {isGuest ? <button className="plan-badge" style={{ "--pc": "#f59e0b" }} onClick={logout}>Invitado · Salir</button> : <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700 }}>✓ Cuenta activa</span>}
                  </div>
                </div>
                <button className="nav-item" onClick={logout}>
                  <span className="nav-icon">🚪</span>
                  <span className="nav-label">Salir</span>
                </button>
              </div>
            </div>
          </div>
        )}       

       {/* Nueva sesión */}
        {activeTab === "new" && (
     <div className="content-area fade-in">

    {/* ── Modo LIVE activo: ocupa toda el área ── */}
    {liveActive && sessionMode === "live" ? (
      <LiveTrainMode
        exercises={currentExercises}
        workout={workout}
        date={date}
        notes={notes}
        unit={unit}
        sessions={sessions}
        floatTimer={floatTimer}
        setFloatTimer={setFloatTimer}
        calc1RM={calc1RM}
        ExerciseGif={ExerciseGif}
        uid={uid}
        numDot={numDot}
        onBack={() => setLiveActive(false)}
        onSaveSession={(finalExercises, elapsedSecs) => {
          if (!workout) { showToast("⚠️ Falta el nombre del entrenamiento"); return; }
          const newSession = {
            id: uid(), date, workout, notes,
            exercises: finalExercises, unit,
            durationSecs: elapsedSecs,
          };
          const newPRs = detectNewPRs(newSession, sessions);
          setSessions(prev => [newSession, ...prev]);
          if (newPRs.length > 0) setPrConfetti({ prs: newPRs });
          else showToast("✅ Sesión guardada");
          if (weeklyPlan.mode === "cycle" && weeklyPlan.cycle?.length > 0)
            setWeeklyPlan(p => ({ ...p, cyclePos: (p.cyclePos + 1) % p.cycle.length }));
          setDate(todayStr()); setWorkout(""); setNotes(""); setCurrentExercises([]);
          setLiveActive(false); setSessionMode(null);
          setActiveTab("history");
        }}
      />
    ) : (

    /* ── Pantalla normal (selector de modo o formularios) ── */
    <>

      {/* ╔══════════════════════════════════╗ */}
      {/* ║  sessionMode === null            ║ */}
      {/* ╚══════════════════════════════════╝ */}
      {sessionMode === null && (
        <div>

          {isGuest && (
            <div className="guest-banner">
              <span>👤 Modo invitado — máx. 3 sesiones.</span>
              <button className="link-btn" onClick={logout} style={{ color: "#f59e0b", marginLeft: 8 }}>
                Crear cuenta →
              </button>
            </div>
          )}

          {/* Rutina de hoy */}
          {(() => {
            const todayDow = (new Date().getDay() + 6) % 7;
            const plan = weeklyPlan.mode === "weekly"
              ? weeklyPlan.weekly?.[todayDow]
              : weeklyPlan.cycle?.[weeklyPlan.cyclePos];
            const name = typeof plan === "string" ? plan : plan?.name;
            const planEx = plan?.exercises || [];
            if (!name) return null;
            return (
              <div style={{
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 14, padding: "14px 18px", marginBottom: 16,
                display: "flex", justifyContent: "space-between", alignItems: "center",
                flexWrap: "wrap", gap: 10,
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--accent)", textTransform: "uppercase", marginBottom: 4 }}>📅 Hoy toca</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 800, color: "var(--accent)" }}>{name}</div>
                  {planEx.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{planEx.length} ejercicios planificados</div>}
                </div>
                <button className="btn-ghost small" onClick={() => {
                  setWorkout(name);
                  if (planEx.length > 0) setCurrentExercises(planEx.map(e => ({ ...e, id: uid() })));
                  showToast(`✅ "${name}" cargada`);
                }}>
                  💪 Cargar →
                </button>
              </div>
            );
          })()}
        

          {/* Meta semanal */}
          {weeklyGoal?.target > 0 && (() => {
            const tw = sessions.filter(s => (new Date() - new Date(s.date + "T00:00:00")) / 86400000 <= 7).length;
            const p  = Math.min(tw / weeklyGoal.target, 1);
            const ok = p >= 1;
            return (
              <div
                onClick={() => setShowWeeklyGoal(true)}
                style={{
                  cursor: "pointer",
                  background: ok ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.06)",
                  border: `1px solid ${ok ? "rgba(34,197,94,0.3)" : "rgba(59,130,246,0.2)"}`,
                  borderRadius: 12, padding: "10px 16px", marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>🎯 Meta semanal {ok ? "✅" : ""}</span>
                  <span style={{ color: "var(--text-muted)" }}>{tw}/{weeklyGoal.target} sesiones</span>
                </div>
                <div style={{ background: "var(--border)", borderRadius: 20, height: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: ok ? "#22c55e" : "var(--accent)", width: `${p * 100}%`, borderRadius: 20, transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })()}

          {/* ── LAS DOS TARJETAS PRINCIPALES ── */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 14 }}>
            ¿Qué querés hacer?
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>

            {/* ── Entrenar ahora ── */}
            <button
              onClick={() => setSessionMode("live")}
              style={{
                background: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.03))",
                border: "2px solid rgba(59,130,246,0.3)",
                borderRadius: 18, padding: "24px 16px", cursor: "pointer",
                textAlign: "center", transition: "all 0.2s", fontFamily: "Barlow, sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800, color: "var(--accent)", letterSpacing: 1, marginBottom: 8 }}>
                Entrenar ahora
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Modo en vivo: timer, marcá series al momento, alarma de descanso
              </div>
            </button>

            {/* ── Registrar sesión ── */}
            <button
              onClick={() => setSessionMode("register")}
              style={{
                background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(34,197,94,0.02))",
                border: "2px solid rgba(34,197,94,0.2)",
                borderRadius: 18, padding: "24px 16px", cursor: "pointer",
                textAlign: "center", transition: "all 0.2s", fontFamily: "Barlow, sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#22c55e"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(34,197,94,0.2)"; e.currentTarget.style.transform = "none"; }}
            >
              <div style={{ fontSize: 44, marginBottom: 10 }}>📋</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800, color: "#22c55e", letterSpacing: 1, marginBottom: 8 }}>
                Registrar sesión
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
                Ya entrenaste: completá los datos para guardar el historial
              </div>
            </button>

          </div>

          {/* Herramientas rápidas */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12 }}>
            Herramientas
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { icon: "🧮", label: "Calc. 1RM",    action: () => setShowOneRM(true) },
              { icon: "📚", label: "Biblioteca",    action: () => setShowLibrary(true) },
              { icon: "📋", label: "Plantillas",    action: () => setShowTemplates(true) },
              { icon: "📅", label: "Planificador",  action: () => setShowPlanner(true) },
            ].map(btn => (
              <button
                key={btn.label}
                className="btn-ghost"
                style={{ flex: "1 1 120px", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                onClick={btn.action}
              >
                <span>{btn.icon}</span> {btn.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ╔══════════════════════════════════╗ */}
      {/* ║  sessionMode === "live"          ║ */}
      {/* ║  (setup antes de lanzar)         ║ */}
      {/* ╚══════════════════════════════════╝ */}
      {sessionMode === "live" && !liveActive && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
            <button className="btn-ghost small" onClick={() => { setSessionMode(null); setCurrentExercises([]); setWorkout(""); }}>
              ← Volver
            </button>
            <div style={{ flex: 1, fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 800, color: "var(--accent)" }}>
              ⚡ Configurar entrenamiento
            </div>
          </div>

          {/* Fecha + nombre */}
          <div className="card">
            <div className="card-label">Info de la sesión</div>
            <div className="form-row">
              <div className="field">
                <label className="field-label">Fecha</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
              </div>
              <div className="field" style={{ flex: 2, position: "relative" }} ref={presetRef}>
                <label className="field-label">Entrenamiento</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input placeholder="Push Day, Piernas…" value={workout} onChange={e => setWorkout(lettersOnly(e.target.value))} className="input" />
                  <button className="btn-ghost" onClick={() => setShowPresets(v => !v)}>📋</button>
                </div>
                {showPresets && (
                  <div className="dropdown">
                    {Object.keys(PRESETS).map(r => <button key={r} className="dropdown-item" onClick={() => applyPreset(r)}>{r}</button>)}
                  </div>
                )}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Notas (opcional)</label>
              <textarea className="input textarea" placeholder="Objetivos del día…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Agregar ejercicios (mismo bloque que el modo register) */}
          <div className="card">
            <div className="card-label">Ejercicios</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {["Todos", ...MUSCLES].map(m => (
                <button key={m} className={`muscle-chip ${exMuscle === m ? "active" : ""}`}
                  onClick={() => { setExMuscle(m); setExName(""); }}>
                  {m}
                </button>
              ))}
            </div>
            <div className="form-row" style={{ alignItems: "flex-end" }}>
              <div className="field" style={{ flex: 2 }}>
                <label className="field-label">Ejercicio</label>
                <select className="input" value={exName} onChange={e => setExName(e.target.value)}>
                  <option value="">— Selecciona —</option>
                  {(exMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === exMuscle)).map(ex => (
                    <option key={ex.name} value={ex.name}>{ex.name}{ex.machine ? " 🔧" : ""}</option>
                  ))}
                  <option value="__custom__">✏️ Personalizado...</option>
                </select>
                {exName === "__custom__" && (
                  <>
                    <input className="input" style={{ marginTop: 6 }} placeholder="Nombre..." value={exCustom}
                      onChange={e => setExCustom(lettersOnly(e.target.value))} autoFocus />
                    <select className="input" style={{ marginTop: 6 }} value={exCustomMuscle} onChange={e => setExCustomMuscle(e.target.value)}>
                      <option value="">— Músculo —</option>
                      {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </>
                )}
              </div>
              <div className="field">
                <label className="field-label">Peso ({unit})</label>
                <input placeholder="0" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} className="input" />
              </div>
              <div className="field">
                <label className="field-label">Reps</label>
                <input placeholder="0" value={exReps} onChange={e => setExReps(numDot(e.target.value))} className="input" />
              </div>
              <div className="field" style={{ maxWidth: 80 }}>
                <label className="field-label">Series</label>
                <input placeholder="3" value={exSeriesCount} onChange={e => setExSeriesCount(e.target.value.replace(/[^0-9]/g, ""))} className="input" />
              </div>
            </div>
            {exName && exName !== "__custom__" && (
              <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0" }}>
                <ExerciseGif exName={exName} size={80} />
                {exWeight && exReps && (
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    1RM: <b style={{ color: "var(--accent)" }}>{calc1RM(exWeight, exReps)}kg</b>
                  </div>
                )}
              </div>
            )}
            <button className="btn-add-ex" onClick={addExercise}>+ Agregar ejercicio</button>

            {currentExercises.length > 0 && (
              <div className="ex-list" style={{ marginTop: 10 }}>
                {currentExercises.map((ex, idx) => (
                  <div key={ex.id} style={{
                    background: "var(--input-bg)", border: "1px solid var(--border)",
                    borderRadius: 10, marginBottom: 8, padding: "10px 14px",
                    display: "flex", alignItems: "center", gap: 12,
                  }}>
                    <ExerciseGif exName={ex.name} size={44} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                        {ex.sets?.length > 1 ? `${ex.sets.length} series` : `${ex.weight || "—"}kg × ${ex.reps || "—"}`}
                      </div>
                    </div>
                    <button className="chip-del" style={{ fontSize: 16 }}
                      onClick={() => setCurrentExercises(p => p.filter(e => e.id !== ex.id))}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón INICIAR */}
          {currentExercises.length > 0 ? (
            <button
              onClick={() => {
                if (!workout) { showToast("⚠️ Ponle nombre al entrenamiento"); return; }
                setLiveActive(true);
              }}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, var(--accent), #7c3aed)",
                border: "none", color: "white", borderRadius: 14, padding: "18px",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 900,
                letterSpacing: 2, cursor: "pointer",
                boxShadow: "0 8px 32px rgba(59,130,246,0.3)",
              }}
            >
              ⚡ INICIAR ENTRENAMIENTO
            </button>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
              Agregá al menos un ejercicio para comenzar
            </div>
          )}
        </div>
      )}

      {/* ╔══════════════════════════════════╗ */}
      {/* ║  sessionMode === "register"      ║ */}
      {/* ║  (formulario existente)          ║ */}
      {/* ╚══════════════════════════════════╝ */}
      {sessionMode === "register" && (
        <div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20 }}>
            <button className="btn-ghost small" onClick={() => {
              setSessionMode(null); setCurrentExercises([]); setWorkout(""); setEditingId(null);
            }}>
              ← Volver
            </button>
            {editingId && <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>✏️ Editando sesión</span>}
            <div style={{ flex: 1, fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 800, color: "#22c55e" }}>
              📋 Registrar sesión
            </div>
          </div>

          {!canAdd && !editingId && isGuest && (
            <div className="upgrade-banner">
              ⚠️ Límite de 3 sesiones.{" "}
              <button className="link-btn" onClick={logout}>Crear cuenta →</button>
            </div>
          )}

          {/* ── MISMO FORMULARIO QUE ANTES — no cambió nada ── */}
          {/* Fecha, nombre, notas, agregar ejercicios, guardar */}
          {/* Podés dejar exactamente el mismo JSX del bloque "register" que ya tenías */}
          {/* Lo único que cambia es que al guardar (saveSession) también se llama: */}
          {/*   setSessionMode(null)  ← agregar esta línea al final de saveSession */}

          <div className="card">
            <div className="card-label">Info de la sesión</div>
            <div className="form-row">
              <div className="field">
                <label className="field-label">Fecha</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
              </div>
              <div className="field" style={{ flex: 2, position: "relative" }} ref={presetRef}>
                <label className="field-label">Entrenamiento</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input placeholder="Push Day, Piernas…" value={workout} onChange={e => setWorkout(lettersOnly(e.target.value))} className="input" />
                  <button className="btn-ghost" onClick={() => setShowPresets(v => !v)}>📋</button>
                </div>
                {showPresets && (
                  <div className="dropdown">
                    {Object.keys(PRESETS).map(r => <button key={r} className="dropdown-item" onClick={() => applyPreset(r)}>{r}</button>)}
                  </div>
                )}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Notas</label>
              <textarea className="input textarea" placeholder="Cómo te sentiste, PR, observaciones…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* [AQUÍ VA EL RESTO DEL FORMULARIO DE EJERCICIOS — mismo que antes] */}
          {/* Copiá el bloque de agregar ejercicios / lista / guardar del código original */}
          {/* y pegalo acá directamente sin cambios */}

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={() => {
              saveSession(); // tu función existente
              setSessionMode(null); // ← agregar esto
            }}>
              💾 {editingId ? "Actualizar sesión" : "Guardar sesión"}
            </button>
            {editingId && (
              <button className="btn-ghost" onClick={() => {
                setEditingId(null); setDate(todayStr()); setWorkout(""); setNotes("");
                setCurrentExercises([]); setSessionMode(null);
              }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

    </>
    )}
  </div>
)}
        {/* Historial */}
        {activeTab === "history" && (
          <div className="content-area fade-in">
            <input className="input" style={{ marginBottom: 20 }} placeholder="Filtrar por tipo de entrenamiento o día" value={filterWorkout} onChange={e => setFilterWorkout(e.target.value)} />
            {filtered.length === 0
              ? <div className="empty-state"><div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div><p className="text-muted">Sin sesiones aún. ¡A entrenar!</p></div>
              : filtered.map(s => (
                <SessionCard key={s.id} s={s} unit={unit}
                  onDelete={deleteSession} onEdit={startEdit} onDuplicate={duplicate}
                  onShare={setShareSession}
                  onProgress={canCharts ? setProgressEx : () => { showToast("⚠️ Disponible solo con cuenta registrada"); }}
                  getProgressData={getProgressData}
                  expanded={expanded === s.id} onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                  allSessions={sessions}
                  onUpdate={updated => setSessions(prev => prev.map(x => x.id === updated.id ? updated : x))}
                />
              ))
            }
          </div>
        )}

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="content-area fade-in"><div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
  <button className="btn-ghost" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setShowBadges(true)}>
    <span>🏅</span> Logros ({earnedBadges})
  </button>
  <button className="btn-ghost" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setShowMuscleMap(true)}>
    <span>💪</span> Mapa muscular
  </button>
</div>
<Dashboard sessions={sessions} bodyStats={bodyStats} weeklyGoal={weeklyGoal} onGoalClick={() => setShowWeeklyGoal(true)} onBadgesClick={() => setShowBadges(true)} /></div>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="mobile-bottom-nav mobile-only">
        {NAV.map(item => (
          <button key={item.id} className={`mobile-nav-btn ${activeTab === item.id ? "active" : ""}`} onClick={() => navClick(item.id)}>
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600 }}>{item.label}</span>
          </button>
        ))}
        <button className="mobile-nav-btn" onClick={() => setMobileNavOpen(true)}>
          <span style={{ fontSize: 20 }}>☰</span>
          <span style={{ fontSize: 10, fontWeight: 600 }}>Más</span>
        </button>
      </nav>

      {showActiveWorkout && currentExercises.length > 0 && (
        <ActiveWorkoutModal
          exercises={currentExercises}
          unit={unit}
          onClose={() => setShowActiveWorkout(false)}
          onSave={(exData) => {
            setCurrentExercises(exData.map(ex => ({ ...ex, sets: ex.sets.filter(s => s.done || s.weight || s.reps) })));
            setShowActiveWorkout(false);
            showToast("✅ Datos actualizados");
          }}
        />
      )}
      {showBadges && <BadgesModal sessions={sessions} onClose={() => setShowBadges(false)} />}
      {showTemplates && <TemplatesModal sessions={sessions} onLoad={(workout, exercises) => { setWorkout(workout); setCurrentExercises(exercises.map(e => ({...e, id: uid()}))); setActiveTab("new"); }} onClose={() => setShowTemplates(false)} />}
      {showWeeklyGoal && <WeeklyGoalModal goal={weeklyGoal} onSave={setWeeklyGoal} onClose={() => setShowWeeklyGoal(false)} sessions={sessions} />}
      {showProfile && <UserProfileModal user={user} sessions={sessions} bodyStats={bodyStats} onOpenBodyStats={()=>{setShowProfile(false);setShowBodyStats(true);}} onClose={()=>setShowProfile(false)} />}
      {showTeams && <TeamsModal user={user} sessions={sessions} onClose={() => setShowTeams(false)} />}
      {showChallenge && <TeamChallengeModal user={user} sessions={sessions} onClose={() => setShowChallenge(false)} />}
      {showCoach && <CoachModal user={user} sessions={sessions} onClose={() => setShowCoach(false)} />}
      {showAthleteCoach && <AthleteCoachPanel user={user} onClose={() => setShowAthleteCoach(false)} />}
      {shareSession && <ShareCardModal session={shareSession} user={user} unit={unit} onClose={() => setShareSession(null)} />}
      {showMuscleMap && <MuscleMapModal sessions={sessions} onClose={() => setShowMuscleMap(false)} />}
      {progressEx && <ProgressModal exName={progressEx} sessions={sessions} onClose={() => setProgressEx(null)} />}
      {/* PlansModal removed - all features free for registered users */}
      {showLibrary && <ExerciseLibrary onSelect={name => { setExName(name); setExCustom(""); }} onClose={() => setShowLibrary(false)} />}
      {showTimer && <RestTimer onClose={() => setShowTimer(false)} />}
      {showOneRM && <OneRMModal onClose={() => setShowOneRM(false)} />}
      {showBodyStats && <BodyStatsModal stats={bodyStats} onSave={setBodyStats} onClose={() => setShowBodyStats(false)} />}
      {showPlanner && <WeeklyPlannerModal plan={weeklyPlan} onSave={setWeeklyPlan} onClose={() => setShowPlanner(false)} sessions={sessions} />}
      {prConfetti && <PRConfetti prs={prConfetti.prs} onDone={() => { setPrConfetti(null); showToast("✅ Sesión guardada"); }} />}
      {floatTimer.visible && (
        <RestTimerFloating timer={floatTimer} setTimer={setFloatTimer} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
    );
}
// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => load("gym_dark", true));
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("gym_dark");
    if (saved === null) setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  useEffect(() => { document.body.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { store("gym_dark", dark); }, [dark]);

  // Handle Google redirect result
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        const firebaseUser = result.user;
        let profile = null;
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          profile = snap.exists() ? snap.data() : null;
        } catch {}
        if (!profile) {
          profile = { uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free" };
          try { await setDoc(doc(db, "users", firebaseUser.uid), profile, { merge: true }); } catch {}
        }
        setCurrentUser({ uid: firebaseUser.uid, name: profile?.name || firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free", isCoach: profile?.isCoach || false, photoURL: firebaseUser.photoURL || profile?.photoURL || null });
        setAuthLoading(false);
      }
    }).catch(() => {});
  }, []);

  // Firebase auth listener
  
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let profile = null;
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          profile = snap.exists() ? snap.data() : null;
        } catch {}
        if (!profile) {
          profile = { uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free" };
          try { await setDoc(doc(db, "users", firebaseUser.uid), profile, { merge: true }); } catch {}
        }
        setCurrentUser({ uid: firebaseUser.uid, name: profile.name || firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free", isCoach: profile.isCoach || false, photoURL: firebaseUser.photoURL || profile.photoURL || null });
      } else {
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return unsub;
  }, []);
  const toggleDark = () => setDark(d => !d);

  async function loginWithFirebase(email, pass) {
    try { await signInWithEmailAndPassword(auth, email, pass); return { ok: true }; }
    catch (e) { return { ok: false, msg: firebaseErrMsg(e.code) }; }
  }

  async function registerWithFirebase(name, email, pass) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user);
      await setDoc(doc(db, "users", cred.user.uid), { uid: cred.user.uid, name, email, plan: "free" }, { merge: true });
      return { ok: true };
    } catch (e) { return { ok: false, msg: firebaseErrMsg(e.code) }; }
  }

  async function resetPassword(email) {
    try { await sendPasswordResetEmail(auth, email); return { ok: true }; }
    catch (e) { return { ok: false, msg: firebaseErrMsg(e.code) }; }
  }

  async function loginWithGoogle() {
    try {
      googleProvider.setCustomParameters({ prompt: "select_account" });
      const cred = await signInWithPopup(auth, googleProvider);
      const firebaseUser = cred.user;
      let profile = null;
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        profile = snap.exists() ? snap.data() : null;
      } catch {}
      if (!profile) {
        profile = { uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free" };
        try { await setDoc(doc(db, "users", firebaseUser.uid), profile, { merge: true }); } catch {}
      }
      setCurrentUser({ uid: firebaseUser.uid, name: profile?.name || firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free", isCoach: profile?.isCoach || false, photoURL: firebaseUser.photoURL || profile?.photoURL || null });
      return { ok: true };
    } catch(e) { 
      console.error("Google login error:", e);
      return { ok: false, msg: firebaseErrMsg(e.code) }; 
    }
  }

  function loginAsGuest() {
    setCurrentUser({ uid: "guest", name: "Invitado", email: "__guest__", plan: "guest", isGuest: true });
    setAuthLoading(false);
  }

  async function logout() {
    if (currentUser?.isGuest) { setCurrentUser(null); return; }
    await signOut(auth);
    setCurrentUser(null);
  }

  if (authLoading) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#080f1a", flexDirection:"column", gap:16 }}>
        <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:32, fontWeight:800, color:"#3b82f6", letterSpacing:2 }}>⚡ GymTracker</div>
        <div style={{ color:"#4a6080", fontSize:14 }}>Iniciando...</div>
      </div>
    );
  }

  return (
    <ThemeCtx.Provider value={{ dark, toggleDark }}>
      <AuthCtx.Provider value={{ user: currentUser, loginWithFirebase, registerWithFirebase, logout, loginAsGuest, resetPassword, loginWithGoogle }}>
        <style>{CSS}</style>
        {!currentUser ? <LoginScreen /> : <GymApp />}
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Barlow:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body[data-theme="dark"] {
  --bg: #080f1a; --surface: #0c1524; --card: #0f1c2e; --border: #1a2d45;
  --accent: #3b82f6;
--accent-dim: #1a2f52; --accent-dim: #1a2f52; --text: #e2e8f0; --text-muted: #4a6080;
  --danger: #ef4444; --sidebar-bg: #060d18; --input-bg: #070e1a; --shadow: 0 4px 24px rgba(0,0,0,0.5);
}
body[data-theme="light"] {
  --bg: #f0f4f8; --surface: #ffffff; --card: #ffffff; --border: #d1dce8;
  --accent: #2563eb; --accent-dim: #dbeafe; --text: #0f172a; --text-muted: #64748b;
  --danger: #dc2626; --sidebar-bg: #0f172a; --input-bg: #f8fafc; --shadow: 0 4px 24px rgba(0,0,0,0.08);
}

body { font-family: 'Barlow', sans-serif; background: var(--bg); color: var(--text); transition: background 0.3s, color 0.3s; }

/* ── Layout ── */
.app-layout { display: flex; min-height: 100vh; }
.main-content { flex: 1; display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); min-width: 0; margin-left: 240px; }

/* ── Sidebar (desktop only) ── */
.sidebar {
  position: fixed; top: 0; left: 0; height: 100vh; width: 240px;
  background: var(--sidebar-bg); border-right: 1px solid #0f2040;
  display: flex; flex-direction: column; padding: 20px 0; z-index: 100; overflow-y: auto; overflow-x: hidden;
}
.sidebar-top { display: flex; align-items: center; justify-content: space-between; padding: 0 14px 20px; border-bottom: 1px solid #0f2040; margin-bottom: 12px; }
.sidebar-logo { display: flex; align-items: center; gap: 10px; }
.logo-text { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 22px; letter-spacing: 2px; color: #e2e8f0; }
.sidebar-nav { flex: 1; padding: 0 8px; display: flex; flex-direction: column; gap: 3px; }
.sidebar-bottom { padding: 12px 8px 0; border-top: 1px solid #0f2040; margin-top: auto; }
.user-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 4px; }
.user-avatar { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 13px; color: white; flex-shrink: 0; }
.user-name { font-size: 13px; font-weight: 600; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; }

/* ── Nav items ── */
.nav-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 10px; background: none; border: none; color: #4a6080; font-family: 'Barlow', sans-serif; font-size: 14px; font-weight: 500; cursor: pointer; text-align: left; width: 100%; transition: background 0.15s, color 0.15s; white-space: nowrap; }
.nav-item:hover { background: #0f2040; color: #94a3b8; }
.nav-item.active { background: #1a2f52; color: #3b82f6; }
.nav-icon { font-size: 16px; flex-shrink: 0; }
.plan-badge { background: none; border: 1px solid var(--pc, #3b82f6); color: var(--pc, #3b82f6); border-radius: 5px; padding: 1px 7px; font-size: 10px; font-weight: 700; cursor: pointer; font-family: 'Barlow', sans-serif; transition: background 0.2s; }
.plan-badge:hover { background: var(--pc, #3b82f6); color: white; }

/* ── Topbar ── */
.topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 24px; border-bottom: 1px solid var(--border); background: var(--surface); position: sticky; top: 0; z-index: 10; }
.page-title { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 1px; }
.topbar-actions { display: flex; gap: 6px; align-items: center; }
.topbar-btn { display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--card); border: 1px solid var(--border); color: var(--text-muted); border-radius: 10px; padding: 6px 10px; cursor: pointer; min-width: 46px; transition: all 0.2s; }
.topbar-btn:hover { border-color: var(--accent); color: var(--accent); }
.topbar-btn-icon { font-size: 14px; line-height: 1; }
.topbar-btn-label { font-size: 9px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; }

/* ── Hamburger ── */
.hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 4px; padding: 4px; }
.hamburger span { display: block; width: 20px; height: 2px; background: var(--text); border-radius: 2px; }

/* ── Mobile drawer ── */
.mobile-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; backdrop-filter: blur(4px); }
.mobile-drawer { position: absolute; top: 0; left: 0; width: 280px; height: 100vh; background: var(--sidebar-bg); display: flex; flex-direction: column; overflow-y: auto; animation: slideRight 0.25s ease; }
@keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }

/* ── Mobile bottom nav ── */
.mobile-bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0; height: 60px; z-index: 100;
  background: var(--surface); border-top: 1px solid var(--border);
  display: flex; align-items: stretch;
}
.mobile-nav-btn { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: none; border: none; color: var(--text-muted); cursor: pointer; font-family: 'Barlow', sans-serif; transition: color 0.15s; padding: 0; }
.mobile-nav-btn.active { color: var(--accent); }
.mobile-nav-btn:hover { color: var(--text); }

/* ── Responsive ── */
.desktop-only { display: flex !important; }
.mobile-only { display: none !important; }
@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only { display: flex !important; }
  .main-content { margin-left: 0 !important; padding-bottom: 60px; }
  .sidebar { display: none !important; }
  .content-area { padding: 16px; }
  .topbar { padding: 12px 16px; }
  .form-row { flex-direction: column; }
  .topbar-actions .topbar-btn { min-width: 38px; padding: 5px 8px; }
}

/* ── Content ── */
.content-area { padding: 24px 28px; max-width: 900px; width: 100%; margin: 0 auto; flex: 1; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 22px; margin-bottom: 18px; box-shadow: var(--shadow); transition: border-color 0.2s, background 0.3s; }
.card-label { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); margin-bottom: 18px; }
.form-row { display: flex; gap: 12px; margin-bottom: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.field-label { font-size: 10px; font-weight: 600; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; }
.input { background: var(--input-bg); border: 1px solid var(--border); border-radius: 10px; padding: 10px 14px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; width: 100%; transition: border-color 0.2s, box-shadow 0.2s, background 0.3s; }
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }
input[type="date"].input { color-scheme: dark; }
.textarea { resize: vertical; min-height: 70px; }

/* ── Dropdowns ── */
.dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; z-index: 200; overflow: hidden; box-shadow: var(--shadow); }
.dropdown-item { display: block; width: 100%; background: none; border: none; color: var(--text); padding: 10px 16px; text-align: left; font-family: 'Barlow', sans-serif; font-size: 14px; cursor: pointer; transition: background 0.15s; }
.dropdown-item:hover { background: var(--accent-dim); }

/* ── Sets & exercises ── */
.sets-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.set-chip { background: var(--accent-dim); border: 1px solid var(--accent); color: var(--text); border-radius: 7px; padding: 4px 10px; font-size: 12px; display: flex; align-items: center; gap: 6px; }
.sets-badge { display: inline-block; background: var(--accent-dim); border: 1px solid var(--accent); color: var(--accent); border-radius: 5px; padding: 1px 7px; font-size: 10px; font-weight: 700; margin-left: 8px; vertical-align: middle; }
.chip-del { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 0 2px; transition: color 0.2s; }
.chip-del:hover { color: var(--danger); }
.ex-list { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.ex-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--input-bg); border-radius: 10px; border: 1px solid var(--border); animation: slideIn 0.2s ease; }
.ex-name { font-weight: 600; font-size: 14px; }
.ex-detail { color: var(--text-muted); font-size: 12px; }

/* ── Buttons ── */
.btn-primary { background: var(--accent); border: none; border-radius: 12px; padding: 13px 24px; color: white; font-family: 'Barlow Condensed', sans-serif; font-size: 18px; font-weight: 700; letter-spacing: 1px; cursor: pointer; transition: opacity 0.2s, transform 0.1s; }
.btn-primary:hover { opacity: 0.88; }
.btn-primary:active { transform: scale(0.98); }
.btn-ghost { background: var(--card); border: 1px solid var(--border); color: var(--text-muted); border-radius: 10px; padding: 9px 16px; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
.btn-ghost:hover { border-color: var(--accent); color: var(--text); }
.btn-ghost.danger:hover { border-color: var(--danger); color: var(--danger); }
.btn-ghost.small { padding: 6px 12px; font-size: 12px; }
.btn-add-ex { width: 100%; background: none; border: 1px dashed var(--border); color: var(--text-muted); border-radius: 10px; padding: 9px; margin-top: 12px; font-family: 'Barlow', sans-serif; font-size: 13px; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
.btn-add-ex:hover { border-color: var(--accent); color: var(--text); }
.link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-family: 'Barlow', sans-serif; font-size: inherit; }
.link-btn:hover { text-decoration: underline; }
.icon-action { background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px; opacity: 0.6; transition: opacity 0.2s; }
.icon-action:hover { opacity: 1; }

/* ── Session cards ── */
.session-card { animation: slideIn 0.25s ease both; }
.session-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; flex-wrap: wrap; gap: 8px; }
.session-date { font-size: 12px; color: var(--text-muted); font-weight: 500; }
.session-workout { font-weight: 700; font-size: 15px; font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.5px; }
.ex-count { font-size: 11px; color: var(--text-muted); background: var(--input-bg); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; }
.chevron { color: var(--text-muted); font-size: 10px; }
.session-body { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; animation: fadeIn 0.2s ease; }
.session-notes { color: var(--text-muted); font-size: 13px; margin-bottom: 12px; font-style: italic; }
.ex-row-saved { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); gap: 10px; flex-wrap: wrap; }
.session-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }

/* ── Dashboard ── */
.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: 1px; margin-bottom: 20px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px 16px; display: flex; flex-direction: column; gap: 6px; animation: slideIn 0.3s ease both; transition: border-color 0.2s, transform 0.2s; }
.stat-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.stat-value { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 800; }

/* ── Login ── */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); }
.login-box { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 40px 36px; width: 100%; max-width: 420px; box-shadow: var(--shadow); animation: fadeIn 0.4s ease; }
.login-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.tab-row { display: flex; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 22px; }
.tab-btn { flex: 1; background: none; border: none; color: var(--text-muted); padding: 10px; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; transition: background 0.2s, color 0.2s; }
.tab-btn.active { background: var(--accent); color: white; }
.err-msg { background: rgba(239,68,68,0.1); border: 1px solid #ef4444; color: #f87171; border-radius: 8px; padding: 9px 12px; font-size: 13px; margin-bottom: 10px; }

/* ── Plans ── */
.plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-top: 8px; }
.plan-card { border: 1px solid var(--border); border-radius: 14px; padding: 20px 16px; display: flex; flex-direction: column; gap: 8px; }
.plan-card.plan-active { border-color: var(--pc); background: color-mix(in srgb, var(--pc) 8%, var(--card)); }
.plan-name { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 800; }
.plan-price { font-size: 16px; font-weight: 700; }
.plan-features { list-style: none; display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--text-muted); flex: 1; margin: 4px 0; }
.plan-btn { border-radius: 8px; padding: 8px; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity 0.2s; margin-top: auto; }
.plan-btn:hover { opacity: 0.8; }

/* ── Library ── */
.lib-filters { display: flex; gap: 8px; margin-bottom: 12px; }
.muscle-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.muscle-chip { background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: 20px; padding: 4px 12px; font-family: 'Barlow', sans-serif; font-size: 12px; font-weight: 500; cursor: pointer; transition: all 0.15s; }
.muscle-chip:hover { border-color: var(--accent); color: var(--text); }
.muscle-chip.active { background: var(--accent); border-color: var(--accent); color: white; }
.lib-list { overflow-y: auto; flex: 1; padding-right: 4px; }
.lib-list::-webkit-scrollbar { width: 4px; }
.lib-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
.lib-group { margin-bottom: 16px; }
.lib-group-title { font-size: 10px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; padding: 0 4px; }
.lib-item { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border); padding: 10px 6px; cursor: pointer; text-align: left; border-radius: 8px; margin-bottom: 2px; transition: background 0.15s; }
.lib-item:hover { background: var(--accent-dim); }
.lib-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.lib-name { color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; font-weight: 500; }
.lib-meta { color: var(--text-muted); font-size: 11px; }
.lib-add { color: var(--accent); font-size: 20px; font-weight: 300; flex-shrink: 0; opacity: 0.6; transition: opacity 0.2s; }
.lib-item:hover .lib-add { opacity: 1; }

/* ── Modals ── */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; animation: fadeIn 0.2s ease; backdrop-filter: blur(4px); }
.modal { background: var(--card); border: 1px solid var(--border); border-radius: 20px; padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: var(--shadow); animation: slideUp 0.25s ease; }
.modal-wide { max-width: 680px; }
.modal-library { max-width: 520px; max-height: 85vh; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
.close-btn { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 4px; transition: color 0.2s; flex-shrink: 0; }
.close-btn:hover { color: var(--text); }

/* ── Misc ── */
.text-muted { color: var(--text-muted); }
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
.upgrade-banner { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 12px; padding: 12px 18px; font-size: 13px; margin-bottom: 16px; }
.toast { position: fixed; bottom: 76px; left: 50%; transform: translateX(-50%); background: var(--card); border: 1px solid var(--border); color: var(--text); padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 500; z-index: 9999; white-space: nowrap; box-shadow: var(--shadow); animation: toastIn 0.3s ease; }
@media (min-width: 769px) { .toast { bottom: 28px; } }

@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.fade-in { animation: fadeIn 0.3s ease; }
;select.input { cursor: pointer; }
select.input option { background: var(--surface); color: var(--text); }
.btn-guest { width: 100%; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: border-color 0.2s, background 0.2s; font-family: 'Barlow', sans-serif; }
.btn-guest:hover { border-color: #f59e0b; background: rgba(245,158,11,0.06); }
.guest-banner { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; border-radius: 12px; padding: 10px 16px; font-size: 13px; margin-bottom: 16px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; }
@keyframes prBannerIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.6); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
`;