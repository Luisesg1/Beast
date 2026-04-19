import { useState, useRef } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { getPRs, getStreak } from "../utils/gymCalcs";
import { compressImage } from "../utils/imageUtils";
import { BADGE_DEFS } from "./BadgesModal";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function AvatarEditor({ user, onPhotoUpdate }) {
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarError("");
    if (!AVATAR_ALLOWED_TYPES.includes(file.type)) {
      setAvatarError("Solo se aceptan imágenes JPG, PNG, WebP o GIF.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("La imagen no puede superar 2 MB.");
      return;
    }
    setUploading(true);
    try {
      let base64 = await compressImage(file, 120, 0.4);
      if (!base64) throw new Error("No se pudo comprimir la imagen");
      if (base64.length > 500000) base64 = await compressImage(file, 80, 0.3);
      if (base64.length > 500000) throw new Error("Imagen demasiado grande");
      await updateDoc(doc(db, "users", user.uid), { photoURL: base64 });
      onPhotoUpdate(base64);
    } catch(err) {
      console.error(err);
      setAvatarError("Error al subir la foto. Intenta de nuevo.");
    }
    setUploading(false);
  }

  return (
    <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:8,marginBottom:8}}>
      <div style={{width:80,height:80,borderRadius:"50%",background:"linear-gradient(135deg,var(--accent),#8b5cf6)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,fontWeight:800,color:"white",overflow:"hidden",border:"3px solid var(--accent)"}}>
        {user.photoURL
          ? <img src={user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} />
          : user.name?.[0]?.toUpperCase()
        }
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" style={{display:"none"}} onChange={handleFile} />
      <button className="btn-ghost small" onClick={() => fileRef.current.click()} disabled={uploading}>
        {uploading ? "⏳ Subiendo..." : "📷 Cambiar foto"}
      </button>
      {avatarError && <div style={{fontSize:11,color:"var(--danger)",maxWidth:200,textAlign:"center"}}>{avatarError}</div>}
    </div>
  );
}

export default function UserProfileModal({ user, sessions, bodyStats, onOpenBodyStats, onClose, onPhotoUpdate }) {
  const prs = getPRs(sessions);
  const streak = getStreak(sessions);
  const [selectedBadge, setSelectedBadge] = useState(null);
  const lastEntry = bodyStats.entries?.slice(-1)[0];
  const imc = lastEntry && bodyStats.height
    ? (lastEntry.weight / Math.pow(bodyStats.height/100,2)).toFixed(1) : null;
  const imcColor = !imc ? "var(--text)" : imc < 18.5 ? "#60a5fa" : imc < 25 ? "#22c55e" : imc < 30 ? "#f97316" : "#ef4444";
  const thisWeek = sessions.filter(s=>(new Date()-new Date(s.date+"T00:00:00"))/86400000<=7).length;
  const thisMonth = sessions.filter(s=>(new Date()-new Date(s.date+"T00:00:00"))/86400000<=30).length;
  const totalVolKg = sessions.reduce((acc,s)=>acc+(s.exercises||[]).reduce((a,ex)=>{
    const w=ex.sets?.length>0?ex.sets.reduce((sum,st)=>(parseFloat(st.weight)||0)*(parseFloat(st.reps)||1)+sum,0):(parseFloat(ex.weight)||0)*(parseFloat(ex.reps)||1);
    return a+w;
  },0),0);
  const totalVol = Math.round(totalVolKg / 1000 * 10) / 10;
  const kcal = Math.round(totalVolKg * 6);
  const topPRs = Object.entries(prs).sort((a,b)=>b[1].rm-a[1].rm).slice(0,5);
  const suspiciousPRs = new Set(Object.entries(prs).filter(([,d]) => d.rm > 300).map(([n]) => n));
  const earned = BADGE_DEFS.filter(b=>b.check(sessions,prs,bodyStats||{}));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-wide modal-profile" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">👤 Mi perfil</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div style={{textAlign:"center",marginBottom:20}}>
          <AvatarEditor user={user} onPhotoUpdate={(url) => { onPhotoUpdate && onPhotoUpdate(url); }} />
          <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:22,fontWeight:800}}>{user.name}</div>
          <div style={{fontSize:12,color:"var(--text-muted)"}}>{user.email}</div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:8,marginBottom:20}}>
          {[
            {icon:"⚖️",label:"Peso",value:lastEntry?`${lastEntry.weight}kg`:"—"},
            {icon:"📏",label:"Estatura",value:bodyStats.height?`${bodyStats.height}cm`:"—"},
            {icon:"🧮",label:"IMC",value:imc||"—",color:imcColor},
            {icon:"🏋️",label:"Sesiones",value:sessions.length},
            {icon:"📅",label:"Esta semana",value:thisWeek},
            {icon:"🗓️",label:"Este mes",value:thisMonth},
            {icon:"🔥",label:"Racha",value:`${streak}sem`},
            {icon:"⭐",label:"PRs",value:Object.keys(prs).length},
            {icon:"📦",label:"Volumen",value:`${totalVol}t`},
            {icon:"🔥",label:"~kcal",value:kcal},
          ].map((s)=>(
            <div key={s.label} style={{background:"var(--input-bg)",border:"1px solid var(--border)",borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
              <div style={{fontSize:20}}>{s.icon}</div>
              <div style={{fontFamily:"Barlow Condensed,sans-serif",fontSize:20,fontWeight:800,color:s.color||"var(--accent)"}}>{s.value}</div>
              <div style={{fontSize:10,color:"var(--text-muted)"}}>{s.label}</div>
            </div>
          ))}
        </div>
        {topPRs.length>0 && <>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:"var(--accent)",textTransform:"uppercase",marginBottom:10}}>🏆 Top PRs</div>
          {topPRs.map(([name,data],i)=>{
            const isSuspicious = suspiciousPRs.has(name);
            return (
              <div key={name} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--border)",fontSize:13}}>
                <span style={{display:"flex",alignItems:"center",gap:6}}>
                  {["🥇","🥈","🥉","4️⃣","5️⃣"][i]} {name}
                  {isSuspicious && <span title="Dato sospechoso" style={{fontSize:12,cursor:"help"}}>⚠️</span>}
                </span>
                <span style={{fontWeight:800,color:isSuspicious?"#f59e0b":"var(--accent)"}}>{data.rm}kg 1RM</span>
              </div>
            );
          })}
          {[...suspiciousPRs].length > 0 && (
            <div style={{fontSize:11,color:"#f59e0b",marginTop:8,padding:"7px 10px",background:"rgba(245,158,11,0.08)",borderRadius:8,border:"1px solid rgba(245,158,11,0.2)"}}>
              ⚠️ Algunos PRs parecen tener un dato incorrecto. Revisá esa sesión para corregirlo.
            </div>
          )}
        </>}
        {earned.length>0 && <>
          <div style={{fontSize:10,fontWeight:700,letterSpacing:2,color:"#f59e0b",textTransform:"uppercase",margin:"16px 0 10px"}}>🏅 Logros ({earned.length})</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {earned.map(b=>(
              <button key={b.id} onClick={() => setSelectedBadge(selectedBadge?.id === b.id ? null : b)}
                style={{ fontSize:28, background:"none", border:"none", cursor:"pointer", padding:4, borderRadius:8, transition:"transform 0.15s",
                  outline: selectedBadge?.id === b.id ? "2px solid #f59e0b" : "none",
                  transform: selectedBadge?.id === b.id ? "scale(1.2)" : "scale(1)",
                }}>{b.icon}</button>
            ))}
          </div>
          {selectedBadge && (
            <div style={{marginTop:10, padding:"10px 14px", background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.3)", borderRadius:10, display:"flex", alignItems:"center", gap:12}}>
              <span style={{fontSize:32, flexShrink:0}}>{selectedBadge.icon}</span>
              <div>
                <div style={{fontWeight:800, fontSize:14, color:"#f59e0b"}}>{selectedBadge.name}</div>
                <div style={{fontSize:12, color:"var(--text-muted)", marginTop:2}}>{selectedBadge.desc}</div>
              </div>
            </div>
          )}
        </>}
        <button className="btn-ghost" style={{width:"100%",marginTop:16}} onClick={onOpenBodyStats}>⚖️ Actualizar Peso & Estatura IA</button>
      </div>
    </div>
  );
}