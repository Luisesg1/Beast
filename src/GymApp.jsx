import { useState, useEffect, useRef, useContext, useMemo, lazy, Suspense } from "react";
import { useTheme } from "./App";
import CoachModal, { getAthleteRoutines } from "./components/CoachModal";
import AthleteCoachPanel from "./components/AthleteCoachPanel";
import { AuthCtx, useAuth } from "./components/AuthContext";
import InsightsModal, { generateInsights, getProgressionSuggestion } from "./components/InsightsModal";
import StatsProModal from "./components/StatsProModal";
import PhotoProgressModal from "./components/PhotoProgressModal";
import PaywallModal from "./components/PaywallModal";
import PRShareModal from "./components/PRShareModal";
import PRConfetti from "./components/PRConfetti";
import StatsBanner from "./components/StatsBanner";
import { Sparkline, TrainingCalendar, WeeklyChart } from "./components/Charts";
import AIChatModal, { DraggableAIButton } from "./components/AIChatModal";
import ExerciseGif, { CustomGifCtx, useCustomGifs } from "./components/ExerciseGif";
import TemplatesModal from "./components/TemplatesModal";
import { calc1RM, calcSessionVolume, detectNewPRs, getStreak, getPRs, getWeeklyChallenge, addShield } from "./utils/gymCalcs";
import fireConfetti from "./utils/fireConfetti";
import { GuestWall, EmailVerifyWall } from "./components/AuthWalls";
import WeeklyGoalModal from "./components/WeeklyGoalModal";
import { RestTimer, RestTimerFloating } from "./components/RestTimer";
import OneRMModal from "./components/OneRMModal";
import InfoPill from "./components/InfoPill";
import BadgesModal, { BADGE_DEFS, getNewBadgesCount } from "./components/BadgesModal";
import ShareCardModal from "./components/ShareCardModal";
import OnboardingModal from "./components/OnboardingModal";
import { DAYS_ES, ACCENT_COLORS, PRESETS, MUSCLE_GROUPS } from "./utils/constants";
import { usePushNotifications } from "./hooks/usePushNotifications";
import { StreakBanner, StreakChip, StreakRiskBanner } from "./components/StreakWidgets";
import BodyStatsModal from "./components/BodyStatsModal";
import WeeklyPlannerModal from "./components/WeeklyPlannerModal";
import TeamChallengeModal, { WEEKLY_CHALLENGES } from "./components/TeamChallengeModal";
import UserProfileModal from "./components/UserProfileModal";
import TeamsModal from "./components/TeamsModal";
import BeastMascot, { BeastAvatar, getBeastContext } from "./components/BeastMascot";
import { MuscleBalance } from "./components/ProgressWidgets";
import ProgressModal from "./components/ProgressModal";
import ExerciseLibrary from "./components/ExerciseLibrary";
import GIF_MAP from './assets/gif/gifMap.js';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { initAdMob, showBanner, removeBanner } from "./useAdMob";
import { configureRevenueCat, checkProStatusStandalone, registerAppResumeListener } from "./useBilling";
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { doc, getDoc, setDoc, collection, getDocs, getDocsFromServer, deleteDoc, query, where, updateDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { EXERCISE_DB, MUSCLES, registerCustomExercise } from "./exerciseDb";
import { uid, fmtDate, todayStr, lettersOnly, workoutInput, numDot, numWeight, numReps, numBodyW, numHeight, numAge, store, load, firebaseErrMsg } from "./utils/helpers";
import { compressImage } from "./utils/imageUtils";
import { joinCoachByCode, getMyCoaches, getFullRoutine, unassignRoutineFromAthlete, markRoutineCompleted, saveBodyStatsToDB, saveMeasuresToDB, loadMeasuresFromDB, saveCustomExercise, loadCustomExercises, updateCustomExerciseGif, updateCustomExerciseMeta, deleteCustomExercise, teamsGet, teamsSet, loadSessions, saveSessions } from "./utils/firebaseService";
import Dashboard from "./components/Dashboard";
import SessionCard from "./components/SessionCard";

const LiveTrainMode       = lazy(() => import("./components/LiveTrainMode"));
const AdminExercisesModal = lazy(() => import("./components/AdminExercisesModal"));
const StreakModal         = lazy(() => import("./components/StreakModal"));
const MuscleMapModal      = lazy(() => import("./components/MuscleMapModal"));

const fmtDateLong = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const dias = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  return `${dias[dt.getDay()]}, ${d} de ${meses[m-1]} de ${y}`;
};

const LIVE_DRAFT_KEY = "gym_live_draft";

const SS_COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];

function getSupersetGroups(exercises) {
  const groups = {};
  exercises.forEach((ex, i) => {
    if (ex.supersetGroup) {
      if (!groups[ex.supersetGroup]) groups[ex.supersetGroup] = [];
      groups[ex.supersetGroup].push(i);
    }
  });
  return Object.entries(groups).map(([groupId, indices]) => ({ groupId, indices }));
}

function getSupersetColor(groupId, exercises) {
  const groups = getSupersetGroups(exercises);
  const idx = groups.findIndex(g => g.groupId === groupId);
  return idx >= 0 ? SS_COLORS[idx % SS_COLORS.length] : SS_COLORS[0];
}

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

export default function GymApp({ showPaywallAfterExpiry, setShowPaywallAfterExpiry }) {
  const { dark, toggleDark } = useTheme();
  const { user, logout, updateUser } = useAuth();
  usePushNotifications(user);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [unit, setUnit] = useState("kg"); // Fixed to kg — lbs removed
  const [activeTab, setActiveTab] = useState("new");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [customGifsMap, setCustomGifsMap] = useState({});
  const [confirmModal, setConfirmModal] = useState({ open: false, message: "", onConfirm: null });
  function askConfirm(message, onConfirm) { setConfirmModal({ open: true, message, onConfirm }); }
  function closeConfirm() { setConfirmModal({ open: false, message: "", onConfirm: null }); }

  // Body stats
  const bodyKey = `gym_body_${user.email}`;
  const [bodyStats, setBodyStats] = useState(() => load(bodyKey, { height: null, entries: [] }));
  const [showBodyStats, setShowBodyStats] = useState(false);
  const [showPhotoProgress, setShowPhotoProgress] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    try { return !localStorage.getItem("gym_onboarding_done"); } catch { return false; }
  });
  // Plan helpers — definidos antes del useEffect de AdMob
  const isPro = ["pro","coach","gym"].includes(user.plan);

// AdMob — init y banner inicial
  useEffect(() => {
    if (!isPro) { initAdMob().then(() => showBanner()); }
    else { removeBanner(); }
  }, [isPro]);

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
    loadSessions(user.uid)
      .then(list => { setSessions(list); setSessionsLoading(false); })
      .catch(() => setSessionsLoading(false));
  }, [user.uid]);

  // Load bodyStats from Firestore on mount
  useEffect(() => {
    if (user.isGuest) return;
    getDoc(doc(db, "body_stats", user.uid)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        // Solo sobreescribir si Firebase tiene datos más completos
        setBodyStats(prev => {
          const dbEntries = data.entries || [];
          const localEntries = prev.entries || [];
          // Usar Firebase si tiene más entradas, o si local está vacío
          if (dbEntries.length >= localEntries.length) {
            return { ...data };
          }
          return prev;
        });
      }
    }).catch(() => {});
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
  const [histFiltersOpen, setHistFiltersOpen] = useState(false);
  const [renamingRutina, setRenamingRutina] = useState(null);
  const [filterPR, setFilterPR] = useState(false); // { old, newVal }
  const [calSelectedDate, setCalSelectedDate] = useState(null); // "YYYY-MM-DD" o null
  const [calMonth, setCalMonth] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [expanded, setExpanded] = useState(null);
  const [filterWorkout, setFilterWorkout] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSugg, setShowSugg] = useState(false);
  const [progressEx, setProgressEx] = useState(null);
  const [showProgressPicker, setShowProgressPicker] = useState(false);
  const [pickerMuscle, setPickerMuscle] = useState("__records__");
  const [showTimer, setShowTimer] = useState(false);
  const [showOneRM, setShowOneRM] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [seenBadges, setSeenBadges] = useState(() => load("gym_seen_badges", []));
  const [badgeToast, setBadgeToast] = useState(null); // { icon, name, desc }
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
  const [showStatsPro, setShowStatsPro] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPlanInfo, setShowPlanInfo] = useState(false);
  const [statsProExPickerCb, setStatsProExPickerCb] = useState(null);
  const [showChallenge, setShowChallenge] = useState(false);
  const [showCoach, setShowCoach] = useState(false);
const [showAthleteCoach, setShowAthleteCoach] = useState(false);
  const [showAdminExercises, setShowAdminExercises] = useState(false);
  const [athleteCoachInitialRoutine, setAthleteCoachInitialRoutine] = useState(null);
  const [coachRoutines, setCoachRoutines] = useState([]);
  const [showCompletedBanner, setShowCompletedBanner] = useState(false);

  useEffect(() => {
    if (!showCompletedBanner) return;
    const t = setTimeout(() => setShowCompletedBanner(false), 5000);
    return () => clearTimeout(t);
  }, [showCompletedBanner]);

  // Cargar ejercicios personalizados de Firestore al iniciar
  useEffect(() => {
    if (!user?.uid) return;
    const coachUid = user.isCoach ? user.uid : null;
    loadCustomExercises(coachUid, user.uid).then(customs => {
      const map = {};
      customs.forEach(ex => {
        if (!ex.name || typeof ex.name !== "string") return;
        const muscle = (ex.muscle && typeof ex.muscle === "string") ? ex.muscle : "";
        // Aplicar overrides/deletes del admin sobre el EXERCISE_DB
        if (ex.status === "deleted" && ex.originalName) {
          // Eliminar del EXERCISE_DB si fue borrado por el admin
          const idx = EXERCISE_DB.findIndex(e => e.name === ex.originalName || e.name === ex.name);
          if (idx !== -1) EXERCISE_DB.splice(idx, 1);
        } else if (ex.status === "override" && ex.originalName) {
          const idx = EXERCISE_DB.findIndex(e => e.name === ex.originalName);
          if (idx !== -1) {
            EXERCISE_DB[idx] = { ...EXERCISE_DB[idx], name: ex.name, muscle: ex.muscle || EXERCISE_DB[idx].muscle, equipment: ex.equipment || EXERCISE_DB[idx].equipment, machine: ex.machine ?? EXERCISE_DB[idx].machine };
          }
        } else if (ex.status !== "deleted") {
          registerCustomExercise(ex.name, muscle);
        }
        if (ex.gifUrl) map[ex.name] = ex.gifUrl;
        // Si el override cambia el nombre, mapear el GIF al nombre nuevo también
        if (ex.status === "override" && ex.gifUrl && ex.originalName && ex.name !== ex.originalName) {
          map[ex.originalName] = ex.gifUrl;
        }
      });
      setCustomGifsMap(map);
    });
  }, [user?.uid, user?.isCoach]);

  const [coachRoutinesLoading, setCoachRoutinesLoading] = useState(false);

  const loadCoachRoutines = async () => {
    if (user.isGuest || coachRoutinesLoading) return;
    coachRoutinesCancelRef.current = false;
    setCoachRoutinesLoading(true);
    try {
      const assigned = await getAthleteRoutines(user.uid);
      if (coachRoutinesCancelRef.current) return;
      const full = await Promise.all(
        assigned
          .filter(r => r.coachUid && r.routineId)
          .map(async r => {
            try {
              const routine = await getFullRoutine(r.coachUid, r.routineId);
              if (!routine) return null;
              return { ...routine, dayOfWeek: r.dayOfWeek ?? -1, coachUid: r.coachUid, routineId: r.routineId, _docId: r._docId };
            } catch(e) {
              console.error("[loadCoachRoutines] error on routine", r.routineId, e);
              return null;
            }
          })
      );
      if (coachRoutinesCancelRef.current) return;
      setCoachRoutines(full.filter(Boolean));
    } catch(e) {
      if (!coachRoutinesCancelRef.current) console.error("[coachRoutines] load error:", e);
    } finally {
      if (!coachRoutinesCancelRef.current) setCoachRoutinesLoading(false);
    }
  };

  useEffect(() => {
    coachRoutinesCancelRef.current = false;
    loadCoachRoutines();
    return () => { coachRoutinesCancelRef.current = true; };
  }, [user.uid]);

  // Reload coach routines when switching to home or dashboard tab
  useEffect(() => {
    if ((activeTab === "new" || activeTab === "dashboard") && !user.isGuest) {
      loadCoachRoutines();
    }
  }, [activeTab]);
  const [sessionMode, setSessionMode] = useState(null); // null | "live" | "register"
  const [showNameModal, setShowNameModal] = useState(false);
  const [liveActive, setLiveActive] = useState(false);
  const [guestLimitModal, setGuestLimitModal] = useState(null); // null | "register" | "live"
  const [floatTimer, setFloatTimer] = useState({ visible: false, secs: 90, running: false, elapsed: 0 });
  const floatTimerRef = useRef();
  const [shareSession, setShareSession] = useState(null);
  const [toast, setToast] = useState(null);
  const presetRef = useRef();
  const coachRoutinesCancelRef = useRef(false);
  const toastTimerRef = useRef(null);
  const saveSessionsTimerRef = useRef(null);
  const saveBodyStatsTimerRef = useRef(null);

  // Ocultar banner durante sesión en vivo
useEffect(() => {
  if (isPro) return;
  if (liveActive) { removeBanner(); } else { initAdMob().then(() => showBanner()); }
}, [liveActive]);

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
              setTimeout(() => { try { ctx.close(); } catch(e) {} }, 600);
            } catch(e) {}
            // Vibración en móvil
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch(e) {}
            // Notificación web (funciona aunque la app esté en segundo plano)
            try {
              if (Capacitor.isNativePlatform()) {
                import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
                  LocalNotifications.schedule({
                    notifications: [{
                      id: 998,
                      title: "¡Tiempo de descanso terminado! 💪",
                      body: "Listo para la siguiente serie.",
                      schedule: { at: new Date(Date.now() + 500) },
                      smallIcon: "ic_notification",
                      channelId: "gymtracker_default",
              iconColor: "#e8ff00",
                      sound: null,
                    }]
                  }).catch(() => {});
                }).catch(() => {});
              } else if ("Notification" in window && Notification.permission === "granted") {
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
    clearTimeout(saveSessionsTimerRef.current);
    saveSessionsTimerRef.current = setTimeout(() => {
      saveSessions(user.uid, sessions).then(result => {
        if (!result) {
          showToast("⚠️ Error al guardar — verifica tu conexión");
        }
      });
    }, 2000);
    return () => clearTimeout(saveSessionsTimerRef.current);
  }, [sessions, sessionsLoading, user.isGuest, user.uid]);
  // unit fixed to kg — no need to persist
  useEffect(() => { setHistPage(0); }, [filterWorkout, filterMuscle, filterPeriod, filterOrder, calSelectedDate]);
  useEffect(() => {
    store(bodyKey, bodyStats);
    if (user.isGuest) return;
    clearTimeout(saveBodyStatsTimerRef.current);
    saveBodyStatsTimerRef.current = setTimeout(() => {
      saveBodyStatsToDB(user.uid, bodyStats);
    }, 2000);
    return () => clearTimeout(saveBodyStatsTimerRef.current);
  }, [bodyStats, bodyKey, user.uid, user.isGuest]);
  useEffect(() => { store(plannerKey, weeklyPlan); }, [weeklyPlan]);
  useEffect(() => { store(goalKey, weeklyGoal); }, [weeklyGoal]);

  // ─── Notificaciones locales (Capacitor) ────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || sessionsLoading) return;

    async function setupNotifications() {
      try {
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        // Crear canal de notificaciones (obligatorio Android 8+)
        try {
          await LocalNotifications.createChannel({
            id: "gymtracker_default",
            name: "Beast",
            description: "Recordatorios y alertas de entrenamiento",
            importance: 4, // HIGH
            visibility: 1,
            vibration: true,
          });
        } catch(chErr) {
          // Canal puede ya existir
        }

        // Pedir permiso
        const perm = await LocalNotifications.requestPermissions();
        if (perm.display !== "granted") return;

        // Cancelar todas las anteriores para reprogramar limpias
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        const notifications = [];

        const motivMessages = [
          { title: "💪 ¡YEAH BUDDY!", body: "LIGHTWEIGHT BABY! Hoy es día de entrenar. ¡Vamos!" },
          { title: "🔥 Ronnie te está mirando", body: "Ronnie Coleman nunca faltó al gym. ¿Y tú? 👀" },
          { title: "🏆 Los resultados no mienten", body: "Cada rep cuenta. Cada sesión importa. ¡A entrenar!" },
          { title: "😤 Sin excusas", body: "Tu cama es cómoda, pero los músculos no se hacen solos." },
          { title: "🦵 Hoy toca pierna", body: "No seas de los que olvidaron el día de pierna... otra vez." },
          { title: "😂 Día de pierna", body: "Skipping leg day again? Las pantorrillas te odian." },
          { title: "⚡ Modo bestia activado", body: "El gym te espera. Los pesos no se levantan solos." },
          { title: "🧠 Disciplina > Motivación", body: "La motivación va y viene. La disciplina te lleva igual." },
          { title: "📈 Progreso real", body: "El que entrena hoy supera al de ayer. Sé ese alguien." },
          { title: "😴 ¿Aún en cama?", body: "Tu yo del futuro te lo agradecerá. ¡Muévete!" },
          { title: "🎯 Enfocado", body: "Un mal entrenamiento es mejor que ninguno." },
          { title: "🤣 Chiste del día", body: "¿Por qué saltan el día de pierna? Para correr de sus responsabilidades 🏃" },
          { title: "🔑 El secreto", body: "No hay secreto. Solo consistencia. ¡Ve al gym!" },
          { title: "💀 Arnold dixit", body: "El dolor de hoy es la fuerza de mañana. - Arnold" },
          { title: "🚫 No hay tiempo", body: "Todos tenemos 24h. La diferencia es qué hacemos con ellas." },
          { title: "🏋️ ¿PR hoy?", body: "Hoy puede ser el día de tu récord. Ni lo sabrás si no vas." },
          { title: "😅 Honestidad brutal", body: "No es falta de tiempo. No es prioridad. ¡Cámbialo!" },
          { title: "🌅 Nuevo día", body: "Cada día es una oportunidad de ser más fuerte que ayer." },
          { title: "🤝 Tu yo del futuro", body: "Entrena hoy por quien quieres ser mañana." },
          { title: "🔥 No pain no gain", body: "Sin dolor no hay gloria. Pero estírate primero 😅" },
          { title: "🍕 Cardio o pizza", body: "Puedes comer la pizza o correr de ella. Tú decides." },
          { title: "😤 ¿Mañana?", body: "'Mañana empiezo' lleva años diciéndolo. ¡Hoy!" },
          { title: "🧱 Ladrillo a ladrillo", body: "Roma no se construyó en un día. Pero se construyó cada día." },
          { title: "🐔 El pollo te llama", body: "Arroz, pollo y gym. La santísima trinidad del físico. 🙏" },
          { title: "💤 Descanso activo", body: "¿Día de descanso? Bien. Mañana sin excusas al gym." },
          { title: "🎮 Pause y al gym", body: "El juego guarda progreso. Tu cuerpo también, si entrenas." },
          { title: "🥊 Rocky mode", body: "Si Rocky entrenaba en Siberia, tú puedes ir al gym." },
          { title: "📉 Sin retroceder", body: "Cada día que no entrenas, alguien más sí lo hace." },
          { title: "🧬 Genética no es excusa", body: "La genética carga la pistola. Tú aprietas el gatillo." },
          { title: "🌮 Cheat meal ganado", body: "El cheat meal sabe mejor tras entrenar toda la semana." },
          { title: "🪞 Mírate al espejo", body: "¿Te gusta lo que ves? El gym tiene la solución. 💪" },
          { title: "🎒 La mochila te espera", body: "Está lista desde ayer. Solo falta que tú vayas al gym." },
          { title: "😬 ¿Cuánto llevas sin ir?", body: "Exacto. Demasiado. Es hora de volver al gym hoy." },
          { title: "🦾 Brazos de fideos", body: "Si no levantas peso, los brazos siguen siendo fideos. Facts." },
          { title: "🏃 Empieza con 5 minutos", body: "Solo 5 minutos. Siempre terminas haciendo una hora completa." },
          { title: "😎 Tú vs tú", body: "No compitas con nadie más. Solo sé mejor que el tú de ayer." },
          { title: "🌙 Antes de dormir", body: "¿Hiciste algo por tu cuerpo hoy? Si no, mañana sin excusas." },
          { title: "🧂 El sudor no miente", body: "El sudor es la grasa llorando. Ve al gym y hazla llorar más." },
          { title: "🪑 Llevas horas sentado", body: "Tu espalda lo sabe. Tu cuerpo lo pide. El gym te espera." },
          { title: "💸 Pagas igual", body: "La mensualidad se cobra vayas o no. Aprovecha tu dinero." },
          { title: "🎯 Una serie más siempre", body: "Cuando creas que ya no puedes, haz una serie más. Siempre." },
          { title: "🏅 Nadie te regala nada", body: "El físico no se hereda ni se compra. Se construye en el gym." },
          { title: "😏 Sé lo que hiciste ayer", body: "Tampoco fuiste ayer, ¿verdad? Hoy no hay excusa que valga." },
          { title: "🦷 Como el dentista", body: "Ir al gym duele menos que arrepentirte de no haber ido." },
          { title: "🔄 La rutina gana siempre", body: "No necesitas motivación. Necesitas una rutina y respetarla." },
          { title: "🌊 Siempre te sentirás mejor", body: "Nadie salió del gym arrepentido de haber ido. Nunca." },
          { title: "🥵 Que duela un poco", body: "Si no duele un poco, probablemente no estás haciendo nada." },
          { title: "📸 La foto de progreso", body: "En 3 meses te alegrarás de haber empezado hoy. Foto incluida." },
          { title: "🍗 Proteína primero", body: "Pollo, huevo, atún. Después el gym. El orden importa. 🔑" },
          { title: "🛌 El descanso se gana", body: "Descansas mejor cuando sabes que entrenaste duro hoy." },
          { title: "🧪 ¡Tu creatina!", body: "No te olvides de la creatina. Cada día cuenta, incluso hoy." },
          { title: "🏗️ En construcción", body: "Tu cuerpo es una obra. Cada entrenamiento pone un ladrillo." },
          { title: "🎵 Pon la playlist", body: "Busca tu canción favorita y úsala de excusa para ir al gym." },
          { title: "🌡️ Frío o calor", body: "El clima no es excusa. El gym tiene techo. ¡Vamos!" },
          { title: "🤒 ¿Cansado?", body: "Cansancio mental se cura con ejercicio. Lo dice la ciencia." },
          { title: "🧃 Hidratación primero", body: "Toma agua, agarra la mochila y al gym. En ese orden." },
          { title: "📊 Lleva la cuenta", body: "¿Cuántas veces fuiste esta semana? Si la respuesta duele, al gym." },
          { title: "🦁 Mentalidad de león", body: "El león no se pregunta si tiene ganas. Sale y caza. Tú también." },
          { title: "🎽 Ya estás vestido", body: "Ponte la ropa de gym ahora. El resto se da solo." },
          { title: "💡 Dato curioso", body: "20 minutos de ejercicio mejoran el humor por horas. ¿Vale la pena?" },
          { title: "🧗 Un peldaño a la vez", body: "No necesitas ser el mejor. Solo ser constante. Eso es todo." },
          { title: "🌿 Mente sana", body: "El gym no es solo físico. Tu cabeza también lo necesita." },
          { title: "🥇 Primer lugar", body: "En tu propia vida, el primer lugar siempre debe ser tuyo." },
          { title: "⏰ Son solo 60 minutos", body: "Una hora al día. El día tiene 24. No hay excusa matemática." },
          { title: "🔋 Recarga energía", body: "Paradójico pero real: entrenar te da más energía. Inténtalo." },
          { title: "🌐 El mundo no para", body: "Mientras tú descansas, otros entrenan. Tú decides." },
          { title: "🤜 Golpea fuerte hoy", body: "Imagina todos tus problemas en el saco. Ahora ve al gym." },
          { title: "🏄 Fluye", body: "Cuando entras en modo gym, todo lo demás desaparece. Úsalo." },
          { title: "👟 Los zapatos listos", body: "Están en la puerta desde ayer. Póntelos y sal." },
          { title: "🎖️ Medalla invisible", body: "Nadie te la da, pero tú sabes cuándo te la ganaste." },
          { title: "🧩 La pieza que falta", body: "Tu semana perfecta le falta una pieza: el gym de hoy." },
          { title: "🐢 Lento pero seguro", body: "No importa el ritmo. Importa que no pares. Nunca pares." },
          { title: "🌟 Hoy puede ser el día", body: "El día que todo cambia empieza igual que cualquier otro." },
          { title: "💬 Díselo al espejo", body: "Mírate y di: hoy voy al gym. Ahora cúmplelo." },
          { title: "🏋️ Los pesos te esperan", body: "Están ahí, fríos y quietos. Ve a calentarlos un poco." },
          { title: "😁 La cara del gym", body: "Esa cara de satisfacción al salir del gym no tiene precio." },
          { title: "🔑 Abre la puerta", body: "La puerta del gym es la más importante que abrirás hoy." },
          { title: "🧘 Equilibrio total", body: "Cuerpo fuerte, mente fuerte. Uno no funciona sin el otro." },
          { title: "🌈 Después de la lluvia", body: "Después de cada sesión dura viene la mejor versión de ti." },
          { title: "🤩 Tu momento", body: "En el gym no hay jefes, no hay problemas. Solo tú y los pesos." },
          { title: "📅 Marca el día", body: "Tachar el gym en el calendario es uno de los mejores feels." },
          { title: "🦅 Vuela alto", body: "Los que entrenan ven el mundo desde arriba. Sé uno de ellos." },
          { title: "🎯 Sin distracciones", body: "Teléfono en modo avión, música a tope y a levantar peso." },
          { title: "💥 Explota hoy", body: "Guarda toda tu energía para el gym. Deja todo ahí adentro." },
          { title: "🍌 Carbohidratos cargados", body: "Come bien, descansa bien, entrena mejor. La fórmula es simple." },
          { title: "🤸 Movilidad primero", body: "5 minutos de movilidad antes = menos lesiones + mejor sesión." },
          { title: "🏆 Campeón de tu vida", body: "No necesitas un trofeo. Solo ser el campeón de tu propia historia." },
          { title: "🕶️ Modo profesional", body: "Entra al gym como si fuera tu trabajo. Porque lo es." },
          { title: "🌙 Noche de gym", body: "¿No pudiste ir de día? La noche también tiene gym. Sin excusas." },
          { title: "🧠 Tu cerebro lo pide", body: "El ejercicio libera dopamina. Tu cerebro literalmente lo necesita." },
          { title: "🥗 Come para rendir", body: "La nutrición es el 70%. El gym el 30%. Cuida los dos." },
          { title: "🔥 Fuego interno", body: "Ese fuego que sientes antes de entrenar... aliméntalo hoy." },
          { title: "😤 Demuéstrate algo", body: "No lo hagas por nadie más. Hazlo para demostrarte a ti mismo." },
          { title: "🎬 Última escena", body: "En la película de tu vida, ¿eres el héroe o el que se rindió?" },
          { title: "🚀 Despegue", body: "Los primeros 10 minutos son los más difíciles. Después vuela solo." },
          { title: "🌍 Un día a la vez", body: "No pienses en meses. Piensa en hoy. Solo en hoy. ¡Vamos!" },
          { title: "💪 Versión mejorada", body: "Cada sesión instala una actualización en tu cuerpo. ¡Actualízate!" },
        ];

        const usedIndexes = new Set();
        const getUniqueMsg = () => {
          if (usedIndexes.size >= motivMessages.length) usedIndexes.clear();
          let idx;
          do { idx = Math.floor(Math.random() * motivMessages.length); } while (usedIndexes.has(idx));
          usedIndexes.add(idx);
          return motivMessages[idx];
        };

        // 1 notificación por día, hora aleatoria entre 8 y 22
        for (let d = 1; d <= 7; d++) {
          const msg = getUniqueMsg();
          notifications.push({
            id: 100 + d,
            title: msg.title,
            body: msg.body,
            schedule: {
              on: { weekday: d, hour: Math.floor(Math.random() * (22 - 8 + 1)) + 8, minute: Math.floor(Math.random() * 60) },
              repeats: true,
              allowWhileIdle: true,
            },
            sound: null,
            smallIcon: "ic_notification",
            channelId: "gymtracker_default",
            iconColor: "#e8ff00",
          });
        }

        // +1 extra si llevas 2+ días sin entrenar
        const lastSessionDate = sessions.length > 0
          ? sessions.reduce((latest, s) => s.date > latest ? s.date : latest, sessions[0].date)
          : null;
        if (lastSessionDate) {
          const daysSinceLast = Math.floor((new Date() - new Date(lastSessionDate + "T00:00:00")) / 86400000);
          if (daysSinceLast >= 2) {
            const msg = getUniqueMsg();
            notifications.push({
              id: 200,
              title: "😬 ¡Tu racha está en riesgo! " + daysSinceLast + " días sin entrenar",
              body: msg.body,
              schedule: { at: new Date(Date.now() + 10000), repeats: false, allowWhileIdle: true },
              sound: null,
              smallIcon: "ic_notification",
              channelId: "gymtracker_default",
              iconColor: "#e8ff00",
            });
          }
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
        }
      } catch(e) {
        // Notif error silenced in production
      }
    }

    setupNotifications();
  }, [sessionsLoading, weeklyPlan]);



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
  const isCoachPlan = ["coach","gym"].includes(user.plan);
  const isGym  = user.plan === "gym";
  const GUEST_MAX = 1;
  const canAdd = isGuest ? sessions.length < GUEST_MAX : true;
  const canExport = !isGuest;
  const canCharts = !isGuest;

  // Historial: Free ve solo ultimos 3 meses, Pro ve todo
  const THREE_MONTHS_AGO = new Date(); THREE_MONTHS_AGO.setMonth(THREE_MONTHS_AGO.getMonth() - 3);
  const visibleSessions = isPro || isGuest
    ? sessions
    : sessions.filter(s => new Date(s.date) >= THREE_MONTHS_AGO);

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

  async function addExercise() {
    const finalName = exName;
    if (!finalName) { showToast("⚠️ Selecciona un ejercicio"); return; }
    if (!exWeight) { showToast("⚠️ Ingresa el peso"); return; }
    if (!exReps) { showToast("⚠️ Ingresa las repeticiones"); return; }
    const count = parseInt(exSeriesCount);
    if (!exSeriesCount || isNaN(count) || count < 1 || count > 20) { showToast("⚠️ Series debe ser entre 1 y 20"); return; }
    const sets = Array.from({ length: count }, () => ({ id: uid(), weight: exWeight, reps: exReps }));
    // Si el ejercicio no existe en la DB, registrarlo localmente para esta sesión
    if (!EXERCISE_DB.find(e => e.name === finalName)) {
      registerCustomExercise(finalName, "");
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

  function groupExercisesAsSuperset(idxA, idxB) {
    setCurrentExercises(prev => {
      const existing = prev[idxA]?.supersetGroup || prev[idxB]?.supersetGroup || uid().slice(0, 8);
      return prev.map((ex, i) =>
        i === idxA || i === idxB ? { ...ex, supersetGroup: existing } : ex
      );
    });
  }

  function addToExistingSuperset(groupId, exId) {
    setCurrentExercises(prev =>
      prev.map(ex => ex.id === exId ? { ...ex, supersetGroup: groupId } : ex)
    );
  }

  function removeFromSuperset(exId) {
    setCurrentExercises(prev => {
      const idx = prev.findIndex(e => e.id === exId);
      if (idx < 0) return prev;
      const groupId = prev[idx]?.supersetGroup;
      if (!groupId) return prev;
      const members = prev.filter(ex => ex.supersetGroup === groupId);
      const next = prev.map((ex, i) => i === idx ? { ...ex, supersetGroup: null } : ex);
      // Si solo quedaba 1 miembro tras quitar este, disolver el grupo entero
      if (members.length <= 2) {
        return next.map(ex => ex.supersetGroup === groupId ? { ...ex, supersetGroup: null } : ex);
      }
      return next;
    });
  }

  function saveSession() {
    if (!date || !workout) { showToast("⚠️ Falta el nombre del entrenamiento"); return false; }
    if (currentExercises.length === 0) { showToast("⚠️ Agrega al menos un ejercicio"); return false; }
    if (isGuest && !editingId && sessions.length >= GUEST_MAX) { setGuestLimitModal("register"); return false; }
    if (!canAdd && !editingId) { showToast("⚠️ Límite de 5 sesiones en plan Free"); setShowPlans(true); return false; }
    const workoutName = workout.trim().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
    if (editingId) {
      setSessions(prev => prev.map(s => s.id === editingId ? { ...s, date, workout: workoutName, notes, exercises: currentExercises } : s));
      setEditingId(null); showToast("✅ Sesión actualizada");
    } else {
      const newSession = { id: uid(), date, workout: workoutName, notes, exercises: currentExercises, unit };
      const newPRs = detectNewPRs(newSession, sessions);
      const updatedSessions = [newSession, ...sessions];
      setSessions(prev => [newSession, ...prev]);
      fireConfetti();
      if (newPRs.length > 0) {
        setPrConfetti({ prs: newPRs });
      } else {
        showToast("✅ Sesión guardada");
      }
      // 🛡️ Escudo por hito de 4 semanas seguidas
      const newStreak = getStreak(updatedSessions, weeklyGoal?.target || 3);
      const prevStreak = getStreak(sessions, weeklyGoal?.target || 3);
      if (newStreak > prevStreak && newStreak > 0 && newStreak % 4 === 0) {
        if (addShield(`streak-${newStreak}w`)) {
          setTimeout(() => showToast(`🛡️ ¡Escudo ganado! ${newStreak} semanas seguidas`), 1200);
        }
      }
      // Detectar logros nuevos
      const prsAfter = getPRs(updatedSessions);
      const badgeExtras = { aiUses: parseInt(localStorage.getItem("gym_ai_uses")||"0"), photoCount: parseInt(localStorage.getItem("gym_photo_count")||"0") };
      const nowEarned = BADGE_DEFS.filter(b => b.check(updatedSessions, prsAfter, user, badgeExtras));
      const newlyEarned = nowEarned.filter(b => !seenBadges.includes(b.id));
      if (newlyEarned.length > 0) {
        const first = newlyEarned[0];
        setTimeout(() => {
          setBadgeToast(first);
          setTimeout(() => setBadgeToast(null), 5000);
        }, newPRs.length > 0 ? 3000 : 800);
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

  function deleteSession(id) { askConfirm("¿Eliminar esta sesión? Esta acción no se puede deshacer.", () => { setSessions(prev => prev.filter(s => s.id !== id)); showToast("🗑️ Eliminada"); }); }

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
    if (calSelectedDate) return s.date === calSelectedDate;
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
    if (filterPR) {
      const sTs = new Date(s.date+"T00:00:00").getTime();
      const hasPR = (s.exercises||[]).some(ex => {
        const sessW = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
        const prevBest = sessions.filter(ps => {
          if (ps.id === s.id) return false;
          const psTs = new Date(ps.date+"T00:00:00").getTime();
          return psTs < sTs || (ps.date === s.date && ps.id < s.id);
        }).flatMap(ps => (ps.exercises||[]).filter(pe => pe.name === ex.name))
          .reduce((b, pe) => Math.max(b, pe.sets?.length > 0 ? Math.max(...pe.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(pe.weight)||0), 0);
        return sessW > prevBest && sessW > 0;
      });
      if (!hasPR) return false;
    }
    return true;
  })
  .sort((a, b) => filterOrder === "desc"
    ? b.date.localeCompare(a.date)
    : a.date.localeCompare(b.date)
  );  

  const NAV = [
    { id: "new", icon: "⚡", label: "Nueva sesión" },
    { id: "history", icon: "📋", label: "Historial" },
    { id: "dashboard", icon: "📊", label: "Dashboard" },
  ];
  
  // Earned badges count for notification dot
  const prsForBadge = useMemo(() => getPRs(sessions), [sessions]);
  const badgeExtras = useMemo(() => ({
    aiUses: parseInt(localStorage.getItem("gym_ai_uses") || "0"),
    photoCount: parseInt(localStorage.getItem("gym_photo_count") || "0"),
  }), []);
  const earnedBadgeIds = useMemo(
    () => BADGE_DEFS.filter(b => b.check(sessions, prsForBadge, user, badgeExtras)).map(b => b.id),
    [sessions, prsForBadge, user, badgeExtras]
  );
  const earnedBadges = earnedBadgeIds.length;
  const newBadgesCount = useMemo(
    () => earnedBadgeIds.filter(id => !seenBadges.includes(id)).length,
    [earnedBadgeIds, seenBadges]
  );
  const currentStreak = useMemo(
    () => getStreak(sessions, weeklyGoal?.target || 3),
    [sessions, weeklyGoal]
  );

  function openBadgesModal() {
    setShowBadges(true);
    // El BadgesModal maneja internamente el marcado de vistos
  }

  const navClick = (id) => { setActiveTab(id); setMobileNavOpen(false); };

  return (
    <CustomGifCtx.Provider value={{ gifs: customGifsMap, setGif: (name, url) => setCustomGifsMap(p => ({ ...p, [name]: url })) }}>
    <div className="app-layout">
      {/* Desktop Sidebar */}
      <aside className="sidebar desktop-only">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <span style={{ fontSize: 18, flexShrink: 0 }}>⚡</span>
            <span className="logo-text" style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:900, letterSpacing:6, textTransform:"uppercase", color:"var(--text)" }}>BEAST</span>
          </div>
        </div>

        {todayPlanned&&(()=>{const ts=todayStr();const dn=sessions.some(s=>s.date===ts&&s.workout?.toLowerCase()===todayPlanned.toLowerCase());return(<div style={{margin:"0 12px 12px",padding:"10px 12px",background:dn?"rgba(34,197,94,0.07)":"var(--accent-dim)",border:`1px solid ${dn?"rgba(34,197,94,0.2)":"rgba(232,255,0,0.15)"}`,borderRadius:4}}><div style={{fontSize:9,fontWeight:800,letterSpacing:3,color:dn?"#22c55e":"var(--accent)",textTransform:"uppercase",marginBottom:3}}>{dn?"✅ COMPLETADA":"HOY TOCA"}</div><div style={{fontSize:13,fontWeight:700,color:"var(--text)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",letterSpacing:1,textTransform:"uppercase"}}>{todayPlanned}</div></div>);})()}

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
      { label: "RUTINAS", items: [
        { icon: "📅", label: "Planificador", action: () => openPlanner("plan") },
        { icon: "📄", label: "Plantillas", action: () => setShowTemplates(true) },
      ]},
      { label: "COMUNIDAD", items: [
        { icon: "👥", label: "GymTeams", action: () => setShowTeams(true) },
        { icon: "🏁", label: "Reto semanal", action: () => setShowChallenge(true) },
        { icon: "🤝", label: "Mi Coach", action: () => setShowAthleteCoach(true) },
        ...(user.isCoach ? [{ icon: "🌟", label: "Panel Coach", action: () => setShowCoach(true) }] : []),
      ]},
      { label: "PROGRESO", items: [
        { icon: "📈", label: "Evolución", action: () => setShowProgressPicker(true) },
        { icon: "⚖️", label: "Peso & Estatura", action: () => setShowBodyStats(true) },
        ...(user.isAdmin ? [{ icon: "⚙️", label: "Ejercicios custom", action: () => setShowAdminExercises(true) }] : []),
      ]},
    ].map(group => (
      <div key={group.label}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 4, padding: "16px 12px 4px", textTransform: "uppercase", opacity: 0.5 }}>
          {group.label}
        </div>
        {group.items.map(item => (
          <button key={item.label} className="nav-item" onClick={item.action}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
        {group.label === "PROGRESO" && (
          <>
            <button className="nav-item" onClick={() => openBadgesModal()} style={{ position:"relative" }}>
              <span className="nav-icon">🏅</span>
              <span className="nav-label">Logros</span>
              {newBadgesCount > 0 && (
                <span style={{
                  position:"absolute", top:6, left:28,
                  background:"#ef4444", color:"#fff",
                  borderRadius:"50%", width:16, height:16,
                  fontSize:10, fontWeight:900,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 0 0 2px var(--bg)",
                  animation:"pulse 1.5s infinite",
                }}>{newBadgesCount}</span>
              )}
            </button>
            <button className="nav-item" onClick={() => setShowPhotoProgress(true)}>
              <span className="nav-icon">📸</span>
              <span className="nav-label">Análisis IA</span>
            </button>
          </>
        )}
      </div>
    ))}

        </nav>
        <div className="sidebar-bottom" style={{ paddingBottom: 70 }}>
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
              <span className="nav-icon">📲</span>
              <span className="nav-label">Instalar app</span>
            </button>
          )}


          {/* Suscripción */}
          {!isPro ? (
            <button
              className="nav-item"
              style={{
                marginBottom: 8, marginTop: 4,
                background: "rgba(232,255,0,0.08)",
                border: "1px solid rgba(232,255,0,0.25)",
                borderRadius: 8,
              }}
              onClick={() => setShowPaywall(true)}
            >
              <span className="nav-icon">⚡</span>
              <span className="nav-label" style={{ color: "#e8ff00", fontWeight: 800 }}>HAZTE PRO</span>
            </button>
          ) : (
            <button
              className="nav-item"
              style={{
                marginBottom: 8, marginTop: 4,
                background: "rgba(232,255,0,0.05)",
                border: "1px solid rgba(232,255,0,0.15)",
                borderRadius: 8,
                cursor: "default",
              }}
            >
              <span className="nav-icon">⚡</span>
              <span className="nav-label" style={{ color: "#e8ff00", fontWeight: 800 }}>
                BEAST {user.plan?.toUpperCase()} ✓
              </span>
            </button>
          )}

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
          <button className="nav-item" onClick={() => askConfirm("¿Seguro que quieres salir?", logout)}>
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
            ? (editingId ? "✏️ Editando sesión" : `👋 Hola, ${user.name.split(" ")[0]}!`)
            : activeTab === "history" ? "📋 Historial"
            : "📊 Dashboard"}
            </h1>
          </div>
          <div className="topbar-actions">
            {(()=>{const sv=currentStreak;const tt=sessions.some(s=>s.date===todayStr());return(<button className="topbar-btn" onClick={()=>{ setActiveTab("history"); setTimeout(()=>{ const el=document.getElementById("training-calendar-section"); if(el) el.scrollIntoView({behavior:"smooth",block:"start"}); },100); }} style={{cursor:"pointer",opacity:tt?1:0.45,filter:tt?"none":"grayscale(1)",background:"none",border:"none"}}><span className="topbar-btn-icon">🔥</span><span className="topbar-btn-label" style={{color:tt?"#f97316":"var(--text-muted)",fontWeight:800}}>{sv}sem</span></button>);})()}
            <button className="topbar-btn" onClick={() => isPro ? setShowPlanInfo(true) : setShowPaywall(true)}
              style={{ background: isPro ? "rgba(232,255,0,0.08)" : "rgba(232,255,0,0.12)", border: `1px solid ${isPro ? "rgba(232,255,0,0.2)" : "rgba(232,255,0,0.35)"}`, borderRadius: 8, cursor: "pointer" }}>
              <span className="topbar-btn-icon">⚡</span>
              <span className="topbar-btn-label" style={{ color: "#e8ff00", fontWeight: 800 }}>
                {isPro ? user.plan.toUpperCase() : "FREE"}
              </span>
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
                  <span className="logo-text" style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:900, letterSpacing:6, textTransform:"uppercase", color:"var(--text)" }}>BEAST</span>
                </div>
                <button onClick={() => setMobileNavOpen(false)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:18, cursor:"pointer", padding:"4px 8px", lineHeight:1 }}>✕</button>
              </div>

              {todayPlanned&&(()=>{const ts=todayStr();const dn=sessions.some(s=>s.date===ts&&s.workout?.toLowerCase()===todayPlanned.toLowerCase());return(<div style={{margin:"12px 12px 0",padding:"10px 12px",background:dn?"rgba(34,197,94,0.07)":"var(--accent-dim)",border:`1px solid ${dn?"rgba(34,197,94,0.2)":"rgba(232,255,0,0.15)"}`,borderRadius:4}}><div style={{fontSize:9,fontWeight:800,letterSpacing:3,color:dn?"#22c55e":"var(--accent)",textTransform:"uppercase",marginBottom:3}}>{dn?"✅ COMPLETADA":"HOY TOCA"}</div><div style={{fontSize:13,fontWeight:700,color:"var(--text)",letterSpacing:1,textTransform:"uppercase"}}>{todayPlanned}</div></div>);})()}

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

                {/* RUTINAS */}
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 4, padding: "12px 12px 4px", textTransform: "uppercase", opacity: 0.5 }}>Rutinas</div>
                {[
                  { icon: "📅", label: "Planificador", action: () => { openPlanner("plan"); setMobileNavOpen(false); } },
                  { icon: "📄", label: "Plantillas", action: () => { setShowTemplates(true); setMobileNavOpen(false); } },
                ].map(({ icon, label, action }) => (
                  <button key={label} className="nav-item" style={{ marginBottom: 2 }} onClick={action}>
                    <span className="nav-icon">{icon}</span>
                    <span className="nav-label">{label}</span>
                  </button>
                ))}

                {/* COMUNIDAD */}
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 4, padding: "12px 12px 4px", textTransform: "uppercase", opacity: 0.5 }}>Comunidad</div>
                {[
                  { icon: "👥", label: "GymTeams", action: () => { setShowTeams(true); setMobileNavOpen(false); } },
                  { icon: "🏁", label: "Reto semanal", action: () => { setShowChallenge(true); setMobileNavOpen(false); } },
                  { icon: "🤝", label: "Mi Coach", action: () => { setShowAthleteCoach(true); setMobileNavOpen(false); } },
                  ...(user.isCoach ? [{ icon: "🌟", label: "Panel Coach", action: () => { setShowCoach(true); setMobileNavOpen(false); } }] : []),
                ].map(({ icon, label, action }) => (
                  <button key={label} className="nav-item" style={{ marginBottom: 2 }} onClick={action}>
                    <span className="nav-icon">{icon}</span>
                    <span className="nav-label">{label}</span>
                  </button>
                ))}

                {/* PROGRESO */}
                <div style={{ fontSize: 9, fontWeight: 800, color: "var(--text-muted)", letterSpacing: 4, padding: "12px 12px 4px", textTransform: "uppercase", opacity: 0.5 }}>Progreso</div>
                {[
                  { icon: "📈", label: "Evolución", action: () => { setShowProgressPicker(true); setMobileNavOpen(false); } },
                  { icon: "⚖️", label: "Peso & Estatura", action: () => { setShowBodyStats(true); setMobileNavOpen(false); } },
                  ...(user.isAdmin ? [{ icon: "⚙️", label: "Ejercicios custom", action: () => { setShowAdminExercises(true); setMobileNavOpen(false); } }] : []),
                ].map(({ icon, label, action }) => (
                  <button key={label} className="nav-item" style={{ marginBottom: 2 }} onClick={action}>
                    <span className="nav-icon">{icon}</span>
                    <span className="nav-label">{label}</span>
                  </button>
                ))}
                <button className="nav-item" style={{ marginBottom:2, position:"relative" }} onClick={() => { openBadgesModal(); setMobileNavOpen(false); }}>
                  <span className="nav-icon">🏅</span>
                  <span className="nav-label">Logros</span>
                  {newBadgesCount > 0 && (
                    <span style={{
                      position:"absolute", top:6, left:28,
                      background:"#ef4444", color:"#fff",
                      borderRadius:"50%", width:16, height:16,
                      fontSize:10, fontWeight:900,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      boxShadow:"0 0 0 2px var(--bg)",
                    }}>{newBadgesCount}</span>
                  )}
                </button>
                <button className="nav-item" style={{ marginBottom:2 }} onClick={() => { setShowPhotoProgress(true); setMobileNavOpen(false); }}>
                  <span className="nav-icon">📸</span>
                  <span className="nav-label">Análisis IA</span>
                </button>

                {/* Suscripción */}
                {!isPro ? (
                  <button
                    className="nav-item"
                    style={{
                      marginBottom: 2, marginTop: 6,
                      background: "rgba(232,255,0,0.08)",
                      border: "1px solid rgba(232,255,0,0.25)",
                      borderRadius: 8,
                    }}
                    onClick={() => { setShowPaywall(true); setMobileNavOpen(false); }}
                  >
                    <span className="nav-icon">⚡</span>
                    <span className="nav-label" style={{ color: "#e8ff00", fontWeight: 800 }}>HAZTE PRO</span>
                  </button>
                ) : (
                  <button
                    className="nav-item"
                    style={{
                      marginBottom: 2, marginTop: 6,
                      background: "rgba(232,255,0,0.05)",
                      border: "1px solid rgba(232,255,0,0.15)",
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                    onClick={() => { setShowPlanInfo(true); setMobileNavOpen(false); }}
                  >
                    <span className="nav-icon">⚡</span>
                    <span className="nav-label" style={{ color: "#e8ff00", fontWeight: 800 }}>
                      BEAST {user.plan?.toUpperCase()} ✓
                    </span>
                  </button>
                )}
              </nav>

              <div style={{ padding: "12px 8px 80px", borderTop: "1px solid var(--border)" }}>                {!isOnline && (
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
                    <span className="nav-icon">📲</span>
                    <span className="nav-label">Instalar app</span>
                  </button>
                )}

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
                <button className="nav-item" onClick={() => askConfirm("¿Seguro que quieres salir?", logout)}>
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
      <Suspense fallback={<div style={{color:"var(--text-muted)",textAlign:"center",padding:60,fontSize:14}}>⚡ Cargando...</div>}>
      <LiveTrainMode
        exercises={currentExercises}
        workout={workout}
        date={date}
        notes={notes}
        unit={unit}
        sessions={sessions}
        floatTimer={floatTimer}
        setFloatTimer={setFloatTimer}
        ExerciseGif={ExerciseGif}
        calc1RM={calc1RM}
        uid={uid}
        numDot={numDot}
        numWeight={numWeight}
        numReps={numReps}
        onShowPaywall={() => setShowPaywall(true)}
        onBack={() => { try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {} setLiveActive(false); }}
        onSaveSession={(finalExercises, elapsedSecs) => {
          if (!workout) { showToast("⚠️ Falta el nombre del entrenamiento"); return; }
          if (isGuest && sessions.length >= GUEST_MAX) { setGuestLimitModal("register"); return; }
          const workoutName = workout.trim().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
          const newSession = {
            id: uid(), date, workout: workoutName, notes,
            exercises: finalExercises, unit,
            durationSecs: elapsedSecs,
          };
          const newPRs = detectNewPRs(newSession, sessions);
          const updatedSessionsLive = [newSession, ...sessions];
          setSessions(prev => [newSession, ...prev]);
          fireConfetti();
          if (newPRs.length > 0) setPrConfetti({ prs: newPRs });
          else showToast("✅ Sesión guardada");
          // 🛡️ Escudo por hito de 4 semanas seguidas
          const newStreakLive = getStreak(updatedSessionsLive, weeklyGoal?.target || 3);
          const prevStreakLive = getStreak(sessions, weeklyGoal?.target || 3);
          if (newStreakLive > prevStreakLive && newStreakLive > 0 && newStreakLive % 4 === 0) {
            if (addShield(`streak-${newStreakLive}w`)) {
              setTimeout(() => showToast(`🛡️ ¡Escudo ganado! ${newStreakLive} semanas seguidas`), 1200);
            }
          }
          if (weeklyPlan.mode === "cycle" && weeklyPlan.cycle?.length > 0)
            setWeeklyPlan(p => ({ ...p, cyclePos: (p.cyclePos + 1) % p.cycle.length }));
          setDate(todayStr()); setWorkout(""); setNotes(""); setCurrentExercises([]);
          try { localStorage.removeItem(LIVE_DRAFT_KEY); } catch {} setLiveActive(false); setSessionMode(null);
          setActiveTab("history");
          setShowCompletedBanner(true);
        }}
      />
      </Suspense>
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
              <span>👤 Modo invitado — {Math.min(sessions.length, GUEST_MAX)}/{GUEST_MAX} sesión usada{sessions.length >= GUEST_MAX ? " · ⛔ Sin espacio" : ""}.</span>
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
            const ts2=todayStr();
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
            const lunes = new Date(); lunes.setHours(0,0,0,0); lunes.setDate(lunes.getDate() - (lunes.getDay() === 0 ? 6 : lunes.getDay() - 1));
const tw = new Set(sessions.filter(s => new Date(s.date + "T00:00:00") >= lunes).map(s => s.date)).size;  
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
            const todayDateStr = todayStr();
            const alreadyDone = sessions.some(s => s.date === todayDateStr && s.coachRoutineDocId === todayRoutine._docId);
            if (alreadyDone) {
              if (!showCompletedBanner) return null;
              return (
                <div style={{
                  display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"8px 14px", marginBottom:20,
                  background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.25)",
                  borderRadius:10,
                  animation:"fadeOutBanner 5s forwards",
                }}>
                  <span style={{fontSize:13, color:"#22c55e", fontWeight:700}}>
                    ✅ {todayRoutine.name || todayRoutine.routineName} completada hoy
                  </span>
                  {coachRoutines.length > 1 && (
                    <button onClick={() => setShowAthleteCoach(true)} style={{background:"none",border:"none",
                      color:"var(--accent)",fontSize:11,fontWeight:700,cursor:"pointer",padding:0}}>
                      Ver todas ({coachRoutines.length}) →
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div style={{
                background:"rgba(232,255,0,0.04)",
                border:"2px solid var(--accent)",
                borderRadius:12, marginBottom:20, overflow:"hidden",
                boxShadow:"0 0 24px rgba(232,255,0,0.12)",
              }}>
                <div style={{
                  background:"rgba(232,255,0,0.12)",
                  padding:"8px 14px", display:"flex", alignItems:"center", gap:8,
                  borderBottom:"1px solid rgba(232,255,0,0.15)",
                }}>
                  <span style={{fontSize:10,fontWeight:900,letterSpacing:2,textTransform:"uppercase",color:"var(--accent)"}}>
                    {isToday ? "⚡ TU COACH TE MANDÓ RUTINA PARA HOY" : "🏋️ TU COACH TE ASIGNÓ UNA RUTINA"}
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
                  <button onClick={() => {
                    setAthleteCoachInitialRoutine(todayRoutine);
                    setShowAthleteCoach(true);
                  }} style={{
                    background:"var(--accent)", border:"none", borderRadius:10,
                    color:"#0a0a0a", fontWeight:900, fontSize:13,
                    padding:"10px 16px", cursor:"pointer", flexShrink:0,
                    display:"flex",alignItems:"center",gap:5,
                    letterSpacing:1, fontFamily:"Barlow Condensed, sans-serif",
                    textTransform:"uppercase", boxShadow:"0 0 16px rgba(232,255,0,0.3)",
                  }}>⚡ INICIAR</button>
                </div>
              </div>
            );
          })()}

          {/* ── BRUX + LAS DOS TARJETAS PRINCIPALES ── */}
          <BeastMascot
            sessions={sessions}
            todayPlanned={todayPlanned}
            streak={currentStreak}
            onStartSession={(muscle, suggestedExercises) => {
              setExMuscle(muscle);
              setSessionMode("live");
              const name = muscle.charAt(0).toUpperCase() + muscle.slice(1).toLowerCase();
              setWorkout(name);
              if (suggestedExercises && suggestedExercises.length > 0) {
                setCurrentExercises(suggestedExercises.map(ex => ({
                  id: uid(), name: ex.name, muscle: ex.muscle,
                  sets: [{ id: uid(), weight: "", reps: "" }],
                  weight: "", reps: "", notes: "",
                })));
              }
            }}
            inNewSession={true}
          />

          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 14, fontFamily: "Barlow Condensed, sans-serif" }}>
            ¿Qué quieres hacer?
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>

            {/* ── Entrenar ahora ── */}
            <button
              onClick={() => { if (isGuest && !canAdd) { setGuestLimitModal("live"); return; } setWorkout(""); setShowNameModal(true); }}
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
              onClick={() => { if (isGuest && !canAdd) { setGuestLimitModal("register"); return; } setSessionMode("register"); }}
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
                onChange={e => setWorkout(e.target.value.slice(0, 25).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, ""))}
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
              <div style={{ fontSize:13, color:"var(--accent)", fontWeight:700, padding:"10px 12px", background:"var(--card)", border:"1px solid var(--border)", borderRadius:8 }}>
                📅 {fmtDateLong(date)}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Notas (opcional)</label>
              <textarea className="input textarea" placeholder="Objetivos del día…" value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} />
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
        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ position: "absolute", left: 12, color: "var(--text-muted)", fontSize: 15, pointerEvents: "none", zIndex: 1 }}>
            {exSearchFocus ? "🔍" : "▾"}
          </span>
          <input
            className="input"
            style={{ paddingLeft: 36, flex: 1, color: exName && !exSearchFocus ? "var(--text)" : undefined, fontWeight: exName && !exSearchFocus ? 600 : 400 }}
            placeholder="— Selecciona o escribe uno nuevo — el GIF llegará pronto ✨"
            value={exSearchFocus ? exSearch : (exName || "")}
            onChange={e => { setExSearch(e.target.value); setExName(""); }}
            onFocus={() => { setExSearchFocus(true); setExSearch(""); }}
            onBlur={() => setTimeout(() => { setExSearchFocus(false); }, 150)}
          />
          {exSearch.trim() && !filteredEx.find(ex => ex.name.toLowerCase() === exSearch.trim().toLowerCase()) && (
            <button
              onMouseDown={async () => {
                const name = exSearch.trim();
                if (!name) return;
                setExName(name); setExSearch(""); setExSearchFocus(false);
                const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
                try { const { setDoc, doc } = await import("firebase/firestore"); await setDoc(doc(db, "custom_exercises", id), { name, muscle: "", equipment: "Personalizado", machine: false, gifUrl: "", status: "pending", suggestedBy: user?.uid || "anon", suggestedAt: todayStr() }, { merge: true }); } catch(e) { console.error(e); }
                showToast("✅ Ejercicio agregado — el GIF llegará pronto");
              }}
              title="Agregar este ejercicio"
              style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", color: "#000", fontWeight: 800, fontSize: 18, flexShrink: 0, height: 42 }}
            >➕</button>
          )}
        </div>
        {(exSearchFocus || exSearch) && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
            zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}>
            <div style={{ maxHeight: 220, overflowY: "auto" }}>
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
                  <span style={{ flex: 1 }}>{ex.name}</span>
                  <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{ex.muscle}</span>
                </button>
              ))}
            </div>
            {exSearch.trim() && !filteredEx.find(ex => ex.name.toLowerCase() === exSearch.trim().toLowerCase()) && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                Presiona ➕ para agregar <b style={{color:"var(--accent)"}}>"{exSearch.trim()}"</b>
              </div>
            )}
          </div>
        )}
      </div>
    );
  })()}
</div>

{exName ? (
  <div style={{ margin:"10px 0 14px", padding:"16px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:16, display:"flex", flexDirection:"column", gap:12 }}>
    {/* GIF + nombre arriba */}
    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
      <ExerciseGif exName={exName} size={72} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800 }}>{exName}</div>
        {!(customGifsMap[exName] || GIF_MAP[exName]) && (
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>⏳ GIF en camino — el admin lo agregará pronto</div>
        )}
      </div>
      <button onClick={() => { setExName(""); setExSearch(""); }}
        style={{ background:"none", border:"1px solid var(--border)", color:"var(--text-muted)", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>
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
        <input placeholder="0" value={exWeight} onChange={e => setExWeight(numWeight(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Reps</label>
        <input placeholder="0" value={exReps} onChange={e => setExReps(numReps(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Series</label>
        <input placeholder="3" value={exSeriesCount} onChange={e => { const n = parseInt(e.target.value.replace(/[^0-9]/g, "")); setExSeriesCount(isNaN(n) ? "" : String(Math.min(n, 20))); }} className="input" />
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
      <input placeholder="0" value={exWeight} onChange={e => setExWeight(numWeight(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Reps</label>
      <input placeholder="0" value={exReps} onChange={e => setExReps(numReps(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Series</label>
      <input placeholder="3" value={exSeriesCount} onChange={e => { const n = parseInt(e.target.value.replace(/[^0-9]/g, "")); setExSeriesCount(isNaN(n) ? "" : String(Math.min(n, 20))); }} className="input" />
    </div>
  </div>
)}          
            <button className="btn-add-ex" onClick={addExercise}>+ Agregar ejercicio</button>

            {currentExercises.length > 0 && (
              <div className="ex-list" style={{ marginTop: 10 }}>
                {currentExercises.map((ex, exIdx) => {
                  const ssColor = ex.supersetGroup ? getSupersetColor(ex.supersetGroup, currentExercises) : null;
                  const ssGroupIndices = ex.supersetGroup
                    ? currentExercises.map((e, i) => e.supersetGroup === ex.supersetGroup ? i : -1).filter(i => i >= 0)
                    : null;
                  const isFirstInGroup = ssGroupIndices && ssGroupIndices[0] === exIdx;

                  return (
                    <div key={ex.id}>
                      {/* Conector visual entre ejercicios del mismo superset */}
                      {ssGroupIndices && !isFirstInGroup && (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", margin: "-2px 0 2px" }}>
                          <div style={{ width: 2, height: 10, background: ssColor, marginLeft: 21, opacity: 0.7 }} />
                          <div style={{ fontSize: 9, fontWeight: 900, color: ssColor, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.9 }}>
                            + SUPERSET
                          </div>
                        </div>
                      )}

                      <div style={{
                        background: "var(--input-bg)",
                        border: `1px solid ${ssColor ? ssColor + "50" : "var(--border)"}`,
                        borderLeft: ssColor ? `3px solid ${ssColor}` : undefined,
                        borderRadius: 10, marginBottom: 4, overflow: "hidden",
                      }}>
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                          <ExerciseGif exName={ex.name} size={44} />
                          <span style={{ fontWeight: 600, fontSize: 14, flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                            {ex.name}
                            {ssColor && (
                              <span style={{ background: ssColor, color: "#0a0a0a", fontSize: 8, fontWeight: 900, padding: "1px 5px", borderRadius: 3, letterSpacing: 1 }}>SS</span>
                            )}
                          </span>

                          {/* Botones superset */}
                          <div style={{ display: "flex", gap: 4, marginRight: 4 }}>
                            {ssColor ? (
                              <button
                                title="Quitar del superset"
                                onClick={() => removeFromSuperset(ex.id)}
                                style={{ background: "none", border: `1px solid ${ssColor}50`, color: ssColor, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 11, fontWeight: 700 }}
                              >⊖ SS</button>
                            ) : (
                              <>
                                {exIdx > 0 && !currentExercises[exIdx - 1]?.supersetGroup && (
                                  <button
                                    title="Agrupar como superset con el ejercicio anterior"
                                    onClick={() => groupExercisesAsSuperset(exIdx - 1, exIdx)}
                                    style={{ background: "none", border: "1px solid rgba(232,255,0,0.25)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                  >⚡SS↑</button>
                                )}
                                {exIdx > 0 && currentExercises[exIdx - 1]?.supersetGroup && (
                                  <button
                                    title="Unirse al superset del ejercicio anterior"
                                    onClick={() => addToExistingSuperset(currentExercises[exIdx - 1].supersetGroup, ex.id)}
                                    style={{ background: "none", border: `1px solid ${getSupersetColor(currentExercises[exIdx - 1].supersetGroup, currentExercises)}50`, color: getSupersetColor(currentExercises[exIdx - 1].supersetGroup, currentExercises), borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                  > + al SS ↑</button>
                                )}
                                {exIdx < currentExercises.length - 1 && !currentExercises[exIdx + 1]?.supersetGroup && (
                                  <button
                                    title="Agrupar como superset con el ejercicio siguiente"
                                    onClick={() => groupExercisesAsSuperset(exIdx, exIdx + 1)}
                                    style={{ background: "none", border: "1px solid rgba(232,255,0,0.25)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                  >⚡SS↓</button>
                                )}
                                {exIdx < currentExercises.length - 1 && currentExercises[exIdx + 1]?.supersetGroup && (
                                  <button
                                    title="Unirse al superset del ejercicio siguiente"
                                    onClick={() => addToExistingSuperset(currentExercises[exIdx + 1].supersetGroup, ex.id)}
                                    style={{ background: "none", border: `1px solid ${getSupersetColor(currentExercises[exIdx + 1].supersetGroup, currentExercises)}50`, color: getSupersetColor(currentExercises[exIdx + 1].supersetGroup, currentExercises), borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                                  > + al SS ↓</button>
                                )}
                              </>
                            )}
                          </div>

                          <button className="chip-del" style={{ fontSize: 16 }}
                            onClick={() => setCurrentExercises(p => p.filter(e => e.id !== ex.id))}>✕</button>
                        </div>

                        {/* Inputs peso / reps / series */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "8px 12px" }}>
                          <div>
                            <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>PESO (kg)</label>
                            <input className="input" type="number" inputMode="decimal" placeholder="0"
                              value={ex.weight || ex.sets?.[0]?.weight || ""}
                              onChange={e => setCurrentExercises(p => p.map(x => x.id !== ex.id ? x : { ...x, weight: e.target.value }))}
                              style={{ textAlign: "center", fontSize: 14, fontWeight: 700, padding: "6px 4px" }} />
                          </div>
                          <div>
                            <label style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 700, display: "block", marginBottom: 3 }}>REPS</label>
                            <input className="input" type="number" inputMode="decimal" placeholder="0"
                              value={ex.reps || ex.sets?.[0]?.reps || ""}
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
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Botón INICIAR */}
          {currentExercises.length > 0 ? (
            <button
              onClick={() => {
                if (!workout) { showToast("⚠️ Agrega un nombre al entrenamiento"); return; }
                const sinDatos = currentExercises.find(ex =>
                  !(parseFloat(ex.weight) > 0 || parseFloat(ex.reps) > 0 || (ex.sets||[]).some(s => parseFloat(s.weight) > 0 || parseFloat(s.reps) > 0))
                );
                if (sinDatos) { showToast(`⚠️ Completa "${sinDatos.name}": ingresa al menos peso o repeticiones antes de iniciar`); return; }
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
            <button
              onClick={() => showToast("⚠️ Agrega al menos un ejercicio antes de iniciar")}
              style={{
                width: "100%", background: "rgba(232,255,0,0.08)", border: "1px solid rgba(232,255,0,0.2)",
                color: "var(--text-muted)", borderRadius: 10, padding: "18px",
                fontFamily: "Barlow Condensed, sans-serif", fontSize: 18, fontWeight: 700,
                letterSpacing: 2, cursor: "pointer",
              }}
            >
              ⚡ INICIAR ENTRENAMIENTO
            </button>
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
              ⛔ Has alcanzado el límite de 1 sesión.{" "}
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
                onChange={e => setWorkout(e.target.value.slice(0, 25).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s]/g, ""))}
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
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="input"
                max={new Date().toISOString().slice(0, 10)}
                style={{ colorScheme:"dark" }} />
            </div>
            <div className="field">
              <label className="field-label">Notas</label>
              <textarea className="input textarea" placeholder="Cómo te sentiste, PR, observaciones…" value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} />
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
          <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ position: "absolute", left: 12, color: "var(--text-muted)", fontSize: 15, pointerEvents: "none", zIndex: 1 }}>
              {exSearchFocus ? "🔍" : "▾"}
            </span>
            <input
              className="input"
              style={{ paddingLeft: 36, flex: 1, color: exName && !exSearchFocus ? "var(--text)" : undefined, fontWeight: exName && !exSearchFocus ? 600 : 400 }}
              placeholder="— Selecciona o escribe uno nuevo — el GIF llegará pronto ✨"
              value={exSearchFocus ? exSearch : (exName || "")}
              onChange={e => { setExSearch(e.target.value); setExName(""); }}
              onFocus={() => { setExSearchFocus(true); setExSearch(""); }}
              onBlur={() => setTimeout(() => { setExSearchFocus(false); }, 150)}
            />
            {exSearch.trim() && !filteredEx.find(ex => ex.name.toLowerCase() === exSearch.trim().toLowerCase()) && (
              <button
                onMouseDown={async () => {
                  const name = exSearch.trim();
                  if (!name) return;
                  setExName(name); setExSearch(""); setExSearchFocus(false);
                  const id = name.toLowerCase().replace(/[^a-z0-9]/g, "_") + "_" + Date.now();
                  try { const { setDoc, doc } = await import("firebase/firestore"); await setDoc(doc(db, "custom_exercises", id), { name, muscle: "", equipment: "Personalizado", machine: false, gifUrl: "", status: "pending", suggestedBy: user?.uid || "anon", suggestedAt: todayStr() }, { merge: true }); } catch(e) { console.error(e); }
                  showToast("✅ Ejercicio agregado — el GIF llegará pronto");
                }}
                title="Agregar este ejercicio"
                style={{ background: "var(--accent)", border: "none", borderRadius: 8, padding: "0 14px", cursor: "pointer", color: "#000", fontWeight: 800, fontSize: 18, flexShrink: 0, height: 42 }}
              >➕</button>
            )}
          </div>
          {(exSearchFocus || exSearch) && (
            <div style={{
              position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
              background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12,
              zIndex: 50, boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            }}>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
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
                    <span style={{ flex: 1 }}>{ex.name}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}>{ex.muscle}</span>
                  </button>
                ))}
              </div>
              {exSearch.trim() && !filteredEx.find(ex => ex.name.toLowerCase() === exSearch.trim().toLowerCase()) && (
                <div style={{ borderTop: "1px solid var(--border)", padding: "8px 14px", fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>
                  Presiona ➕ para agregar <b style={{color:"var(--accent)"}}>"{exSearch.trim()}"</b>
                </div>
              )}
            </div>
          )}
        </div>
      );
    })()}
  </div>

{exName ? (
  <div style={{ margin:"10px 0 14px", padding:"16px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:16, display:"flex", flexDirection:"column", gap:12 }}>
    <div style={{ display:"flex", gap:12, alignItems:"center" }}>
      <ExerciseGif exName={exName} size={72} />
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:20, fontWeight:800 }}>{exName}</div>
        {!(customGifsMap[exName] || GIF_MAP[exName]) && (
          <div style={{ fontSize:11, color:"var(--text-muted)", marginTop:2 }}>⏳ GIF en camino — el admin lo agregará pronto</div>
        )}
      </div>
      <button onClick={() => { setExName(""); setExSearch(""); }}
        style={{ background:"none", border:"1px solid var(--border)", color:"var(--text-muted)", borderRadius:6, padding:"4px 8px", cursor:"pointer", fontSize:14, flexShrink:0 }}>✕</button>
    </div>
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
      <div className="field">
        <label className="field-label">Peso ({unit})</label>
        <input placeholder="0" value={exWeight} onChange={e => setExWeight(numWeight(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Reps</label>
        <input placeholder="0" value={exReps} onChange={e => setExReps(numReps(e.target.value))} className="input" />
      </div>
      <div className="field">
        <label className="field-label">Series</label>
        <input placeholder="3" value={exSeriesCount} onChange={e => { const n = parseInt(e.target.value.replace(/[^0-9]/g, "")); setExSeriesCount(isNaN(n) ? "" : String(Math.min(n, 20))); }} className="input" />
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
      <input placeholder="0" value={exWeight} onChange={e => setExWeight(numWeight(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Reps</label>
      <input placeholder="0" value={exReps} onChange={e => setExReps(numReps(e.target.value))} className="input" />
    </div>
    <div className="field">
      <label className="field-label">Series</label>
      <input placeholder="3" value={exSeriesCount} onChange={e => { const n = parseInt(e.target.value.replace(/[^0-9]/g, "")); setExSeriesCount(isNaN(n) ? "" : String(Math.min(n, 20))); }} className="input" />
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
      {currentExercises.map((ex, exIdx) => {
        const ssColor = ex.supersetGroup ? getSupersetColor(ex.supersetGroup, currentExercises) : null;
        const ssGroupIndices = ex.supersetGroup
          ? currentExercises.map((e, i) => e.supersetGroup === ex.supersetGroup ? i : -1).filter(i => i >= 0)
          : null;
        const isFirstInGroup = ssGroupIndices && ssGroupIndices[0] === exIdx;
        return (
          <div key={ex.id}>
            {ssGroupIndices && !isFirstInGroup && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 14px", margin: "-2px 0 2px" }}>
                <div style={{ width: 2, height: 10, background: ssColor, marginLeft: 21, opacity: 0.7 }} />
                <div style={{ fontSize: 9, fontWeight: 900, color: ssColor, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.9 }}>+ SUPERSET</div>
              </div>
            )}
            <div style={{
              background: "var(--input-bg)",
              border: `1px solid ${ssColor ? ssColor + "50" : "var(--border)"}`,
              borderLeft: ssColor ? `3px solid ${ssColor}` : undefined,
              borderRadius: 10, marginBottom: 4, padding: "10px 14px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <ExerciseGif exName={ex.name} size={44} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                  {ex.name}
                  {ssColor && (
                    <span style={{ background: ssColor, color: "#0a0a0a", fontSize: 8, fontWeight: 900, padding: "1px 5px", borderRadius: 3, letterSpacing: 1 }}>SS</span>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {ex.sets?.length > 1
                    ? `${ex.sets.length} series · ${ex.sets.map(s => `${s.weight}kg×${s.reps}`).join(", ")}`
                    : `${ex.weight || "—"}kg × ${ex.reps || "—"} reps`}
                </div>
                {ex.notes && <div style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic", display: "flex", alignItems: "flex-start", gap: 4 }}><span style={{ flexShrink: 0 }}>📝</span><span style={{ wordBreak: "break-word", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{ex.notes}</span></div>}
              </div>
              {/* Botones superset en modo register */}
              <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
                {ssColor ? (
                  <button
                    title="Quitar del superset"
                    onClick={() => removeFromSuperset(ex.id)}
                    style={{ background: "none", border: `1px solid ${ssColor}50`, color: ssColor, borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                  >⊖SS</button>
                ) : (
                  <>
                    {exIdx > 0 && !currentExercises[exIdx - 1]?.supersetGroup && (
                      <button
                        title="Agrupar como superset con el ejercicio anterior"
                        onClick={() => groupExercisesAsSuperset(exIdx - 1, exIdx)}
                        style={{ background: "none", border: "1px solid rgba(232,255,0,0.25)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                      >⚡SS↑</button>
                    )}
                    {exIdx > 0 && currentExercises[exIdx - 1]?.supersetGroup && (
                      <button
                        title="Unirse al superset del ejercicio anterior"
                        onClick={() => addToExistingSuperset(currentExercises[exIdx - 1].supersetGroup, ex.id)}
                        style={{ background: "none", border: `1px solid ${getSupersetColor(currentExercises[exIdx - 1].supersetGroup, currentExercises)}50`, color: getSupersetColor(currentExercises[exIdx - 1].supersetGroup, currentExercises), borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                      > + al SS ↑</button>
                    )}
                    {exIdx < currentExercises.length - 1 && !currentExercises[exIdx + 1]?.supersetGroup && (
                      <button
                        title="Agrupar como superset con el ejercicio siguiente"
                        onClick={() => groupExercisesAsSuperset(exIdx, exIdx + 1)}
                        style={{ background: "none", border: "1px solid rgba(232,255,0,0.25)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                      >⚡SS↓</button>
                    )}
                    {exIdx < currentExercises.length - 1 && currentExercises[exIdx + 1]?.supersetGroup && (
                      <button
                        title="Unirse al superset del ejercicio siguiente"
                        onClick={() => addToExistingSuperset(currentExercises[exIdx + 1].supersetGroup, ex.id)}
                        style={{ background: "none", border: `1px solid ${getSupersetColor(currentExercises[exIdx + 1].supersetGroup, currentExercises)}50`, color: getSupersetColor(currentExercises[exIdx + 1].supersetGroup, currentExercises), borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontSize: 10, fontWeight: 700 }}
                      > + al SS ↓</button>
                    )}
                  </>
                )}
              </div>
              <button className="chip-del" style={{ fontSize: 16 }}
                onClick={() => setCurrentExercises(p => p.filter(e => e.id !== ex.id))}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  )}
</div>

          <div style={{ display:"flex", gap:10, marginTop:8 }}>
            {(!canAdd && !editingId && isGuest) ? (
              <div style={{ flex:1, background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.3)", borderRadius:12, padding:"12px 16px", textAlign:"center" }}>
                <div style={{ fontSize:13, fontWeight:700, color:"#ef4444", marginBottom:8 }}>&#x26D4; Límite de {GUEST_MAX} sesiones alcanzado</div>
                <button className="btn-primary" style={{ width:"100%", fontSize:14 }} onClick={() => { setSessionMode(null); logout(true); }}>
                  Crear cuenta gratis para continuar →
                </button>
              </div>
            ) : (
              <button className="btn-primary" style={{ flex:1 }} onClick={() => {
                saveSession();
              }}>
                &#x1F4BE; {editingId ? "Actualizar sesión" : "Guardar sesión"}
              </button>
            )}
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

    {/* ── BANNER LÍMITE FREE ── */}
    {!isPro && !isGuest && (
      <div onClick={() => setShowPaywall(true)} style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(232,255,0,0.05)", border: "1px solid rgba(232,255,0,0.2)",
        borderRadius: 12, padding: "10px 14px", marginBottom: 16, cursor: "pointer",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>📅</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Mostrando último mes</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Hazte Pro para ver todo tu historial</div>
          </div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#e8ff00", fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1 }}>PRO →</span>
      </div>
    )}
    {(() => {
      const { y, m } = calMonth;
      const firstDay = new Date(y, m, 1).getDay(); // 0=Dom
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const startOffset = (firstDay + 6) % 7; // lunes=0
      const today = todayStr();
      const trainedDates = new Set(sessions.map(s => s.date));
      const monthName = new Date(y, m, 1).toLocaleString("es", { month: "long", year: "numeric" });
      const cells = [];
      for (let i = 0; i < startOffset; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) cells.push(d);

      return (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: "16px", marginBottom: 20 }}>
          {/* Header mes */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={() => setCalMonth(({ y, m }) => m === 0 ? { y: y-1, m: 11 } : { y, m: m-1 })}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: "0 8px" }}>‹</button>
            <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 15, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "var(--text)" }}>
              {monthName}
            </span>
            <button onClick={() => setCalMonth(({ y, m }) => m === 11 ? { y: y+1, m: 0 } : { y, m: m+1 })}
              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18, padding: "0 8px" }}>›</button>
          </div>
          {/* Días semana */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3, marginBottom: 4 }}>
            {["L","M","X","J","V","S","D"].map(d => (
              <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", padding: "2px 0" }}>{d}</div>
            ))}
          </div>
          {/* Celdas */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const dateStr = `${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
              const trained = trainedDates.has(dateStr);
              const isToday = dateStr === today;
              const isSelected = calSelectedDate === dateStr;
              const sessCount = sessions.filter(s => s.date === dateStr).length;
              return (
                <button key={dateStr} onClick={() => setCalSelectedDate(isSelected ? null : dateStr)}
                  title={trained ? `${sessCount} sesión${sessCount>1?"es":""}` : ""}
                  style={{
                    aspectRatio: "1", borderRadius: 8, border: isSelected ? "2px solid var(--accent)" : isToday ? "2px solid rgba(232,255,0,0.4)" : "1px solid transparent",
                    background: isSelected ? "var(--accent)" : trained ? "rgba(232,255,0,0.15)" : "transparent",
                    color: isSelected ? "#0a0a0a" : isToday ? "var(--accent)" : trained ? "var(--text)" : "var(--text-muted)",
                    fontWeight: trained || isToday ? 800 : 400,
                    fontSize: 12, cursor: trained ? "pointer" : "default",
                    display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 1,
                    transition: "all 0.15s",
                    opacity: trained || isToday ? 1 : 0.4,
                  }}>
                  {d}
                  {trained && <div style={{ width: isSelected ? 4 : 3, height: isSelected ? 4 : 3, borderRadius: "50%", background: isSelected ? "#0a0a0a" : "var(--accent)", flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
          {/* Tag selección */}
          {calSelectedDate && (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>
                📅 {new Date(calSelectedDate + "T00:00:00").toLocaleDateString("es", { weekday:"long", day:"numeric", month:"long" })} — {filtered.length} sesión{filtered.length !== 1 ? "es" : ""}
              </span>
              <button onClick={() => setCalSelectedDate(null)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕ Limpiar</button>
            </div>
          )}
        </div>
      );
    })()}

    {/* ── FILTROS MOBILE-FIRST ── */}
    {(() => {
      const musculos = [...new Set(sessions.flatMap(s =>
        (s.exercises||[]).map(ex => EXERCISE_DB.find(e => e.name === ex.name)?.muscle).filter(Boolean)
      ))];
      const rutinaMap = new Map();
      sessions.map(s => s.workout).filter(Boolean).forEach(w => {
        const key = w.trim().toLowerCase();
        if (!rutinaMap.has(key)) {
          // Store capitalize version
          rutinaMap.set(key, w.trim().split(" ").map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(" "));
        }
      });
      const rutinas = [...rutinaMap.values()].sort();
      const hasActive = !!(filterWorkout || filterMuscle || filterPeriod || filterOrder === "asc" || filterPR);
      const activeCount = [filterWorkout, filterMuscle, filterPeriod, filterOrder === "asc" ? "asc" : "", filterPR ? "pr" : ""].filter(Boolean).length;
      return (
        <div style={{ marginBottom: 12 }}>
          {/* Barra superior: búsqueda + botón filtros */}
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input className="input" style={{ flex: 1, fontSize: 14 }}
              placeholder="🔍  Buscar rutina o ejercicio..."
              value={filterWorkout}
              onChange={e => setFilterWorkout(e.target.value)} />
            <button onClick={() => setHistFiltersOpen(o => !o)} style={{
              background: hasActive ? "var(--accent)" : "var(--card)",
              border: `1px solid ${hasActive ? "var(--accent)" : "var(--border)"}`,
              color: hasActive ? "#0a0a0a" : "var(--text)",
              borderRadius: 10, padding: "0 14px", cursor: "pointer",
              fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", gap: 6,
              whiteSpace: "nowrap", flexShrink: 0,
            }}>
              ⚙️ Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          </div>

          {/* Panel colapsable */}
          {histFiltersOpen && (
            <div style={{
              background: "var(--card)", border: "1px solid var(--border)",
              borderRadius: 14, padding: "14px 14px 10px", marginBottom: 8,
            }}>
              {/* Ordenar */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 7 }}>Ordenar</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[["desc","↓ Más reciente"],["asc","↑ Más antiguo"]].map(([v,l]) => (
                    <button key={v} onClick={() => setFilterOrder(v)} style={{
                      flex: 1, padding: "7px 0", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: filterOrder === v ? "var(--accent)" : "var(--input-bg)",
                      border: `1px solid ${filterOrder === v ? "var(--accent)" : "var(--border)"}`,
                      color: filterOrder === v ? "#0a0a0a" : "var(--text-muted)",
                    }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Solo con PRs */}
              <div style={{ marginBottom: 12 }}>
                <button onClick={() => setFilterPR(p => !p)} style={{
                  width: "100%", padding: "8px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                  background: filterPR ? "rgba(251,191,36,0.15)" : "var(--input-bg)",
                  border: `1px solid ${filterPR ? "#f59e0b" : "var(--border)"}`,
                  color: filterPR ? "#f59e0b" : "var(--text-muted)",
                  display: "flex", alignItems: "center", gap: 8,
                }}>
                  🏆 Solo sesiones con PR {filterPR && "✓"}
                </button>
              </div>

              {/* Período */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 7 }}>Período</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["","Todo"],["7","7 días"],["30","30 días"],["90","3 meses"],["365","Este año"]].map(([v,l]) => (
                    <button key={v} onClick={() => setFilterPeriod(v)} style={{
                      padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: filterPeriod === v ? "var(--accent)" : "var(--input-bg)",
                      border: `1px solid ${filterPeriod === v ? "var(--accent)" : "var(--border)"}`,
                      color: filterPeriod === v ? "#0a0a0a" : "var(--text-muted)",
                    }}>{l}</button>
                  ))}
                </div>
              </div>

              {/* Músculo */}
              {musculos.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 7 }}>Músculo</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["", ...musculos].map(m => (
                      <button key={m} onClick={() => setFilterMuscle(m)} style={{
                        padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                        background: filterMuscle === m ? "var(--accent)" : "var(--input-bg)",
                        border: `1px solid ${filterMuscle === m ? "var(--accent)" : "var(--border)"}`,
                        color: filterMuscle === m ? "#0a0a0a" : "var(--text-muted)",
                      }}>{m || "Todos"}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Rutina */}
              {rutinas.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 7 }}>Rutina</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {["", ...rutinas].map(r => (
                      <button key={r} onClick={() => setFilterWorkout(r)} style={{
                        padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700,
                        background: filterWorkout === r ? "var(--accent)" : "var(--input-bg)",
                        border: `1px solid ${filterWorkout === r ? "var(--accent)" : "var(--border)"}`,
                        color: filterWorkout === r ? "#0a0a0a" : "var(--text-muted)",
                      }}>{r || "Todas"}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer: resultados + borrar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
                <span style={{ fontSize: 12, color: "var(--accent)", fontWeight: 700 }}>{filtered.length} sesión{filtered.length !== 1 ? "es" : ""}</span>
                {hasActive && (
                  <button className="link-btn" style={{ fontSize: 12 }}
                    onClick={() => { setFilterWorkout(""); setFilterMuscle(""); setFilterPeriod(""); setFilterOrder("desc"); setFilterPR(false); }}>
                    ✕ Borrar filtros
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Chips de filtros activos */}
          {hasActive && !histFiltersOpen && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 4 }}>
              {filterPeriod && <span style={{ background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                📅 {filterPeriod === "7" ? "7 días" : filterPeriod === "30" ? "30 días" : filterPeriod === "90" ? "3 meses" : "Este año"}
              </span>}
              {filterMuscle && <span style={{ background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>💪 {filterMuscle}</span>}
              {filterOrder === "asc" && <span style={{ background: "var(--accent-dim)", color: "var(--accent)", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>↑ Más antiguo</span>}
              {filterPR && <span style={{ background: "rgba(251,191,36,0.15)", color: "#f59e0b", borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>🏆 Con PR</span>}
              <span style={{ fontSize: 11, color: "var(--text-muted)", alignSelf: "center" }}>{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      );
    })()}

    {/* ── LISTA + PAGINACIÓN ── */}
    <div style={{ flex: 1, minWidth: 0 }}>

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
                onRenameAll={(oldName, newName) => {
                  setSessions(prev => prev.map(x => x.workout?.toLowerCase() === oldName.toLowerCase() ? { ...x, workout: newName } : x));
                  showToast(`✅ "${oldName}" → "${newName}" en todas las sesiones`);
                }}
              />
            ))}

            {/* Paginación */}
            {Math.ceil(filtered.length / 10) > 1 && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 8, marginTop: 16, padding: "14px 0",
                borderTop: "1px solid var(--border)",
                flexWrap: "wrap",
              }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginRight: 4 }}>
                  {histPage * 10 + 1}–{Math.min((histPage + 1) * 10, filtered.length)} de {filtered.length}
                </span>
                {[
                  { icon: "⏮", action: () => setHistPage(0), disabled: histPage === 0 },
                  { icon: "◀", action: () => setHistPage(p => p - 1), disabled: histPage === 0 },
                  { icon: "▶", action: () => setHistPage(p => p + 1), disabled: histPage >= Math.ceil(filtered.length / 10) - 1 },
                  { icon: "⏭", action: () => setHistPage(Math.ceil(filtered.length / 10) - 1), disabled: histPage >= Math.ceil(filtered.length / 10) - 1 },
                ].map(btn => (
                  <button key={btn.icon} onClick={btn.action} disabled={btn.disabled}
                    style={{
                      background: btn.disabled ? "transparent" : "var(--input-bg)",
                      border: "1px solid var(--border)",
                      color: btn.disabled ? "var(--border)" : "var(--accent)",
                      borderRadius: 10, width: 42, height: 42,
                      cursor: btn.disabled ? "default" : "pointer",
                      fontSize: 16,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      WebkitTapHighlightColor: "transparent",
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
)}

        {/* Dashboard */}
<div className="content-area" style={{ display: activeTab === "dashboard" ? "block" : "none" }}>

  <Dashboard sessions={sessions} bodyStats={bodyStats} weeklyGoal={weeklyGoal} onGoalClick={(target) => target === "history" ? setActiveTab("history") : openPlanner("goal")} onBadgesClick={() => openBadgesModal()}
    newBadgesCount={newBadgesCount}
    onInsightsClick={() => setShowInsights(true)}
    onStatsProClick={() => isPro ? setShowStatsPro(true) : setShowPaywall(true)}
    onStatsUnlockedClick={() => setShowStatsPro(true)}
    isPro={isPro}
    user={user}
    coachRoutines={coachRoutines}
    onOpenCoach={() => setShowAthleteCoach(true)}
    onStartCoachRoutine={(routine) => { setAthleteCoachInitialRoutine(routine); setShowAthleteCoach(true); }}
    showCompletedBanner={showCompletedBanner}
    onOpenStreak={() => setShowStreakModal(true)}
    onStartSession={(muscle, suggestedExercises) => {
      setExMuscle(muscle);
      setActiveTab("new");
      setSessionMode("live");
      // Nombre automático capitalizado
      const name = muscle.charAt(0).toUpperCase() + muscle.slice(1).toLowerCase();
      setWorkout(name);
      // Precargar ejercicios sugeridos
      if (suggestedExercises && suggestedExercises.length > 0) {
        setCurrentExercises(suggestedExercises.map(ex => ({
          id: uid(), name: ex.name, muscle: ex.muscle,
          sets: [{ id: uid(), weight: "", reps: "" }],
          weight: "", reps: "", notes: "",
        })));
      }
    }}
    onMuscleMapClick={() => setShowMuscleMap(true)}
    onRegisterSession={() => {
      setActiveTab("new");
      setSessionMode("log");
    }}
    onGoHome={() => setActiveTab("new")}
    />
</div>
      </main>

      {/* ── MODALES GLOBALES ── */}
      {showPlanner && (
        isGuest ? (
          <div className="overlay" onClick={() => setShowPlanner(false)}>
            <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">📅 Planificador</h3>
                <button className="close-btn" onClick={() => setShowPlanner(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowPlanner(false)} feature="el planificador" />
            </div>
          </div>
        ) : (
        <WeeklyPlannerModal
          plan={weeklyPlan}
          sessions={sessions}
          onSave={p => setWeeklyPlan(p)}
          onClose={() => setShowPlanner(false)}
          weeklyGoal={weeklyGoal}
          onSaveGoal={g => setWeeklyGoal(g)}
          initTab={plannerInitTab}
        />
        )
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
        isGuest ? (
          <div className="overlay" onClick={() => setShowTemplates(false)}>
            <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">📄 Plantillas</h3>
                <button className="close-btn" onClick={() => setShowTemplates(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowTemplates(false)} feature="las plantillas de entrenamiento" />
            </div>
          </div>
        ) : (
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
        )
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
        user.isGuest ? (
          <div className="overlay" onClick={() => setShowChallenge(false)}>
            <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">🏆 Reto Semanal</h3>
                <button className="close-btn" onClick={() => setShowChallenge(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowChallenge(false)} feature="los retos semanales" />
            </div>
          </div>
        ) : (
          <TeamChallengeModal
            user={user}
            sessions={sessions}
            onClose={() => setShowChallenge(false)}
            onChallengeComplete={() => {
              if (addShield("weekly-challenge")) {
                showToast("🛡️ ¡Escudo ganado por completar el reto semanal!");
              }
            }}
          />
        )
      )}
      {showBodyStats && (
        user.isGuest ? (
          <div className="overlay" onClick={() => setShowBodyStats(false)}>
            <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">⚖️ Peso & Estatura IA</h3>
                <button className="close-btn" onClick={() => setShowBodyStats(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowBodyStats(false)} feature="el seguimiento de peso y estatura" />
            </div>
          </div>
        ) : (
          <BodyStatsModal stats={bodyStats} uid={user.uid} isGuest={false} isPro={isPro} onSave={s => setBodyStats(s)} onClose={() => setShowBodyStats(false)} sessions={sessions} userName={user.name} />
        )
      )}
      {showPhotoProgress && (
        <div className="overlay" onClick={() => setShowPhotoProgress(false)}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
            <div className="modal-header">
              <h3 className="modal-title">📸 Análisis IA</h3>
              <button className="close-btn" onClick={() => setShowPhotoProgress(false)}>✕</button>
            </div>
            <PhotoProgressModal
              uid={user.uid} isPro={isPro} onClose={() => setShowPhotoProgress(false)}
              userName={user.name}
              userStats={{
                totalSessions: sessions?.length || 0,
                streak: getStreak(sessions),
                topExercises: Object.entries(getPRs(sessions)).sort((a, b) => b[1].rm - a[1].rm).slice(0, 3).map(([name, data]) => ({ name, rm: data.rm })),
              }}
            />
          </div>
        </div>
      )}
      {showAdminExercises && user.isAdmin && (
        <Suspense fallback={null}>
          <AdminExercisesModal
              onClose={() => setShowAdminExercises(false)}
              user={user}
              setGif={(name, url) => setCustomGifsMap(p => ({ ...p, [name]: url }))}
            />
        </Suspense>
      )}
      {showAthleteCoach && (
        user.isGuest ? (
          <div className="overlay" onClick={() => setShowAthleteCoach(false)}>
            <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">🤖 Mi Coach</h3>
                <button className="close-btn" onClick={() => setShowAthleteCoach(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowAthleteCoach(false)} feature="Mi Coach y las rutinas personalizadas" />
            </div>
          </div>
        ) : (
          <AthleteCoachPanel
            user={user}
            sessions={sessions}
            initialRoutine={athleteCoachInitialRoutine}
            ExerciseGif={ExerciseGif}
            onClose={() => { setShowAthleteCoach(false); setAthleteCoachInitialRoutine(null); loadCoachRoutines(); }}
            onSessionSaved={(newSession) => setSessions(prev => [newSession, ...prev])}
          />
        )
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
                ExerciseGif={ExerciseGif}
                onActivated={() => updateUser({ isCoach: true, plan: "coach" })}
              />
            </EmailVerifyWall>
          </div>
        </div>
      )}
      {showBadges && (
        isGuest ? (
          <div className="overlay" onClick={() => setShowBadges(false)}>
            <div className="modal" style={{ maxWidth:420 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">🏅 Logros</h3>
                <button className="close-btn" onClick={() => setShowBadges(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowBadges(false)} feature="los logros y medallas" />
            </div>
          </div>
        ) : (
          <BadgesModal
            sessions={sessions}
            bodyStats={bodyStats}
            user={user}
            extras={badgeExtras}
            onClose={() => setShowBadges(false)}
          />
        )
      )}
      {showMuscleMap && (
        <Suspense fallback={null}>
          <MuscleMapModal
            sessions={sessions}
            onClose={() => setShowMuscleMap(false)}
          />
        </Suspense>
      )}
      {showStreakModal && (
        <Suspense fallback={null}>
          <StreakModal
            sessions={sessions}
            user={user}
            weeklyTarget={weeklyGoal?.target || 3}
            onStartSession={() => {
              setShowStreakModal(false);
              setExMuscle("Todos");
              setActiveTab("new");
              setSessionMode("live");
              setWorkout("Entrenamiento");
            }}
            onClose={() => setShowStreakModal(false)}
          />
        </Suspense>
      )}
      {showProfile && (
        <UserProfileModal
          user={user}
          sessions={sessions}
          bodyStats={bodyStats}
          onOpenBodyStats={() => { setShowProfile(false); setShowBodyStats(true); }}
          onOpenTutorial={() => { setShowProfile(false); setShowOnboarding(true); }}
          onClose={() => setShowProfile(false)}
          onPhotoUpdate={(url) => updateUser({ photoURL: url })}
        />
      )}
      {showProgressPicker && (() => {
        if (isGuest) return (
          <div className="overlay" onClick={() => setShowProgressPicker(false)}>
            <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">📈 Progreso</h3>
                <button className="close-btn" onClick={() => setShowProgressPicker(false)}>✕</button>
              </div>
              <GuestWall onClose={() => setShowProgressPicker(false)} feature="el progreso y estadísticas" />
            </div>
          </div>
        );
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
                {[["records","🏆 Récords"],["actividad","📅 Actividad"],["ejercicio","💪 Por ejercicio"]].map(([k,l]) => (
                  <button key={k} onClick={() => setPickerMuscle(k === "actividad" ? "__actividad__" : k === "records" ? "__records__" : activeMuscle)}
                    style={{ flex:1, padding:"7px 0", borderRadius:8, border:"none", background: (k==="actividad"?pickerMuscle==="__actividad__":k==="records"?pickerMuscle==="__records__":pickerMuscle!=="__actividad__"&&pickerMuscle!=="__records__") ? "var(--accent)" : "transparent", color: (k==="actividad"?pickerMuscle==="__actividad__":k==="records"?pickerMuscle==="__records__":pickerMuscle!=="__actividad__"&&pickerMuscle!=="__records__") ? "#0a0a0a" : "var(--text-muted)", fontWeight:700, fontSize:12, cursor:"pointer", transition:"all 0.2s" }}>{l}</button>
                ))}
              </div>

              {pickerMuscle === "__records__" ? (() => {
                // Calcular top PRs por ejercicio
                const allPRs = {};
                sessions.forEach(s => {
                  (s.exercises||[]).forEach(ex => {
                    const w = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.weight)||0)) : parseFloat(ex.weight)||0;
                    const r = ex.sets?.length > 0 ? Math.max(...ex.sets.map(st => parseFloat(st.reps)||0)) : parseFloat(ex.reps)||0;
                    const rm = calc1RM(w, r);
                    if (!allPRs[ex.name] || rm > allPRs[ex.name].rm) {
                      allPRs[ex.name] = { rm, weight: w, reps: r, date: s.date, muscle: EXERCISE_DB.find(e => e.name === ex.name)?.muscle || "Otros" };
                    }
                  });
                });
                const sorted = Object.entries(allPRs).sort((a,b) => b[1].rm - a[1].rm);
                if (sorted.length === 0) return <p style={{ fontSize:13, color:"var(--text-muted)", textAlign:"center", padding:"20px 0" }}>Sin récords aún. ¡A entrenar!</p>;
                // Group by muscle
                const byMuscle = {};
                sorted.forEach(([name, data]) => {
                  if (!byMuscle[data.muscle]) byMuscle[data.muscle] = [];
                  byMuscle[data.muscle].push([name, data]);
                });
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:16, maxHeight:400, overflowY:"auto" }}>
                    {Object.entries(byMuscle).map(([muscle, entries]) => (
                      <div key={muscle}>
                        <div style={{ fontSize:10, fontWeight:800, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>{muscle}</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                          {entries.map(([name, data], i) => (
                            <div key={name} style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:10 }}>
                              <div style={{ width:22, height:22, borderRadius:"50%", background: i===0?"rgba(251,191,36,0.2)":i===1?"rgba(156,163,175,0.2)":i===2?"rgba(180,119,0,0.15)":"var(--card)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, color: i===0?"#f59e0b":i===1?"#9ca3af":i===2?"#b47700":"var(--text-muted)", flexShrink:0 }}>
                                {i===0?"🥇":i===1?"🥈":i===2?"🥉":i+1}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:13, fontWeight:700, color:"var(--text)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{name}</div>
                                <div style={{ fontSize:11, color:"var(--text-muted)" }}>{data.date}</div>
                              </div>
                              <div style={{ textAlign:"right", flexShrink:0 }}>
                                <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:18, fontWeight:900, color:"var(--accent)", lineHeight:1 }}>{data.weight}kg</div>
                                <div style={{ fontSize:10, color:"var(--text-muted)" }}>1RM ~{data.rm}kg</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })() : pickerMuscle === "__actividad__" ? (
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
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}

      {/* Modal de suscripción vencida */}
      {showPaywallAfterExpiry && (
        <div
          onClick={() => setShowPaywallAfterExpiry(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.88)",
            backdropFilter: "blur(6px)",
            zIndex: 99999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 340,
              background: "#111",
              border: "1px solid rgba(232,255,0,0.2)",
              borderRadius: 20, padding: "32px 24px",
              textAlign: "center",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
            <div style={{
              fontFamily: "'Barlow Condensed',sans-serif",
              fontSize: 26, fontWeight: 900,
              color: "#e8ff00", letterSpacing: 2, marginBottom: 8,
            }}>
              TU PLAN VENCIÓ
            </div>
            <div style={{
              color: "rgba(255,255,255,0.5)", fontSize: 13,
              marginBottom: 28, lineHeight: 1.6,
            }}>
              Tu suscripción expiró y volviste al plan Free.<br />¿Quieres renovarla para seguir sin límites?
            </div>
            <button
              onClick={() => { setShowPaywallAfterExpiry(false); setShowPaywall(true); }}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 12,
                background: "#e8ff00", color: "#000",
                fontWeight: 900, fontSize: 16, border: "none",
                cursor: "pointer",
                fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1,
                marginBottom: 8,
              }}
            >
              ⚡ VER PLANES
            </button>
            <button
              onClick={() => setShowPaywallAfterExpiry(false)}
              style={{
                width: "100%", padding: "10px 0", borderRadius: 12,
                background: "transparent", border: "none",
                color: "rgba(255,255,255,0.25)",
                cursor: "pointer", fontSize: 12,
              }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL INFO PLAN PRO ── */}
      {showPlanInfo && (
        <div style={{ position:"fixed", inset:0, zIndex:99999, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(6px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}
          onClick={() => setShowPlanInfo(false)}>
          <div style={{ width:"100%", maxWidth:340, background:"#111", border:"1px solid rgba(232,255,0,0.25)", borderRadius:20, padding:"28px 24px", boxShadow:"0 20px 60px rgba(0,0,0,0.6)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:"center", marginBottom:20 }}>
              <div style={{ fontSize:40, marginBottom:8 }}>⚡</div>
              <div style={{ fontFamily:"Barlow Condensed,sans-serif", fontSize:26, fontWeight:900, color:"#e8ff00", letterSpacing:2 }}>
                PLAN {user.plan.toUpperCase()}
              </div>
              <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:4 }}>
                {user.email}
              </div>
            </div>
            <div style={{ background:"rgba(232,255,0,0.05)", border:"1px solid rgba(232,255,0,0.15)", borderRadius:12, padding:"14px 16px", marginBottom:20 }}>
              {[
                user.plan === "pro" && { icon:"📊", text:"Estadísticas avanzadas" },
                user.plan === "pro" && { icon:"🚫", text:"Sin anuncios" },
                user.plan === "pro" && { icon:"🎨", text:"PR Cards personalizables" },
                user.plan === "pro" && { icon:"🤖", text:"Coach IA" },
                (user.plan === "coach" || user.plan === "gym") && { icon:"⚡", text:"Todo lo incluido en Pro" },
                (user.plan === "coach" || user.plan === "gym") && { icon:"👥", text:"Panel de coach" },
                (user.plan === "coach" || user.plan === "gym") && { icon:"📋", text:"Asignación de rutinas" },
                user.plan === "gym" && { icon:"🏢", text:"Multi-coach y dashboard gym" },
              ].filter(Boolean).map((f, i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid rgba(255,255,255,0.05)", fontSize:13, color:"rgba(255,255,255,0.8)" }}>
                  <span>{f.icon}</span><span>{f.text}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setShowPlanInfo(false); setShowPaywall(true); }}
              style={{ width:"100%", padding:"13px 0", borderRadius:12, background:"#e8ff00", border:"none", fontFamily:"Barlow Condensed,sans-serif", fontSize:15, fontWeight:900, letterSpacing:2, color:"#0a0a0a", cursor:"pointer", marginBottom:10 }}
            >
              ⚡ VER PLANES
            </button>
            <button
              onClick={() => setShowPlanInfo(false)}
              style={{ width:"100%", padding:"11px 0", borderRadius:12, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", fontFamily:"Barlow Condensed,sans-serif", fontSize:14, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.4)", cursor:"pointer" }}
            >
              CERRAR
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL LÍMITE INVITADO ── */}
      {guestLimitModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 24px",
        }} onClick={() => setGuestLimitModal(null)}>
          <div style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "32px 24px",
            maxWidth: 340, width: "100%",
            textAlign: "center",
            animation: "loginSlideIn 0.25s ease",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💪</div>
            <div style={{
              fontFamily: "Barlow Condensed, sans-serif",
              fontSize: 22, fontWeight: 900,
              letterSpacing: 1, marginBottom: 10,
            }}>¿Seguimos entrenando?</div>
            <div style={{
              fontSize: 13, color: "var(--text-muted)",
              lineHeight: 1.6, marginBottom: 24,
            }}>
              Crea una cuenta gratis y guarda todo tu progreso, historial y PRs sin límites.
            </div>
            <button
              onClick={() => { setGuestLimitModal(null); logout(true); }}
              style={{
                width: "100%", padding: "14px 0",
                background: "#e8ff00", border: "none", borderRadius: 8,
                fontFamily: "Barlow Condensed, sans-serif",
                fontSize: 16, fontWeight: 900, letterSpacing: 2,
                color: "#0a0a0a", cursor: "pointer", marginBottom: 10,
                textTransform: "uppercase",
              }}
            >
              ⚡ Crear cuenta gratis
            </button>
            <button
              onClick={() => setGuestLimitModal(null)}
              style={{
                width: "100%", padding: "12px 0",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontFamily: "Barlow, sans-serif",
                fontSize: 13, fontWeight: 600,
                color: "var(--text-muted)", cursor: "pointer",
              }}
            >
              Ahora no
            </button>
          </div>
        </div>
      )}

      {/* ── COACH IA FLOTANTE DRAGGABLE ── */}
      {!liveActive && <DraggableAIButton onOpen={() => setShowAIChat(true)} avatar={<BruxAvatar size={36} />} />}
      {showAIChat && (
        <AIChatModal
          onClose={() => setShowAIChat(false)}
          sessions={sessions}
          bodyStats={bodyStats}
          user={user}
          isPro={isPro}
          onUseRoutine={(routine) => {
            const exs = routine.exercises.map(ex => ({
              id: uid(),
              name: ex.name,
              weight: String(ex.weight || ""),
              reps: String(ex.reps || ""),
              sets: Array.from({ length: Math.max(1, parseInt(ex.sets) || 3) }, () => ({
                id: uid(),
                weight: String(ex.weight || ""),
                reps: String(ex.reps || ""),
              })),
            }));
            setWorkout(routine.name);
            setDate(todayStr());
            setCurrentExercises(exs);
            setActiveTab("new");
            setSessionMode("live");
            setLiveActive(true);
            setShowAIChat(false);
          }}
          onSaveRoutine={(routine) => {
            const current = load("gym_templates", []) || [];
            if (current.some(t => t.name === routine.name)) {
              showToast(`⚠️ Ya existe una plantilla llamada "${routine.name}"`);
              return;
            }
            const newTemplate = {
              id: uid(),
              name: routine.name,
              workout: routine.name,
              exercises: routine.exercises.map(ex => ({
                id: uid(),
                name: ex.name,
                weight: String(ex.weight || ""),
                reps: String(ex.reps || ""),
                series: String(ex.sets || 3),
                sets: [],
              })),
              createdAt: todayStr(),
            };
            store("gym_templates", [...current, newTemplate]);
            showToast(`📋 "${routine.name}" guardada en plantillas`);
          }}
          onSaveToPlan={(routine, day) => {
            const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
            const idx = DAYS.indexOf(day);
            if (idx === -1) return;
            const exercises = (routine.exercises || []).map(ex => ({
              id: uid(),
              name: ex.name,
              weight: String(ex.weight || ""),
              reps: String(ex.reps || ""),
              series: String(ex.sets || 3),
              sets: [],
            }));
            setWeeklyPlan(prev => ({
              ...prev,
              mode: "weekly",
              weekly: { ...prev.weekly, [idx]: { name: routine.name, exercises } },
            }));
            showToast(`📅 "${routine.name}" guardada en ${day}`);
          }}
        />
      )}
      {showStatsPro && (
        <StatsProModal sessions={visibleSessions} bodyStats={bodyStats} user={user} customGifs={customGifsMap} isPro={isPro}
          onClose={() => setShowStatsPro(false)}
          onPickExercise={(cb) => setStatsProExPickerCb(() => cb)}
        />
      )}
      {statsProExPickerCb && (
        <ExerciseLibrary
          onSelect={(name) => { statsProExPickerCb(name); setStatsProExPickerCb(null); }}
          onClose={() => setStatsProExPickerCb(null)}
        />
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
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 36, marginBottom: 6 }}>⚡</div>
                  <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" }}>
                    ¿QUÉ VAS A ENTRENAR HOY?
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Dale un nombre o elige una plantilla</div>
                </div>
                <button onClick={() => setShowNameModal(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 20, cursor: "pointer", padding: "0 0 0 8px", lineHeight: 1, flexShrink: 0 }}>✕</button>
              </div>

              {/* Free name input + arrow button */}
              <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                <input
                  className="input"
                  placeholder="Push Day, Piernas, Full Body…"
                  value={workout}
                  onChange={e => {
                    const raw = e.target.value.slice(0, 25).replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ0-9 ]/g, "");
                    const capitalized = raw.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                    setWorkout(capitalized);
                  }}
                  onKeyDown={e => { if (e.key === "Enter" && workout.trim()) { setShowNameModal(false); setSessionMode("live"); } }}
                  style={{ flex: 1, fontSize: 16, fontWeight: 700, fontFamily: "'Barlow', sans-serif", padding: "13px 16px", boxSizing: "border-box", textTransform: "none", WebkitTextTransform: "none" }}
                />
                <button
                  disabled={!workout.trim()}
                  onClick={() => { setShowNameModal(false); setSessionMode("live"); }}
                  style={{ background: workout.trim() ? "var(--accent)" : "var(--input-bg)", border: "none", borderRadius: 4, padding: "0 18px", fontSize: 22, cursor: workout.trim() ? "pointer" : "not-allowed", color: workout.trim() ? "#0a0a0a" : "var(--text-muted)", flexShrink: 0, transition: "all 0.2s" }}
                >→</button>
              </div>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
                <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: "var(--text-muted)", textTransform: "uppercase" }}>o elige una plantilla</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }}/>
              </div>

              {/* Template cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                {templateOptions.slice(0, 6).map(tpl => (
                  <div key={tpl.name} style={{ display: "flex", gap: 6, alignItems: "stretch" }}>
                    <button
                      onClick={() => {
                        const name = tpl.name.trim().split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
                        setWorkout(name);
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
                        flex: 1, background: "var(--input-bg)", border: "1px solid var(--border)",
                        borderRadius: 8, padding: "12px 14px", cursor: "pointer",
                        textAlign: "left", transition: "all 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-dim)"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--input-bg)"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <span style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 16, fontWeight: 900, letterSpacing: 1, textTransform: "uppercase", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>
                          {tpl.isUser ? "📋 " : "⚡ "}{tpl.name}
                        </span>
                        <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
                          {tpl.isUser ? "MÍA" : "PRESET"} →
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
                        {tpl.exercises.slice(0, 4).join(" · ")}{tpl.exercises.length > 4 ? ` +${tpl.exercises.length - 4} más` : ""}
                      </div>
                    </button>
                    {tpl.isUser && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const updated = load("gym_templates", []).filter(t => t.name !== tpl.name);
                          store("gym_templates", updated);
                          setShowNameModal(false);
                          setTimeout(() => setShowNameModal(true), 50);
                        }}
                        style={{
                          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
                          borderRadius: 8, padding: "0 12px", cursor: "pointer",
                          color: "#ef4444", fontSize: 16, flexShrink: 0,
                        }}
                        title="Eliminar plantilla"
                      >🗑️</button>
                    )}
                  </div>
                ))}
              </div>


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
          user={user}
          onDone={() => setPrConfetti(null)}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
      {badgeToast && (
        <div
          onClick={() => { setBadgeToast(null); openBadgesModal(); }}
          style={{
            position:"fixed", bottom:90, left:"50%", transform:"translateX(-50%)",
            background:"linear-gradient(135deg,#1a1a1a,#2a2a2a)",
            border:"2px solid #f59e0b",
            borderRadius:16, padding:"14px 20px",
            display:"flex", alignItems:"center", gap:14,
            boxShadow:"0 8px 32px rgba(245,158,11,0.35)",
            zIndex:99999, cursor:"pointer", minWidth:260, maxWidth:340,
            animation:"badgeSlideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          <div style={{
            fontSize:42, lineHeight:1,
            filter:"drop-shadow(0 0 12px rgba(245,158,11,0.6))",
            animation:"badgePop 0.5s 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
          }}>{badgeToast.icon}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:10, fontWeight:800, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase", marginBottom:3 }}>
              🏅 ¡Logro desbloqueado!
            </div>
            <div style={{ fontSize:16, fontWeight:900, color:"#fff", fontFamily:"Barlow Condensed, sans-serif", letterSpacing:1 }}>
              {badgeToast.name}
            </div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.55)", marginTop:2 }}>{badgeToast.desc}</div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); setBadgeToast(null); }}
            style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)", fontSize:16, cursor:"pointer", padding:"0 0 0 4px", lineHeight:1 }}
          >✕</button>
        </div>
      )}
      <style>{`
        @keyframes badgeSlideUp {
          from { opacity:0; transform:translateX(-50%) translateY(24px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0); }
        }
        @keyframes badgePop {
          from { transform:scale(0.5) rotate(-15deg); opacity:0; }
          to   { transform:scale(1) rotate(0deg); opacity:1; }
        }
        @keyframes pulse {
          0%,100% { transform:scale(1); box-shadow:0 0 0 2px var(--bg),0 0 0 4px rgba(239,68,68,0.3); }
          50%      { transform:scale(1.15); box-shadow:0 0 0 2px var(--bg),0 0 0 6px rgba(239,68,68,0.15); }
        }
      `}</style>

      {/* ConfirmModal — reemplaza window.confirm (bloqueante en Android) */}
      {confirmModal.open && (
        <div onClick={closeConfirm} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:24 }}>
          <div onClick={e => e.stopPropagation()} style={{ background:"#141414", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"28px 24px", maxWidth:340, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}>
            <p style={{ margin:"0 0 24px", fontSize:15, color:"#f0f0f0", lineHeight:1.5, textAlign:"center", fontFamily:"'Barlow', sans-serif" }}>{confirmModal.message}</p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={closeConfirm} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.35)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Barlow', sans-serif" }}>Cancelar</button>
              <button onClick={() => { confirmModal.onConfirm?.(); closeConfirm(); }} style={{ flex:1, padding:"11px 0", borderRadius:10, border:"none", background:"#e8ff00", color:"#0a0a0a", fontSize:14, fontWeight:900, cursor:"pointer", fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:1 }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      </div>
    </CustomGifCtx.Provider>
)}