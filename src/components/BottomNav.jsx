import { Home, TrendingUp, Dumbbell, Users, User } from "lucide-react";

// Barra de navegación inferior (Android-first). 5 destinos con "Entrenar" como
// botón central elevado (FAB). Dispara las acciones que ya existen en GymApp.
export default function BottomNav({ active, onHome, onProgress, onTrain, onCommunity, onProfile }) {
  const side = [
    { id: "home", Icon: Home, label: "Inicio", onClick: onHome },
    { id: "progress", Icon: TrendingUp, label: "Progreso", onClick: onProgress },
    null, // hueco para el FAB central
    { id: "community", Icon: Users, label: "Comunidad", onClick: onCommunity },
    { id: "profile", Icon: User, label: "Perfil", onClick: onProfile },
  ];

  return (
    <nav className="bottom-nav mobile-only">
      {side.map((it, i) =>
        it === null ? (
          <button key="fab" className="bn-fab-wrap" onClick={onTrain} aria-label="Entrenar">
            <span className="bn-fab"><Dumbbell size={24} color="#09090B" strokeWidth={2.6} /></span>
            <span className="bn-fab-label">Entrenar</span>
          </button>
        ) : (
          <button
            key={it.id}
            className={`bn-btn ${active === it.id ? "active" : ""}`}
            onClick={it.onClick}
          >
            <it.Icon size={21} strokeWidth={active === it.id ? 2.5 : 2} />
            <span>{it.label}</span>
          </button>
        )
      )}
    </nav>
  );
}
