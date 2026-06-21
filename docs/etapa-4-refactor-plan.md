# Etapa 4 — Plan de refactor estructural

Estado: **parcialmente completa.** Las partes seguras están hechas y verificadas;
las partes de alto riesgo están planeadas aquí para hacerse con validación manual.

## Hecho (seguro, verificado con tests + build)

- **(C) Unificación de cálculos duplicados** — `components/utils.js` ahora reexporta
  desde `utils/gymCalcs.js`. Elimina la causa de que los bugs reaparecieran.
- **(B paso 1) Extracción de helpers puros** — `fmtDateLong`, `getSupersetGroups`,
  `getSupersetColor`, `SS_COLORS` salieron de `GymApp.jsx` a `utils/helpers.js` y
  `utils/supersets.js`.

## Pendiente (alto riesgo — requiere validación manual, NO hacer a ciegas)

### (A) Migrar sessions a subcolección

**Por qué no es urgente:** el sistema de archivo de la Etapa 0
(`sessions/{uid}/archive/{chunk_n}`) ya evita la pérdida de datos por el límite de
1MB. La migración es una mejora de escalabilidad/consultas, no una urgencia.

**Riesgo:** toca datos de producción. Un error puede dejar a usuarios sin acceso a
su historial. Debe hacerse con el usuario presente para validar.

**Plan sugerido (expand/contract, sin downtime):**
1. **Expand:** cambiar `loadSessions` para leer de AMBOS modelos (documento actual
   `sessions/{uid}.list[]` + nueva subcolección `users/{uid}/sessions/{id}`),
   combinando y deduplicando por id. Escribir cada sesión nueva en la subcolección.
2. **Backfill:** Cloud Function que recorre usuarios y copia su `list[]` a la
   subcolección en lotes (`writeBatch`, máx 500 por lote). Idempotente (por id).
3. **Reglas:** añadir `match /users/{uid}/sessions/{sessionId}` (dueño + coach lee).
4. **Contract:** cuando el backfill esté verificado, dejar de escribir el documento
   viejo y eliminar el array. Actualizar los lectores (`CoachModal`,
   `AthleteCoachPanel`, `AdminExercisesModal`) que hoy leen `sessions/{uid}`.
5. **Tests:** ampliar `scripts/test-rules.mjs` para la nueva subcolección.

**Esfuerzo:** ~2-3 días con validación. Hacerlo por sub-pasos, cada uno desplegado
y verificado antes del siguiente.

### (B) Romper el God Component GymApp.jsx (~3500 líneas, 100+ useState)

**Riesgo:** la lógica con estado está entrelazada; un error no lo detectan build ni
tests, solo pruebas manuales de cada feature.

**Plan sugerido (incremental, un dominio por PR, probando en cada paso):**
1. `useWorkoutSession` — estado y lógica de la sesión en curso (currentExercises,
   saveSession, superseries, live draft).
2. `useProgress` — sesiones, PRs, racha, volumen, insights.
3. `useCoachData` — rutinas asignadas, vínculo coach/atleta.
4. `useTeams` — equipos y rankings.
5. `useBodyStats` — peso, medidas, objetivos.
6. Extraer secciones de UI grandes a componentes (NuevaSesion, Historial, ya hay
   Dashboard) que consuman esos hooks.

**Regla de oro:** un hook por commit, probar manualmente la feature afectada antes
de seguir. No hacer una reescritura masiva de una sola vez.

### (C resto) Unificar getStreak

`gymCalcs.getStreak` y `components/utils.getStreak` tienen comportamiento distinto
(el de gymCalcs no rompe la racha si la semana en curso no está completa). Unificar
requiere decidir cuál es el correcto y verificar el número mostrado en la UI de
StreakModal y AdminExercisesModal.
