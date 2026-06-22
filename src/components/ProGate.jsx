// ProGate.jsx — Wrapper para bloquear features por plan
//
// Uso básico:
//   <ProGate required="pro">
//     <StatsProModal />
//   </ProGate>
//
// Uso con UI inline (no modal):
//   <ProGate required="pro" inline label="Estadísticas avanzadas">
//     <MiGrafico />
//   </ProGate>

import { useState } from "react";
import { usePlan } from "./usePlan";
import PaywallModal from "./PaywallModal";

export default function ProGate({ required = "pro", children, inline = false, label = "Esta función" }) {
  const { canAccess } = usePlan();
  const [showPaywall, setShowPaywall] = useState(false);

  // Si tiene acceso, renderiza directamente
  if (canAccess(required)) return children;

  // Bloqueo inline — muestra un banner dentro del layout
  if (inline) {
    return (
      <>
        {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
        <div
          onClick={() => setShowPaywall(true)}
          style={{
            position: "relative",
            borderRadius: 14,
            overflow: "hidden",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {/* Contenido borroso detrás */}
          <div style={{ filter: "blur(4px)", pointerEvents: "none", opacity: 0.4 }}>
            {children}
          </div>

          {/* Overlay de bloqueo */}
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(2px)",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 8, borderRadius: 14,
            border: "1px solid rgba(223,255,0,0.2)",
          }}>
            <span style={{ fontSize: 28 }}>🔒</span>
            <span style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 13, fontWeight: 700,
              color: "rgba(255,255,255,0.7)",
              letterSpacing: 1, textTransform: "uppercase",
            }}>
              {label}
            </span>
            <span style={{
              background: "#DFFF00", color: "#000",
              fontSize: 11, fontWeight: 900,
              padding: "4px 12px", borderRadius: 20,
              letterSpacing: 1,
              fontFamily: "'Barlow Condensed', sans-serif",
            }}>
              HAZTE PRO
            </span>
          </div>
        </div>
      </>
    );
  }

  // Bloqueo modal — al hacer clic abre el paywall
  return (
    <>
      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
      <div onClick={() => setShowPaywall(true)} style={{ cursor: "pointer" }}>
        {children}
      </div>
    </>
  );
}


// ─── Hook standalone para abrir el paywall manualmente ───────────────────────
// Uso: const { gate, PaywallIfNeeded } = useProGate("pro");
//      if (!gate()) return; // bloquea y abre paywall
//      <PaywallIfNeeded />

export function useProGate(required = "pro") {
  const { canAccess } = usePlan();
  const [show, setShow] = useState(false);

  // Llama a gate() antes de ejecutar acción pro
  // Retorna true si tiene acceso, false si no (y abre el paywall)
  const gate = () => {
    if (canAccess(required)) return true;
    setShow(true);
    return false;
  };

  const PaywallIfNeeded = () =>
    show ? <PaywallModal onClose={() => setShow(false)} /> : null;

  return { gate, PaywallIfNeeded, canAccess: canAccess(required) };
}