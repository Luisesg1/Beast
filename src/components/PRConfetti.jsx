import { useState, useEffect, useRef } from "react";
import PRShareModal from "./PRShareModal";

export default function PRConfetti({ prs, user, onDone }) {
  const canvasRef = useRef();
  const [showShare, setShowShare] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const COLORS = ["#e8ff00","#f59e0b","#22c55e","#ec4899","#8b5cf6","#f97316","#ffffff"];
    const particles = Array.from({ length: 180 }, () => ({
      x: canvas.width * 0.1 + Math.random() * canvas.width * 0.8,
      y: -20 - Math.random() * 200,
      w: 6 + Math.random() * 10, h: 9 + Math.random() * 8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 6, vy: 2.5 + Math.random() * 5,
      angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 0.28,
      opacity: 1, shape: Math.random() > 0.5 ? "rect" : "circle",
    }));
    let frame = 0, raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;
      particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.vx *= 0.99; p.angle += p.spin;
        if (frame > 100) p.opacity = Math.max(0, p.opacity - 0.014);
        ctx.save(); ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y); ctx.rotate(p.angle); ctx.fillStyle = p.color;
        if (p.shape === "circle") { ctx.beginPath(); ctx.arc(0,0,p.w/2,0,Math.PI*2); ctx.fill(); }
        else { ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); }
        ctx.restore();
      });
      if (frame < 200) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0,0,canvas.width,canvas.height);
    }
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleClose() { setVisible(false); if (onDone) onDone(); }

  return (
    <>
      <canvas ref={canvasRef} style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:9998 }} />

      {visible && !showShare && (
        <div style={{
          position:"fixed", inset:0, zIndex:9999,
          display:"flex", alignItems:"center", justifyContent:"center", padding:24,
          background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)",
        }} onClick={handleClose}>
          <div onClick={e => e.stopPropagation()} style={{
            width:"100%", maxWidth:360,
            background:"#0a0a0a",
            border:"1px solid rgba(232,255,0,0.3)",
            borderRadius:24, padding:"28px 24px",
            boxShadow:"0 0 80px rgba(232,255,0,0.15), 0 20px 60px rgba(0,0,0,0.7)",
            textAlign:"center",
          }}>
            <div style={{ fontSize:56, marginBottom:4, filter:"drop-shadow(0 0 20px rgba(232,255,0,0.5))" }}>🏆</div>

            <div style={{
              fontFamily:"'Barlow Condensed',sans-serif",
              fontSize:38, fontWeight:900, letterSpacing:2,
              color:"#e8ff00", textTransform:"uppercase",
              textShadow:"0 0 30px rgba(232,255,0,0.5)", marginBottom:4,
            }}>
              ¡Nuevo Récord!
            </div>
            <div style={{ fontSize:12, color:"rgba(255,255,255,0.3)", letterSpacing:3, textTransform:"uppercase", marginBottom:20 }}>
              Personal
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:24 }}>
              {prs.slice(0,3).map(pr => (
                <div key={pr.name} style={{
                  background:"rgba(232,255,0,0.07)",
                  border:"1px solid rgba(232,255,0,0.2)",
                  borderRadius:12, padding:"12px 16px",
                  display:"flex", justifyContent:"space-between", alignItems:"center",
                }}>
                  <div style={{ textAlign:"left" }}>
                    <div style={{ fontSize:15, fontWeight:800, color:"#fff", fontFamily:"'Barlow Condensed',sans-serif" }}>
                      {pr.name}
                    </div>
                    <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginTop:2 }}>
                      {pr.weight} kg × {pr.reps} reps
                    </div>
                  </div>
                  <div style={{
                    background:"#e8ff00", color:"#000",
                    fontWeight:900, fontSize:16,
                    padding:"6px 14px", borderRadius:20,
                    fontFamily:"'Barlow Condensed',sans-serif",
                    boxShadow:"0 0 16px rgba(232,255,0,0.4)",
                  }}>
                    {pr.weight} kg
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowShare(true)} style={{
                flex:2, padding:"13px 0", borderRadius:12,
                background:"#e8ff00", border:"none",
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:15, fontWeight:900, color:"#000",
                letterSpacing:1, cursor:"pointer",
                boxShadow:"0 0 20px rgba(232,255,0,0.3)",
              }}>
                📸 COMPARTIR
              </button>
              <button onClick={handleClose} style={{
                flex:1, padding:"13px 0", borderRadius:12,
                background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.1)",
                fontFamily:"'Barlow Condensed',sans-serif",
                fontSize:15, fontWeight:700, color:"rgba(255,255,255,0.5)",
                cursor:"pointer",
              }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <PRShareModal prs={prs} user={user} onClose={() => setShowShare(false)} />
      )}
    </>
  );
}