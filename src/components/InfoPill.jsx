import { useState } from "react";

export default function InfoPill({ title, lines, color = "var(--accent)" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        style={{ background: "var(--card)", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", color: "var(--text-muted)", fontSize: 10, fontWeight: 800, verticalAlign: "middle", marginLeft: 5, flexShrink: 0, lineHeight: 1 }}
      >?</button>
      {open && (
        <div className="overlay" style={{ zIndex: 99999 }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
          <div className="modal" style={{ maxWidth: 320, padding: 20 }} onMouseDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 10 }}>{title}</div>
            {lines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 4 }}>{l}</div>
            ))}
            <button className="btn-primary" style={{ width: "100%", marginTop: 12, fontSize: 13 }}
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); }}>
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}