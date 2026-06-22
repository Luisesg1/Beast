import { useState, useEffect, useRef, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Media } from "@capacitor-community/media";

const THEMES = [
  {
    id: "classic", label: "Clásico", emoji: "⚡",
    bg1: "#05050a", bg2: "rgba(20,15,0,1)", bg3: "rgba(0,15,5,1)",
    accent: "#DFFF00", accentDim: "rgba(223,255,0,",
    titleWord1: "#ffffff", titleWord2: "#DFFF00",
    pillBg: "#DFFF00", pillText: "#05050a", isLight: false,
  },
  {
    id: "neon", label: "Neón", emoji: "🟣",
    bg1: "#08010f", bg2: "rgba(15,0,25,1)", bg3: "rgba(5,0,20,1)",
    accent: "#c084fc", accentDim: "rgba(192,132,252,",
    titleWord1: "#ffffff", titleWord2: "#c084fc",
    pillBg: "#c084fc", pillText: "#08010f", isLight: false,
  },
  {
    id: "fire", label: "Fuego", emoji: "🔥",
    bg1: "#0a0200", bg2: "rgba(25,5,0,1)", bg3: "rgba(15,3,0,1)",
    accent: "#f97316", accentDim: "rgba(249,115,22,",
    titleWord1: "#ffffff", titleWord2: "#fb923c",
    pillBg: "#f97316", pillText: "#0a0200", isLight: false,
  },
  {
    id: "minimal", label: "Minimal", emoji: "⬜",
    bg1: "#f0f0f0", bg2: "rgba(245,245,245,1)", bg3: "rgba(235,235,235,1)",
    accent: "#111111", accentDim: "rgba(17,17,17,",
    titleWord1: "#111111", titleWord2: "#111111",
    pillBg: "#111111", pillText: "#f0f0f0", isLight: true,
  },
];

function getEpicMessage(prs, userName) {
  const name = userName?.split(" ")[0] || "atleta";
  const pr = prs[0];
  const msgs = [
    `${name} no para. ${pr?.rm}kg y subiendo. 🔥`,
    `Nuevo límite desbloqueado. ${pr?.name} nunca fue lo mismo.`,
    `${pr?.rm}kg. El gym lo recuerda. 💪`,
    `Récord roto. ${name} en modo bestia. ⚡`,
    `${name} llegó, levantó y conquistó. 🏆`,
    `Eso no era el techo. Era el piso. 🚀`,
  ];
  return msgs[Math.floor(Math.random() * msgs.length)];
}

function renderCard(ctx, t, prs, user, epicMsg, photoImg) {
  const W = 1080, H = 1080;

  ctx.fillStyle = t.bg1; ctx.fillRect(0, 0, W, H);
  const dw = ctx.createLinearGradient(0, 0, W, H);
  dw.addColorStop(0, t.bg2); dw.addColorStop(0.45, t.bg1); dw.addColorStop(1, t.bg3);
  ctx.fillStyle = dw; ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = `${t.accentDim}0.05)`; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  const orb = ctx.createRadialGradient(W/2, H*0.38, 0, W/2, H*0.38, 520);
  orb.addColorStop(0, `${t.accentDim}0.18)`); orb.addColorStop(0.3, `${t.accentDim}0.07)`); orb.addColorStop(1, "transparent");
  ctx.fillStyle = orb; ctx.fillRect(0,0,W,H);

  const tl = ctx.createRadialGradient(0,0,0,0,0,400);
  tl.addColorStop(0, `${t.accentDim}0.1)`); tl.addColorStop(1, "transparent");
  ctx.fillStyle = tl; ctx.fillRect(0,0,W,H);

  if (!t.isLight) for (let i = 0; i < 25000; i++) { ctx.fillStyle = `rgba(255,255,255,${Math.random()*0.022})`; ctx.fillRect(Math.random()*W, Math.random()*H, 1, 1); }

  const topBar = ctx.createLinearGradient(0,0,W,0);
  topBar.addColorStop(0,"transparent"); topBar.addColorStop(0.15,t.accent);
  topBar.addColorStop(0.5, t.isLight ? t.accent : "#fff"); topBar.addColorStop(0.85,t.accent); topBar.addColorStop(1,"transparent");
  ctx.shadowColor = t.accent; ctx.shadowBlur = 24; ctx.fillStyle = topBar; ctx.fillRect(0,0,W,4); ctx.shadowBlur = 0;

  ctx.font = "600 26px Arial"; ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.15)";
  ctx.fillText("⚡  G Y M T R A C K E R", 64, 72);

  ctx.save(); ctx.font = "900 520px 'Arial Black',Arial"; ctx.fillStyle = `${t.accentDim}0.04)`;
  ctx.textAlign = "center"; ctx.fillText("PR", W/2, H*0.72); ctx.textAlign = "left"; ctx.restore();

  ctx.save();
  ctx.font = "900 88px 'Arial Black',Arial"; ctx.fillStyle = t.titleWord1;
  ctx.shadowColor = `${t.accentDim}0.5)`; ctx.shadowBlur = 40; ctx.fillText("NUEVO", 64, 200); ctx.shadowBlur = 0;
  ctx.fillStyle = t.titleWord2; ctx.shadowColor = t.accent; ctx.shadowBlur = 50; ctx.fillText("RÉCORD", 64, 298); ctx.shadowBlur = 0;
  ctx.font = "700 32px Arial"; ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)";
  ctx.fillText("PERSONAL", 68, 336); ctx.restore();

  const ul = ctx.createLinearGradient(64,0,484,0);
  ul.addColorStop(0,t.accent); ul.addColorStop(0.6,`${t.accentDim}0.3)`); ul.addColorStop(1,"transparent");
  ctx.fillStyle = ul; ctx.fillRect(64,350,420,3);

  ctx.save(); ctx.shadowColor = t.accent; ctx.shadowBlur = 80; ctx.font = "200px serif"; ctx.fillText("🏆", W-340, 340); ctx.restore();

  // Layout dinámico: calcular cardH según cuántos PRs hay
  const topPRs = prs.slice(0, 3);
  const n = topPRs.length;
  const hasExtra = prs.length > 3;
  const showEpic = n <= 2; // ocultar texto épico si hay 3+ PRs para que entre todo
  const footerH = 148; // altura del footer (@usuario + fecha)
  const epicH = showEpic ? 60 : 0;
  const extraH = hasExtra ? 44 : 0;
  const startY = 400, endY = H - footerH - epicH - extraH - 16;
  const totalGaps = (n - 1) * 16;
  const cardH = Math.floor((endY - startY - totalGaps) / n);

  topPRs.forEach((pr, i) => {
    const y = startY + i*(cardH+16), x = 64, cW = W-128;
    ctx.shadowColor = `${t.accentDim}0.35)`; ctx.shadowBlur = 30;
    ctx.fillStyle = t.isLight ? "rgba(255,255,255,0.85)" : `${t.accentDim}0.001)`; ctx.beginPath(); ctx.roundRect(x,y,cW,cardH,20); ctx.fill(); ctx.shadowBlur = 0;
    const cb = ctx.createLinearGradient(x,y,x+cW,y+cardH);
    cb.addColorStop(0, t.isLight ? "rgba(255,255,255,0.95)" : `${t.accentDim}0.10)`);
    cb.addColorStop(0.5, t.isLight ? "rgba(248,248,248,0.9)" : `${t.accentDim}0.05)`);
    cb.addColorStop(1, t.isLight ? "rgba(240,240,240,0.85)" : `${t.accentDim}0.02)`);
    ctx.fillStyle = cb; ctx.beginPath(); ctx.roundRect(x,y,cW,cardH,20); ctx.fill();
    const bg = ctx.createLinearGradient(x,y,x+cW,y+cardH);
    bg.addColorStop(0,`${t.accentDim}0.6)`); bg.addColorStop(0.5,`${t.accentDim}0.2)`); bg.addColorStop(1,`${t.accentDim}0.5)`);
    ctx.strokeStyle = bg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x,y,cW,cardH,20); ctx.stroke();
    ctx.shadowColor = t.accent; ctx.shadowBlur = 20;
    const sg = ctx.createLinearGradient(0,y,0,y+cardH);
    sg.addColorStop(0,"transparent"); sg.addColorStop(0.3,t.accent); sg.addColorStop(0.7,t.accent); sg.addColorStop(1,"transparent");
    ctx.fillStyle = sg; ctx.beginPath(); ctx.roundRect(x,y+20,5,cardH-40,3); ctx.fill(); ctx.shadowBlur = 0;

    // ── Nombre: ocupa todo el ancho disponible (línea propia)
    const nameMaxW = cW - 56;
    let ns = 52;
    ctx.font = `900 ${ns}px 'Arial Black',Arial`;
    let displayName = pr.name;
    while (ctx.measureText(displayName).width > nameMaxW && ns > 30) {
      ns -= 3; ctx.font = `900 ${ns}px 'Arial Black',Arial`;
    }
    while (ctx.measureText(displayName + "…").width > nameMaxW && displayName.length > 3) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== pr.name) displayName += "…";
    ctx.fillStyle = t.isLight ? "#111" : "#fff";
    ctx.shadowColor = t.isLight ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.15)"; ctx.shadowBlur = 8;
    ctx.fillText(displayName, x+28, y + cardH * 0.44); ctx.shadowBlur = 0;

    // ── Fila inferior: peso×reps a la izquierda, píldora 1RM a la derecha
    ctx.font = "500 26px Arial"; ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.4)";
    ctx.fillText(`${pr.weight} kg  ×  ${pr.reps} reps`, x+28, y + cardH * 0.78);

    // Píldora: peso real levantado (PR)
    const rmStr = `${pr.weight} kg`;
    ctx.font = "900 38px 'Arial Black',Arial";
    const pillW = ctx.measureText(rmStr).width + 44, pillH = 56;
    const pillX = x + cW - pillW - 20, pillY = y + cardH * 0.59;
    ctx.shadowColor = t.accent; ctx.shadowBlur = 28; ctx.fillStyle = t.pillBg;
    ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, pillH/2); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = t.pillText; ctx.textAlign = "center";
    ctx.fillText(rmStr, pillX + pillW/2, pillY + 38); ctx.textAlign = "left";
  });

  // Indicador "+ N más" si hay más de 3 PRs
  if (hasExtra) {
    const extraY = startY + n*(cardH+16) + 8;
    ctx.font = "700 28px Arial"; ctx.fillStyle = `${t.accentDim}0.7)`;
    ctx.textAlign = "center";
    ctx.fillText(`+ ${prs.length - 3} récord${prs.length - 3 > 1 ? "s" : ""} más`, W/2, extraY + 20);
    ctx.textAlign = "left";
  }

  // Texto épico (solo si hay espacio)
  if (showEpic) {
    ctx.font = "600 italic 30px Arial"; ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.5)";
    ctx.textAlign = "center"; ctx.fillText(`"${epicMsg}"`, W/2, H-200); ctx.textAlign = "left";
  }

  const botY = H-148;
  const sep = ctx.createLinearGradient(64,0,W-64,0);
  sep.addColorStop(0,"transparent"); sep.addColorStop(0.2,`${t.accentDim}0.4)`); sep.addColorStop(0.8,`${t.accentDim}0.4)`); sep.addColorStop(1,"transparent");
  ctx.fillStyle = sep; ctx.fillRect(64,botY,W-128,1);
  ctx.font = "400 24px Arial"; ctx.fillStyle = t.isLight ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.2)";
  ctx.fillText(new Date().toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric"}).toUpperCase(), 64, botY+44);
  ctx.shadowColor = t.accent; ctx.shadowBlur = 20; ctx.font = "900 42px 'Arial Black',Arial"; ctx.fillStyle = t.accent;
  ctx.fillText(`@${user?.name||"atleta"}`, 64, botY+96); ctx.shadowBlur = 0;

  // Foto de perfil circular
  if (photoImg) {
    const avatarSize = 90, avatarX = W - 64 - avatarSize, avatarY = botY + 10;
    ctx.save();
    ctx.beginPath(); ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(photoImg, avatarX, avatarY, avatarSize, avatarSize);
    ctx.restore();
    // Borde brillante
    ctx.beginPath(); ctx.arc(avatarX + avatarSize/2, avatarY + avatarSize/2, avatarSize/2, 0, Math.PI*2);
    ctx.strokeStyle = t.accent; ctx.lineWidth = 3;
    ctx.shadowColor = t.accent; ctx.shadowBlur = 16; ctx.stroke(); ctx.shadowBlur = 0;
  }
  ctx.shadowColor = t.accent; ctx.shadowBlur = 24; ctx.fillStyle = topBar; ctx.fillRect(0,H-4,W,4); ctx.shadowBlur = 0;
  const bg2 = ctx.createLinearGradient(0,H-80,0,H);
  bg2.addColorStop(0,"transparent"); bg2.addColorStop(1,`${t.accentDim}0.15)`);
  ctx.fillStyle = bg2; ctx.fillRect(0,H-80,W,80);
}

export default function PRShareModal({ prs, user, onClose }) {
  const canvasRef = useRef();
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState("classic");
  const [photoImg, setPhotoImg] = useState(null);
  const epicMsg = useMemo(() => getEpicMessage(prs, user?.name), []);
  const theme = THEMES.find(t => t.id === selectedTheme) || THEMES[0];

  // Cargar foto de perfil si existe
  useEffect(() => {
    if (!user?.photoURL) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setPhotoImg(img);
    img.onerror = () => setPhotoImg(null);
    img.src = user.photoURL;
  }, [user?.photoURL]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 1080; canvas.height = 1080;
    renderCard(canvas.getContext("2d"), theme, prs, user, epicMsg, photoImg);
  }, [selectedTheme, photoImg]);

  async function download() {
    setDownloading(true);
    const canvas = canvasRef.current;
    const fileName = `PR_${prs[0]?.name.replace(/\s/g,"_")}_${Date.now()}.png`;
    try {
      if (Capacitor.isNativePlatform()) {
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
        const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
        await Share.share({ title: "¡Nuevo Récord Personal! 🏆", text: epicMsg, url: uri, dialogTitle: "Compartir PR" });
      } else {
        const a = document.createElement("a");
        a.download = fileName; a.href = canvas.toDataURL("image/png"); a.click();
      }
    } catch(e) { console.error(e); }
    setDownloading(false);
  }

  async function saveToGallery() {
    if (!Capacitor.isNativePlatform()) {
      const a = document.createElement("a");
      a.download = `PR_${prs[0]?.name.replace(/\s/g,"_")}_${Date.now()}.png`;
      a.href = canvasRef.current.toDataURL("image/png");
      a.click();
      return;
    }
    try {
      const fileName = `PR_${prs[0]?.name.replace(/\s/g,"_")}_${Date.now()}.png`;
      const base64 = canvasRef.current.toDataURL("image/png").split(",")[1];
      await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Cache });
      const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
      const { albums } = await Media.getAlbums();
      let album = albums.find(a => a.name === "GymTracker");
      if (!album) {
        await Media.createAlbum({ name: "GymTracker" });
        const { albums: updated } = await Media.getAlbums();
        album = updated.find(a => a.name === "GymTracker");
      }
      await Media.savePhoto({ path: uri, albumIdentifier: album.identifier });
      setCopied(true); setTimeout(() => setCopied(false), 2500);
    } catch(e) { console.error(e); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}
        style={{ maxHeight:"90vh", overflowY:"auto", maxWidth:520 }}>
        <div className="modal-header">
          <h3 className="modal-title">🏆 Compartir PR</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:"0 0 16px" }}>
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, color:"rgba(255,255,255,0.3)", textTransform:"uppercase", marginBottom:10 }}>
              Tema de la card
            </div>
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
          <canvas ref={canvasRef} style={{ width:"100%", borderRadius:12, border:"1px solid rgba(223,255,0,0.2)", display:"block" }} />
          <div style={{ display:"flex", gap:10, marginTop:16 }}>
            <button className="btn-primary" style={{ flex:1, fontSize:14 }} onClick={download} disabled={downloading}>
              {downloading ? "⏳ Compartiendo…" : "📤 Compartir imagen"}
            </button>
            <button className="btn-ghost" style={{ flex:1, fontSize:14 }} onClick={saveToGallery}>
              {copied ? "✅ ¡Guardada!" : "⬇️ Guardar imagen"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}