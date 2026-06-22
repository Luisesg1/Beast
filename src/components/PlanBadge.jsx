// PlanBadge.jsx — Badge visual del plan actual
// Uso: <PlanBadge /> — muestra FREE / PRO / COACH / GYM

import { usePlan } from "./usePlan";

const PLAN_STYLE = {
  guest: { label: "INVITADO", bg: "#333",       color: "#aaa",    icon: "👤" },
  free:  { label: "FREE",     bg: "#1a1a1a",    color: "#aaa",    icon: null },
  pro:   { label: "PRO",      bg: "#DFFF00",    color: "#000",    icon: "⚡" },
  coach: { label: "COACH",    bg: "#8b5cf6",    color: "#fff",    icon: "🎯" },
  gym:   { label: "GYM",      bg: "#f97316",    color: "#fff",    icon: "🏋️" },
};

export default function PlanBadge({ style = {} }) {
  const { plan } = usePlan();
  const s = PLAN_STYLE[plan] || PLAN_STYLE.free;

  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      background: s.bg, color: s.color,
      fontSize: 10, fontWeight: 900,
      padding: "3px 8px", borderRadius: 20,
      letterSpacing: 1.5,
      fontFamily: "'Barlow Condensed', sans-serif",
      ...style,
    }}>
      {s.icon && <span style={{ fontSize: 10 }}>{s.icon}</span>}
      {s.label}
    </span>
  );
}