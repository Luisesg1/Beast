import { useState, useCallback } from "react";

// Hook reutilizable para confirmaciones — reemplaza window.confirm en cualquier componente
export function useConfirm() {
  const [state, setState] = useState({ open: false, message: "", onConfirm: null });

  const confirm = useCallback((message, onConfirm) => {
    setState({ open: true, message, onConfirm });
  }, []);

  const close = useCallback(() => {
    setState({ open: false, message: "", onConfirm: null });
  }, []);

  const modal = state.open ? (
    <div
      onClick={close}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, padding:24 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background:"#141414", border:"1px solid rgba(255,255,255,0.08)", borderRadius:16, padding:"28px 24px", maxWidth:340, width:"100%", boxShadow:"0 8px 32px rgba(0,0,0,0.6)" }}
      >
        <p style={{ margin:"0 0 24px", fontSize:15, color:"#f0f0f0", lineHeight:1.5, textAlign:"center", fontFamily:"'Barlow', sans-serif" }}>
          {state.message}
        </p>
        <div style={{ display:"flex", gap:10 }}>
          <button
            onClick={close}
            style={{ flex:1, padding:"11px 0", borderRadius:10, border:"1px solid rgba(255,255,255,0.08)", background:"transparent", color:"rgba(255,255,255,0.35)", fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:"'Barlow', sans-serif" }}
          >
            Cancelar
          </button>
          <button
            onClick={() => { state.onConfirm?.(); close(); }}
            style={{ flex:1, padding:"11px 0", borderRadius:10, border:"none", background:"#CFFF4D", color:"#0E0F13", fontSize:14, fontWeight:900, cursor:"pointer", fontFamily:"'Barlow Condensed', sans-serif", letterSpacing:1 }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, modal };
}