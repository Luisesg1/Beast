import { useState } from "react";
import beastHype from "../assets/beast_hype.png";

function ProBadge() {
  return (
    <span style={{
      display: "inline-block",
      background: "rgba(223,255,0,0.12)",
      border: "1px solid rgba(223,255,0,0.35)",
      color: "#DFFF00", fontSize: 9, fontWeight: 800,
      letterSpacing: 1, padding: "2px 7px",
      borderRadius: 20, marginLeft: 6,
      verticalAlign: "middle", textTransform: "uppercase",
    }}>✨ Pro</span>
  );
}

function CoachBadge() {
  return (
    <span style={{
      display: "inline-block",
      background: "rgba(96,165,250,0.12)",
      border: "1px solid rgba(96,165,250,0.35)",
      color: "#60a5fa", fontSize: 9, fontWeight: 800,
      letterSpacing: 1, padding: "2px 7px",
      borderRadius: 20, marginLeft: 6,
      verticalAlign: "middle", textTransform: "uppercase",
    }}>🏅 Coach</span>
  );
}

function FeatureRow({ icon, label, pro, coach }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10, padding: "10px 14px",
    }}>
      <span style={{ fontSize: 20, minWidth: 28, textAlign: "center" }}>{icon}</span>
      <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500, flex: 1, lineHeight: 1.4 }}>{label}</span>
      {pro && <ProBadge />}
      {coach && <CoachBadge />}
    </div>
  );
}

function TipRow({ icon, text }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 10, padding: "10px 12px",
    }}>
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

export default function OnboardingModal({ user, onComplete, onSetGoal }) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState(4);
  const firstName = user.name?.split(" ")[0] || "atleta";

  const steps = [
    // ── 0. Bienvenida ──────────────────────────────────────────────────────────
    {
      emoji: null,
      title: `¡Hola, ${firstName}!`,
      desc: "Soy Beast, tu fan número uno. Estoy aquí para gritar más fuerte que nadie cuando lo logras.",
      content: (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", inset: -16, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(223,255,0,0.12) 0%, transparent 70%)",
              }} />
              <img src={beastHype} alt="Beast" style={{
                width: 110, height: 110, objectFit: "contain",
                filter: "drop-shadow(0 0 16px rgba(223,255,0,0.4))",
                position: "relative", zIndex: 1,
              }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { icon: "⚡", label: "Entrena en vivo", color: "#DFFF00" },
              { icon: "📈", label: "Sigue tu progreso", color: "#22c55e" },
              { icon: "🏆", label: "Rompe tus PRs", color: "#f59e0b" },
              { icon: "👥", label: "Compite con amigos", color: "#3b82f6" },
            ].map(f => (
              <div key={f.label} style={{
                background: `${f.color}08`,
                border: `1px solid ${f.color}25`,
                borderRadius: 12, padding: "14px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 24, marginBottom: 6 }}>{f.icon}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: f.color }}>{f.label}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },

    // ── 1. Meta semanal ────────────────────────────────────────────────────────
    {
      emoji: "🎯",
      title: "¿Cuántos días vas a entrenar?",
      desc: "Ser honesto ayuda. Empezar con poco y cumplir es mejor que prometer mucho y fallar.",
      content: (
        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {[2, 3, 4, 5, 6].map(n => {
              const labels = { 2: "Principiante", 3: "Regular", 4: "Dedicado", 5: "Serio", 6: "Beast" };
              const colors = { 2: "#22c55e", 3: "#3b82f6", 4: "#f59e0b", 5: "#f97316", 6: "#ef4444" };
              const sel = selectedGoal === n;
              return (
                <button key={n} onClick={() => { setSelectedGoal(n); onSetGoal && onSetGoal({ target: n }); }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    width: 66, padding: "12px 8px", borderRadius: 14,
                    border: `2px solid ${sel ? colors[n] : "rgba(255,255,255,0.08)"}`,
                    background: sel ? `${colors[n]}15` : "rgba(255,255,255,0.03)",
                    cursor: "pointer", transition: "all 0.2s",
                    boxShadow: sel ? `0 0 16px ${colors[n]}30` : "none",
                  }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 34, fontWeight: 900, color: sel ? colors[n] : "rgba(255,255,255,0.3)", lineHeight: 1 }}>{n}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: sel ? colors[n] : "rgba(255,255,255,0.3)", letterSpacing: 0.5 }}>{labels[n]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ background: "rgba(223,255,0,0.05)", border: "1px solid rgba(223,255,0,0.12)", borderRadius: 12, padding: "12px 16px", textAlign: "center", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
            {selectedGoal <= 2 && "💡 Perfecto para comenzar. La consistencia es lo que importa."}
            {selectedGoal === 3 && "💡 3 días es ideal para recuperarse bien y progresar."}
            {selectedGoal === 4 && "💡 El clásico. 4 días es el punto ideal para la mayoría."}
            {selectedGoal === 5 && "💡 ¡Ambicioso! Recuerda descansar bien entre sesiones."}
            {selectedGoal >= 6 && "💡 ¡Nivel beast! Asegúrate de alternar grupos musculares."}
          </div>
        </div>
      ),
    },

    // ── 2. La racha ────────────────────────────────────────────────────────────
    {
      emoji: "🔥",
      title: "La racha semanal",
      desc: "Cuenta semanas consecutivas cumpliendo tu meta. No importa si descansas un día — lo que importa es la semana completa.",
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { weeks: 1, label: "Primera semana", color: "#22c55e" },
              { weeks: 4, label: "Un mes seguido", color: "#3b82f6" },
              { weeks: 12, label: "Tres meses", color: "#f97316" },
            ].map(m => (
              <div key={m.weeks} style={{ background: `${m.color}08`, border: `1px solid ${m.color}25`, borderRadius: 12, padding: "14px 8px", textAlign: "center" }}>
                <div style={{ fontFamily: "Inter, sans-serif", fontSize: 32, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.weeks}</div>
                <div style={{ fontSize: 9, fontWeight: 700, color: m.color, marginBottom: 4 }}>sem</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{m.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <TipRow icon="🛡️" text="Los escudos protegen tu racha si una semana no llegas a la meta." />
            <TipRow icon="✅" text="La racha sube al terminar el domingo si cumpliste tu meta." />
            <TipRow icon="🎯" text="Puedes cambiar tu meta semanal desde el botón 🎯 del Dashboard." />
          </div>
        </div>
      ),
    },

    // ── 3. Registrar sesión ────────────────────────────────────────────────────
    {
      emoji: "📝",
      title: "Registrar una sesión",
      desc: "Dos modos según si quieres registrar mientras entrenas o después.",
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ background: "rgba(223,255,0,0.06)", border: "1px solid rgba(223,255,0,0.2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>⚡</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 14, color: "#DFFF00", marginBottom: 4, letterSpacing: 1 }}>EN VIVO</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>Timer automático, marca series mientras entrenas, PRs al instante.</div>
            </div>
            <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 24, marginBottom: 6 }}>📋</div>
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 14, color: "#22c55e", marginBottom: 4, letterSpacing: 1 }}>REGISTRAR</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.6 }}>Completa los datos después de entrenar con calma.</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <TipRow icon="📄" text="Usa plantillas para cargar rutinas guardadas al instante." />
            <TipRow icon="📅" text="El planificador semanal te ayuda a organizar qué entrenarás cada día." />
            <TipRow icon="🔧" text="Crea ejercicios personalizados desde la librería de ejercicios." />
          </div>
        </div>
      ),
    },

    // ── 4. Fotos de progreso ───────────────────────────────────────────────────
    {
      emoji: "📸",
      title: "Fotos de progreso",
      desc: "La transformación se ve — no solo se siente. Guarda fotos para ver tu evolución con el tiempo.",
      content: (
        <div style={{ marginTop: 16 }}>
          <div style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 14, padding: "16px 14px", marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
            <div style={{ fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 800, color: "#a855f7", letterSpacing: 1, marginBottom: 6 }}>TU TRANSFORMACIÓN</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>Sube fotos de frente, perfil y espalda. Beast las organiza por fecha para que veas tu progreso real.</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <TipRow icon="🗓️" text="Cada foto se asocia a una fecha para que puedas comparar semana a semana." />
            <TipRow icon="🔒" text="Tus fotos son privadas — solo tú puedes verlas." />
            <TipRow icon="📊" text="Accede desde el menú Progreso → Fotos de progreso." />
          </div>
        </div>
      ),
    },

    // ── 5. Progreso y stats ────────────────────────────────────────────────────
    {
      emoji: "📊",
      title: "Progreso y estadísticas",
      desc: "Beast registra todo automáticamente para que veas tu evolución en detalle.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
          <FeatureRow icon="🗺️" label="Mapa muscular — visualiza qué músculos trabajaste esta semana" />
          <FeatureRow icon="🏆" label="PRs automáticos — detecta récords al guardar la sesión" />
          <FeatureRow icon="📈" label="Gráficos de evolución por ejercicio" pro />
          <FeatureRow icon="💡" label="Insights — análisis inteligente de tus hábitos y volumen" pro />
          <FeatureRow icon="📊" label="Estadísticas avanzadas — radar muscular, comparativa semanal" pro />
          <FeatureRow icon="⚖️" label="Registro de peso corporal y medidas con IA" />
        </div>
      ),
    },

    // ── 6. IA ──────────────────────────────────────────────────────────────────
    {
      emoji: "🤖",
      title: "Inteligencia Artificial",
      desc: "Beast tiene IA integrada para ayudarte a entrenar más inteligente.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
          <FeatureRow icon="🤖" label="Coach IA — 3 consultas diarias gratis" />
          <FeatureRow icon="🤖" label="Coach IA ilimitado" pro />
          <FeatureRow icon="📸" label="Análisis de foto corporal con IA — feedback personalizado" pro />
          <FeatureRow icon="🎬" label="Ve un video y obtén 1 hora de stats avanzadas o un intento extra de IA" />
          <div style={{ background: "rgba(223,255,0,0.04)", border: "1px solid rgba(223,255,0,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            💡 Los usuarios Pro tienen acceso ilimitado a todas las funciones de IA sin ver videos.
          </div>
        </div>
      ),
    },

    // ── 7. Comunidad ───────────────────────────────────────────────────────────
    {
      emoji: "👥",
      title: "Comunidad y retos",
      desc: "Entrenar solo está bien. Entrenar con otros es mejor.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
          <FeatureRow icon="⚔️" label="Retos semanales — compite por volumen, sesiones o PRs" />
          <FeatureRow icon="🏘️" label="Teams — únete o crea un equipo y compite con amigos" />
          <FeatureRow icon="🏅" label="Logros — desbloquea badges por tus hitos de entrenamiento" />
          <FeatureRow icon="🎴" label="PR Cards — comparte tus récords en redes sociales" />
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            🏘️ Para unirte a un equipo ve a <strong style={{ color: "var(--text)" }}>Comunidad → Teams</strong> en el menú y pide el código a tu equipo.
          </div>
        </div>
      ),
    },

    // ── 8. Coach ───────────────────────────────────────────────────────────────
    {
      emoji: "🏅",
      title: "Panel de Coach",
      desc: "¿Eres entrenador personal? Beast tiene todo lo que necesitas para gestionar a tus atletas.",
      content: (
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 7 }}>
          <FeatureRow icon="👥" label="Gestiona múltiples atletas desde un solo panel" coach />
          <FeatureRow icon="📋" label="Asigna rutinas personalizadas a cada atleta" coach />
          <FeatureRow icon="📈" label="Visualiza el progreso y sesiones de tus atletas" coach />
          <FeatureRow icon="🔑" label="Código único de coach — compártelo para que te sigan" coach />
          <div style={{ background: "rgba(96,165,250,0.04)", border: "1px solid rgba(96,165,250,0.12)", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>
            🏅 El plan Coach incluye todo lo de Pro más el panel de gestión de atletas.
          </div>
        </div>
      ),
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;
  const pct = ((step + 1) / steps.length) * 100;

  return (
    <div className="overlay" style={{ zIndex: 9999, background: "rgba(0,0,0,0.9)" }}>
      <div
        className="modal"
        style={{ maxWidth: 440, padding: 0, overflow: "hidden", background: "#0e0e0e", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: "rgba(255,255,255,0.06)" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #DFFF00, #84cc16)", transition: "width 0.4s ease", borderRadius: "0 2px 2px 0" }} />
        </div>

        <div style={{ padding: "24px 24px 20px" }}>
          {/* Step counter */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ display: "flex", gap: 5 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  width: i === step ? 20 : 6, height: 6, borderRadius: 10,
                  background: i === step ? "#DFFF00" : i < step ? "rgba(223,255,0,0.4)" : "rgba(255,255,255,0.08)",
                  transition: "all 0.3s",
                }} />
              ))}
            </div>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontWeight: 600 }}>
              {step + 1} / {steps.length}
            </span>
          </div>

          {/* Content */}
          <div style={{ textAlign: "center", marginBottom: 4 }}>
            {current.emoji && (
              <div style={{
                fontSize: 44, marginBottom: 12,
                filter: "drop-shadow(0 0 12px rgba(223,255,0,0.3))",
              }}>{current.emoji}</div>
            )}
            <div style={{
              fontFamily: "Inter, sans-serif",
              fontSize: 24, fontWeight: 900,
              color: "white", marginBottom: 8,
              letterSpacing: 0.5, lineHeight: 1.1,
            }}>{current.title}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>{current.desc}</div>
          </div>

          {current.content}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 22 }}>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                style={{
                  flex: 1, padding: "11px 0", borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.1)",
                  background: "transparent", color: "rgba(255,255,255,0.4)",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  fontFamily: "Barlow, sans-serif",
                }}>
                ← Atrás
              </button>
            )}
            <button
              onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
              style={{
                flex: 2, padding: "13px 0", borderRadius: 10, border: "none",
                background: "#DFFF00", color: "#09090B",
                fontFamily: "Inter, sans-serif",
                fontWeight: 900, fontSize: 15, letterSpacing: 1,
                cursor: "pointer", textTransform: "uppercase",
                boxShadow: "0 0 20px rgba(223,255,0,0.2)",
                transition: "all 0.2s",
              }}>
              {isLast ? "¡COMENZAR! 💪" : "SIGUIENTE →"}
            </button>
          </div>

          {!isLast && (
            <button
              onClick={onComplete}
              style={{
                display: "block", width: "100%", marginTop: 10,
                background: "none", border: "none",
                color: "rgba(255,255,255,0.2)", fontSize: 12,
                cursor: "pointer", padding: 4,
                fontFamily: "Barlow, sans-serif",
              }}>
              Omitir tutorial
            </button>
          )}
        </div>
      </div>
    </div>
  );
}