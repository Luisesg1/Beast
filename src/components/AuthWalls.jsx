import { useState } from "react";
import { useAuth } from "./AuthContext";
import { auth } from "../firebase";
import { sendEmailVerification } from "firebase/auth";

export function GuestWall({ onClose, feature = "esta función" }) {
  const { logout } = useAuth();
  return (
    <div style={{ textAlign:"center", padding:"20px 0" }}>
      <div style={{ fontSize:52, marginBottom:12 }}>🔒</div>
      <div style={{ fontFamily:"Barlow Condensed, sans-serif", fontSize:24, fontWeight:800, marginBottom:8 }}>Cuenta requerida</div>
      <p style={{ fontSize:14, color:"var(--text-muted)", marginBottom:20, lineHeight:1.6 }}>
        Para usar {feature} necesitas una cuenta registrada.<br/>
        Así tu historial queda guardado permanentemente.
      </p>
      <button className="btn-primary" style={{ fontSize:16, padding:"12px 28px" }} onClick={() => { onClose(); logout(true); }}>
        Crear cuenta gratis →
      </button>
      <p style={{ fontSize:12, color:"var(--text-muted)", marginTop:12 }}>¿Ya tienes cuenta? Cierra sesión e inicia con tu email.</p>
    </div>
  );
}

export function EmailVerifyWall({ user, children }) {
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified || user.isGuest) return children;

  async function resendVerification() {
    setSending(true);
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) await sendEmailVerification(firebaseUser);
      setResent(true);
    } catch(e) { console.error(e); }
    setSending(false);
  }

  return (
    <div style={{ padding: "32px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>✉️</div>
      <div style={{ fontFamily: "Barlow Condensed, sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
        Verifica tu email
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: 14, marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
        Esta función requiere un email verificado. Revisa tu bandeja de entrada y haz clic en el enlace que te enviamos a <strong style={{ color: "var(--text)" }}>{user.email}</strong>.
      </div>
      {resent
        ? <div style={{ color: "#22c55e", fontSize: 13, fontWeight: 700 }}>✅ Email reenviado. Revisa tu bandeja.</div>
        : <button className="btn-ghost" onClick={resendVerification} disabled={sending}>
            {sending ? "⏳ Enviando..." : "Reenviar email de verificación"}
          </button>
      }
    </div>
  );
}