// Mapea los emojis de navegación a iconos Lucide (profesionalización visual,
// Fase 23/24). No cambia los datos de los menús: se usa en el punto de render.
// Si un emoji no está mapeado, cae de vuelta al propio emoji (sin romper nada).
import {
  Dumbbell, History, LayoutDashboard, Calendar, FileText, Users, Flag,
  Handshake, Star, TrendingUp, Scale, Settings, Award, Camera, Share2, LogOut,
} from "lucide-react";

const MAP = {
  "⚡": Dumbbell,
  "📋": History,
  "📊": LayoutDashboard,
  "📅": Calendar,
  "📄": FileText,
  "👥": Users,
  "🏁": Flag,
  "🤝": Handshake,
  "🌟": Star,
  "📈": TrendingUp,
  "⚖️": Scale,
  "⚙️": Settings,
  "🏅": Award,
  "📸": Camera,
  "📲": Share2,
  "🚪": LogOut,
};

export default function NavIcon({ e, size = 18, strokeWidth = 2, ...props }) {
  const Icon = MAP[e];
  if (!Icon) return <span>{e}</span>;
  return <Icon size={size} strokeWidth={strokeWidth} {...props} />;
}
