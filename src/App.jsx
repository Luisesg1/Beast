import "./styles.css";
import { useState, useEffect, useRef, useMemo, createContext, useContext } from "react";
import LoginScreen from "./components/LoginScreen";
import ResetPasswordScreen from "./components/ResetPasswordScreen";
import { AuthCtx } from "./components/AuthContext";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail, updateProfile, sendEmailVerification, GoogleAuthProvider, signInWithPopup, signInWithCredential } from "firebase/auth";
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Capacitor } from '@capacitor/core';
import { removeBanner } from "./useAdMob";
import { configureRevenueCat, checkProStatusStandalone, registerAppResumeListener } from "./useBilling";
import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { auth, db, googleProvider } from "./firebase";
import { store, load, firebaseErrMsg } from "./utils/helpers";
import { track, setAnalyticsUser } from "./utils/analytics";
import GymApp from "./GymApp";

const ThemeCtx = createContext();
export const useTheme = () => useContext(ThemeCtx);

function BruxAvatar({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M22 52 L18 95 L82 95 L78 52 Z" fill="#1a1a1a" stroke="#2a2a2a" strokeWidth="1.5"/>
      <ellipse cx="18" cy="58" rx="12" ry="10" fill="#1d1d1d" stroke="#222" strokeWidth="1"/>
      <ellipse cx="82" cy="58" rx="12" ry="10" fill="#1d1d1d" stroke="#222" strokeWidth="1"/>
      <rect x="6" y="56" width="15" height="28" rx="6" fill="#161616" stroke="#1e1e1e" strokeWidth="1"/>
      <rect x="79" y="56" width="15" height="28" rx="6" fill="#161616" stroke="#1e1e1e" strokeWidth="1"/>
      <ellipse cx="13" cy="66" rx="7" ry="9" fill="#202020" stroke="#2a2a2a" strokeWidth="0.8"/>
      <ellipse cx="87" cy="66" rx="7" ry="9" fill="#202020" stroke="#2a2a2a" strokeWidth="0.8"/>
      <rect x="7" y="81" width="13" height="9" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="1"/>
      <rect x="80" y="81" width="13" height="9" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="1"/>
      <path d="M24 55 Q24 74 46 76 L50 76 L50 55 Z" fill="#202020" stroke="#282828" strokeWidth="0.5"/>
      <path d="M76 55 Q76 74 54 76 L50 76 L50 55 Z" fill="#1e1e1e" stroke="#282828" strokeWidth="0.5"/>
      <rect x="31" y="77" width="14" height="8" rx="2" fill="#161616" stroke="#1e1e1e" strokeWidth="0.5"/>
      <rect x="55" y="77" width="14" height="8" rx="2" fill="#161616" stroke="#1e1e1e" strokeWidth="0.5"/>
      <rect x="43" y="42" width="14" height="12" rx="2" fill="#161616"/>
      <rect x="28" y="12" width="44" height="32" rx="8" fill="#1a1a1a" stroke="#222" strokeWidth="1.5"/>
      <rect x="33" y="17" width="34" height="22" rx="4" fill="#16a34a"/>
      <rect x="36" y="20" width="11" height="8" rx="2" fill="#DFFF00"/>
      <rect x="53" y="20" width="11" height="8" rx="2" fill="#DFFF00"/>
      <rect x="39" y="22" width="5" height="4" rx="1" fill="#09090B"/>
      <rect x="56" y="22" width="5" height="4" rx="1" fill="#09090B"/>
      <rect x="37" y="31" width="26" height="6" rx="2" fill="#0a1a0f"/>
      <line x1="39" y1="33" x2="63" y2="33" stroke="#22c55e" strokeWidth="0.8" opacity="0.8"/>
      <line x1="39" y1="36" x2="63" y2="36" stroke="#22c55e" strokeWidth="0.8" opacity="0.5"/>
      <circle cx="36" cy="60" r="2.5" fill="#22c55e"/>
      <circle cx="64" cy="60" r="2.5" fill="#22c55e"/>
      <rect x="31" y="87" width="17" height="8" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="0.8"/>
      <rect x="52" y="87" width="17" height="8" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="0.8"/>
      <rect x="29" y="93" width="21" height="4" rx="2" fill="#DFFF00" opacity="0.7"/>
      <rect x="50" y="93" width="21" height="4" rx="2" fill="#DFFF00" opacity="0.7"/>
    </svg>
  );
}

function SplashScreen() {
    // Partículas amarillas que flotan hacia arriba (energía). Generadas una sola vez.
    const _particles = useMemo(() => Array.from({ length: 10 }, (_, i) => ({
      id: i,
      left: `${(i * 6.1 + (i % 3) * 4) % 100}%`,
      size: 2 + (i % 3),
      delay: (i % 8) * 0.35,
      duration: 3.2 + (i % 5) * 0.6,
      drift: (i % 2 === 0 ? 1 : -1) * (10 + (i % 4) * 8),
    })), []);

    // Progreso de carga animado + mensajes dinámicos (estilo Whoop/Linear).
    const [progress, setProgress] = useState(0);
    const LOAD_MSGS = [
      "Activando experiencia Beast...",
      "Sincronizando progreso...",
      "Cargando estadísticas...",
      "Preparando tu entrenamiento...",
    ];
    useEffect(() => {
      let p = 0;
      const id = setInterval(() => {
        p = Math.min(100, p + Math.random() * 7 + 5);
        setProgress(Math.round(p));
        if (p >= 100) clearInterval(id);
      }, 120);
      return () => clearInterval(id);
    }, []);
    const loadMsg = LOAD_MSGS[Math.min(LOAD_MSGS.length - 1, Math.floor(progress / (100 / LOAD_MSGS.length)))];

    // Datos reales del usuario (cacheados por GymApp); null en primer arranque.
    const stats = useMemo(() => {
      try { return JSON.parse(localStorage.getItem("gym_splash_stats") || "null"); } catch { return null; }
    }, []);
    const hasStats = stats && (stats.sessions > 0 || stats.streak > 0);

    return (
      <div className="bs-root">
        <style>{`
          .bs-root {
            min-height: 100vh; min-height: 100dvh;
            display: flex; align-items: center; justify-content: center; flex-direction: column;
            background: radial-gradient(ellipse 80% 60% at 50% 36%, #0B0E14 0%, #05070A 60%); position: relative; overflow: hidden;
            -webkit-font-smoothing: antialiased;
          }
          /* Halo de energía que nace del centro */
          .bs-glow {
            position: absolute; left: 50%; top: 33%;
            width: 90vw; height: 90vw; max-width: 420px; max-height: 420px;
            transform: translate(-50%, -50%) scale(0.6); transform-origin: center;
            background: radial-gradient(circle, rgba(239,255,0,0.10) 0%, rgba(166,255,0,0.04) 30%, rgba(239,255,0,0) 62%);
            opacity: 0; pointer-events: none;
            animation: bsGlowIn 0.9s ease 0.3s forwards, bsGlowPulse 3.2s ease-in-out 1.3s infinite;
          }
          /* Vignette para enfocar al centro y dar profundidad premium */
          .bs-vignette {
            position: absolute; inset: 0; pointer-events: none;
            background: radial-gradient(ellipse at center, rgba(0,0,0,0) 38%, rgba(0,0,0,0.55) 100%);
          }
          .bs-particles { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
          .bs-particle {
            position: absolute; bottom: -10px; border-radius: 50%;
            background: #DFFF00; opacity: 0;
            box-shadow: 0 0 6px rgba(223,255,0,0.8);
            animation: bsFloat linear infinite;
          }
          .bs-stack { position: relative; z-index: 10; display: flex; flex-direction: column; align-items: center; width: 100%; padding: 0 24px; }
          /* Relámpago */
          .bs-bolt {
            width: clamp(40px, 13vw, 64px); height: auto; margin-bottom: 6px;
            filter: drop-shadow(0 0 10px rgba(223,255,0,0.7));
            opacity: 0; transform-origin: center;
            animation: bsBoltStrike 0.55s cubic-bezier(0.2,0.8,0.2,1) 0.7s forwards, bsBoltPulse 2.4s ease-in-out 1.4s infinite;
          }
          /* Destello que acompaña la entrada del relámpago */
          .bs-flash {
            position: absolute; left: 50%; top: 50%; width: 260px; height: 260px;
            transform: translate(-50%, -50%) scale(0.4); z-index: 1;
            background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(223,255,0,0.4) 30%, rgba(223,255,0,0) 65%);
            border-radius: 50%; opacity: 0; pointer-events: none;
            animation: bsFlash 0.55s ease-out 0.55s forwards;
          }
          /* Personaje oficial — protagonista */
          .bs-char-wrap { position: relative; display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
          .bs-char {
            width: clamp(124px, 40vw, 196px); height: auto; position: relative; z-index: 2; border-radius: 30px;
            filter: drop-shadow(0 0 12px rgba(239,255,0,0.40)) drop-shadow(0 8px 16px rgba(0,0,0,0.6));
            opacity: 0; transform: scale(0.6);
            animation: bsCharIn 0.7s cubic-bezier(0.2,0.8,0.2,1) 0.35s forwards, bsCharPulse 2.8s ease-in-out 1.2s infinite;
            -webkit-user-select: none; user-select: none;
          }
          .bs-char-halo {
            position: absolute; left: 50%; top: 50%; width: 220px; height: 220px;
            transform: translate(-50%,-50%) scale(0.5); z-index: 0; pointer-events: none; opacity: 0;
            background: radial-gradient(circle, rgba(239,255,0,0.16) 0%, rgba(166,255,0,0.06) 38%, rgba(239,255,0,0) 66%);
            animation: bsGlowIn 0.9s ease 0.4s forwards, bsGlowPulse 2.8s ease-in-out 1.3s infinite;
          }
          /* Líneas de energía radiales detrás del personaje */
          .bs-speed {
            position: absolute; left: 50%; top: 50%; width: 250px; height: 250px;
            transform: translate(-50%,-50%); z-index: 0; pointer-events: none; opacity: 0;
            background: repeating-conic-gradient(from 0deg, rgba(239,255,0,0.06) 0deg 1.1deg, rgba(239,255,0,0) 1.1deg 22deg);
            -webkit-mask-image: radial-gradient(circle, rgba(0,0,0,0) 42%, #000 54%, rgba(0,0,0,0) 72%);
            mask-image: radial-gradient(circle, rgba(0,0,0,0) 42%, #000 54%, rgba(0,0,0,0) 72%);
            animation: bsSpeedIn 0.8s ease 0.6s forwards, bsSpin 26s linear 1s infinite;
          }
          /* Wordmark BEAST con textura industrial sutil */
          .bs-title {
            font-family: 'Barlow Condensed', sans-serif; font-weight: 900;
            font-size: clamp(64px, 24vw, 132px); line-height: 0.9;
            letter-spacing: clamp(4px, 2.2vw, 10px); text-transform: uppercase;
            color: #FFFFFF; text-align: center; white-space: nowrap; margin: 0;
            position: relative;
            text-shadow: 0 0 1px rgba(255,255,255,0.3), 0 0 16px rgba(239,255,0,0.14);
            -webkit-text-stroke: 0.4px rgba(255,255,255,0.15);
          }
          /* Capa de textura industrial (rayado fino) recortada al texto */
          .bs-title::after {
            content: "BEAST"; position: absolute; left: 0; top: 0; right: 0;
            letter-spacing: inherit;
            background: repeating-linear-gradient(0deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 3px, rgba(0,0,0,0.28) 4px, rgba(0,0,0,0) 5px);
            -webkit-background-clip: text; background-clip: text;
            -webkit-text-fill-color: transparent; color: transparent;
            mix-blend-mode: multiply; pointer-events: none;
          }
          .bs-title-wrap {
            opacity: 0; transform: translateY(14px);
            animation: bsTitleReveal 0.7s cubic-bezier(0.2,0.7,0.2,1) 1.05s forwards;
          }
          .bs-rule { width: 0; height: 2px; background: #DFFF00; margin: 14px 0 0; border-radius: 1px;
            box-shadow: 0 0 10px rgba(223,255,0,0.6);
            animation: bsRule 0.5s ease 1.35s forwards; }
          .bs-sub {
            margin-top: 12px; font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
            font-size: clamp(12px, 3.6vw, 16px); letter-spacing: clamp(4px, 1.6vw, 7px);
            text-transform: uppercase; color: #DFFF00; text-align: center;
            opacity: 0; animation: bsSubGlow 0.9s ease 1.5s forwards;
          }
          /* Barra de progreso */
          .bs-loader { position: relative; width: min(74vw, 300px); margin-top: 30px; text-align: center;
            opacity: 0; animation: bsFadeIn 0.5s ease 1.7s forwards; }
          .bs-loader-label { font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
            font-size: 11px; letter-spacing: 4px; text-transform: uppercase; color: #A1A1AA; margin-top: 13px; }
          .bs-track { position: relative; height: 8px; border-radius: 8px; background: #111827; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05); }
          .bs-fill { position: absolute; left: 0; top: 0; bottom: 0; width: 0%; border-radius: 8px;
            background: linear-gradient(90deg, #A6FF00, #EFFF00);
            box-shadow: 0 0 10px rgba(239,255,0,0.45);
            transition: width 0.18s ease-out; }
          .bs-loader-top { display: flex; justify-content: center; margin-bottom: 10px; }
          .bs-pct { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 30px;
            line-height: 1; color: #EFFF00; letter-spacing: 0.5px; }
          .bs-card { width: min(80vw, 320px); margin-top: 26px;
            background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
            border-radius: 14px; padding: 13px 16px; display: flex; flex-direction: column; gap: 9px;
            opacity: 0; animation: bsFadeIn 0.6s ease 1.9s forwards; }
          .bs-card-row { display: flex; align-items: center; gap: 10px; font-family: 'Inter', sans-serif;
            font-size: 13px; color: #A1A1AA; }
          .bs-card-row + .bs-card-row { border-top: 1px solid rgba(255,255,255,0.06); padding-top: 9px; }
          .bs-card-row b { color: #FFFFFF; font-weight: 700; }
          .bs-card-ico { font-size: 15px; }
          .bs-card-center { justify-content: center; }
          .bs-brand { margin-top: 22px; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700;
            letter-spacing: 4px; text-transform: uppercase; color: #5b6472;
            opacity: 0; animation: bsFadeIn 0.7s ease 2.2s forwards; }
          .bs-fill::after { content: ""; position: absolute; inset: 0; width: 40%;
            background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 50%, rgba(255,255,255,0) 100%);
            animation: bsSheen 1.1s ease-in-out 1.85s infinite; }

          @keyframes bsGlowIn { to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
          @keyframes bsGlowPulse { 0%,100% { opacity: 1; } 50% { opacity: 0.62; } }
          @keyframes bsFloat {
            0% { transform: translateY(0) translateX(0); opacity: 0; }
            12% { opacity: 0.9; }
            85% { opacity: 0.5; }
            100% { transform: translateY(-78vh) translateX(var(--bs-drift, 0px)); opacity: 0; }
          }
          @keyframes bsBoltStrike {
            0% { opacity: 0; transform: scale(0.4) rotate(-4deg); }
            55% { opacity: 1; transform: scale(1.12) rotate(2deg); }
            100% { opacity: 1; transform: scale(1) rotate(0deg); }
          }
          @keyframes bsBoltPulse {
            0%,100% { filter: drop-shadow(0 0 10px rgba(223,255,0,0.7)); transform: scale(1); }
            50% { filter: drop-shadow(0 0 18px rgba(223,255,0,1)); transform: scale(1.04); }
          }
          @keyframes bsFlash {
            0% { opacity: 0; transform: translate(-50%, -40%) scale(0.4); }
            35% { opacity: 1; }
            100% { opacity: 0; transform: translate(-50%, -40%) scale(1.4); }
          }
          @keyframes bsTitleReveal { to { opacity: 1; transform: translateY(0); } }
          @keyframes bsRule { to { width: clamp(40px, 12vw, 64px); } }
          @keyframes bsSubGlow {
            0% { opacity: 0; text-shadow: 0 0 0 rgba(223,255,0,0); }
            60% { opacity: 1; text-shadow: 0 0 22px rgba(223,255,0,0.85); }
            100% { opacity: 1; text-shadow: 0 0 12px rgba(223,255,0,0.45); }
          }
          @keyframes bsFadeIn { to { opacity: 1; } }
          @keyframes bsBarFill { to { width: 100%; } }
          @keyframes bsSheen { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
          @keyframes bsCharIn { to { opacity: 1; transform: scale(1); } }
          @keyframes bsCharPulse {
            0%,100% { filter: drop-shadow(0 0 12px rgba(239,255,0,0.40)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
            50%     { filter: drop-shadow(0 0 20px rgba(239,255,0,0.62)) drop-shadow(0 8px 16px rgba(0,0,0,0.6)); }
          }
          @keyframes bsSpeedIn { to { opacity: 1; } }
          @keyframes bsSpin { to { transform: translate(-50%,-50%) rotate(360deg); } }

          @media (prefers-reduced-motion: reduce) {
            .bs-glow, .bs-particles, .bs-flash, .bs-speed { animation: none; }
            .bs-glow, .bs-char-halo { opacity: 1; transform: translate(-50%,-50%) scale(1); animation: none; }
            .bs-particle { display: none; }
            .bs-char, .bs-title-wrap, .bs-sub, .bs-loader { opacity: 1; transform: none; animation: none; }
            .bs-fill { width: 100%; animation: none; }
            .bs-fill::after { animation: none; }
          }
        `}</style>

        <div className="bs-glow" />
        <div className="bs-particles">
          {_particles.map(p => (
            <span key={p.id} className="bs-particle" style={{
              left: p.left, width: p.size, height: p.size,
              animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`,
              "--bs-drift": `${p.drift}px`,
            }} />
          ))}
        </div>

        <div className="bs-stack">
          {/* Personaje oficial — protagonista, con líneas de energía y halo */}
          <div className="bs-char-wrap">
            <div className="bs-speed" />
            <div className="bs-char-halo" />
            <div className="bs-flash" />
            <img className="bs-char" src="/icons/icon-512.webp" alt="BEAST" draggable="false" />
          </div>

          <div className="bs-title-wrap">
            <h1 className="bs-title">BEAST</h1>
          </div>

          <div className="bs-loader">
            <div className="bs-loader-top"><span className="bs-pct">{progress}%</span></div>
            <div className="bs-track"><div className="bs-fill" style={{ width: progress + "%" }} /></div>
            <div className="bs-loader-label">{loadMsg}</div>
          </div>

          <div className="bs-card">
            {hasStats ? (
              <>
                {stats.streak > 0 && <div className="bs-card-row"><span className="bs-card-ico">🔥</span><span>Racha actual: <b>{stats.streak} {stats.streak === 1 ? "semana" : "semanas"}</b></span></div>}
                {stats.sessions > 0 && <div className="bs-card-row"><span className="bs-card-ico">💪</span><span><b>{stats.sessions}</b> entrenamientos completados</span></div>}
                {stats.plan && stats.plan !== "free" && <div className="bs-card-row"><span className="bs-card-ico">🏆</span><span>Nivel: <b>Beast {stats.plan === "coach" ? "Coach" : "Pro"}</b></span></div>}
              </>
            ) : (
              <div className="bs-card-row bs-card-center"><span className="bs-card-ico">⚡</span><span>Sigue así, bestia</span></div>
            )}
          </div>

          <div className="bs-brand">Disciplina · Enfoque · Constancia</div>
        </div>

        <div className="bs-vignette" />
      </div>
    );
}

export default function App() {
  const [dark, setDark] = useState(() => load("gym_dark", true));
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const unsubUserRef = useRef(null);
  const googleLoginInProgressRef = useRef(false);
  const [loginInitTab, setLoginInitTab] = useState("login");
  const [splashDone, setSplashDone] = useState(false);
  const [showPaywallAfterExpiry, setShowPaywallAfterExpiry] = useState(false);
  // Detectar si venimos del link de reset de contraseña
  const resetParams = (() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("mode") === "resetPassword" && p.get("oobCode")) {
      return { oobCode: p.get("oobCode") };
    }
    return null;
  })();

  useEffect(() => { const t = setTimeout(() => setSplashDone(true), 2600); return () => clearTimeout(t); }, []);

  useEffect(() => {
    const saved = localStorage.getItem("gym_dark");
    if (saved === null) setDark(window.matchMedia("(prefers-color-scheme: dark)").matches);
  }, []);
  useEffect(() => { document.body.setAttribute("data-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { store("gym_dark", dark); }, [dark]);



  // Firebase auth listener
  
  useEffect(() => {
    let removeResumeListener = () => {};
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubUserRef.current) { unsubUserRef.current(); unsubUserRef.current = null; }
      if (firebaseUser) {
        const profile = await createOrLoadProfile(firebaseUser);
        setCurrentUser(profile);
        setAnalyticsUser(firebaseUser.uid, profile?.plan);
        const rcUpdateUser = (patch) => {
          setCurrentUser(prev => {
            if (!prev) return prev;
            const wasPaid = ["pro","coach","gym"].includes(prev.plan);
            const nowFree = patch.plan === "free";
            if (wasPaid && nowFree) {
              setTimeout(() => setShowPaywallAfterExpiry(true), 500);
            }
            return { ...prev, ...patch };
          });
        };
        await configureRevenueCat(firebaseUser.uid, rcUpdateUser);
        await checkProStatusStandalone(firebaseUser.uid, rcUpdateUser);

        const userRef = doc(db, "users", firebaseUser.uid);
        unsubUserRef.current = onSnapshot(userRef, (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();
          setCurrentUser(prev => {
            if (!prev) return prev;
            const wasPaid = ["pro","coach","gym"].includes(prev.plan);
            const nowFree = data.plan === "free";
            if (wasPaid && nowFree) {
              setTimeout(() => setShowPaywallAfterExpiry(true), 500);
            }
            return { ...prev, plan: data.plan ?? prev.plan, isCoach: data.isCoach ?? prev.isCoach };
          });
          console.log("[App] onSnapshot — plan:", data.plan, "isCoach:", data.isCoach, "isPro:", ["pro","coach","gym"].includes(data.plan));
        }, (e) => {
          console.warn("[App] onSnapshot error:", e);
        });

        removeResumeListener = registerAppResumeListener(firebaseUser.uid, rcUpdateUser);
      } else {
        removeResumeListener();
        removeBanner();
        setCurrentUser(null);
      }
      setAuthLoading(false);
    });
    return () => { unsub(); removeResumeListener(); if (unsubUserRef.current) { unsubUserRef.current(); unsubUserRef.current = null; } };
  }, []);
  const toggleDark = () => setDark(d => !d);

  async function createOrLoadProfile(firebaseUser) {
    let profile = null;
    try {
      const snap = await getDoc(doc(db, "users", firebaseUser.uid));
      profile = snap.exists() ? snap.data() : null;
    } catch {}
    if (!profile) {
      profile = { uid: firebaseUser.uid, name: firebaseUser.displayName || firebaseUser.email.split("@")[0], email: firebaseUser.email, plan: "free" };
      try { await setDoc(doc(db, "users", firebaseUser.uid), profile, { merge: true }); } catch {}
    }
    return {
      uid: firebaseUser.uid,
      name: profile.name || firebaseUser.displayName || firebaseUser.email.split("@")[0],
      email: firebaseUser.email,
      plan: profile.plan || "free",
      isCoach: profile.isCoach || false,
      isAdmin: profile.isAdmin || false,
      photoURL: firebaseUser.photoURL || profile.photoURL || null,
      emailVerified: firebaseUser.emailVerified,
      createdAt: firebaseUser.metadata?.creationTime ? new Date(firebaseUser.metadata.creationTime).toISOString().slice(0, 10) : null,
    };
  }

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
      track("signup", { method: "email" });
      return { ok: true };
    } catch (e) { return { ok: false, msg: firebaseErrMsg(e.code) }; }
  }

  async function resetPassword(email) {
    try { await sendPasswordResetEmail(auth, email); return { ok: true }; }
    catch (e) { return { ok: false, msg: firebaseErrMsg(e.code) }; }
  }

  async function loginWithGoogle() {
    if (googleLoginInProgressRef.current) return { ok: false, msg: "" };
    googleLoginInProgressRef.current = true;
    try {
      let firebaseUser;
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        const accessToken = result.credential?.accessToken;
        if (!idToken) return { ok: false, msg: "No se pudo obtener el token de Google" };
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        const cred = await signInWithCredential(auth, credential);
        firebaseUser = cred.user;
      } else {
        googleProvider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(auth, googleProvider);
        firebaseUser = cred.user;
      }
      return { ok: true };
    } catch(e) {
      console.error("Google login error:", e);
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") {
        return { ok: false, msg: "" };
      }
      return { ok: false, msg: firebaseErrMsg(e.code) };
    } finally {
      googleLoginInProgressRef.current = false;
    }
  }


  function loginAsGuest() {
    setCurrentUser({ uid: "guest", name: "Invitado", email: "__guest__", plan: "guest", isGuest: true });
    setAuthLoading(false);
  }

  async function logout(goToRegister = false) {
    if (goToRegister) localStorage.setItem("gym_login_init_tab", "register");
    removeBanner();
    if (currentUser?.isGuest) {
      localStorage.removeItem("gym_v3_guest");
      setCurrentUser(null);
      setLoginInitTab(goToRegister ? "register" : "login");
      return;
    }
    await signOut(auth);
    setCurrentUser(null);
    setLoginInitTab("login");
  }

  // Si venimos del link de reset, mostrar pantalla de reset antes que todo
  if (resetParams) {
    return <ResetPasswordScreen oobCode={resetParams.oobCode} />;
  }

  return (
    <ThemeCtx.Provider value={{ dark, toggleDark }}>
      <AuthCtx.Provider value={{ user: currentUser, loginWithFirebase, registerWithFirebase, logout, loginAsGuest, resetPassword, loginWithGoogle, updateUser: (patch) => setCurrentUser(prev => ({ ...prev, ...patch })) }}>
        {(authLoading || !splashDone)
          ? <SplashScreen />
          : !currentUser
            ? <LoginScreen initialTab={loginInitTab} />
            : <>{typeof document !== "undefined" && (document.body.classList.add("app-loaded"))}<GymApp showPaywallAfterExpiry={showPaywallAfterExpiry} setShowPaywallAfterExpiry={setShowPaywallAfterExpiry} /></>
        }
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}