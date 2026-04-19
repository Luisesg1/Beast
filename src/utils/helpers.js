// ─── Helpers generales ────────────────────────────────────────────────────────

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const fmtDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};

export const lettersOnly = (v) => v.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, "");

export const workoutInput = (v) => lettersOnly(v).replace(/\b\w/g, c => c.toUpperCase());

// ─── Validación numérica ──────────────────────────────────────────────────────

export const numDot = (v, max = 9999) => {
  const s = v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
  const n = parseFloat(s);
  if (isNaN(n) || n < 0) return "";
  return n > max ? String(max) : s;
};

export const numWeight = (v) => numDot(v, 500);  // peso ejercicio: clamp en 500 kg
export const numReps   = (v) => numDot(v, 100);  // reps: clamp en 100

// Peso/estatura/edad corporal: SIN clamp automático — solo limpiar chars, la UI valida y muestra error
export const numBodyW  = (v) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
export const numHeight = (v) => v.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
export const numAge    = (v) => v.replace(/[^0-9]/g, "");

// ─── LocalStorage ─────────────────────────────────────────────────────────────

export const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const load  = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };

// ─── Firebase errores ─────────────────────────────────────────────────────────

export function firebaseErrMsg(code) {
  const map = {
    "auth/email-already-in-use":   "Este email ya está registrado",
    "auth/invalid-email":          "Email inválido",
    "auth/weak-password":          "Contraseña muy débil (mínimo 6 caracteres)",
    "auth/user-not-found":         "Email o contraseña incorrectos",
    "auth/wrong-password":         "Email o contraseña incorrectos",
    "auth/invalid-credential":     "Email o contraseña incorrectos",
    "auth/too-many-requests":      "Demasiados intentos. Resetea tu contraseña.",
    "auth/network-request-failed": "Sin conexión a internet",
  };
  return map[code] || "Ocurrió un error. Intenta de nuevo.";
}