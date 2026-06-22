// Uso en Dashboard:
//   <StatsBanner isPro={isPro} onProClick={onStatsProClick} onUnlocked={onStatsProClick} />

import { useState, useEffect } from "react";
import { showRewardedAd } from "../useAdMob";

const UNLOCK_KEY = "gym_statspro_unlock";

export function isStatsUnlocked() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (!raw) return false;
    const { until } = JSON.parse(raw);
    return Date.now() < until;
  } catch { return false; }
}

function setStatsUnlocked() {
  try {
    const until = Date.now() + 1 * 60 * 60 * 1000;
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ until }));
  } catch {}
}

export default function StatsBanner({ isPro, onProClick, onUnlocked, onVideoUnlocked }) {
  const [loading, setLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(isStatsUnlocked);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!unlocked) return;
    const tick = () => {
      const raw = localStorage.getItem(UNLOCK_KEY);
      if (!raw) { setUnlocked(false); setTimeLeft(""); return; }
      const { until } = JSON.parse(raw);
      const diff = until - Date.now();
      if (diff <= 0) { setUnlocked(false); setTimeLeft(""); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [unlocked]);

  async function handleWatchVideo() {
  setLoading(true);
  const rewarded = await showRewardedAd();
  setLoading(false);
  if (rewarded) {
    setStatsUnlocked();
    setUnlocked(true);
    onVideoUnlocked?.();
  }
}

  // Si es Pro → botón simple
  if (isPro) {
    return (
      <div onClick={onProClick} style={{
        marginBottom: 20,
        background: "linear-gradient(135deg, rgba(223,255,0,0.07) 0%, rgba(223,255,0,0.03) 100%)",
        border: "1px solid rgba(223,255,0,0.2)",
        borderRadius: 16, padding: 16, cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ background:"rgba(223,255,0,0.15)", border:"1px solid rgba(223,255,0,0.3)", borderRadius:6, padding:"1px 7px", fontSize:10, fontWeight:800, color:"var(--accent)", letterSpacing:2, fontFamily:"Barlow Condensed, sans-serif" }}>PRO</span>
            <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:17, fontWeight:800 }}>Estadísticas Avanzadas</span>
          </div>
          <div style={{ fontSize:12, color:"var(--text-muted)" }}>Gráficos · Radar muscular · Metas · Alertas</div>
        </div>
        <span style={{ fontSize:22, color:"var(--accent)" }}>📊</span>
      </div>
    );
  }

  // Si ya desbloqueó con video → acceso activo
  if (unlocked) {
    return (
      <div onClick={onVideoUnlocked || onUnlocked} style={{
        marginBottom: 20,
        background: "linear-gradient(135deg, rgba(34,197,94,0.08) 0%, rgba(34,197,94,0.03) 100%)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: 16, padding: 16, cursor: "pointer",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ background:"rgba(34,197,94,0.15)", border:"1px solid rgba(34,197,94,0.3)", borderRadius:6, padding:"1px 7px", fontSize:10, fontWeight:800, color:"#22c55e", letterSpacing:2, fontFamily:"Barlow Condensed, sans-serif" }}>✅ {timeLeft ? timeLeft : "ACTIVO"}</span>
            <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:17, fontWeight:800 }}>Estadísticas Avanzadas</span>
          </div>
          <div style={{ fontSize:12, color:"var(--text-muted)" }}>Toca para ver tus gráficos</div>
        </div>
        <span style={{ fontSize:22 }}>📊</span>
      </div>
    );
  }

  // Free → dos botones
  return (
    <div style={{
      marginBottom: 20,
      background: "linear-gradient(135deg, rgba(223,255,0,0.07) 0%, rgba(223,255,0,0.03) 100%)",
      border: "1px solid rgba(223,255,0,0.2)",
      borderRadius: 16, padding: 16,
    }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
            <span style={{ background:"rgba(223,255,0,0.15)", border:"1px solid rgba(223,255,0,0.3)", borderRadius:6, padding:"1px 7px", fontSize:10, fontWeight:800, color:"var(--accent)", letterSpacing:2, fontFamily:"Barlow Condensed, sans-serif" }}>PRO</span>
            <span style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:17, fontWeight:800 }}>Estadísticas Avanzadas</span>
          </div>
          <div style={{ fontSize:12, color:"var(--text-muted)" }}>Gráficos · Radar muscular · Metas · Alertas</div>
        </div>
        <span style={{ fontSize:22, color:"var(--accent)" }}>📊</span>
      </div>

      <div style={{ display:"flex", gap:8 }}>
        {/* Botón principal — hazte pro */}
        <button onClick={onProClick} style={{
          flex: 2, padding:"10px 0", borderRadius:10,
          background:"#DFFF00", border:"none",
          fontFamily:"Barlow Condensed, sans-serif",
          fontSize:13, fontWeight:900, color:"#000",
          letterSpacing:1, cursor:"pointer",
        }}>
          ⚡ HAZTE PRO
        </button>

        {/* Botón secundario — ver video */}
        <button onClick={handleWatchVideo} disabled={loading} style={{
          flex: 2, padding:"10px 0", borderRadius:10,
          background:"rgba(255,255,255,0.06)",
          border:"1px solid rgba(255,255,255,0.15)",
          fontFamily:"Barlow Condensed, sans-serif",
          fontSize:13, fontWeight:700,
          color:"rgba(255,255,255,0.7)",
          cursor: loading ? "wait" : "pointer",
          display:"flex", alignItems:"center", justifyContent:"center", gap:6,
        }}>
          {loading ? "⏳ Cargando..." : "▶ Ver video — 1h gratis"}
        </button>
      </div>
    </div>
  );
}