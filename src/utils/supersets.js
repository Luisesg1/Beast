// ─── Superseries ──────────────────────────────────────────────────────────────
// Helpers puros para agrupar y colorear ejercicios en superserie.
// Extraído de GymApp.jsx (Etapa 4) — sin estado, fácil de testear y reutilizar.

export const SS_COLORS = ["#a78bfa", "#38bdf8", "#fb923c", "#34d399", "#f472b6"];

// Agrupa los índices de ejercicios que comparten supersetGroup.
export function getSupersetGroups(exercises) {
  const groups = {};
  exercises.forEach((ex, i) => {
    if (ex.supersetGroup) {
      if (!groups[ex.supersetGroup]) groups[ex.supersetGroup] = [];
      groups[ex.supersetGroup].push(i);
    }
  });
  return Object.entries(groups).map(([groupId, indices]) => ({ groupId, indices }));
}

// Color estable para una superserie según su orden de aparición.
export function getSupersetColor(groupId, exercises) {
  const groups = getSupersetGroups(exercises);
  const idx = groups.findIndex(g => g.groupId === groupId);
  return idx >= 0 ? SS_COLORS[idx % SS_COLORS.length] : SS_COLORS[0];
}
