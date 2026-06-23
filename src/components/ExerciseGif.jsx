import { useState, useContext, createContext } from "react";
import GIF_MAP from "../assets/gif/gifMap.js";
import { EXERCISE_DB } from "../exerciseDb";

// Este contexto se crea en App.jsx y se provee desde ahí.
// Lo exportamos para que App.jsx pueda importarlo.
export const CustomGifCtx = createContext({ gifs: {}, setGif: () => {} });
export const useCustomGifs = () => useContext(CustomGifCtx);

export default function ExerciseGif({ exName, size = 120 }) {
  const [expanded, setExpanded] = useState(false);
  const { gifs } = useCustomGifs();
  const src = gifs[exName] || GIF_MAP[exName];

  // Placeholder cuando no hay GIF
  if (!src || !exName || exName === "__custom__") {
    if (!exName || exName === "__custom__") return null;
    const muscle = EXERCISE_DB.find(e => e.name === exName)?.muscle || "";
    const muscleIcon = {
      Pecho: "💪", Espalda: "🔙", Hombros: "🏋️", Bíceps: "💪",
      Tríceps: "💪", Cuádriceps: "🦵", Femoral: "🦵", Glúteos: "🍑",
      Pantorrillas: "🦵", Core: "🎯", Cardio: "🏃",
    }[muscle] || "🏋️";

    return (
      <div style={{
        width: size, height: size,
        borderRadius: size > 60 ? 16 : 10,
        border: "2px dashed var(--border)",
        background: "var(--input-bg)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
        fontSize: size > 60 ? size * 0.35 : size * 0.45,
        color: "var(--text-muted)",
        opacity: 0.5,
      }}>
        {muscleIcon}
      </div>
    );
  }

  return (
    <>
      <img
        src={src}
        alt={exName}
        onClick={() => setExpanded(true)}
        style={{
          width: size, height: size,
          borderRadius: 16, objectFit: "cover",
          border: "2px solid var(--border)",
          flexShrink: 0,
          background: "var(--input-bg)",
          cursor: "zoom-in",
          mixBlendMode: "luminosity",
          transition: "transform 0.2s, border-color 0.2s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "scale(1.04)";
          e.currentTarget.style.borderColor = "var(--accent)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "scale(1)";
          e.currentTarget.style.borderColor = "var(--border)";
        }}
        onError={e => { e.target.style.display = "none"; }}
      />

      {expanded && (
        <div
          onClick={() => setExpanded(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.88)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, cursor: "zoom-out",
            backdropFilter: "blur(10px)",
            animation: "fadeIn 0.2s ease",
          }}
        >
          <div onClick={e => e.stopPropagation()} style={{ textAlign: "center", padding: 24 }}>
            <img
              src={src}
              alt={exName}
              style={{
                maxWidth: "80vw", maxHeight: "65vh",
                borderRadius: 20,
                border: "2px solid var(--accent)",
                boxShadow: "0 0 60px rgba(59,130,246,0.3)",
              }}
            />
            <div style={{
              color: "white", marginTop: 16,
              fontFamily: "Inter, sans-serif",
              fontSize: 28, fontWeight: 800, letterSpacing: 1,
            }}>
              {exName}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, marginTop: 6 }}>
              Toca en cualquier lugar para cerrar
            </div>
          </div>
        </div>
      )}
    </>
  );
}