import { useState } from "react";
import beastHype from "../assets/beast_hype.png";

function ProBadge() {
  return (
    <span style={{
      display: "inline-block",
      background: "rgba(232,255,0,0.15)",
      border: "1px solid rgba(232,255,0,0.4)",
      color: "#e8ff00",
      fontSize: 10, fontWeight: 800,
      letterSpacing: 1, padding: "2px 8px",
      borderRadius: 20, marginLeft: 8,
      verticalAlign: "middle",
      textTransform: "uppercase",
    }}>✨ Pro</span>
  );
}

function CoachBadge() {
  return (
    <span style={{
      display: "inline-block",
      background: "rgba(96,165,250,0.15)",
      border: "1px solid rgba(96,165,250,0.4)",
      color: "#60a5fa",
      fontSize: 10, fontWeight: 800,
      letterSpacing: 1, padding: "2px 8px",
      borderRadius: 20, marginLeft: 8,
      verticalAlign: "middle",
      textTransform: "uppercase",
    }}>🏅 Coach</span>
  );
}

function FeatureRow({ icon, label, pro, coach }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--input-bg)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "10px 14px",
    }}>
      <span style={{ fontSize: 20, minWidth: 28, textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, flex: 1 }}>{label}</span>
      {pro && <ProBadge />}
      {coach && <CoachBadge />}
    </div>
  );
}

export default function OnboardingModal({ user, onComplete, onSetGoal }) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(4);
  const firstName = user.name?.split(" ")[0] || "atleta";

  const steps = [
    {
      emoji: null,
      title: `¡Hola, ${firstName}! 👋`,
      desc: "Soy Beast, tu fan número uno. Estoy aquí para gritar más fuerte que nadie cuando lo logras. 🔥",
      content: (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", inset: -10, borderRadius: "50%",
                background: "radial-gradient(circle, #84cc1640 0%, transparent 70%)",
              }}/>
              <img src={beastHype} alt="Beast" style={{
                width: 120, height: 120, objectFit: "contain",
                filter: "drop-shadow(0 0 12px #84cc1688)",
                transformOrigin: "bottom center", position: "relative", zIndex: 1,
              }}/>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { icon: "🏋️", label: "Registra entrenamientos" },
              { icon: "📈", label: "Sigue tu progreso" },
              { icon: "🏆", label: "Rompe récords personales" },
              { icon: "👥", label: "Compite con amigos" },
            ].map(f => (
              <div key={f.label} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 22, marginBottom: 5 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      emoji: "🎯",
      title: "¿Cuántos días por semana vas a entrenar?",
      desc: "Te recordaré tu meta cada semana y celebraré cuando la cumplas. Ser honesto ayuda: empezar con poco y cumplir es mejor que prometer mucho.",
      content: (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {[2, 3, 4, 5, 6].map(n => {
              const labels = { 2: "Principiante", 3: "Regular", 4: "Dedicado", 5: "Serio", 6: "Beast" };
              const colors = { 2: "#22c55e", 3: "#3b82f6", 4: "#f59e0b", 5: "#f97316", 6: "#ef4444" };
              const sel = selectedGoal === n;
              return (
                <button key={n} onClick={() => { setSelectedGoal(n); onSetGoal && onSetGoal({ target: n }); }}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 70, padding: "12px 8px", borderRadius: 14, border: "2px solid", borderColor: sel ? colors[n] : "var(--border)", background: sel ? `${colors[n]}18` : "var(--input-bg)", cursor: "pointer", transition: "all 0.2s" }}>
                  <span style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 32, fontWeight: 900, color: sel ? colors[n] : "var(--text-muted)", lineHeight: 1 }}>{n}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sel ? colors[n] : "var(--text-muted)", letterSpacing: 0.5 }}>{labels[n]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "var(--text-muted)" }}>
            {selectedGoal <= 2 && "💡 Perfecto para comenzar. La consistencia es lo que importa."}
            {selectedGoal === 3 && "💡 3 días es ideal para recuperarse bien y progresar."}
            {selectedGoal === 4 && "💡 El clásico. 4 días es el punto ideal para la mayoría."}
            {selectedGoal === 5 && "💡 ¡Ambicioso! Recuerda descansar bien entre sesiones."}
            {selectedGoal >= 6 && "💡 ¡Nivel beast! Asegúrate de alternar grupos musculares."}
          </div>
        </div>
      ),
    },
    {
      emoji: "🔥",
      title: "La racha: tu motivación semanal",
      desc: "La racha cuenta semanas consecutivas en las que cumpliste tu meta de días. No importa si un día descansas, lo que importa es la semana completa.",
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
            {[
              { weeks: 1, label: "Primera semana", color: "#22c55e" },
              { weeks: 4, label: "Un mes seguido", color: "#3b82f6" },
              { weeks: 12, label: "Tres meses", color: "#f59e0b" },
            ].map(m => (
              <div key={m.weeks} style={{ background: `${m.color}10`, border: `1px solid ${m.color}30`, borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "Barlow Condensed,sans-serif", fontSize: 30, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.weeks}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: m.color, marginBottom: 4 }}>sem</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "✅", text: "Si cumples tu meta esta semana, la racha sube al terminar el domingo." },
              { icon: "🔥", text: "El botón 🔥 en la parte superior te lleva directo al calendario de entrenamientos." },
              { icon: "💡", text: "Puedes cambiar tu meta de días cuando quieras desde el botón 🎯 del Dashboard." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      emoji: "📝",
      title: "¿Cómo registrar una sesión?",
      desc: "Tienes dos modos según si quieres registrar mientras entrenas o después.",
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "var(--accent)", marginBottom: 4 }}>En vivo</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>Timer de descanso automático, marca cada serie mientras entrenas.</div>
            </div>
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📝</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#22c55e", marginBottom: 4 }}>Registrar</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>Completa los datos después de entrenar con calma.</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "📋", text: "Usa plantillas para cargar rutinas guardadas al instante." },
              { icon: "📅", text: "El planificador semanal te permite organizar qué entrenarás cada día." },
              { icon: "🎯", text: "Puedes crear ejercicios personalizados desde la librería de ejercicios." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      emoji: "📊",
      title: "Progreso y estadísticas",
      desc: "Beast registra todo automáticamente para que veas tu evolución en detalle.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <FeatureRow icon="🗺️" label="Mapa muscular — visualiza qué músculos trabajaste esta semana" />
          <FeatureRow icon="🏆" label="PRs automáticos — detecta récords personales al guardar la sesión" />
          <FeatureRow icon="📈" label="Gráficos de evolución por ejercicio" pro />
          <FeatureRow icon="💡" label="Insights — análisis inteligente de tus hábitos y volumen" pro />
          <FeatureRow icon="📊" label="Estadísticas avanzadas — radar muscular, comparativa semanal" pro />
          <FeatureRow icon="⚖️" label="Registro de peso corporal y medidas" />
        </div>
      ),
    },
    {
      emoji: "🤖",
      title: "Inteligencia Artificial",
      desc: "Beast tiene IA integrada para ayudarte a entrenar más inteligente.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <FeatureRow icon="🤖" label="Coach IA — 3 consultas diarias gratis" />
          <FeatureRow icon="🤖" label="Coach IA ilimitado" pro />
          <FeatureRow icon="📸" label="Análisis de foto corporal con IA — sube una foto y recibe feedback" pro />
          <FeatureRow icon="🎬" label="Ve un video y obtén 1 hora de stats avanzadas o un intento extra de IA" />
          <div style={{ background: "rgba(232,255,0,0.05)", border: "1px solid rgba(232,255,0,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            💡 Los usuarios Pro tienen acceso ilimitado a todas las funciones de IA sin necesidad de ver videos.
          </div>
        </div>
      ),
    },
    {
      emoji: "👥",
      title: "Comunidad y retos",
      desc: "Entrenar solo está bien, pero entrenar con otros es mejor.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <FeatureRow icon="⚔️" label="Retos semanales — compite por volumen, sesiones o PRs" />
          <FeatureRow icon="🏘️" label="Teams — únete o crea un equipo y compite con amigos" />
          <FeatureRow icon="🏅" label="Logros — desbloquea badges por tus hitos de entrenamiento" />
          <FeatureRow icon="🎴" label="PR Cards — comparte tus récords en redes sociales" />
          <div style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            🏘️ Para unirte a un equipo ve a <strong style={{ color: "var(--text)" }}>Teams</strong> en el menú y pide el código a tu equipo.
          </div>
        </div>
      ),
    },
    {
      emoji: "🏅",
      title: "Panel de Coach",
      desc: "¿Eres entrenador personal? Beast tiene todo lo que necesitas para gestionar a tus atletas.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          <FeatureRow icon="👥" label="Gestiona múltiples atletas desde un solo panel" coach />
          <FeatureRow icon="📋" label="Asigna rutinas personalizadas a cada atleta" coach />
          <FeatureRow icon="📈" label="Visualiza el progreso y sesiones de tus atletas" coach />
          <FeatureRow icon="🔑" label="Código único de coach — compártelo para que tus atletas te sigan" coach />
          <div style={{ background: "rgba(96,165,250,0.05)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            🏅 El plan Coach está disponible desde el menú de planes. Incluye todo lo de Pro más el panel de gestión.
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="overlay" style={{ zIndex: 9999, background: "rgba(0,0,0,0.85)" }}>
      <div className="modal" style={{ maxWidth: 440, padding: 28 }} onClick={e => e.stopPropagation()}>
        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 24 : 8, height: 8, borderRadius: 10,
              background: i === step ? "var(--accent)" : i < step ? "rgba(232,255,0,0.35)" : "var(--border)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          {current.emoji && <div style={{ fontSize: 48, marginBottom: 12 }}>{current.emoji}</div>}
          <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 24, fontWeight: 900, marginBottom: 8 }}>{current.title}</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>{current.desc}</div>
        </div>

        {current.content}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border)", background: "transparent", color: "var(--text-muted)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
              ← Atrás
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
            style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: "var(--accent)", color: "#0a0a0a", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
            {isLast ? "¡Comenzar a entrenar! 💪" : "Siguiente →"}
          </button>
        </div>

        {!isLast && (
          <button onClick={onComplete} style={{ display: "block", width: "100%", marginTop: 10, background: "none", border: "none", color: "var(--text-muted)", fontSize: 12, cursor: "pointer", padding: 4 }}>
            Omitir
          </button>
        )}
      </div>
    </div>
  );
}