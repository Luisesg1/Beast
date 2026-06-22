import { useState, useEffect, useRef } from "react";
import { useConfirm } from "./ConfirmModal";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";
import { getAthleteRoutines, resetAthleteRoutinesCompleted } from "./CoachModal";
import {
  joinCoachByCode,
  getMyCoaches,
  getFullRoutine,
  markRoutineCompleted,
} from "../utils/firebaseService";
import LiveTrainMode from "./LiveTrainMode";
import { DAYS_ES } from "../utils/constants";

function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const colors = ["#CFFF4D","#22c55e","#f97316","#ffffff","#a3e635","#FBBF24","#34d399","#fb923c"];

  function burst(cx, cy, count, speedMult) {
    return Array.from({length: count}, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 8) * speedMult;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 4,
        r: 3 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        shape: ["rect","circle","triangle"][Math.floor(Math.random()*3)],
        alpha: 1, gravity: 0.15 + Math.random() * 0.1, trail: [],
      };
    });
  }

  let particles = [];
  particles.push(...burst(W/2, H*0.45, 80, 1.4));
  setTimeout(() => particles.push(...burst(W*0.2, H*0.5, 40, 1.1)), 200);
  setTimeout(() => particles.push(...burst(W*0.8, H*0.5, 40, 1.1)), 350);
  setTimeout(() => particles.push(...burst(W/2, H*0.3, 50, 1.6)), 500);

  let frame;
  const startTime = performance.now();
  const duration = 3500;

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    const elapsed = ts - startTime;
    particles.forEach(p => {
      p.trail.push({x: p.x, y: p.y});
      if (p.trail.length > 5) p.trail.shift();
      p.vx *= 0.98; p.vy += p.gravity; p.x += p.vx; p.y += p.vy;
      p.angle += p.spin;
      p.alpha = Math.max(0, 1 - elapsed / duration * 1.3);
      if (p.trail.length > 1) {
        ctx.save(); ctx.globalAlpha = p.alpha * 0.3; ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r * 0.5; ctx.beginPath();
        p.trail.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.shadowColor = p.color; ctx.shadowBlur = 6;
      ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      if (p.shape === "rect") ctx.fillRect(-p.r, -p.r*0.5, p.r*2, p.r);
      else if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0,0,p.r,0,Math.PI*2); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(0,-p.r); ctx.lineTo(p.r*0.866,p.r*0.5); ctx.lineTo(-p.r*0.866,p.r*0.5); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    });
    particles = particles.filter(p => p.y < H + 50 && p.alpha > 0.01);
    if (elapsed < duration) frame = requestAnimationFrame(draw);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }
  frame = requestAnimationFrame(draw);
}

// ─── Helpers locales ──────────────────────────────────────────────────────────
const uid = () => typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; };
const load = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
const numDot = (v, max = 9999) => { const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"); const n = parseFloat(s); if (isNaN(n) || n < 0) return ""; return n > max ? String(max) : s; };
const numWeight = (v) => numDot(v, 500);
const numReps   = (v) => numDot(v, 100);
const LIVE_DRAFT_KEY = "gym_live_draft";

// ─── AthleteCoachPanel ────────────────────────────────────────────────────────
function AthleteCoachPanel({ user, onClose, initialRoutine = null, ExerciseGif, sessions = [], onSessionSaved }) {
  const { confirm: askConfirm, modal: confirmModal } = useConfirm();
  const [tab, setTab] = useState("routines");
  const [coaches, setCoaches] = useState([]);
  const [assignedRoutines, setAssignedRoutines] = useState([]);
  const [fullRoutines, setFullRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState("");
  const [joinMsg, setJoinMsg] = useState("");
  const [joining, setJoining] = useState(false);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [pendingInitialDocId] = useState(initialRoutine?._docId || null);
  const [newRoutineCount, setNewRoutineCount] = useState(0);
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [coachProfileData, setCoachProfileData] = useState(null);
  const [loadingCoachProfile, setLoadingCoachProfile] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [myCoaches, myRoutines] = await Promise.all([
      getMyCoaches(user.uid),
      getAthleteRoutines(user.uid),
    ]);
    const enrichedCoaches = await Promise.all(myCoaches.map(async (c) => {
      try {
        const coachSnap = await getDoc(doc(db, "coaches", c.coachUid));
        const coachData = coachSnap.exists() ? coachSnap.data() : {};
        return { ...c, photoURL: coachData.photoURL || c.photoURL || null };
      } catch(e) { return c; }
    }));
    setCoaches(enrichedCoaches);
    setAssignedRoutines(myRoutines);
    const full = await Promise.all(
      myRoutines
        .filter(r => r.coachUid && r.routineId)
        .map(r =>
          getFullRoutine(r.coachUid, r.routineId).then(routine =>
            routine ? { ...routine, _docId: r._docId, routineId: r.routineId, coachUid: r.coachUid, dayOfWeek: r.dayOfWeek ?? -1 } : null
          ).catch(() => null)
        )
    );
    const validFull = full.filter(Boolean).sort((a, b) => {
      const da = a.dayOfWeek >= 0 ? a.dayOfWeek : 999;
      const db = b.dayOfWeek >= 0 ? b.dayOfWeek : 999;
      return da - db;
    });
    setFullRoutines(validFull);
    const lastSeen = parseInt(localStorage.getItem(`lastSeenRoutines_${user.uid}`) || "0");
    setNewRoutineCount(Math.max(0, validFull.length - lastSeen));
    setLoading(false);
    // If opened from banner, use fresh routine data (with coach comments)
    if (pendingInitialDocId) {
      const fresh = validFull.find(r => r._docId === pendingInitialDocId);
      if (fresh) setActiveWorkout(fresh);
      else if (initialRoutine) setActiveWorkout(initialRoutine); // fallback
    }
  }

  async function loadCoachProfile(coachUid) {
    setLoadingCoachProfile(true);
    try {
      const [coachSnap, userSnap] = await Promise.all([
        getDoc(doc(db, "coaches", coachUid)),
        getDoc(doc(db, "users", coachUid)),
      ]);
      const coachData = coachSnap.exists() ? coachSnap.data() : {};
      const userData = userSnap.exists() ? userSnap.data() : {};
      setCoachProfileData({ ...coachData, ...userData, uid: coachUid });
    } catch(e) { setCoachProfileData(null); }
    setLoadingCoachProfile(false);
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
    const coachComments = Object.fromEntries(
      (activeWorkout.exercises || [])
        .filter(ex => ex.comment)
        .map(ex => [ex.name, ex.comment])
    );
    return (
      <LiveTrainMode
        exercises={activeWorkout.exercises || []}
        workout={activeWorkout.name}
        date={todayStr()}
        notes=""
        unit="kg"
        sessions={sessions}
        ExerciseGif={ExerciseGif}
        coachMode={true}
        coachComments={coachComments}
        onBack={() => setActiveWorkout(null)}
        onSaveSession={async (exercises, elapsed) => {
          const newSession = {
            id: uid(),
            date: todayStr(),
            workout: activeWorkout.name,
            notes: "",
            exercises,
            unit: "kg",
            durationSecs: elapsed,
            coachRoutineDocId: activeWorkout._docId || null,
          };

          try {
            const snap = await getDoc(doc(db, "sessions", user.uid));
            const existing = snap.exists() ? (snap.data().list || []) : [];
            await setDoc(doc(db, "sessions", user.uid), {
              list: [newSession, ...existing],
              updatedAt: serverTimestamp()
            });
            console.log("✅ Sesión coach guardada OK:", newSession.date, "total:", existing.length + 1);
            if (onSessionSaved) onSessionSaved(newSession);
          } catch(e) {
            console.error("❌ Error guardando sesión:", e.code, e.message);
            alert(`❌ No se pudo guardar la sesión.\nError: ${e.code || e.message}`);
            return;
          }

          const marked = await markRoutineCompleted(user.uid, activeWorkout._docId || activeWorkout.routineId || activeWorkout.id);
          if (!marked) {
            // La sesión ya se guardó arriba; solo falló marcar la rutina como completada.
            alert("⚠️ Tu entrenamiento se guardó, pero no pudimos marcar la rutina como completada. Verifica tu conexión y usa ↻ para reintentar.");
          }
          const updated = await getAthleteRoutines(user.uid);
          setAssignedRoutines(updated);
          setActiveWorkout(null);
        }}
      />
    );
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🎽 Mi Coach</h3>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <button onClick={async () => { await resetAthleteRoutinesCompleted(user.uid); loadData(); }} title="Actualizar — resetea rutinas completadas" style={{ background:"none", border:"1px solid var(--border)", color:"var(--text-muted)", borderRadius:6, width:28, height:28, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" }}>↻</button>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="tab-row" style={{ marginBottom:20 }}>
          <button className={`tab-btn ${tab==="routines"?"active":""}`} onClick={()=>{ setTab("routines"); setNewRoutineCount(0); localStorage.setItem(`lastSeenRoutines_${user.uid}`, String(fullRoutines.length)); }} style={{ position:"relative" }}>
            📋 Rutinas
            {newRoutineCount > 0 && <span style={{ position:"absolute", top:-4, right:-4, background:"#ef4444", color:"white", borderRadius:"50%", width:16, height:16, fontSize:10, fontWeight:800, display:"flex", alignItems:"center", justifyContent:"center" }}>{newRoutineCount}</span>}
          </button>
          <button className={`tab-btn ${tab==="coaches"?"active":""}`} onClick={()=>setTab("coaches")}>👥 Mis coaches</button>
          <button className={`tab-btn ${tab==="join"?"active":""}`} onClick={()=>setTab("join")}>🔗 Unirme</button>
        </div>

        {/* Modal perfil coach */}
        {selectedCoach && (
          <div className="overlay" onClick={() => { setSelectedCoach(null); setCoachProfileData(null); }} style={{ zIndex:1100 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth:360 }}>
              <div className="modal-header">
                <h3 className="modal-title">Perfil del Coach</h3>
                <button className="close-btn" onClick={() => { setSelectedCoach(null); setCoachProfileData(null); }}>✕</button>
              </div>
              {loadingCoachProfile ? (
                <div style={{ textAlign:"center", padding:30, color:"var(--text-muted)" }}>⏳ Cargando...</div>
              ) : coachProfileData ? (
                <div style={{ textAlign:"center", padding:"10px 0 20px" }}>
                  {coachProfileData.photoURL ? (
                    <img src={coachProfileData.photoURL} alt="coach" style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover", marginBottom:12, border:"2px solid var(--accent)" }} />
                  ) : (
                    <div style={{ width:72, height:72, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:28, color:"white", margin:"0 auto 12px" }}>
                      {coachProfileData.name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div style={{ fontWeight:800, fontSize:18, marginBottom:4 }}>{coachProfileData.name || "Coach"}</div>
                  <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:8 }}>{coachProfileData.email || selectedCoach.coachEmail}</div>
                  {coachProfileData.specialty && <div style={{ fontSize:12, color:"var(--accent)", fontWeight:700, marginBottom:12 }}>💪 {coachProfileData.specialty}</div>}
                  {coachProfileData.bio && (
                    <div style={{ fontSize:13, color:"var(--text-muted)", lineHeight:1.6, background:"var(--input-bg)", borderRadius:10, padding:"10px 14px", marginBottom:12, textAlign:"left" }}>
                      {coachProfileData.bio}
                    </div>
                  )}
                  <div style={{ fontSize:12, color:"var(--text-muted)" }}>
                    {Object.keys(coachProfileData.athletes || {}).length} atletas activos
                  </div>
                </div>
              ) : (
                <div style={{ textAlign:"center", padding:30, color:"var(--text-muted)" }}>No se pudo cargar el perfil.</div>
              )}
            </div>
          </div>
        )}

        {tab === "routines" && (
          <div>
            {fullRoutines.length === 0 ? (
              <div style={{ textAlign:"center", padding:"30px 0", color:"var(--text-muted)" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📋</div>
                <p style={{ fontSize:14 }}>Aún no tienes rutinas asignadas.<br/>Únete a un coach con su código.</p>
              </div>
            ) : fullRoutines.map(r => {
              const assigned = assignedRoutines.find(ar => ar._docId === r._docId);
              const todayDow = (new Date().getDay() + 6) % 7;
              const isToday = r.dayOfWeek >= 0 && r.dayOfWeek === todayDow;
              const dayLabel = r.dayOfWeek >= 0 ? DAYS_ES[r.dayOfWeek] : null;
              const todayDateStr = new Date().toISOString().slice(0,10);
              const routineName = r.name || r.routineName || "";
              // doneToday: solo por _docId exacto (evita falsos positivos con rutinas del mismo nombre en distintos días)
              const doneToday = (sessions||[]).some(s => s.date === todayDateStr && s.coachRoutineDocId === r._docId);
              const isCompleted = assigned?.completed || doneToday;

              // Estilos según estado
              let cardBorder, cardBg, cardOpacity;
              if (isCompleted) {
                cardBorder = "1px solid rgba(34,197,94,0.4)";
                cardBg = "rgba(34,197,94,0.05)";
                cardOpacity = 0.7;
              } else if (isToday) {
                cardBorder = "2px solid var(--accent)";
                cardBg = "rgba(207,255,77,0.04)";
                cardOpacity = 1;
              } else {
                cardBorder = "1px solid var(--border)";
                cardBg = "var(--input-bg)";
                cardOpacity = 0.55;
              }

              return (
                <div key={r._docId} style={{ padding:"14px 16px", background:cardBg, border:cardBorder, borderRadius:12, marginBottom:10, opacity:cardOpacity, transition:"opacity 0.2s" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ fontWeight:700, fontSize:15 }}>{r.name}</div>
                        {isToday && !isCompleted && (
                          <span style={{ fontSize:9, fontWeight:900, letterSpacing:1.5, textTransform:"uppercase",
                            background:"var(--accent)", color:"#0E0F13", borderRadius:4, padding:"2px 6px" }}>HOY</span>
                        )}
                      </div>
                      {dayLabel && (
                        <div style={{ fontSize:11, color: isToday ? "var(--accent)" : "var(--text-muted)", marginTop:3 }}>
                          📅 {dayLabel}
                        </div>
                      )}
                    </div>
                    {isCompleted ? (
                      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                        <span style={{ fontSize:11, color:"#22c55e", fontWeight:700 }}>✅ Completada</span>
                        <button className="btn-ghost small" onClick={() => setActiveWorkout(r)}>↺ Repetir</button>
                      </div>
                    ) : (
                      <button className="btn-primary" style={{ fontSize:14, padding:"8px 16px",
                        boxShadow: isToday ? "0 0 16px rgba(207,255,77,0.3)" : "none" }}
                        onClick={() => {
                          if (!isToday && r.dayOfWeek >= 0) {
                            const hoy = DAYS_ES[todayDow];
                            askConfirm(`Esta rutina es para el ${dayLabel}. Hoy es ${hoy}. ¿Iniciar igual?`, () => setActiveWorkout(r));
                            return;
                          }
                          setActiveWorkout(r);
                        }}>▶ Iniciar</button>
                    )}
                  </div>
                  {r.notes && <div style={{ fontSize:12, color:"var(--text-muted)", fontStyle:"italic", marginBottom:8 }}>{r.notes}</div>}
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {(r.exercises||[]).map(ex => (
                      <span key={ex.id} title={ex.comment || undefined} style={{ fontSize:11, padding:"2px 8px", background:"rgba(59,130,246,0.1)", border: ex.comment ? "1px solid rgba(207,255,77,0.35)" : "1px solid rgba(59,130,246,0.2)", borderRadius:10, color: ex.comment ? "var(--accent)" : "var(--text-muted)", cursor: ex.comment ? "help" : "default" }}>
                        {ex.comment ? "💬 " : ""}{ex.name}
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
              <div key={c.coachUid} onClick={() => { setSelectedCoach(c); loadCoachProfile(c.coachUid); }}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, marginBottom:8, cursor:"pointer", transition:"border-color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor="var(--accent)"}
                onMouseLeave={e => e.currentTarget.style.borderColor="var(--border)"}>
                {c.photoURL ? (
                  <img src={c.photoURL} alt="coach" style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover", border:"1px solid var(--accent)", flexShrink:0 }} />
                ) : (
                  <div style={{ width:40, height:40, borderRadius:"50%", background:"var(--accent)", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, color:"#0E0F13", flexShrink:0 }}>
                    {c.coachName?.[0]?.toUpperCase()||"?"}
                  </div>
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.coachName}</div>
                  <div style={{ fontSize:11, color:"var(--text-muted)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.coachEmail}</div>
                </div>
                <div style={{ fontSize:12, color:"var(--text-muted)", flexShrink:0, whiteSpace:"nowrap" }}>Ver perfil →</div>
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
      {confirmModal}
    </div>
  );
}

export default AthleteCoachPanel;