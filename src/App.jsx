import { useState, useEffect, useRef, createContext, useContext } from "react";
import { initializeApp, getApps } from "firebase/app";
import GIF_MAP from './assets/gif/gifMap.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithCredential } from "firebase/auth";
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { getFirestore, initializeFirestore, persistentLocalCache, doc, getDoc, setDoc, serverTimestamp, collection, getDocs, deleteDoc, query, where, updateDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const firebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(firebaseApp);
const db = initializeFirestore(firebaseApp, { localCache: persistentLocalCache() });
const storage = getStorage(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const ThemeCtx = createContext();
const useTheme = () => useContext(ThemeCtx);
const AuthCtx = createContext();
const useAuth = () => useContext(AuthCtx);
const CustomGifCtx = createContext({ gifs: {}, setGif: () => {} });
const useCustomGifs = () => useContext(CustomGifCtx);

const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const fmtDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const todayStr = () => new Date().toISOString().slice(0, 10);
const lettersOnly = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");
const numDot = (v) => v.replace(/[^0-9.]/g, "");
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const DAYS_ES = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const LIVE_DRAFT_KEY = "gym_live_draft";

const ACCENT_COLORS = [
  { name: "Azul",    value: "#3b82f6", dim: "#1a2f52" },
  { name: "Verde",   value: "#22c55e", dim: "#14532d" },
  { name: "Morado",  value: "#8b5cf6", dim: "#2e1065" },
  { name: "Rosa",    value: "#ec4899", dim: "#500724" },
  { name: "Naranja", value: "#f97316", dim: "#431407" },
  { name: "Rojo",    value: "#ef4444", dim: "#450a0a" },
  { name: "Cyan",    value: "#06b6d4", dim: "#083344" },
];



const PRESETS = {
  "Push Day":  ["Press Banca", "Press Hombro", "Fondos", "Tríceps Polea", "Elevaciones Laterales"],
  "Pull Day":  ["Dominadas", "Remo con Barra", "Curl Bíceps", "Face Pull", "Pullover"],
  "Leg Day":   ["Sentadilla", "Peso Muerto", "Prensa de Pierna", "Extensión Cuádriceps", "Curl Femoral"],
  "Full Body": ["Sentadilla", "Press Banca", "Dominadas", "Peso Muerto Rumano", "Press Hombro"],
};

// Array mutable controlado — usar addCustomExerciseToDb() en lugar de push directo
let EXERCISE_DB = [
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
let MUSCLES = [...new Set(EXERCISE_DB.map(e => e.muscle))];

// Helper centralizado para agregar ejercicios personalizados al array global
function registerCustomExercise(name, muscle) {
  if (EXERCISE_DB.find(e => e.name === name)) return;
  EXERCISE_DB.push({ name, muscle, machine: false, equipment: "Personalizado" });
  if (!MUSCLES.includes(muscle)) MUSCLES = [...MUSCLES, muscle];
}

function ExerciseGif({ exName, size = 120 }) {
  const [expanded, setExpanded] = useState(false);
  const { gifs } = useCustomGifs();
  const src = gifs[exName] || GIF_MAP[exName];

  // Placeholder cuando no hay GIF
  if (!src || !exName || exName === "__custom__") {
    if (!exName || exName === "__custom__") return null;
    const muscle = EXERCISE_DB.find(e => e.name === exName)?.muscle || "";
    const muscleIcon = { Pecho:"💪", Espalda:"🔙", Hombros:"🏋️", Bíceps:"💪", Tríceps:"💪", Cuádriceps:"🦵", Femoral:"🦵", Glúteos:"🍑", Pantorrillas:"🦵", Core:"🎯", Cardio:"🏃" }[muscle] || "🏋️";
    return (
      <div style={{
        width: size, height: size,
        borderRadius: size > 60 ? 16 : 10,
        border: "2px dashed var(--border)",
        background: "var(--input-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontSize: size > 60 ? size * 0.35 : size * 0.45,
        color: "var(--text-muted)",
        opacity: 0.5,
      }}>
        {muscleIcon}
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={exName}
        onClick={() => setExpanded(true)}
        style={{
          width: size, height: size,
          borderRadius: 16, objectFit: "cover",
          border: "2px solid var(--border)",
          flexShrink: 0,
          background: "var(--input-bg)",
          cursor: "zoom-in",
          mixBlendMode: "luminosity",
          transition: "transform 0.2s, border-color 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)"; e.currentTarget.style.borderColor = "var(--accent)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        onError={e => { e.target.style.display = "none"; }}
      />
      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, cursor: "zoom-out",
            backdropFilter: "blur(10px)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ textAlign: "center", padding: 24 }}>
            <img
              src={src}
              alt={exName}
              style={{
                maxWidth: "80vw", maxHeight: "65vh",
                borderRadius: 20,
                border: "2px solid var(--accent)",
                boxShadow: "0 0 60px rgba(59,130,246,0.3)",
              }}
            />
            <div style={{ color: "white", marginTop: 16, fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>
              {exName}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>
              Toca en cualquier lugar para cerrar
            </div>
          </div>
        </div>
      )}
    </>
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
    // Solo sets marcados como done en modo live
    const doneSets = (ex.sets || []).filter(s => s.done !== false);
    if (doneSets.length === 0 && !ex.weight) return;

    const newW = doneSets.length > 0
      ? Math.max(...doneSets.map(st => parseFloat(st.weight) || 0))
      : parseFloat(ex.weight) || 0;
    const newR = doneSets.length > 0
      ? Math.max(...doneSets.map(st => parseFloat(st.reps) || 0))
      : parseFloat(ex.reps) || 0;

    if (newW <= 0) return;

    const new1RM = calc1RM(newW, newR);

    const prevBest1RM = existingSessions
      .flatMap(s => (s.exercises || []).filter(e => e.name === ex.name))
      .reduce((best, e) => {
        const sets = e.sets?.length > 0 ? e.sets : [{ weight: e.weight, reps: e.reps }];
        const best1rm = Math.max(...sets.map(st => calc1RM(parseFloat(st.weight) || 0, parseFloat(st.reps) || 0)));
        return Math.max(best, best1rm);
      }, 0);

    if (new1RM > prevBest1RM && new1RM > 0) {
      newPRs.push({ name: ex.name, rm: new1RM, weight: newW, reps: newR });
    }
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
// ─── Email Verify Wall ────────────────────────────────────────────────────────
function EmailVerifyWall({ user, children }) {
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);

  // Google users are always verified
  if (!user || user.emailVerified || user.isGuest) return children;

  async function resendVerification() {
    setSending(true);
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) await sendEmailVerification(firebaseUser);
      setResent(true);
    } catch(e) { console.error(e); }
    setSending(false);
  }

  return (
    <div style={{ padding: "32px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        Verifica tu email
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
        Esta función requiere un email verificado. Revisa tu bandeja de entrada y haz clic en el enlace que te enviamos a <strong style={{ color: "var(--text)" }}>{user.email}</strong>.
      </div>
      {resent
        ? <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>✅ Email reenviado. Revisa tu bandeja.</div>
        : <button className="btn-ghost" onClick={resendVerification} disabled={sending}>
            {sending ? "⏳ Enviando..." : "Reenviar email de verificación"}
          </button>
      }
    </div>
  );
}

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
  }, [onDone]);

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



// ─── Templates Modal ──────────────────────────────────────────────────────────

// ─── Share Template (código base64 comprimido) ────────────────────────────────
function encodeTemplate(t) {
  try {
    const mini = { n: t.name, d: t.day ?? "", e: (t.exercises||[]).map(ex => ({ n: ex.name, w: ex.weight, r: ex.reps, s: ex.series || ex.sets?.length || 3 })) };
    const bytes = new TextEncoder().encode(JSON.stringify(mini));
    return btoa(String.fromCharCode(...bytes)).replace(/=/g,"");
  } catch { return null; }
}

function decodeTemplate(code) {
  try {
    const padded = code + "===".slice(0, (4 - code.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || typeof obj.n !== "string") return null;
    return {
      id: uid(), name: obj.n.slice(0, 100), workout: obj.n.slice(0, 100), day: obj.d ?? "",
      exercises: (Array.isArray(obj.e) ? obj.e : []).slice(0, 50).map(e => ({
        id: uid(),
        name: typeof e.n === "string" ? e.n.slice(0, 100) : "",
        weight: e.w || "", reps: e.r || "", series: String(e.s || 3), sets: []
      })),
      createdAt: todayStr()
    };
  } catch { return null; }
}

function TemplatesModal({ sessions, onLoad, onClose }) {
  const [templates, setTemplates] = useState(() => load("gym_templates", []));
  const [tab, setTab] = useState("mine");
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editName, setEditName] = useState("");
  const [editDay, setEditDay] = useState("");
  const [editExercises, setEditExercises] = useState([]);
  const [editError, setEditError] = useState("");
  const [newExercise, setNewExercise] = useState("");

  function saveTemplates(t) { setTemplates(t); store("gym_templates", t); }
  function deleteTemplate(id) { saveTemplates(templates.filter(t => t.id !== id)); }
  function loadTemplate(t, mode = "live") { onLoad(t.workout, t.exercises, mode); onClose(); }
  const [modePickerFor, setModePickerFor] = useState(null); // template waiting for mode choice

  const recentWorkouts = [...new Map(sessions.map(s => [s.workout, s])).values()].slice(0, 5);

  function saveFromSession(s) {
    if (!s.workout) return;
    const t = {
      id: uid(), name: s.workout, workout: s.workout,
      exercises: (s.exercises||[]).map(e => {
        const bestSet = e.sets?.length > 0
          ? e.sets.reduce((best, st) => (parseFloat(st.weight)||0) > (parseFloat(best.weight)||0) ? st : best, e.sets[0])
          : null;
        return {
          ...e, id: uid(), sets: [],
          weight: bestSet ? String(bestSet.weight||"") : String(e.weight||""),
          reps: bestSet ? String(bestSet.reps||"") : String(e.reps||""),
          series: String(e.sets?.length || e.series || 3),
        };
      }),
      createdAt: todayStr()
    };
    saveTemplates([...templates, t]);
  }

  function openEditor(t) {
    setEditingTemplate(t);
    setEditName(t.name);
    setEditDay(t.day || "");
    setEditExercises(t.exercises || []);
    setNewExercise("");
  }

  function openNew() {
    const t = { id: uid(), name: "", workout: "", exercises: [], createdAt: todayStr() };
    openEditor(t);
  }

  function saveEdit() {
    if (!editName.trim()) { setEditError("⚠️ Agrega un nombre a la plantilla"); return; }
    setEditError("");
    const updated = { ...editingTemplate, name: editName, workout: editName, day: editDay, exercises: editExercises };
    const exists = templates.find(t => t.id === updated.id);
    if (exists) saveTemplates(templates.map(t => t.id === updated.id ? updated : t));
    else saveTemplates([...templates, updated]);
    setEditingTemplate(null);
  }

const [newWeight, setNewWeight] = useState("");
  const [newReps, setNewReps] = useState("");
  const [newSeries, setNewSeries] = useState("3");
  const [shareCode, setShareCode] = useState(null);
  const [importCode, setImportCode] = useState("");
  const [importMsg, setImportMsg] = useState("");

  function handleImport() {
    const t = decodeTemplate(importCode.trim());
    if (!t) { setImportMsg("❌ Código inválido. Verifica que sea correcto."); return; }
    if (templates.find(x => x.name === t.name)) { setImportMsg("⚠️ Ya tienes una plantilla con ese nombre."); return; }
    saveTemplates([...templates, t]);
    setImportCode("");
    setImportMsg(`✅ Plantilla "${t.name}" importada!`);
    const _t = setTimeout(() => setImportMsg(""), 3000); return () => clearTimeout(_t);
  }
  const [exCustomInput, setExCustomInput] = useState("");
  const [exCustomMuscleTpl, setExCustomMuscleTpl] = useState("");
  function addExercise() {
    const finalName = newExercise === "__custom__" ? exCustomInput.trim() : newExercise.trim();
    if (!finalName) return;
    if (newExercise === "__custom__" && exCustomMuscleTpl && !EXERCISE_DB.find(e => e.name === finalName)) {
      saveCustomExercise(finalName, exCustomMuscleTpl);
      registerCustomExercise(finalName, exCustomMuscleTpl);
    }
    setEditExercises(prev => [...prev, { id: uid(), name: finalName, sets: [], weight: newWeight || "0", reps: newReps || "0", series: newSeries || "3" }]);
    setNewExercise(""); setExCustomInput(""); setExCustomMuscleTpl(""); setNewWeight(""); setNewReps(""); setNewSeries("3");
  }

  function removeExercise(id) {
    setEditExercises(prev => prev.filter(e => e.id !== id));
  }

  // Estado extra para filtro de músculo en editor
  const [tplMuscleFilter, setTplMuscleFilter] = useState("Todos");

  if (editingTemplate) return (
    <div className="overlay" onClick={() => setEditingTemplate(null)}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"90vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">📋 {editingTemplate.name || "Nueva plantilla"}</h3>
          <button className="close-btn" onClick={() => setEditingTemplate(null)}>✕</button>
        </div>

        {/* Nombre */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Nombre</div>
          <input className="input" value={editName} onChange={e => setEditName(e.target.value)} placeholder="Ej: Push Day, Piernas..." style={{ width:"100%" }} />
        </div>

        {/* Día asignado */}
        <div style={{ marginBottom: 16 }}>
          <div className="card-label">Día asignado <span style={{ color:"var(--text-muted)", fontWeight:400 }}>(opcional)</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
            {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"].map((d, i) => (
              <button key={d}
                onClick={() => setEditDay(editDay === String(i) ? "" : String(i))}
                style={{
                  padding:"8px 4px", borderRadius:10, border:"1px solid",
                  fontSize:12, fontWeight:700, cursor:"pointer",
                  borderColor: editDay === String(i) ? "var(--accent)" : "var(--border)",
                  background: editDay === String(i) ? "rgba(59,130,246,0.15)" : "var(--input-bg)",
                  color: editDay === String(i) ? "var(--accent)" : "var(--text-muted)",
                  transition:"all 0.15s"
                }}>
                {d}
              </button>
            ))}
          </div>
          {editDay !== "" && (
            <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:6 }}>
              📅 Esta plantilla se sugerirá los {["Lunes","Martes","Miércoles","Jueves","Viernes","Sábados","Domingos"][editDay]}
            </div>
          )}
        </div>

        {/* Lista de ejercicios agregados */}
        {editExercises.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div className="card-label">Ejercicios ({editExercises.length})</div>
            {editExercises.map(ex => (
              <div key={ex.id} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, marginBottom:8, overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 12px", borderBottom:"1px solid var(--border)" }}>
                  <ExerciseGif exName={ex.name} size={36} />
                  <span style={{ fontWeight:700, fontSize:13, flex:1 }}>{ex.name}</span>
                  <button className="btn-ghost small danger" onClick={() => removeExercise(ex.id)}>🗑️</button>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, padding:"8px 12px" }}>
                  <div>
                    <label style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700, display:"block", marginBottom:3 }}>PESO (kg)</label>
                    <input className="input" type="number" inputMode="decimal" placeholder="0"
                      value={ex.weight}
                      onChange={e => setEditExercises(prev => prev.map(x => x.id !== ex.id ? x : { ...x, weight: e.target.value }))}
                      style={{ textAlign:"center", fontSize:14, fontWeight:700, padding:"6px 4px" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700, display:"block", marginBottom:3 }}>REPS</label>
                    <input className="input" type="number" inputMode="decimal" placeholder="0"
                      value={ex.reps}
                      onChange={e => setEditExercises(prev => prev.map(x => x.id !== ex.id ? x : { ...x, reps: e.target.value }))}
                      style={{ textAlign:"center", fontSize:14, fontWeight:700, padding:"6px 4px" }} />
                  </div>
                  <div>
                    <label style={{ fontSize:10, color:"var(--text-muted)", fontWeight:700, display:"block", marginBottom:3 }}>SERIES</label>
                    <input className="input" type="number" inputMode="decimal" placeholder="3"
                      value={ex.series || "3"}
                      onChange={e => setEditExercises(prev => prev.map(x => x.id !== ex.id ? x : { ...x, series: e.target.value }))}
                      style={{ textAlign:"center", fontSize:14, fontWeight:700, padding:"6px 4px" }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Agregar ejercicio — versión rica */}
        <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:14, padding:16, marginBottom:20 }}>
          <div className="card-label" style={{ marginBottom:12 }}>Agregar ejercicio</div>

          {/* Filtros por músculo */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(88px,1fr))", gap:6, marginBottom:12 }}>
            {["Todos", ...MUSCLES].map(m => (
              <button key={m} className={`muscle-chip ${tplMuscleFilter===m?"active":""}`}
                style={{ padding:"3px 9px", fontSize:11 }}
                onClick={() => { setTplMuscleFilter(m); setNewExercise(""); }}>
                {m}
              </button>
            ))}
          </div>

          {/* Selector de ejercicio */}
          <div className="field" style={{ marginBottom:10 }}>
            <label className="field-label">Ejercicio</label>
            <select className="input" value={newExercise} onChange={e => {
              const name = e.target.value;
              setNewExercise(name);
              if (name && name !== "__custom__" && sessions?.length > 0) {
                // Find last session where this exercise was logged
                const allUses = sessions
                  .slice().sort((a,b) => b.date.localeCompare(a.date))
                  .flatMap(s => (s.exercises||[]).filter(ex => ex.name === name));
                if (allUses.length > 0) {
                  const last = allUses[0];
                  const lastWeight = last.sets?.length > 0
                    ? String(Math.max(...last.sets.map(st => parseFloat(st.weight)||0)))
                    : String(last.weight || "");
                  const lastReps = last.sets?.length > 0
                    ? String(Math.max(...last.sets.map(st => parseFloat(st.reps)||0)))
                    : String(last.reps || "");
                  const lastSeries = last.sets?.length > 0
                    ? String(last.sets.length)
                    : String(last.series || "3");
                  setNewWeight(lastWeight !== "0" ? lastWeight : "");
                  setNewReps(lastReps !== "0" ? lastReps : "");
                  setNewSeries(lastSeries || "3");
                }
              }
            }}>
              <option value="">— Selecciona —</option>
              {(tplMuscleFilter === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === tplMuscleFilter))
                .map(ex => <option key={ex.name} value={ex.name}>{ex.name}{ex.machine?" 🔧":""}</option>)}
              <option value="__custom__">✏️ Personalizado...</option>
            </select>
            {newExercise === "__custom__" && (
              <>
                <input className="input" style={{ marginTop:6 }} placeholder="Nombre del ejercicio..." value={exCustomInput} onChange={e => setExCustomInput(lettersOnly(e.target.value))} autoFocus />
                <select className="input" style={{ marginTop:6 }} value={exCustomMuscleTpl} onChange={e => setExCustomMuscleTpl(e.target.value)}>
                  <option value="">— Músculo principal —</option>
                  {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </>
            )}
          </div>

          {/* GIF preview + peso/reps/series */}
          {newExercise && newExercise !== "__custom__" ? (
            <div style={{ padding:14, background:"var(--card)", border:"1px solid var(--border)", borderRadius:14, marginBottom:10 }}>
              <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10 }}>
                <ExerciseGif exName={newExercise} size={72} />
                <div>
                  <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:18, fontWeight:800 }}>{newExercise}</div>
                  {newWeight && <div style={{ fontSize:11, color:"var(--accent)", marginTop:2 }}>📋 Pre-rellenado con tu último entreno</div>}
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                <div className="field">
                  <label className="field-label">Peso (kg)</label>
                  <input className="input" placeholder="0" value={newWeight} onChange={e => setNewWeight(e.target.value)} type="number" inputMode="decimal" />
                </div>
                <div className="field">
                  <label className="field-label">Reps</label>
                  <input className="input" placeholder="0" value={newReps} onChange={e => setNewReps(e.target.value)} type="number" inputMode="decimal" />
                </div>
                <div className="field">
                  <label className="field-label">Series</label>
                  <input className="input" placeholder="3" value={newSeries} onChange={e => setNewSeries(e.target.value)} type="number" inputMode="decimal" />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 }}>
              <div className="field">
                <label className="field-label">Peso (kg)</label>
                <input className="input" placeholder="0" value={newWeight} onChange={e => setNewWeight(e.target.value)} type="number" inputMode="decimal" />
              </div>
              <div className="field">
                <label className="field-label">Reps</label>
                <input className="input" placeholder="0" value={newReps} onChange={e => setNewReps(e.target.value)} type="number" inputMode="decimal" />
              </div>
              <div className="field">
                <label className="field-label">Series</label>
                <input className="input" placeholder="3" value={newSeries} onChange={e => setNewSeries(e.target.value)} type="number" inputMode="decimal" />
              </div>
            </div>
          )}

          <button className="btn-add-ex" onClick={addExercise}>+ Agregar ejercicio</button>
        </div>

        {editError && (
          <div className="err-msg" style={{ marginBottom: 10 }}>{editError}</div>
        )}
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
          <button className={`tab-btn ${tab==="import"?"active":""}`} onClick={() => setTab("import")}>🔗 Importar</button>
        </div>

        {tab === "mine" && (
          <div>
            <button className="btn-primary" style={{ width:"100%", marginBottom:16, fontSize:15 }} onClick={openNew}>+ Crear plantilla</button>
            {templates.length === 0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center", padding:"20px 0" }}>Aún no tienes plantillas. Crea una o guarda una desde "Desde historial".</p>}
            {templates.map(t => (
              <div key={t.id} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, flexWrap:"wrap", gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{t.name}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                      {(t.exercises||[]).length} ejercicios · {fmtDate(t.createdAt)}
                      {t.day !== undefined && t.day !== "" && (
                        <span style={{ marginLeft:8, color:"var(--accent)", fontWeight:600 }}>
                          📅 {["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][t.day]}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="btn-ghost small" onClick={() => openEditor(t)}>✏️ Editar</button>
                    <button className="btn-ghost small" onClick={() => setModePickerFor(modePickerFor?.id === t.id ? null : t)} style={{ background: modePickerFor?.id === t.id ? "var(--accent-dim)" : undefined, borderColor: modePickerFor?.id === t.id ? "var(--accent)" : undefined, color: modePickerFor?.id === t.id ? "var(--accent)" : undefined }}>▶ Usar</button>
                    <button className="btn-ghost small" onClick={() => setShareCode(shareCode?.id === t.id ? null : { id: t.id, code: encodeTemplate(t), name: t.name })} title="Compartir">🔗</button>
                    <button className="btn-ghost small danger" onClick={() => deleteTemplate(t.id)}>🗑️</button>
                  </div>
                </div>
                {modePickerFor?.id === t.id && (
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--input-bg)", border: "1px solid var(--accent)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>¿Cómo quieres entrenar?</span>
                    <button className="btn-primary" style={{ fontSize: 13, padding: "7px 14px" }} onClick={() => loadTemplate(t, "live")}>⚡ En vivo</button>
                    <button className="btn-ghost small" onClick={() => loadTemplate(t, "register")}>📝 Registrar</button>
                  </div>
                )}
                {shareCode?.id === t.id && (
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 10 }}>
                    <div style={{ fontSize: 11, color: "#a855f7", fontWeight: 700, marginBottom: 6 }}>Código para compartir:</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <code style={{ flex: 1, fontSize: 10, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 8px", wordBreak: "break-all", color: "var(--text)" }}>
                        {shareCode.code}
                      </code>
                      <button className="btn-ghost small" onClick={(e) => {
                        navigator.clipboard.writeText(shareCode.code);
                        const btn = e.currentTarget;
                        btn.textContent = "✓ Copiado";
                        btn.style.color = "#22c55e";
                        btn.style.borderColor = "#22c55e";
                        setTimeout(() => { btn.textContent = "📋 Copiar"; btn.style.color = ""; btn.style.borderColor = ""; }, 1500);
                      }}>📋 Copiar</button>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Comparte este código para que otros puedan importar esta plantilla.</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}


        {tab === "import" && (
          <div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
              Pega el código que te compartieron para importar su plantilla directamente.
            </div>
            <div className="field" style={{ marginBottom: 12 }}>
              <label className="field-label">Código de plantilla</label>
              <textarea
                className="input textarea"
                placeholder="Pega el código aquí..."
                value={importCode}
                onChange={e => setImportCode(e.target.value)}
                style={{ minHeight: 80, fontFamily: "monospace", fontSize: 12 }}
              />
            </div>
            <button className="btn-primary" style={{ width: "100%" }} onClick={handleImport}>
              📥 Importar plantilla
            </button>
            {importMsg && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: importMsg.startsWith("✅") ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.08)", border: `1px solid ${importMsg.startsWith("✅") ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 10, fontSize: 13, color: importMsg.startsWith("✅") ? "#22c55e" : "#ef4444" }}>
                {importMsg}
              </div>
            )}
          </div>
        )}

        {tab === "quick" && (
          <div>
            <p style={{ fontSize:12, color:"var(--text-muted)", marginBottom:14 }}>Guarda una sesión reciente como plantilla reutilizable:</p>
            {recentWorkouts.length === 0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center" }}>Sin sesiones aún.</p>}
            {recentWorkouts.map(s => (
              <div key={s.id} style={{ marginBottom:8 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{s.workout}</div>
                    <div style={{ fontSize:11, color:"var(--text-muted)" }}>{(s.exercises||[]).length} ejercicios · {fmtDate(s.date)}</div>
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="btn-ghost small" onClick={() => setModePickerFor(modePickerFor?.id === s.id ? null : s)}>▶ Usar</button>
                    <button className="btn-ghost small" onClick={() => saveFromSession(s)}>💾 Guardar</button>
                  </div>
                </div>
                {modePickerFor?.id === s.id && (
                  <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--input-bg)", border: "1px solid var(--accent)", borderRadius: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", flex: 1 }}>¿Cómo quieres entrenar?</span>
                    <button className="btn-primary" style={{ fontSize: 13, padding: "7px 14px" }} onClick={() => loadTemplate(s, "live")}>⚡ En vivo</button>
                    <button className="btn-ghost small" onClick={() => loadTemplate(s, "register")}>📝 Registrar</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Weekly Chart ─────────────────────────────────────────────────────────────

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

function TrainingCalendar({ sessions, joinedAt }) {
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
    <div className="card" style={{marginBottom:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
        <div className="card-label" style={{margin:0}}>📅 Calendario de entrenos</div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={prevMonth} style={{background:"none",border:"1px solid var(--border)",color:"var(--text-muted)",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>‹</button>
          <span style={{fontSize:11,color:"var(--text-muted)",textTransform:"capitalize",minWidth:100,textAlign:"center"}}>{monthName}</span>
          <button onClick={nextMonth} style={{background:"none",border:"1px solid var(--border)",color:"var(--text-muted)",borderRadius:6,width:24,height:24,cursor:"pointer",fontSize:14,display:"flex",alignItems:"center",justifyContent:"center"}}>›</button>
        </div>
      </div>

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
  );
}

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

  const total = vals.reduce((a,b)=>a+b,0);
  const avg = data.length > 0 ? (total / data.length).toFixed(metric==="vol"?1:1) : 0;

  return (
    <div className="card">
      {/* Header */}
      <div style={{marginBottom:14}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
          <div className="card-label" style={{margin:0}}>📈 Progreso</div>
          <div style={{display:"flex",gap:4}}>
            {[["count","Sesiones"],["vol","Volumen"]].map(([v,l])=>(
              <button key={v} onClick={()=>setMetric(v)} style={{padding:"3px 10px",fontSize:11,borderRadius:20,border:"1px solid",borderColor:metric===v?"var(--accent)":"var(--border)",background:metric===v?"var(--accent)":"transparent",color:metric===v?"white":"var(--text-muted)",cursor:"pointer",fontWeight:600,transition:"all 0.2s"}}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:4,justifyContent:"center"}}>
          {[["day","Día"],["week","Semana"],["month","Mes"],["year","Año"]].map(([v,l])=>(
            <button key={v} onClick={()=>setPeriod(v)} style={{flex:1,padding:"5px 4px",fontSize:11,borderRadius:8,border:"1px solid",borderColor:period===v?"var(--accent)":"var(--border)",background:period===v?"var(--accent)":"transparent",color:period===v?"white":"var(--text-muted)",cursor:"pointer",fontWeight:period===v?700:500,transition:"all 0.2s"}}>{l}</button>
          ))}
        </div>
      </div>

      {/* Stat summary */}
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

      {/* Bar chart — fixed height container so bars are always centered */}
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
        {/* X axis labels */}
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

function BadgesModal({ sessions, bodyStats, onClose }) {
  const prs = getPRs(sessions);
  const [filterLevel, setFilterLevel] = useState(0);

  const starColors = {
    1: { bg:"rgba(148,163,184,0.1)", border:"rgba(148,163,184,0.4)", color:"#94a3b8", label:"Bronce" },
    2: { bg:"rgba(234,179,8,0.1)",   border:"rgba(234,179,8,0.4)",   color:"#eab308", label:"Plata" },
    3: { bg:"rgba(59,130,246,0.1)",  border:"rgba(59,130,246,0.4)",  color:"#3b82f6", label:"Oro" },
    4: { bg:"rgba(168,85,247,0.12)", border:"rgba(168,85,247,0.5)",  color:"#a855f7", label:"Platino" },
    5: { bg:"rgba(245,158,11,0.15)", border:"rgba(245,158,11,0.6)",  color:"#f59e0b", label:"Legendario" },
  };

  function Stars({ n }) {
    return (
      <div style={{ display:"flex", gap:2 }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ fontSize:10, opacity: i<=n ? 1 : 0.18 }}>⭐</span>
        ))}
      </div>
    );
  }

  const allBadges = BADGE_DEFS.map(b => ({ ...b, unlocked: b.check(sessions, prs, bodyStats||{}) }));
  const shown     = filterLevel === 0 ? allBadges : allBadges.filter(b => b.stars === filterLevel);
  const earned    = shown.filter(b => b.unlocked);
  const locked    = shown.filter(b => !b.unlocked);
  const totalEarned = allBadges.filter(b => b.unlocked).length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🏅 Logros</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Barra de progreso global */}
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
                return (
                  <div key={b.id} style={{ background:sc.bg, border:`1px solid ${sc.border}`, borderRadius:14, padding:"14px 12px", textAlign:"center" }}>
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
  const [period, setPeriod]   = useState("week");
  const [view,   setView]     = useState("volume"); // "volume" | "recovery"
  const [hover,  setHover]    = useState(null);

  const today = new Date(); today.setHours(0,0,0,0);

  // ── Volume per muscle in period ───────────────────────────────────────────
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

  // ── Days since last trained (for recovery view) ───────────────────────────
  const lastTrained = {};
  sessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const dbEx = EXERCISE_DB.find(e => e.name === ex.name);
    if (dbEx?.muscle) {
      if (!lastTrained[dbEx.muscle] || s.date > lastTrained[dbEx.muscle]) lastTrained[dbEx.muscle] = s.date;
    }
  }));
  const daysSince = (muscle) => {
    if (!lastTrained[muscle]) return 999;
    return Math.round((today - new Date(lastTrained[muscle] + "T00:00:00")) / 86400000);
  };

  // Recovery windows per muscle group (days needed to recover)
  const RECOVERY_DAYS = {
    "Bíceps":      { rest: 1, ready: 2 },  // small — recovers fast
    "Tríceps":     { rest: 1, ready: 2 },
    "Hombros":     { rest: 1, ready: 2 },
    "Core":        { rest: 1, ready: 2 },
    "Pantorrillas":{ rest: 1, ready: 2 },
    "Pecho":       { rest: 2, ready: 3 },  // medium
    "Espalda":     { rest: 2, ready: 3 },
    "Glúteos":     { rest: 2, ready: 3 },
    "Femoral":     { rest: 2, ready: 4 },  // large — needs more time
    "Cuádriceps":  { rest: 2, ready: 4 },
    "Cardio":      { rest: 1, ready: 2 },
  };

  // Recovery status using per-muscle thresholds
  const recoveryColor = (muscle) => {
    const d = daysSince(muscle);
    const { rest, ready } = RECOVERY_DAYS[muscle] || { rest: 1, ready: 2 };
    if (d === 999) return "#374151";          // never trained
    if (d <= rest)  return "#ef4444";          // needs rest
    if (d <= ready) return "#f59e0b";          // recovering
    if (d <= ready + 2) return "#22c55e";      // ready
    return "#3b82f6";                          // prime time (been a while)
  };

  const recoveryLabel = (muscle, d) => {
    const { rest, ready } = RECOVERY_DAYS[muscle] || { rest: 1, ready: 2 };
    if (d === 999)       return "Nunca entrenado";
    if (d <= rest)       return `Necesita descanso (${rest - d + 1}d más)`;
    if (d <= ready)      return `Recuperando (${ready - d}d más)`;
    if (d <= ready + 2)  return "✅ Listo para entrenar";
    return "💪 ¡En su punto!";
  };

  const maxCount = Math.max(...Object.values(muscleCounts), 1);
  const sorted   = Object.entries(muscleCounts).sort((a,b) => b[1]-a[1]);

  // ── Per-muscle color & opacity for SVG ───────────────────────────────────
  const getMuscleStyle = (muscle) => {
    if (view === "recovery") {
      const d = daysSince(muscle);
      return { fill: recoveryColor(muscle), opacity: d === 999 ? 0.15 : 0.75 };
    }
    const count = muscleCounts[muscle] || 0;
    return { fill: MUSCLE_GROUPS[muscle]?.fill || "#64748b", opacity: count > 0 ? 0.3 + (count/maxCount)*0.65 : 0.06 };
  };

  // ── Front / Back SVG paths ─────────────────────────────────────────────── 
  // Front body silhouette base shape
  // Trazado anatómico basado en imagen de referencia muscular
  // viewBox 0 0 300 440
  const FRONT_MUSCLES = {
    "Hombros": { paths: [
      // deltoides anterior izquierdo — cubre hombro redondeado
      "M 78 92 Q 62 94 58 110 Q 56 124 64 134 Q 72 142 84 138 Q 94 132 96 118 Q 98 104 90 94 Q 84 90 78 92 Z",
      // deltoides anterior derecho
      "M 222 92 Q 238 94 242 110 Q 244 124 236 134 Q 228 142 216 138 Q 206 132 204 118 Q 202 104 210 94 Q 216 90 222 92 Z",
    ]},
    "Pecho": { paths: [
      // pectoral izquierdo — forma de abanico grande
      "M 100 94 Q 126 86 150 92 Q 152 96 150 136 Q 138 146 118 142 Q 100 134 94 118 Q 92 106 100 94 Z",
      // pectoral derecho
      "M 200 94 Q 174 86 150 92 Q 148 96 150 136 Q 162 146 182 142 Q 200 134 206 118 Q 208 106 200 94 Z",
    ]},
    "Bíceps": { paths: [
      // bíceps izquierdo — abultado en centro del brazo
      "M 70 140 Q 58 152 58 172 Q 60 186 72 190 Q 84 190 90 178 Q 94 164 90 146 Q 84 136 70 140 Z",
      // bíceps derecho
      "M 230 140 Q 242 152 242 172 Q 240 186 228 190 Q 216 190 210 178 Q 206 164 210 146 Q 216 136 230 140 Z",
    ]},
    "Core": { paths: [
      // recto abdominal — 6 bloques bien definidos
      // fila superior
      "M 126 140 Q 148 137 148 140 L 148 158 Q 134 161 120 158 Q 118 152 126 140 Z",
      "M 152 140 Q 174 137 174 140 L 174 158 Q 166 161 152 158 Z",
      // fila media
      "M 122 162 Q 148 159 148 162 L 148 180 Q 132 183 118 180 Q 116 172 122 162 Z",
      "M 152 162 Q 178 159 178 162 L 178 180 Q 164 183 152 180 Z",
      // fila inferior
      "M 124 184 Q 148 181 148 184 L 147 200 Q 134 203 122 200 Q 120 192 124 184 Z",
      "M 152 184 Q 176 181 176 184 L 176 200 Q 162 203 152 200 Z",
      // oblicuos (laterales)
      "M 96 148 Q 108 140 120 142 Q 116 170 112 196 Q 100 194 92 182 Q 88 166 96 148 Z",
      "M 204 148 Q 192 140 180 142 Q 184 170 188 196 Q 200 194 208 182 Q 212 166 204 148 Z",
    ]},
    "Cuádriceps": { paths: [
      // cuádriceps izquierdo — 3 cabezas visibles
      "M 104 212 Q 94 234 94 268 Q 96 286 112 292 Q 128 292 138 276 Q 144 256 138 226 Q 132 210 118 208 Q 110 208 104 212 Z",
      // cuádriceps derecho
      "M 196 212 Q 206 234 206 268 Q 204 286 188 292 Q 172 292 162 276 Q 156 256 162 226 Q 168 210 182 208 Q 190 208 196 212 Z",
    ]},
    "Pantorrillas": { paths: [
      // gastrocnemio izquierdo — forma de corazón invertido
      "M 100 294 Q 88 312 90 338 Q 94 356 110 360 Q 126 358 134 340 Q 138 318 130 296 Q 120 286 100 294 Z",
      // gastrocnemio derecho
      "M 200 294 Q 212 312 210 338 Q 206 356 190 360 Q 174 358 166 340 Q 162 318 170 296 Q 180 286 200 294 Z",
    ]},
    "Cardio": { paths: [
      "M 150 120 Q 138 108 130 114 Q 122 122 128 134 Q 134 144 150 154 Q 166 144 172 134 Q 178 122 170 114 Q 162 108 150 120 Z",
    ]},
  };

  const BACK_MUSCLES = {
    "Hombros": { paths: [
      // deltoides posterior izquierdo
      "M 78 92 Q 62 94 58 110 Q 56 126 66 136 Q 76 144 88 138 Q 98 130 98 114 Q 96 98 84 90 Q 80 88 78 92 Z",
      // deltoides posterior derecho
      "M 222 92 Q 238 94 242 110 Q 244 126 234 136 Q 224 144 212 138 Q 202 130 202 114 Q 204 98 216 90 Q 220 88 222 92 Z",
    ]},
    "Espalda": { paths: [
      // trapecio — triángulo superior entre hombros y cuello
      "M 118 82 Q 150 76 182 82 Q 192 90 196 104 Q 180 116 150 120 Q 120 116 104 104 Q 108 90 118 82 Z",
      // dorsal izquierdo — abanico desde axila hasta cadera
      "M 96 108 Q 108 118 118 122 Q 120 152 116 184 Q 102 190 90 180 Q 82 166 84 142 Q 86 122 96 108 Z",
      // dorsal derecho
      "M 204 108 Q 192 118 182 122 Q 180 152 184 184 Q 198 190 210 180 Q 218 166 216 142 Q 214 122 204 108 Z",
      // romboides / espina central
      "M 122 122 Q 150 118 178 122 Q 182 148 178 178 Q 164 188 150 190 Q 136 188 122 178 Q 118 148 122 122 Z",
    ]},
    "Tríceps": { paths: [
      // tríceps izquierdo — forma de herradura visible por detrás
      "M 68 136 Q 56 150 56 172 Q 58 186 70 190 Q 82 190 90 178 Q 86 162 80 144 Q 76 132 68 136 Z",
      // tríceps derecho
      "M 232 136 Q 244 150 244 172 Q 242 186 230 190 Q 218 190 210 178 Q 214 162 220 144 Q 224 132 232 136 Z",
    ]},
    "Glúteos": { paths: [
      // glúteo izquierdo — redondeado y prominente
      "M 106 200 Q 108 190 148 192 Q 152 192 152 218 Q 150 234 126 238 Q 106 232 104 218 Q 102 208 106 200 Z",
      // glúteo derecho
      "M 194 200 Q 192 190 152 192 Q 148 192 148 218 Q 150 234 174 238 Q 194 232 196 218 Q 198 208 194 200 Z",
    ]},
    "Femoral": { paths: [
      // bíceps femoral izquierdo — corre por posterior del muslo
      "M 104 240 Q 94 260 94 290 Q 96 308 112 314 Q 128 312 136 294 Q 140 270 134 246 Q 126 232 114 234 Q 108 236 104 240 Z",
      // bíceps femoral derecho
      "M 196 240 Q 206 260 206 290 Q 204 308 188 314 Q 172 312 164 294 Q 160 270 166 246 Q 174 232 186 234 Q 192 236 196 240 Z",
    ]},
    "Pantorrillas": { paths: [
      // gastrocnemio posterior izquierdo
      "M 100 316 Q 88 336 90 358 Q 94 374 110 378 Q 126 376 134 358 Q 138 336 130 316 Q 120 306 100 316 Z",
      // gastrocnemio posterior derecho
      "M 200 316 Q 212 336 210 358 Q 206 374 190 378 Q 174 376 166 358 Q 162 336 170 316 Q 180 306 200 316 Z",
    ]},
  };

  // Silueta anatómica detallada
  const BodyOutline = () => (
    <g opacity={0.22} fill="#475569">
      {/* cabeza ovalada */}
      <ellipse cx={150} cy={42} rx={25} ry={28}/>
      {/* cuello */}
      <path d="M 141 68 Q 140 80 136 86 L 164 86 Q 160 80 159 68 Z"/>
      {/* torso trapezoidal — más ancho arriba */}
      <path d="M 94 86 Q 88 88 86 96 L 82 198 Q 82 208 92 210 L 208 210 Q 218 208 218 198 L 214 96 Q 212 88 206 86 Z"/>
      {/* clavículas */}
      <path d="M 106 90 Q 128 84 150 86 Q 172 84 194 90" fill="none" stroke="#64748b" strokeWidth={2} opacity={0.5}/>
      {/* brazo superior izquierdo */}
      <path d="M 58 88 Q 50 94 50 114 L 52 180 Q 54 192 66 194 L 82 192 Q 94 190 96 178 L 98 112 Q 98 94 88 88 Z"/>
      {/* brazo superior derecho */}
      <path d="M 242 88 Q 250 94 250 114 L 248 180 Q 246 192 234 194 L 218 192 Q 206 190 204 178 L 202 112 Q 202 94 212 88 Z"/>
      {/* antebrazo izquierdo */}
      <path d="M 52 194 Q 44 202 44 220 L 46 264 Q 48 276 60 278 L 76 276 Q 88 274 90 262 L 92 218 Q 92 202 82 194 Z"/>
      {/* antebrazo derecho */}
      <path d="M 248 194 Q 256 202 256 220 L 254 264 Q 252 276 240 278 L 224 276 Q 212 274 210 262 L 208 218 Q 208 202 218 194 Z"/>
      {/* muslo izquierdo */}
      <path d="M 100 210 Q 92 218 92 238 L 94 294 Q 96 308 112 312 L 130 310 Q 144 306 146 292 L 144 236 Q 142 216 130 210 Z"/>
      {/* muslo derecho */}
      <path d="M 200 210 Q 208 218 208 238 L 206 294 Q 204 308 188 312 L 170 310 Q 156 306 154 292 L 156 236 Q 158 216 170 210 Z"/>
      {/* pantorrilla izquierda */}
      <path d="M 94 314 Q 86 324 88 346 L 90 372 Q 92 386 108 390 L 124 388 Q 138 384 140 368 L 138 342 Q 136 322 126 314 Z"/>
      {/* pantorrilla derecha */}
      <path d="M 206 314 Q 214 324 212 346 L 210 372 Q 208 386 192 390 L 176 388 Q 162 384 160 368 L 162 342 Q 164 322 174 314 Z"/>
      {/* pie izquierdo */}
      <ellipse cx={114} cy={394} rx={26} ry={9} transform="rotate(-5 114 394)"/>
      {/* pie derecho */}
      <ellipse cx={186} cy={394} rx={26} ry={9} transform="rotate(5 186 394)"/>
    </g>
  );

  const MuscleLayer = ({ muscleMap }) => (
    <>
      {Object.entries(muscleMap).map(([muscle, { paths }]) => {
        const { fill, opacity } = getMuscleStyle(muscle);
        const isHovered = hover === muscle;
        return paths.map((d, i) => (
          <path
            key={`${muscle}-${i}`} d={d} fill={fill}
            opacity={isHovered ? Math.min(opacity + 0.25, 1) : opacity}
            style={{ transition: "opacity 0.4s, fill 0.4s", cursor: "pointer", filter: isHovered ? `drop-shadow(0 0 6px ${fill})` : undefined }}
            onMouseEnter={() => setHover(muscle)}
            onMouseLeave={() => setHover(null)}
            onClick={() => setHover(h => h === muscle ? null : muscle)}
          >
            <title>{muscle}: {view === "recovery" ? recoveryLabel(muscle, daysSince(muscle)) : `${muscleCounts[muscle]||0} series`}</title>
          </path>
        ));
      })}
    </>
  );

  const hoveredInfo = hover ? {
    muscle: hover,
    count: muscleCounts[hover] || 0,
    days: daysSince(hover),
    color: view === "recovery" ? recoveryColor(hover) : (MUSCLE_GROUPS[hover]?.fill || "#64748b"),
  } : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "92vh", overflowY: "auto", maxWidth: 560 }}>
        <div className="modal-header">
          <h3 className="modal-title">💪 Mapa muscular</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flex: 1, gap: 4 }}>
            {[["week","Semana"],["month","Mes"],["all","Todo"]].map(([v,l]) => (
              <button key={v} onClick={() => setPeriod(v)} style={{ flex:1, padding:"6px 4px", fontSize:11, borderRadius:8, border:"1px solid", borderColor:period===v?"var(--accent)":"var(--border)", background:period===v?"var(--accent)":"transparent", color:period===v?"white":"var(--text-muted)", cursor:"pointer", fontWeight:period===v?700:500, transition:"all 0.2s" }}>{l}</button>
            ))}
          </div>
          <div style={{ display:"flex", gap:4 }}>
            {[["volume","📊 Volumen"],["recovery","🔄 Recuperación"]].map(([v,l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding:"6px 10px", fontSize:11, borderRadius:8, border:"1px solid", borderColor:view===v?"var(--accent)":"var(--border)", background:view===v?"var(--accent)":"transparent", color:view===v?"white":"var(--text-muted)", cursor:"pointer", fontWeight:view===v?700:500, transition:"all 0.2s", whiteSpace:"nowrap" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* Hover tooltip */}
        {hoveredInfo && (
          <div style={{ padding:"10px 14px", background:`${hoveredInfo.color}15`, border:`1px solid ${hoveredInfo.color}40`, borderRadius:10, marginBottom:12, display:"flex", alignItems:"center", gap:12 }}>
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

        {/* Front + Back bodies */}
        <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:16, flexWrap:"wrap" }}>
          {[["FRENTE", FRONT_MUSCLES], ["ESPALDA", BACK_MUSCLES]].map(([label, muscleMap]) => (
            <div key={label} style={{ flex:"0 0 auto", textAlign:"center" }}>
              <div style={{ fontSize:9, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", marginBottom:4 }}>{label}</div>
              <svg width={200} height={420} viewBox="0 0 300 460" style={{ display:"block" }}>
                <BodyOutline />
                <MuscleLayer muscleMap={muscleMap} />
              </svg>
            </div>
          ))}
        </div>

        {/* Recovery legend */}
        {view === "recovery" && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>Leyenda de recuperación</div>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:8 }}>
              {[["#ef4444","Descansando"],["#f59e0b","Recuperando"],["#22c55e","Listo"],["#3b82f6","¡En su punto!"]].map(([c,l]) => (
                <div key={l} style={{ display:"flex", alignItems:"center", gap:6, fontSize:11, color:"var(--text-muted)" }}>
                  <div style={{ width:10, height:10, borderRadius:3, background:c, flexShrink:0 }}/>
                  {l}
                </div>
              ))}
            </div>
            <div style={{ fontSize:10, color:"var(--text-muted)", opacity:0.7 }}>⚡ Tiempos ajustados por grupo: pequeños (bíceps, tríceps) 1-2d · medianos (pecho, espalda) 2-3d · grandes (cuádriceps, femoral) 2-4d</div>
          </div>
        )}

        {/* Volume list */}
        {view === "volume" && (
          <div>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:1.5, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Músculos trabajados</div>
            {sorted.length === 0
              ? <p style={{ color:"var(--text-muted)", fontSize:13 }}>Sin sesiones en este período.</p>
              : sorted.map(([muscle, count]) => {
                  const color = MUSCLE_GROUPS[muscle]?.fill || "#64748b";
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
        type="number" inputMode="decimal" min={5} max={600} placeholder="ej: 150 seg"
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
            <input className="input" placeholder="0" value={weight} onChange={e => setWeight(numDot(e.target.value))} inputMode="decimal" />
          </div>
          <div className="field">
            <label className="field-label">Repeticiones</label>
            <input className="input" placeholder="0" value={reps} onChange={e => setReps(numDot(e.target.value))} inputMode="decimal" />
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
function InfoPill({ title, lines, color = "var(--accent)" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={e=>{e.preventDefault();e.stopPropagation();setOpen(true);}} style={{ background:"var(--card)", border:"none", cursor:"pointer", display:"inline-flex", alignItems:"center", justifyContent:"center", width:16, height:16, borderRadius:"50%", color:"var(--text-muted)", fontSize:10, fontWeight:800, verticalAlign:"middle", marginLeft:5, flexShrink:0, lineHeight:1 }}>?</button>
      {open && (<div className="overlay" style={{zIndex:99999}} onClick={e=>{e.stopPropagation();setOpen(false);}}><div className="modal" style={{maxWidth:320,padding:20}} onClick={e=>e.stopPropagation()}><div style={{fontSize:13,fontWeight:800,color,marginBottom:10}}>{title}</div>{lines.map((l,i)=><div key={i} style={{fontSize:12,color:"var(--text-muted)",lineHeight:1.6,marginBottom:4}}>{l}</div>)}<button className="btn-primary" style={{width:"100%",marginTop:12,fontSize:13}} onClick={e=>{e.stopPropagation();setOpen(false);}}>Entendido</button></div></div>)}
    </>
  );
}

function BodyStatsModal({ stats, onSave, onClose, uid, isGuest }) {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState(stats.height || "170");
  const [gender, setGender] = useState(stats.gender || "male");
const [age, setAge] = useState(stats.age || "25");
  const [activity, setActivity] = useState(stats.activity || "moderate");
  const [goal, setGoal] = useState(stats.goal || "maintain");
  const [goalWeight, setGoalWeight] = useState(stats.goalWeight || "");
  const [saved, setSaved] = useState(false);
  const [photoTab, setPhotoTab] = useState(false);
  const [measureEntries, setMeasureEntries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("gym_measure_entries") || "[]"); } catch { return []; }
  });
  const [measureForm, setMeasureForm] = useState({});

  // Load from Firestore on mount (non-guest)
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
    if (isNaN(w) || w < 20 || w > 300) return; // el error ya se muestra inline en el input
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
    // Detectar velocidad de cambio absurda (más de 3kg/semana es fisiológicamente imposible sin error de datos)
    const weeklyKg = Math.abs(slope * 7);
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
          <button onClick={() => setPhotoTab(false)} style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: !photoTab ? "var(--accent)" : "transparent", color: !photoTab ? "white" : "var(--text-muted)", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>
            📊 Stats & Peso
          </button>
          <button onClick={() => setPhotoTab(true)} style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: photoTab ? "var(--accent)" : "transparent", color: photoTab ? "white" : "var(--text-muted)", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>
            📐 Medidas corporales
          </button>
        </div>

        {/* MEDIDAS TAB */}
        {photoTab && (() => {
          const FIELDS = [
            { key:"bodyFat", label:"% Grasa",  unit:"%",  color:"#f97316", info:true },
            { key:"chest",   label:"Pecho",    unit:"cm", color:"#3b82f6" },
            { key:"waist",   label:"Cintura",  unit:"cm", color:"#22c55e" },
            { key:"hip",     label:"Cadera",   unit:"cm", color:"#a855f7" },
            { key:"arm",     label:"Brazo",    unit:"cm", color:"#ec4899" },
            { key:"thigh",   label:"Muslo",    unit:"cm", color:"#06b6d4" },
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
                  {FIELDS.map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize:10, color:"var(--text-muted)", display:"flex", alignItems:"center", marginBottom:3 }}>{f.label} ({f.unit}){f.info && <InfoPill title="¿Cómo medir la grasa corporal?" color="#f97316" lines={["El % de grasa indica qué parte de tu peso es grasa.","📏 Pliegues cutáneos: mide el grosor de la piel en puntos clave.","⚖️ Bioimpedancia: báscula eléctrica, menos precisa pero fácil.","🔬 DEXA scan: el más preciso, disponible en clínicas.","📊 Hombre: Atlético 6–13% · Fitness 14–17% · Promedio 18–24%","  Mujer: Atlético 14–20% · Fitness 21–24% · Promedio 25–31%"]} />}</label>
                      <input className="input" placeholder="—" inputMode="decimal"
                        value={measureForm[f.key]||""}
                        onChange={e => setMeasureForm(p => ({...p, [f.key]: e.target.value.replace(/[^0-9.]/g,"")}))}
                        style={{ textAlign:"center", fontSize:14, fontWeight:700 }}
                      />
                    </div>
                  ))}
                </div>
                <button className="btn-primary" style={{ width:"100%", fontSize:14 }} onClick={() => {
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
        {!photoTab && (<>

        {/* Basic inputs */}
        <div className="form-row" style={{ marginBottom: 10 }}>
          <div className="field">
            <label className="field-label">Estatura (cm)</label>
            <input className="input" placeholder="170" value={height} onChange={e => setHeight(numDot(e.target.value))} inputMode="decimal" />
          </div>
          <div className="field">
            <label className="field-label">Peso hoy (kg)</label>
            <input
              className="input"
              placeholder="70.5"
              value={weight}
              onChange={e => setWeight(numDot(e.target.value))}
              onKeyDown={e => e.key==="Enter"&&save()}
              style={{
                borderColor: weight && (parseFloat(weight) < 20 || parseFloat(weight) > 300)
                  ? "#ef4444" : undefined,
                color: weight && (parseFloat(weight) < 20 || parseFloat(weight) > 300)
                  ? "#ef4444" : undefined,
              }}
            />
            {weight && (parseFloat(weight) < 20 || parseFloat(weight) > 300) && (
              <div style={{ fontSize:10, color:"#ef4444", marginTop:3 }}>Valor fuera de rango (20–300 kg)</div>
            )}
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

        {/* Meta de peso */}
        {currentWeight && effectiveHeight && (() => {
          // Rangos ideales según altura y objetivo (Devine + margen muscular)
          const h = effectiveHeight;
          const baseIdeal = effectiveGender === "female"
            ? 45.5 + 2.3 * ((h - 152.4) / 2.54)
            : 50   + 2.3 * ((h - 152.4) / 2.54);
          const idealMin = Math.round(baseIdeal * 0.92);
          const idealMax = goal === "bulk"
            ? Math.round(baseIdeal * 1.18)   // volumen: hasta +18%
            : goal === "deficit"
            ? Math.round(baseIdeal * 1.00)   // déficit: llegar al ideal
            : Math.round(baseIdeal * 1.08);  // mantener: ±8%

          const suggestedGoal = goal === "bulk" ? idealMax : idealMin;
          const userGoal = parseFloat(goalWeight) || suggestedGoal;
          const totalToLose = currentWeight - userGoal;
          const weeksNeeded = prediction?.slope && Math.abs(prediction.slope) > 0.01
            ? Math.round(Math.abs(totalToLose) / Math.abs(prediction.slope * 7))
            : null;
          const progress = totalToLose !== 0
            ? Math.min(Math.max((currentWeight - userGoal) / totalToLose, 0), 1)
            : 1;
          const progressPct = goal === "bulk"
            ? Math.min(Math.max((currentWeight - (stats.entries?.[0]?.weight || currentWeight)) / (userGoal - (stats.entries?.[0]?.weight || currentWeight)), 0), 1) * 100
            : (1 - Math.max(0, Math.min(1, (currentWeight - userGoal) / (((stats.entries?.[0]?.weight||currentWeight)) - userGoal)))) * 100;
          const reached = goal === "bulk" ? currentWeight >= userGoal : currentWeight <= userGoal;

          return (
            <div style={{ background:"rgba(168,85,247,0.07)", border:"1px solid rgba(168,85,247,0.25)", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#a855f7", textTransform:"uppercase", marginBottom:10 }}>
                🎯 Meta de peso
              </div>

              {/* Sugerencia inteligente */}
              <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10, lineHeight:1.6 }}>
                Para tu altura <strong style={{color:"var(--text)"}}>{h}cm</strong> en modo <strong style={{color:gc.color}}>{gc.label}</strong>,
                tu rango recomendado es{" "}
                <strong style={{color:"#a855f7"}}>{idealMin}–{idealMax} kg</strong>.
                {currentWeight < idealMin && goal !== "bulk" && <span style={{color:"#22c55e"}}> ✓ Ya estás dentro del rango.</span>}
              </div>

              {/* Input meta personalizada */}
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:12 }}>
                <div style={{ flex:1 }}>
                  <label style={{ fontSize:11, color:"var(--text-muted)", display:"block", marginBottom:4 }}>
                    Tu meta de peso (kg)
                  </label>
                  <input
                    className="input"
                    type="number" inputMode="decimal"
                    placeholder={String(suggestedGoal)}
                    value={goalWeight}
                    onChange={e => setGoalWeight(e.target.value)}
                    style={{ width:"100%", textAlign:"center", fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800 }}
                  />
                  <div style={{ fontSize:10, color:"var(--text-muted)", textAlign:"center", marginTop:3 }}>
                    Rango válido: 20–300 kg
                  </div>
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
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:800, color:"var(--accent)" }}>
                      {weeksNeeded}sem
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de progreso */}
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
                <div style={{ textAlign:"center", padding:"8px 0", color:"#22c55e", fontWeight:700, fontSize:14 }}>
                  🎉 ¡Alcanzaste tu meta de peso!
                </div>
              )}
            </div>
          );
        })()}

        {/* Chart */}
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
                {/* Grid */}
                {[0,0.25,0.5,0.75,1].map(t => {
                  const y = py(chartMin + t * chartRange);
                  return <g key={t}>
                    <line x1={40} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 4"/>
                    <text x={34} y={y+4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{(chartMin + t*chartRange).toFixed(1)}</text>
                  </g>;
                })}
                {/* Línea de meta de peso (si existe) */}
                {goalW && (
                  <g>
                    <line x1={40} y1={py(goalW)} x2={W} y2={py(goalW)} stroke="#a855f7" strokeWidth={1.5} strokeDasharray="6 3"/>
                    <text x={W+2} y={py(goalW)+4} fill="#a855f7" fontSize={9} fontWeight={700}>Meta</text>
                  </g>
                )}
                {/* Área */}
                <polygon points={[
                  ...entries.map((e,i)=>`${px(i)},${py(e.weight)}`),
                  `${px(entries.length-1)},${H}`,`${px(0)},${H}`
                ].join(" ")} fill="rgba(59,130,246,0.07)"/>
                {/* Línea */}
                <polyline points={entries.map((e,i)=>`${px(i)},${py(e.weight)}`).join(" ")}
                  fill="none" stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
                {/* Puntos */}
                {entries.map((e,i) => {
                  const x = px(i); const y = py(e.weight);
                  const isFirst = i === 0;
                  const isLast = i === entries.length - 1;
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

        {/* History */}
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
                    <button
                      onClick={() => {
                        if (!window.confirm(`¿Eliminar el registro de ${e.weight}kg del ${fmtDate(e.date)}?`)) return;
                        const newEntries = entries.filter((_, j) => j !== realIdx);
                        onSave({ ...stats, entries: newEntries });
                      }}
                      style={{ background:"none", border:"none", color:"#ef4444", cursor:"pointer", fontSize:14, padding:"2px 4px", opacity:0.6, lineHeight:1 }}
                      title="Eliminar registro"
                    >🗑️</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {entries.length===0 && <p style={{ color:"var(--text-muted)", fontSize:13, textAlign:"center" }}>Aún no hay registros de peso.</p>}

        </>)} {/* fin stats tab */}
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
  const [exSeriesCount,setExSeriesCount]=useState("3");
  const filteredDB=exMuscle==="Todos"?EXERCISE_DB:EXERCISE_DB.filter(e=>e.muscle===exMuscle);
  const selectedExName=exName==="__custom__"?exCustomInput:exName;
  const gifSrc=GIF_MAP[selectedExName];
  function handleAdd(){
    if (!selectedExName) return;
    const count=Math.max(1,parseInt(exSeriesCount)||3);
    const sets=Array.from({length:count},()=>({id:uid(),weight:exWeight,reps:exReps}));
    addExToDay(dayKey,isWeekly,exName,exCustomInput,exWeight,exReps,sets);
    setExName("");setExCustomInput("");setExWeight("");setExReps("");setExSeriesCount("3");
  }

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, marginBottom: 8 }}>
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
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Peso kg" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} inputMode="decimal" />
        </div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Reps" value={exReps} onChange={e => setExReps(numDot(e.target.value))} inputMode="decimal" />
        </div>
        <div style={{ flex: 1, minWidth: 60 }}>
          <input className="input" style={{ fontSize: 12, padding: "7px 10px" }} placeholder="Series" value={exSeriesCount} onChange={e => setExSeriesCount(e.target.value)} inputMode="numeric" />
        </div>
      </div>
      <button className="btn-add-ex" style={{ fontSize: 12, padding: "7px" }} onClick={handleAdd}>+ Agregar ejercicio</button>
    </div>
  );
}
// ─── Weekly Planner Modal ─────────────────────────────────────────────────────
function WeeklyPlannerModal({ plan, onSave, onClose, sessions, weeklyGoal, onSaveGoal, initTab }) {
  const [mode, setMode] = useState(plan.mode || "weekly");
  const [plannerTab, setPlannerTab] = useState(initTab === "goal" ? "goal" : "plan");
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
  const workouts = ["Todas", ...new Set(
  sessions.map(s => s.workout).filter(Boolean).map(w => w.trim())
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
)];
  const todayDow = (new Date().getDay() + 6) % 7;

  function addExToDay(dayKey,isWeekly,exNameVal,exCustomVal,exWeightVal,exRepsVal,exSetsVal) {
    const finalName=exNameVal==="__custom__"?exCustomVal:exNameVal;
    if (!finalName) return;
    const sets=exSetsVal&&exSetsVal.length>0?exSetsVal:(exWeightVal||exRepsVal?[{id:uid(),weight:exWeightVal,reps:exRepsVal}]:[]);
    const newEx={id:uid(),name:finalName,sets,weight:exWeightVal,reps:exRepsVal};
    if (isWeekly) setWeekly(w=>({...w,[dayKey]:{...w[dayKey],exercises:[...(w[dayKey]?.exercises||[]),newEx]}}))
    else setCycle(c=>c.map((d,i)=>i!==dayKey?d:{...d,exercises:[...(d.exercises||[]),newEx]}));
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
          <button className={`tab-btn ${plannerTab === "plan" && mode === "weekly" ? "active" : ""}`} onClick={() => { setPlannerTab("plan"); setMode("weekly"); }}>7 días fijos</button>
          <button className={`tab-btn ${plannerTab === "plan" && mode === "cycle" ? "active" : ""}`} onClick={() => { setPlannerTab("plan"); setMode("cycle"); }}>Ciclo Personalizado</button>
          <button className={`tab-btn ${plannerTab === "goal" ? "active" : ""}`} onClick={() => setPlannerTab("goal")}>🎯 Meta</button>
        </div>

        {/* ── Meta Semanal tab ── */}
        {plannerTab === "goal" && (() => {
          const target = weeklyGoal?.target || 4;
          const thisWeek = sessions.filter(s => (new Date() - new Date(s.date+"T00:00:00"))/86400000 <= 7).length;
          const pct = Math.min(thisWeek / target, 1);
          const done = pct >= 1;
          return (
            <div>
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:64, fontWeight:900, color: done?"#22c55e":"var(--accent)", lineHeight:1 }}>
                  {thisWeek}<span style={{ fontSize:32, color:"var(--text-muted)" }}>/{target}</span>
                </div>
                <div style={{ fontSize:13, color:"var(--text-muted)", marginBottom:14 }}>sesiones esta semana</div>
                <div style={{ background:"var(--border)", borderRadius:20, height:12, overflow:"hidden", marginBottom:10, maxWidth:300, margin:"0 auto 10px" }}>
                  <div style={{ height:"100%", background:done?"#22c55e":"var(--accent)", width:`${pct*100}%`, borderRadius:20, transition:"width 0.5s ease" }}/>
                </div>
                {done && <div style={{ color:"#22c55e", fontWeight:700, fontSize:16 }}>🎉 ¡Meta cumplida esta semana!</div>}
              </div>
              <div className="field" style={{ marginBottom:20 }}>
                <label className="field-label">Sesiones por semana (meta)</label>
                <div style={{ display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
                  {[2,3,4,5,6,7].map(n => (
                    <button key={n}
                      onClick={() => onSaveGoal({ target: n })}
                      style={{ width:48, height:48, borderRadius:12, border:"2px solid", borderColor:(weeklyGoal?.target||4)===n?"var(--accent)":"var(--border)", background:(weeklyGoal?.target||4)===n?"var(--accent)":"var(--input-bg)", color:(weeklyGoal?.target||4)===n?"white":"var(--text)", fontFamily:"Barlow Condensed,sans-serif", fontSize:22, fontWeight:800, cursor:"pointer", transition:"all 0.2s" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ padding:"12px 16px", background:"var(--input-bg)", borderRadius:12, fontSize:13, color:"var(--text-muted)", textAlign:"center" }}>
                💡 La semana se cuenta desde hoy hacia los últimos 7 días
              </div>
            </div>
          );
        })()}

        {plannerTab === "plan" && (
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
                    <datalist id={`wk-dl-${i}`}>{workouts.map(n => <option key={n} value={n} />)}{Object.keys(PRESETS).map(n => <option key={n} value={n} />)}</datalist>
                    <button className="btn-ghost small" style={{ whiteSpace: "nowrap", fontSize: 11 }} onClick={() => setExpandedDay(isOpen ? null : `w${i}`)}>
                      {isOpen ? "▲ Cerrar" : `💪 ${(dayData.exercises||[]).length > 0 ? `${(dayData.exercises||[]).length} ej.` : "Ejercicios"}`}
                    </button>
                  </div>
{isOpen && <ExerciseEditor dayKey={i} exercises={dayData.exercises||[]} isWeekly={true} addExToDay={addExToDay} removeExFromDay={removeExFromDay} />}                </div>
              );
            })}
          </div>
        )}

        {plannerTab === "plan" && mode === "cycle" && (
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
                      <datalist id={`cy-dl-${i}`}>{workouts.map(n => <option key={n} value={n} />)}{Object.keys(PRESETS).map(n => <option key={n} value={n} />)}</datalist>
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

        {plannerTab === "plan" && (
          <button className="btn-primary" style={{ width: "100%", marginTop: 16 }} onClick={saveCycle}>💾 Guardar planificador</button>
        )}
      </div>
    </div>
  );
}


// ─── Progress Modal ───────────────────────────────────────────────────────────

// ─── Onboarding ───────────────────────────────────────────────────────────────
function OnboardingModal({ user, onComplete, onSetGoal }) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(4);
  const firstName = user.name?.split(" ")[0] || "atleta";

  const steps = [
    {
      emoji: null,
      title: `¡Hola, ${firstName}! 👋`,
      desc: "Soy Brux, tu asistente de entrenamiento. Te acompaño en cada sesión, te recuerdo qué músculo tienes pendiente y celebro tus logros.",
      content: (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ position: "relative", width: 90, height: 101 }}>
              <svg viewBox="0 0 80 88" width="90" height="99" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="glow-ob"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                  <filter id="neon-ob"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <ellipse cx="40" cy="44" rx="32" ry="36" fill="rgba(59,130,246,0.14)" filter="url(#glow-ob)"/>
                {/* HEAD */}
                <path d="M22 8 L58 8 L60 14 L60 36 L54 42 L26 42 L20 36 L20 14 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="miter"/>
                <path d="M24 8 L56 8 L58 10 L22 10 Z" fill="#3b82f6" opacity="0.9"/>
                <path d="M26 16 L54 16 L56 20 L56 36 L52 39 L28 39 L24 36 L24 20 Z" fill="#111" stroke="rgba(59,130,246,0.6)" strokeWidth="1" strokeLinejoin="miter"/>
                {/* Eyes */}
                <rect x="24" y="21" width="7" height="5" rx="1" fill="#3b82f6"/>
                <rect x="33" y="21" width="7" height="5" rx="1" fill="#3b82f6"/>
                <rect x="25" y="22" width="2" height="2" fill="#0a0a0a"/>
                <rect x="34" y="22" width="2" height="2" fill="#0a0a0a"/>
                <line x1="23" y1="18" x2="31" y2="19.5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="square"/>
                <line x1="41" y1="18" x2="33" y2="19.5" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="square"/>
                {/* Smirk */}
                <path d="M27 31.5 L32 34 L37 31.5" stroke="#3b82f6" strokeWidth="2.2" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
                <line x1="20" y1="32" x2="26" y2="36" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5"/>
                <line x1="60" y1="32" x2="54" y2="36" stroke="#3b82f6" strokeWidth="1.5" opacity="0.5"/>
                {/* NECK */}
                <rect x="33" y="42" width="14" height="7" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.5"/>
                {/* TORSO */}
                <path d="M14 49 L66 49 L62 76 L18 76 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="miter" filter="url(#neon-ob)"/>
                <path d="M18 49 L40 49 L38 62 L20 62 Z" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" strokeWidth="1"/>
                <path d="M62 49 L40 49 L42 62 L60 62 Z" fill="rgba(59,130,246,0.2)" stroke="rgba(59,130,246,0.5)" strokeWidth="1"/>
                <line x1="40" y1="49" x2="40" y2="76" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6"/>
                <line x1="21" y1="62" x2="59" y2="62" stroke="#3b82f6" strokeWidth="1" opacity="0.3"/>
                {/* LEFT ARM */}
                <path d="M14 49 L4 44 L0 34 L6 32 L10 40 L18 47 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="miter"/>
                <path d="M0 34 L-2 22 L4 18 L8 28 L6 32 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="miter"/>
                <rect x="-6" y="11" width="18" height="6" rx="0" fill="#3b82f6" filter="url(#glow-ob)"/>
                <rect x="-8" y="7" width="6" height="14" rx="0" fill="#3b82f6"/>
                <rect x="8" y="7" width="6" height="14" rx="0" fill="#3b82f6"/>
                {/* RIGHT ARM */}
                <path d="M66 49 L76 44 L80 34 L74 32 L70 40 L62 47 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="miter"/>
                <path d="M80 34 L82 22 L76 18 L72 28 L74 32 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="miter"/>
                <rect x="68" y="11" width="18" height="6" rx="0" fill="#3b82f6" filter="url(#glow-ob)"/>
                <rect x="66" y="7" width="6" height="14" rx="0" fill="#3b82f6"/>
                <rect x="80" y="7" width="6" height="14" rx="0" fill="#3b82f6"/>
                {/* LEGS */}
                <path d="M18 76 L28 76 L26 88 L16 88 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="miter"/>
                <path d="M52 76 L62 76 L64 88 L54 88 Z" fill="#0a0a0a" stroke="#3b82f6" strokeWidth="1.8" strokeLinejoin="miter"/>
                <rect x="14" y="86" width="14" height="4" fill="#3b82f6" opacity="0.9"/>
                <rect x="52" y="86" width="14" height="4" fill="#3b82f6" opacity="0.9"/>
              </svg>
            </div>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            {[
              { icon:"🏋️", label:"Registra entrenamientos" },
              { icon:"📈", label:"Sigue tu progreso" },
              { icon:"🏆", label:"Rompe récords personales" },
              { icon:"👥", label:"Compite con amigos" },
            ].map(f => (
              <div key={f.label} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                <div style={{ fontSize:22, marginBottom:5 }}>{f.icon}</div>
                <div style={{ fontSize:12, fontWeight:600, color:"var(--text)" }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      emoji: "🎯",
      title: "¿Cuántos días por semana vas a entrenar?",
      desc: "Te recordaré tu meta cada semana y celebraré cuando la cumplas. Ser honesto ayuda: empezar con poco y cumplir es mejor que prometer mucho.",
      content: (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {[2, 3, 4, 5, 6].map(n => {
              const labels = { 2:"Principiante", 3:"Regular", 4:"Dedicado", 5:"Serio", 6:"Beast" };
              const colors = { 2:"#22c55e", 3:"#3b82f6", 4:"#f59e0b", 5:"#f97316", 6:"#ef4444" };
              const sel = selectedGoal === n;
              return (
                <button key={n} onClick={() => { setSelectedGoal(n); onSetGoal && onSetGoal({ target: n }); }}
                  style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, width:70, padding:"12px 8px", borderRadius:14, border:"2px solid", borderColor: sel ? colors[n] : "var(--border)", background: sel ? `${colors[n]}18` : "var(--input-bg)", cursor:"pointer", transition:"all 0.2s" }}>
                  <span style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:32, fontWeight:900, color: sel ? colors[n] : "var(--text-muted)", lineHeight:1 }}>{n}</span>
                  <span style={{ fontSize:9, fontWeight:700, color: sel ? colors[n] : "var(--text-muted)", letterSpacing:0.5 }}>{labels[n]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 16px", textAlign:"center", fontSize:13, color:"var(--text-muted)" }}>
            {selectedGoal <= 2 && "💡 Perfecto para comenzar. La consistencia es lo que importa."}
            {selectedGoal === 3 && "💡 3 días es ideal para recuperarse bien y progresar."}
            {selectedGoal === 4 && "💡 El clásico. 4 días es el punto ideal para la mayoría."}
            {selectedGoal === 5 && "💡 ¡Ambicioso! Recuerda descansar bien entre sesiones."}
            {selectedGoal >= 6 && "💡 ¡Nivel beast! Asegúrate de alternar grupos musculares."}
          </div>
        </div>
      ),
    },
    {
      emoji: "🔥",
      title: "La racha: tu motivación semanal",
      desc: "La racha cuenta semanas consecutivas en las que cumpliste tu meta de días. No importa si un día descansas, lo que importa es la semana completa.",
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
            {[
              { weeks: 1, label:"Primera semana", color:"#22c55e" },
              { weeks: 4, label:"Un mes seguido", color:"#3b82f6" },
              { weeks: 12, label:"Tres meses", color:"#f59e0b" },
            ].map(m => (
              <div key={m.weeks} style={{ background:`${m.color}10`, border:`1px solid ${m.color}30`, borderRadius:12, padding:"14px 8px", textAlign:"center" }}>
                <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:30, fontWeight:900, color:m.color, lineHeight:1 }}>{m.weeks}</div>
                <div style={{ fontSize:9, fontWeight:700, color:m.color, marginBottom:4 }}>sem</div>
                <div style={{ fontSize:10, color:"var(--text-muted)", lineHeight:1.4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>✅</span>
              <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5 }}>Si cumples tu meta esta semana, la racha sube al terminar el domingo.</div>
            </div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>🔥</span>
              <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5 }}>El botón 🔥 en la parte superior te lleva directo al calendario de entrenamientos.</div>
            </div>
            <div style={{ display:"flex", alignItems:"flex-start", gap:10, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 12px" }}>
              <span style={{ fontSize:16, flexShrink:0 }}>💡</span>
              <div style={{ fontSize:12, color:"var(--text-muted)", lineHeight:1.5 }}>Puedes cambiar tu meta de días cuando quieras desde el botón 🎯 del Dashboard.</div>
            </div>
          </div>
        </div>
      ),
    },
    {
      emoji: "📝",
      title: "¿Cómo registrar una sesión?",
      desc: "Tienes dos modos según si quieres registrar mientras entrenas o después.",
      content: (
        <div style={{ marginTop:16 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            <div style={{ background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.25)", borderRadius:12, padding:14 }}>
              <div style={{ fontSize:22, marginBottom:6 }}>⚡</div>
              <div style={{ fontWeight:700, fontSize:13, color:"var(--accent)", marginBottom:4 }}>En vivo</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.6 }}>Timer de descanso automático, marca cada serie mientras entrenas.</div>
            </div>
            <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:12, padding:14 }}>
              <div style={{ fontSize:22, marginBottom:6 }}>📝</div>
              <div style={{ fontWeight:700, fontSize:13, color:"#22c55e", marginBottom:4 }}>Registrar</div>
              <div style={{ fontSize:11, color:"var(--text-muted)", lineHeight:1.6 }}>Completa los datos después de entrenar con calma.</div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="overlay" style={{ zIndex:9999, background:"rgba(0,0,0,0.85)" }}>
      <div className="modal" style={{ maxWidth:440, padding:28 }} onClick={e=>e.stopPropagation()}>
        {/* Progress dots */}
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:24 }}>
          {steps.map((_,i) => (
            <div key={i} style={{ width: i===step?24:8, height:8, borderRadius:10, background: i===step?"var(--accent)":i<step?"rgba(59,130,246,0.4)":"var(--border)", transition:"all 0.3s" }}/>
          ))}
        </div>

        {/* Content */}
        <div style={{ textAlign:"center", marginBottom:4 }}>
          {current.emoji && <div style={{ fontSize:48, marginBottom:12 }}>{current.emoji}</div>}
          <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:24, fontWeight:900, marginBottom:8 }}>{current.title}</div>
          <div style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.6 }}>{current.desc}</div>
        </div>

        {current.content}

        {/* Navigation */}
        <div style={{ display:"flex", gap:10, marginTop:24 }}>
          {step > 0 && (
            <button onClick={() => setStep(s=>s-1)} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1px solid var(--border)", background:"transparent", color:"var(--text-muted)", fontWeight:700, fontSize:14, cursor:"pointer" }}>
              ← Atrás
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStep(s=>s+1)}
            style={{ flex:2, padding:"12px 0", borderRadius:10, border:"none", background:"var(--accent)", color:"#0a0a0a", fontWeight:800, fontSize:15, cursor:"pointer" }}>
            {isLast ? "¡Comenzar a entrenar! 💪" : "Siguiente →"}
          </button>
        </div>

        {!isLast && (
          <button onClick={onComplete} style={{ display:"block", width:"100%", marginTop:10, background:"none", border:"none", color:"var(--text-muted)", fontSize:12, cursor:"pointer", padding:4 }}>
            Omitir
          </button>
        )}
      </div>
    </div>
  );
}

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

function ProgressModal({ exName, sessions, onClose, onBack }) {
  const [tab, setTab] = useState("progress"); // progress | prediction
  const [view, setView] = useState("weight"); // weight | rm1 | reps | volume
  const history = [];
  sessions.forEach(s => (s.exercises || []).forEach(ex => {
    if (ex.name.toLowerCase() === exName.toLowerCase()) {
      const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
      const weight = Math.max(...sets.map(st => parseFloat(st.weight) || 0));
      const reps = Math.max(...sets.map(st => parseFloat(st.reps) || 0));
      const vol = sets.reduce((s,st) => s + (parseFloat(st.weight)||0)*(parseFloat(st.reps)||1), 0);
      const rm = calc1RM(weight, reps);
      history.push({ date: s.date, weight, reps, vol: Math.round(vol), rm });
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

  // Trend
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

        {/* Tab selector */}
        <div style={{ display:"flex", gap:0, marginBottom:16, background:"var(--input-bg)", borderRadius:10, padding:3 }}>
          {[["progress","📈 Progreso"],["sesiones","📋 Sesiones"],["prediction","🎯 Predicción"]].map(([k,l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: tab===k?"var(--accent)":"transparent", color: tab===k?"white":"var(--text-muted)", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>{l}</button>
          ))}
        </div>

        {tab === "sesiones" && <ExerciseSessionsTab exName={exName} sessions={sessions} />}

        {tab !== "sesiones" && history.length < 2 && (
          <p className="text-muted" style={{ fontSize:14 }}>Necesitas al menos 2 registros para ver el progreso.</p>
        )}
        {tab !== "sesiones" && history.length >= 2 && tab === "progress" && (<>
          {/* PR banner */}
          {prEntry && (
            <div style={{ background:"linear-gradient(135deg,rgba(251,191,36,0.15),rgba(251,191,36,0.04))", border:"1px solid rgba(251,191,36,0.4)", borderRadius:12, padding:"12px 16px", marginBottom:16, display:"flex", gap:14, alignItems:"center" }}>
              <span style={{ fontSize:28 }}>🏆</span>
              <div>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase" }}>Récord Personal</div>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:900 }}>
                  {prEntry.weight}kg × {prEntry.reps} reps
                  <span style={{ fontSize:14, color:"#f59e0b", marginLeft:10 }}>1RM ≈ {prEntry.rm}kg</span>
                </div>
                <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>{fmtDate(prEntry.date)} {trend && <span style={{ marginLeft:10 }}>{trend}</span>}</div>
              </div>
            </div>
          )}

          {/* View selector */}
          <div style={{ display:"flex", gap:6, marginBottom:14, flexWrap:"wrap" }}>
            {Object.entries(viewLabels).map(([k,l]) => (
              <button key={k} onClick={() => setView(k)} style={{
                padding:"5px 12px", borderRadius:20, border:`1px solid ${view===k?"var(--accent)":"var(--border)"}`,
                background: view===k?"var(--accent-dim)":"transparent", color: view===k?"var(--accent)":"var(--text-muted)",
                fontSize:12, fontWeight:700, cursor:"pointer"
              }}>{l}</button>
            ))}
          </div>

          {/* Gráfica */}
          <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"12px 8px 6px", marginBottom:14 }}>
            <svg width="100%" viewBox={`0 0 ${W+8} ${H+36}`} style={{ display:"block" }}>
              {[0,0.25,0.5,0.75,1].map(t => {
                const y = py(minV + t*rangeV);
                return <g key={t}>
                  <line x1={40} y1={y} x2={W} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="4 3"/>
                  <text x={34} y={y+4} textAnchor="end" fill="var(--text-muted)" fontSize={9}>{(minV+t*rangeV).toFixed(0)}</text>
                </g>;
              })}
              {/* Área */}
              <polygon points={[
                ...history.map((_,i)=>`${px(i)},${py(vals[i])}`),
                `${px(history.length-1)},${H+4}`, `${px(0)},${H+4}`
              ].join(" ")} fill={view==="rm1"?"rgba(245,158,11,0.08)":"rgba(59,130,246,0.07)"}/>
              {/* Línea */}
              <polyline
                points={history.map((_,i)=>`${px(i)},${py(vals[i])}`).join(" ")}
                fill="none" stroke={view==="rm1"?"#f59e0b":"var(--accent)"}
                strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              />
              {/* Puntos */}
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
            </svg>
          </div>

          {/* Stats rápidas */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:14 }}>
            {[
              ["Máx peso", `${Math.max(...history.map(h=>h.weight))}kg`, "var(--accent)"],
              ["Mejor 1RM", `${Math.max(...history.map(h=>h.rm))}kg`, "#f59e0b"],
              ["Registros", history.length, "var(--text)"],
              ["Mejora total", (() => { const f=vals[0],l=vals[vals.length-1]; const p=Math.round((l-f)/f*100); return `${p>0?"+":""}${p}%`; })(), vals[vals.length-1]>=vals[0]?"#22c55e":"#f97316"],
            ].map(([label,val,color]) => (
              <div key={label} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:18, fontWeight:800, color }}>{val}</div>
                <div style={{ fontSize:10, color:"var(--text-muted)", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Historial tabla */}
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
                  {improved && <span style={{ fontSize:10, color:"#22c55e", marginLeft:8 }}>↑</span>}
                  {h===prEntry && <span style={{ fontSize:10, background:"rgba(245,158,11,0.15)", color:"#f59e0b", borderRadius:4, padding:"1px 5px", marginLeft:6, fontWeight:800 }}>PR</span>}
                </div>
              );
            })}
          </div>
        </>)}
        {tab !== "sesiones" && history.length >= 2 && tab === "prediction" && (() => {
          // Predicción tab
          const points = history;
          const t0 = new Date(points[0].date+"T00:00:00").getTime();
          const xs = points.map(p => (new Date(p.date+"T00:00:00").getTime()-t0)/86400000);
          const ys = points.map(p => p.rm);
          const n = xs.length;
          const sumX=xs.reduce((a,b)=>a+b,0), sumY=ys.reduce((a,b)=>a+b,0);
          const sumXY=xs.reduce((s,x,i)=>s+x*ys[i],0), sumX2=xs.reduce((s,x)=>s+x*x,0);
          const slope=(n*sumXY-sumX*sumY)/(n*sumX2-sumX*sumX);
          const intercept=(sumY-slope*sumX)/n;
          const currentRM=Math.round(points[points.length-1].rm);
          const weeklyGain=Math.round(slope*7*10)/10;
          const lastX=xs[xs.length-1];
          let targets=[];
          if (slope>0) {
            const step=currentRM<60?5:10;
            targets=[1,2,3,4,5,6].map(i=>Math.round((currentRM+i*step)/step)*step).filter(t=>t>currentRM).slice(0,3).map(target=>{
              const daysNeeded=(target-intercept)/slope-lastX;
              const weeksNeeded=Math.ceil(daysNeeded/7);
              const eta=new Date(); eta.setDate(eta.getDate()+Math.round(daysNeeded));
              return { target, weeks:weeksNeeded, eta:eta.toLocaleDateString("es-CL",{month:"short",year:"numeric"}) };
            });
          }
          return (<>
            <div style={{ display:"flex", gap:12, marginBottom:16 }}>
              <div style={{ flex:1, background:"var(--input-bg)", borderRadius:10, padding:"12px 14px", border:"1px solid var(--border)" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase" }}>1RM actual</div>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:30, fontWeight:800, color:"var(--accent)" }}>{currentRM} kg</div>
              </div>
              <div style={{ flex:1, background:"var(--input-bg)", borderRadius:10, padding:"12px 14px", border:"1px solid var(--border)" }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:1, color:"var(--text-muted)", textTransform:"uppercase" }}>Ganancia/semana</div>
                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:30, fontWeight:800, color:weeklyGain>0?"#22c55e":"#f87171" }}>
                  {weeklyGain>0?"+":""}{weeklyGain} kg
                </div>
              </div>
            </div>
            {targets.length>0 ? (
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
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800, color:"var(--accent)" }}>
                      {t.weeks<=0?"¡Ya!":`${t.weeks} sem.`}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize:13, color:"#f87171", textAlign:"center", padding:"16px 0" }}>
                📉 Progreso estancado o descendente. ¡Sube la intensidad!
              </div>
            )}
          </>);
        })()}
      </div>
    </div>
  );
}

// ─── Plans Modal ──────────────────────────────────────────────────────────────

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
<ExerciseGif exName={ex.name} size={44} />
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



// ─── Progress Widget (Dashboard) ─────────────────────────────────────────────
function ProgressPrediction({ sessions }) {
  const [selected, setSelected] = useState("");
  const [view, setView] = useState("rm1"); // rm1 | weight | reps | volume

  // Build per-exercise history
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

  // PR & trend
  const prEntry  = history.length > 0 ? history.reduce((b,h) => h.rm > b.rm ? h : b, history[0]) : null;
  const last     = history[history.length - 1];
  const first    = history[0];
  const improved = last && first && last.rm > first.rm;
  const pct      = first?.rm > 0 ? Math.round((last.rm - first.rm) / first.rm * 100) : 0;

  // Trend line slope
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

  // SVG chart
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
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 }}>
        <div className="card-label" style={{ margin:0 }}>📊 Progreso por ejercicio</div>
        <select className="input" style={{ width:"auto", fontSize:12, padding:"5px 10px" }}
          value={ex} onChange={e => setSelected(e.target.value)}>
          {validExercises.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* View toggle */}
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

      {/* Chart */}
      {history.length >= 2 ? (
        <div style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"8px 4px 2px", marginBottom:12 }}>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display:"block" }}>
            {/* Grid lines */}
            {[0, 0.5, 1].map(t => {
              const y = py(minV + t * rangeV);
              return <g key={t}>
                <line x1={padL} y1={y} x2={W-padR} y2={y} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3"/>
                <text x={padL-4} y={y+3} textAnchor="end" fill="var(--text-muted)" fontSize={8}>{Math.round(minV+t*rangeV)}</text>
              </g>;
            })}
            {/* Area fill */}
            <polygon
              points={`${px(0)},${py(minV)} ${points} ${px(history.length-1)},${py(minV)}`}
              fill={color} fillOpacity={0.08}
            />
            {/* Line */}
            <polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            {/* Dots + labels */}
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
                {/* Date label — only first, last, and every ~3 */}
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

      {/* Stats row */}
      {history.length >= 2 && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:8, marginBottom:10 }}>
          {[
            { label:"1RM actual",  val:`${last?.rm}kg`,   color:"var(--accent)" },
            { label:"Mejor 1RM",   val:`${prEntry?.rm}kg`, color:"#f59e0b" },
            { label:"Registros",   val:history.length,    color:"var(--text)" },
            { label:"Mejora total",val:`${pct>0?"+":""}${pct}%`, color:improved?"#22c55e":"#f87171" },
          ].map(s => (
            <div key={s.label} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10, padding:"8px 6px", textAlign:"center" }}>
              <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:16, fontWeight:800, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:9, color:"var(--text-muted)", marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Trend + PR date */}
      {trend && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", fontSize:11 }}>
          <span style={{ color:trend.color, fontWeight:700 }}>{trend.label}</span>
          {prEntry && <span style={{ color:"var(--text-muted)" }}>🏆 PR el {fmtDate(prEntry.date)}</span>}
        </div>
      )}
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

// ─── Retos semanales rotativos ─────────────────────────────────────────────────
const WEEKLY_CHALLENGES = [
  { id:"vol10", emoji:"🏋️", title:"10,000 kg de volumen", desc:"Levanta un total de 10,000 kg esta semana", check:(sessions, weekStart) => {
    return Math.round(sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
      const sets=ex.sets?.length>0?ex.sets:[{weight:ex.weight,reps:ex.reps}];
      return a+sets.reduce((sv,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sv,0);
    },0),0));
  }, target:10000, unit:"kg", format: v => `${v.toLocaleString()} / 10,000 kg` },
  { id:"ses5", emoji:"📅", title:"5 sesiones esta semana", desc:"Entrena 5 días distintos esta semana", check:(sessions, weekStart) =>
    sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).length,
    target:5, unit:"sesiones", format: v => `${v} / 5 sesiones` },
  { id:"mus4", emoji:"💪", title:"4 grupos musculares", desc:"Entrena al menos 4 grupos musculares distintos", check:(sessions, weekStart) => {
    const muscles = new Set();
    sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).forEach(s=>(s.exercises||[]).forEach(ex=>{
      const db=EXERCISE_DB.find(e=>e.name===ex.name); if(db) muscles.add(db.muscle);
    }));
    return muscles.size;
  }, target:4, unit:"grupos", format: v => `${v} / 4 grupos musculares` },
  { id:"sets30", emoji:"🔢", title:"30 series completadas", desc:"Completa un total de 30 series esta semana", check:(sessions, weekStart) =>
    sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>a+(ex.sets?.length||1),0),0),
    target:30, unit:"series", format: v => `${v} / 30 series` },
  { id:"streak3", emoji:"🔥", title:"3 días seguidos", desc:"Entrena 3 días consecutivos esta semana", check:(sessions, weekStart) => {
    const days = new Set(sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart).map(s=>s.date));
    let best=0, cur=0;
    for(let i=0;i<7;i++){
      const d=new Date(weekStart); d.setDate(d.getDate()+i);
      const ds=d.toISOString().slice(0,10);
      if(days.has(ds)){cur++;best=Math.max(best,cur);}else cur=0;
    }
    return best;
  }, target:3, unit:"días", format: v => `${v} / 3 días seguidos` },
  { id:"pr2", emoji:"🏆", title:"2 récords personales", desc:"Supera 2 récords personales esta semana", check:(sessions, weekStart) => {
    const weekSess = sessions.filter(s=>new Date(s.date+"T00:00:00")>=weekStart);
    const prSet = new Set();
    weekSess.forEach(s=>{
      const sTs = new Date(s.date+"T00:00:00").getTime();
      (s.exercises||[]).forEach(ex=>{
        const w=ex.sets?.length>0?Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(ex.weight)||0;
        const prev=sessions
          .filter(ps => new Date(ps.date+"T00:00:00").getTime() < sTs)
          .flatMap(ps=>(ps.exercises||[]).filter(pe=>pe.name===ex.name))
          .reduce((b,pe)=>{
            const pw=pe.sets?.length>0?Math.max(...pe.sets.map(st=>parseFloat(st.weight)||0)):parseFloat(pe.weight)||0;
            return Math.max(b,pw);
          },0);
        if(w>prev&&w>0) prSet.add(s.id+"__"+ex.name);
      });
    });
    return prSet.size;
  }, target:2, unit:"PRs", format: v => `${v} / 2 récords` },
];

function getWeeklyChallenge() {
  // Rota cada semana basado en número de semana del año
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const weekNum = Math.floor((now - startOfYear) / (7 * 86400000));
  return WEEKLY_CHALLENGES[weekNum % WEEKLY_CHALLENGES.length];
}

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

            {/* Reto de la semana */}
            {(() => {
              const challenge = getWeeklyChallenge();
              const weekStart2 = new Date(); weekStart2.setDate(weekStart2.getDate()-7); weekStart2.setHours(0,0,0,0);
              const progress = challenge.check(sessions, weekStart2);
              const pct = Math.min(progress / challenge.target * 100, 100);
              const done = progress >= challenge.target;
              return (
                <div style={{ background: done?"rgba(34,197,94,0.08)":"rgba(59,130,246,0.06)", border:`1px solid ${done?"rgba(34,197,94,0.3)":"rgba(59,130,246,0.2)"}`, borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color: done?"#22c55e":"var(--accent)", textTransform:"uppercase", marginBottom:6 }}>
                    {done?"✅":"⚔️"} Reto de la semana
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                    <div>
                      <div style={{ fontWeight:700, fontSize:15 }}>{challenge.emoji} {challenge.title}</div>
                      <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>{challenge.desc}</div>
                    </div>
                    <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:22, fontWeight:900, color: done?"#22c55e":"var(--accent)", marginLeft:12, flexShrink:0 }}>{Math.round(pct)}%</div>
                  </div>
                  <div style={{ background:"var(--border)", borderRadius:20, height:7, overflow:"hidden" }}>
                    <div style={{ height:"100%", background: done?"#22c55e":"var(--accent)", width:`${pct}%`, borderRadius:20, transition:"width 0.6s ease" }}/>
                  </div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:5, textAlign:"right" }}>{challenge.format(progress)}</div>
                </div>
              );
            })()}

            {/* My week snapshot — centrado */}
            <div style={{ background:"rgba(59,130,246,0.07)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:12, padding:"16px", marginBottom:16, textAlign:"center" }}>
              <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--accent)", textTransform:"uppercase", marginBottom:12 }}>Tu semana actual</div>
              <div style={{ display:"flex", justifyContent:"center", gap:24 }}>
                <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900 }}>{myWeekSessions}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>sesiones</div></div>
                <div style={{ width:1, background:"var(--border)" }}/>
                <div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900 }}>{myWeekVol}t</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>volumen</div></div>
                {myRank > 0 && <><div style={{ width:1, background:"var(--border)" }}/><div><div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:32, fontWeight:900, color:"#f59e0b" }}>#{myRank}</div><div style={{ fontSize:11, color:"var(--text-muted)" }}>ranking</div></div></>}
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
        setCopied(true); const _ct = setTimeout(()=>setCopied(false), 2000); return () => clearTimeout(_ct);
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
  const [activateError, setActivateError] = useState("");
  const [routines, setRoutines] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteData, setAthleteData] = useState(null);
  const [athleteLoading, setAthleteLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
const [athleteRoutinesMap, setAthleteRoutinesMap] = useState({});
  const [athleteQuickStats, setAthleteQuickStats] = useState({});

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
      const quickStats = {};
      await Promise.all(athletesList.map(async (a) => {
        const [routinesSnap, data] = await Promise.all([
          getDocs(collection(db, "athlete_routines", a.uid, "routines")).catch(() => ({ docs: [] })),
          getAthleteData(a.uid),
        ]);
        map[a.uid] = routinesSnap.docs.map(d => d.data());

        // Calcular stats rápidas
        const allSessions = data.sessions || [];
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); weekAgo.setHours(0,0,0,0);
        const sessionsThisWeek = allSessions.filter(s => new Date(s.date + "T00:00:00") >= weekAgo).length;
        const lastSession = allSessions.sort((a,b) => b.date.localeCompare(a.date))[0];
        const daysSinceLast = lastSession
          ? Math.round((now - new Date(lastSession.date + "T00:00:00")) / 86400000)
          : null;
        const bodyEntries = data.bodyStats?.entries || [];
        const lastWeight = bodyEntries.length > 0
          ? bodyEntries[bodyEntries.length - 1].weight
          : null;

        quickStats[a.uid] = { sessionsThisWeek, daysSinceLast, lastWeight, totalSessions: allSessions.length, lastWorkout: lastSession?.workout };
      }));
      setAthleteRoutinesMap(map);
      setAthleteQuickStats(quickStats);
    }
    setLoading(false);
  }

  async function activateCoach() {
  if (!user.isAdmin) {
    setActivateError("❌ Solo administradores pueden activar el modo Coach.");
    return;
  }
  setActivateError("");
  setActivating(true);
  const profile = await createCoachProfile(user.uid, user.name, user.email);
  setCoachProfile(profile);
  setActivating(false);
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
      saveCustomExercise(finalName, rExCustomMuscle);
      registerCustomExercise(finalName, rExCustomMuscle);
    }
    const sets = rExSets.length > 0 ? rExSets : (rExWeight || rExReps ? [{ id: uid(), weight: rExWeight, reps: rExReps }] : []);
    setRoutineExercises(p => [...p, { id: uid(), name: finalName, sets, weight: rExWeight, reps: rExReps, comment: rExComment }]);
    setRExName(""); setRExCustom(""); setRExCustomMuscle(""); setRExWeight(""); setRExReps(""); setRExSets([]); setRExComment("");
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
    if (!user.isGuest && auth.currentUser && !auth.currentUser.emailVerified) {
      setAddAthleteMsg("⚠️ Verifica tu email para usar funciones de coach. Revisa tu bandeja de entrada.");
      return;
    }
    if (athletes.some(a=>a.email?.toLowerCase()===addAthleteEmail.trim().toLowerCase())){setAddAthleteMsg("⚠️ Este atleta ya está en tu lista");return;}
    const result=await assignRoutineToAthlete(user.uid,addAthleteEmail.trim(),"","");
    if (result.ok){setAddAthleteMsg("✅ Atleta agregado");setAddAthleteEmail("");const p=await getCoachProfile(user.uid);setCoachProfile(p);}
    else setAddAthleteMsg(`❌ ${result.msg}`);
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
    setCodeCopied(true); const _cct = setTimeout(() => setCodeCopied(false), 2000); return () => clearTimeout(_cct);
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
            <div className="tab-row" style={{ marginBottom: 20 }}>
              {[["dashboard","📊 Dashboard"],["routines","📋 Rutinas"],["athletes","👥 Atletas"]].map(([id, label]) => (
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
                          { icon: "📅", label: "Esta semana", value: `${qs.sessionsThisWeek} sesiones`, color: qs.sessionsThisWeek === 0 ? "#ef4444" : qs.sessionsThisWeek >= 3 ? "#22c55e" : "var(--text)" },
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
                          <span key={r.routineId} style={{ display:"inline-flex", alignItems:"center", gap:4, marginLeft: 8,
                            background:"var(--card)", border:"1px solid var(--border)", borderRadius:6, padding:"2px 6px 2px 8px" }}>
                            <span style={{ color: "var(--accent)", fontSize:11, fontWeight:700 }}>
                              {r.routineName}{r.dayOfWeek >= 0 ? ` · ${DAYS_ES[r.dayOfWeek]}` : ""}
                            </span>
                            <button onClick={async () => {
                              if (!window.confirm(`¿Quitar "${r.routineName}" de ${a.name}?`)) return;
                              await unassignRoutineFromAthlete(a.uid, r.routineId);
                              const updated = await Promise.all(athletes.map(async at => {
                                const rts = await getDocs(collection(db, "athlete_routines", at.uid, "routines"));
                                return [at.uid, rts.docs.map(d => ({...d.data(), _docId: d.id}))];
                              }));
                              setAthleteRoutinesMap(Object.fromEntries(updated));
                            }} style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer",
                              fontSize:12, padding:"0 2px", lineHeight:1 }}>✕</button>
                          </span>
                        ))}
                      </div>
                      {veryInactive && <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 700 }}>🚨 Sin entrenar {qs.daysSinceLast} días</span>}
                      {inactive && !veryInactive && <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>⚠️ Inactivo esta semana</span>}
                    </div>
                  </div>
                );})}
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
                      <input className="input" style={{ fontSize: 13 }} placeholder="Peso kg" value={rExWeight} onChange={e => setRExWeight(numDot(e.target.value))} inputMode="decimal" />
                    </div>
                    <div className="field">
                      <input className="input" style={{ fontSize: 13 }} placeholder="Reps" value={rExReps} onChange={e => setRExReps(numDot(e.target.value))} inputMode="decimal" />
                    </div>
                    <button className="btn-ghost small" onClick={addRSet}>+ Serie</button>
                  </div>
                  {rExSets.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, marginBottom: 8 }}>
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
  const [restTimer, setRestTimer] = useState(null); // null | { total, left }
  const [exData, setExData] = useState(
    (routine.exercises || []).map(ex => ({
      ...ex,
      restSecs: ex.restSecs || null,
      sets: ex.sets?.length
        ? ex.sets.map(s => ({ ...s, id: s.id || uid(), done: false }))
        : Array.from({ length: parseInt(ex.series) || 3 }, () => ({ id: uid(), weight: ex.weight || "", reps: ex.reps || "", done: false }))
    }))
  );
  const mainRef = useRef();
  const restRef = useRef();

  useEffect(() => {
    if (running) { mainRef.current = setInterval(() => setElapsed(e => e + 1), 1000); }
    else clearInterval(mainRef.current);
    return () => clearInterval(mainRef.current);
  }, [running]);

  useEffect(() => {
    if (restTimer && restTimer.left > 0) {
      restRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (!prev || prev.left <= 1) {
            clearInterval(restRef.current);
            // Sonido
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              [0, 0.2, 0.4].forEach((t, i) => {
                const osc = ctx.createOscillator(), gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.frequency.value = i === 2 ? 880 : 660; osc.type = "sine";
                gain.gain.setValueAtTime(0.35, ctx.currentTime + t);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
                osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + 0.18);
              });
            } catch(e) {}
            // Vibración
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e) {}
            // Notificación
            try {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("¡Tiempo de descanso terminado! 💪", {
                  body: "Listo para la siguiente serie.",
                  tag: "rest-timer", renotify: true,
                });
              }
            } catch(e) {}
            return null;
          }
          return { ...prev, left: prev.left - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer?.total]);

  const fmt = s => `${Math.floor(s/60).toString().padStart(2,"0")}:${(s%60).toString().padStart(2,"0")}`;
  const totalSets = exData.reduce((a, e) => a + e.sets.length, 0);
  const doneSets = exData.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
  const ex = exData[currentEx];

  function toggleSet(exIdx, setIdx) {
    const wasDone = exData[exIdx]?.sets[setIdx]?.done;
    setExData(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, done: !s.done })
    }));
    if (!wasDone) {
      // Auto-lanzar timer de descanso al completar serie
      const exRestSecs = exData[exIdx]?.restSecs ?? defaultRest;
      setRestTimer(prev => prev ? prev : null);
      setTimeout(() => startRest(exRestSecs), 50);
      // Pedir permiso notificación
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }

  function updateSet(exIdx, setIdx, field, val) {
    setExData(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: e.sets.map((s, j) => j !== setIdx ? s : { ...s, [field]: val })
    }));
  }

  function addSet(exIdx) {
    setExData(prev => prev.map((e, i) => i !== exIdx ? e : {
      ...e, sets: [...e.sets, { id: uid(), weight: e.sets[e.sets.length-1]?.weight || "", reps: e.sets[e.sets.length-1]?.reps || "", done: false }]
    }));
  }

  function removeSet(exIdx) {
    setExData(prev => prev.map((e, i) => i !== exIdx || e.sets.length <= 1 ? e : {
      ...e, sets: e.sets.slice(0, -1)
    }));
  }

  function startRest(secs) {
    clearInterval(restRef.current);
    setRestTimer({ total: secs, left: secs });
  }

  const defaultRest = load("gym_default_rest", 90);

  const REST_OPTS = [
    { label: "1M", secs: 60 },
    { label: "1.5M", secs: 90 },
    { label: "2M", secs: 120 },
    { label: "3M", secs: 180 },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", zIndex: 3000, display: "flex", flexDirection: "column", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ background: "var(--sidebar-bg)", borderBottom: "1px solid var(--border)", padding: "12px 20px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
        <button onClick={() => {
          const hasDone = exData.some(ex => ex.sets.some(s => s.done));
          if (hasDone) {
            if (!window.confirm("¿Salir del entrenamiento? Perderás el progreso no guardado.")) return;
          }
          onClose();
        }} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12, display:"flex", alignItems:"center", gap:4, fontWeight: 600 }}>← Salir</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 800 }}>⚡ {routine.name}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{doneSets}/{totalSets} series completadas</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 32, fontWeight: 800, color: "var(--accent)" }}>{fmt(elapsed)}</div>
          <button onClick={() => setRunning(r => !r)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 11, cursor: "pointer" }}>{running ? "⏸" : "▶"}</button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 4, background: "var(--border)", flexShrink: 0 }}>
        <div style={{ height: "100%", background: "var(--accent)", width: `${totalSets > 0 ? (doneSets/totalSets)*100 : 0}%`, transition: "width 0.4s" }} />
      </div>

      {/* Exercise tabs */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", overflowX: "auto", flexShrink: 0 }}>
        {exData.map((e, i) => {
          const done = e.sets.every(s => s.done) && e.sets.length > 0;
          return (
            <button key={i} onClick={() => setCurrentEx(i)} style={{
              background: currentEx === i ? "var(--accent)" : done ? "rgba(232,255,0,0.08)" : "var(--card)",
              border: `1px solid ${currentEx === i ? "var(--accent)" : done ? "rgba(232,255,0,0.3)" : "var(--border)"}`,
              color: currentEx === i ? "#0a0a0a" : done ? "var(--accent)" : "var(--text-muted)",
              borderRadius: 4, padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 900, whiteSpace: "nowrap", flexShrink: 0, letterSpacing: 1, textTransform: "uppercase", fontFamily: "'Barlow Condensed', sans-serif"
            }}>
              {done ? "✓ " : ""}{e.name}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 100px" }}>
        {ex && (
          <div style={{ maxWidth: 600, margin: "0 auto" }}>

            {/* GIF + nombre */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
              <div style={{ background: "var(--card)", borderRadius: 8, padding: 4, border: "1px solid var(--border)" }}>
                <ExerciseGif exName={ex.name} size={112} style={{ display:"block", borderRadius:6 }} />
              </div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 28, fontWeight: 900, marginTop: 10, textAlign: "center", color: "var(--text)", letterSpacing: 1, textTransform: "uppercase" }}>{ex.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{doneSets}/{totalSets} series · {ex.sets.filter(s=>s.done).length}/{ex.sets.length} de este ejercicio</div>
              {ex.comment && <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic", marginTop: 4 }}>"{ex.comment}"</div>}
              {/* Per-exercise rest time selector */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
                <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 800, letterSpacing: 3, textTransform:"uppercase" }}>DESCANSO</span>
                {[60, 90, 120, 180].map(secs => {
                  const active = (ex.restSecs ?? defaultRest) === secs;
                  return (
                    <button key={secs} onClick={() => setExData(prev => prev.map((e, i) => i !== currentEx ? e : { ...e, restSecs: secs }))}
                      style={{
                        background: active ? "var(--accent)" : "var(--input-bg)",
                        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                        color: active ? "#0a0a0a" : "var(--text-muted)",
                        borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                      }}>
                      {secs < 120 ? `${secs}s` : `${secs/60}m`}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tabla series */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 52px", gap: 0, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800, letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>#</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800, letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>PESO (KG)</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800, letterSpacing: 2, fontFamily: "Barlow Condensed, sans-serif" }}>REPS</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center", fontWeight: 800 }}>✓</div>
              </div>
              {ex.sets.map((s, j) => (
                <div key={s.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr 1fr 52px", gap: 8, padding: "8px 12px", alignItems: "center", background: s.done ? "rgba(232,255,0,0.05)" : "transparent", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ textAlign: "center", fontWeight: 800, fontSize: 14, color: s.done ? "var(--accent)" : "var(--text-muted)" }}>S{j+1}</div>
                  <input value={s.weight} onChange={e => updateSet(currentEx, j, "weight", numDot(e.target.value))} inputMode="decimal"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 4px", color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", width: "100%" }} placeholder="0" />
                  <input value={s.reps} onChange={e => updateSet(currentEx, j, "reps", numDot(e.target.value))} inputMode="decimal"
                    style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 4, padding: "8px 4px", color: "var(--text)", fontSize: 16, fontWeight: 700, textAlign: "center", outline: "none", width: "100%" }} placeholder="0" />
                  <button onClick={() => toggleSet(currentEx, j)} style={{ width: 44, height: 40, background: s.done ? "var(--accent)" : "var(--input-bg)", border: `2px solid ${s.done ? "var(--accent)" : "var(--border)"}`, borderRadius: 4, cursor: "pointer", fontSize: 18, margin: "0 auto", color: s.done ? "#0a0a0a" : "var(--text-muted)" }}>
                    {s.done ? "✓" : "○"}
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 0 }}>
                <button onClick={() => addSet(currentEx)} style={{ flex: 1, background: "none", border: "none", borderTop: "1px dashed var(--border)", color: "var(--text-muted)", padding: 10, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ Añadir serie</button>
                <button onClick={() => removeSet(currentEx)} style={{ background: "none", border: "none", borderTop: "1px dashed var(--border)", borderLeft: "1px solid var(--border)", color: "#ef4444", padding: "10px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>− Quitar</button>
              </div>
            </div>

            {/* Timer de descanso */}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 6, padding: "14px 16px", marginBottom: 16 }}>
              {restTimer ? (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4, color: "var(--accent)", textTransform: "uppercase", marginBottom: 10 }}>DESCANSANDO</div>
                  {/* Barra de progreso */}
                  <div style={{ height: 6, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ height: "100%", background: "var(--accent)", borderRadius: 10, width: `${(restTimer.left / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
                  </div>
                  {/* Timer + controles */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {/* -15s */}
                    <button onClick={() => setRestTimer(t => ({ ...t, left: Math.max(0, t.left - 15), total: Math.max(15, t.total - 15) }))}
                      style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>−15s</button>
                    {/* Tiempo */}
                    <div style={{ flex: 1, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 36, fontWeight: 800, color: "var(--accent)" }}>
                      {restTimer.left === 0 ? "¡Listo!" : fmt(restTimer.left)}
                    </div>
                    {/* +15s */}
                    <button onClick={() => setRestTimer(t => ({ ...t, left: t.left + 15, total: t.total + 15 }))}
                      style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 4, padding: "6px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+15s</button>
                  </div>
                  {/* Presets + cerrar */}
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {REST_OPTS.map(o => (
                      <button key={o.label} onClick={() => startRest(o.secs)}
                        style={{ background: restTimer.total === o.secs ? "var(--accent)" : "var(--input-bg)", border: `1px solid ${restTimer.total === o.secs ? "var(--accent)" : "var(--border)"}`, color: restTimer.total === o.secs ? "#0a0a0a" : "var(--text-muted)", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                        {o.label}
                      </button>
                    ))}
                    <button onClick={() => setRestTimer(null)}
                      style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>
                      ✕ Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", marginBottom: 10, fontWeight: 800, letterSpacing: 4, fontFamily: "Barlow Condensed, sans-serif", textTransform:"uppercase" }}>DESCANSO</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {REST_OPTS.map(o => (
                      <button key={o.label} onClick={() => startRest(o.secs)} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 3, padding: "5px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>{o.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nav ejercicios */}
            <div style={{ display: "flex", gap: 10 }}>
              {currentEx > 0 && <button onClick={() => setCurrentEx(i => i-1)} style={{ flex: 1, background: "var(--card)", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 4, padding: 12, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>← Anterior</button>}
              {currentEx < exData.length - 1 && <button onClick={() => setCurrentEx(i => i+1)} style={{ flex: 1, background: "var(--accent)", border: "none", color: "#0a0a0a", borderRadius: 4, padding: 12, cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", boxShadow: "0 0 20px rgba(232,255,0,0.25)" }}>Siguiente →</button>}
            </div>
          </div>
        )}
      </div>

      {/* Boton Finalizar fijo abajo */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px", background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
        <button onClick={() => { setRunning(false); try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {} onSave(exData, elapsed); }}
          style={{ width: "100%", background: "var(--accent)", border: "none", color: "#0a0a0a", borderRadius: 4, padding: "16px 0", fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 900, cursor: "pointer", letterSpacing: 4, textTransform: "uppercase", boxShadow: "0 0 24px rgba(232,255,0,0.2)" }}>
          FINALIZAR →
        </button>
      </div>
    </div>
  );
}

// ─── Athlete Coach Panel ──────────────────────────────────────────────────────
function AthleteCoachPanel({ user, onClose, initialRoutine = null }) {
  const [tab, setTab] = useState("routines");
  const [coaches, setCoaches] = useState([]);
  const [assignedRoutines, setAssignedRoutines] = useState([]);
  const [fullRoutines, setFullRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState(initialRoutine);
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
    if (!user.isGuest && auth.currentUser && !auth.currentUser.emailVerified) {
      setJoinMsg("⚠️ Verifica tu email antes de conectarte con un coach. Revisa tu bandeja de entrada.");
      return;
    }
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
          await setDoc(doc(db, "sessions", user.uid), {
            list: [newSession, ...existing],
            updatedAt: serverTimestamp()
          });
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
    const snap=await getDoc(doc(db,"coaches",uid));
    if (!snap.exists()) return null;
    const data=snap.data();
    if (data.athletes){data.athletes=Object.values(data.athletes).reduce((acc,a)=>{const k=a.email?.toLowerCase()||a.uid;if(!acc[k]||(a.addedAt||"")>(acc[k].addedAt||""))acc[k]=a;return acc;},{});}
    return data;
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
    const routines = snap.docs.map(d => ({ ...d.data(), _docId: d.id }));

    // Reset automatico semanal: si completedAt es anterior al ultimo Lunes 00:00
    const now = new Date();
    const lastMonday = new Date(now);
    lastMonday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    lastMonday.setHours(0, 0, 0, 0);

    const toReset = routines.filter(r => {
      if (!r.completed || !r.completedAt) return false;
      const completedDate = new Date(r.completedAt + "T00:00:00");
      return completedDate < lastMonday;
    });

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

async function saveCustomExercise(name, muscle) {
  try {
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
    await setDoc(doc(db, "custom_exercises", id), {
      name, muscle, equipment: "Personalizado", machine: false,
      gifUrl: "", createdAt: new Date().toISOString().slice(0,10)
    }, { merge: true });
  } catch(e) {}
}

async function loadCustomExercises() {
  try {
    const snap = await getDocs(collection(db, "custom_exercises"));
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    return docs;
  } catch(e) {
    console.error("[loadCustomExercises] ERROR:", e);
    return [];
  }
}

async function updateCustomExerciseGif(id, gifUrl) {
  try {
    await setDoc(doc(db, "custom_exercises", id), { gifUrl }, { merge: true });
    return true;
  } catch(e) {
    console.error("[updateCustomExerciseGif] ERROR:", e);
    return false;
  }
}

async function updateCustomExerciseMeta(id, name, muscle) {
  try {
    await setDoc(doc(db, "custom_exercises", id), { name, muscle }, { merge: true });
    return true;
  } catch(e) { return false; }
}

async function deleteCustomExercise(id) {
  try {
    await deleteDoc(doc(db, "custom_exercises", id));
    return true;
  } catch(e) { return false; }
}

async function getFullRoutine(coachUid, routineId) {
  try {
    if (!coachUid || !routineId) {
      console.warn("[getFullRoutine] Missing args:", { coachUid, routineId });
      return null;
    }
    console.log("[getFullRoutine] Reading:", `coaches/${coachUid}/routines/${routineId}`);
    const snap = await getDoc(doc(db, "coaches", coachUid, "routines", routineId));
    if (!snap.exists()) {
      console.warn("[getFullRoutine] Doc not found:", coachUid, routineId);
      return null;
    }
    console.log("[getFullRoutine] OK:", snap.data()?.name);
    return { id: snap.id, ...snap.data(), coachUid, routineId };
  } catch(e) {
    console.error("[getFullRoutine] ERROR:", e.code, e.message, { coachUid, routineId });
    return null;
  }
}

async function unassignRoutineFromAthlete(athleteUid, routineId) {
  try {
    await deleteDoc(doc(db, "athlete_routines", athleteUid, "routines", routineId));
    return { ok: true };
  } catch(e) { return { ok: false }; }
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

async function saveMeasuresToDB(uid, entries) {
  try {
    await setDoc(doc(db, "measures", uid), { entries, updatedAt: serverTimestamp() });
    return true;
  } catch(e) { return false; }
}

async function loadMeasuresFromDB(uid) {
  try {
    const snap = await getDoc(doc(db, "measures", uid));
    return snap.exists() ? (snap.data().entries || []) : null;
  } catch(e) { return null; }
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

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function AvatarEditor({ user, onPhotoUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarError("");

    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setAvatarError("Solo se aceptan imágenes JPG, PNG, WebP o GIF.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("La imagen no puede superar 2 MB.");
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, "users", user.uid), { photoURL: downloadURL });
      onPhotoUpdate(downloadURL);
    } catch(err) {
      console.error(err);
      setAvatarError("Error al subir la foto. Intenta de nuevo.");
    }
    setUploading(false);
  }

  return (
    <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:800,color:"white",overflow:"hidden",border:"3px solid var(--accent)"}}>
        {user.photoURL
          ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : user.name?.[0]?.toUpperCase()
        }
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{display:"none"}} onChange={handleFile} />
      <button className="btn-ghost small" onClick={() => fileRef.current.click()} disabled={uploading}>
        {uploading ? "⏳ Subiendo..." : "📷 Cambiar foto"}
      </button>
      {avatarError && <div style={{fontSize:11,color:"var(--danger)",maxWidth:200,textAlign:"center"}}>{avatarError}</div>}
    </div>
  );
}
function UserProfileModal({ user, sessions, bodyStats, onOpenBodyStats, onClose, onPhotoUpdate }) {
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
  const earned = BADGE_DEFS.filter(b=>b.check(sessions,prs,bodyStats||{}));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide modal-profile" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">👤 Mi perfil</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{textAlign:"center",marginBottom:20}}>
          <AvatarEditor user={user} onPhotoUpdate={(url) => { onPhotoUpdate && onPhotoUpdate(url); }} />
          <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:22,fontWeight:800}}>{user.name}</div>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>{user.email}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(85px,1fr))",gap:8,marginBottom:20}}>
          {[
            {icon:"⚖️",label:"Peso",value:lastEntry?`${lastEntry.weight}kg`:"—"},
            {icon:"📏",label:"Estatura",value:bodyStats.height?`${bodyStats.height}cm`:"—"},
            {icon:"🧮",label:"IMC",value:imc||"—",color:imcColor},
            {icon:"🏋️",label:"Sesiones",value:sessions.length},
            {icon:"📅",label:"Esta semana",value:thisWeek},
            {icon:"🗓️",label:"Este mes",value:thisMonth},
            {icon:"🔥",label:"Racha",value:`${streak}sem`},
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

  // Load member previews and autosync stats on mount
  useEffect(() => {
    const savedTeams = load(`gym_teams_${user.email}`, []);
    savedTeams.forEach(async t => {
      const data = await teamsGet(`team_${t.code}`);
      if (data) {
        const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
        await teamsSet(`team_${t.code}`, updated);
        setTeamPreviews(prev => ({ ...prev, [t.code]: updated }));
      } else {
        setTeamPreviews(prev => ({ ...prev, [t.code]: null }));
      }
    });
  }, []);

  // Autosync stats to all teams when sessions change
  useEffect(() => {
    const savedTeams = load(`gym_teams_${user.email}`, []);
    if (savedTeams.length === 0) return;
    savedTeams.forEach(async t => {
      const data = await teamsGet(`team_${t.code}`);
      if (data) {
        const updated = { ...data, members: { ...data.members, [user.email]: myStats } };
        await teamsSet(`team_${t.code}`, updated);
        setTeamPreviews(prev => ({ ...prev, [t.code]: updated }));
        if (activeTeam?.code === t.code) setTeamData(updated);
      }
    });
  }, [sessions.length]);

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
      lastSync: Date.now(), // timestamp ms for staleness check
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
    if (!createName.trim()) { setErr("Agrega un nombre al equipo"); return; }
    if (myTeams.length >= 3) { setErr("Puedes estar en un máximo de 3 teams."); return; }
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
    if (!user.isGuest && auth.currentUser && !auth.currentUser.emailVerified) {
      setErr("⚠️ Verifica tu email antes de unirte a un team. Revisa tu bandeja de entrada.");
      return;
    }
    if (myTeams.length >= 3) { setErr("Puedes estar en un máximo de 3 teams."); return; }
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
                        val = `${m.streak}sem`; myVal = m.streak; maxVal = Math.max(...sorted.map(x=>x.streak),1);
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
                                {m.sessions} ses · {m.volume}t · {m.prs} PRs · {m.streak}sem
                                {rankMetric==="progress" && m.bestImprovement && (
                                  <span style={{ color:"#22c55e" }}> · 🏋️ {m.bestImprovement.name} +{m.bestImprovement.pct}%</span>
                                )}
                              </div>
                              {(() => {
                                if (!m.lastSync) return null;
                                const diffH = Math.floor((Date.now() - m.lastSync) / 3600000);
                                const diffD = Math.floor(diffH / 24);
                                const label = diffH < 1 ? "hace menos de 1h" : diffH < 24 ? `hace ${diffH}h` : `hace ${diffD}d`;
                                const stale = diffH >= 24;
                                return (
                                  <div style={{ fontSize:10, marginTop:3, color: stale ? "#f59e0b" : "var(--text-muted)", display:"flex", alignItems:"center", gap:4 }}>
                                    {stale ? "⚠️" : "🟢"} Datos actualizados {label}
                                    {stale && !isMe && <span style={{ color:"#f59e0b" }}> · puede estar desactualizado</span>}
                                    {stale && isMe && <span style={{ color:"#f59e0b" }}> · pulsa "🔄 Mis stats"</span>}
                                  </div>
                                );
                              })()}
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

                {(() => {
                  const staleMembers = sorted.filter(m => m.lastSync && (Date.now() - m.lastSync) >= 86400000 && m.email !== user.email);
                  const myStale = sorted.find(m => m.email === user.email && m.lastSync && (Date.now() - m.lastSync) >= 86400000);
                  return (
                    <div style={{ marginTop:14, textAlign:"center" }}>
                      {myStale && (
                        <div style={{ background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, padding:"8px 14px", fontSize:12, color:"#fbbf24", marginBottom:8 }}>
                          ⚠️ Tus datos llevan más de 24h sin actualizarse — pulsa <b>🔄 Mis stats</b>
                        </div>
                      )}
                      {staleMembers.length > 0 && (
                        <div style={{ fontSize:11, color:"var(--text-muted)" }}>
                          ⚠️ {staleMembers.map(m=>m.name).join(", ")} {staleMembers.length===1?"lleva":"llevan"} más de 1 día sin sincronizar
                        </div>
                      )}
                      {!myStale && staleMembers.length === 0 && (
                        <p style={{ fontSize:11, color:"var(--text-muted)" }}>
                          🟢 Todos los datos están actualizados · pulsa "🔄 Mis stats" para refrescar
                        </p>
                      )}
                    </div>
                  );
                })()}
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

function AdminExercisesModal({ onClose }) {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gifInputs, setGifInputs] = useState({});
  const [saving, setSaving] = useState({});
  const [gifErrors, setGifErrors] = useState({}); // { [exId]: mensaje }
  const [filter, setFilter] = useState("");
  const [uploadMode, setUploadMode] = useState({});
  const [uploadPreviews, setUploadPreviews] = useState({});
  const fileInputRefs = useRef({});
  const [editing, setEditing] = useState({}); // { [id]: { name, muscle } }
  const [savingMeta, setSavingMeta] = useState({});
  const { setGif } = useCustomGifs();

  useEffect(() => {
    loadCustomExercises().then(list => {
      setExercises(list);
      const inputs = {};
      list.forEach(e => { inputs[e.id] = e.gifUrl || ""; });
      setGifInputs(inputs);
      setLoading(false);
    });
  }, []);

  function getMode(id) { return uploadMode[id] || "url"; }
  function setMode(id, mode) { setUploadMode(p => ({ ...p, [id]: mode })); }

  function startEdit(ex) {
    setEditing(p => ({ ...p, [ex.id]: { name: ex.name, muscle: ex.muscle } }));
  }
  function cancelEdit(id) {
    setEditing(p => { const n = { ...p }; delete n[id]; return n; });
  }
  async function saveEdit(ex) {
    const { name, muscle } = editing[ex.id];
    if (!name.trim()) return;
    setSavingMeta(s => ({ ...s, [ex.id]: true }));
    await updateCustomExerciseMeta(ex.id, name.trim(), muscle.trim());
    setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, name: name.trim(), muscle: muscle.trim() } : e));
    setSavingMeta(s => ({ ...s, [ex.id]: false }));
    cancelEdit(ex.id);
  }

  function handleFileChange(ex, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setGifErrors(p => ({ ...p, [ex.id]: "⚠️ Solo se admiten imágenes/GIFs" }));
      return;
    }
    setGifErrors(p => ({ ...p, [ex.id]: "" }));
    setUploadPreviews(p => ({ ...p, [ex.id]: URL.createObjectURL(file) }));
    setGifInputs(p => ({ ...p, [ex.id]: file }));
  }

  async function handleSaveGif(ex) {
    setSaving(s => ({ ...s, [ex.id]: true }));
    let url = gifInputs[ex.id] || "";
    try {
      if (url instanceof File) {
        const storageRef = ref(storage, `exercise_gifs/${ex.id}_${Date.now()}`);
        await uploadBytes(storageRef, url);
        url = await getDownloadURL(storageRef);
      }
      const ok = await updateCustomExerciseGif(ex.id, url);
      if (!ok) {
        setGifErrors(p => ({ ...p, [ex.id]: "❌ Error al guardar." }));
        setSaving(s => ({ ...s, [ex.id]: false }));
        return;
      }
      setGifInputs(p => ({ ...p, [ex.id]: url }));
      setExercises(prev => prev.map(e => e.id === ex.id ? { ...e, gifUrl: url } : e));
      setGif(ex.name, url);
      setGifErrors(p => ({ ...p, [ex.id]: "" }));
    } catch(e) {
      console.error(e);
      setGifErrors(p => ({ ...p, [ex.id]: "❌ Error al subir el GIF: " + e.message }));
    }
    setSaving(s => ({ ...s, [ex.id]: false }));
  }

  async function handleDelete(ex) {
    if (!window.confirm(`¿Eliminar "${ex.name}"?`)) return;
    await deleteCustomExercise(ex.id);
    setExercises(prev => prev.filter(e => e.id !== ex.id));
  }

  const filtered = exercises.filter(e =>
    e.name?.toLowerCase().includes(filter.toLowerCase()) ||
    e.muscle?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">⚙️ Ejercicios personalizados</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
          Ejercicios creados por usuarios. Sube un GIF local o pega una URL para que aparezca en la app.
        </div>
        <input className="input" placeholder="🔍 Filtrar por nombre o músculo..."
          value={filter} onChange={e => setFilter(e.target.value)} style={{ marginBottom: 14 }} />
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>⏳ Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
            {exercises.length === 0 ? "Aún no hay ejercicios personalizados." : "Sin resultados."}
          </div>
        ) : filtered.map(ex => {
          const mode = getMode(ex.id);
          const preview = uploadPreviews[ex.id] || ex.gifUrl;
          const inputVal = gifInputs[ex.id] || "";
          const isSaved = ex.gifUrl && inputVal === ex.gifUrl;
          const isEditing = !!editing[ex.id];
          return (
            <div key={ex.id} style={{ background: "var(--input-bg)", border: `1px solid ${ex.gifUrl ? "rgba(34,197,94,0.4)" : "var(--border)"}`, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{ flex: 1, marginRight: 10 }}>
                  {isEditing ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input className="input" style={{ fontSize: 13, fontWeight: 700, padding: "5px 10px" }}
                        placeholder="Nombre del ejercicio"
                        value={editing[ex.id].name}
                        onChange={e => setEditing(p => ({ ...p, [ex.id]: { ...p[ex.id], name: e.target.value } }))} />
                      <select className="input" style={{ fontSize: 12, padding: "5px 10px" }}
                        value={editing[ex.id].muscle}
                        onChange={e => setEditing(p => ({ ...p, [ex.id]: { ...p[ex.id], muscle: e.target.value } }))}>
                        {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => saveEdit(ex)} disabled={savingMeta[ex.id]}
                          className="btn-primary" style={{ fontSize: 11, padding: "5px 12px" }}>
                          {savingMeta[ex.id] ? "⏳" : "✅ Guardar"}
                        </button>
                        <button onClick={() => cancelEdit(ex.id)}
                          style={{ fontSize: 11, padding: "5px 12px", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, cursor: "pointer", fontFamily: "Barlow, sans-serif" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15 }}>{ex.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-muted)" }}>💪 {ex.muscle} · {ex.createdAt}</div>
                      </div>
                      <button onClick={() => startEdit(ex)}
                        title="Editar nombre y músculo"
                        style={{ background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>
                        ✏️
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {preview && (
                    <img src={preview} alt={ex.name}
                      style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", border: "1px solid var(--accent)" }}
                      onError={e => { e.target.style.display = "none"; }} />
                  )}
                  <button onClick={() => handleDelete(ex)}
                    style={{ background: "none", border: "1px solid rgba(239,68,68,0.3)", color: "#ef4444",
                      borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 11 }}>🗑️</button>
                </div>
              </div>

              {/* Toggle URL / Archivo local */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                <button onClick={() => setMode(ex.id, "url")}
                  style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 8, cursor: "pointer", fontFamily: "Barlow, sans-serif", fontWeight: 600,
                    background: mode === "url" ? "var(--accent)" : "none",
                    color: mode === "url" ? "white" : "var(--text-muted)",
                    border: `1px solid ${mode === "url" ? "var(--accent)" : "var(--border)"}`,
                    transition: "all 0.15s" }}>
                  🔗 URL
                </button>
                <button onClick={() => setMode(ex.id, "file")}
                  style={{ flex: 1, fontSize: 11, padding: "5px 0", borderRadius: 8, cursor: "pointer", fontFamily: "Barlow, sans-serif", fontWeight: 600,
                    background: mode === "file" ? "var(--accent)" : "none",
                    color: mode === "file" ? "white" : "var(--text-muted)",
                    border: `1px solid ${mode === "file" ? "var(--accent)" : "var(--border)"}`,
                    transition: "all 0.15s" }}>
                  📁 Archivo local
                </button>
              </div>

              {mode === "url" ? (
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" style={{ flex: 1, fontSize: 12 }}
                    placeholder="URL del GIF (https://...gif)"
                    value={inputVal.startsWith("data:") ? "" : inputVal}
                    onChange={e => {
                      setGifInputs(p => ({ ...p, [ex.id]: e.target.value }));
                      setUploadPreviews(p => ({ ...p, [ex.id]: null }));
                    }} />
                  <button onClick={() => handleSaveGif(ex)} disabled={saving[ex.id]}
                    className="btn-primary" style={{ fontSize: 12, padding: "8px 14px", flexShrink: 0 }}>
                    {saving[ex.id] ? "⏳" : ex.gifUrl ? "✏️ Actualizar" : "💾 Guardar"}
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/gif,image/webp,image/png,image/jpeg"
                    ref={el => { fileInputRefs.current[ex.id] = el; }}
                    style={{ display: "none" }}
                    onChange={e => handleFileChange(ex, e.target.files[0])}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      onClick={() => fileInputRefs.current[ex.id]?.click()}
                      style={{ flex: 1, background: "var(--input-bg)", border: "1.5px dashed var(--border)", color: "var(--text-muted)",
                        borderRadius: 8, padding: "9px 12px", cursor: "pointer", fontSize: 12, fontFamily: "Barlow, sans-serif",
                        textAlign: "left", transition: "border-color 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = "var(--accent)"}
                      onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}>
                      {uploadPreviews[ex.id] ? "✅ GIF cargado — click para cambiar" : "📂 Seleccionar GIF local (máx. 3 MB)"}
                    </button>
                    <button onClick={() => handleSaveGif(ex)} disabled={saving[ex.id] || !gifInputs[ex.id]}
                      className="btn-primary" style={{ fontSize: 12, padding: "8px 14px", flexShrink: 0 }}>
                      {saving[ex.id] ? "⏳" : ex.gifUrl ? "✏️ Actualizar" : "💾 Guardar"}
                    </button>
                  </div>
                  {uploadPreviews[ex.id] && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-muted)" }}>
                      Vista previa ↑ · Se subirá a Firebase Storage
                    </div>
                  )}
                </div>
              )}

              {gifErrors[ex.id] && (
                <div className="err-msg" style={{ marginTop: 6, fontSize: 12 }}>{gifErrors[ex.id]}</div>
              )}
              {isSaved && !uploadPreviews[ex.id] && (
                <div style={{ fontSize: 11, color: "#22c55e", marginTop: 6 }}>✅ GIF asignado</div>
              )}
            </div>
          );
        })}
        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(59,130,246,0.08)", borderRadius: 10, fontSize: 12, color: "var(--text-muted)" }}>
          💡 GIFs gratis en <a href="https://giphy.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>giphy.com</a> o <a href="https://tenor.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>tenor.com</a> — o sube directamente desde tu dispositivo
        </div>
      </div>
    </div>
  );
}

function ParticlesBackground() {
  const canvasRef = useRef();
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    const WORDS = [
      "YEAH BUDDY", "LIGHT WEIGHT", "AIN'T NOTHIN'", "GET SOME",
      "NO PAIN NO GAIN", "EAT BIG GET BIG", "BEAST MODE",
      "DO YOU EVEN LIFT", "STAY HUNGRY", "ONE MORE REP",
      "BUILT DIFFERENT", "NO DAYS OFF", "EMBRACE THE GRIND",
      "1RM", "PR!", "5x5", "AMRAP", "DROP SET",
      "100KG", "200KG", "315KG", "140KG", "180KG",
      "SQUAT", "BENCH", "DEADLIFT", "OHP",
      "GAINS", "SWOLE", "GRIND", "SHRED", "BULK",
      "💪", "🔥", "⚡", "🏋️",
      "DALE DURO", "SIN EXCUSAS", "A TOPE", "TÚ PUEDES",
      "MÁS PESO", "UNA MÁS", "NO TE RINDAS", "MODO BESTIA",
      "SIN DOLOR SIN GLORIA", "ENTRENA DURO", "SUDA MÁS",
      "HOY ES DÍA DE PIERNA", "EL QUE PARA PIERDE",
      "CONSISTENCIA", "DISCIPLINA", "SACRIFICIO",
      "YA VIENE EL PR", "SUPÉRATE", "ROMPE LÍMITES",
      "COME DUERME ENTRENA",
    ];

    // Speed tiers: slow, medium, fast, shooting star
    function randomDrop() {
      const tier = Math.random();
      let speed, fontSize, alpha, trailLength;
      if (tier < 0.5) {
        // slow
        speed = 0.3 + Math.random() * 0.4;
        fontSize = 14 + Math.floor(Math.random() * 4);
        alpha = 0.4 + Math.random() * 0.3;
        trailLength = 0;
      } else if (tier < 0.8) {
        // medium
        speed = 1.2 + Math.random() * 1.0;
        fontSize = 16 + Math.floor(Math.random() * 5);
        alpha = 0.6 + Math.random() * 0.3;
        trailLength = 20;
      } else if (tier < 0.95) {
        // fast
        speed = 3.5 + Math.random() * 2.0;
        fontSize = 18 + Math.floor(Math.random() * 4);
        alpha = 0.8 + Math.random() * 0.2;
        trailLength = 50;
      } else {
        // shooting star — very fast, bright, long trail
        speed = 8 + Math.random() * 6;
        fontSize = 20;
        alpha = 1.0;
        trailLength = 120;
      }
      return {
        x: Math.random() * W,
        y: -40 - Math.random() * H * 0.5,
        speed,
        fontSize,
        alpha,
        trailLength,
        word: WORDS[Math.floor(Math.random() * WORDS.length)],
        color: Math.random() < 0.15 ? "#ffffff" : Math.random() < 0.5 ? "#60a5fa" : "#a78bfa",
        trail: [], // stores previous y positions for shooting star effect
      };
    }

    const NUM_DROPS = Math.floor(W / 22);
    const drops = Array.from({ length: NUM_DROPS }, (_, i) => {
      const d = randomDrop();
      d.x = (i / NUM_DROPS) * W + Math.random() * (W / NUM_DROPS);
      d.y = -40 - Math.random() * H; // stagger start positions
      return d;
    });

    // ── YEAH BUDDY special state ──
    let yeahBuddyFreeze = 0;   // frames remaining in freeze
    let shockwave = null;      // { x, y, r, alpha } explosion ring
    let flashAlpha = 0;        // screen flash
    const FREEZE_FRAMES = 48;  // ~0.8s at 60fps
    let yeahBuddyHits = 0;     // 0 = first drop, 1 = encore, 2 = gone forever

    // Make one random drop always be YEAH BUDDY at start
    const yeahDrop = drops[Math.floor(Math.random() * drops.length)];
    yeahDrop.word = "YEAH BUDDY";
    yeahDrop.isYeah = true;
    yeahDrop.color = "#e8ff00";
    yeahDrop.fontSize = 14;        // small, subtle
    yeahDrop.alpha = 0.45;         // barely visible
    yeahDrop.speed = 0.4;          // very slow
    yeahDrop.trailLength = 0;      // no trail
    yeahDrop.trail = [];

    function spawnYeahBuddyEncore(drop) {
      // Encore — HUGE, fast, epic
      drop.y = -120;
      drop.x = W * 0.1 + Math.random() * W * 0.8;
      drop.word = "YEAH BUDDY";
      drop.isYeah = true;
      drop.color = "#e8ff00";
      drop.fontSize = 48;        // big and proud
      drop.alpha = 1.0;
      drop.speed = 5 + Math.random() * 2;
      drop.trailLength = 140;
      drop.trail = [];
    }

    let raf;
    function loop() {
      const frozen = yeahBuddyFreeze > 0;

      // Dark fade
      ctx.fillStyle = frozen
        ? "rgba(6,13,24,0.04)"   // slower fade during freeze = longer afterglow
        : "rgba(6,13,24,0.15)";
      ctx.fillRect(0, 0, W, H);

      // Screen flash on impact
      if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(232,255,0,${flashAlpha})`;
        ctx.fillRect(0, 0, W, H);
        flashAlpha = Math.max(0, flashAlpha - 0.06);
      }

      // Shockwave ring
      if (shockwave) {
        shockwave.r += 12;
        shockwave.alpha -= 0.035;
        if (shockwave.alpha <= 0) {
          shockwave = null;
        } else {
          ctx.beginPath();
          ctx.arc(shockwave.x, shockwave.y, shockwave.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(232,255,0,${shockwave.alpha})`;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 20;
          ctx.shadowColor = "#e8ff00";
          ctx.stroke();
          ctx.shadowBlur = 0;
          ctx.lineWidth = 1;
        }
      }

      drops.forEach(drop => {
        const isYeah = drop.isYeah;

        // Freeze all non-yeah drops
        if (frozen && !isYeah) {
          // Just redraw in place, fading out slowly
          ctx.font = `800 ${drop.fontSize}px "Barlow Condensed", sans-serif`;
          ctx.globalAlpha = drop.alpha * (yeahBuddyFreeze / FREEZE_FRAMES) * 0.5;
          ctx.fillStyle = drop.color;
          ctx.fillText(drop.word, Math.min(drop.x, W - ctx.measureText(drop.word).width - 4), drop.y);
          ctx.globalAlpha = 1;
          return;
        }

        // Draw trail
        if (drop.trailLength > 0 && drop.trail.length > 1) {
          for (let t = 0; t < drop.trail.length; t++) {
            const ratio = t / drop.trail.length;
            const trailAlpha = drop.alpha * ratio * (isYeah ? 0.6 : 0.4);
            ctx.font = `800 ${drop.fontSize * (0.5 + ratio * 0.5)}px "Barlow Condensed", sans-serif`;
            if (isYeah) {
              ctx.fillStyle = `rgba(232,255,0,${trailAlpha})`;
            } else {
              ctx.fillStyle = drop.color.startsWith("#fff")
                ? `rgba(255,255,255,${trailAlpha})`
                : drop.color.includes("a7")
                ? `rgba(167,139,250,${trailAlpha})`
                : `rgba(96,165,250,${trailAlpha})`;
            }
            ctx.shadowBlur = 0;
            ctx.fillText(drop.word, Math.min(drop.x, W - ctx.measureText(drop.word).width - 4), drop.trail[t]);
          }
        }

        // Draw main word
        ctx.font = `800 ${drop.fontSize}px "Barlow Condensed", sans-serif`;
        if (isYeah) {
          ctx.shadowBlur = 30;
          ctx.shadowColor = "#e8ff00";
          ctx.globalAlpha = drop.alpha;
          ctx.fillStyle = "#e8ff00";
        } else {
          ctx.shadowBlur = drop.trailLength > 80 ? 24 : drop.trailLength > 0 ? 10 : 4;
          ctx.shadowColor = drop.color;
          ctx.globalAlpha = drop.alpha;
          ctx.fillStyle = drop.color;
        }
        ctx.fillText(drop.word, Math.min(drop.x, W - ctx.measureText(drop.word).width - 4), drop.y);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Update trail
        if (drop.trailLength > 0) {
          drop.trail.push(drop.y);
          if (drop.trail.length > Math.floor(drop.trailLength / drop.speed)) {
            drop.trail.shift();
          }
        }

        drop.y += drop.speed;

        // YEAH BUDDY hits bottom → trigger impact
        if (isYeah && drop.y > H + 10) {
          yeahBuddyHits++;
          flashAlpha = yeahBuddyHits === 1 ? 0.22 : 0.35;
          shockwave = { x: drop.x, y: H, r: 10, alpha: 0.9 };
          yeahBuddyFreeze = FREEZE_FRAMES;

          if (yeahBuddyHits === 1) {
            // First hit → spawn encore
            spawnYeahBuddyEncore(drop);
          } else {
            // Second hit (encore) → retire forever, become normal drop
            drop.isYeah = false;
            Object.assign(drop, randomDrop());
          }
          return;
        }

        if (!isYeah && drop.y > H + 60) {
          const laneX = drop.x;
          Object.assign(drop, randomDrop());
          drop.x = laneX + (Math.random() - 0.5) * 30;
        }
      });

      if (frozen) yeahBuddyFreeze--;

      raf = requestAnimationFrame(loop);
    }

    ctx.fillStyle = "#060d18";
    ctx.fillRect(0, 0, W, H);
    loop();

    const onResize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      ctx.fillStyle = "#060d18";
      ctx.fillRect(0, 0, W, H);
    };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", top:0, left:0, width:"100vw", height:"100vh", zIndex:1, pointerEvents:"none" }} />;
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
  const [focusedField, setFocusedField] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  function switchMode(m) {
    setMode(m); setErr(""); setMsg("");
    setAnimKey(k => k + 1);
  }

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

  const SLOGANS = [
    { top: "ROMPE", bottom: "TUS LÍMITES" },
    { top: "MODO", bottom: "BESTIA" },
    { top: "SIN", bottom: "EXCUSAS" },
    { top: "DALE", bottom: "DURO" },
  ];
  const slogan = SLOGANS[Math.floor(Date.now() / 86400000) % SLOGANS.length];

  const inputStyle = (field) => ({
    width: "100%",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid ${focusedField === field ? "#e8ff00" : "rgba(255,255,255,0.2)"}`,
    color: "white",
    fontFamily: "'Barlow', sans-serif",
    fontSize: 15,
    fontWeight: 500,
    padding: "10px 0 8px",
    outline: "none",
    transition: "border-color 0.25s",
    letterSpacing: 0.5,
  });

  const labelStyle = (field) => ({
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 3,
    textTransform: "uppercase",
    color: focusedField === field ? "#e8ff00" : "rgba(255,255,255,0.4)",
    display: "block",
    marginBottom: 4,
    transition: "color 0.25s",
  });

  return (
    <div style={{
      minHeight: "100dvh",
      width: "100vw",
      maxWidth: "100%",
      background: "#0a0a0a",
      display: "flex",
      flexDirection: "row",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background particles */}
      <ParticlesBackground />

      {/* Diagonal red accent */}
      <div style={{
        position: "fixed",
        top: 0, right: 0,
        width: "45vw",
        height: "100vh",
        background: "linear-gradient(135deg, transparent 0%, rgba(220,38,38,0.06) 100%)",
        pointerEvents: "none",
        zIndex: 2,
      }} />

      {/* Left panel - branding */}
      <div style={{
        width: "42%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        padding: "60px 48px",
        position: "relative",
        zIndex: 10,
        flexShrink: 0,
      }}
        className="login-left-panel"
      >
        {/* Logo top-left */}
        <div style={{
          position: "absolute", top: 32, left: 40,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 30, height: 30, borderRadius: 6,
            background: "linear-gradient(135deg, #e8ff00, #facc15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, flexShrink: 0,
          }}>⚡</div>
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 15, fontWeight: 900, letterSpacing: 6,
            color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
          }}>GYMTRACKER</span>
        </div>

        {/* Giant slogan */}
        <div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(56px, 7.5vw, 96px)",
            fontWeight: 900,
            lineHeight: 0.88,
            letterSpacing: "-2px",
            color: "white",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
          }}>
            {slogan.top}
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: "clamp(56px, 7.5vw, 96px)",
            fontWeight: 900,
            lineHeight: 0.88,
            letterSpacing: "-2px",
            WebkitTextStroke: "2.5px #e8ff00",
            color: "transparent",
            textShadow: "0 0 0 transparent",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            paintOrder: "stroke fill",
          }}>
            {slogan.bottom}
          </div>

          {/* Rule + motivational phrase */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 26, marginBottom: 16 }}>
            <div style={{ width: 44, height: 3, background: "#e8ff00", borderRadius: 2, flexShrink: 0 }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 14, fontWeight: 700, letterSpacing: 2,
              color: "rgba(255,255,255,0.3)", textTransform: "uppercase",
            }}>ENTRENA CADA MALDITO DÍA</span>
          </div>

          <p style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: 13,
            fontFamily: "'Barlow', sans-serif",
            lineHeight: 1.6,
            maxWidth: 260,
            letterSpacing: 0.3,
          }}>
            Registra cada set. Rompe cada récord. Construye el cuerpo que mereces.
          </p>

          {/* Stats row */}
          <div style={{
            display: "flex", gap: 32, marginTop: 36,
          }}>
            {[["∞", "Ejercicios"], ["100%", "Gratis"], ["🏆", "Tus PRs"]].map(([val, lbl]) => (
              <div key={lbl}>
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 22, fontWeight: 900, color: "#e8ff00",
                }}>{val}</div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", letterSpacing: 2, textTransform: "uppercase" }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="login-right-panel" style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px 16px",
        position: "relative",
        zIndex: 10,
        minHeight: "100dvh",
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}>
        {/* Vertical line divider - desktop only */}
        <div className="login-divider" style={{
          position: "absolute",
          left: 0, top: "10%", bottom: "10%",
          width: 1,
          background: "linear-gradient(to bottom, transparent, rgba(232,255,0,0.3), transparent)",
        }} />

        <div style={{
          width: "100%",
          maxWidth: 380,
          background: "rgba(10,10,10,0.55)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(232,255,0,0.12)",
          borderRadius: 16,
          padding: "22px 20px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
          animation: "loginSlideIn 0.35s cubic-bezier(0.22,1,0.36,1) both",
          boxSizing: "border-box",
        }} key={animKey}>

        {/* Mobile header — shown only on small screens */}
        <div className="login-mobile-logo" style={{
          display: "none",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: 16,
        }}>
          {/* Icon */}
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #e8ff00, #facc15)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, marginBottom: 8,
            boxShadow: "0 0 20px rgba(232,255,0,0.3)",
          }}>⚡</div>
          {/* App name — protagonist */}
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 28, fontWeight: 900, letterSpacing: 7,
            color: "white", textTransform: "uppercase",
            lineHeight: 1,
          }}>GYMTRACKER</div>
          {/* Slogan — subordinado, pequeño */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8, marginTop: 10,
          }}>
            <div style={{ width: 20, height: 2, background: "#e8ff00", borderRadius: 1 }} />
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12, fontWeight: 700, letterSpacing: 3,
              color: "rgba(255,255,255,0.6)", textTransform: "uppercase",
            }}>{slogan.top} {slogan.bottom}</span>
            <div style={{ width: 20, height: 2, background: "#e8ff00", borderRadius: 1 }} />
          </div>
          {/* Motivational phrase */}
          <div style={{
            marginTop: 6,
            fontFamily: "'Barlow', sans-serif",
            fontSize: 11, fontWeight: 500,
            color: "rgba(255,255,255,0.45)",
            letterSpacing: 1.5, textTransform: "uppercase",
          }}>Entrena cada maldito día</div>
        </div>

          {/* Mode indicator */}
          {mode !== "forgot" && (
            <div style={{
              display: "flex",
              gap: 0,
              marginBottom: 24,
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}>
              {[["login", "Iniciar sesión"], ["register", "Crear cuenta"]].map(([m, label]) => (
                <button key={m} onClick={() => switchMode(m)} style={{
                  flex: 1,
                  background: "none",
                  border: "none",
                  padding: "0 0 14px",
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  color: mode === m ? "#e8ff00" : "rgba(255,255,255,0.25)",
                  cursor: "pointer",
                  borderBottom: mode === m ? "2px solid #e8ff00" : "2px solid transparent",
                  marginBottom: -1,
                  transition: "all 0.2s",
                }}>{label}</button>
              ))}
            </div>
          )}

          {mode === "forgot" && (
            <div style={{ marginBottom: 32 }}>
              <button onClick={() => switchMode("login")} style={{
                background: "none", border: "none", color: "rgba(255,255,255,0.4)",
                fontFamily: "'Barlow', sans-serif", fontSize: 12, fontWeight: 700,
                letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6, padding: 0, marginBottom: 24,
              }}>
                ← VOLVER
              </button>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 36, fontWeight: 900, color: "white", textTransform: "uppercase",
                letterSpacing: 1, lineHeight: 1,
              }}>RECUPERAR<br/><span style={{ color: "#e8ff00" }}>CONTRASEÑA</span></div>
              <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, marginTop: 10, lineHeight: 1.5 }}>
                Te enviaremos un enlace para restablecer tu acceso.
              </p>
            </div>
          )}

          {/* Fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {mode === "register" && (
              <div>
                <label style={labelStyle("name")}>Nombre</label>
                <input
                  style={inputStyle("name")}
                  type="text"
                  placeholder="Tu nombre"
                  value={name}
                  onChange={e => setName(lettersOnly(e.target.value))}
                  onFocus={() => setFocusedField("name")}
                  onBlur={() => setFocusedField(null)}
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label style={labelStyle("email")}>Email</label>
              <input
                style={inputStyle("email")}
                type="email"
                placeholder="email@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                autoComplete="email"
              />
            </div>

            {mode !== "forgot" && (
              <div>
                <label style={labelStyle("pass")}>Contraseña</label>
                <div style={{ position: "relative" }}>
                  <input
                    style={{ ...inputStyle("pass"), paddingRight: 36 }}
                    type={showPass ? "text" : "password"}
                    placeholder="••••••••"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    onFocus={() => setFocusedField("pass")}
                    onBlur={() => setFocusedField(null)}
                    onKeyDown={e => e.key === "Enter" && submit()}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                  />
                  <button onClick={() => setShowPass(v => !v)} style={{
                    position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    color: "rgba(255,255,255,0.3)", fontSize: 15, padding: 0,
                  }}>{showPass ? "🙈" : "👁️"}</button>
                </div>
                {mode === "register" && <PasswordStrength pass={pass} />}
                {mode === "login" && (
                  <div style={{ textAlign: "right", marginTop: 8 }}>
                    <button onClick={() => switchMode("forgot")} style={{
                      background: "none", border: "none",
                      color: "rgba(255,255,255,0.3)", fontSize: 11,
                      cursor: "pointer", fontFamily: "'Barlow', sans-serif",
                      letterSpacing: 1, textTransform: "uppercase", padding: 0,
                      transition: "color 0.2s",
                    }}
                      onMouseEnter={e => e.currentTarget.style.color = "#e8ff00"}
                      onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}
                    >¿Olvidaste tu contraseña?</button>
                  </div>
                )}
              </div>
            )}

            {mode === "register" && (
              <div>
                <label style={labelStyle("passConfirm")}>Confirmar contraseña</label>
                <input
                  style={{
                    ...inputStyle("passConfirm"),
                    borderBottomColor: pass && passConfirm && pass !== passConfirm
                      ? "#ef4444"
                      : focusedField === "passConfirm" ? "#e8ff00" : "rgba(255,255,255,0.2)",
                  }}
                  type="password"
                  placeholder="••••••••"
                  value={passConfirm}
                  onChange={e => setPassConfirm(e.target.value)}
                  onFocus={() => setFocusedField("passConfirm")}
                  onBlur={() => setFocusedField(null)}
                />
                {pass && passConfirm && pass !== passConfirm && (
                  <span style={{ fontSize: 11, color: "#ef4444", marginTop: 4, display: "block" }}>Las contraseñas no coinciden</span>
                )}
              </div>
            )}
          </div>

          {/* Error / Success */}
          {err && (
            <div style={{
              marginTop: 16,
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "'Barlow', sans-serif",
            }}>{err}</div>
          )}
          {msg && (
            <div style={{
              marginTop: 16,
              background: "rgba(34,197,94,0.06)",
              border: "1px solid rgba(34,197,94,0.25)",
              color: "#22c55e",
              borderRadius: 8,
              padding: "10px 14px",
              fontSize: 13,
              fontFamily: "'Barlow', sans-serif",
            }}>{msg}</div>
          )}

          {/* CTA button */}
          <button
            onClick={submit}
            disabled={loading}
            style={{
              marginTop: 28,
              width: "100%",
              padding: "15px 0",
              background: loading ? "rgba(255,255,255,0.08)" : "#e8ff00",
              border: "none",
              borderRadius: 4,
              color: loading ? "rgba(255,255,255,0.3)" : "#0a0a0a",
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: 3,
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
              boxShadow: loading ? "none" : "0 0 30px rgba(232,255,0,0.25)",
            }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.background = "#f0ff40"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 40px rgba(232,255,0,0.4)"; } }}
            onMouseLeave={e => { e.currentTarget.style.background = loading ? "rgba(255,255,255,0.08)" : "#e8ff00"; e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = loading ? "none" : "0 0 30px rgba(232,255,0,0.25)"; }}
          >
            {loading ? "⏳ Cargando..." : mode === "login" ? "ENTRAR →" : mode === "register" ? "CREAR CUENTA →" : "ENVIAR ENLACE →"}
          </button>

          {mode !== "forgot" && (
            <>
              {/* Divider */}
              <div style={{
                display: "flex", alignItems: "center", gap: 14,
                margin: "24px 0 20px",
              }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", letterSpacing: 2, textTransform: "uppercase", fontFamily: "'Barlow', sans-serif" }}>O</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              </div>

              {/* Google button */}
              <button
                onClick={() => loginWithGoogle()}
                style={{
                  width: "100%",
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  cursor: "pointer", marginBottom: 10,
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 13, fontWeight: 700,
                  color: "rgba(255,255,255,0.7)",
                  letterSpacing: 0.5,
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              >
                <svg width="16" height="16" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.2 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 20-8 20-20 0-1.3-.2-2.7-.4-4z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 16 18.9 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.5 35.6 26.9 36.5 24 36.5c-5.2 0-9.6-3.4-11.2-8.1l-6.5 5C9.9 40 16.4 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.5l6.2 5.2C40.9 35.4 44 30.1 44 24c0-1.3-.2-2.7-.4-4z"/>
                </svg>
                Continuar con Google
              </button>

              {/* Guest button */}
              <button
                onClick={loginAsGuest}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "1px dashed rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  padding: "12px 16px",
                  display: "flex", alignItems: "center", gap: 12,
                  cursor: "pointer",
                  fontFamily: "'Barlow', sans-serif",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(232,255,0,0.3)"; e.currentTarget.style.background = "rgba(232,255,0,0.03)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: 18 }}>👤</span>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "rgba(255,255,255,0.4)", letterSpacing: 0.5 }}>Entrar como invitado</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 1 }}>3 sesiones · Sin historial guardado</div>
                </div>
              </button>

              {/* Switch mode link */}
              <p style={{ textAlign: "center", marginTop: 22, fontSize: 12, color: "rgba(255,255,255,0.25)", fontFamily: "'Barlow', sans-serif" }}>
                {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
                <button
                  onClick={() => switchMode(mode === "login" ? "register" : "login")}
                  style={{
                    background: "none", border: "none",
                    color: "#e8ff00", fontWeight: 800, cursor: "pointer",
                    fontFamily: "'Barlow', sans-serif", fontSize: 12, padding: 0,
                  }}
                >
                  {mode === "login" ? "Regístrate gratis" : "Inicia sesión"}
                </button>
              </p>
            </>
          )}
        </div>{/* end inner card */}
      </div>

      <style>{`
        @keyframes loginSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .login-left-panel { display: none !important; }
          .login-divider    { display: none !important; }
          .login-mobile-logo { display: flex !important; }
          .login-right-panel {
            width: 100vw !important;
            flex: unset !important;
            align-items: center !important;
            justify-content: center !important;
          }
        }
      `}</style>
    </div>
  );
}



// ─── Dashboard ────────────────────────────────────────────────────────────────

// ─── Músculo más descuidado ────────────────────────────────────────────────────
// ─── BRUX — Mascota motivadora (Mancuerna) ────────────────────────────────────
const BRUX_MOODS = {
  hype:     { face: "hype",     color: "#3b82f6", glow: "#3b82f625", label: "¡Listo!" },
  happy:    { face: "happy",    color: "#22c55e", glow: "#22c55e25", label: "Contento" },
  proud:    { face: "proud",    color: "#f59e0b", glow: "#f59e0b25", label: "Orgulloso" },
  warning:  { face: "warning",  color: "#f97316", glow: "#f9731625", label: "Alerta" },
  shocked:  { face: "shocked",  color: "#ef4444", glow: "#ef444425", label: "¡Qué!" },
  chill:    { face: "chill",    color: "#8b5cf6", glow: "#8b5cf625", label: "Relajado" },
  sleepy:   { face: "sleepy",   color: "#6b7280", glow: "#6b728025", label: "Dormido" },
  celebrate:{ face: "celebrate",color: "#f97316", glow: "#f9731625", label: "Celebrando" },
  fire:     { face: "fire",     color: "#ef4444", glow: "#ef444425", label: "¡En llamas!" },
  coach:    { face: "coach",    color: "#06b6d4", glow: "#06b6d425", label: "Modo coach" },
  sarcastic:{ face: "sarcastic",color: "#a855f7", glow: "#a855f725", label: "Sarcástico" },
};

function DumbbellAvatar({ mood, bounce, size = 68, pulse = false }) {
  const c = mood.color;
  const f = mood.face;
  const dark = "#0a0a0a";

  const renderFace = () => {
    const eyes = (() => {
      if (f === "sleepy") return (
        <>
          <line x1="25" y1="23" x2="30" y2="23" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <line x1="34" y1="23" x2="39" y2="23" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <text x="37" y="18" fontSize="7" fill={c} opacity="0.8">z</text>
          <text x="40" y="14" fontSize="5" fill={c} opacity="0.5">z</text>
        </>
      );
      if (f === "shocked") return (
        <>
          <rect x="24" y="20" width="7" height="7" rx="1" fill={c}/>
          <rect x="33" y="20" width="7" height="7" rx="1" fill={c}/>
          <rect x="25.5" y="21.5" width="2" height="2" fill={dark}/>
          <rect x="34.5" y="21.5" width="2" height="2" fill={dark}/>
        </>
      );
      if (f === "fire") return (
        <>
          <line x1="24" y1="20" x2="30" y2="26" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <line x1="30" y1="20" x2="24" y2="26" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <line x1="33" y1="20" x2="39" y2="26" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <line x1="39" y1="20" x2="33" y2="26" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
        </>
      );
      if (f === "celebrate" || f === "proud" || f === "hype") return (
        <>
          <text x="27" y="27" fontSize="8" textAnchor="middle" fill={c} fontWeight="900">★</text>
          <text x="37" y="27" fontSize="8" textAnchor="middle" fill={c} fontWeight="900">★</text>
        </>
      );
      if (f === "sarcastic") return (
        <>
          <rect x="24" y="22" width="7" height="4" rx="0" fill={c}/>
          <rect x="33" y="22" width="7" height="4" rx="0" fill={c}/>
          <line x1="33" y1="19" x2="40" y2="17" stroke={c} strokeWidth="2" strokeLinecap="square"/>
        </>
      );
      if (f === "chill") return (
        <>
          <rect x="24" y="22" width="7" height="4" rx="2" fill={c}/>
          <rect x="33" y="22" width="7" height="4" rx="2" fill={c}/>
        </>
      );
      if (f === "warning") return (
        <>
          <rect x="24" y="21" width="7" height="5" rx="1" fill={c}/>
          <rect x="33" y="21" width="7" height="5" rx="1" fill={c}/>
          <line x1="23" y1="18" x2="31" y2="20" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <line x1="41" y1="18" x2="33" y2="20" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
        </>
      );
      return (
        <>
          <rect x="24" y="21" width="7" height="5" rx="1" fill={c}/>
          <rect x="33" y="21" width="7" height="5" rx="1" fill={c}/>
          <rect x="25" y="22" width="2" height="2" fill={dark}/>
          <rect x="34" y="22" width="2" height="2" fill={dark}/>
          <line x1="23" y1="18" x2="31" y2="19.5" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
          <line x1="41" y1="18" x2="33" y2="19.5" stroke={c} strokeWidth="2.5" strokeLinecap="square"/>
        </>
      );
    })();

    const mouth = (() => {
      if (f === "sleepy") return <line x1="27" y1="31" x2="37" y2="31" stroke={c} strokeWidth="2" strokeLinecap="square" opacity="0.6"/>;
      if (f === "shocked") return (
        <>
          <rect x="28" y="29" width="8" height="5" rx="1" fill={c}/>
          <rect x="29" y="30" width="6" height="3" rx="0" fill={dark}/>
        </>
      );
      if (f === "sarcastic" || f === "warning") return (
        <path d="M27 32 L32 30 L37 32" stroke={c} strokeWidth="2" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>
      );
      if (f === "celebrate" || f === "proud" || f === "fire" || f === "hype") return (
        <>
          <path d="M25 30 L32 35 L39 30" stroke={c} strokeWidth="2.5" fill={`${c}30`} strokeLinecap="square" strokeLinejoin="miter"/>
          <line x1="29" y1="30" x2="30" y2="33.5" stroke={c} strokeWidth="1" opacity="0.5"/>
          <line x1="32" y1="30.5" x2="32" y2="35" stroke={c} strokeWidth="1" opacity="0.5"/>
          <line x1="35" y1="30" x2="34" y2="33.5" stroke={c} strokeWidth="1" opacity="0.5"/>
        </>
      );
      return <path d="M27 31.5 L32 34 L37 31.5" stroke={c} strokeWidth="2.2" fill="none" strokeLinecap="square" strokeLinejoin="miter"/>;
    })();

    return <>{eyes}{mouth}</>;
  };

  const s = size;
  const vW = 80; const vH = 88;

  return (
    <div style={{
      width: s, height: Math.round(s * vH/vW), flexShrink: 0,
      transform: bounce ? "scale(1.18) rotate(-6deg)" : "scale(1) rotate(0deg)",
      transition: "transform 0.35s cubic-bezier(.36,.07,.19,.97)",
    }}>
      <svg viewBox={`0 0 ${vW} ${vH}`} width={s} height={Math.round(s * vH/vW)} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <filter id={`glow-${f}`} x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
          <filter id={`neon-${f}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {(f === "fire" || f === "celebrate" || f === "proud" || f === "hype") && (
          <ellipse cx="40" cy="44" rx="32" ry="36" fill={`${c}18`} filter={`url(#glow-${f})`}/>
        )}

        {/* HEAD — angular helmet */}
        <path d="M22 8 L58 8 L60 14 L60 36 L54 42 L26 42 L20 36 L20 14 Z"
          fill={dark} stroke={c} strokeWidth="2" strokeLinejoin="miter"/>
        <path d="M24 8 L56 8 L58 10 L22 10 Z" fill={c} opacity="0.9"/>
        <path d="M26 16 L54 16 L56 20 L56 36 L52 39 L28 39 L24 36 L24 20 Z"
          fill="#111" stroke={`${c}60`} strokeWidth="1" strokeLinejoin="miter"/>
        {renderFace()}
        <line x1="20" y1="32" x2="26" y2="36" stroke={c} strokeWidth="1.5" opacity="0.5"/>
        <line x1="60" y1="32" x2="54" y2="36" stroke={c} strokeWidth="1.5" opacity="0.5"/>

        {/* NECK */}
        <rect x="33" y="42" width="14" height="7" fill={dark} stroke={c} strokeWidth="1.5" strokeLinejoin="miter"/>
        <line x1="40" y1="42" x2="40" y2="49" stroke={c} strokeWidth="1" opacity="0.4"/>

        {/* TORSO */}
        <path d="M14 49 L66 49 L62 76 L18 76 Z"
          fill={dark} stroke={c} strokeWidth="2" strokeLinejoin="miter" filter={`url(#neon-${f})`}/>
        <path d="M18 49 L40 49 L38 62 L20 62 Z" fill={`${c}20`} stroke={`${c}50`} strokeWidth="1"/>
        <path d="M62 49 L40 49 L42 62 L60 62 Z" fill={`${c}20`} stroke={`${c}50`} strokeWidth="1"/>
        <line x1="40" y1="49" x2="40" y2="76" stroke={c} strokeWidth="1.5" opacity="0.6"/>
        <line x1="21" y1="62" x2="59" y2="62" stroke={c} strokeWidth="1" opacity="0.3"/>
        <line x1="22" y1="69" x2="58" y2="69" stroke={c} strokeWidth="1" opacity="0.3"/>

        {/* LEFT ARM + DUMBBELL */}
        <path d="M14 49 L4 44 L0 34 L6 32 L10 40 L18 47 Z"
          fill={dark} stroke={c} strokeWidth="1.8" strokeLinejoin="miter"/>
        <path d="M0 34 L-2 22 L4 18 L8 28 L6 32 Z"
          fill={dark} stroke={c} strokeWidth="1.8" strokeLinejoin="miter"/>
        <rect x="-6" y="11" width="18" height="6" rx="0" fill={c} filter={`url(#glow-${f})`}/>
        <rect x="-8" y="7"  width="6" height="14" rx="0" fill={c}/>
        <rect x="8"  y="7"  width="6" height="14" rx="0" fill={c}/>
        <rect x="-9" y="9"  width="3" height="10" rx="0" fill={`${c}80`}/>
        <rect x="14" y="9"  width="3" height="10" rx="0" fill={`${c}80`}/>

        {/* RIGHT ARM + DUMBBELL */}
        <path d="M66 49 L76 44 L80 34 L74 32 L70 40 L62 47 Z"
          fill={dark} stroke={c} strokeWidth="1.8" strokeLinejoin="miter"/>
        <path d="M80 34 L82 22 L76 18 L72 28 L74 32 Z"
          fill={dark} stroke={c} strokeWidth="1.8" strokeLinejoin="miter"/>
        <rect x="68" y="11" width="18" height="6" rx="0" fill={c} filter={`url(#glow-${f})`}/>
        <rect x="66" y="7"  width="6" height="14" rx="0" fill={c}/>
        <rect x="80" y="7"  width="6" height="14" rx="0" fill={c}/>
        <rect x="64" y="9"  width="3" height="10" rx="0" fill={`${c}80`}/>
        <rect x="83" y="9"  width="3" height="10" rx="0" fill={`${c}80`}/>

        {/* LEGS */}
        <path d="M18 76 L28 76 L26 88 L16 88 Z"
          fill={dark} stroke={c} strokeWidth="1.8" strokeLinejoin="miter"/>
        <path d="M52 76 L62 76 L64 88 L54 88 Z"
          fill={dark} stroke={c} strokeWidth="1.8" strokeLinejoin="miter"/>
        <rect x="14" y="86" width="14" height="4" rx="0" fill={c} opacity="0.9"/>
        <rect x="52" y="86" width="14" height="4" rx="0" fill={c} opacity="0.9"/>

        {f === "fire" && (<><text x="28" y="6" fontSize="10">🔥</text><text x="48" y="5" fontSize="8">🔥</text></>)}
        {f === "celebrate" && (<><text x="14" y="6" fontSize="9">✨</text><text x="56" y="5" fontSize="9">🎉</text></>)}
        {f === "sleepy" && <text x="58" y="10" fontSize="10">💤</text>}
        {f === "shocked" && <text x="58" y="8" fontSize="10">❗</text>}
        {f === "proud" && <text x="58" y="8" fontSize="10">⭐</text>}
        {f === "coach" && <text x="58" y="8" fontSize="10">📋</text>}
        {f === "warning" && <text x="58" y="8" fontSize="10">⚠️</text>}
      </svg>
    </div>
  );
}

function getBruxContext(sessions, todayPlanned, streak, inNewSession = false) {
  const today = new Date(); today.setHours(0,0,0,0);
  const todayStr2 = today.toISOString().slice(0,10);
  const sorted = [...sessions].sort((a,b) => b.date.localeCompare(a.date));
  const lastSession = sorted[0];
  const daysSinceLast = lastSession
    ? Math.round((today - new Date(lastSession.date + "T00:00:00")) / 86400000) : 999;
  const trainedToday = sessions.some(s => s.date === todayStr2);
  const hour = new Date().getHours();
  const totalSessions = sessions.length;

  // Músculo más descuidado
  const lastTrained = {};
  sessions.forEach(s => {
    (s.exercises||[]).forEach(ex => {
      const db = EXERCISE_DB.find(e => e.name === ex.name);
      if (db?.muscle && (!lastTrained[db.muscle] || s.date > lastTrained[db.muscle])) lastTrained[db.muscle] = s.date;
    });
  });
  const muscleAge = MUSCLES.filter(m => m !== "Cardio").map(m => {
    if (!lastTrained[m]) return { muscle:m, days:999, never:true };
    return { muscle:m, days:Math.round((today - new Date(lastTrained[m]+"T00:00:00"))/86400000), never:false };
  }).sort((a,b) => b.days - a.days);
  const neglected = muscleAge[0];

  // Músculo más esta semana
  const weekSessions = sessions.filter(s => (today - new Date(s.date+"T00:00:00"))/86400000 <= 7);
  const weekMuscles = {};
  weekSessions.forEach(s => (s.exercises||[]).forEach(ex => {
    const db = EXERCISE_DB.find(e => e.name === ex.name);
    if (db?.muscle) weekMuscles[db.muscle] = (weekMuscles[db.muscle]||0) + 1;
  }));
  const mostThisWeek = Object.entries(weekMuscles).sort((a,b)=>b[1]-a[1])[0]?.[0];

  // PRs recientes (últimas 2 semanas)
  const recentPRs = [];
  const recent2w = sessions.filter(s => (today - new Date(s.date+"T00:00:00"))/86400000 <= 14);
  recent2w.forEach(s => {
    (s.exercises||[]).forEach(ex => {
      const w = ex.sets?.length>0 ? Math.max(...ex.sets.map(st=>parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
      const prevBest = sessions.filter(ps=>ps.date<s.date).flatMap(ps=>(ps.exercises||[]).filter(pe=>pe.name===ex.name))
        .reduce((b,pe)=>Math.max(b,parseFloat(pe.weight)||0),0);
      if (w>prevBest && w>0) recentPRs.push({ name:ex.name, weight:w, muscle:EXERCISE_DB.find(e=>e.name===ex.name)?.muscle });
    });
  });

  // Deterministic seed para variar mensajes por día (no al azar cada render)
  const seed = parseInt(todayStr2.replace(/-/g,"")) % 7;

  // ── 1. Sin sesiones ──
  if (sessions.length === 0) {
    return { mood:"hype", title:"¡Hora de empezar!", message:"Soy Brux, tu compañero de gym. Registra tu primera sesión y te ayudo a mejorar cada semana. 💪", cta:null };
  }

  // ── 2. Ya entrenó hoy — dashboard ──
  if (trainedToday && !inNewSession) {
    const ts = sorted.find(s=>s.date===todayStr2);
    const muscle = ts?.exercises?.[0]?.name ? EXERCISE_DB.find(e=>e.name===ts.exercises[0].name)?.muscle : null;
    const exCount = ts?.exercises?.length || 0;
    const hasPR = recentPRs.some(p => p.muscle === muscle);
    if (hasPR) {
      const pr = recentPRs.find(p=>p.muscle===muscle);
      return { mood:"celebrate", title:`¡Nuevo PR en ${pr.name}! 🏆`, message:`${pr.weight}kg. Brux va a hablar de esto toda la semana. Merecido.`, cta:null };
    }
    const msgs = muscle ? [
      `${exCount} ejercicios de ${muscle.toLowerCase()} registrados. Mañana lo vas a sentir, y eso es progreso.`,
      `${muscle} trabajado al máximo hoy. Brux toma nota. Descansa bien.`,
      `Sólido. ${exCount > 0 ? `${exCount} ejercicios terminados.` : ""} El descanso también es parte del entrenamiento.`,
      `Brux registró ${muscle} como trabajado. Ahora a recuperar bien. 💤`,
      `${muscle} al límite hoy. Así se construye músculo de verdad. 🏗️`,
      `${exCount} ejercicios para ${muscle.toLowerCase()}. Brux lo llama una buena sesión.`,
      `${muscle} completado. Mañana ese músculo te lo va a agradecer (o no, pero valió la pena).`,
    ] : [
      "Sesión guardada. Brux está orgulloso, aunque no lo parezca.",
      "Entrenamiento registrado. ¡Bien hecho! 💪 Ahora a descansar.",
      "Brux archivó tu sesión. Cada una suma. Cada una cuenta.",
      "Registrado y guardado. Así se construye el historial de un campeón. 📋",
      "Sesión en el libro. Brux ya está preparando la próxima. 🔜",
      "Todo guardado. Brux dice: descansá bien, que mañana hay más. 💤",
      "Hecho. Otro día que no te vas a arrepentir. 🙌",
    ];
    return { mood:"proud", title:ts?.workout ? `✅ ${ts.workout} — ¡listo!` : "✅ ¡Entrenamiento registrado!", message:msgs[seed % msgs.length], cta:null };
  }

  // ── 2b. Ya entrenó hoy — nueva sesión (doble sesión) ──
  if (trainedToday && inNewSession) {
    const ts = sorted.find(s=>s.date===todayStr2);
    const muscle = ts?.exercises?.[0]?.name ? EXERCISE_DB.find(e=>e.name===ts.exercises[0].name)?.muscle : null;
    const otros = MUSCLES.filter(m=>m!==muscle&&m!=="Cardio");
    const sugerido = neglected?.muscle && otros.includes(neglected.muscle) ? neglected.muscle : otros[hour%otros.length];
    return {
      mood:"happy", title:"¿Doble sesión hoy? 💪",
      message: muscle && sugerido
        ? `Ya trabajaste ${muscle.toLowerCase()} hoy. ${neglected?.days>5?`${neglected?.never ? `Nunca has entrenado ${sugerido}. ¿Lo sumamos?` : `${sugerido} lleva ${neglected.days} días sin aparecer. ¿Lo sumamos?`}`:`¿Qué tal añadir ${sugerido.toLowerCase()} también?`}`
        : [
            "¡Volviste por más! Brux está impresionado (y orgulloso).",
            "De vuelta en el gym. Brux ya tenía preparada tu rutina.",
            "¡Apareciste! Brux empezaba a preguntar por vos.",
            "Volviste. Eso es lo que separa a los que progresan del resto. 🔑",
            "Brux anotó tu regreso. Bienvenido de vuelta al trabajo real.",
          ][seed % 5],
      cta:sugerido||null, neglectedMuscle:sugerido||null,
    };
  }

  // ── 3. Hay plan de hoy ──
  if (todayPlanned) {
    const prevSamePlan = sessions.filter(s=>s.workout?.toLowerCase()===todayPlanned.toLowerCase());
    const lastSamePlan = prevSamePlan[0];
    const planMsg = lastSamePlan
      ? `La última vez que hiciste ${todayPlanned} fue el ${lastSamePlan.date}. ¿Superamos eso hoy?`
      : `Primera vez con ${todayPlanned}. Brux estará tomando notas.`;
    return { mood:"hype", title:`¡Hoy toca ${todayPlanned.toLowerCase()}! 📅`, message:planMsg, cta:todayPlanned };
  }

  // ── 4. Mucho tiempo sin entrenar ──
  if (daysSinceLast >= 14) {
    const msgs = [
      `${daysSinceLast} días. Brux pensó que te habías mudado a otro gimnasio. Bienvenido de vuelta.`,
      `Dos semanas sin verte. Tus músculos preguntaron si sigues vivo. ¡Vuelve hoy!`,
      `${daysSinceLast} días es mucho tiempo. Brux no te va a juzgar... solo te va a poner a trabajar.`,
      `Reaparición épica después de ${daysSinceLast} días. Brux ya tiene tu rutina lista.`,
      `${daysSinceLast} días de ausencia. El gym cambió un poco, pero el hierro pesa igual. ¿Volvemos?`,
      `Brux marcó ${daysSinceLast} días en el calendario. Hoy se borra esa racha mala. 🔄`,
    ];
    return { mood:"shocked", title:`¡${daysSinceLast} días sin verte! 😱`, message:msgs[seed%msgs.length], cta:null };
  }
  if (daysSinceLast >= 7) {
    const msgs7 = [
      `Brux no va a juzgarte... mucho. ${daysSinceLast} días es bastante. ¿Volvemos hoy?`,
      `Una semana entera. El cuerpo extraña moverse. Hoy es el día. 💪`,
      `${daysSinceLast} días sin sudar. Brux ya extrañaba verte por acá.`,
      `La semana se fue rápido. Pero hoy arrancamos de nuevo. Sin drama. 🔁`,
      `${daysSinceLast} días. Brux no dice nada, solo te abre la puerta del gym. 🚪`,
    ];
    return { mood:"shocked", title:`¡${daysSinceLast} días sin entrenar! 😱`,
      message:msgs7[seed%msgs7.length], cta:null };
  }
  if (daysSinceLast >= 3) {
    const msgs = [
      `${daysSinceLast} días de pausa. No es el fin del mundo, pero Brux recomienda volver hoy.`,
      `Brux lleva ${daysSinceLast} días esperándote. El gimnasio también.`,
      `${daysSinceLast} días sin registrar nada. ¿Fue descanso activo o quedó pendiente? Todo bien, hoy es un buen momento para retomar.`,
      `${daysSinceLast} días de recuperación. Si ya descansaste suficiente, hoy es el momento. 🎯`,
      `Brux no dice que te apures, pero ${daysSinceLast} días ya es suficiente descanso. 😏`,
      `${daysSinceLast} días. El cuerpo ya debería estar recuperado. ¿Lo confirmamos hoy?`,
      `Pequeña pausa de ${daysSinceLast} días. Normal. Retomemos donde lo dejamos. 🔙`,
    ];
    return { mood:"warning", title:`${daysSinceLast} días sin entrenar...`, message:msgs[seed%msgs.length], cta:null };
  }

  // ── 5. Racha fuerte ──
  if (streak >= 14) {
    return { mood:"fire", title:`🔥 ¡${streak} semanas seguidas!`,
      message:`Brux está registrando todo. ${streak} semanas cumpliendo tu meta es algo serio. Pronto todos te van a pedir consejos.`, cta:null };
  }
  if (streak >= 7) {
    return { mood:"fire", title:`🔥 Racha de ${streak} semanas`,
      message:`Casi dos meses cumpliendo tu meta cada semana. Brux dice que esto ya no es suerte, es hábito.`, cta:null };
  }
  if (daysSinceLast === 1 && streak >= 3) {
    return { mood:"happy", title:`¡${streak} semanas en racha! 🔥`,
      message:`Cumpliste tu meta ${streak} semanas seguidas. Brux lleva la cuenta.`, cta:null };
  }

  // ── 6. PR reciente ──
  if (recentPRs.length > 0) {
    const pr = recentPRs[0];
    return { mood:"celebrate", title:`¡Récord en ${pr.name}! 🏆`,
      message:`${pr.weight}kg. Brux lo anota. Sigue así y necesitarás un estante más grande para los trofeos.`, cta:null };
  }

  // ── 7. Músculo muy descuidado ──
  if (neglected && neglected.days >= 10 && !neglected.never) {
    const sarcMsgs = [
      `${neglected.muscle} lleva ${neglected.days} días sin aparecer. Brux no va a decir nada... pero lo piensa.`,
      `¿${neglected.muscle}? Brux buscó en el historial y no lo encuentra desde hace ${neglected.days} días. Curioso.`,
      `${neglected.days} días sin trabajar ${neglected.muscle.toLowerCase()}. Brux sugiere darle una oportunidad.`,
      `${neglected.muscle} lleva ${neglected.days} días de vacaciones no autorizadas. Brux lo anota.`,
      `${neglected.days} días ignorando ${neglected.muscle.toLowerCase()}. Los músculos también se ofenden.`,
      `Brux revisó tu historial y ${neglected.muscle.toLowerCase()} está esperando hace ${neglected.days} días. ¿Hoy?`,
      `${neglected.muscle} te va a mandar una carta pronto si seguís así. Ya van ${neglected.days} días. 📬`,
    ];
    return { mood:"sarcastic", title:`${neglected.muscle} lleva ${neglected.days} días esperando`,
      message:sarcMsgs[seed%sarcMsgs.length], cta:neglected.muscle, neglectedMuscle:neglected.muscle, neglectedDays:neglected.days };
  }

  // ── 8. Mismo músculo mucho esta semana ──
  if (mostThisWeek && (weekMuscles[mostThisWeek]||0) >= 3) {
    return { mood:"coach", title:`Ojo con ${mostThisWeek}... 📋`,
      message:`${weekMuscles[mostThisWeek]} sesiones de ${mostThisWeek.toLowerCase()} esta semana. Brux recomienda trabajar otro músculo hoy para un balance real.`, cta:null };
  }

  // ── 9. Milestone de sesiones ──
  if ([10,25,50,100,200].includes(totalSessions)) {
    return { mood:"celebrate", title:`¡${totalSessions} sesiones! 🎉`,
      message:`Brux hace una pausa para aplaudirte. ${totalSessions} entrenamientos registrados. Eso no lo hace cualquiera.`, cta:null };
  }

  // ── 10. Coaching basado en historial reciente ──
  if (sessions.length >= 5) {
    const weekCount = weekSessions.length;
    const prevWeekCount = sessions.filter(s => { const d=(today-new Date(s.date+"T00:00:00"))/86400000; return d>7&&d<=14; }).length;
    if (weekCount > prevWeekCount && prevWeekCount > 0) {
      return { mood:"happy", title:"¡Semana más activa! 📈",
        message:`Esta semana llevas ${weekCount} sesiones vs ${prevWeekCount} la semana pasada. Brux lo llama progreso.`, cta:null };
    }
    if (weekCount < prevWeekCount && prevWeekCount >= 3) {
      return { mood:"coach", title:"Ritmo bajó esta semana 📋",
        message:`La semana pasada fueron ${prevWeekCount} sesiones, esta van ${weekCount}. ¿Todo bien? Brux pregunta sin presionar.`, cta:null };
    }
  }

  // ── 11. Genérico por hora, con variación ──
  const morningMsgs = [
    "Los que entrenan temprano tienen el día ganado antes del mediodía. Brux lo confirma.",
    "Buenos días. El gimnasio vacío de mañana es tuyo.",
    "Brux también madruga (en espíritu). ¡A entrenar!",
    "Mañana de entrenamiento. Nada mejor para arrancar el día con todo.",
    "El sol todavía está calentando y tú ya estás en modo gym. Respeto.",
    "Empezar el día entrenando es empezar ganando. Brux lo firma.",
    "Madrugaste para esto. No hay excusa que valga ahora. Vamos. ⚡",
    "La disciplina de mañana es el resultado de tarde. Brux lo promete.",
    "Mientras otros duermen, tú construyes. Así se diferencia el nivel. 🏆",
    "Buenos días, campeón. El gym ya te esperaba desde ayer.",
  ];
  const dayMsgs = [
    "Otro día, otra oportunidad. Sin excusas, dice Brux.",
    "El entrenamiento perfecto es el que haces. El resto es teoría.",
    "Brux espera. No por siempre, pero por ahora sí.",
    "Mitad del día, momento perfecto para mover el cuerpo. Vamos.",
    "Pausa activa o sesión completa, lo que sea. Hoy se entrena. 💪",
    "No dejes que la tarde pase sin sudar un poco. Brux te va a preguntar.",
    "El entrenamiento de hoy es la energía de mañana. Simple. 🔋",
    "Cada sesión suma. Cada día importa. Hoy no es la excepción.",
    "No hay 'mañana empiezo' en el vocabulario de Brux. Solo hoy. 📅",
    "El único límite es el que tú mismo te ponés. Brux vio tu potencial.",
    "Si tu cuerpo dice que no, tu cabeza dice que sí. Eso es entrenamiento real.",
  ];
  const nightMsgs = [
    "Entreno nocturno. Menos gente, más concentración. Brux aprueba.",
    "Terminar el día en el gimnasio tiene algo especial. Vamos.",
    "El único mal entreno es el que no se hace. Brux dixit.",
    "Noche de gym. Los mejores resultados pasan cuando nadie mira. 🌙",
    "Tarde en el día pero temprano en el compromiso. Eso es disciplina.",
    "El gym de noche tiene otro nivel de concentración. Brux lo sabe.",
    "Mientras la ciudad descansa, tú progresas. Eso no tiene precio. ⭐",
    "Cerrar el día entrenando es la mejor forma de no arrepentirse mañana.",
    "Brux prefiere el silencio del gym nocturno. Y vos también, aunque no lo sepas.",
    "Último entrenamiento del día o primero del mañana. Da igual. Cuenta igual. 🔥",
  ];

  if (hour < 7) return { mood:"sleepy", title:"¡Madrugador! 🌅",
    message:"Brux todavía está calentando pero te aplaude igual. Pocos llegan tan temprano.", cta:null };
  if (hour < 12) return { mood:"hype", title:"¡Buenos días! ⚡", message:morningMsgs[seed%morningMsgs.length], cta:null };
  if (hour < 19) return { mood:"happy", title:"¡A darlo todo hoy! 💪", message:dayMsgs[seed%dayMsgs.length], cta:null };
  return { mood:"chill", title:"¡Entreno nocturno! 🌙", message:nightMsgs[seed%nightMsgs.length], cta:null };
}

function BruxMascot({ sessions, todayPlanned, streak, onStartSession, inNewSession = false }) {
  const [bounce, setBounce] = useState(false);
  const [prevMood, setPrevMood] = useState(null);
  const [showTip, setShowTip] = useState(false);
  const ctx = getBruxContext(sessions, todayPlanned, streak, inNewSession);
  const mood = BRUX_MOODS[ctx.mood] || BRUX_MOODS.happy;

  useEffect(() => {
    if (ctx.mood !== prevMood) {
      setBounce(true);
      const t = setTimeout(() => setBounce(false), 500);
      setPrevMood(ctx.mood);
      return () => clearTimeout(t);
    }
  }, [ctx.mood]);

  // Quick stats for coaching tip
  const weekCount = sessions.filter(s => (new Date()-new Date(s.date+"T00:00:00"))/86400000 <= 7).length;
  const totalSessions = sessions.length;

  const suggestions = ctx.neglectedMuscle
    ? EXERCISE_DB.filter(e => e.muscle === ctx.neglectedMuscle).slice(0, 3)
    : [];

  return (
    <div style={{
      background: `linear-gradient(145deg, ${mood.glow}, transparent 70%)`,
      border: `1.5px solid ${mood.color}35`,
      borderRadius: 20, padding: "14px 16px", marginBottom: 18,
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle background pattern */}
      <div style={{ position:"absolute", right:-20, bottom:-20, fontSize:90, opacity:0.03, userSelect:"none", pointerEvents:"none", transform:"rotate(-15deg)", lineHeight:1 }}>🏋️</div>

      {/* Top row: avatar + label + stats strip */}
      <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:10 }}>
        <DumbbellAvatar mood={mood} bounce={bounce} size={60}/>

        <div style={{ flex:1, minWidth:0 }}>
          {/* Brux label */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
            <div style={{ fontSize:8, fontWeight:800, letterSpacing:2, color:mood.color, textTransform:"uppercase" }}>BRUX · TU COACH</div>
            <div style={{ fontSize:9, padding:"1px 6px", borderRadius:10, background:`${mood.color}20`, color:mood.color, fontWeight:700 }}>{mood.label}</div>
          </div>

          {/* Title */}
          <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:20, fontWeight:900, color:"var(--text)", lineHeight:1.15, marginBottom:3 }}>
            {ctx.title}
          </div>

          {/* Message */}
          <div style={{ fontSize:12.5, color:"var(--text-muted)", lineHeight:1.55 }}>
            {ctx.message}
          </div>
        </div>
      </div>

      {/* Suggested exercises chips */}
      {suggestions.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
          {suggestions.map(e => (
            <span key={e.name} style={{ fontSize:11, padding:"3px 10px", borderRadius:20, background:`${mood.color}18`, border:`1px solid ${mood.color}35`, color:"var(--text)", fontWeight:600 }}>{e.name}</span>
          ))}
        </div>
      )}

      {/* Stats strip — solo si hay sesiones */}
      {sessions.length > 0 && (
        <div style={{ display:"flex", gap:6, marginBottom: ctx.cta ? 10 : 0 }}>
          {[
            { label: "Esta semana", value: `${weekCount} sesiones`, color: weekCount>=3?"#22c55e":weekCount>=1?"#f59e0b":"#ef4444" },
            { label: "Racha", value: streak > 0 ? `🔥 ${streak}sem` : "0sem", color: streak>=7?"#ef4444":streak>=3?"#f97316":"var(--text-muted)" },
            { label: "Total", value: `${totalSessions}`, color: "var(--text-muted)" },
          ].map(s => (
            <div key={s.label} style={{ flex:1, background:"var(--card)", borderRadius:8, padding:"5px 6px", textAlign:"center", border:"1px solid var(--border)" }}>
              <div style={{ fontSize:9, color:"var(--text-muted)", marginBottom:1 }}>{s.label}</div>
              <div style={{ fontSize:12, fontWeight:800, color:s.color, fontFamily:"Barlow Condensed,sans-serif" }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* CTA Button */}
      {ctx.cta && onStartSession && (
        <button onClick={() => onStartSession(ctx.cta)} style={{
          width:"100%", padding:"10px 16px", marginTop: 2,
          background:`linear-gradient(135deg, ${mood.color}ee, ${mood.color}bb)`,
          border:"none", borderRadius:12, color:"white",
          fontFamily:"Barlow Condensed,sans-serif", fontSize:16, fontWeight:800,
          cursor:"pointer", letterSpacing:0.5,
          boxShadow:`0 4px 16px ${mood.color}35`,
        }}>
          💪 Entrenar {ctx.cta} ahora
        </button>
      )}
    </div>
  );
}

function NeglectedMuscle({ sessions, onStartSession }) {
  // Mantenido por compatibilidad pero ya no se usa directamente — Brux lo reemplaza
  return null;
}


// ─── Comparación semana vs semana ─────────────────────────────────────────────
function WeekComparison({ sessions }) {
  if (!sessions || sessions.length === 0) return null;

  const now = new Date(); now.setHours(0,0,0,0);
  const getWeekSessions = (daysAgoStart, daysAgoEnd) =>
    sessions.filter(s => {
      const d = new Date(s.date + "T00:00:00");
      const ago = Math.round((now - d) / 86400000);
      return ago >= daysAgoStart && ago < daysAgoEnd;
    });

  const thisWeek = getWeekSessions(0, 7);
  const lastWeek = getWeekSessions(7, 14);

  if (thisWeek.length === 0 && lastWeek.length === 0) return null;

  const calcVol = (ss) => ss.reduce((acc, s) =>
    acc + (s.exercises || []).reduce((a, ex) => {
      const sets = ex.sets?.length > 0 ? ex.sets : [{ weight: ex.weight, reps: ex.reps }];
      return a + sets.reduce((sv, st) => sv + (parseFloat(st.weight)||0) * (parseFloat(st.reps)||1), 0);
    }, 0), 0);

  const thisVol = Math.round(calcVol(thisWeek));
  const lastVol = Math.round(calcVol(lastWeek));

  const calcPRs = (ss) => {
    const prs = new Set();
    ss.forEach(s => (s.exercises||[]).forEach(ex => {
      const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
      const sTs1 = new Date(s.date+"T00:00:00").getTime();
      const prevBest = sessions
        .filter(ps => new Date(ps.date+"T00:00:00").getTime() < sTs1)
        .flatMap(ps => (ps.exercises||[]).filter(pe => pe.name === ex.name))
        .reduce((b, pe) => Math.max(b, parseFloat(pe.weight)||0), 0);
      if (w > prevBest && w > 0) prs.add(`${s.id}-${ex.name}`);
    }));
    return prs.size;
  };

  const thisPRs = calcPRs(thisWeek);
  const lastPRs = calcPRs(lastWeek);

  const metrics = [
    { label: "Sesiones", this: thisWeek.length, last: lastWeek.length, fmt: v => v },
    { label: "Volumen", this: thisVol, last: lastVol, fmt: v => v >= 1000 ? `${(v/1000).toFixed(1)}t` : `${v}kg` },
    { label: "PRs", this: thisPRs, last: lastPRs, fmt: v => v },
  ];

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-label">📊 Esta semana vs semana anterior</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {metrics.map(m => {
          const diff = m.this - m.last;
          const pct = m.last > 0 ? Math.round((diff / m.last) * 100) : null;
          const better = diff > 0;
          const same = diff === 0;
          const color = same ? "var(--text-muted)" : better ? "#22c55e" : "#f97316";
          return (
            <div key={m.label} style={{ background: "var(--input-bg)", border: `1px solid ${same ? "var(--border)" : better ? "rgba(34,197,94,0.3)" : "rgba(249,115,22,0.3)"}`, borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 26, fontWeight: 900, color }}>
                {m.fmt(m.this)}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                vs {m.fmt(m.last)} sem. ant.
              </div>
              {pct !== null && (
                <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 4 }}>
                  {better ? "▲" : diff < 0 ? "▼" : "="} {pct !== null ? `${Math.abs(pct)}%` : ""}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Progresión Automática Inteligente ────────────────────────────────────────
function getProgressionSuggestion(exName, sessions) {
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
function generateInsights(sessions, bodyStats) {
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

function Dashboard({ sessions, bodyStats, weeklyGoal, onGoalClick, onBadgesClick, onStartSession, onInsightsClick, coachRoutines = [], onOpenCoach, onStartCoachRoutine, user }) {
  const total = sessions.length;
  const thisWeek = sessions.filter(s => (new Date() - new Date(s.date + "T00:00:00")) / 86400000 <= 7).length;
  const exCount = {};
  sessions.forEach(s => (s.exercises || []).forEach(ex => { exCount[ex.name] = (exCount[ex.name] || 0) + 1; }));
  const topEx = Object.entries(exCount).sort((a, b) => b[1] - a[1])[0];
  const wCount = {};
  sessions.forEach(s => { wCount[s.workout] = (wCount[s.workout] || 0) + 1; });
  const topW = Object.entries(wCount).sort((a, b) => b[1] - a[1])[0];
  const totalVol = sessions.reduce((acc, s) => acc + (s.exercises || []).reduce((a, ex) => a + (parseFloat(ex.weight) || 0) * (parseFloat(ex.reps) || 1), 0), 0);

  // Streak (weekly)
  const weeklyTarget = weeklyGoal?.target || 3;
  const streak = getStreak(sessions, weeklyTarget);

  // Progress this week
  const thisWeekSessions = sessions.filter(s => {
    const getMonday = (d) => { const date = new Date(d); date.setHours(0,0,0,0); const day = date.getDay(); date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day)); return date; };
    const mon = getMonday(new Date()); mon.setHours(0,0,0,0);
    const sd = new Date(s.date + "T00:00:00"); sd.setHours(0,0,0,0);
    return sd >= mon;
  }).length;

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

  const totalPRs = Object.keys(prs).length;

  const stats = [
    { icon: "🏋️", label: "Sesiones totales", value: total },
    { icon: "🔥", label: "Esta semana", value: thisWeek },
    { icon: "🔑", label: "Racha actual", value: streak === 1 ? "1 semana" : `${streak} semanas` },
    { icon: "🏆", label: "Récords personales", value: totalPRs > 0 ? totalPRs : "—" },
    { icon: "💪", label: "Rutina favorita", value: topW ? topW[0] : "—" },
    { icon: "⚖️", label: "Volumen total", value: totalVol > 0 ? `${(totalVol / 1000).toFixed(1)}t` : "—" },
  ];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 20, flexWrap:"wrap", gap:8 }}>
        <div className="section-title" style={{ margin:0 }}>Dashboard</div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {weeklyGoal?.target > 0 && (() => {
            const tw = sessions.filter(s => (new Date()-new Date(s.date+"T00:00:00"))/86400000 <= 7).length;
            const done = tw >= weeklyGoal.target;
            return (
              <button onClick={onGoalClick} style={{
                background: done?"rgba(34,197,94,0.1)":"rgba(59,130,246,0.08)",
                border:`1px solid ${done?"rgba(34,197,94,0.35)":"rgba(59,130,246,0.25)"}`,
                color:done?"#22c55e":"var(--accent)",
                borderRadius:10, padding:"7px 14px",
                fontSize:12, fontWeight:700, cursor:"pointer",
                display:"flex", alignItems:"center", gap:5, height:34
              }}>🎯 {tw}/{weeklyGoal.target}</button>
            );
          })()}
          <button onClick={onBadgesClick} style={{
            background:"rgba(245,158,11,0.1)",
            border:"1px solid rgba(245,158,11,0.35)",
            color:"#f59e0b",
            borderRadius:10, padding:"7px 14px",
            fontSize:12, fontWeight:700, cursor:"pointer",
            display:"flex", alignItems:"center", gap:5, height:34
          }}>🏅 {BADGE_DEFS.filter(b=>b.check(sessions,getPRs(sessions))).length}/{BADGE_DEFS.length}</button>
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

      <BruxMascot sessions={sessions} todayPlanned={""} streak={streak} onStartSession={onStartSession} />

      {/* Banner: Rutina del coach */}
      {coachRoutines.length > 0 && (() => {
        const todayDow = (new Date().getDay() + 6) % 7;
        const todayRoutine = coachRoutines.find(r => Number(r.dayOfWeek) === todayDow) || coachRoutines[0];
        const isToday = Number(todayRoutine.dayOfWeek) === todayDow;
        const todayDateStr = new Date().toISOString().slice(0,10);
        const alreadyDone = sessions.some(s => s.date === todayDateStr &&
          (s.workout === todayRoutine.name || s.workout === todayRoutine.routineName));
        return (
          <div style={{
            background: alreadyDone ? "rgba(34,197,94,0.07)" : "rgba(232,255,0,0.04)",
            border: `2px solid ${alreadyDone ? "rgba(34,197,94,0.4)" : "var(--accent)"}`,
            borderRadius: 12, marginBottom: 14, overflow: "hidden",
            boxShadow: alreadyDone ? "none" : "0 0 24px rgba(232,255,0,0.12)",
          }}>
            <div style={{
              background: alreadyDone ? "rgba(34,197,94,0.15)" : "rgba(232,255,0,0.12)",
              padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
              borderBottom: `1px solid ${alreadyDone ? "rgba(34,197,94,0.2)" : "rgba(232,255,0,0.15)"}`,
            }}>
              <span style={{fontSize:10,fontWeight:900,letterSpacing:2,textTransform:"uppercase",
                color: alreadyDone ? "#22c55e" : "var(--accent)"}}>
                {alreadyDone ? "✅ RUTINA COMPLETADA HOY" : isToday ? "⚡ TU COACH TE MANDÓ RUTINA PARA HOY" : "🏋️ TU COACH TE ASIGNÓ UNA RUTINA"}
              </span>
            </div>
            <div style={{padding:"14px 16px", display:"flex", alignItems:"center", gap:14}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"Barlow Condensed, sans-serif", fontSize:22,fontWeight:900,
                  letterSpacing:1, textTransform:"uppercase", color:"var(--text)",marginBottom:6}}>
                  {todayRoutine.name || todayRoutine.routineName || "Entrenamiento"}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {(todayRoutine.exercises||[]).slice(0,4).map((ex,i)=>(
                    <span key={i} style={{fontSize:10,background:"var(--card)",border:"1px solid var(--border)",
                      borderRadius:4,padding:"2px 8px",color:"var(--text-muted)",fontWeight:600}}>
                      {ex.name||ex}
                    </span>
                  ))}
                  {(todayRoutine.exercises||[]).length > 4 &&
                    <span style={{fontSize:10,color:"var(--text-muted)"}}>+{todayRoutine.exercises.length-4} más</span>}
                </div>
                {coachRoutines.length > 1 && (
                  <button onClick={onOpenCoach} style={{background:"none",border:"none",color:"var(--accent)",
                    fontSize:11,fontWeight:700,cursor:"pointer",padding:"6px 0 0",letterSpacing:0.5}}>
                    Ver todas ({coachRoutines.length}) →
                  </button>
                )}
              </div>
              {!alreadyDone && (
                <button onClick={e=>{e.stopPropagation(); onStartCoachRoutine && onStartCoachRoutine(todayRoutine);}} style={{
                  background:"var(--accent)", border:"none", borderRadius:10,
                  color:"#0a0a0a", fontWeight:900, fontSize:13,
                  padding:"10px 16px", cursor:"pointer", flexShrink:0,
                  display:"flex",alignItems:"center",gap:5,
                  letterSpacing:1, fontFamily:"Barlow Condensed, sans-serif",
                  textTransform:"uppercase", boxShadow:"0 0 16px rgba(232,255,0,0.3)",
                }}>⚡ INICIAR</button>
              )}
            </div>
          </div>
        );
      })()}

      <StreakBanner sessions={sessions} />
      {(() => {
        const ins = generateInsights(sessions, bodyStats);
        if (!ins.length) return null;
        const top = ins.slice(0,3);
        return (
          <div className="card" style={{ marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
              <div className="card-label" style={{ margin:0 }}>💡 Insights</div>
              <button onClick={onInsightsClick} style={{ background:"none", border:"none", color:"var(--accent)", fontSize:12, fontWeight:700, cursor:"pointer", padding:0 }}>
                Ver todos ({ins.length}) →
              </button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {top.map(i => (
                <div key={i.id} onClick={onInsightsClick} style={{ display:"flex", gap:10, alignItems:"center", background:`${i.color}0d`, border:`1px solid ${i.color}30`, borderRadius:10, padding:"10px 12px", cursor:"pointer" }}>
                  <span style={{ fontSize:18, flexShrink:0 }}>{i.icon}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:i.color }}>{i.title}</div>
                    <div style={{ fontSize:12, color:"var(--text-muted)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{i.msg}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div id="training-calendar-section"><TrainingCalendar sessions={sessions} joinedAt={user?.createdAt} /></div>
      <WeekComparison sessions={sessions} />

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
  // For same-day sessions: sort by id alphabetically as stable tiebreaker.
  // Only sessions with a smaller id (i.e. "earlier" within the day) are treated as prior history.
  const prs = new Set();
  const sTs2 = new Date(s.date+"T00:00:00").getTime();
  (s.exercises || []).forEach(ex => {
    const sessWeight = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(ex.weight) || 0;
    const prevBest = allSessions
      .filter(ps => {
        if (ps.id === s.id) return false;
        const psTs = new Date(ps.date+"T00:00:00").getTime();
        if (psTs < sTs2) return true;           // earlier day → always prior
        if (ps.date === s.date) {
            // uid ends with Date.now().toString(36) — extract timestamp for reliable ordering
            const tsOf = id => parseInt(id.slice(-8), 36) || 0;
            return tsOf(ps.id) < tsOf(s.id); // ps was created before s → treat as prior
          }
        return false;
      })
      .flatMap(ps => (ps.exercises || []).filter(pe => pe.name === ex.name))
      .reduce((best, pe) => {
        const pw = pe.sets?.length > 0 ? Math.max(...pe.sets.map(st => parseFloat(st.weight) || 0)) : parseFloat(pe.weight) || 0;
        return Math.max(best, pw);
      }, 0);
    if (sessWeight > prevBest && sessWeight > 0) prs.add(ex.name);
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
      <div className="session-header" onClick={onToggle} style={prs.size > 0 ? { borderLeft: "3px solid #f59e0b", paddingLeft: 10 } : {}}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="session-date">
            {s.date ? (() => {
              const [y,m,d] = s.date.split("-");
              const dow = new Date(+y, +m-1, +d).getDay();
              const dayName = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][dow];
              const monthName = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"][+m-1];
              return `${dayName} ${+d} de ${monthName} del ${y}`;
            })() : ""}
          </span>
          <span className="session-workout">{s.workout}</span>
          {prs.size > 0 && (
            <span style={{ fontSize: 11, background: "rgba(251,191,36,0.18)", border: "1px solid rgba(251,191,36,0.6)", color: "#f59e0b", borderRadius: 8, padding: "3px 9px", fontWeight: 800, display:"flex", alignItems:"center", gap:4 }}>
              🏆 {prs.size} PR{prs.size > 1 ? "s" : ""} — {[...prs].join(", ")}
            </span>
          )}
          <StreakChip sessions={allSessions} compact />        </div>
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
          {/* ── Resumen de sesión ── */}
          {(() => {
            const totalSets = (s.exercises||[]).reduce((a, ex) => a + (ex.sets?.length || 1), 0);
            const totalVol  = Math.round(calcSessionVolume(s));
            const durMins   = s.durationSecs ? Math.round(s.durationSecs / 60) : null;
            const topEx     = (s.exercises||[]).reduce((best, ex) => {
              const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
              return w > (best?.w||0) ? { name: ex.name, w } : best;
            }, null);
            const stats = [
              { icon: "⏱", label: "Duración",  value: durMins ? `${durMins} min` : "—" },
              totalVol  && { icon: "🏋️", label: "Volumen",   value: totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)}t` : `${totalVol}kg` },
              { icon: "🔁", label: "Series",    value: `${totalSets} series` },
              { icon: "💪", label: "Ejercicios", value: `${(s.exercises||[]).length}` },
              topEx     && { icon: "⭐", label: "Top peso",  value: `${topEx.name} ${topEx.w}kg` },
              prs.size  && { icon: "🏆", label: "PRs",       value: `${[...prs].join(", ")}` },
            ].filter(Boolean);
            return (
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: 8, margin: "14px 0 10px",
                padding: "12px 14px",
                background: "var(--input-bg)", borderRadius: 12,
                border: "1px solid var(--border)",
              }}>
                {stats.map((st, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>{st.icon} {st.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st.value}</span>
                  </div>
                ))}
              </div>
            );
          })()}
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
  const [open, setOpen] = useState(true);
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
      boxShadow: "var(--shadow)",
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
// Props: exercises, workout, date, notes, unit, sessions,
//        onSaveSession(finalExercises, elapsedSecs), onBack,
//        floatTimer, setFloatTimer,
//        calc1RM, ExerciseGif, uid, numDot
// ─────────────────────────────────────────────────────────────────────────────

function LiveTrainMode({
  exercises, workout, date, notes, unit, sessions,
  onSaveSession, onBack,
  floatTimer, setFloatTimer,
}) {
  // Restore draft if available
  const draft = (() => { try { const d = localStorage.getItem(LIVE_DRAFT_KEY); return d ? JSON.parse(d) : null; } catch { return null; } })();
  const draftMatches = draft && draft.workout === workout && draft.date === date;

  const [elapsed, setElapsed] = useState(() => draftMatches ? (draft.elapsed || 0) : 0);
  const [running, setRunning] = useState(true);
  const [currentEx, setCurrentEx] = useState(() => draftMatches ? (draft.currentEx || 0) : 0);
  const [exData, setExData] = useState(() => {
    if (draftMatches && draft.exData) return draft.exData;
    return exercises.map(ex => ({
      ...ex,
      restSecs: ex.restSecs || null,
      sets: ex.sets?.length
        ? ex.sets.map(s => ({ ...s, done: false }))
        : Array.from({ length: parseInt(ex.series) || 3 }, () => ({
            id: uid(), weight: ex.weight || "", reps: ex.reps || "", done: false
          })),
    }));
  });
  const [restoredDraft] = useState(draftMatches);
  const [showSummary, setShowSummary] = useState(false);
  const timerRef = useRef();
  const restRef = useRef();
  const [restTimer, setRestTimer] = useState(null); // null | { total, left }

  // Countdown de descanso
  useEffect(() => {
    if (restTimer && restTimer.left > 0) {
      restRef.current = setInterval(() => {
        setRestTimer(prev => {
          if (!prev || prev.left <= 1) { clearInterval(restRef.current); return prev ? { ...prev, left: 0 } : null; }
          return { ...prev, left: prev.left - 1 };
        });
      }, 1000);
    }
    return () => clearInterval(restRef.current);
  }, [restTimer?.total, restTimer?.left]);

  function startRest(secs) {
    clearInterval(restRef.current);
    setRestTimer({ total: secs, left: secs });
  }

  const REST_OPTS_LIVE = [
    { label: "1m", secs: 60 },
    { label: "1.5m", secs: 90 },
    { label: "2m", secs: 120 },
    { label: "3m", secs: 180 },
  ];
  const [defaultRest, setDefaultRest] = useState(() => load("gym_default_rest", 90));

  function saveDefaultRest(secs) {
    setDefaultRest(secs);
    store("gym_default_rest", secs);
  }

  useEffect(() => {
    if (running) timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    else clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [running]);

  // Autosave draft on every change
  useEffect(() => {
    try {
      localStorage.setItem(LIVE_DRAFT_KEY, JSON.stringify({ workout, date, elapsed, currentEx, exData }));
    } catch {}
  }, [exData, elapsed, currentEx]);

  const fmt = s => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
  const [showRestoredBanner, setShowRestoredBanner] = useState(restoredDraft);
  useEffect(() => {
    if (showRestoredBanner) { const t = setTimeout(() => setShowRestoredBanner(false), 3500); return () => clearTimeout(t); }
  }, [showRestoredBanner]);
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
      const exRestSecs = exData[exIdx]?.restSecs ?? defaultRest;
      startRest(exRestSecs);
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
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
    const completionPct = exData.length > 0 ? Math.round(completedSets / exData.reduce((a,e)=>a+e.sets.length,0) * 100) : 0;

    // Pick celebration mood based on performance
    const celebMood = completionPct >= 90 ? BRUX_MOODS.celebrate
      : completionPct >= 60 ? BRUX_MOODS.proud
      : BRUX_MOODS.happy;

    const celebMessages = completionPct >= 90
      ? [
          "¡Lo completaste todo! Eso es nivel élite 🔥",
          "¡100%! Eres una bestia del gym 🏆",
          "¡Brutal! Brux está sin palabras. Buenas, claro. 💪",
          "Sesión perfecta. Así se construye un cuerpo de acero. 🔩",
          "Todo completado. Cada rep contó. Brux lo vio todo.",
          "¡Imparable! Eso no lo hace cualquiera. Bien hecho. 🎯",
          "Nivel desbloqueado. Brux actualiza tu expediente. 📋",
          "¿100%? Brux se quita el sombrero. Literalmente. 🎩",
          "Completaste todo. El gym te debe una reverencia. 🙇",
        ]
      : completionPct >= 60
      ? [
          "¡Buen trabajo! Cada serie cuenta 👊",
          "¡Sesión completada! Mañana más 💪",
          "¡Así se hace! Consistencia es la clave 🗝️",
          "Más de la mitad bien ejecutada. Eso se llama progreso real.",
          "Sólido. No todos los días son perfectos y está bien. ✅",
          "Trabajo hecho. Brux anota el esfuerzo, no solo el resultado.",
          "Buen ritmo hoy. Con esto se construyen hábitos de hierro. 🏗️",
          "Sesión cerrada. Tu yo del futuro te lo va a agradecer. ⏳",
          "No fue el 100%, pero fue tuyo. Y eso vale mucho. 💛",
        ]
      : [
          "Algo es algo. Lo importante es aparecer 💯",
          "¡Viniste y eso ya es una victoria! 🌟",
          "El primer paso siempre es el más difícil. ¡Seguí! 🚀",
          "Días difíciles también cuentan. Brux lo respeta.",
          "Hoy no fue tu mejor día y de todas formas entrenaste. Eso es carácter. 💪",
          "Medio entrenamiento sigue siendo mejor que ninguno. Siempre.",
          "El cuerpo no siempre coopera. Lo que importa es que volviste. 🔄",
          "Brux sabe que no fue fácil hoy. Por eso vale más. 🙌",
          "Apareciste. Eso ya te pone en el top. El resto viene solo. 📈",
        ];
    const celebMsg = celebMessages[Math.floor(Date.now()/86400000) % celebMessages.length];

    return (
      <div style={{
        minHeight: "calc(100vh - 60px)", background: "var(--bg)",
        display: "flex", flexDirection: "column", padding: "28px 20px",
        animation: "fadeIn 0.4s ease",
      }}>
        {/* Mascota celebrando — animada */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <style>{`
            @keyframes dumbbellCelebrate {
              0%   { transform: scale(1) rotate(0deg); }
              15%  { transform: scale(1.3) rotate(-15deg); }
              30%  { transform: scale(1.2) rotate(12deg); }
              45%  { transform: scale(1.25) rotate(-10deg); }
              60%  { transform: scale(1.15) rotate(8deg); }
              75%  { transform: scale(1.1) rotate(-5deg); }
              100% { transform: scale(1) rotate(0deg); }
            }
            @keyframes confettiFall {
              0%   { transform: translateY(-20px) rotate(0deg); opacity:1; }
              100% { transform: translateY(60px) rotate(360deg); opacity:0; }
            }
          `}</style>

          {/* Confetti particles */}
          <div style={{ position: "relative", display: "inline-block" }}>
            {["🎊","✨","🌟","💥","🎉","⭐","🔥","💫"].map((e, i) => (
              <div key={i} style={{
                position: "absolute",
                left: `${10 + (i * 11) % 80}%`,
                top: `${(i * 17) % 40}%`,
                fontSize: 16 + (i % 3) * 4,
                animation: `confettiFall ${0.8 + (i % 4) * 0.3}s ease-out ${i * 0.1}s forwards`,
                pointerEvents: "none",
              }}>{e}</div>
            ))}

          {/* Personaje celebrando */}
          <div style={{ animation: "dumbbellCelebrate 1s ease-out 0.2s both", display: "inline-block" }}>
            <svg viewBox="0 0 80 88" width="120" height="132">
              <defs>
                <filter id="glowCelebrate"><feGaussianBlur stdDeviation="3.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                <filter id="neonCelebrate"><feGaussianBlur stdDeviation="1.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              {/* Aura glow */}
              <ellipse cx="40" cy="44" rx="36" ry="40" fill={`${celebMood.color}20`} filter="url(#glowCelebrate)"/>
              {/* HEAD */}
              <path d="M22 8 L58 8 L60 14 L60 36 L54 42 L26 42 L20 36 L20 14 Z"
                fill="#0a0a0a" stroke={celebMood.color} strokeWidth="2.2" strokeLinejoin="miter" filter="url(#glowCelebrate)"/>
              <path d="M24 8 L56 8 L58 10 L22 10 Z" fill={celebMood.color}/>
              <path d="M26 16 L54 16 L56 20 L56 36 L52 39 L28 39 L24 36 L24 20 Z"
                fill="#111" stroke={`${celebMood.color}70`} strokeWidth="1" strokeLinejoin="miter"/>
              {/* Star eyes */}
              {completionPct >= 90
                ? (<>
                    <text x="27" y="27" fontSize="9" textAnchor="middle" fill={celebMood.color} fontWeight="900">★</text>
                    <text x="37" y="27" fontSize="9" textAnchor="middle" fill={celebMood.color} fontWeight="900">★</text>
                  </>)
                : (<>
                    <rect x="24" y="21" width="7" height="5" rx="1" fill={celebMood.color}/>
                    <rect x="33" y="21" width="7" height="5" rx="1" fill={celebMood.color}/>
                    <rect x="25" y="22" width="2" height="2" fill="#0a0a0a"/>
                    <rect x="34" y="22" width="2" height="2" fill="#0a0a0a"/>
                  </>)
              }
              {/* Big angular grin */}
              <path d="M25 30 L32 36 L39 30" stroke={celebMood.color} strokeWidth="2.8" fill={`${celebMood.color}35`} strokeLinecap="square" strokeLinejoin="miter"/>
              <line x1="29" y1="30" x2="30" y2="34" stroke={celebMood.color} strokeWidth="1.2" opacity="0.6"/>
              <line x1="32" y1="30.5" x2="32" y2="36" stroke={celebMood.color} strokeWidth="1.2" opacity="0.6"/>
              <line x1="35" y1="30" x2="34" y2="34" stroke={celebMood.color} strokeWidth="1.2" opacity="0.6"/>
              {/* Jaw accents */}
              <line x1="20" y1="32" x2="26" y2="36" stroke={celebMood.color} strokeWidth="1.5" opacity="0.6"/>
              <line x1="60" y1="32" x2="54" y2="36" stroke={celebMood.color} strokeWidth="1.5" opacity="0.6"/>
              {/* NECK */}
              <rect x="33" y="42" width="14" height="7" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.5"/>
              {/* TORSO */}
              <path d="M14 49 L66 49 L62 76 L18 76 Z"
                fill="#0a0a0a" stroke={celebMood.color} strokeWidth="2.2" strokeLinejoin="miter" filter="url(#neonCelebrate)"/>
              <path d="M18 49 L40 49 L38 62 L20 62 Z" fill={`${celebMood.color}25`} stroke={`${celebMood.color}60`} strokeWidth="1"/>
              <path d="M62 49 L40 49 L42 62 L60 62 Z" fill={`${celebMood.color}25`} stroke={`${celebMood.color}60`} strokeWidth="1"/>
              <line x1="40" y1="49" x2="40" y2="76" stroke={celebMood.color} strokeWidth="1.5" opacity="0.7"/>
              <line x1="21" y1="62" x2="59" y2="62" stroke={celebMood.color} strokeWidth="1" opacity="0.35"/>
              <line x1="22" y1="69" x2="58" y2="69" stroke={celebMood.color} strokeWidth="1" opacity="0.35"/>
              {/* LEFT ARM */}
              <path d="M14 49 L4 44 L0 34 L6 32 L10 40 L18 47 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <path d="M0 34 L-2 22 L4 18 L8 28 L6 32 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <rect x="-6" y="11" width="18" height="6" rx="0" fill={celebMood.color} filter="url(#glowCelebrate)"/>
              <rect x="-8" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="8" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="-9" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              <rect x="14" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              {/* RIGHT ARM */}
              <path d="M66 49 L76 44 L80 34 L74 32 L70 40 L62 47 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <path d="M80 34 L82 22 L76 18 L72 28 L74 32 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <rect x="68" y="11" width="18" height="6" rx="0" fill={celebMood.color} filter="url(#glowCelebrate)"/>
              <rect x="66" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="80" y="7" width="6" height="14" rx="0" fill={celebMood.color}/>
              <rect x="64" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              <rect x="83" y="9" width="3" height="10" rx="0" fill={`${celebMood.color}80`}/>
              {/* LEGS */}
              <path d="M18 76 L28 76 L26 88 L16 88 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <path d="M52 76 L62 76 L64 88 L54 88 Z" fill="#0a0a0a" stroke={celebMood.color} strokeWidth="1.8" strokeLinejoin="miter"/>
              <rect x="14" y="86" width="14" height="4" fill={celebMood.color} opacity="0.9"/>
              <rect x="52" y="86" width="14" height="4" fill={celebMood.color} opacity="0.9"/>
              {/* FX */}
              <text x="14" y="6" fontSize="10">✨</text>
              <text x="56" y="5" fontSize="10">🎉</text>
            </svg>
          </div>
          </div>

          {/* Mensaje de celebración */}
          <div style={{ marginTop: 12, padding: "10px 20px", background: `${celebMood.color}15`, border: `1px solid ${celebMood.color}40`, borderRadius: 14, display: "inline-block", maxWidth: 320 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color: celebMood.color, textTransform: "uppercase", marginBottom: 2 }}>🏋️ tu compañero de gym</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{celebMsg}</div>
          </div>
        </div>

        {/* Título */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 38, fontWeight: 900, letterSpacing: 1, marginBottom: 4 }}>
            ¡Sesión completada!
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>{workout} · {fmt(elapsed)}</div>
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
                .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.weight || s.reps) }))
                .filter(ex => ex.sets.length > 0);
              onSaveSession(finalExercises, elapsed);
            }}
            style={{
              flex: 2, background: "var(--accent)", border: "none",
              color: "#0a0a0a", borderRadius: 12, padding: 14,
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 20, fontWeight: 900, letterSpacing: 1, cursor: "pointer",
              boxShadow: "0 0 24px rgba(232,255,0,0.3)",
            }}
          >
            ✅ GUARDAR SESIÓN
          </button>
        </div>
      </div>
    );
  }

  // ── PANTALLA PRINCIPAL DE ENTRENAMIENTO ─────────────────────────────────────
  return (
    <div style={{ position: "fixed", inset: 0, background: "var(--bg)", display: "flex", flexDirection: "column", zIndex: 400, overflowY: "auto" }}>
      {/* ── Sticky header ── */}
      <div style={{
        background: "var(--surface)", borderBottom: "1px solid var(--border)",
        padding: "10px 16px", display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0, position: "fixed", top: 0, left: 0, right: 0, zIndex: 500,
      }}>
        <button
          onClick={() => {
            const hasDone = exData.some(ex => ex.sets.some(s => s.done));
            try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {}
            if (hasDone) {
              if (!window.confirm("¿Salir del entrenamiento? El borrador guardado se eliminará.")) return;
            }
            onBack();
          }}
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
            {showRestoredBanner && (
              <span style={{ marginLeft: 8, fontSize: 11, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", borderRadius: 6, padding: "2px 8px", fontWeight: 700, letterSpacing: 0.5, verticalAlign: "middle" }}>
                ✅ Sesión restaurada
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {doneSets}/{totalSets} series completadas
          </div>
        </div>

        {/* Cronómetro + pausar en línea */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            fontFamily: "Barlow Condensed, sans-serif", fontSize: 30, fontWeight: 800,
            letterSpacing: 2, color: running ? "var(--accent)" : "var(--text-muted)",
          }}>
            {fmt(elapsed)}
          </div>
          <button
            onClick={() => setRunning(r => !r)}
            style={{
              background: "var(--input-bg)", border: "1px solid var(--border)",
              color: "var(--text-muted)", borderRadius: 8, padding: "5px 10px",
              fontSize: 12, cursor: "pointer", fontFamily: "Barlow, sans-serif",
              fontWeight: 600, flexShrink: 0,
            }}
          >
            {running ? "⏸" : "▶"}
          </button>
        </div>
      </div>

      {/* Spacer para el header fixed */}
      <div style={{ height: 57, flexShrink: 0 }} />
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
                : allDone ? "rgba(232,255,0,0.08)"
                : anyDone ? "rgba(232,255,0,0.04)"
                : "var(--card)",
              border: `1px solid ${currentEx === i ? "var(--accent)" : allDone ? "rgba(232,255,0,0.3)" : "var(--border)"}`,
              color: currentEx === i ? "#0a0a0a" : allDone ? "var(--accent)" : "var(--text-muted)",
              borderRadius: 4, padding: "6px 12px", cursor: "pointer",
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 12, fontWeight: 900,
              whiteSpace: "nowrap", flexShrink: 0, letterSpacing: 1, textTransform: "uppercase",
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
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: 18, gap: 8 }}>
                  <ExerciseGif exName={ex.name} size={100} />
                  <div style={{
                    fontFamily: "Barlow Condensed, sans-serif",
                    fontSize: 28, fontWeight: 800,
                  }}>
                    {ex.name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {doneCount}/{ex.sets.length} series
                  </div>
                  {bestPrev > 0 && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      background: "var(--accent-dim)", border: "1px solid rgba(232,255,0,0.3)",
                      borderRadius: 4, padding: "4px 10px", fontSize: 12, color: "var(--accent)",
                    }}>
                      ★ MEJOR: {bestPrev}kg 1RM
                    </div>
                  )}
                  {/* Per-exercise rest time selector */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 800, letterSpacing: 3, textTransform:"uppercase" }}>DESCANSO</span>
                    {[60, 90, 120, 180].map(secs => {
                      const active = (ex.restSecs ?? defaultRest) === secs;
                      return (
                        <button key={secs} onClick={() => setExData(prev => prev.map((e, i) => i !== currentEx ? e : { ...e, restSecs: secs }))}
                          style={{
                            background: active ? "var(--accent)" : "var(--input-bg)",
                            border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                            color: active ? "#0a0a0a" : "var(--text-muted)",
                            borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                          }}>
                          {secs < 120 ? `${secs}s` : `${secs/60}m`}
                        </button>
                      );
                    })}
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
                      color: s.done ? "var(--accent)" : "var(--text-muted)",
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

              {/* Inline rest timer */}
              <div style={{
                background: "var(--card)", border: `1px solid ${restTimer ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 12, padding: "11px 14px", marginBottom: 18,
                transition: "border-color 0.3s",
              }}>
                {restTimer ? (
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: "var(--accent)", letterSpacing: 3, textTransform: "uppercase", marginBottom: 8 }}>DESCANSANDO</div>
                    <div style={{ height: 5, background: "var(--border)", borderRadius: 10, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ height: "100%", background: "var(--accent)", borderRadius: 10, width: `${(restTimer.left / restTimer.total) * 100}%`, transition: "width 1s linear" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <button onClick={() => setRestTimer(t => ({ ...t, left: Math.max(0, t.left - 15), total: Math.max(15, t.total - 15) }))}
                        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>−15s</button>
                      <div style={{ flex: 1, textAlign: "center", fontFamily: "Barlow Condensed, sans-serif", fontSize: 34, fontWeight: 800, color: "var(--accent)" }}>
                        {restTimer.left === 0 ? "¡Listo!" : fmt(restTimer.left)}
                      </div>
                      <button onClick={() => setRestTimer(t => ({ ...t, left: t.left + 15, total: t.total + 15 }))}
                        style={{ background: "var(--input-bg)", border: "1px solid var(--border)", color: "var(--text)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>+15s</button>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                      {REST_OPTS_LIVE.map(o => (
                        <button key={o.label} onClick={() => startRest(o.secs)}
                          style={{ background: restTimer.total === o.secs ? "var(--accent)" : "var(--input-bg)", border: `1px solid ${restTimer.total === o.secs ? "var(--accent)" : "var(--border)"}`, color: restTimer.total === o.secs ? "#0a0a0a" : "var(--text-muted)", borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>
                          {o.label}
                        </button>
                      ))}
                      <button onClick={() => setRestTimer(null)}
                        style={{ marginLeft: "auto", background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", borderRadius: 8, padding: "3px 10px", cursor: "pointer", fontSize: 11 }}>
                        ✕ Quitar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 3, textTransform: "uppercase" }}>DESCANSO</div>
                        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                          Auto: <span style={{ color: "var(--accent)", fontWeight: 700 }}>{defaultRest < 60 ? `${defaultRest}s` : `${defaultRest/60}m`}</span>
                          <span style={{ margin: "0 4px", opacity: 0.4 }}>·</span>
                          {REST_OPTS_LIVE.map(o => (
                            <button key={o.secs} onClick={() => saveDefaultRest(o.secs)}
                              style={{ background: defaultRest === o.secs ? "var(--accent-dim)" : "none", border: "none", color: defaultRest === o.secs ? "var(--accent)" : "var(--text-muted)", borderRadius: 4, padding: "1px 5px", cursor: "pointer", fontSize: 10, fontWeight: defaultRest === o.secs ? 800 : 400 }}>
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {REST_OPTS_LIVE.map(o => (
                          <button key={o.label} onClick={() => startRest(o.secs)}
                            style={{ background: o.secs === defaultRest ? "var(--accent-dim)" : "var(--input-bg)", border: `1px solid ${o.secs === defaultRest ? "var(--accent)" : "var(--border)"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", color: o.secs === defaultRest ? "var(--accent)" : "var(--text-muted)", fontSize: 11, fontWeight: o.secs === defaultRest ? 700 : 600 }}>
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
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
                      color: "#0a0a0a", borderRadius: 10, padding: 11,
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
                      flex: 2, background: "var(--accent)",
                      border: "none", color: "#0a0a0a", borderRadius: 4, padding: 11,
                      cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                      fontSize: 17, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase",
                      boxShadow: "0 0 20px rgba(232,255,0,0.2)",
                    }}
                  >
                    FINALIZAR →
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

function StreakBanner({ sessions }) {
  const streak = getStreak(sessions);
  if (streak < 1) return null;
  const color = streak >= 90 ? "#f97316" : streak >= 30 ? "#a855f7" : streak >= 14 ? "#3b82f6" : streak >= 7 ? "#22c55e" : "#f59e0b";
  const msg   = streak >= 365 ? "¡LEYENDA VIVIENTE!" : streak >= 90 ? "¡IMPARABLE!" : streak >= 30 ? "¡INCENDIO TOTAL!" : streak >= 14 ? "¡En llamas!" : streak >= 7 ? "¡Semana perfecta!" : "¡Sigue así!";
  // Next milestone
  const milestones = [3,7,14,30,90,365];
  const nextMilestone = milestones.find(m => m > streak) || null;
  const prevMilestone = [...milestones].reverse().find(m => m <= streak) || 0;
  const pct = nextMilestone ? ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100 : 100;

  return (
    <div style={{ background:`linear-gradient(135deg,${color}15,${color}05)`, border:`1px solid ${color}40`, borderRadius:16, padding:"14px 18px", marginBottom:18, boxShadow:`0 4px 24px ${color}15` }}>
      <div style={{ display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ fontSize:36, lineHeight:1, filter:`drop-shadow(0 0 8px ${color}80)` }}>🔥</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:10, fontWeight:800, color, letterSpacing:2, textTransform:"uppercase", marginBottom:1 }}>{msg}</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:38, fontWeight:900, color, lineHeight:1 }}>{streak}</span>
            <span style={{ fontSize:13, color:"var(--text-muted)", fontWeight:500 }}>semanas seguidas</span>
          </div>
        </div>
        {nextMilestone && (
          <div style={{ textAlign:"center", flexShrink:0 }}>
            <div style={{ fontSize:9, color:"var(--text-muted)", fontWeight:600, marginBottom:4 }}>Próximo hito</div>
            <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:20, fontWeight:900, color, lineHeight:1 }}>{nextMilestone}sem</div>
            <div style={{ fontSize:9, color:"var(--text-muted)" }}>faltan {nextMilestone-streak}</div>
          </div>
        )}
      </div>
      {/* Progress bar toward next milestone */}
      {nextMilestone && (
        <div style={{ marginTop:10 }}>
          <div style={{ background:"var(--border)", borderRadius:20, height:5, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${color}80,${color})`, borderRadius:20, transition:"width 0.6s ease", boxShadow:`0 0 6px ${color}60` }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
            <span style={{ fontSize:8, color:"var(--text-muted)" }}>{prevMilestone}sem</span>
            <span style={{ fontSize:8, color:"var(--text-muted)" }}>{nextMilestone}sem</span>
          </div>
        </div>
      )}
    </div>
  );
}

function StreakChip({ sessions, compact = false }) {
  const streak = getStreak(sessions);
  if (streak < 2) return null;
  const color = streak >= 30 ? "#f97316" : streak >= 14 ? "#a855f7" : streak >= 7 ? "#3b82f6" : "#f59e0b";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, background:`${color}18`, border:`1px solid ${color}50`, borderRadius:20, padding: compact ? "2px 7px" : "3px 10px", fontSize: compact ? 10 : 11, fontWeight:700, color, flexShrink:0 }}>
      🔥 {streak}sem
    </span>
  );
}
// ─── Streak Modal ─────────────────────────────────────────────────────────────
function StreakModal({ sessions, user, onClose }) {
  const [teamStreaks, setTeamStreaks] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  const streak = getStreak(sessions);
  const color = streak >= 90 ? "#f97316" : streak >= 30 ? "#a855f7" : streak >= 14 ? "#3b82f6" : streak >= 7 ? "#22c55e" : "#f59e0b";
  const milestones = [3, 7, 14, 30, 90, 180, 365];
  const nextMilestone = milestones.find(m => m > streak) || null;
  const prevMilestone = [...milestones].reverse().find(m => m <= streak) || 0;
  const pct = nextMilestone ? ((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100 : 100;

  // Build last 12 weeks calendar (84 days)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const sessionDates = new Set(sessions.map(s => s.date));

  // Build 12 weeks grid starting from monday 11 weeks ago
  const startDay = new Date(today);
  const dow = (today.getDay() + 6) % 7; // 0=Mon
  startDay.setDate(startDay.getDate() - dow - 77); // go back 11 full weeks + current week

  const weeks = [];
  for (let w = 0; w < 12; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(startDay);
      day.setDate(startDay.getDate() + w * 7 + d);
      const ds = day.toISOString().slice(0, 10);
      const isToday = ds === today.toISOString().slice(0, 10);
      const trained = sessionDates.has(ds);
      const isFuture = day > today;
      week.push({ ds, trained, isToday, isFuture, dayNum: day.getDate(), month: day.getMonth() });
    }
    weeks.push(week);
  }

  // Month labels
  const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const monthLabels = weeks.map((week, wi) => {
    const firstDay = week[0];
    if (wi === 0 || firstDay.dayNum <= 7) return { wi, label: monthNames[firstDay.month] };
    return null;
  }).filter(Boolean);

  // Count active days & best streak
  const totalActiveDays = sessions.length;
  function calcBestStreak(sessions) {
    // Best weekly streak: max consecutive weeks meeting the target
    const weeklyTarget = 3; // default
    const getMonday = (d) => { const date = new Date(d); date.setHours(0,0,0,0); const day = date.getDay(); date.setDate(date.getDate() + (day === 0 ? -6 : 1 - day)); return date; };
    const toKey = (d) => d.toISOString().slice(0,10);
    const weekMap = {};
    sessions.forEach(s => { const mon = toKey(getMonday(new Date(s.date+"T00:00:00"))); weekMap[mon]=(weekMap[mon]||0)+1; });
    const weekKeys = Object.keys(weekMap).sort();
    let best = 0, cur = 0;
    for (let i = 0; i < weekKeys.length; i++) {
      if (weekMap[weekKeys[i]] >= weeklyTarget) {
        if (i > 0) {
          const prev = new Date(weekKeys[i-1]+"T00:00:00");
          const curr = new Date(weekKeys[i]+"T00:00:00");
          const diff = Math.round((curr-prev)/604800000);
          cur = diff === 1 ? cur + 1 : 1;
        } else { cur = 1; }
        best = Math.max(best, cur);
      } else { cur = 0; }
    }
    return best;
  }
  const bestStreak = calcBestStreak(sessions);

  // Load team streaks
  useEffect(() => {
    async function load() {
      setLoadingTeam(true);
      try {
        const raw = localStorage.getItem("gym_my_teams");
        const myTeams = raw ? JSON.parse(raw) : [];
        const allMembers = [];
        for (const t of myTeams.slice(0, 2)) {
          const data = await teamsGet(`team_${t.code}`);
          if (data?.members) {
            Object.values(data.members).forEach(m => {
              if (m.email !== user.email && m.streak != null) {
                if (!allMembers.find(x => x.email === m.email)) {
                  allMembers.push({ name: m.name || m.email.split("@")[0], streak: m.streak, email: m.email });
                }
              }
            });
          }
        }
        // Add self
        const all = [{ name: "Tú", streak, email: user.email, isMe: true }, ...allMembers]
          .sort((a, b) => b.streak - a.streak);
        setTeamStreaks(all);
      } catch(e) { setTeamStreaks([{ name: "Tú", streak, isMe: true }]); }
      setLoadingTeam(false);
    }
    load();
  }, []);

  const DAY_LABELS = ["L","M","X","J","V","S","D"];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480, width: "100%" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🔥 Mi Racha</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Hero streak */}
        <div style={{ textAlign: "center", padding: "10px 0 20px", borderBottom: "1px solid var(--border)", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2, color, textTransform: "uppercase", marginBottom: 4 }}>
            {streak >= 90 ? "¡IMPARABLE!" : streak >= 30 ? "¡EN LLAMAS!" : streak >= 7 ? "¡Semana perfecta!" : "¡Sigue así!"}
          </div>
          <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 72, fontWeight: 900, color, lineHeight: 1, filter: `drop-shadow(0 0 20px ${color}60)` }}>
            {streak}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12 }}>semanas seguidas</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--input-bg)", borderRadius: 8, padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
            ℹ️ La racha cuenta semanas donde cumpliste tu meta de días
          </div>

          {/* Progress toward next milestone */}
          {nextMilestone && (
            <div style={{ maxWidth: 280, margin: "0 auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>
                <span>{prevMilestone}sem</span>
                <span style={{ color, fontWeight: 700 }}>→ {nextMilestone}sem</span>
              </div>
              <div style={{ background: "var(--border)", borderRadius: 20, height: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${color}80, ${color})`, borderRadius: 20, boxShadow: `0 0 10px ${color}60`, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                {nextMilestone - streak === 1 ? "¡La semana que viene llegas al hito! 🎯" : `Faltan ${nextMilestone - streak} semanas para el próximo hito`}
              </div>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 22 }}>
          {[
            { label: "Racha actual", value: `${streak}sem`, color },
            { label: "Mejor racha", value: `${bestStreak}sem`, color: "#f59e0b" },
            { label: "Días activos", value: totalActiveDays, color: "#3b82f6" },
          ].map(s => (
            <div key={s.label} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
              <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 26, fontWeight: 900, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Calendar heatmap */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>
            📅 Últimas 12 semanas
          </div>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 280 }}>
              {/* Day labels */}
              <div style={{ display: "flex", gap: 3, marginBottom: 4, paddingLeft: 28 }}>
                {DAY_LABELS.map(d => (
                  <div key={d} style={{ width: 20, fontSize: 9, color: "var(--text-muted)", textAlign: "center", fontWeight: 600, flexShrink: 0 }}>{d}</div>
                ))}
              </div>
              {/* Weeks as rows */}
              {weeks.map((week, wi) => {
                const monthLabel = monthLabels.find(m => m.wi === wi);
                return (
                  <div key={wi} style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3 }}>
                    {/* Month label col */}
                    <div style={{ width: 24, fontSize: 8, color: "var(--text-muted)", fontWeight: 700, flexShrink: 0, textAlign: "right", paddingRight: 4 }}>
                      {monthLabel ? monthLabel.label : ""}
                    </div>
                    {week.map(day => (
                      <div
                        key={day.ds}
                        title={day.ds}
                        style={{
                          width: 20, height: 20, borderRadius: 5, flexShrink: 0,
                          background: day.isFuture
                            ? "transparent"
                            : day.trained
                              ? color
                              : "var(--border)",
                          opacity: day.isFuture ? 0.2 : 1,
                          border: day.isToday ? `2px solid ${color}` : "2px solid transparent",
                          boxShadow: day.trained && !day.isFuture ? `0 0 6px ${color}60` : undefined,
                          transition: "all 0.2s",
                          cursor: "default",
                        }}
                      />
                    ))}
                  </div>
                );
              })}
              {/* Legend */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, paddingLeft: 28, fontSize: 10, color: "var(--text-muted)" }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "var(--border)" }} />
                <span>Sin entreno</span>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: color, boxShadow: `0 0 6px ${color}60` }} />
                <span>Entrenado</span>
                <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid ${color}`, background: "transparent" }} />
                <span>Hoy</span>
              </div>
            </div>
          </div>
        </div>

        {/* Team streaks leaderboard */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 10 }}>
            👥 Racha entre amigos
          </div>
          {loadingTeam ? (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>Cargando equipo...</div>
          ) : teamStreaks.length <= 1 && !teamStreaks[0]?.isMe ? (
            <div style={{ textAlign: "center", padding: "16px", background: "var(--input-bg)", borderRadius: 12, fontSize: 13, color: "var(--text-muted)" }}>
              Únete a un GymTeam para comparar rachas con amigos 💪
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {teamStreaks.map((m, i) => {
                const mColor = m.streak >= 30 ? "#f97316" : m.streak >= 14 ? "#a855f7" : m.streak >= 7 ? "#3b82f6" : m.streak >= 3 ? "#22c55e" : "#6b7280";
                const maxStreak = Math.max(...teamStreaks.map(x => x.streak), 1);
                const barPct = (m.streak / maxStreak) * 100;
                const medals = ["🥇","🥈","🥉"];
                return (
                  <div key={m.email || i} style={{
                    background: m.isMe ? `${color}10` : "var(--input-bg)",
                    border: `1px solid ${m.isMe ? color + "40" : "var(--border)"}`,
                    borderRadius: 12, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 16, flexShrink: 0 }}>{medals[i] || "🔥"}</span>
                      <div style={{ flex: 1, fontWeight: 700, fontSize: 14, color: m.isMe ? color : "var(--text)" }}>
                        {m.name} {m.isMe && <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>(tú)</span>}
                      </div>
                      <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 22, fontWeight: 900, color: mColor }}>
                        {m.streak}sem
                      </div>
                    </div>
                    {/* Mini bar */}
                    <div style={{ background: "var(--border)", borderRadius: 20, height: 5, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: mColor, borderRadius: 20, transition: "width 0.8s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

function GymApp() {
  const { dark, toggleDark } = useTheme();
  const { user, logout } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [unit, setUnit] = useState(() => load("gym_unit", "kg"));
  const [activeTab, setActiveTab] = useState("new");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [customGifsMap, setCustomGifsMap] = useState({});

  // Body stats
  const bodyKey = `gym_body_${user.email}`;
  const [bodyStats, setBodyStats] = useState(() => load(bodyKey, { height: null, entries: [] }));
  const [showBodyStats, setShowBodyStats] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem("gym_onboarding_done"); } catch { return false; }
  });
  // PWA install prompt
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  function completeOnboarding() {
    try { localStorage.setItem("gym_onboarding_done", "1"); } catch {}
    setShowOnboarding(false);
  }

  // Planner
  const plannerKey = `gym_planner_${user.email}`;
  const [weeklyPlan, setWeeklyPlan] = useState(() => load(plannerKey, { mode: "weekly", weekly: {}, cycle: [], cyclePos: 0 }));
  const [showPlanner, setShowPlanner] = useState(false);
  const [plannerInitTab, setPlannerInitTab] = useState("plan");
  function openPlanner(tab) { setPlannerInitTab(tab || "plan"); setShowPlanner(true); }
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
  const [exSearch, setExSearch] = useState("");
  const [exSearchFocus, setExSearchFocus] = useState(false);
  const [exCustom, setExCustom] = useState("");
  const [exCustomMuscle, setExCustomMuscle] = useState("");
  const [exWeight, setExWeight] = useState("");
  const [exReps, setExReps] = useState("");
  const [exSets, setExSets] = useState([]);
  const [exSeriesCount, setExSeriesCount] = useState("3");
  const [exNote, setExNote] = useState("");
  const [editingId, setEditingId] = useState(null);

  const [filterPeriod, setFilterPeriod] = useState("");
const [filterOrder, setFilterOrder] = useState("desc");
const [filterMuscle, setFilterMuscle] = useState("");
const [histPage, setHistPage] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [filterWorkout, setFilterWorkout] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [progressEx, setProgressEx] = useState(null);
  const [showProgressPicker, setShowProgressPicker] = useState(false);
  const [pickerMuscle, setPickerMuscle] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [showOneRM, setShowOneRM] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showMuscleMap, setShowMuscleMap] = useState(false);
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
  const [showStreakModal, setShowStreakModal] = useState(false);
  const [showInsights, setShowInsights] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
const [showAthleteCoach, setShowAthleteCoach] = useState(false);
  const [showAdminExercises, setShowAdminExercises] = useState(false);
  const [athleteCoachInitialRoutine, setAthleteCoachInitialRoutine] = useState(null);
  const [coachRoutines, setCoachRoutines] = useState([]);

  // Cargar ejercicios personalizados de Firestore al iniciar
  useEffect(() => {
    loadCustomExercises().then(customs => {
      const map = {};
      customs.forEach(ex => {
        registerCustomExercise(ex.name, ex.muscle);
        if (ex.gifUrl) map[ex.name] = ex.gifUrl;
      });
      setCustomGifsMap(map);
    });
  }, []);

  const loadCoachRoutines = async () => {
    if (user.isGuest) return;
    try {
      const assigned = await getAthleteRoutines(user.uid);
      console.log("[coachRoutines] assigned from DB:", assigned);
      const full = await Promise.all(
        assigned.map(async r => {
          const routine = await getFullRoutine(r.coachUid, r.routineId);
          if (!routine) return null;
          return { ...routine, dayOfWeek: r.dayOfWeek ?? -1, coachUid: r.coachUid, routineId: r.routineId };
        })
      );
      console.log("[coachRoutines] full routines loaded:", full.filter(Boolean));
      setCoachRoutines(full.filter(Boolean));
    } catch(e) { console.error("[coachRoutines] load error:", e); }
  };

  useEffect(() => {
    loadCoachRoutines();
  }, [user.uid]);

  // Reload coach routines when switching to home tab
  useEffect(() => {
    if (activeTab === "new" && !user.isGuest) {
      loadCoachRoutines();
    }
  }, [activeTab]);
  const [sessionMode, setSessionMode] = useState(null); // null | "live" | "register"
  const [showNameModal, setShowNameModal] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [floatTimer, setFloatTimer] = useState({ visible: false, secs: 90, running: false, elapsed: 0 });
  const floatTimerRef = useRef();
  const [shareSession, setShareSession] = useState(null);
  const [toast, setToast] = useState(null);
  const presetRef = useRef();

  // Save live draft when app goes to background (Capacitor)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && liveActive) {
        // Force a draft save by reading current state from localStorage — already handled by LiveTrainMode autosave
        // Just ensure the key exists so we don't lose it
      }
    }).then(l => { listener = l; });
    return () => { if (listener) listener.remove(); };
  }, [liveActive]);

  useEffect(() => {
    if (floatTimer.running && floatTimer.visible) {
      floatTimerRef.current = setInterval(() => {
        setFloatTimer(f => {
          if (f.elapsed + 1 >= f.secs) {
            clearInterval(floatTimerRef.current);
            // Sonido
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
            // Vibración en móvil
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e) {}
            // Notificación web (funciona aunque la app esté en segundo plano)
            try {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification("¡Tiempo de descanso terminado! 💪", {
                  body: "Listo para la siguiente serie.",
                  icon: "/favicon.ico",
                  badge: "/favicon.ico",
                  tag: "rest-timer",
                  renotify: true,
                });
              }
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
  }, [floatTimer.running, floatTimer.visible, floatTimer.secs]);

  useEffect(() => {
    if (sessionsLoading) return;
    if (user.isGuest) { store("gym_v3_guest", sessions); return; }
    setDoc(doc(db, "sessions", user.uid), { list: sessions, updatedAt: serverTimestamp() });
  }, [sessions, sessionsLoading, user.isGuest, user.uid]);
  useEffect(() => { store("gym_unit", unit); }, [unit]);
  useEffect(() => { setHistPage(0); }, [filterWorkout, filterMuscle, filterPeriod, filterOrder]);
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
  const GUEST_MAX = 3;
  const canAdd = isGuest ? sessions.length < GUEST_MAX : true;
  const canExport = !isGuest;
  const canCharts = !isGuest;

  const toastTimerRef = useRef(null);
  function showToast(msg) { setToast(msg); if (toastTimerRef.current) clearTimeout(toastTimerRef.current); toastTimerRef.current = setTimeout(() => setToast(null), 2600); }

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
      saveCustomExercise(finalName, exCustomMuscle);
      registerCustomExercise(finalName, exCustomMuscle);
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
    if (isGuest && !editingId && sessions.length >= GUEST_MAX) { showToast("⛔ Límite de 3 sesiones en modo invitado. Crea una cuenta para continuar."); return; }
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
    // Limpiar todo el estado del formulario antes de cargar
    setExName(""); setExMuscle("Todos"); setExWeight(""); setExReps("");
    setExSets([]); setExSeriesCount("3"); setExNote("");
    // Cargar datos de la sesión a editar
    setEditingId(s.id); setDate(s.date); setWorkout(s.workout); setNotes(s.notes || "");
    setCurrentExercises((s.exercises || []).map(e => ({ ...e })));
    setSessionMode("register");
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

  const filtered = sessions
  .filter(s => {
    if (filterWorkout) {
      const fw = filterWorkout.toLowerCase();
      const matchRutina = s.workout.toLowerCase().includes(fw);
      const matchMusculo = (s.exercises||[]).some(ex => EXERCISE_DB.find(e => e.name === ex.name)?.muscle?.toLowerCase() === fw);
      if (!matchRutina && !matchMusculo) return false;
    }
    if (filterMuscle) {
      const tiene = (s.exercises||[]).some(ex => EXERCISE_DB.find(e => e.name === ex.name)?.muscle === filterMuscle);
      if (!tiene) return false;
    }
    if (filterPeriod) {
      const dias = parseInt(filterPeriod);
      const diff = (new Date() - new Date(s.date+"T00:00:00")) / 86400000;
      if (diff > dias) return false;
    }
    return true;
  })
  .sort((a, b) => filterOrder === "desc"
    ? b.date.localeCompare(a.date)
    : a.date.localeCompare(b.date)
  );  

  const NAV = [
    { id: "new", icon: "⚡", label: "Nueva sesión" },
    { id: "history", icon: "◈", label: "Historial" },
    { id: "dashboard", icon: "◉", label: "Dashboard" },
  ];
  
  // Earned badges count for notification dot
  const prsForBadge = getPRs(sessions);
  const earnedBadges = BADGE_DEFS.filter(b => b.check(sessions, prsForBadge)).length;

  const navClick = (id) => { setActiveTab(id); setMobileNavOpen(false); };

  return (
    <CustomGifCtx.Provider value={{ gifs: customGifsMap, setGif: (name, url) => setCustomGifsMap(p => ({ ...p, [name]: url })) }}>
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
            <span className="logo-text" style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:900, letterSpacing:6, textTransform:"uppercase", color:"var(--text)" }}>GYMTRACKER</span>
          </div>
        </div>

        {todayPlanned&&(()=>{const ts=new Date().toISOString().slice(0,10);const dn=sessions.some(s=>s.date===ts&&s.workout?.toLowerCase()===todayPlanned.toLowerCase());return(<div style={{margin:"0 12px 12px",padding:"10px 12px",background:dn?"rgba(34,197,94,0.07)":"var(--accent-dim)",border:`1px solid ${dn?"rgba(34,197,94,0.2)":"rgba(232,255,0,0.15)"}`,borderRadius:4}}><div style={{fontSize:9,fontWeight:800,letterSpacing:3,color:dn?"#22c55e":"var(--accent)",textTransform:"uppercase",marginBottom:3}}>{dn?"✅ COMPLETADA":"HOY TOCA"}</div><div style={{fontSize:13,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:1,textTransform:"uppercase"}}>{todayPlanned}</div></div>);})()}

        <nav className="sidebar-nav">
  {NAV.map(item => (
    <button key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`}
      style={item.id === "new" ? {
        background: "#e8ff00", color: "#0a0a0a", fontWeight: 900,
        letterSpacing: 2, textTransform: "uppercase", marginBottom: 8,
        borderRadius: 4, fontSize: 12, boxShadow: "0 0 16px rgba(232,255,0,0.2)",
      } : {}}
      onClick={() => navClick(item.id)}>
      <span className="nav-icon">{item.icon}</span>
      <span className="nav-label">{item.label}</span>
    </button>
  ))}

  {[
      { label: "— ORGANIZAR", items: [
        { icon: "▦", label: "Planificador", action: () => openPlanner("plan") },
        { icon: "▤", label: "Plantillas", action: () => setShowTemplates(true) },
      ]},
      { label: "— SOCIAL", items: [
        { icon: "◈", label: "GymTeams", action: () => setShowTeams(true) },
        { icon: "✕", label: "Reto semanal", action: () => setShowChallenge(true) },
      ]},
      { label: "— PERSONAL", items: [
        { icon: "↑", label: "Progreso", action: () => setShowProgressPicker(true) },
        { icon: "◎", label: "Peso & Estatura", action: () => setShowBodyStats(true) },
        { icon: "◉", label: "Mi Coach", action: () => setShowAthleteCoach(true) },
        ...(user.isCoach ? [{ icon: "★", label: "Panel Coach", action: () => setShowCoach(true) }] : []),
      ]},
    ].map(group => (
      <div key={group.label}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 4, padding: "16px 12px 4px", textTransform: "uppercase", opacity: 0.5 }}>
          {group.label.replace(/^[^\w]+/, "")}
        </div>
        {group.items.map(item => (
          <button key={item.label} className="nav-item" onClick={item.action}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    ))}
        {user.isAdmin && (
          <button className="nav-item" onClick={() => setShowAdminExercises(true)}>
            <span className="nav-icon">◈</span>
            <span className="nav-label">Ejercicios custom</span>
          </button>
        )}
        </nav>
        <div className="sidebar-bottom">
          {/* Offline indicator */}
          {!isOnline && (
            <div style={{ margin:"0 8px 8px", padding:"7px 12px", background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:8, fontSize:11, color:"#f59e0b", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
              📵 Sin conexión — modo offline
            </div>
          )}
          {/* Install PWA */}
          {installPrompt && (
            <button className="nav-item" style={{ marginBottom:2, color:"#22c55e" }} onClick={async () => {
              installPrompt.prompt();
              const { outcome } = await installPrompt.userChoice;
              if (outcome === "accepted") setInstallPrompt(null);
            }}>
              <span className="nav-icon">↓</span>
              <span className="nav-label">Instalar app</span>
            </button>
          )}
          {/* Re-trigger tutorial */}
          <button className="nav-item" style={{ marginBottom:2 }} onClick={() => setShowOnboarding(true)}>
            <span className="nav-icon">?</span>
            <span className="nav-label">Ver tutorial</span>
          </button>

          <div className="user-card">
            <div className="user-avatar" style={{cursor:"pointer", overflow:"hidden", padding:0, borderRadius:4}} onClick={() => setShowProfile(true)}>
  {user.photoURL
    ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:0}} referrerPolicy="no-referrer" />
    : user.name?.[0]?.toUpperCase() || "U"}
</div>
            <div style={{ minWidth: 0 }}>
              <div className="user-name">{user.name}</div>
              {!isGuest && <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700 }}></span>}
            </div>
          </div>
          <button className="nav-item" onClick={logout}>
            <span className="nav-icon">→</span>
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
            ? (editingId ? "✏️ Editando sesión" : `👋 Hola, ${user.name.split(" ")[0]}!`)
            : activeTab === "history" ? "📋 Historial"
            : "📊 Dashboard"}
            </h1>
          </div>
          <div className="topbar-actions">
            {(()=>{const sv=getStreak(sessions, weeklyGoal?.target||3);const tt=sessions.some(s=>s.date===new Date().toISOString().slice(0,10));return(<button className="topbar-btn" onClick={()=>{ setActiveTab("dashboard"); setTimeout(()=>{ const el=document.getElementById("training-calendar-section"); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },100); }} style={{cursor:"pointer",opacity:tt?1:0.45,filter:tt?"none":"grayscale(1)",background:"none",border:"none"}}><span className="topbar-btn-icon">🔥</span><span className="topbar-btn-label" style={{color:tt?"#f97316":"var(--text-muted)",fontWeight:800}}>{sv}sem</span></button>);})()}
            <button className="topbar-btn" onClick={toggleDark}>
              <span className="topbar-btn-icon">{dark ? "☀️" : "🌙"}</span>
              <span className="topbar-btn-label">{dark ? "Claro" : "Oscuro"}</span>
            </button>
            <button className="topbar-btn" onClick={()=>setUnit(u=>{const n=u==="kg"?"lbs":"kg";store("gym_unit",n);return n;})}>
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
                  <span style={{ fontSize: 18 }}>⚡</span>
                  <span className="logo-text" style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:900, letterSpacing:6, textTransform:"uppercase", color:"var(--text)" }}>GYMTRACKER</span>
                </div>
                <button onClick={() => setMobileNavOpen(false)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:18, cursor:"pointer", padding:"4px 8px", lineHeight:1 }}>✕</button>
              </div>

              {todayPlanned&&(()=>{const ts=new Date().toISOString().slice(0,10);const dn=sessions.some(s=>s.date===ts&&s.workout?.toLowerCase()===todayPlanned.toLowerCase());return(<div style={{margin:"12px 12px 0",padding:"10px 12px",background:dn?"rgba(34,197,94,0.07)":"var(--accent-dim)",border:`1px solid ${dn?"rgba(34,197,94,0.2)":"rgba(232,255,0,0.15)"}`,borderRadius:4}}><div style={{fontSize:9,fontWeight:800,letterSpacing:3,color:dn?"#22c55e":"var(--accent)",textTransform:"uppercase",marginBottom:3}}>{dn?"✅ COMPLETADA":"HOY TOCA"}</div><div style={{fontSize:13,fontWeight:700,color:"var(--text)",letterSpacing:1,textTransform:"uppercase"}}>{todayPlanned}</div></div>);})()}

              <nav style={{ padding: "12px 8px", flex: 1 }}>
                {NAV.map(item => (
                  <button key={item.id} className={`nav-item ${activeTab === item.id ? "active" : ""}`}
                    style={item.id === "new" ? {
                      background: "#e8ff00", color: "#0a0a0a", fontWeight: 900,
                      letterSpacing: 2, textTransform: "uppercase", marginBottom: 8,
                      borderRadius: 4, fontSize: 12, boxShadow: "0 0 16px rgba(232,255,0,0.2)",
                    } : { marginBottom: 2 }}
                    onClick={() => navClick(item.id)}>
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                ))}
                <div style={{ height: 1, background: "var(--border)", margin: "8px 12px" }} />
                {[
                  { icon: "▦", label: "Planificador", action: () => { openPlanner("plan"); setMobileNavOpen(false); } },
                  { icon: "◎", label: "Peso & Estatura", action: () => { setShowBodyStats(true); setMobileNavOpen(false); } },
                  { icon: "◈", label: "GymTeams", action: () => { setShowTeams(true); setMobileNavOpen(false); } },
                  { icon: "✕", label: "Reto semanal", action: () => { setShowChallenge(true); setMobileNavOpen(false); } },
                  ...(user.isCoach ? [{ icon: "★", label: "Panel Coach", action: () => { setShowCoach(true); setMobileNavOpen(false); } }] : []),
                  { icon: "◉", label: "Mi Coach", action: () => { setShowAthleteCoach(true); setMobileNavOpen(false); } },
                  ...(user.isAdmin ? [{ icon: "⚙️", label: "Ejercicios custom", action: () => { setShowAdminExercises(true); setMobileNavOpen(false); } }] : []),
                ].map(({ icon, label, action }) => (
                  <button key={label} className="nav-item" style={{ marginBottom: 2 }} onClick={action}>
                    <span className="nav-icon">{icon}</span>
                    <span className="nav-label">{label}</span>
                  </button>
                ))}
              </nav>

              <div style={{ padding: "12px 8px", borderTop: "1px solid var(--border)" }}>
                {!isOnline && (
                  <div style={{ margin:"0 4px 8px", padding:"7px 12px", background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:8, fontSize:11, color:"#f59e0b", fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                    📵 Sin conexión — modo offline
                  </div>
                )}
                {installPrompt && (
                  <button className="nav-item" style={{ marginBottom:2, color:"#22c55e" }} onClick={async () => {
                    installPrompt.prompt();
                    const { outcome } = await installPrompt.userChoice;
                    if (outcome === "accepted") setInstallPrompt(null);
                    setMobileNavOpen(false);
                  }}>
                    <span className="nav-icon">↓</span>
                    <span className="nav-label">Instalar app</span>
                  </button>
                )}
                <button className="nav-item" style={{ marginBottom:2 }} onClick={() => { setShowOnboarding(true); setMobileNavOpen(false); }}>
                  <span className="nav-icon">?</span>
                  <span className="nav-label">Ver tutorial</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", marginBottom: 4, cursor: "pointer" }} onClick={() => { setShowProfile(true); setMobileNavOpen(false); }}>
                  <div className="user-avatar" style={{ overflow:"hidden", padding:0 }}>
                    {user.photoURL
                      ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}} referrerPolicy="no-referrer" />
                      : user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <div className="user-name">{user.name}</div>
                    {isGuest ? <button className="plan-badge" style={{ "--pc": "#f59e0b" }} onClick={logout}>Invitado · Salir</button> : <span style={{ fontSize:11, color:"var(--accent)", fontWeight:700 }}>Ver perfil</span>}
                  </div>
                </div>
                <button className="nav-item" onClick={logout}>
                  <span className="nav-icon">→</span>
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
        uid={uid}
        numDot={numDot}
        onBack={() => { try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {} setLiveActive(false); }}
        onSaveSession={(finalExercises, elapsedSecs) => {
          if (!workout) { showToast("⚠️ Falta el nombre del entrenamiento"); return; }
          if (isGuest && sessions.length >= GUEST_MAX) { showToast("⛔ Límite de 3 sesiones en modo invitado. Crea una cuenta para continuar."); return; }
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
              <span>👤 Modo invitado — {Math.min(sessions.length, GUEST_MAX)}/{GUEST_MAX} sesiones usadas{sessions.length >= GUEST_MAX - 1 ? (sessions.length >= GUEST_MAX ? " · ⛔ Sin espacio" : " · ⚠️ Última sesión disponible") : ""}.</span>
              <button className="link-btn" onClick={logout} style={{ color: "#f59e0b", marginLeft: 8 }}>
                Crear cuenta →
              </button>
            </div>
          )}

          {/* Sugerencia de plantilla del día */}
          {(() => {
            const todayDow = (new Date().getDay() + 6) % 7; // 0=Lun … 6=Dom
            const tplHoy = (load("gym_templates", []) || []).find(t => String(t.day) === String(todayDow));
            if (!tplHoy) return null;
            return (
              <div style={{
                background:"var(--card)",
                border:"1px solid rgba(232,255,0,0.15)", borderRadius:6,
                padding:"14px 18px", marginBottom:16,
                display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10
              }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:800, letterSpacing:3, color:"rgba(232,255,0,0.6)", textTransform:"uppercase", marginBottom:4, fontFamily:"Barlow Condensed,sans-serif" }}>
                    📋 Plantilla de hoy
                  </div>
                  <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:20, fontWeight:800 }}>{tplHoy.name}</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:2 }}>
                    {(tplHoy.exercises||[]).length} ejercicios planificados para hoy
                  </div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button className="btn-ghost small" onClick={() => {
                    setWorkout(tplHoy.name);
                    setCurrentExercises((tplHoy.exercises||[]).map(e => ({ ...e, id: uid() })));
                    setSessionMode("register");
                    showToast(`✅ "${tplHoy.name}" cargada`);
                  }}>📝 Registrar</button>
                  <button className="btn-ghost small" style={{ borderColor:"rgba(168,85,247,0.4)", color:"#a855f7" }} onClick={() => {
                    setWorkout(tplHoy.name);
                    setCurrentExercises((tplHoy.exercises||[]).map(e => ({ ...e, id: uid() })));
                    setSessionMode("live");
                    showToast(`✅ "${tplHoy.name}" cargada`);
                  }}>⚡ Entrenar</button>
                </div>
              </div>
            );
          })()}

          {/* Rutina de hoy */}
          {(() => {
            const todayDow = (new Date().getDay() + 6) % 7;
            const plan = weeklyPlan.mode === "weekly"
              ? weeklyPlan.weekly?.[todayDow]
              : weeklyPlan.cycle?.[weeklyPlan.cyclePos];
            const name = typeof plan === "string" ? plan : plan?.name;
            const planEx=plan?.exercises||[];
            if (!name) return null;
            const ts2=new Date().toISOString().slice(0,10);
            const doneToday=sessions.some(s=>s.date===ts2&&s.workout?.toLowerCase()===name.toLowerCase());
            const todaySess=sessions.find(s=>s.date===ts2&&s.workout?.toLowerCase()===name.toLowerCase());
            return (
              <div style={{background:doneToday?"rgba(34,197,94,0.07)":"var(--card)",border:`1px solid ${doneToday?"rgba(34,197,94,0.25)":"var(--border)"}`,borderRadius:6,padding:"14px 18px",marginBottom:16,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:doneToday?"#22c55e":"#e8ff00",textTransform:"uppercase",marginBottom:4}}>{doneToday?"✅ Completada hoy":"📅 Hoy toca"}</div>
                  <div style={{fontFamily:"Barlow Condensed, sans-serif",fontSize:20,fontWeight:800,color:doneToday?"#22c55e":"#e8ff00"}}>{name}</div>
                  {!doneToday&&planEx.length>0&&<div style={{fontSize:12,color:"var(--text-muted)",marginTop:3}}>{planEx.length} ejercicios planificados</div>}
                  {doneToday&&todaySess&&<div style={{fontSize:12,color:"#86efac",marginTop:3}}>{todaySess.exercises?.length||0} ejercicios · {todaySess.durationSecs?`${Math.round(todaySess.durationSecs/60)} min`:"registrada"}</div>}
                </div>
                {doneToday?<button className="btn-ghost small" style={{borderColor:"rgba(34,197,94,0.4)",color:"#22c55e"}} onClick={()=>setActiveTab("history")}>Ver resumen →</button>:<button className="btn-ghost small" onClick={()=>{setWorkout(name);if(planEx.length>0)setCurrentExercises(planEx.map(e=>({...e,id:uid()})));setActiveTab("new");setSessionMode("live");showToast(`✅ "${name}" cargada`);}}>💪 Cargar →</button>}
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
                onClick={() => openPlanner("goal")}
                style={{
                  cursor: "pointer",
                  background: ok ? "rgba(34,197,94,0.07)" : "var(--card)",
                  border: `1px solid ${ok ? "rgba(34,197,94,0.25)" : "var(--border)"}`,
                  borderRadius: 6, padding: "10px 16px", marginBottom: 24,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ fontWeight: 600 }}>🎯 Meta semanal {ok ? "✅" : ""}</span>
                  <span style={{ color: "var(--text-muted)" }}>{tw}/{weeklyGoal.target} sesiones</span>
                </div>
                <div style={{ background: "var(--border)", borderRadius: 2, height: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: ok ? "#22c55e" : "#e8ff00", width: `${p * 100}%`, borderRadius: 2, transition: "width 0.5s" }} />
                </div>
              </div>
            );
          })()}

          {/* ── Rutina asignada por el coach ── */}
          {coachRoutines.length > 0 && (() => {
            const todayDow = (new Date().getDay() + 6) % 7;
            const todayRoutine = coachRoutines.find(r => Number(r.dayOfWeek) === todayDow) || coachRoutines[0];
            const isToday = Number(todayRoutine.dayOfWeek) === todayDow;
            const todayDateStr = new Date().toISOString().slice(0,10);
            const alreadyDone = sessions.some(s => s.date === todayDateStr &&
              (s.workout === todayRoutine.name || s.workout === todayRoutine.routineName));
            return (
              <div style={{
                background: alreadyDone ? "rgba(34,197,94,0.07)" : "rgba(232,255,0,0.04)",
                border: `2px solid ${alreadyDone ? "rgba(34,197,94,0.4)" : "var(--accent)"}`,
                borderRadius: 12, marginBottom: 20, overflow: "hidden",
                boxShadow: alreadyDone ? "none" : "0 0 24px rgba(232,255,0,0.12)",
              }}>
                <div style={{
                  background: alreadyDone ? "rgba(34,197,94,0.15)" : "rgba(232,255,0,0.12)",
                  padding: "8px 14px", display: "flex", alignItems: "center", gap: 8,
                  borderBottom: `1px solid ${alreadyDone ? "rgba(34,197,94,0.2)" : "rgba(232,255,0,0.15)"}`,
                }}>
                  <span style={{fontSize:10,fontWeight:900,letterSpacing:2,textTransform:"uppercase",
                    color: alreadyDone ? "#22c55e" : "var(--accent)"}}>
                    {alreadyDone ? "✅ RUTINA COMPLETADA HOY" : isToday ? "⚡ TU COACH TE MANDÓ RUTINA PARA HOY" : "🏋️ TU COACH TE ASIGNÓ UNA RUTINA"}
                  </span>
                </div>
                <div style={{padding:"14px 16px", display:"flex", alignItems:"center", gap:14}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontFamily:"Barlow Condensed, sans-serif", fontSize:22,fontWeight:900,
                      letterSpacing:1, textTransform:"uppercase", color:"var(--text)",marginBottom:6}}>
                      {todayRoutine.name || todayRoutine.routineName || "Entrenamiento"}
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                      {(todayRoutine.exercises||[]).slice(0,4).map((ex,i)=>(
                        <span key={i} style={{fontSize:10,background:"var(--card)",border:"1px solid var(--border)",
                          borderRadius:4,padding:"2px 8px",color:"var(--text-muted)",fontWeight:600}}>
                          {ex.name||ex}
                        </span>
                      ))}
                      {(todayRoutine.exercises||[]).length > 4 &&
                        <span style={{fontSize:10,color:"var(--text-muted)"}}>+{todayRoutine.exercises.length-4} más</span>}
                    </div>
                    {coachRoutines.length > 1 && (
                      <button onClick={() => setShowAthleteCoach(true)} style={{background:"none",border:"none",
                        color:"var(--accent)",fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>
                        Ver todas ({coachRoutines.length}) →
                      </button>
                    )}
                  </div>
                  {!alreadyDone && (
                    <button onClick={() => {
                      setWorkout(todayRoutine.name || todayRoutine.routineName || "Rutina Coach");
                      setCurrentExercises((todayRoutine.exercises||[]).map(e => ({...e, id:uid()})));
                      setSessionMode("live");
                      setShowNameModal(false);
                    }} style={{
                      background:"var(--accent)", border:"none", borderRadius:10,
                      color:"#0a0a0a", fontWeight:900, fontSize:13,
                      padding:"10px 16px", cursor:"pointer", flexShrink:0,
                      display:"flex",alignItems:"center",gap:5,
                      letterSpacing:1, fontFamily:"Barlow Condensed, sans-serif",
                      textTransform:"uppercase", boxShadow:"0 0 16px rgba(232,255,0,0.3)",
                    }}>⚡ INICIAR</button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ── BRUX + LAS DOS TARJETAS PRINCIPALES ── */}
          <BruxMascot
            sessions={sessions}
            todayPlanned={todayPlanned}
            streak={getStreak(sessions)}
            onStartSession={(muscle) => { setExMuscle(muscle); setSessionMode("register"); }}
            inNewSession={true}
          />

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 14, fontFamily: "Barlow Condensed, sans-serif" }}>
            ¿Qué quieres hacer?
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>

            {/* ── Entrenar ahora ── */}
            <button
              onClick={() => { setWorkout(""); setShowNameModal(true); }}
              style={{
                background: "#e8ff00",
                border: "none",
                borderRadius: 8, padding: "24px 16px", cursor: "pointer",
                textAlign: "center", transition: "all 0.2s", fontFamily: "Barlow, sans-serif",
                boxShadow: "0 0 30px rgba(232,255,0,0.2)",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 32px rgba(232,255,0,0.4)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 0 30px rgba(232,255,0,0.2)"; }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>⚡</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 900, color: "#0a0a0a", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
                Entrenar ahora
              </div>
              <div style={{ fontSize: 11, color: "rgba(0,0,0,0.5)", lineHeight: 1.5 }}>
                Timer · series · descanso
              </div>
            </button>

            {/* ── Registrar sesión ── */}
            <button
              onClick={() => setSessionMode("register")}
              style={{
                background: "var(--input-bg)",
                border: "2px solid var(--border)",
                borderRadius: 8, padding: "24px 16px", cursor: "pointer",
                textAlign: "center", transition: "all 0.2s", fontFamily: "Barlow, sans-serif",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.background = "var(--input-bg)"; }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
              <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 20, fontWeight: 900, color: "var(--text)", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>
                Registrar sesión
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Ya entrenaste · guarda el historial
              </div>
            </button>

          </div>

          {/* Herramientas rápidas */}
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 12, fontFamily: "Barlow Condensed, sans-serif" }}>
            Herramientas
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { icon: "🧮", label: "Calc. 1RM",    action: () => setShowOneRM(true) },
              { icon: "📚", label: "Biblioteca",    action: () => setShowLibrary(true) },
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

          {/* Nombre del entrenamiento — prominente arriba */}
          <div style={{ position: "relative" }} ref={presetRef}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--accent)", textTransform: "uppercase", marginBottom: 8 }}>¿Qué vas a entrenar hoy?</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                placeholder="Push Day, Piernas, Full Body…"
                value={workout}
                onChange={e => setWorkout(lettersOnly(e.target.value))}
                className="input"
                style={{ fontSize: 18, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", flex: 1, padding: "12px 16px" }}
                autoFocus
              />
              <button className="btn-ghost" onClick={() => setShowPresets(v => !v)} title="Plantillas">📋</button>
            </div>
            {showPresets && (
              <div className="dropdown" style={{ top: "calc(100% - 12px)" }}>
                {Object.keys(PRESETS).map(r => <button key={r} className="dropdown-item" onClick={() => applyPreset(r)}>{r}</button>)}
              </div>
            )}
          </div>

          {/* Fecha + notas */}
          <div className="card">
            <div className="card-label">Info de la sesión</div>
            <div className="field">
              <label className="field-label">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
            </div>
            <div className="field">
              <label className="field-label">Notas (opcional)</label>
              <textarea className="input textarea" placeholder="Objetivos del día…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          {/* Agregar ejercicios (mismo bloque que el modo register) */}
          <div className="card">
            <div className="card-label">Ejercicios</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, marginBottom: 10 }}>
              {["Todos", ...MUSCLES].map(m => (
                <button key={m} className={`muscle-chip ${exMuscle === m ? "active" : ""}`}
                  onClick={() => { setExMuscle(m); setExName(""); setExSearch(""); }}>
                  {m}
                </button>
              ))}
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
  <label className="field-label">Ejercicio</label>
  {(() => {
    const filteredEx = (exMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === exMuscle))
      .filter(e => !exSearch || e.name.toLowerCase().includes(exSearch.toLowerCase()));
    return (
      <div style={{ position: "relative" }}>
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span style={{ position: "absolute", left: 12, color: "var(--text-muted)", fontSize: 15, pointerEvents: "none" }}>
            {exSearchFocus ? "🔍" : "▾"}
          </span>
          <input
            className="input"
            style={{ paddingLeft: 36, color: exName && exName !== "__custom__" && !exSearchFocus ? "var(--text)" : undefined, fontWeight: exName && !exSearchFocus ? 600 : 400 }}
            placeholder="— Selecciona —"
            value={exSearchFocus ? exSearch : (exName && exName !== "__custom__" ? exName : "")}
            onChange={e => { setExSearch(e.target.value); setExName(""); }}
            onFocus={() => { setExSearchFocus(true); setExSearch(""); }}
            onBlur={() => setTimeout(() => setExSearchFocus(false), 150)}
          />
        </div>
        {(exSearchFocus || exSearch) && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            zIndex: 50, maxHeight: 220, overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}>
            {filteredEx.slice(0, 30).map(ex => (
              <button key={ex.name}
                onMouseDown={() => { setExName(ex.name); setExSearch(""); setExSearchFocus(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", background: "none", border: "none",
                  borderBottom: "1px solid var(--border)", padding: "9px 14px",
                  cursor: "pointer", textAlign: "left", color: "var(--text)",
                  fontFamily: "Barlow, sans-serif", fontSize: 13,
                  transition: "background 0.12s",
                }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--accent-dim)"}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <span style={{ flex: 1 }}>{ex.name}{ex.machine ? " 🔧" : ""}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{ex.muscle}</span>
              </button>
            ))}
            <button
              onMouseDown={() => { setExName("__custom__"); setExSearch(""); setExSearchFocus(false); }}
              style={{
                display: "flex", width: "100%", background: "none", border: "none",
                padding: "9px 14px", cursor: "pointer", textAlign: "left",
                color: "var(--accent)", fontFamily: "Barlow, sans-serif", fontSize: 13, fontWeight: 600,
              }}
            >
              ✏️ Personalizado...
            </button>
          </div>
        )}
      </div>
    );
  })()}
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

{exName && exName !== "__custom__" ? (
  <div style={{ margin:"10px 0 14px", padding:"16px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:16, display:"flex", flexDirection:"column", gap:12 }}>
    {/* GIF + nombre arriba */}
    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
      <ExerciseGif exName={exName} size={72} />
      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800 }}>{exName}</div>
    </div>
    {/* Sugerencias a ancho completo */}
    {(() => {
      const sug = getProgressionSuggestion(exName, sessions);
      if (!sug) return null;
      return (
        <div onClick={() => { setExWeight(String(sug.sugWeight)); setExReps(String(sug.sugReps)); setExSeriesCount(String(sug.lastSeries)); }}
          style={{ display:"flex", alignItems:"center", gap:8, background:`${sug.color}15`, border:`1px solid ${sug.color}40`, borderRadius:8, padding:"7px 10px", cursor:"pointer" }}>
          <span style={{ fontSize:15 }}>{sug.icon}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:12, fontWeight:700, color:sug.color }}>{sug.sugWeight}kg × {sug.sugReps} reps</div>
            <div style={{ fontSize:10, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{sug.reason}</div>
          </div>
          <span style={{ fontSize:10, color:sug.color, fontWeight:700, flexShrink:0 }}>Aplicar →</span>
        </div>
      );
    })()}
    {/* Inputs a ancho completo */}
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
      <div className="field">
        <label className="field-label">Peso ({unit})</label>
        <input placeholder="0" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Reps</label>
        <input placeholder="0" value={exReps} onChange={e => setExReps(numDot(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Series</label>
        <input placeholder="3" value={exSeriesCount} onChange={e => setExSeriesCount(e.target.value.replace(/[^0-9]/g, ""))} className="input" />
      </div>
    </div>
    {exWeight && exReps && (
      <div style={{ fontSize:12, color:"var(--text-muted)" }}>
        1RM estimado: <b style={{ color:"var(--accent)" }}>{calc1RM(exWeight, exReps)} kg</b>
      </div>
    )}
  </div>
) : (
  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
    <div className="field">
      <label className="field-label">Peso ({unit})</label>
      <input placeholder="0" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Reps</label>
      <input placeholder="0" value={exReps} onChange={e => setExReps(numDot(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Series</label>
      <input placeholder="3" value={exSeriesCount} onChange={e => setExSeriesCount(e.target.value.replace(/[^0-9]/g, ""))} className="input" />
    </div>
  </div>
)}          
            <button className="btn-add-ex" onClick={addExercise}>+ Agregar ejercicio</button>

            {currentExercises.length > 0 && (
              <div className="ex-list" style={{ marginTop: 10 }}>
                {currentExercises.map((ex) => (
                  <div key={ex.id} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                      <ExerciseGif exName={ex.name} size={44} />
                      <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{ex.name}</span>
                      <button className="chip-del" style={{ fontSize: 16 }}
                        onClick={() => setCurrentExercises(p => p.filter(e => e.id !== ex.id))}>✕</button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "8px 12px" }}>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>PESO (kg)</label>
                        <input className="input" type="number" inputMode="decimal" placeholder="0"
                          value={ex.weight || ""}
                          onChange={e => setCurrentExercises(p => p.map(x => x.id !== ex.id ? x : { ...x, weight: e.target.value }))}
                          style={{ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "6px 4px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>REPS</label>
                        <input className="input" type="number" inputMode="decimal" placeholder="0"
                          value={ex.reps || ""}
                          onChange={e => setCurrentExercises(p => p.map(x => x.id !== ex.id ? x : { ...x, reps: e.target.value }))}
                          style={{ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "6px 4px" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>SERIES</label>
                        <input className="input" type="number" inputMode="decimal" placeholder="3"
                          value={ex.series || ex.sets?.length || "3"}
                          onChange={e => setCurrentExercises(p => p.map(x => x.id !== ex.id ? x : { ...x, series: e.target.value }))}
                          style={{ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "6px 4px" }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Botón INICIAR */}
          {currentExercises.length > 0 ? (
            <button
              onClick={() => {
                if (!workout) { showToast("⚠️ Agrega un nombre al entrenamiento"); return; }
                setLiveActive(true);
              }}
              style={{
                width: "100%",
                background: "var(--accent)",
                border: "none", color: "#0a0a0a", borderRadius: 10, padding: "18px",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 900,
                letterSpacing: 2, cursor: "pointer",
                boxShadow: "0 0 28px rgba(232,255,0,0.35)",
              }}
            >
              ⚡ INICIAR ENTRENAMIENTO
            </button>
          ) : (
            <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted)", fontSize: 13 }}>
              Agrega al menos un ejercicio para comenzar
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

          {isGuest && !editingId && sessions.length === 2 && canAdd && (
            <div className="upgrade-banner" style={{ background: "rgba(245,158,11,0.08)", borderColor: "rgba(245,158,11,0.35)", color: "#fbbf24" }}>
              ⚠️ Esta es tu última sesión disponible en modo invitado.{" "}
              <button className="link-btn" onClick={logout}>Crear cuenta gratis →</button>
            </div>
          )}
          {!canAdd && !editingId && isGuest && (
            <div className="upgrade-banner">
              ⛔ Has alcanzado el límite de 3 sesiones.{" "}
              <button className="link-btn" onClick={logout}>Crear cuenta →</button>
            </div>
          )}
          {/* Nombre del entrenamiento — prominente arriba */}
          <div style={{ position: "relative" }} ref={presetRef}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: "var(--accent)", textTransform: "uppercase", marginBottom: 8 }}>¿Qué entrenaste hoy?</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
              <input
                placeholder="Push Day, Piernas, Full Body…"
                value={workout}
                onChange={e => setWorkout(lettersOnly(e.target.value))}
                className="input"
                style={{ fontSize: 18, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", flex: 1, padding: "12px 16px" }}
                autoFocus
              />
              <button className="btn-ghost" onClick={() => setShowPresets(v => !v)} title="Plantillas">📋</button>
            </div>
            {showPresets && (
              <div className="dropdown" style={{ top: "calc(100% - 12px)" }}>
                {Object.keys(PRESETS).map(r => <button key={r} className="dropdown-item" onClick={() => applyPreset(r)}>{r}</button>)}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-label">Info de la sesión</div>
            <div className="field">
              <label className="field-label">Fecha</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input" />
            </div>
            <div className="field">
              <label className="field-label">Notas</label>
              <textarea className="input textarea" placeholder="Cómo te sentiste, PR, observaciones…" value={notes} onChange={e => setNotes(e.target.value)} />
            </div>
          </div>

          <div className="card">
  <div className="card-label">Ejercicios de la sesión</div>
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 6, marginBottom: 10 }}>
    {["Todos", ...MUSCLES].map(m => (
      <button key={m} className={`muscle-chip ${exMuscle === m ? "active" : ""}`}
        onClick={() => { setExMuscle(m); setExName(""); setExSearch(""); }}>
        {m}
      </button>
    ))}
  </div>
  <div className="field" style={{ marginBottom: 10 }}>
    <label className="field-label">Ejercicio</label>
    {(() => {
      const filteredEx = (exMuscle === "Todos" ? EXERCISE_DB : EXERCISE_DB.filter(e => e.muscle === exMuscle))
        .filter(e => !exSearch || e.name.toLowerCase().includes(exSearch.toLowerCase()));
      return (
        <div style={{ position: "relative" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <span style={{ position: "absolute", left: 12, color: "var(--text-muted)", fontSize: 15, pointerEvents: "none" }}>
              {exSearchFocus ? "🔍" : "▾"}
            </span>
            <input
              className="input"
              style={{ paddingLeft: 36, color: exName && exName !== "__custom__" && !exSearchFocus ? "var(--text)" : undefined, fontWeight: exName && !exSearchFocus ? 600 : 400 }}
              placeholder="— Selecciona —"
              value={exSearchFocus ? exSearch : (exName && exName !== "__custom__" ? exName : "")}
              onChange={e => { setExSearch(e.target.value); setExName(""); }}
              onFocus={() => { setExSearchFocus(true); setExSearch(""); }}
              onBlur={() => setTimeout(() => setExSearchFocus(false), 150)}
            />
          </div>
          {(exSearchFocus || exSearch) && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
              zIndex: 50, maxHeight: 220, overflowY: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}>
              {filteredEx.slice(0, 30).map(ex => (
                <button key={ex.name}
                  onMouseDown={() => { setExName(ex.name); setExSearch(""); setExSearchFocus(false); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", background: "none", border: "none",
                    borderBottom: "1px solid var(--border)", padding: "9px 14px",
                    cursor: "pointer", textAlign: "left", color: "var(--text)",
                    fontFamily: "Barlow, sans-serif", fontSize: 13,
                    transition: "background 0.12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--accent-dim)"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <span style={{ flex: 1 }}>{ex.name}{ex.machine ? " 🔧" : ""}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{ex.muscle}</span>
                </button>
              ))}
              <button
                onMouseDown={() => { setExName("__custom__"); setExSearch(""); setExSearchFocus(false); }}
                style={{
                  display: "flex", width: "100%", background: "none", border: "none",
                  padding: "9px 14px", cursor: "pointer", textAlign: "left",
                  color: "var(--accent)", fontFamily: "Barlow, sans-serif", fontSize: 13,
                  fontWeight: 600,
                }}
              >
                ✏️ Personalizado...
              </button>
            </div>
          )}
        </div>
      );
    })()}
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

{exName && exName !== "__custom__" ? (
  <div style={{ margin:"10px 0 14px", padding:"16px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:16, display:"flex", flexDirection:"column", gap:12 }}>
    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
      <ExerciseGif exName={exName} size={72} />
      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800 }}>{exName}</div>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
      <div className="field">
        <label className="field-label">Peso ({unit})</label>
        <input placeholder="0" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Reps</label>
        <input placeholder="0" value={exReps} onChange={e => setExReps(numDot(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Series</label>
        <input placeholder="3" value={exSeriesCount} onChange={e => setExSeriesCount(e.target.value.replace(/[^0-9]/g, ""))} className="input" />
      </div>
    </div>
    {exWeight && exReps && (
      <div style={{ fontSize:12, color:"var(--text-muted)" }}>
        1RM estimado: <b style={{ color:"var(--accent)" }}>{calc1RM(exWeight, exReps)} kg</b>
      </div>
    )}
  </div>
) : (
  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 }}>
    <div className="field">
      <label className="field-label">Peso ({unit})</label>
      <input placeholder="0" value={exWeight} onChange={e => setExWeight(numDot(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Reps</label>
      <input placeholder="0" value={exReps} onChange={e => setExReps(numDot(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Series</label>
      <input placeholder="3" value={exSeriesCount} onChange={e => setExSeriesCount(e.target.value.replace(/[^0-9]/g, ""))} className="input" />
    </div>
  </div>
)}
  <div className="field" style={{ marginBottom: 10 }}>
    <label className="field-label">Nota del ejercicio (opcional)</label>
    <input className="input" placeholder="Sensaciones, técnica..." value={exNote} onChange={e => setExNote(e.target.value)} />
  </div>
  <button className="btn-add-ex" onClick={addExercise}>+ Agregar ejercicio</button>
  {currentExercises.length > 0 && (
    <div className="ex-list" style={{ marginTop: 14 }}>
      {currentExercises.map((ex) => (
        <div key={ex.id} style={{
          background: "var(--input-bg)", border: "1px solid var(--border)",
          borderRadius: 10, marginBottom: 8, padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <ExerciseGif exName={ex.name} size={44} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{ex.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {ex.sets?.length > 1
                ? `${ex.sets.length} series · ${ex.sets.map(s => `${s.weight}kg×${s.reps}`).join(", ")}`
                : `${ex.weight || "—"}kg × ${ex.reps || "—"} reps`}
            </div>
            {ex.note && <div style={{ fontSize: 11, color: "var(--accent)", fontStyle: "italic" }}>💬 {ex.note}</div>}
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

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            <button className="btn-primary" style={{ flex:1 }} onClick={() => {
              saveSession();
              setSessionMode(null);
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
    <div style={{ display: "flex", gap: 20 }}>

      {/* ── SIDEBAR FILTROS ── */}
      <div style={{
        width: 220, flexShrink: 0,
        background: "var(--card)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "18px 14px", height: "fit-content",
        position: "sticky", top: 80,
      }} className="history-sidebar">

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>{filtered.length} resultados</span>
          {(filterWorkout || filterMuscle || filterPeriod) && (
            <button className="link-btn" style={{ fontSize: 12 }}
              onClick={() => { setFilterWorkout(""); setFilterMuscle(""); setFilterPeriod(""); }}>
              Borrar filtros
            </button>
          )}
        </div>

        {/* Ordenar por */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Ordenar por</div>
          <select className="input" style={{ fontSize: 12, padding: "7px 10px" }}
            value={filterOrder} onChange={e => setFilterOrder(e.target.value)}>
            <option value="desc">Más reciente</option>
            <option value="asc">Más antiguo</option>
          </select>
        </div>

        {/* Período */}
        <div style={{ marginBottom: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Período</div>
          <select className="input" style={{ fontSize: 12, padding: "7px 10px" }}
            value={filterPeriod} onChange={e => setFilterPeriod(e.target.value)}>
            <option value="">Todo</option>
            <option value="7">Esta semana</option>
            <option value="30">Este mes</option>
            <option value="90">Últimos 3 meses</option>
          </select>
        </div>

        {/* Músculo */}
        {(() => {
          const musculos = [...new Set(sessions.flatMap(s =>
            (s.exercises || []).map(ex => EXERCISE_DB.find(e => e.name === ex.name)?.muscle).filter(Boolean)
          ))];
          if (musculos.length === 0) return null;
          return (
            <div style={{ marginBottom: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Músculo</div>
              <select className="input" style={{ fontSize: 12, padding: "7px 10px" }}
                value={filterMuscle} onChange={e => setFilterMuscle(e.target.value)}>
                <option value="">Todos</option>
                {musculos.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          );
        })()}

        {/* Entrenamiento */}
        {(() => {
          const rutinas = [...new Set(sessions.map(s => s.workout).filter(Boolean))];
          if (rutinas.length === 0) return null;
          return (
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8 }}>Entrenamiento</div>
              <select className="input" style={{ fontSize: 12, padding: "7px 10px" }}
                value={filterWorkout} onChange={e => setFilterWorkout(e.target.value)}>
                <option value="">Todos</option>
                {rutinas.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          );
        })()}
      </div>

      {/* ── LISTA + PAGINACIÓN ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <input className="input" style={{ marginBottom: 16 }}
          placeholder="Buscar entrenamiento..."
          value={filterWorkout}
          onChange={e => setFilterWorkout(e.target.value.toLowerCase())} />

        {filtered.length === 0
          ? <div className="empty-state"><div style={{ fontSize: 48, marginBottom: 12 }}>🏋️</div><p className="text-muted">Sin sesiones. ¡A entrenar!</p></div>
          : <>
            {filtered.slice(histPage * 10, (histPage + 1) * 10).map(s => (
              <SessionCard key={s.id} s={s} unit={unit}
                onDelete={deleteSession} onEdit={startEdit} onDuplicate={duplicate}
                onShare={setShareSession}
                onProgress={canCharts ? setProgressEx : () => showToast("⚠️ Disponible solo con cuenta registrada")}
                getProgressData={getProgressData}
                expanded={expanded === s.id} onToggle={() => setExpanded(expanded === s.id ? null : s.id)}
                allSessions={sessions}
                onUpdate={updated => setSessions(prev => prev.map(x => x.id === updated.id ? updated : x))}
              />
            ))}

            {/* Paginación */}
            {Math.ceil(filtered.length / 10) > 1 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                gap: 8, marginTop: 16, padding: "12px 0",
                borderTop: "1px solid var(--border)", fontSize: 13, color: "var(--text-muted)",
                flexWrap: "wrap",
              }}>
                <span>Items por pág. <b style={{ color: "var(--text)" }}>10</b></span>
                <span style={{ margin: "0 8px" }}>
                  {histPage * 10 + 1}–{Math.min((histPage + 1) * 10, filtered.length)} de {filtered.length}
                </span>
                {[
                  { icon: "|<", action: () => setHistPage(0), disabled: histPage === 0 },
                  { icon: "<",  action: () => setHistPage(p => p - 1), disabled: histPage === 0 },
                  { icon: ">",  action: () => setHistPage(p => p + 1), disabled: histPage >= Math.ceil(filtered.length / 10) - 1 },
                  { icon: ">|", action: () => setHistPage(Math.ceil(filtered.length / 10) - 1), disabled: histPage >= Math.ceil(filtered.length / 10) - 1 },
                ].map(btn => (
                  <button key={btn.icon} onClick={btn.action} disabled={btn.disabled}
                    style={{
                      background: "none", border: "1px solid var(--border)",
                      color: btn.disabled ? "var(--border)" : "var(--text-muted)",
                      borderRadius: 6, width: 30, height: 30,
                      cursor: btn.disabled ? "default" : "pointer",
                      fontFamily: "monospace", fontSize: 11,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {btn.icon}
                  </button>
                ))}
              </div>
            )}
          </>
        }
      </div>
    </div>
  </div>
)}

        {/* Dashboard */}
        {activeTab === "dashboard" && (
          <div className="content-area fade-in">
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <button className="btn-ghost" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setShowBadges(true)}>
                <span>🏅</span> Logros ({earnedBadges})
              </button>
              <button className="btn-ghost" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setShowMuscleMap(true)}>
                <span>💪</span> Mapa muscular
              </button>
            </div>
            <Dashboard sessions={sessions} bodyStats={bodyStats} weeklyGoal={weeklyGoal} onGoalClick={() => openPlanner("goal")} onBadgesClick={() => setShowBadges(true)}
              onInsightsClick={() => setShowInsights(true)}
              user={user}
              coachRoutines={coachRoutines}
              onOpenCoach={() => setShowAthleteCoach(true)}
              onStartCoachRoutine={(routine) => { setAthleteCoachInitialRoutine(routine); setShowAthleteCoach(true); }}
              onStartSession={(muscle) => {
                setExMuscle(muscle);
                setActiveTab("new");
                setSessionMode("register");
              }} />
          </div>
        )}
      </main>

      {/* ── MODALES GLOBALES ── */}
      {showPlanner && (
        <WeeklyPlannerModal
          plan={weeklyPlan}
          sessions={sessions}
          onSave={p => setWeeklyPlan(p)}
          onClose={() => setShowPlanner(false)}
          weeklyGoal={weeklyGoal}
          onSaveGoal={g => setWeeklyGoal(g)}
          initTab={plannerInitTab}
        />
      )}
      {showWeeklyGoal && (
        <WeeklyGoalModal
          goal={weeklyGoal}
          sessions={sessions}
          onSave={g => setWeeklyGoal(g)}
          onClose={() => setShowWeeklyGoal(false)}
        />
      )}
      {showTemplates && (
        <TemplatesModal
          sessions={sessions}
          onLoad={(workout, exercises, mode = "live") => {
            setWorkout(workout);
            setCurrentExercises(exercises.map(e => ({ ...e, id: uid() })));
            setActiveTab("new");
            setSessionMode(mode);
          }}
          onClose={() => setShowTemplates(false)}
        />
      )}
      {showLibrary && (
        <ExerciseLibrary
          onSelect={null}
          onClose={() => setShowLibrary(false)}
        />
      )}
      {showTeams && (
        <div className="overlay" onClick={() => setShowTeams(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">◈ GymTeams</h3>
              <button className="close-btn" onClick={() => setShowTeams(false)}>✕</button>
            </div>
            <EmailVerifyWall user={user}>
              <TeamsModal
                user={user}
                sessions={sessions}
                onClose={() => setShowTeams(false)}
                embedded={true}
              />
            </EmailVerifyWall>
          </div>
        </div>
      )}
      {showOnboarding && (
        <OnboardingModal user={user} onComplete={completeOnboarding} onSetGoal={(g) => setWeeklyGoal(g)} />
      )}

      {showChallenge && (
        <TeamChallengeModal
          user={user}
          sessions={sessions}
          onClose={() => setShowChallenge(false)}
        />
      )}
      {showBodyStats && (
        <BodyStatsModal
          stats={bodyStats}
          uid={user.uid}
          isGuest={user.isGuest}
          onSave={s => setBodyStats(s)}
          onClose={() => setShowBodyStats(false)}
        />
      )}
      {showAdminExercises && user.isAdmin && (
        <AdminExercisesModal onClose={() => setShowAdminExercises(false)} />
      )}
      {showAthleteCoach && (
        <AthleteCoachPanel
          user={user}
          initialRoutine={athleteCoachInitialRoutine}
          onClose={() => { setShowAthleteCoach(false); setAthleteCoachInitialRoutine(null); loadCoachRoutines(); }}
        />
      )}
      {showCoach && (
        <div className="overlay" onClick={() => setShowCoach(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">★ Panel Coach</h3>
              <button className="close-btn" onClick={() => setShowCoach(false)}>✕</button>
            </div>
            <EmailVerifyWall user={user}>
              <CoachModal
                user={user}
                sessions={sessions}
                onClose={() => setShowCoach(false)}
                embedded={true}
              />
            </EmailVerifyWall>
          </div>
        </div>
      )}
      {showBadges && (
        <BadgesModal
          sessions={sessions}
          bodyStats={bodyStats}
          onClose={() => setShowBadges(false)}
        />
      )}
      {showMuscleMap && (
        <MuscleMapModal
          sessions={sessions}
          onClose={() => setShowMuscleMap(false)}
        />
      )}
      {showStreakModal && (
        <StreakModal
          sessions={sessions}
          user={user}
          onClose={() => setShowStreakModal(false)}
        />
      )}
      {showProfile && (
        <UserProfileModal
          user={user}
          sessions={sessions}
          bodyStats={bodyStats}
          onOpenBodyStats={() => { setShowProfile(false); setShowBodyStats(true); }}
          onClose={() => setShowProfile(false)}
          onPhotoUpdate={(url) => setCurrentUser(prev => ({ ...prev, photoURL: url }))}
        />
      )}
      {showProgressPicker && (() => {
        const exNames = [...new Set(sessions.flatMap(s => (s.exercises||[]).map(e => e.name)))];
        const grouped = {};
        exNames.forEach(name => {
          const muscle = EXERCISE_DB.find(e => e.name === name)?.muscle || "Otros";
          if (!grouped[muscle]) grouped[muscle] = [];
          grouped[muscle].push(name);
        });
        const muscleOrder = [...MUSCLES, "Otros"].filter(m => grouped[m]);
        const activeMuscle = (pickerMuscle && grouped[pickerMuscle]) ? pickerMuscle : muscleOrder[0] || "";
        const muscleIcons = { Pecho:"💪", Espalda:"🏋️", Hombros:"🔺", Bíceps:"💥", Tríceps:"🔱", Cuádriceps:"🦵", Femoral:"🦵", Glúteos:"🍑", Pantorrillas:"🦶", Core:"🎯", Cardio:"❤️", Otros:"📌" };
        return (
          <div className="overlay" onClick={() => setShowProgressPicker(false)}>
            <div className="modal modal-wide" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">📈 Progreso</h3>
                <button className="close-btn" onClick={() => setShowProgressPicker(false)}>✕</button>
              </div>

              {/* Main tabs */}
              <div style={{ display:"flex", gap:0, marginBottom:16, background:"var(--input-bg)", borderRadius:10, padding:3 }}>
                {[["actividad","📅 Actividad"],["ejercicio","💪 Por ejercicio"]].map(([k,l]) => (
                  <button key={k} onClick={() => setPickerMuscle(k === "actividad" ? "__actividad__" : activeMuscle)}
                    style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: (k==="actividad"?pickerMuscle==="__actividad__":pickerMuscle!=="__actividad__") ? "var(--accent)" : "transparent", color: (k==="actividad"?pickerMuscle==="__actividad__":pickerMuscle!=="__actividad__") ? "white" : "var(--text-muted)", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>{l}</button>
                ))}
              </div>

              {pickerMuscle === "__actividad__" ? (
                <WeeklyChart sessions={sessions} />
              ) : (
                exNames.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "20px 0" }}>Sin ejercicios registrados aún.</p>
                ) : (<>
                  {/* Muscle chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 16 }}>
                    {muscleOrder.map(m => (
                      <button key={m} onClick={() => setPickerMuscle(m)}
                        style={{ padding: "6px 13px", borderRadius: 20, border: `1px solid ${activeMuscle === m ? "var(--accent)" : "var(--border)"}`, background: activeMuscle === m ? "var(--accent-dim)" : "var(--input-bg)", color: activeMuscle === m ? "var(--accent)" : "var(--text-muted)", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}>
                        {muscleIcons[m] || "•"} {m}
                      </button>
                    ))}
                  </div>
                  {/* Exercise list */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {(grouped[activeMuscle] || []).map(name => {
                      const count = sessions.filter(s => (s.exercises||[]).some(e => e.name === name)).length;
                      return (
                        <button key={name} onClick={() => { setProgressEx(name); setShowProgressPicker(false); }}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, cursor: "pointer", color: "var(--text)", fontSize: 13, fontWeight: 600, transition: "all 0.15s" }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                        >
                          <span>{name}</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400 }}>{count} sesión{count !== 1 ? "es" : ""}</span>
                        </button>
                      );
                    })}
                  </div>
                </>)
              )}
            </div>
          </div>
        );
      })()}
      {progressEx && (
        <ProgressModal
          exName={progressEx}
          sessions={sessions}
          onBack={() => { setProgressEx(null); setShowProgressPicker(true); }}
          onClose={() => setProgressEx(null)}
        />
      )}
      {showTimer && (
        <RestTimer onClose={() => setShowTimer(false)} />
      )}
      {showInsights && (
        <InsightsModal sessions={sessions} bodyStats={bodyStats} onClose={() => setShowInsights(false)} />
      )}
      {showOneRM && (
        <OneRMModal onClose={() => setShowOneRM(false)} />
      )}
      {showNameModal && (() => {
        const userTemplates = load("gym_templates", []) || [];
        const presetKeys = Object.keys(PRESETS);
        // Merge: user templates first, then built-in presets not already covered
        const templateOptions = [
          ...userTemplates.map(t => ({ name: t.name, exercises: (t.exercises||[]).map(e => e.name || e), isUser: true })),
          ...presetKeys.filter(k => !userTemplates.find(t => t.name === k)).map(k => ({ name: k, exercises: PRESETS[k], isUser: false })),
        ];
        return (
          <div className="overlay" onClick={() => setShowNameModal(false)}>
            <div className="modal" style={{ maxWidth: 400, padding: 24, maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 36, marginBottom: 6 }}>⚡</div>
                <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>
                  ¿QUÉ VAS A ENTRENAR HOY?
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Dale un nombre o elige una plantilla</div>
              </div>

              {/* Free name input */}
              <input
                autoFocus
                className="input"
                placeholder="Push Day, Piernas, Full Body…"
                value={workout}
                onChange={e => setWorkout(lettersOnly(e.target.value))}
                onKeyDown={e => { if (e.key === "Enter" && workout.trim()) { setShowNameModal(false); setSessionMode("live"); } }}
                style={{ fontSize: 17, fontWeight: 700, fontFamily: "Barlow Condensed, sans-serif", width: "100%", padding: "13px 16px", marginBottom: 16, boxSizing: "border-box", textAlign: "center" }}
              />

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase" }}>o elige una plantilla</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
              </div>

              {/* Template cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {templateOptions.slice(0, 6).map(tpl => (
                  <button key={tpl.name}
                    onClick={() => {
                      setWorkout(tpl.name);
                      // Load exercises if it's a user template
                      const full = userTemplates.find(t => t.name === tpl.name);
                      if (full && full.exercises?.length > 0) {
                        setCurrentExercises(full.exercises.map(e => ({ ...e, id: uid(), sets: [] })));
                      } else if (PRESETS[tpl.name]) {
                        setCurrentExercises(PRESETS[tpl.name].map(n => ({ id: uid(), name: n, sets: [], weight: "", reps: "" })));
                      }
                      setShowNameModal(false);
                      setSessionMode("live");
                    }}
                    style={{
                      background: "var(--input-bg)", border: `1px solid var(--border)`,
                      borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                      textAlign: "left", transition: "all 0.15s", width: "100%",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                      <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "var(--text)" }}>
                        {tpl.isUser ? "📋 " : "⚡ "}{tpl.name}
                      </span>
                      <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: 1 }}>
                        {tpl.isUser ? "MÍA" : "PRESET"} →
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {tpl.exercises.slice(0, 4).join(" · ")}{tpl.exercises.length > 4 ? ` +${tpl.exercises.length - 4} más` : ""}
                    </div>
                  </button>
                ))}
              </div>

              {/* Start button (only if name typed manually) */}
              <button
                disabled={!workout.trim()}
                onClick={() => { setShowNameModal(false); setSessionMode("live"); }}
                style={{ width: "100%", background: workout.trim() ? "var(--accent)" : "var(--input-bg)", color: workout.trim() ? "#0a0a0a" : "var(--text-muted)", border: "none", borderRadius: 8, padding: "13px", fontFamily: "Barlow Condensed, sans-serif", fontSize: 17, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", cursor: workout.trim() ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: workout.trim() ? "0 0 20px rgba(232,255,0,0.25)" : "none" }}>
                EMPEZAR →
              </button>
            </div>
          </div>
        );
      })()}
      {shareSession && (
        <ShareCardModal
          session={shareSession}
          user={user}
          unit={unit}
          onClose={() => setShareSession(null)}
        />
      )}
      {prConfetti && (
        <PRConfetti
          prs={prConfetti.prs}
          onDone={() => setPrConfetti(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      </div>
    </CustomGifCtx.Provider>
)}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(() => load("gym_dark", true));
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [splashPhrase] = useState(() => {
    const _p = [
      "NO PARES HASTA ESTAR ORGULLOSO",
      "LA EXCUSA NO QUEMA CALORÍAS",
      "EL GYM NO MIENTE",
      "UN REP MÁS SIEMPRE",
      "ROMPE EL LÍMITE QUE PUSISTE AYER",
      "LA CONSTANCIA VENCE AL TALENTO",
      "LA DISCIPLINA ES EL CAMINO",
      "YEAH BUDDY!! 🏆",
    ];
    return _p[Math.floor(Math.random() * _p.length)];
  });
  useEffect(() => { const t = setTimeout(() => setSplashDone(true), 2200); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const saved = localStorage.getItem("gym_dark");
    if (saved === null) setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  useEffect(() => { document.body.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { store("gym_dark", dark); }, [dark]);



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
        setCurrentUser({ uid: firebaseUser.uid, name: profile.name || firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free", isCoach: profile.isCoach || false, isAdmin: profile.isAdmin || false, photoURL: firebaseUser.photoURL || profile.photoURL || null, createdAt: firebaseUser.metadata?.creationTime ? new Date(firebaseUser.metadata.creationTime).toISOString().slice(0,10) : null, emailVerified: firebaseUser.emailVerified });
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
      let firebaseUser;
      if (Capacitor.isNativePlatform()) {
        // Usa el plugin nativo de Capacitor — abre el selector de cuenta Google nativo
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        const accessToken = result.credential?.accessToken;
        if (!idToken) return { ok: false, msg: "No se pudo obtener el token de Google" };
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const cred = await signInWithCredential(auth, credential);
        firebaseUser = cred.user;
      } else {
        // En web usa el popup normal
        googleProvider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(auth, googleProvider);
        firebaseUser = cred.user;
      }
      let profile = null;
      try {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        profile = snap.exists() ? snap.data() : null;
      } catch {}
      if (!profile) {
        profile = { uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free" };
        try { await setDoc(doc(db, "users", firebaseUser.uid), profile, { merge: true }); } catch {}
      }
      setCurrentUser({ uid: firebaseUser.uid, name: profile?.name || firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free", isCoach: profile?.isCoach || false, isAdmin: profile?.isAdmin || false, photoURL: firebaseUser.photoURL || profile?.photoURL || null, emailVerified: firebaseUser.emailVerified });
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

  if (authLoading || !splashDone) {
    const _matrixPhrases = [
      "NO HAY EXCUSAS","DALE DURO","ROMPE TUS LÍMITES","SIN DOLOR NO HAY GLORIA",
      "ENTRENA COMO BESTIA","UN DÍA MÁS","TÚ PUEDES MÁS","MODO HARDCORE",
      "CADA REP CUENTA","NO TE RINDAS","SUPERA TUS MARCAS","MÁS PESO",
      "CONSTANCIA ES CLAVE","SUDOR Y SACRIFICIO","NUNCA PARES","SUBE EL PESO",
      "HOY MÁS QUE AYER","SIN LÍMITES","DESTRUYE EL LÍMITE","FULL POWER",
      "CERO EXCUSAS","ROMPE RECORDS","SANGRE Y HIERRO","BRUTAL",
      "DROP SET","SUPERSET","FUERZA TOTAL","A TOPE","BEAST MODE",
    ];
    const _fixedPhrases = [
      "NO PARES HASTA ESTAR ORGULLOSO",
      "LA EXCUSA NO QUEMA CALORÍAS",
      "EL GYM NO MIENTE",
      "UN REP MÁS SIEMPRE",
      "ROMPE EL LÍMITE QUE PUSISTE AYER",
      "LA CONSTANCIA VENCE AL TALENTO",
      "LA DISCIPLINA ES EL CAMINO",
      "YEAH BUDDY!! 🏆",
    ];
    // genera columnas de frases cayendo
    const _cols = Array.from({length: 7}, (_, ci) => ({
      id: ci,
      left: `${5 + ci * 13.5}%`,
      delay: ci * 0.18,
      duration: 2.8 + ci * 0.3,
      phrases: Array.from({length: 6}, (_, i) => _matrixPhrases[(ci * 6 + i) % _matrixPhrases.length]),
    }));
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0a0a0a", flexDirection:"column", gap:0, overflow:"hidden", position:"relative" }}>
        <style>{`
          @keyframes splashZoom {
            0%   { transform: scale(0.85); opacity: 0; }
            60%  { transform: scale(1.03); opacity: 1; }
            100% { transform: scale(1);    opacity: 1; }
          }
          @keyframes splashFadeUp {
            0%   { opacity: 0; transform: translateY(10px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes matrixFall {
            0%   { transform: translateX(0); opacity: 0; }
            5%   { opacity: 1; }
            85%  { opacity: 0.8; }
            100% { transform: translateX(220vw); opacity: 0; }
          }
          .splash-logo { animation: splashZoom 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards; z-index:10; position:relative; }
          .splash-sub  { animation: splashFadeUp 0.4s ease 0.6s both; }
        `}</style>

        {/* Matrix rows - horizontal falling */}
        {_cols.map(col => (
          <div key={col.id} style={{
            position:"absolute", left:"-100%",
            top: `${8 + col.id * 13}%`,
            display:"flex", flexDirection:"row", alignItems:"center", gap:32,
            animation: `matrixFall ${col.duration}s linear ${col.delay}s infinite`,
            pointerEvents:"none",
          }}>
            {col.phrases.map((p, i) => (
              <span key={i} style={{
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize: i % 2 === 0 ? 11 : 9,
                fontWeight: 800,
                letterSpacing: 3,
                textTransform:"uppercase",
                whiteSpace:"nowrap",
                color: i === 0 ? "rgba(232,255,0,0.45)" : `rgba(232,255,0,${0.05 + i * 0.025})`,
              }}>{p}</span>
            ))}
          </div>
        ))}

        {/* Logo central */}
        <div className="splash-logo" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0, width:"100%", padding:"0 16px" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:40, lineHeight:1, marginBottom:4 }}>⚡</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(28px, 9vw, 48px)", fontWeight:900, color:"#f0f0f0", letterSpacing:"clamp(4px, 2vw, 8px)", textTransform:"uppercase", textAlign:"center", whiteSpace:"nowrap" }}>GYMTRACKER</div>
          <div style={{ width:32, height:2, background:"#e8ff00", marginTop:10, borderRadius:1 }} />
          {((_f) => (
            <div className="splash-sub" style={{ marginTop:12, textAlign:"center",
              color: _f === "YEAH BUDDY!! 🏆" ? "#e8ff00" : "rgba(255,255,255,0.25)",
              fontSize: _f === "YEAH BUDDY!! 🏆" ? 18 : 10,
              fontWeight: 900, letterSpacing: _f === "YEAH BUDDY!! 🏆" ? 3 : 5,
              textTransform:"uppercase",
              textShadow: _f === "YEAH BUDDY!! 🏆" ? "0 0 20px rgba(232,255,0,0.6)" : "none",
            }}>{_f}</div>
          ))(splashPhrase)}
        </div>

        {/* Cargando abajo */}
        <div style={{ position:"absolute", bottom:40, color:"rgba(255,255,255,0.18)", fontSize:10, fontWeight:800, letterSpacing:5, textTransform:"uppercase", zIndex:10, animation:"splashFadeUp 0.4s ease 0.8s both" }}>CARGANDO</div>
      </div>
    );
  }

  return (
    <ThemeCtx.Provider value={{ dark, toggleDark }}>
      <AuthCtx.Provider value={{ user: currentUser, loginWithFirebase, registerWithFirebase, logout, loginAsGuest, resetPassword, loginWithGoogle }}>
        <style>{CSS}</style>
        {!currentUser
          ? <LoginScreen />
          : <>{typeof document !== "undefined" && (document.body.classList.add("app-loaded"))}<GymApp /></>
        }
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800;900&family=Barlow:wght@300;400;500;600;700&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body[data-theme="dark"] {
  --bg:        #0a0a0a;
  --surface:   #111111;
  --card:      #141414;
  --border:    rgba(255,255,255,0.08);
  --accent:    #e8ff00;
  --accent-2:  #facc15;
  --accent-dim: rgba(232,255,0,0.07);
  --text:      #f0f0f0;
  --text-muted: rgba(255,255,255,0.35);
  --danger:    #ef4444;
  --sidebar-bg: #0a0a0a;
  --sidebar-text: rgba(255,255,255,0.45);
  --sidebar-text-hover: rgba(255,255,255,0.9);
  --sidebar-border: rgba(255,255,255,0.06);
  --sidebar-hover-bg: rgba(232,255,0,0.08);
  --input-bg:  #1a1a1a;
  --shadow:    0 8px 40px rgba(0,0,0,0.7);
}
body[data-theme="light"] {
  --bg:        #f2f2f0;
  --surface:   #ffffff;
  --card:      #ffffff;
  --border:    rgba(0,0,0,0.1);
  --accent:    #c8e000;
  --accent-2:  #ca9a04;
  --accent-dim: rgba(200,224,0,0.1);
  --text:      #0a0a0a;
  --text-muted: rgba(0,0,0,0.4);
  --danger:    #dc2626;
  --sidebar-bg: #ffffff;
  --sidebar-text: rgba(0,0,0,0.45);
  --sidebar-text-hover: rgba(0,0,0,0.9);
  --sidebar-border: rgba(0,0,0,0.08);
  --sidebar-hover-bg: rgba(0,0,0,0.05);
  --input-bg:  #f5f5f3;
  --shadow:    0 4px 24px rgba(0,0,0,0.1);
}

html, body { background: var(--bg) !important; }
body { font-family: 'Barlow', sans-serif; color: var(--text); transition: color 0.3s; }
body.app-loaded { background: var(--bg) !important; }

/* ── Layout ── */
.app-layout { display: flex; min-height: 100vh; }
.main-content { flex: 1; display: flex; flex-direction: column; min-height: 100vh; background: var(--bg); min-width: 0; margin-left: 240px; }

/* ── Sidebar ── */
.sidebar {
  position: fixed; top: 0; left: 0; height: 100vh; width: 240px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--sidebar-border);
  display: flex; flex-direction: column; padding: 20px 0; z-index: 100; overflow-y: auto; overflow-x: hidden;
}
.sidebar-top {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 16px 20px;
  border-bottom: 1px solid var(--sidebar-border);
  margin-bottom: 12px;
}
.sidebar-logo { display: flex; align-items: center; gap: 10px; }
.logo-text {
  font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
  font-size: 20px; letter-spacing: 6px; color: var(--sidebar-text-hover); text-transform: uppercase;
}
.sidebar-nav { flex: 1; padding: 0 10px; display: flex; flex-direction: column; gap: 2px; }
.sidebar-bottom { padding: 12px 10px 0; border-top: 1px solid var(--sidebar-border); margin-top: auto; }
.user-card { display: flex; align-items: center; gap: 10px; padding: 10px 12px; margin-bottom: 4px; }
.user-avatar {
  width: 32px; height: 32px; border-radius: 4px;
  background: var(--accent); display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 13px; color: #0a0a0a; flex-shrink: 0;
  font-family: 'Barlow Condensed', sans-serif;
}
.user-name { font-size: 12px; font-weight: 600; color: var(--sidebar-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 3px; letter-spacing: 0.5px; }

/* ── Nav items ── */
.nav-item {
  display: flex; align-items: center; gap: 12px; padding: 10px 12px;
  border-radius: 4px; background: none; border: none;
  color: var(--sidebar-text);
  font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700;
  cursor: pointer; text-align: left; width: 100%;
  transition: background 0.15s, color 0.15s; white-space: nowrap;
  letter-spacing: 1px; text-transform: uppercase;
}
.nav-item:hover { background: var(--sidebar-hover-bg); color: var(--sidebar-text-hover); }
.nav-item.active {
  background: var(--sidebar-hover-bg);
  color: var(--accent);
  border-left: 2px solid var(--accent);
  padding-left: 10px;
}
.nav-icon { font-size: 15px; flex-shrink: 0; }
.plan-badge {
  background: none; border: 1px solid var(--accent); color: var(--accent);
  border-radius: 3px; padding: 1px 7px; font-size: 10px; font-weight: 800;
  cursor: pointer; font-family: 'Barlow Condensed', sans-serif;
  letter-spacing: 1px; transition: background 0.2s;
}
.plan-badge:hover { background: var(--accent); color: #0a0a0a; }

/* ── Topbar ── */
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 24px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  position: sticky; top: 0; z-index: 10;
}
.page-title {
  font-family: 'Barlow Condensed', sans-serif; font-size: 20px;
  font-weight: 900; letter-spacing: 3px; text-transform: uppercase;
}
.topbar-actions { display: flex; gap: 6px; align-items: center; }
.topbar-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  background: var(--input-bg); border: 1px solid var(--border);
  color: var(--text-muted); border-radius: 4px;
  padding: 6px 10px; cursor: pointer; min-width: 46px; transition: all 0.2s;
}
.topbar-btn:hover { border-color: var(--accent); color: var(--accent); }
.topbar-btn-icon { font-size: 14px; line-height: 1; }
.topbar-btn-label { font-size: 9px; font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; }

/* ── Hamburger ── */
.hamburger { background: none; border: none; cursor: pointer; display: flex; flex-direction: column; gap: 5px; padding: 4px; }
.hamburger span { display: block; width: 22px; height: 2px; background: var(--text); }

/* ── Mobile drawer ── */
.mobile-drawer-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 200; backdrop-filter: blur(4px); }
.mobile-drawer { position: absolute; top: 0; left: 0; width: 280px; height: 100vh; background: var(--surface); display: flex; flex-direction: column; overflow-y: auto; animation: slideRight 0.25s ease; border-right: 1px solid var(--border); }
@keyframes slideRight { from { transform: translateX(-100%); } to { transform: translateX(0); } }

/* ── Mobile bottom nav ── */
.mobile-bottom-nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  height: calc(60px + env(safe-area-inset-bottom));
  padding-bottom: env(safe-area-inset-bottom);
  z-index: 100;
  background: var(--surface);
  border-top: 1px solid var(--border);
  display: flex; align-items: stretch;
}
.mobile-nav-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 3px; background: none; border: none; color: var(--text-muted);
  cursor: pointer; font-family: 'Barlow', sans-serif; transition: color 0.15s; padding: 0;
  font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
}
.mobile-nav-btn.active { color: var(--accent); }
.mobile-nav-btn:hover { color: var(--text); }

/* ── Responsive ── */
.desktop-only { display: flex !important; }
.mobile-only { display: none !important; }
@media (max-width: 768px) {
  .desktop-only { display: none !important; }
  .mobile-only { display: flex !important; }
  .main-content { margin-left: 0 !important; padding-bottom: env(safe-area-inset-bottom); }
  .sidebar { display: none !important; }
  .content-area { padding: 16px; }
  .topbar { padding: 12px 16px; padding-top: max(12px, env(safe-area-inset-top)); }
  .form-row { flex-direction: column; }
  .topbar-actions .topbar-btn { min-width: 38px; padding: 5px 8px; }
  .modal { padding: 20px 16px; max-height: 85vh; }
  .modal-wide { max-width: 100%; }
  .overlay { padding: 12px; align-items: flex-end; }
  .modal, .modal-wide { border-bottom-left-radius: 0; border-bottom-right-radius: 0; max-height: 92vh; }
  .modal-profile { position: fixed !important; inset: 0 !important; border-radius: 0 !important; max-height: 100vh !important; height: 100dvh !important; margin: 0 !important; overflow-y: auto !important; }
  .overlay:has(.modal-profile) { padding: 0 !important; align-items: stretch !important; }
}

/* ── Content ── */
.content-area { padding: 24px 28px; max-width: 900px; width: 100%; margin: 0 auto; flex: 1; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 22px; margin-bottom: 16px; box-shadow: var(--shadow); transition: border-color 0.2s, background 0.3s; }
.card:hover { border-color: var(--accent-dim); }
.card-label { font-size: 10px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: var(--accent); margin-bottom: 18px; font-family: 'Barlow Condensed', sans-serif; }
.form-row { display: flex; gap: 12px; margin-bottom: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 0; }
.field-label { font-size: 10px; font-weight: 800; color: var(--text-muted); letter-spacing: 2px; text-transform: uppercase; font-family: 'Barlow Condensed', sans-serif; }
.input { background: var(--input-bg); border: 1px solid var(--border); border-radius: 4px; padding: 10px 14px; color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; outline: none; width: 100%; transition: border-color 0.2s, box-shadow 0.2s, background 0.3s; }
.input:focus { border-color: var(--accent); box-shadow: 0 0 0 2px rgba(232,255,0,0.12); }
input[type="date"].input { color-scheme: dark; }
.textarea { resize: vertical; min-height: 70px; }

/* ── Dropdowns ── */
.dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #1a1a1a; border: 1px solid var(--border); border-radius: 6px; z-index: 200; overflow: hidden; box-shadow: var(--shadow); }
.dropdown-item { display: block; width: 100%; background: none; border: none; color: var(--text); padding: 10px 16px; text-align: left; font-family: 'Barlow', sans-serif; font-size: 14px; cursor: pointer; transition: background 0.15s; }
.dropdown-item:hover { background: var(--accent-dim); color: var(--accent); }

/* ── Sets & exercises ── */
.sets-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0; }
.set-chip { background: var(--accent-dim); border: 1px solid rgba(232,255,0,0.25); color: var(--accent); border-radius: 3px; padding: 4px 10px; font-size: 11px; font-weight: 700; display: flex; align-items: center; gap: 6px; font-family: 'Barlow Condensed', sans-serif; letter-spacing: 0.5px; }
.sets-badge { display: inline-block; background: var(--accent-dim); border: 1px solid rgba(232,255,0,0.25); color: var(--accent); border-radius: 3px; padding: 1px 6px; font-size: 10px; font-weight: 800; margin-left: 8px; vertical-align: middle; font-family: 'Barlow Condensed', sans-serif; letter-spacing: 1px; }
.chip-del { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 13px; padding: 0 2px; transition: color 0.2s; }
.chip-del:hover { color: var(--danger); }
.ex-list { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.ex-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: var(--input-bg); border-radius: 4px; border: 1px solid var(--border); animation: slideIn 0.2s ease; }
.ex-name { font-weight: 700; font-size: 14px; font-family: 'Barlow', sans-serif; }
.ex-detail { color: var(--text-muted); font-size: 12px; }

/* ── Buttons ── */
.btn-primary { background: var(--accent); border: none; border-radius: 4px; padding: 13px 24px; color: #0a0a0a; font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 20px rgba(232,255,0,0.2); }
.btn-primary:hover { background: #f0ff40; transform: translateY(-1px); box-shadow: 0 4px 24px rgba(232,255,0,0.35); }
.btn-primary:active { transform: scale(0.98); }
.btn-ghost { background: var(--input-bg); border: 1px solid var(--border); color: var(--text-muted); border-radius: 4px; padding: 9px 16px; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
.btn-ghost:hover { border-color: var(--accent); color: var(--text); }
.btn-ghost.danger:hover { border-color: var(--danger); color: var(--danger); }
.btn-ghost.small { padding: 6px 12px; font-size: 12px; }
.btn-add-ex { width: 100%; background: none; border: 1px dashed rgba(255,255,255,0.1); color: var(--text-muted); border-radius: 4px; padding: 10px; margin-top: 12px; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.5px; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
.btn-add-ex:hover { border-color: var(--accent); color: var(--accent); }
.link-btn { background: none; border: none; color: var(--accent); cursor: pointer; font-family: 'Barlow', sans-serif; font-size: inherit; font-weight: 700; }
.link-btn:hover { text-decoration: underline; }
.icon-action { background: none; border: none; cursor: pointer; font-size: 15px; padding: 4px; opacity: 0.5; transition: opacity 0.2s; }
.icon-action:hover { opacity: 1; }

/* ── Session cards ── */
.session-card { animation: slideIn 0.25s ease both; }
.session-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; flex-wrap: wrap; gap: 8px; }
.session-date { font-size: 11px; color: var(--text-muted); font-weight: 600; letter-spacing: 1px; text-transform: uppercase; font-family: 'Barlow Condensed', sans-serif; }
.session-workout { font-weight: 900; font-size: 16px; font-family: 'Barlow Condensed', sans-serif; letter-spacing: 1px; text-transform: uppercase; }
.ex-count { font-size: 10px; color: var(--text-muted); background: var(--input-bg); border: 1px solid var(--border); border-radius: 3px; padding: 3px 8px; font-family: 'Barlow Condensed', sans-serif; font-weight: 700; letter-spacing: 1px; }
.chevron { color: var(--text-muted); font-size: 10px; }
.session-body { margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px; animation: fadeIn 0.2s ease; }
.session-notes { color: var(--text-muted); font-size: 13px; margin-bottom: 12px; font-style: italic; }
.ex-row-saved { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); gap: 10px; flex-wrap: wrap; }
.session-actions { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }

/* ── Dashboard ── */
.section-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 20px; color: var(--text); }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
.stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 18px 16px; display: flex; flex-direction: column; gap: 6px; animation: slideIn 0.3s ease both; transition: border-color 0.2s, transform 0.2s; }
.stat-card:hover { border-color: var(--accent); transform: translateY(-2px); }
.stat-value { font-family: 'Barlow Condensed', sans-serif; font-size: 26px; font-weight: 900; color: var(--accent); }

/* ── Login ── */
.login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; background: var(--bg); }
.login-box { background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 40px 36px; width: 100%; max-width: 420px; box-shadow: var(--shadow); animation: fadeIn 0.4s ease; }
.login-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
.tab-row { display: flex; border-bottom: 1px solid var(--border); margin-bottom: 22px; }
.tab-btn { flex: 1; background: none; border: none; border-bottom: 2px solid transparent; color: var(--text-muted); padding: 10px; font-family: 'Barlow', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: all 0.2s; margin-bottom: -1px; }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }
.err-msg { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3); color: #f87171; border-radius: 4px; padding: 9px 12px; font-size: 13px; margin-bottom: 10px; }

/* ── Plans ── */
.plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 8px; }
.plan-card { border: 1px solid var(--border); border-radius: 6px; padding: 20px 16px; display: flex; flex-direction: column; gap: 8px; }
.plan-card.plan-active { border-color: var(--accent); background: var(--accent-dim); }
.plan-name { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
.plan-price { font-size: 16px; font-weight: 700; font-family: 'Barlow Condensed', sans-serif; }
.plan-features { list-style: none; display: flex; flex-direction: column; gap: 5px; font-size: 12px; color: var(--text-muted); flex: 1; margin: 4px 0; }
.plan-btn { border-radius: 4px; padding: 9px; font-family: 'Barlow Condensed', sans-serif; font-size: 14px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; cursor: pointer; transition: opacity 0.2s; margin-top: auto; }
.plan-btn:hover { opacity: 0.85; }

/* ── Library ── */
.lib-filters { display: flex; gap: 8px; margin-bottom: 12px; }
.muscle-chips { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 6px; margin-bottom: 14px; }
.muscle-chip { background: none; border: 1px solid var(--border); color: var(--text-muted); border-radius: 3px; padding: 5px 12px; width: 100%; text-align: center; font-family: 'Barlow', sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; letter-spacing: 0.3px; }
.muscle-chip:hover { border-color: var(--accent); color: var(--text); }
.muscle-chip.active { background: var(--accent); border-color: var(--accent); color: #0a0a0a; font-weight: 800; }
.lib-list { overflow-y: auto; flex: 1; padding-right: 4px; }
.lib-list::-webkit-scrollbar { width: 3px; }
.lib-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }
.lib-group { margin-bottom: 16px; }
.lib-group-title { font-size: 10px; font-weight: 800; letter-spacing: 3px; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; padding: 0 4px; font-family: 'Barlow Condensed', sans-serif; }
.lib-item { display: flex; align-items: center; gap: 12px; width: 100%; background: none; border: none; border-bottom: 1px solid var(--border); padding: 10px 6px; cursor: pointer; text-align: left; margin-bottom: 2px; transition: background 0.15s; }
.lib-item:hover { background: var(--accent-dim); }
.lib-info { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.lib-name { color: var(--text); font-family: 'Barlow', sans-serif; font-size: 14px; font-weight: 600; }
.lib-meta { color: var(--text-muted); font-size: 11px; }
.lib-add { color: var(--accent); font-size: 20px; font-weight: 300; flex-shrink: 0; opacity: 0.6; transition: opacity 0.2s; }
.lib-item:hover .lib-add { opacity: 1; }

/* ── Modals ── */
.overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; animation: fadeIn 0.2s ease; backdrop-filter: blur(6px); }
.modal { background: var(--card); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 28px; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; box-shadow: 0 24px 80px rgba(0,0,0,0.8); animation: slideUp 0.25s ease; }
.modal-wide { max-width: 680px; }
.modal-library { max-width: 520px; max-height: 85vh; display: flex; flex-direction: column; }
.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.modal-title { font-family: 'Barlow Condensed', sans-serif; font-size: 20px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
.close-btn { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 4px; transition: color 0.2s; flex-shrink: 0; }
.close-btn:hover { color: var(--text); }

/* ── Misc ── */
.text-muted { color: var(--text-muted); }
.empty-state { text-align: center; padding: 60px 20px; color: var(--text-muted); }
.upgrade-banner { background: rgba(239,68,68,0.07); border: 1px solid rgba(239,68,68,0.25); color: #f87171; border-radius: 6px; padding: 12px 18px; font-size: 13px; margin-bottom: 16px; }
.toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); background: #1a1a1a; border: 1px solid rgba(232,255,0,0.3); color: var(--text); padding: 12px 22px; border-radius: 4px; font-size: 13px; font-weight: 700; letter-spacing: 0.5px; z-index: 9999; white-space: nowrap; box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(232,255,0,0.1); animation: toastIn 0.3s ease; }
@media (min-width: 769px) { .toast { bottom: 28px; } }
@media (max-width: 768px) { .history-sidebar { display: none !important; } }

@keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
@keyframes floatPhrase {
  0%   { transform: rotate(var(--angle, -5deg)) translate(0, 0); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: rotate(var(--angle, -5deg)) translate(var(--dx, 40px), var(--dy, -80px)); opacity: 0; }
}
@keyframes floatBadge { 0%,100% { transform: translateY(0) rotate(-5deg); } 50% { transform: translateY(-6px) rotate(5deg); } }
@keyframes slideIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
@keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
.fade-in { animation: fadeIn 0.3s ease; }
select.input { cursor: pointer; }
select.input option { background: #1a1a1a; color: var(--text); }
.btn-guest { width: 100%; background: var(--input-bg); border: 1px solid var(--border); color: var(--text); border-radius: 4px; padding: 12px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer; transition: border-color 0.2s, background 0.2s; font-family: 'Barlow', sans-serif; }
.btn-guest:hover { border-color: rgba(232,255,0,0.3); background: rgba(232,255,0,0.03); }
.guest-banner { background: rgba(232,255,0,0.05); border: 1px solid rgba(232,255,0,0.2); color: var(--accent); border-radius: 6px; padding: 10px 16px; font-size: 13px; margin-bottom: 16px; display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-weight: 600; }
@keyframes prBannerIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.6); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }
`;