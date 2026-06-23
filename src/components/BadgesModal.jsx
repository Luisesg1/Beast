import { useState, useEffect } from "react";
import { getPRs } from "../utils/gymCalcs";
import { EXERCISE_DB } from "../exerciseDb";
import { calcSessionVolume, getStreak } from "../utils/gymCalcs";

const SEEN_KEY = "gym_badges_seen";

function getSeenBadges() {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); } catch { return new Set(); }
}
function markBadgesSeen(ids) {
  try {
    const seen = getSeenBadges();
    ids.forEach(id => seen.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {}
}

// ─── Badge definitions ────────────────────────────────────────────────────────
const BADGE_DETAILS = {
  first:        "Todo comienza con un primer paso. El día que entraste por primera vez y lo registraste, tomaste la decisión más importante: empezar. Muchos hablan de ponerse en forma, tú lo hiciste.",
  sessions5:    "Cinco sesiones no suenan a mucho, pero ya eres parte del grupo que convierte las intenciones en acciones. La mayoría abandona antes de llegar aquí. Tú no.",
  pr1:          "Superaste tu propio récord. No el de alguien más, el tuyo. Eso es lo que importa: competir contigo mismo y ganar. Cada PR es prueba de que el trabajo está dando frutos.",
  variety10:    "Diez ejercicios distintos significa que estás explorando, aprendiendo y construyendo una base sólida. Un atleta completo no se hace en una sola máquina.",
  streak3:      "Tres semanas consecutivas cumpliendo tu meta. Ya no es motivación, es hábito. Y los hábitos son los que construyen el físico que quieres tener.",
  sunday:       "Entrenar un domingo dice mucho de ti. Mientras otros descansan del descanso, tú decidiste invertir en ti mismo. Ese extra marca la diferencia a largo plazo.",
  holiday:      "Ni el calendario te detiene. Entrenar en días festivos es la definición de no tener excusas. Ese compromiso es el que separa a los que llegan de los que se quedan a mitad de camino.",
  minimalist:   "Tres ejercicios, cero relleno. Cuando sabes lo que haces, no necesitas cantidad para conseguir calidad. La eficiencia también es una habilidad.",
  ai_first:     "Le preguntaste al Coach IA por primera vez. El que busca respuestas ya lleva ventaja sobre el que entrena a ciegas. La curiosidad es el primer músculo que hay que entrenar.",
  team_first:   "Te uniste a un equipo. El entrenamiento en solitario tiene su valor, pero la energía del grupo multiplica todo. Bienvenido a algo más grande que tú solo.",
  coach_first:  "Completaste tu primera rutina asignada por un coach. Seguir un plan diseñado para ti es un nivel diferente de entrenamiento. Tu cuerpo ya lo está notando.",
  photo_first:  "Subiste tu primera foto de progreso. Hace falta valentía para documentar el proceso desde el principio. Ese punto de partida que registraste hoy será tu mayor motivación en el futuro.",
  sessions10:   "Diez sesiones completadas. Ya pasaste la fase en que la mayoría abandona. Tu cuerpo empieza a adaptarse, tu mente empieza a creer. Sigue.",
  sessions25:   "Veinticinco sesiones. Ya no eres principiante, eres alguien que entrena. La diferencia está en la consistencia, y tú la tienes.",
  sessions50:   "Cincuenta sesiones. Medio centenar de veces que elegiste el gimnasio sobre la comodidad. Los cambios en tu cuerpo no mienten: este nivel de dedicación tiene recompensa.",
  pr5:          "Cinco récords personales en distintos ejercicios. No fue suerte ni un buen día: fue progresión real. Tu cuerpo es más fuerte de lo que era, y los números lo confirman.",
  streak7:      "Siete semanas seguidas cumpliendo tu meta de entrenamiento. Eso son casi dos meses de constancia pura. Lo que empezó como esfuerzo se está convirtiendo en identidad.",
  heavy:        "Más de 100kg en un ejercicio. Llegaste al territorio donde el peso ya respeta. Esa barra no se mueve sola, se mueve con meses de trabajo acumulado.",
  streak14:     "Catorce semanas consecutivas. Tres meses y medio sin romper la racha. Eso es voluntad de acero. Muy pocos llegan a esto, y tú ya estás aquí.",
  beast5in7:    "Cinco sesiones en siete días. Una semana de modo bestia absoluto. Tu recuperación, tu disciplina y tu motivación en su punto máximo. Así se construyen los físicos de élite.",
  variety25:    "Veinticinco ejercicios distintos dominados. Tu repertorio técnico es el de alguien que entiende el entrenamiento de verdad. Esa variedad también protege tu cuerpo.",
  volume_ses:   "Diez mil kilos movidos en una sola sesión. Eso no es entrenar, eso es devastar. El volumen de trabajo que puedes manejar en un día es impresionante.",
  ai_5:         "Cinco consultas al Coach IA. Cada pregunta que haces es una decisión de no quedarte con la duda. Quien pregunta aprende, quien aprende progresa más rápido.",
  team_reto:    "Participaste en tu primer reto de equipo. La competencia sana saca lo mejor de todos. Cuando hay algo en juego, cada rep cuenta el doble.",
  coach_3:      "Tres rutinas de coach completadas. Ya tienes un ritmo, ya sabes cómo funciona el sistema. Ahora solo es cuestión de seguir apretando.",
  photo_3:      "Tres fotos de progreso registradas. Estás construyendo un archivo visual de tu transformación. Dentro de un tiempo, comparar la primera con la última foto va a ser tu mayor motivación.",
  sessions100:  "Cien sesiones. No es un número, es un estilo de vida. El gimnasio ya no es algo que haces: es parte de lo que eres. Muy pocos llegan a este punto, y tú lo cruzaste.",
  pr10:         "Récords personales en diez ejercicios distintos. Tu fuerza no creció en un área, creció en toda la cancha. Eso es desarrollo atlético real, no solo volumen de brazo.",
  streak30:     "Treinta semanas seguidas cumpliendo tu meta. Más de siete meses sin romper la racha. Eso no se logra con motivación: se logra con identidad. El gimnasio ya es parte de ti.",
  leg20:        "Veinte sesiones de pierna. Muchos las evitan, tú las abrazaste. Las piernas son la base de todo, y la tuya es sólida. Respeto.",
  chest20:      "Veinte sesiones de pecho. Le dedicaste tiempo real a este grupo muscular y los resultados están ahí. El press que hacías en tu primera sesión y el de hoy no tienen nada que ver.",
  back20:       "Veinte sesiones de espalda. La espalda da el ancho, da la postura, da la autoridad. Invertir en ella es una de las decisiones más inteligentes que puedes tomar en el gimnasio.",
  core15:       "Quince sesiones con trabajo de core. El núcleo es lo que conecta todo: fuerza, estabilidad, rendimiento. Tener un core fuerte hace que cada otro ejercicio sea mejor.",
  balanced:     "Todos los grupos musculares en una semana. No hay descuido, no hay músculo olvidado. Un físico equilibrado es el que aguanta más, se lesiona menos y luce mejor.",
  variety50:    "Cincuenta ejercicios distintos registrados. Eso es una educación completa en movimiento humano. Tu repertorio técnico es el de alguien que sabe lo que hace con su cuerpo.",
  "90days":     "Noventa días de actividad. Tres meses en que el gimnasio estuvo presente en tu vida. A estas alturas, los cambios no solo son físicos: son mentales, son de actitud.",
  vol_100k:     "Cien mil kilos acumulados en total. Una tonelada no, cien toneladas. Eso es el peso que has movido con tus propias manos. El cuerpo que tienes hoy lo construiste kilo a kilo.",
  perfect_mo:   "Veinte o más días entrenando en un mismo mes. Eso es casi no parar. Cuando la intensidad y la constancia se juntan así, el progreso no es opcional.",
  sessions200:  "Doscientas sesiones. Doscientas veces que dijiste sí cuando podías haber dicho no. Tu historial habla por ti mejor que cualquier foto: constancia real, duradera, sin trucos.",
  streak90:     "Noventa semanas consecutivas cumpliendo tu meta. Más de dos años sin romper la racha. Eso no es disciplina, eso es carácter. Eres una inspiración para cualquiera que te rodea.",
  "180days":    "Ciento ochenta días de actividad acumulada. Medio año en que el entrenamiento fue una constante. A estas alturas tu cuerpo tiene una memoria muscular que no desaparece fácilmente.",
  leg100:       "Cien sesiones de pierna. Eres un especialista. Las piernas que tienes ahora son el resultado de cientos de sentadillas, prensas y zancadas que la mayoría ni intentó. Impresionante.",
  sessions500:  "Quinientas sesiones. Medio millar de entrenamientos. Estás en el territorio donde los resultados se miden en años, no en semanas. Tu compromiso con este proceso es fuera de lo común.",
  "6months":    "Seis meses consecutivos con 12 o más sesiones cada uno. Eso es regularidad de atleta profesional. No cualquiera mantiene ese ritmo; tú lo hiciste durante medio año.",
  architect:    "Más de 50 sesiones de pecho, espalda y pierna cada uno. Construiste un físico de manera proporcional y consciente. Eso no pasa por accidente: es planificación y ejecución perfecta.",
  reinvention:  "Volviste después de una pausa larga y completaste 30 sesiones. Eso requiere más fuerza mental que no haber parado nunca. Reinventarse es el logro más humano y más difícil de todos.",
  year_iron:    "Doce meses distintos con sesiones registradas. Un año completo con el gimnasio presente. Sin importar el clima, el trabajo o la vida, encontraste la manera. Eso es dedicación real.",
  pr20:         "Récords personales en veinte ejercicios distintos. Tu fuerza creció en todos los frentes. No hay músculo que no hayas desafiado y superado. Eso es un atleta completo.",
  ai_50:        "Cincuenta consultas al Coach IA. Llevas meses usando la herramienta más potente del gimnasio: la información. Cada pregunta que hiciste fue una ventaja sobre quien entrena sin saber.",
  team_alma:    "Más de diez sesiones siendo parte de un equipo. Eres el tipo de miembro que eleva al grupo. Tu presencia constante inspira a los demás a no fallar. Eres el motor.",
  coach_15:     "Quince rutinas de coach completadas. Ya no sigues el plan, eres el plan. Tu coach diseñó las sesiones pensando en ti, y tú respondiste con trabajo real semana tras semana.",
  photo_mes:    "Diez fotos de progreso subidas. Tienes un archivo visual de tu transformación que vale más que cualquier báscula. Tu evolución está documentada, y es real.",
  sessions1000: "Mil sesiones. Esto no es atletismo, esto es filosofía de vida. Has elegido el gimnasio mil veces. Tu disciplina es de otro planeta. Eres, literalmente, una leyenda.",
  streak365:    "365 semanas seguidas cumpliendo tu meta. Siete años de constancia sin romper la racha. No existe palabra que describa este nivel de compromiso. Eres único.",
  year_full:    "Un año entero sin pausas mayores a dos semanas. Trescientos sesenta y cinco días en que el entrenamiento fue irrompible. Tu cuerpo y tu mente son el resultado de esa decisión diaria.",
  "5years":     "Cinco años activo. No es una racha, es una vida. El gimnasio lleva cinco años siendo parte de quien eres. Los físicos que duran se construyen así: despacio, sin atajos, con convicción.",
  "10years":    "Diez años de registro. Una década. En ese tiempo el mundo cambió, tú cambiaste, pero el compromiso con tu cuerpo nunca lo hizo. Eso es legado.",
  icon10k:      "Diez mil sesiones. No existe nada más que decir. Eres un fenómeno.",
  vol_1m:       "Un millón de kilos acumulados. Eso es lo que has movido con tus propias manos a lo largo de tu carrera. Ningún número refleja mejor lo que eres: una máquina.",
  iron_gen:     "Tres años entrenando tres o más veces por semana sin parar. Eso no se improvisa, se construye. Tu cuerpo es el resultado de una disciplina sostenida que muy pocos en el mundo alcanzan.",
  ai_legend:    "Cien consultas al Coach IA. Has convertido la tecnología en una ventaja real. El conocimiento que acumulaste a través de esas preguntas está en cada rep que haces.",
  team_legend:  "Más de cincuenta sesiones siendo parte de un equipo. Eres la leyenda del squad. Cuando los demás piensan en consistencia, piensan en ti. Tu impacto va más allá de tus propios resultados.",
  coach_50:     "Cincuenta rutinas de coach completadas. Medio centenar de sesiones diseñadas para ti y ejecutadas al cien por cien. Tu coach sabe que contigo no hay que preocuparse: siempre apareces.",
  photo_legend: "Veinte fotos de progreso. Tienes la transformación más documentada de la app. Tu historia visual va a inspirar a otras personas a empezar. Eso es más que un logro: es un legado.",
};


export const BADGE_DEFS = [
  // ⭐ NIVEL 1 — Bronce
  { id: "first",       stars: 1, icon: "🏋️", name: "Primera sesión",      desc: "Completaste tu primera sesión",                    check: (s) => s.length >= 1 },
  { id: "sessions5",   stars: 1, icon: "🔥", name: "En racha",             desc: "5 sesiones completadas",                           check: (s) => s.length >= 5 },
  { id: "pr1",         stars: 1, icon: "⭐", name: "Primer PR",            desc: "Superaste un récord personal",                     check: (s, prs) => Object.keys(prs).length >= 1 },
  { id: "variety10",   stars: 1, icon: "🎯", name: "Explorador",           desc: "10 ejercicios distintos registrados",               check: (s) => new Set(s.flatMap(x => (x.exercises||[]).map(e=>e.name))).size >= 10 },
  { id: "streak3",     stars: 1, icon: "🔑", name: "3 semanas seguidas",   desc: "Cumpliste tu meta 3 semanas consecutivas",          check: (s) => getStreak(s) >= 3 },
  { id: "sunday",      stars: 1, icon: "☀️", name: "Dominguero",           desc: "Entrenaste un domingo",                            check: (s) => s.some(x => new Date(x.date+"T00:00:00").getDay() === 0) },
  { id: "holiday",     stars: 1, icon: "🎉", name: "Sin excusas",          desc: "Entrenaste en día 1 de enero o 25 dic",            check: (s) => s.some(x => { const d=new Date(x.date+"T00:00:00"); return (d.getMonth()===0&&d.getDate()===1)||(d.getMonth()===11&&d.getDate()===25); }) },
  { id: "minimalist",  stars: 1, icon: "🔬", name: "Minimalista",          desc: "Sesión completa con solo 3 ejercicios",            check: (s) => s.some(x => (x.exercises||[]).length === 3) },
  // IA
  { id: "ai_first",    stars: 1, icon: "🤖", name: "Hola, Coach IA",       desc: "Habla por primera vez con tu entrenador virtual",   check: (s, prs, u, ex) => (ex?.aiUses||0) >= 1 },
  // Teams
  { id: "team_first",  stars: 1, icon: "🏘️", name: "Primer equipo",        desc: "Únete a tu primer equipo. ¡Juntos se llega más lejos!", check: (s, prs, u) => !!u?.teamId },
  // Coach
  { id: "coach_first", stars: 1, icon: "📋", name: "Primera victoria",     desc: "Completa tu primera rutina asignada por un coach", check: (s) => s.some(x => !!x.coachRoutineDocId) },
  // Foto
  { id: "photo_first", stars: 1, icon: "📸", name: "Sin miedo a la cámara", desc: "Sube tu primera foto de progreso. ¡El cambio comienza hoy!", check: (s, prs, u, ex) => (ex?.photoCount||0) >= 1 },

  // ⭐⭐ NIVEL 2 — Plata
  { id: "sessions10",  stars: 2, icon: "💪", name: "Dedicado",             desc: "10 sesiones completadas",                          check: (s) => s.length >= 10 },
  { id: "sessions25",  stars: 2, icon: "🦾", name: "Consistente",          desc: "25 sesiones completadas",                          check: (s) => s.length >= 25 },
  { id: "sessions50",  stars: 2, icon: "🏅", name: "Veterano",             desc: "50 sesiones completadas",                          check: (s) => s.length >= 50 },
  { id: "pr5",         stars: 2, icon: "🌟", name: "Máquina de PRs",       desc: "5 PRs en ejercicios distintos",                    check: (s, prs) => Object.keys(prs).length >= 5 },
  { id: "streak7",     stars: 2, icon: "🗓️", name: "2 meses seguidos",     desc: "Cumpliste tu meta 7 semanas consecutivas",          check: (s) => getStreak(s) >= 7 },
  { id: "heavy",       stars: 2, icon: "🏗️", name: "Pesado",              desc: "Registraste 100kg+ en un ejercicio",               check: (s) => s.some(x => (x.exercises||[]).some(e => parseFloat(e.weight)>=100 || (e.sets||[]).some(st=>parseFloat(st.weight)>=100))) },
  { id: "streak14",    stars: 2, icon: "🔥", name: "En llamas",            desc: "Cumpliste tu meta 14 semanas consecutivas",         check: (s) => getStreak(s) >= 14 },
  { id: "beast5in7",   stars: 2, icon: "⚡", name: "Modo bestia",          desc: "5 sesiones en 7 días",                             check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); return s.filter(x=>new Date(x.date+"T00:00:00")>=w).length>=5; } },
  { id: "variety25",   stars: 2, icon: "🧭", name: "Variado",              desc: "25 ejercicios distintos registrados",               check: (s) => new Set(s.flatMap(x=>(x.exercises||[]).map(e=>e.name))).size>=25 },
  { id: "volume_ses",  stars: 2, icon: "💥", name: "Volumen serio",        desc: "10.000 kg movidos en una sesión",                  check: (s) => s.some(x=>calcSessionVolume(x)>=10000) },
  // IA
  { id: "ai_5",        stars: 2, icon: "🤖", name: "Preguntón fitness",    desc: "5 preguntas al Coach IA. La curiosidad también quema calorías 😉", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 5 },
  // Teams
  { id: "team_reto",   stars: 2, icon: "⚔️", name: "Espíritu competitivo", desc: "Participa en tu primer reto. ¡Que empiece el juego! 🔥", check: (s, prs, u) => !!u?.teamId },
  // Coach
  { id: "coach_3",     stars: 2, icon: "💪", name: "En marcha",            desc: "Completa 3 rutinas asignadas por tu coach",        check: (s) => s.filter(x=>!!x.coachRoutineDocId).length >= 3 },
  // Foto
  { id: "photo_3",     stars: 2, icon: "📷", name: "Registro activo",      desc: "Sube 3 fotos de progreso. ¡Documentando tu evolución!", check: (s, prs, u, ex) => (ex?.photoCount||0) >= 3 },

  // ⭐⭐⭐ NIVEL 3 — Oro
  { id: "sessions100", stars: 3, icon: "💯", name: "Leyenda",              desc: "100 sesiones completadas",                         check: (s) => s.length >= 100 },
  { id: "pr10",        stars: 3, icon: "🏆", name: "Rompe récords",        desc: "PR en 10 ejercicios distintos",                    check: (s, prs) => Object.keys(prs).length >= 10 },
  { id: "streak30",    stars: 3, icon: "🔥", name: "Disciplina total",     desc: "Cumpliste tu meta 30 semanas consecutivas",         check: (s) => getStreak(s) >= 30 },
  { id: "leg20",       stars: 3, icon: "🦵", name: "Piernas de acero",     desc: "20 sesiones de pierna",                            check: (s) => s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral","Glúteos","Pantorrillas"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length>=20 },
  { id: "chest20",     stars: 3, icon: "💪", name: "Rey del press",        desc: "20 sesiones de pecho",                             check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Pecho")).length>=20 },
  { id: "back20",      stars: 3, icon: "🏋️", name: "Espalda ancha",       desc: "20 sesiones de espalda",                           check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Espalda")).length>=20 },
  { id: "core15",      stars: 3, icon: "🪨", name: "Core de piedra",       desc: "15 sesiones con trabajo abdominal",                check: (s) => s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Core")).length>=15 },
  { id: "balanced",    stars: 3, icon: "⚖️", name: "Equilibrado",         desc: "Todos los grupos musculares en 1 semana",          check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); const ms=new Set(s.filter(x=>new Date(x.date+"T00:00:00")>=w).flatMap(x=>(x.exercises||[]).map(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle)).filter(Boolean)); return ["Pecho","Espalda","Cuádriceps","Core","Hombros"].every(m=>ms.has(m)); } },
  { id: "variety50",   stars: 3, icon: "🎓", name: "Maestro técnico",      desc: "50 ejercicios distintos registrados",               check: (s) => new Set(s.flatMap(x=>(x.exercises||[]).map(e=>e.name))).size>=50 },
  { id: "90days",      stars: 3, icon: "🧬", name: "Nueva versión",        desc: "90 días de actividad acumulada",                   check: (s) => { const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); if(sorted.length<30) return false; const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); return (last-first)/86400000>=90; } },
  { id: "vol_100k",    stars: 3, icon: "📦", name: "Toneladas movidas",    desc: "100.000 kg acumulados en total",                   check: (s) => s.reduce((acc,x)=>acc+calcSessionVolume(x),0)>=100000 },
  { id: "perfect_mo",  stars: 3, icon: "📅", name: "Mes perfecto",         desc: "Entrenaste 20+ días en un mes",                    check: (s) => { const byMonth = {}; s.forEach(x => { const k = x.date.slice(0, 7); byMonth[k] = (byMonth[k] || 0) + 1; }); return Object.values(byMonth).some(c => c >= 20); } },
  // IA
  { id: "ai_expert",   stars: 3, icon: "🧠", name: "Modo experto activado", desc: "Usaste el Coach IA 20 veces. ¡Constancia digital, resultados reales!", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 20 },
  // Coach
  { id: "coach_week",  stars: 3, icon: "🏆", name: "Sin excusas",          desc: "5 rutinas de coach completadas en una semana",     check: (s) => { const w=new Date(); w.setDate(w.getDate()-7); return s.filter(x=>!!x.coachRoutineDocId&&new Date(x.date+"T00:00:00")>=w).length>=5; } },
  // Foto
  { id: "photo_antes", stars: 3, icon: "🔄", name: "Antes y después",      desc: "Sube fotos en diferentes momentos. ¡El cambio es real!", check: (s, prs, u, ex) => (ex?.photoCount||0) >= 5 },

  // ⭐⭐⭐⭐ NIVEL 4 — Platino
  { id: "sessions200", stars: 4, icon: "🗡️", name: "Veterano del hierro",  desc: "200 sesiones completadas",                         check: (s) => s.length >= 200 },
  { id: "streak90",    stars: 4, icon: "💎", name: "90 semanas seguidas",   desc: "Cumpliste tu meta 90 semanas consecutivas",         check: (s) => getStreak(s) >= 90 },
  { id: "180days",     stars: 4, icon: "🔮", name: "Cambio real",           desc: "180 días de actividad acumulada",                   check: (s) => { const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); if(sorted.length<60) return false; const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); return (last-first)/86400000>=180; } },
  { id: "leg100",      stars: 4, icon: "🦾", name: "Especialista piernas",  desc: "100 sesiones de pierna",                           check: (s) => s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral","Glúteos","Pantorrillas"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length>=100 },
  { id: "sessions500", stars: 4, icon: "⚔️", name: "500 batallas",          desc: "500 sesiones completadas",                         check: (s) => s.length >= 500 },
  { id: "6months",     stars: 4, icon: "🔱", name: "Medio año imparable",   desc: "6 meses con 12+ sesiones cada uno",                check: (s) => { let c=0; for(let i=0;i<6;i++){const d=new Date(); d.setMonth(d.getMonth()-i); const m=d.getMonth(),y=d.getFullYear(); if(s.filter(x=>{const sd=new Date(x.date+"T00:00:00"); return sd.getMonth()===m&&sd.getFullYear()===y;}).length>=12) c++;} return c>=6; } },
  { id: "architect",   stars: 4, icon: "🏛️", name: "Arquitecto del físico", desc: "50+ sesiones de pecho, espalda y pierna",          check: (s) => { const ch=s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Pecho")).length; const ba=s.filter(x=>(x.exercises||[]).some(e=>EXERCISE_DB.find(d=>d.name===e.name)?.muscle==="Espalda")).length; const le=s.filter(x=>(x.exercises||[]).some(e=>["Cuádriceps","Femoral"].includes(EXERCISE_DB.find(d=>d.name===e.name)?.muscle))).length; return ch>=50&&ba>=50&&le>=50; } },
  { id: "reinvention", stars: 4, icon: "🔄", name: "Reinvención",           desc: "Volviste tras 3+ meses y completaste 30 sesiones", check: (s) => { if(s.length<31) return false; const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); for(let i=1;i<sorted.length;i++){const gap=(new Date(sorted[i].date+"T00:00:00")-new Date(sorted[i-1].date+"T00:00:00"))/86400000; if(gap>=90) return sorted.slice(i).length>=30;} return false; } },
  { id: "year_iron",   stars: 4, icon: "🏆", name: "Año de hierro",         desc: "12 meses distintos con sesiones registradas",      check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=12 },
  { id: "pr20",        stars: 4, icon: "👑", name: "Coleccionista de PRs",  desc: "PRs en 20 ejercicios distintos",                   check: (s, prs) => Object.keys(prs).length >= 20 },
  // IA
  { id: "ai_50",       stars: 4, icon: "🤖", name: "IAdependiente",         desc: "Usaste el Coach IA 50 veces. Admítelo: ya no puedes vivir sin él 😎", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 50 },
  // Teams
  { id: "team_alma",   stars: 4, icon: "🏅", name: "Alma del equipo",       desc: "Llevas más de 10 sesiones siendo parte de un equipo. ¡Eres el motor del grupo!", check: (s, prs, u) => !!u?.teamId && s.length >= 10 },
  // Coach
  { id: "coach_15",    stars: 4, icon: "🐯", name: "Modo bestia",           desc: "15 rutinas de coach completadas. ¡Tu cuerpo ya lo nota!",  check: (s) => s.filter(x=>!!x.coachRoutineDocId).length >= 15 },
  // Foto
  { id: "photo_mes",   stars: 4, icon: "🗓️", name: "Archivo fitness",       desc: "10 fotos de progreso subidas. ¡Tu disciplina se ve!",  check: (s, prs, u, ex) => (ex?.photoCount||0) >= 10 },

  // ⭐⭐⭐⭐⭐ NIVEL 5 — Legendario
  { id: "sessions1000",stars: 5, icon: "💀", name: "Mil batallas",          desc: "1000 sesiones registradas",                        check: (s) => s.length >= 1000 },
  { id: "streak365",   stars: 5, icon: "🌞", name: "365 semanas seguidas",  desc: "Cumpliste tu meta 365 semanas consecutivas",        check: (s) => getStreak(s) >= 365 },
  { id: "year_full",   stars: 5, icon: "💫", name: "Transformación total",  desc: "1 año sin pausas mayores a 2 semanas",             check: (s) => { if(s.length<100) return false; const sorted=[...s].sort((a,b)=>a.date.localeCompare(b.date)); const first=new Date(sorted[0].date+"T00:00:00"),last=new Date(sorted[sorted.length-1].date+"T00:00:00"); if((last-first)/86400000<365) return false; for(let i=1;i<sorted.length;i++){if((new Date(sorted[i].date+"T00:00:00")-new Date(sorted[i-1].date+"T00:00:00"))/86400000>14) return false;} return true; } },
  { id: "5years",      stars: 5, icon: "🏟️", name: "Leyenda del gimnasio", desc: "5 años activo (60 meses con sesiones)",            check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=60 },
  { id: "10years",     stars: 5, icon: "🔮", name: "ADN de hierro",         desc: "10 años registrado (120 meses)",                   check: (s) => new Set(s.map(x=>x.date.slice(0,7))).size>=120 },
  { id: "icon10k",     stars: 5, icon: "⚜️", name: "Ícono eterno",          desc: "10.000 sesiones registradas",                      check: (s) => s.length >= 10000 },
  { id: "vol_1m",      stars: 5, icon: "🌍", name: "Un millón de kilos",    desc: "1.000.000 kg acumulados en total",                  check: (s) => s.reduce((acc,x)=>acc+calcSessionVolume(x),0)>=1000000 },
  { id: "iron_gen",    stars: 5, icon: "🧬", name: "Generación hierro",     desc: "3 años entrenando 3+ veces/semana",                check: (s) => { const ref=new Date(); ref.setFullYear(ref.getFullYear()-3); const recent=s.filter(x=>new Date(x.date+"T00:00:00")>=ref); const weeks={}; recent.forEach(x=>{const d=new Date(x.date+"T00:00:00"); const wk=Math.floor((d-ref)/604800000); weeks[wk]=(weeks[wk]||0)+1;}); return Object.values(weeks).filter(c=>c>=3).length>=125; } },
  // IA
  { id: "ai_legend",   stars: 5, icon: "🧬", name: "Confidente del hierro", desc: "Usaste el Coach IA 100 veces. ¡Tu progreso empieza en la mente!", check: (s, prs, u, ex) => (ex?.aiUses||0) >= 100 },
  // Teams
  { id: "team_legend", stars: 5, icon: "🏆", name: "Leyenda del squad",     desc: "Llevas más de 50 sesiones siendo parte de un equipo. ¡Gloria compartida!", check: (s, prs, u) => !!u?.teamId && s.length >= 50 },
  // Coach
  { id: "coach_50",    stars: 5, icon: "🔥", name: "Máquina imparable",     desc: "50 rutinas de coach completadas. ¡Eres pura consistencia!",  check: (s) => s.filter(x=>!!x.coachRoutineDocId).length >= 50 },
  // Foto
  { id: "photo_legend",stars: 5, icon: "✨", name: "Transformación legendaria", desc: "20 fotos de progreso subidas. ¡Inspiración total!",  check: (s, prs, u, ex) => (ex?.photoCount||0) >= 20 },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function BadgesModal({ sessions, bodyStats, user, extras = {}, onClose }) {
  const prs = getPRs(sessions);
  const [filterLevel, setFilterLevel] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [seenSnapshot] = useState(() => {
    const s = getSeenBadges();
    return s;
  });

  const starColors = {
    1: { bg:"rgba(148,163,184,0.1)", border:"rgba(148,163,184,0.4)", color:"#94a3b8", label:"Bronce" },
    2: { bg:"rgba(234,179,8,0.1)",   border:"rgba(234,179,8,0.4)",   color:"#eab308", label:"Plata" },
    3: { bg:"rgba(59,130,246,0.1)",  border:"rgba(59,130,246,0.4)",  color:"#3b82f6", label:"Oro" },
    4: { bg:"rgba(168,85,247,0.12)", border:"rgba(168,85,247,0.5)",  color:"#a855f7", label:"Platino" },
    5: { bg:"rgba(245,158,11,0.15)", border:"rgba(245,158,11,0.6)",  color:"#f59e0b", label:"Legendario" },
  };

  function Stars({ n }) {
    return (
      <div style={{ display:"flex", gap:2, justifyContent:"center" }}>
        {[1,2,3,4,5].map(i => (
          <span key={i} style={{ fontSize:10, opacity: i<=n ? 1 : 0.18 }}>⭐</span>
        ))}
      </div>
    );
  }

  const allBadges = BADGE_DEFS.map(b => ({
    ...b,
    unlocked: b.check(sessions, prs, user, extras),
  }));

  const unlockedIds = allBadges.filter(b => b.unlocked).map(b => b.id);
  const newBadges = unlockedIds.filter(id => !seenSnapshot.has(id));

  useEffect(() => {
    markBadgesSeen(unlockedIds);
  }, []);

  const shown    = filterLevel === 0 ? allBadges : allBadges.filter(b => b.stars === filterLevel);
  const earned   = shown.filter(b => b.unlocked);
  const locked   = shown.filter(b => !b.unlocked);
  const totalEarned = allBadges.filter(b => b.unlocked).length;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()} style={{ maxHeight:"88vh", overflowY:"auto" }}>
        <div className="modal-header">
          <h3 className="modal-title">🏅 Logros</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Progreso global */}
        <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
          <div style={{ flex:"0 0 auto", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", borderRadius:12, padding:"10px 18px", textAlign:"center" }}>
            <div style={{ fontFamily:"Inter, sans-serif", fontSize:30, fontWeight:800, color:"#f59e0b", lineHeight:1 }}>{totalEarned}</div>
            <div style={{ fontSize:10, color:"var(--text-muted)" }}>de {BADGE_DEFS.length} logros</div>
          </div>
          <div style={{ flex:1, background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:12, padding:"10px 16px", display:"flex", flexDirection:"column", justifyContent:"center" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:6 }}>
              <span style={{ color:"var(--text-muted)" }}>Progreso general</span>
              <span style={{ fontWeight:700, color:"var(--accent)" }}>{Math.round((totalEarned/BADGE_DEFS.length)*100)}%</span>
            </div>
            <div style={{ height:8, background:"var(--border)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ height:"100%", background:"linear-gradient(90deg,#f59e0b,#a855f7)", width:`${(totalEarned/BADGE_DEFS.length)*100}%`, borderRadius:4, transition:"width 0.6s" }} />
            </div>
          </div>
        </div>

        {/* Filtros por nivel */}
        <div style={{ display:"flex", gap:6, marginBottom:18, flexWrap:"wrap" }}>
          <button className={`muscle-chip ${filterLevel===0?"active":""}`} style={{ fontSize:12 }} onClick={() => setFilterLevel(0)}>Todos</button>
          {[1,2,3,4,5].map(n => {
            const sc = starColors[n];
            const cnt = allBadges.filter(b=>b.stars===n&&b.unlocked).length;
            const tot = allBadges.filter(b=>b.stars===n).length;
            return (
              <button key={n} onClick={() => setFilterLevel(filterLevel===n ? 0 : n)} style={{
                background: filterLevel===n ? sc.bg : "none",
                border: `1px solid ${filterLevel===n ? sc.border : "var(--border)"}`,
                color: filterLevel===n ? sc.color : "var(--text-muted)",
                borderRadius:20, padding:"5px 12px", cursor:"pointer",
                fontFamily:"Barlow,sans-serif", fontSize:12, fontWeight:600,
                display:"flex", alignItems:"center", gap:5, transition:"all 0.2s",
              }}>
                {"⭐".repeat(n)} <span style={{ opacity:0.7 }}>{cnt}/{tot}</span>
              </button>
            );
          })}
        </div>

        {/* Desbloqueados */}
        {earned.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"#f59e0b", textTransform:"uppercase", marginBottom:12 }}>Desbloqueados ✨ ({earned.length})</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(148px,1fr))", gap:10, marginBottom:24 }}>
              {earned.map(b => {
                const sc = starColors[b.stars];
                const isNew = newBadges.includes(b.id);
                return (
                  <div key={b.id} onClick={() => setSelectedBadge(b)} style={{ position:"relative", background:sc.bg, border:`1px solid ${isNew ? "#DFFF00" : sc.border}`, borderRadius:14, padding:"14px 12px", textAlign:"center", boxShadow: isNew ? "0 0 16px rgba(223,255,0,0.2)" : "none", cursor:"pointer", transition:"transform 0.15s", }} onMouseEnter={e => e.currentTarget.style.transform="scale(1.03)"} onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
                    {isNew && (
                      <div style={{ position:"absolute", top:-8, right:-8, background:"#DFFF00", color:"#000", fontSize:9, fontWeight:900, padding:"2px 7px", borderRadius:20, letterSpacing:1, textTransform:"uppercase" }}>
                        NUEVO
                      </div>
                    )}
                    <div style={{ fontSize:32, marginBottom:5 }}>{b.icon}</div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:3, lineHeight:1.3 }}>{b.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)", lineHeight:1.4, marginBottom:7 }}>{b.desc}</div>
                    <Stars n={b.stars} />
                    <div style={{ fontSize:9, color:sc.color, fontWeight:700, marginTop:4, textTransform:"uppercase", letterSpacing:1 }}>{sc.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Bloqueados */}
        {locked.length > 0 && (
          <>
            <div style={{ fontSize:10, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:12 }}>Por desbloquear 🔒 ({locked.length})</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(148px,1fr))", gap:10 }}>
              {locked.map(b => {
                const sc = starColors[b.stars];
                return (
                  <div key={b.id} onClick={() => setSelectedBadge(b)} style={{ background:"var(--input-bg)", border:"1px solid var(--border)", borderRadius:14, padding:"14px 12px", textAlign:"center", opacity:0.5, cursor:"pointer", transition:"transform 0.15s" }} onMouseEnter={e => e.currentTarget.style.transform="scale(1.03)"} onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
                    <div style={{ fontSize:32, marginBottom:5, filter:"grayscale(1)" }}>{b.icon}</div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:3, lineHeight:1.3 }}>{b.name}</div>
                    <div style={{ fontSize:10, color:"var(--text-muted)", lineHeight:1.4, marginBottom:7 }}>{b.desc}</div>
                    <Stars n={b.stars} />
                    <div style={{ fontSize:9, color:sc.color, fontWeight:700, marginTop:4, textTransform:"uppercase", letterSpacing:1 }}>{sc.label}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Badge detail overlay */}
      {selectedBadge && (() => {
        const b = selectedBadge;
        const sc = starColors[b.stars];
        const isEarned = earned.some(e => e.id === b.id);
        const levelNames = { 1: "Bronce", 2: "Plata", 3: "Oro", 4: "Platino", 5: "Legendario" };
        return (
          <div onClick={() => setSelectedBadge(null)} style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
            zIndex: 99999, display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24, backdropFilter: "blur(4px)",
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              width: "100%", maxWidth: 320,
              background: "var(--card-bg, #111)",
              border: `1px solid ${isEarned ? sc.border : "var(--border)"}`,
              borderRadius: 20, padding: "28px 24px", textAlign: "center",
              boxShadow: isEarned ? `0 0 40px ${sc.border}60` : "none",
            }}>
              <div style={{ fontSize: 64, marginBottom: 12, filter: isEarned ? "none" : "grayscale(1)" }}>
                {b.icon}
              </div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontWeight: 900,
                fontSize: 22, letterSpacing: 1, marginBottom: 6,
                color: isEarned ? "var(--text)" : "var(--text-muted)",
              }}>
                {b.name}
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: isEarned ? sc.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${isEarned ? sc.border : "var(--border)"}`,
                borderRadius: 20, padding: "4px 12px", marginBottom: 16,
              }}>
                <span style={{ fontSize: 12 }}>{"⭐".repeat(b.stars)}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isEarned ? sc.color : "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>
                  {levelNames[b.stars] || ""}
                </span>
              </div>
              <div style={{
                fontSize: 13, color: isEarned ? "rgba(255,255,255,0.75)" : "var(--text-muted)",
                lineHeight: 1.75, marginBottom: 20,
              }}>
                {BADGE_DETAILS[b.id] || b.desc}
              </div>
              {!isEarned && (
                <div style={{
                  background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                  fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>🔒</span>
                  <span>Aún no desbloqueado — ¡sigue entrenando!</span>
                </div>
              )}
              {isEarned && (
                <div style={{
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                  borderRadius: 10, padding: "8px 14px", marginBottom: 16,
                  fontSize: 12, color: "#22c55e", display: "flex", alignItems: "center", gap: 8,
                }}>
                  <span>✅</span>
                  <span style={{ fontWeight: 700 }}>¡Logro desbloqueado!</span>
                </div>
              )}
              <button onClick={() => setSelectedBadge(null)} style={{
                width: "100%", padding: "11px 0", borderRadius: 10,
                background: "rgba(255,255,255,0.06)", border: "1px solid var(--border)",
                color: "var(--text-muted)", cursor: "pointer", fontSize: 13, fontWeight: 700,
                fontFamily: "Inter, sans-serif", letterSpacing: 1,
              }}>
                Cerrar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// Exportar función para saber cuántos logros nuevos hay (para el contador en App.jsx)
export function getNewBadgesCount(sessions, prs, user, extras = {}) {
  const seen = getSeenBadges();
  return BADGE_DEFS.filter(b => b.check(sessions, prs, user, extras) && !seen.has(b.id)).length;
}