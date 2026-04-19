import { useState, useEffect, useRef, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Media } from "@capacitor-community/media";
import { fmtDate } from "../utils/helpers";

const THEMES = [
  {
    id: "classic", label: "Clásico", emoji: "⚡",
    bg1: "#05050a", bg2: "rgba(20,15,0,1)", bg3: "rgba(0,15,5,1)",
    accent: "#e8ff00", accentDim: "rgba(232,255,0,", isLight: false,
  },
  {
    id: "neon", label: "Neón", emoji: "🟣",
    bg1: "#08010f", bg2: "rgba(15,0,25,1)", bg3: "rgba(5,0,20,1)",
    accent: "#c084fc", accentDim: "rgba(192,132,252,", isLight: false,
  },
  {
    id: "fire", label: "Fuego", emoji: "🔥",
    bg1: "#0a0200", bg2: "rgba(25,5,0,1)", bg3: "rgba(15,3,0,1)",
    accent: "#f97316", accentDim: "rgba(249,115,22,", isLight: false,
  },
  {
    id: "minimal", label: "Minimal", emoji: "☁️",
    bg1: "#f0f0f0", bg2: "rgba(245,245,245,1)", bg3: "rgba(235,235,235,1)",
    accent: "#111111", accentDim: "rgba(17,17,17,", isLight: true,
  },
];

function getMotivationalMsg(userName, workout) {
  const name = userName?.split(" ")[0] || "atleta";
  const w = workout || "sesión";
  const msgs = [
    `${name} no para. ${w} completado. 🔥`,
    `Otro día, otro entrenamiento. Así se construye. 💪`,
    `${name} en modo bestia. ${w} destruido. ⚡`,
    `Constancia es el secreto. ${name} lo sabe. 🏆`,
    `El que entrena hoy gana mañana. 🚀`,
    `${w} completado. El gym no miente. 💯`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function drawCard(canvas, t, session, user, epicMsg) {
  const ctx = canvas.getContext("2d");
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, t.bg1); bg.addColorStop(0.5, t.bg2); bg.addColorStop(1, t.bg3);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = `${t.accentDim}0.04)`; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Orb
  const orb = ctx.createRadialGradient(W/2, H*0.4, 0, W/2, H*0.4, 500);
  orb.addColorStop(0, `${t.accentDim}0.15)`); orb.addColorStop(1, "transparent");
  ctx.fillStyle = orb; ctx.fillRect(0, 0, W, H);

  // Noise
  if (!t.isLight) for (let i = 0; i < 20000; i++) {
    ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.018})`;
    ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1);
  }

  // Top bar
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0, "transparent"); topBar.addColorStop(0.15, t.accent);
  topBar.addColorStop(0.5, t.isLight ? t.accent : "#fff");
  topBar.addColorStop(0.85, t.accent); topBar.addColorStop(1, "transparent");
  ctx.shadowColor = t.accent; ctx.shadowBlur = 24;
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, W, 4); ctx.shadowBlur = 0;

  // Brand
  ctx.font = "600 26px Arial";
  ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.15)";
  ctx.fillText("⚡  G Y M T R A C K E R", 64, 72);

  // Date
  ctx.font = "400 28px Arial";
  ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)";
  ctx.fillText(fmtDate(session.date).toUpperCase(), 64, 116);

  // Workout name
  const wname = (session.workout || "SESIÓN").toUpperCase();
  const displayName = wname.length > 14 ? wname.slice(0,14)+"…" : wname;
  ctx.font = "900 100px 'Arial Black', Arial";
  ctx.fillStyle = t.isLight ? "#111" : "#fff";
  ctx.shadowColor = `${t.accentDim}0.4)`; ctx.shadowBlur = 40;
  ctx.fillText(displayName, 64, 230); ctx.shadowBlur = 0;

  // Underline
  const ul = ctx.createLinearGradient(64, 0, 500, 0);
  ul.addColorStop(0, t.accent); ul.addColorStop(0.6, `${t.accentDim}0.3)`); ul.addColorStop(1, "transparent");
  ctx.fillStyle = ul; ctx.fillRect(64, 248, 460, 4);

  // Stats cards
  const totalVol = (session.exercises||[]).reduce((acc,ex) =>
    acc + (ex.sets?.length>0 ? ex.sets.reduce((s,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+s,0) : (parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1)), 0);
  const totalSets = (session.exercises||[]).reduce((acc,ex) => acc+(ex.sets?.length||1), 0);
  const volLabel = totalVol >= 1000 ? `${(totalVol/1000).toFixed(1)}t` : `${Math.round(totalVol)}kg`;

  const statsData = [
    { label: "EJERCICIOS", value: String((session.exercises||[]).length) },
    { label: "SERIES",     value: String(totalSets) },
    { label: "VOLUMEN",    value: volLabel },
  ];

  const cardY = 290, cardH = 170, cardW = (W - 128 - 32) / 3;
  statsData.forEach((st, i) => {
    const x = 64 + i * (cardW + 16);
    ctx.fillStyle = `${t.accentDim}0.08)`;
    ctx.beginPath(); ctx.roundRect(x, cardY, cardW, cardH, 16); ctx.fill();
    const border = ctx.createLinearGradient(x, cardY, x+cardW, cardY+cardH);
    border.addColorStop(0, `${t.accentDim}0.5)`); border.addColorStop(1, `${t.accentDim}0.1)`);
    ctx.strokeStyle = border; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.roundRect(x, cardY, cardW, cardH, 16); ctx.stroke();
    ctx.font = "900 64px 'Arial Black', Arial";
    ctx.fillStyle = t.accent;
    ctx.shadowColor = t.accent; ctx.shadowBlur = 20;
    ctx.fillText(st.value, x+24, cardY+90); ctx.shadowBlur = 0;
    ctx.font = "600 20px Arial";
    ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
    ctx.fillText(st.label, x+24, cardY+130);
  });

  // Exercise list
  const exes = (session.exercises||[]).slice(0, 5);
  const listY = 500;
  ctx.font = "700 22px Arial";
  ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)";
  ctx.fillText("EJERCICIOS", 64, listY);

  ctx.fillStyle = `${t.accentDim}0.06)`;
  ctx.beginPath(); ctx.roundRect(64, listY+16, W-128, exes.length*80+24, 16); ctx.fill();

  exes.forEach((ex, i) => {
    const y = listY + 68 + i * 80;
    ctx.fillStyle = t.accent;
    ctx.shadowColor = t.accent; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(100, y-14, 7, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.font = "700 32px Arial";
    ctx.fillStyle = t.isLight ? "#111" : "#fff";
    const exLabel = ex.name.length > 24 ? ex.name.slice(0,24)+"…" : ex.name;
    ctx.fillText(exLabel, 126, y);
    ctx.font = "400 22px Arial";
    ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.35)";
    const detail = ex.sets?.length>0 ? `${ex.sets.length} series` : (ex.weight ? `${ex.weight}kg × ${ex.reps} reps` : "");
    ctx.fillText(detail, 126, y+30);
  });

  if ((session.exercises||[]).length > 5) {
    ctx.font = "italic 24px Arial";
    ctx.fillStyle = `${t.accentDim}0.6)`;
    ctx.textAlign = "center";
    ctx.fillText(`+ ${(session.exercises||[]).length - 5} más`, W/2, listY + 16 + exes.length*80 + 36);
    ctx.textAlign = "left";
  }

  // Epic message
  ctx.font = "italic 600 28px Arial";
  ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)";
  ctx.textAlign = "center";
  ctx.fillText(`"${epicMsg}"`, W/2, H - 180); ctx.textAlign = "left";

  // Footer
  const botY = H - 140;
  const sep = ctx.createLinearGradient(64, 0, W-64, 0);
  sep.addColorStop(0, "transparent"); sep.addColorStop(0.2, `${t.accentDim}0.4)`);
  sep.addColorStop(0.8, `${t.accentDim}0.4)`); sep.addColorStop(1, "transparent");
  ctx.fillStyle = sep; ctx.fillRect(64, botY, W-128, 1);

  ctx.font = "400 22px Arial";
  ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.2)";
  ctx.fillText(new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"}).toUpperCase(), 64, botY+40);

  ctx.shadowColor = t.accent; ctx.shadowBlur = 20;
  ctx.font = "900 44px 'Arial Black', Arial";
  ctx.fillStyle = t.accent;
  ctx.fillText(`@${user?.name || "atleta"}`, 64, botY+92); ctx.shadowBlur = 0;

  ctx.shadowColor = t.accent; ctx.shadowBlur = 24;
  ctx.fillStyle = topBar; ctx.fillRect(0, H-4, W, 4); ctx.shadowBlur = 0;
}

export default function ShareCardModal({ session, user, unit, onClose }) {
  const canvasRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("classic");
  const theme = THEMES.find(t => t.id === selectedTheme) || THEMES[0];
  const defaultMsg = useMemo(() => getMotivationalMsg(user?.name, session?.workout), []);
  const epicMsg = defaultMsg;
  const [customMsg, setCustomMsg] = useState(defaultMsg);

  useEffect(() => {
    if (canvasRef.current) drawCard(canvasRef.current, theme, session, user, customMsg);
  }, [selectedTheme, customMsg]);

  const [saved, setSaved] = useState(false);

  async function handleShare() {
    setDownloading(true);
    const canvas = canvasRef.current;
    const fileName = `gymtracker_${session.date}.png`;
    try {
      if (Capacitor.isNativePlatform()) {
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: `${session.workout || "Sesión"} 💪`, text: customMsg, url: uri, dialogTitle: "Compartir sesión" });
      } else {
        const a = document.createElement("a");
        a.download = fileName; a.href = canvas.toDataURL("image/png"); a.click();
      }
    } catch(e) { console.error(e); }
    setDownloading(false);
  }

  async function handleDownload() {
    if (!Capacitor.isNativePlatform()) {
      const a = document.createElement("a");
      a.download = `gymtracker_${session.date}.png`;
      a.href = canvasRef.current.toDataURL("image/png");
      a.click();
      return;
    }
    try {
      const fileName = `gymtracker_${session.date}_${Date.now()}.png`;
      const base64 = canvasRef.current.toDataURL("image/png").split(",")[1];
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });

      // Buscar o crear álbum GymTracker
      const { albums } = await Media.getAlbums();
      let album = albums.find(a => a.name === "GymTracker");
      if (!album) {
        await Media.createAlbum({ name: "GymTracker" });
        const { albums: updated } = await Media.getAlbums();
        album = updated.find(a => a.name === "GymTracker");
      }

      await Media.savePhoto({ path: uri, albumIdentifier: album.identifier });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      console.error(e);
      alert("Error: " + e.message + " | " + JSON.stringify(e));
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e=>e.stopPropagation()} style={{ maxHeight:"90vh", overflowY:"auto", maxWidth:520 }}>
        <div className="modal-header">
          <h3 className="modal-title">📸 Compartir sesión</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Theme selector */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:10 }}>Tema</div>
          <div style={{ display:"flex", gap:8 }}>
            {THEMES.map(t => {
              const active = selectedTheme === t.id;
              return (
                <button key={t.id} onClick={() => setSelectedTheme(t.id)} style={{
                  flex:1, padding:"8px 4px", borderRadius:10,
                  border: active ? `2px solid ${t.accent}` : "2px solid rgba(255,255,255,0.08)",
                  background: active
                    ? (t.id === "minimal" ? "rgba(255,255,255,0.85)" : `${t.accentDim}0.12)`)
                    : "rgba(255,255,255,0.03)",
                  color: active
                    ? (t.id === "minimal" ? "#111" : t.accent)
                    : "var(--text-muted)",
                  fontSize:11, fontWeight:700, cursor:"pointer",
                  display:"flex", flexDirection:"column", alignItems:"center", gap:4,
                  transition:"all 0.15s",
                }}>
                  <span style={{ fontSize:18 }}>{t.emoji}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <canvas ref={canvasRef} style={{ width:"100%", borderRadius:12, border:"1px solid var(--border)", display:"block", marginBottom:16 }} />

        {/* Mensaje personalizado */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"var(--text-muted)", textTransform:"uppercase", marginBottom:8 }}>Mensaje</div>
          <textarea
            value={customMsg}
            onChange={e => setCustomMsg(e.target.value)}
            maxLength={300}
            rows={3}
            style={{
              width:"100%", background:"var(--input-bg)", border:"1px solid var(--border)",
              borderRadius:10, padding:"10px 12px", color:"var(--text)",
              fontFamily:"Barlow, sans-serif", fontSize:13, lineHeight:1.5,
              resize:"none", outline:"none", boxSizing:"border-box",
            }}
          />
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:4 }}>
            <button onClick={() => setCustomMsg(defaultMsg)} style={{ background:"none", border:"none", color:"var(--text-muted)", fontSize:11, cursor:"pointer", padding:0 }}>
              ↺ Restaurar mensaje
            </button>
            <span style={{ fontSize:11, color:"var(--text-muted)" }}>{customMsg.length}/300</span>
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button className="btn-primary" style={{ flex:2, fontSize:14 }} onClick={handleShare} disabled={downloading}>
            {downloading ? "⏳ Preparando..." : "📤 Compartir"}
          </button>
          {Capacitor.isNativePlatform() && (
            <button className="btn-ghost" style={{ flex:1, fontSize:14 }} onClick={handleDownload}>
              {saved ? "✅ Guardada" : "⬇️ Guardar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}