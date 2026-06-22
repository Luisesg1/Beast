export default function fireConfetti() {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  const colors = ["#CFFF4D","#22c55e","#f97316","#ffffff","#a3e635","#FBBF24","#34d399","#fb923c"];

  function burst(cx, cy, count, speedMult) {
    return Array.from({length: count}, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = (2 + Math.random() * 8) * speedMult;
      return {
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 4,
        r: 3 + Math.random() * 7,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.35,
        shape: ["rect","circle","triangle"][Math.floor(Math.random()*3)],
        alpha: 1,
        gravity: 0.15 + Math.random() * 0.1,
        trail: [],
      };
    });
  }

  let particles = [];
  particles.push(...burst(W/2, H*0.45, 80, 1.4));
  setTimeout(() => particles.push(...burst(W*0.2, H*0.5, 40, 1.1)), 200);
  setTimeout(() => particles.push(...burst(W*0.8, H*0.5, 40, 1.1)), 350);
  setTimeout(() => particles.push(...burst(W/2, H*0.3, 50, 1.6)), 500);

  let frame;
  const startTime = performance.now();
  const duration = 3500;

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    const elapsed = ts - startTime;

    particles.forEach(p => {
      p.trail.push({x: p.x, y: p.y});
      if (p.trail.length > 5) p.trail.shift();

      p.vx *= 0.98;
      p.vy += p.gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.spin;
      p.alpha = Math.max(0, 1 - elapsed / duration * 1.3);

      if (p.trail.length > 1) {
        ctx.save();
        ctx.globalAlpha = p.alpha * 0.3;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.r * 0.5;
        ctx.beginPath();
        p.trail.forEach((pt, i) => i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y));
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 6;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      if (p.shape === "rect") {
        ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
      } else if (p.shape === "circle") {
        ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -p.r);
        ctx.lineTo(p.r * 0.866, p.r * 0.5);
        ctx.lineTo(-p.r * 0.866, p.r * 0.5);
        ctx.closePath(); ctx.fill();
      }
      ctx.restore();
    });

    particles = particles.filter(p => p.y < H + 50 && p.alpha > 0.01);

    if (elapsed < duration) frame = requestAnimationFrame(draw);
    else { cancelAnimationFrame(frame); canvas.remove(); }
  }

  frame = requestAnimationFrame(draw);
}