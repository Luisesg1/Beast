import { useState, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";

const lettersOnly = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");

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

function LoginScreen({ initialTab }) {
  const { loginWithFirebase, registerWithFirebase, loginAsGuest, resetPassword, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState(() => {
    const stored = localStorage.getItem("gym_login_init_tab");
    if (stored) { localStorage.removeItem("gym_login_init_tab"); return stored; }
    return initialTab || "login";
  });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showPassConfirm, setShowPassConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastSubmitAt, setLastSubmitAt] = useState(0);
  const SUBMIT_COOLDOWN_MS = 1500;
  const [focusedField, setFocusedField] = useState(null);
  const [animKey, setAnimKey] = useState(0);

  function switchMode(m) {
    setMode(m); setErr(""); setMsg("");
    setName(""); setEmail(""); setPass(""); setPassConfirm("");
    setAnimKey(k => k + 1);
  }

  async function submit() {
    const now = Date.now();
    if (loading || now - lastSubmitAt < SUBMIT_COOLDOWN_MS) return;
    setLastSubmitAt(now);
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
                <div style={{ position: "relative" }}>
                  <input
                    style={{
                      ...inputStyle("passConfirm"),
                      borderBottomColor: pass && passConfirm && pass !== passConfirm
                        ? "#ef4444"
                        : focusedField === "passConfirm" ? "#e8ff00" : "rgba(255,255,255,0.2)",
                      paddingRight: 32,
                    }}
                    type={showPassConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={passConfirm}
                    onChange={e => setPassConfirm(e.target.value)}
                    onFocus={() => setFocusedField("passConfirm")}
                    onBlur={() => setFocusedField(null)}
                  />
                  <button type="button" onClick={() => setShowPassConfirm(v => !v)}
                    style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: "0 4px", color: "rgba(255,255,255,0.5)" }}>
                    {showPassConfirm ? "🙈" : "👁️"}
                  </button>
                </div>
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
        @keyframes fadeOutBanner {
          0%   { opacity: 1; max-height: 60px; }
          70%  { opacity: 1; max-height: 60px; }
          100% { opacity: 0; max-height: 0; padding: 0; margin: 0; }
        }
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


export default LoginScreen;