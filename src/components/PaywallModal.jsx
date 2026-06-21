// PaywallModal.jsx — Con integración RevenueCat y precios dinámicos
import { useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { useBilling } from "../useBilling";
import { Purchases } from "@revenuecat/purchases-capacitor";
import { Capacitor } from "@capacitor/core";
import { track } from "../utils/analytics";

const PLANS = {
  pro: {
    id: "pro",
    name: "BEAST PRO",
    emoji: "⚡",
    color: "#e8ff00",
    monthly: { key: "monthly",  fallbackPrice: "Ver precio en Play Store",  yearly: false },
    yearly:  { key: "yearly",   fallbackPrice: "Ver precio en Play Store", badge: "Ahorra 16%", yearly: true },
    features: [
      { icon: "📊", text: "Gráficos de evolución por ejercicio" },
      { icon: "📅", text: "Historial completo sin límite de tiempo" },
      { icon: "🎯", text: "Radar muscular y mapa de consistencia" },
      { icon: "🏆", text: "Evolución de PRs y detección de estancamiento" },
      { icon: "🚫", text: "Sin anuncios" },
      { icon: "🎨", text: "PR Cards personalizables" },
      { icon: "🤖", text: "Coach IA" },
    ],
  },
  coach: {
    id: "coach",
    name: "BEAST COACH",
    emoji: "🏅",
    color: "#60a5fa",
    monthly: { key: "coach_monthly", fallbackPrice: "Ver precio en Play Store",  yearly: false },
    yearly:  { key: "coach_yearly",  fallbackPrice: "Ver precio en Play Store", badge: "Ahorra 17%", yearly: true },
    features: [
      { icon: "⚡", text: "Todo lo incluido en Pro" },
      { icon: "👥", text: "Panel de coach — gestiona atletas" },
      { icon: "📋", text: "Asigna rutinas personalizadas" },
      { icon: "📈", text: "Estadísticas de tus atletas" },
      { icon: "💬", text: "Comunicación directa con atletas" },
    ],
  },
};

const PAID_PLANS = ["pro", "coach", "gym"];

// Extrae los precios reales desde los offerings de RevenueCat
function extractPrices(offerings) {
  if (!offerings) return {};
  const prices = {};
  try {
    const current = offerings.current;
    const coachOffering = offerings.all?.["coach"];

    if (current?.monthly?.product?.priceString)
      prices.monthly = current.monthly.product.priceString;
    if (current?.annual?.product?.priceString)
      prices.yearly = current.annual.product.priceString;
    if (coachOffering?.monthly?.product?.priceString)
      prices.coach_monthly = coachOffering.monthly.product.priceString;
    if (coachOffering?.annual?.product?.priceString)
      prices.coach_yearly = coachOffering.annual.product.priceString;
  } catch (e) {
    console.error("[PaywallModal] extractPrices error:", e);
  }
  return prices;
}

// Vista para usuarios invitados — pedir que creen cuenta
function GuestView({ onClose }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
      <div style={{
        fontFamily: "'Barlow Condensed',sans-serif",
        fontSize: 24, fontWeight: 900, color: "#e8ff00",
        letterSpacing: 2, marginBottom: 8,
      }}>
        CREA TU CUENTA
      </div>
      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
        Esta función requiere una cuenta gratuita.{"\n"}
        Regístrate en segundos para acceder.
      </div>
      <button
        onClick={onClose}
        style={{
          width: "100%", padding: "14px 0", borderRadius: 12,
          background: "#e8ff00", color: "#000",
          fontWeight: 900, fontSize: 16, border: "none",
          cursor: "pointer",
          fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1,
        }}
      >
        CREAR CUENTA GRATIS
      </button>
      <button
        onClick={onClose}
        style={{
          width: "100%", marginTop: 8, padding: "10px 0",
          borderRadius: 12, background: "transparent",
          color: "rgba(255,255,255,0.25)", border: "none",
          cursor: "pointer", fontSize: 12,
        }}
      >
        Ahora no
      </button>
    </div>
  );
}

// Vista de un plan (Pro o Coach)
function PlanView({ plan, onClose, onSwitchPlan, otherPlanLabel, prices }) {
  const { user, updateUser } = useAuth();
  const { purchasePro, loading, error } = useBilling();
  const [tab, setTab] = useState("monthly");
  // Tiene otro plan de pago activo distinto a este
  const hasDifferentPaidPlan = user?.plan && PAID_PLANS.includes(user.plan) && user.plan !== plan.id;

  const selectedOption = tab === "monthly" ? plan.monthly : plan.yearly;

  function getPrice(option) {
    return prices?.[option.key] ?? option.fallbackPrice;
  }

  async function handlePurchase() {
    if (!user?.uid) return;
    const result = await purchasePro(user.uid, updateUser, selectedOption.key);
    if (result.ok) {
      if (result.plan === "pending" && result.msg) {
        // Google Play procesó la compra pero RC aún no confirmó. Avisamos y cerramos.
        alert(result.msg);
      }
      onClose();
    }
  }

  return (
    <>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>{plan.emoji}</div>
        <div style={{
          fontFamily: "'Barlow Condensed',sans-serif",
          fontSize: 26, fontWeight: 900,
          color: plan.color, letterSpacing: 2,
        }}>
          {plan.name}
        </div>
        <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, marginTop: 4 }}>
          Desbloquea todo el potencial
        </div>
      </div>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {plan.features.map((f, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 10, padding: "10px 14px",
          }}>
            <span style={{ fontSize: 20, minWidth: 28, textAlign: "center" }}>{f.icon}</span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: 500 }}>{f.text}</span>
          </div>
        ))}
      </div>

      {/* Tabs mensual / anual */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["monthly", "yearly"].map(t => {
          const opt = t === "monthly" ? plan.monthly : plan.yearly;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "12px 8px", borderRadius: 12,
                background: active ? `${plan.color}22` : "rgba(255,255,255,0.05)",
                border: `1.5px solid ${active ? plan.color : "rgba(255,255,255,0.1)"}`,
                cursor: "pointer", textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: active ? plan.color : "rgba(255,255,255,0.5)", fontWeight: 700 }}>
                {t === "monthly" ? "Mensual" : "Anual"}
              </div>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 900, marginTop: 2 }}>
                {getPrice(opt)}
              </div>
              {opt.badge && (
                <div style={{ fontSize: 10, color: plan.color, marginTop: 2 }}>{opt.badge}</div>
              )}
            </button>
          );
        })}
      </div>

      {/* Errores */}
      {error && (
        <div style={{ color: "#f97316", fontSize: 12, textAlign: "center", marginBottom: 12 }}>
          {error}
        </div>
      )}
      {/* Botón comprar o indicador de plan activo */}
      {user?.plan === plan.id ? (
        <>
          <div style={{
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 12, padding: "16px",
            textAlign: "center", marginBottom: 8,
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>✅</div>
            <div style={{ fontWeight: 800, color: "#22c55e", fontSize: 15 }}>
              Ya tienes este plan activo
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
              Gestiona tu suscripción desde Google Play
            </div>
          </div>
          {onSwitchPlan && (
            <button
              onClick={onSwitchPlan}
              style={{
                width: "100%", marginTop: 8, padding: "10px 0",
                borderRadius: 12, background: "transparent",
                color: plan.color,
                border: `1px solid ${plan.color}44`,
                cursor: "pointer", fontSize: 12, fontWeight: 700,
              }}
            >
              Ver plan {otherPlanLabel} →
            </button>
          )}
        </>
      ) : (
        <>
          {/* Aviso si ya tiene otro plan de pago activo */}
          {hasDifferentPaidPlan && (
            <div style={{
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
              borderRadius: 12, padding: "12px 14px", marginBottom: 10,
              display: "flex", alignItems: "flex-start", gap: 10,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fbbf24", marginBottom: 3 }}>
                  Ya tienes el plan {user.plan.charAt(0).toUpperCase() + user.plan.slice(1)} activo
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                  Para cambiar de plan, cancela tu suscripción actual desde Google Play y luego compra este.
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handlePurchase}
            disabled={loading}
            style={{
              width: "100%", padding: "14px 0", borderRadius: 12,
              background: loading ? `${plan.color}66` : plan.color,
              color: "#000", fontWeight: 900, fontSize: 16, border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1,
            }}
          >
            {loading ? "PROCESANDO..." : `HAZTE ${plan.id.toUpperCase()}`}
          </button>

          {/* Ver otro plan */}
          {onSwitchPlan && (
            <button
              onClick={onSwitchPlan}
              style={{
                width: "100%", marginTop: 8, padding: "10px 0",
                borderRadius: 12, background: "transparent",
                color: plan.color,
                border: `1px solid ${plan.color}44`,
                cursor: "pointer", fontSize: 12, fontWeight: 700,
              }}
            >
              Ver plan {otherPlanLabel} →
            </button>
          )}
        </>
      )}

      <button
        onClick={onClose}
        style={{
          width: "100%", marginTop: 6, padding: "10px 0",
          borderRadius: 12, background: "transparent",
          color: "rgba(255,255,255,0.25)", border: "none",
          cursor: "pointer", fontSize: 12,
        }}
      >
        Ahora no
      </button>

      <div style={{ textAlign: "center", marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.2)" }}>
        Cancela cuando quieras · Pago procesado por Google Play
      </div>
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function PaywallModal({ onClose, defaultPlan = "pro" }) {
  const { user } = useAuth();
  const [activePlan, setActivePlan] = useState(defaultPlan);
  const [prices, setPrices] = useState({});

  const isGuest = !user || user.isGuest || user.email === "__guest__";

  // Registrar visualización del paywall (clave para medir conversión).
  useEffect(() => { track("paywall_seen", { defaultPlan }); }, [defaultPlan]);

  // Obtener precios reales desde RevenueCat al abrir el modal
  useEffect(() => {
    if (isGuest || !Capacitor.isNativePlatform()) return;
    (async () => {
      try {
        const offerings = await Purchases.getOfferings();
        const extracted = extractPrices(offerings);
        if (Object.keys(extracted).length > 0) setPrices(extracted);
      } catch (e) {
        console.error("[PaywallModal] getOfferings error:", e);
        // Si falla, se muestran los precios fallback
      }
    })();
  }, [isGuest]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.85)",
        backdropFilter: "blur(6px)",
        zIndex: 99999,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 360,
          background: "#111",
          border: "1px solid rgba(232,255,0,0.25)",
          borderRadius: 20, padding: "28px 24px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {isGuest ? (
          <GuestView onClose={onClose} />
        ) : activePlan === "pro" ? (
          <PlanView
            plan={PLANS.pro}
            onClose={onClose}
            onSwitchPlan={() => setActivePlan("coach")}
            otherPlanLabel="Coach"
            prices={prices}
          />
        ) : (
          <PlanView
            plan={PLANS.coach}
            onClose={onClose}
            onSwitchPlan={() => setActivePlan("pro")}
            otherPlanLabel="Pro"
            prices={prices}
          />
        )}
      </div>
    </div>
  );
}