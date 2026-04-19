// ─── Shared Exercise Database ─────────────────────────────────────────────────
// Single source of truth for EXERCISE_DB and MUSCLES.
// Import this in both App.jsx and CoachModal.jsx instead of defining them locally.

export let EXERCISE_DB = [
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

  // ── Antebrazo ──────────────────────────────────────────────────────────────
  { name: "Curl de Muñeca", muscle: "Antebrazo", machine: false, equipment: "Barra" },
  { name: "Curl de Muñeca Invertido", muscle: "Antebrazo", machine: false, equipment: "Barra" },
  { name: "Agarre Barra", muscle: "Antebrazo", machine: false, equipment: "Barra" },
  { name: "Farmer Carry", muscle: "Antebrazo", machine: false, equipment: "Mancuernas" },
  { name: "Extensión de Muñeca", muscle: "Antebrazo", machine: false, equipment: "Mancuernas" },

  // ── Trapecios ──────────────────────────────────────────────────────────────
  { name: "Encogimientos Barra", muscle: "Trapecios", machine: false, equipment: "Barra" },
  { name: "Encogimientos Mancuernas", muscle: "Trapecios", machine: false, equipment: "Mancuernas" },
  { name: "Remo al Mentón", muscle: "Trapecios", machine: false, equipment: "Barra" },
  { name: "Encogimientos Máquina", muscle: "Trapecios", machine: true, equipment: "Máquina" },
  { name: "Encogimientos Polea", muscle: "Trapecios", machine: true, equipment: "Polea" },

  // ── Aductores ──────────────────────────────────────────────────────────────
  { name: "Aductores Máquina", muscle: "Aductores", machine: true, equipment: "Máquina" },
  { name: "Sentadilla Sumo", muscle: "Aductores", machine: false, equipment: "Barra" },
  { name: "Sentadilla Sumo Mancuerna", muscle: "Aductores", machine: false, equipment: "Mancuernas" },
  { name: "Zancada Lateral", muscle: "Aductores", machine: false, equipment: "Cuerpo" },

  // ── Tibial ─────────────────────────────────────────────────────────────────
  { name: "Dorsiflexión", muscle: "Tibial", machine: false, equipment: "Cuerpo" },
  { name: "Elevación de Punta de Pies", muscle: "Tibial", machine: false, equipment: "Cuerpo" },
  { name: "Tibial Máquina", muscle: "Tibial", machine: true, equipment: "Máquina" },

  // ── Cuello ─────────────────────────────────────────────────────────────────
  { name: "Extensión de Cuello", muscle: "Cuello", machine: false, equipment: "Cuerpo" },
  { name: "Flexión de Cuello", muscle: "Cuello", machine: false, equipment: "Cuerpo" },
  { name: "Rotación de Cuello", muscle: "Cuello", machine: false, equipment: "Cuerpo" },
];

export let MUSCLES = [...new Set(EXERCISE_DB.map(e => e.muscle))];

/**
 * Registra un ejercicio personalizado en el array global compartido.
 * Ambos archivos deben usar esta función en lugar de mutar EXERCISE_DB directamente.
 */
export function registerCustomExercise(name, muscle) {
  if (EXERCISE_DB.find(e => e.name === name)) return;
  EXERCISE_DB.push({ name, muscle, machine: false, equipment: "Personalizado" });
  if (!MUSCLES.includes(muscle)) MUSCLES = [...MUSCLES, muscle];
}