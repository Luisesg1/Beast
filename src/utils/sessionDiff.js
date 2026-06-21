// ─── sessionDiff.js ───────────────────────────────────────────────────────────
// Lógica pura (sin Firebase) del diff incremental para la migración de sesiones a
// subcolección (Etapa 4-A). Aislada aquí para poder testearla sin inicializar
// Firebase.

export function hashSession(s) {
  return JSON.stringify(s);
}

// Construye un snapshot id → hash de las sesiones con id.
export function buildSnapshot(sessions) {
  const m = new Map();
  for (const s of sessions || []) {
    if (s && s.id != null) m.set(String(s.id), hashSession(s));
  }
  return m;
}

// Compara el snapshot previo con las sesiones actuales y devuelve qué escribir
// (`sets`: altas y ediciones) y qué borrar (`deletes`: ids ya no presentes).
export function diffSessions(prevSnapshot, sessions) {
  const nextIds = new Set();
  const sets = [];
  const deletes = [];

  for (const s of sessions || []) {
    if (!s || s.id == null) continue;
    const id = String(s.id);
    nextIds.add(id);
    if (prevSnapshot.get(id) !== hashSession(s)) sets.push(s);
  }
  for (const id of prevSnapshot.keys()) {
    if (!nextIds.has(id)) deletes.push(id);
  }
  return { sets, deletes };
}
