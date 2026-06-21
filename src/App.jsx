import "./styles.css";
import { useState, useEffect, useRef, createContext, useContext } from "react";
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
      <rect x="36" y="20" width="11" height="8" rx="2" fill="#e8ff00"/>
      <rect x="53" y="20" width="11" height="8" rx="2" fill="#e8ff00"/>
      <rect x="39" y="22" width="5" height="4" rx="1" fill="#0a0a0a"/>
      <rect x="56" y="22" width="5" height="4" rx="1" fill="#0a0a0a"/>
      <rect x="37" y="31" width="26" height="6" rx="2" fill="#0a1a0f"/>
      <line x1="39" y1="33" x2="63" y2="33" stroke="#22c55e" strokeWidth="0.8" opacity="0.8"/>
      <line x1="39" y1="36" x2="63" y2="36" stroke="#22c55e" strokeWidth="0.8" opacity="0.5"/>
      <circle cx="36" cy="60" r="2.5" fill="#22c55e"/>
      <circle cx="64" cy="60" r="2.5" fill="#22c55e"/>
      <rect x="31" y="87" width="17" height="8" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="0.8"/>
      <rect x="52" y="87" width="17" height="8" rx="3" fill="#141414" stroke="#1e1e1e" strokeWidth="0.8"/>
      <rect x="29" y="93" width="21" height="4" rx="2" fill="#e8ff00" opacity="0.7"/>
      <rect x="50" y="93" width="21" height="4" rx="2" fill="#e8ff00" opacity="0.7"/>
    </svg>
  );
}

function SplashScreen({ splashPhrase }) {
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

        <div className="splash-logo" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:0, width:"100%", padding:"0 16px" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:40, lineHeight:1, marginBottom:4 }}>⚡</div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:"clamp(28px, 9vw, 48px)", fontWeight:900, color:"#f0f0f0", letterSpacing:"clamp(4px, 2vw, 8px)", textTransform:"uppercase", textAlign:"center", whiteSpace:"nowrap" }}>BEAST</div>
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

        <div style={{ position:"absolute", bottom:40, color:"rgba(255,255,255,0.18)", fontSize:10, fontWeight:800, letterSpacing:5, textTransform:"uppercase", zIndex:10, animation:"splashFadeUp 0.4s ease 0.8s both" }}>CARGANDO</div>
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
  "EL DOLOR ES TEMPORAL, EL ORGULLO ES ETERNO",
  "NO DAYS OFF",
  "SWEAT NOW, SHINE LATER",
  "CADA REP CUENTA",
  "TU ÚNICO COMPETIDOR ERES TÚ",
  "FALL DOWN SEVEN, STAND UP EIGHT",
  "MODO BESTIA ACTIVADO",
  "SIN SACRIFICIO NO HAY GLORIA",
  "EL CUERPO LOGRA LO QUE LA MENTE CREE",
  "ENTRENA COMO SI TU VIDA DEPENDIERA DE ELLO",
  "LOS QUE SE RINDEN NUNCA GANAN",
  "SUDOR ES GRASA LLORANDO",
  "BEAST MODE ON 🔥",
  "MÁS PESO, MÁS CARÁCTER",
  "HOY SE ENTRENA, MAÑANA SE DESCANSA",
  "LA MENTE MANDA, EL CUERPO OBEDECE",
  "NUNCA SUBESTIMES UN CALENTAMIENTO",
  "EL GYM ES MI TERAPIA",
  "PRIMERO EL GYM, LUEGO TODO LO DEMÁS",
  "NO EXCUSES, ONLY RESULTS",
  "IRON NEVER LIES",
  "CERO EXCUSAS, PURO HIERRO",
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
          ? <SplashScreen splashPhrase={splashPhrase} />
          : !currentUser
            ? <LoginScreen initialTab={loginInitTab} />
            : <>{typeof document !== "undefined" && (document.body.classList.add("app-loaded"))}<GymApp showPaywallAfterExpiry={showPaywallAfterExpiry} setShowPaywallAfterExpiry={setShowPaywallAfterExpiry} /></>
        }
      </AuthCtx.Provider>
    </ThemeCtx.Provider>
  );
}