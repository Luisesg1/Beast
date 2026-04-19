import { useState, useEffect, useRef } from "react";

// ── CustomTimerInput ──────────────────────────────────────────────────────────
function CustomTimerInput({ onApply }) {
  const [val, setVal] = useState("");
  function apply() {
    const n = parseInt(val);
    if (n >= 5) { onApply(n); setVal(""); }
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
      <input
        type="number" inputMode="decimal" min={5} max={600} placeholder="ej: 150 seg"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => e.key === "Enter" && apply()}
        style={{ width: 100, background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--text)", fontFamily: "Barlow, sans-serif", fontSize: 14, textAlign: "center", outline: "none" }}
      />
      <button className="btn-ghost small" onClick={apply}>Aplicar</button>
    </div>
  );
}

// ── RestTimer (modal completo) ────────────────────────────────────────────────
export function RestTimer({ onClose }) {
  const [seconds, setSeconds] = useState(90);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef(null);

  function playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.2, 0.4].forEach((t, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = i === 2 ? 880 : 660;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.4, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.18);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.18);
      });
      setTimeout(() => { try { ctx.close(); } catch(e) {} }, 600);
    } catch(e) {}
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setElapsed(e => {
          if (e + 1 >= seconds) {
            clearInterval(intervalRef.current);
            setRunning(false);
            playBeep();
            return e + 1;
          }
          return e + 1;
        });
      }, 1000);
    } else clearInterval(intervalRef.current);
    return () => clearInterval(intervalRef.current);
  }, [running, seconds]);

  const remaining = Math.max(0, seconds - elapsed);
  const pct = elapsed / seconds;
  const r = 52, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  const done = elapsed >= seconds;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 300, textAlign: "center" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">⏱️ Descanso</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <svg width={120} height={120} style={{ margin: "0 auto 16px", display: "block" }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={done ? "#22c55e" : "var(--accent)"} strokeWidth={6}
            strokeDasharray={circumference} strokeDashoffset={circumference * (1 - pct)}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} style={{ transition: "stroke-dashoffset 1s linear" }} />
          <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--text)" fontSize={22} fontWeight={800} fontFamily="Barlow Condensed, sans-serif">
            {done ? "✓" : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`}
          </text>
          <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--text-muted)" fontSize={10}>{done ? "Listo!" : "restante"}</text>
        </svg>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 8, flexWrap: "wrap" }}>
          {[[60,"Cardio"],[90,"Hipertrofia ⭐"],[120,"Fuerza"],[180,"Pesado"]].map(([t, label]) => (
            <button key={t} className={`muscle-chip ${seconds === t ? "active" : ""}`}
              onClick={() => { setSeconds(t); setElapsed(0); setRunning(false); }}
              title={label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"6px 10px" }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{t < 60 ? `${t}s` : `${t/60}m`}</span>
              <span style={{ fontSize: 9, opacity: 0.75 }}>{label}</span>
            </button>
          ))}
        </div>
        <CustomTimerInput onApply={(v) => { setSeconds(v); setElapsed(0); setRunning(false); }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginBottom: 14 }}>
          💡 <b>Recomendación:</b> 60s cardio · 90s hipertrofia · 2-3m fuerza/pesado
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn-primary" style={{ fontSize: 15, padding: "10px 28px" }}
            onClick={() => { if (done) { setElapsed(0); setRunning(true); } else setRunning(r => !r); }}>
            {done ? "↺ Reiniciar" : running ? "⏸ Pausar" : "▶ Iniciar"}
          </button>
          {!done && elapsed > 0 && <button className="btn-ghost" onClick={() => { setElapsed(0); setRunning(false); }}>↺</button>}
        </div>
      </div>
    </div>
  );
}

// ── RestTimerFloating (widget fijo en pantalla mientras entrenas) ──────────────
export function RestTimerFloating({ timer, setTimer }) {
  const remaining = Math.max(0, timer.secs - timer.elapsed);
  const pct = Math.min(timer.elapsed / timer.secs, 1);
  const done = timer.elapsed >= timer.secs;
  const r = 20, cx = 24, cy = 24;
  const circ = 2 * Math.PI * r;
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div style={{
      position: "fixed", bottom: 80, right: 16, zIndex: 1500,
      background: "var(--card)",
      border: `2px solid ${done ? "#22c55e" : "var(--accent)"}`,
      borderRadius: 18, padding: "12px 14px",
      boxShadow: "var(--shadow)",
      display: "flex", alignItems: "center", gap: 12, minWidth: 220,
      transition: "border-color 0.3s",
    }}>
      <svg width={48} height={48} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={4} />
        <circle cx={cx} cy={cy} r={r} fill="none"
          stroke={done ? "#22c55e" : "var(--accent)"}
          strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
        <text x={cx} y={cy + 5} textAnchor="middle"
          fill="var(--text)" fontSize={done ? 9 : 11}
          fontWeight={800} fontFamily="Barlow Condensed, sans-serif">
          {done ? "¡LISTO!" : fmt(remaining)}
        </text>
      </svg>

      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, letterSpacing: 1.5,
          color: done ? "#22c55e" : "var(--accent)",
          textTransform: "uppercase", marginBottom: 6,
        }}>
          {done ? "✓ Descansaste" : "⏱ Descanso"}
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {!done ? (
            <button onClick={() => setTimer(t => ({ ...t, running: !t.running }))}
              style={{ background: "var(--accent)", border: "none", borderRadius: 7, padding: "4px 10px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              {timer.running ? "⏸" : "▶"}
            </button>
          ) : (
            <button onClick={() => setTimer(t => ({ ...t, elapsed: 0, running: true }))}
              style={{ background: "#22c55e", border: "none", borderRadius: 7, padding: "4px 10px", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              ↺ Repetir
            </button>
          )}
          {[60, 90, 120].map(s => (
            <button key={s}
              onClick={() => setTimer(t => ({ ...t, secs: s, elapsed: 0, running: true }))}
              style={{
                background: timer.secs === s && !done ? "rgba(59,130,246,0.18)" : "var(--input-bg)",
                border: `1px solid ${timer.secs === s && !done ? "var(--accent)" : "var(--border)"}`,
                borderRadius: 7, padding: "4px 8px",
                color: timer.secs === s && !done ? "var(--accent)" : "var(--text-muted)",
                fontSize: 11, fontWeight: 700, cursor: "pointer",
              }}>
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => setTimer(t => ({ ...t, visible: false, running: false, elapsed: 0 }))}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
        ✕
      </button>
    </div>
  );
}