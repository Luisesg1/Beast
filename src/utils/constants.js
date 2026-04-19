export const DAYS_ES = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const ACCENT_COLORS = [
  { name: "Azul",    value: "#3b82f6", dim: "#1a2f52" },
  { name: "Verde",   value: "#22c55e", dim: "#14532d" },
  { name: "Morado",  value: "#8b5cf6", dim: "#2e1065" },
  { name: "Rosa",    value: "#ec4899", dim: "#500724" },
  { name: "Naranja", value: "#f97316", dim: "#431407" },
  { name: "Rojo",    value: "#ef4444", dim: "#450a0a" },
  { name: "Cyan",    value: "#06b6d4", dim: "#083344" },
];

export const PRESETS = {
  "Push Day":  ["Press Banca", "Press Hombro", "Fondos", "Tríceps Polea", "Elevaciones Laterales"],
  "Pull Day":  ["Dominadas", "Remo con Barra", "Curl Bíceps", "Face Pull", "Pullover"],
  "Leg Day":   ["Sentadilla", "Peso Muerto", "Prensa de Pierna", "Extensión Cuádriceps", "Curl Femoral"],
  "Full Body": ["Sentadilla", "Press Banca", "Dominadas", "Peso Muerto Rumano", "Press Hombro"],
};

export const MUSCLE_GROUPS = {
  "Pecho":        { fill: "#3b82f6", paths: ["M 120 110 Q 140 100 155 115 Q 145 135 125 140 Q 108 130 110 115 Z", "M 180 110 Q 160 100 145 115 Q 155 135 175 140 Q 192 130 190 115 Z"] },
  "Hombros":      { fill: "#8b5cf6", paths: ["M 105 100 Q 95 90 100 80 Q 115 75 120 90 Q 115 100 108 103 Z", "M 195 100 Q 205 90 200 80 Q 185 75 180 90 Q 185 100 192 103 Z"] },
  "Bíceps":       { fill: "#ec4899", paths: ["M 95 115 Q 85 125 86 140 Q 96 145 104 135 Q 108 120 100 112 Z", "M 205 115 Q 215 125 214 140 Q 204 145 196 135 Q 192 120 200 112 Z"] },
  "Tríceps":      { fill: "#f97316", paths: ["M 92 115 Q 80 125 82 142 Q 90 150 96 140 Q 98 125 96 113 Z", "M 208 115 Q 220 125 218 142 Q 210 150 204 140 Q 202 125 204 113 Z"] },
  "Espalda":      { fill: "#10b981", paths: ["M 115 110 Q 150 105 185 110 Q 185 145 150 155 Q 115 145 115 110 Z"] },
  "Core":         { fill: "#f59e0b", paths: ["M 128 150 Q 150 147 172 150 Q 172 175 150 178 Q 128 175 128 150 Z"] },
  "Cuádriceps":   { fill: "#06b6d4", paths: ["M 120 190 Q 112 200 114 225 Q 130 230 136 215 Q 138 198 128 190 Z", "M 180 190 Q 188 200 186 225 Q 170 230 164 215 Q 162 198 172 190 Z"] },
  "Femoral":      { fill: "#84cc16", paths: ["M 118 190 Q 108 205 112 228 Q 122 235 128 220 Q 130 205 122 192 Z", "M 182 190 Q 192 205 188 228 Q 178 235 172 220 Q 170 205 178 192 Z"] },
  "Glúteos":      { fill: "#a855f7", paths: ["M 125 178 Q 150 172 175 178 Q 178 195 150 198 Q 122 195 125 178 Z"] },
  "Pantorrillas": { fill: "#14b8a6", paths: ["M 116 240 Q 110 255 114 268 Q 124 270 128 258 Q 130 244 120 240 Z", "M 184 240 Q 190 255 186 268 Q 176 270 172 258 Q 170 244 180 240 Z"] },
  "Cardio":       { fill: "#ef4444", paths: ["M 140 108 Q 150 100 160 108 Q 162 120 150 128 Q 138 120 140 108 Z"] },
};