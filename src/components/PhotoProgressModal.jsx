import { useState, useEffect, useRef } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../firebase";
import { showRewardedAd } from "../useAdMob";
import { compressImage } from "../utils/imageUtils";

// Convierte base64 (con o sin prefijo) a dataURL válido
function toDataURL(b64) {
  if (!b64) return "";
  if (b64.startsWith("data:")) return b64;
  return `data:image/jpeg;base64,${b64}`;
}

// Lee la fecha EXIF de una imagen (DateTimeOriginal).
// Retorna "YYYY-MM-DD" o null si no hay metadatos.
async function getExifDate(file) {
  try {
    const exifr = await import("exifr");
    const exif = await exifr.parse(file, ["DateTimeOriginal", "DateTime"]);
    const raw = exif?.DateTimeOriginal || exif?.DateTime;
    if (!raw) return null;
    // raw puede ser un Date object o string "YYYY:MM:DD HH:MM:SS"
    if (raw instanceof Date) return raw.toISOString().slice(0, 10);
    // Formato EXIF: "2024:03:15 14:32:00" → "2024-03-15"
    return raw.split(" ")[0].replace(/:/g, "-");
  } catch {
    return null;
  }
}

const MAX_PHOTOS = 30;

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}

function fmtMonth(dateStr) {
  if (!dateStr) return "";
  const [y, m] = dateStr.split("-");
  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${months[parseInt(m)-1]} ${y}`;
}

async function uploadToStorage(uid, photoId, base64) {
  const storage = getStorage();
  const storageRef = ref(storage, `photoProgress/${uid}/${photoId}.jpg`);
  // Normalizar: quitar prefijo data:... si lo tiene (legacy)
  const raw = base64?.startsWith("data:") ? base64.split(",")[1] : base64;
  // Timeout de 15s — Firebase Storage puede quedar colgado sin red en vez de fallar
  await Promise.race([
    uploadString(storageRef, raw, "base64", { contentType: "image/jpeg" }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("upload_timeout")), 15000))
  ]);
  return await getDownloadURL(storageRef);
}

async function deleteFromStorage(uid, photoId) {
  try {
    const storage = getStorage();
    const storageRef = ref(storage, `photoProgress/${uid}/${photoId}.jpg`);
    await deleteObject(storageRef);
  } catch (e) {
    // Si el archivo no existe (foto legacy en base64) ignorar
    if (e.code !== "storage/object-not-found") console.error("deleteFromStorage:", e);
  }
}

async function loadPhotos(uid) {
  try {
    const snap = await getDoc(doc(db, "photoProgress", uid));
    return snap.exists() ? (snap.data().photos || []) : [];
  } catch { return []; }
}

async function savePhotos(uid, photos) {
  try {
    // Subir a Storage las fotos que todavía tienen base64 y no tienen url
    const saved = await Promise.all(photos.map(async (p) => {
      if (p.url) {
        const { base64: _drop, ...rest } = p;
        return rest;
      }
      if (!p.base64) return p;
      try {
        const url = await uploadToStorage(uid, p.id, p.base64);
        const { base64: _drop, ...rest } = p;
        return { ...rest, url };
      } catch (e) {
        console.warn("[savePhotos] Upload falló, marcando como pendiente:", e.message);
        // NO guardar base64 en Firestore — marcar como pendiente para reintentar
        const { base64: _drop, ...rest } = p;
        return { ...rest, _pendingUpload: true };
      }
    }));

    // Reintentar fotos que fallaron el upload anterior
    const retried = await Promise.all(saved.map(async (p) => {
      if (!p._pendingUpload) return p;
      try {
        const url = await uploadToStorage(uid, p.id, p.base64 || "");
        const { base64: _d, _pendingUpload: _p, ...rest } = p;
        return { ...rest, url };
      } catch(e) {
        // Sigue fallando — guardar sin base64, se reintentará la próxima vez
        const { base64: _d, ...rest } = p;
        return rest; // _pendingUpload se mantiene para el próximo intento
      }
    }));

    await setDoc(doc(db, "photoProgress", uid), { photos: retried }, { merge: true });
    return retried;
  } catch (e) { console.error("Error saving photos:", e); return photos; }
}

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
function DeleteConfirm({ onConfirm, onCancel }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 9999, padding: "0 0 24px",
    }}>
      <div style={{
        background: "var(--card-bg, #1a1a1a)", borderRadius: 16, padding: 20,
        width: "100%", maxWidth: 400, margin: "0 16px",
        border: "1px solid var(--border, #333)",
        animation: "slideUp 0.2s ease",
      }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 700, textAlign: "center", color: "var(--text, #fff)", marginBottom: 6 }}>
          ¿Eliminar esta foto?
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted, #888)", textAlign: "center", marginBottom: 20 }}>
          Esta acción no se puede deshacer
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: "11px 0", borderRadius: 10, border: "1px solid var(--border, #333)",
            background: "none", color: "var(--text-muted, #888)", fontWeight: 700, fontSize: 14, cursor: "pointer",
          }}>Cancelar</button>
          <button onClick={onConfirm} style={{
            flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
            background: "#ef4444", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer",
          }}>Eliminar</button>
        </div>
      </div>
      <style>{`@keyframes slideUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
}

// ── Photo Detail Modal ────────────────────────────────────────────────────────
function PhotoDetail({ photo, onClose, onDelete }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", zIndex: 9998, padding: 16,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, position: "relative" }}>
        <img
          src={photo.url || toDataURL(photo.base64)}
          alt={photo.date}
          style={{ width: "100%", borderRadius: 16, maxHeight: "70vh", objectFit: "contain", display: "block" }}
        />
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button onClick={onClose} style={{
            background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
            width: 34, height: 34, color: "#fff", cursor: "pointer", fontSize: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>✕</button>
          <button onClick={onDelete} style={{
            background: "rgba(239,68,68,0.8)", border: "none", borderRadius: "50%",
            width: 34, height: 34, color: "#fff", cursor: "pointer", fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>🗑️</button>
        </div>
        <div style={{
          background: "rgba(0,0,0,0.7)", borderRadius: "0 0 16px 16px",
          padding: "12px 16px", backdropFilter: "blur(8px)",
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{fmtDate(photo.date)}</div>
          {photo.note && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>📝 {photo.note}</div>}
        </div>
      </div>
    </div>
  );
}

// ── Source Picker (Cámara vs Galería) ─────────────────────────────────────────
function SourcePicker({ onCamera, onGallery, onClose }) {
  const [offline, setOffline] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // navigator.onLine no es confiable en Android WebView — ping real
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    fetch("https://www.google.com/generate_204", {
      method: "HEAD", mode: "no-cors", cache: "no-store",
      signal: controller.signal,
    })
      .then(() => setOffline(false))
      .catch(() => setOffline(true))
      .finally(() => { clearTimeout(timer); setChecking(false); });
  }, []);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      zIndex: 9997, padding: "0 0 24px",
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "var(--card-bg, #1a1a1a)", borderRadius: 16, padding: 20,
        width: "100%", maxWidth: 400, margin: "0 16px",
        border: "1px solid var(--border, #333)",
        animation: "slideUp 0.2s ease",
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted, #888)", letterSpacing: 2, textTransform: "uppercase", textAlign: "center", marginBottom: 16 }}>
          Agregar foto de progreso
        </div>
        {checking && (
          <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted, #888)", marginBottom: 12 }}>
            Verificando conexión...
          </div>
        )}
        {!checking && offline && (
          <div style={{
            marginBottom: 12, padding: "10px 12px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>📡</span>
            <span style={{ fontSize: 12, color: "#f87171", lineHeight: 1.5 }}>
              Sin conexión a internet. Conéctate para guardar la foto.
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={(!checking && !offline) ? onCamera : undefined} style={{
            flex: 1, padding: "18px 0", borderRadius: 12,
            background: "var(--input-bg, #111)", border: "1px solid var(--border, #333)",
            color: "var(--text, #fff)", cursor: (!checking && !offline) ? "pointer" : "default",
            fontSize: 13, fontWeight: 700,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            opacity: (checking || offline) ? 0.4 : 1,
          }}>
            <span style={{ fontSize: 30 }}>📷</span>
            Cámara
          </button>
          <button onClick={(!checking && !offline) ? onGallery : undefined} style={{
            flex: 1, padding: "18px 0", borderRadius: 12,
            background: "var(--input-bg, #111)", border: "1px solid var(--border, #333)",
            color: "var(--text, #fff)", cursor: (!checking && !offline) ? "pointer" : "default",
            fontSize: 13, fontWeight: 700,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
            opacity: (checking || offline) ? 0.4 : 1,
          }}>
            <span style={{ fontSize: 30 }}>🖼️</span>
            Galería
          </button>
        </div>
        <button onClick={onClose} style={{
          width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 10,
          background: "none", border: "1px solid var(--border, #333)",
          color: "var(--text-muted, #888)", cursor: "pointer", fontWeight: 600, fontSize: 13,
        }}>Cancelar</button>
      </div>
    </div>
  );
}

// ── Personalization helpers ───────────────────────────────────────────────────
function daysBetween(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1 + "T00:00:00");
  const d2 = new Date(dateStr2 + "T00:00:00");
  return Math.abs(Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));
}

function firstName(fullName) {
  if (!fullName) return null;
  return fullName.trim().split(" ")[0];
}

// ── Main Component ─────────────────────────────────────────────────────────────
// userName:  nombre completo del usuario (string, opcional)
// userStats: { totalSessions, streak, topExercises: [{name, rm}] } (opcional)
export default function PhotoProgressModal({ uid, isPro, onClose, showRewardedVideo, userName, userStats }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [selected, setSelected] = useState([]);
  const [compareMode, setCompareMode] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingBase64, setPendingBase64] = useState(null);
  const [adWatched, setAdWatched] = useState(false);
  const [watchingAd, setWatchingAd] = useState(false);
  const [detailPhoto, setDetailPhoto] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [exifDate, setExifDate] = useState(null); // fecha detectada del EXIF
  const [pendingBanner, setPendingBanner] = useState(false);

  const cameraRef = useRef();
  const galleryRef = useRef();

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    loadPhotos(uid).then(async p => {
      const hasPending = p.some(x => x._pendingUpload);
      if (hasPending) {
        // Reintentar uploads pendientes al abrir el modal
        const retried = await Promise.all(p.map(async (photo) => {
          if (!photo._pendingUpload) return photo;
          try {
            const url = await uploadToStorage(uid, photo.id, photo.base64 || "");
            const { base64: _d, _pendingUpload: _p, ...rest } = photo;
            return { ...rest, url };
          } catch(e) {
            // Sigue sin red — dejar como pendiente
            return photo;
          }
        }));
        const stillPending = retried.some(x => x._pendingUpload);
        if (stillPending) {
          setPendingBanner(true);
        } else {
          // Todos subieron — guardar en Firestore
          await savePhotos(uid, retried);
        }
        setPhotos(retried);
      } else {
        setPhotos(p);
      }
      setLoading(false);
    });
  }, [uid]);

  const canCompare = isPro || adWatched;

  // Group photos by month for timeline
  const photosByMonth = photos.reduce((acc, p) => {
    const key = p.date.slice(0, 7);
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});
  const monthKeys = Object.keys(photosByMonth).sort((a, b) => b.localeCompare(a));

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert("La foto no puede superar 10 MB."); return; }
    setUploading(true);
    try {
      const [base64, detectedDate] = await Promise.all([
        compressImage(file, 800, 0.75, "base64"),
        getExifDate(file),
      ]);
      setPendingBase64(base64);
      setExifDate(detectedDate);
      setShowNoteInput(true);
    } catch { alert("Error al procesar la imagen."); }
    setUploading(false);
    e.target.value = "";
  }

  async function confirmUpload() {
    if (!pendingBase64) return;
    setUploading(true);
    setSaveProgress(30);
    const photoDate = exifDate || new Date().toISOString().slice(0, 10);
    const newPhoto = {
      id: Date.now().toString(),
      date: photoDate,
      base64: pendingBase64,
      note: note.trim(),
    };
    const updated = [newPhoto, ...photos].slice(0, MAX_PHOTOS);
    setPhotos(updated);
    setSaveProgress(65);
    const saved = await savePhotos(uid, updated);
    if (saved) {
      setPhotos(saved);
      if (saved.some(x => x._pendingUpload)) {
        console.warn("[confirmUpload] Fotos pendientes — mostrando banner");
        setPendingBanner(true);
      }
    }
    setSaveProgress(100);
    setTimeout(() => {
      setPendingBase64(null);
      setNote("");
      setExifDate(null);
      setShowNoteInput(false);
      setUploading(false);
      setSaveProgress(0);
    }, 400);
  }

  function toggleSelect(id) {
    if (!compareMode) {
      const p = photos.find(x => x.id === id);
      if (p) setDetailPhoto(p);
      return;
    }
    setAnalysis(null);
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  async function handleWatchAd() {
    setWatchingAd(true);
    const rewarded = await showRewardedAd();
    setWatchingAd(false);
    if (rewarded) setAdWatched(true);
  }

  async function analyzePhotos() {
    if (selected.length !== 2) return;

    const [p1, p2] = selected.map(id => photos.find(p => p.id === id));
    setAnalyzing(true);
    setAnalysis(null);

    // Construir contexto personalizado
    const name = firstName(userName);
    const days = daysBetween(p1.date, p2.date);
    const weeks = days > 0 ? Math.round(days / 7) : null;
    const timeDesc = days === 0 ? "el mismo día"
      : days === 1 ? "1 día"
      : days < 14 ? `${days} días`
      : weeks === 1 ? "1 semana"
      : `${weeks} semanas`;

    const contextLines = [];
    if (name) contextLines.push(`El atleta se llama ${name}.`);
    if (userStats?.totalSessions) contextLines.push(`Lleva ${userStats.totalSessions} sesiones de entrenamiento registradas.`);
    if (userStats?.streak) contextLines.push(`Su racha actual es de ${userStats.streak} semanas cumpliendo su meta.`);
    if (userStats?.topExercises?.length) {
      const exList = userStats.topExercises.slice(0, 3).map(e => e.rm ? `${e.name} (${e.rm}kg 1RM)` : e.name).join(", ");
      contextLines.push(`Sus ejercicios principales son: ${exList}.`);
    }
    if (p1.note) contextLines.push(`En la foto inicial dejó esta nota: "${p1.note}".`);
    if (p2.note) contextLines.push(`En la foto reciente dejó esta nota: "${p2.note}".`);

    const contextBlock = contextLines.length > 0
      ? `\nContexto del atleta:\n${contextLines.join("\n")}\n`
      : "";

    const prompt = `Eres un coach de gimnasio experto, directo y motivador. Analiza el progreso físico de este atleta comparando 2 fotos tomadas con ${timeDesc} de diferencia (foto 1: ${fmtDate(p1.date)} → foto 2: ${fmtDate(p2.date)}).
${contextBlock}
Instrucciones:
- ${name ? `Llama al atleta por su nombre (${name})` : "Habla en segunda persona (tú)"} de forma natural, no en cada oración.
- Menciona cambios concretos y visibles: músculo, definición, grasa, postura.
- Si pasaron pocas semanas, sé honesto pero positivo sobre lo que sí cambió.
- Si pasaron muchas semanas, destaca el progreso acumulado.
- Señala 1 zona que mejoró claramente y 1 zona donde aún hay potencial.
- Cierra con un mensaje motivador corto que conecte con su historial${userStats?.totalSessions ? ` (lleva ${userStats.totalSessions} sesiones)` : ""}.
- Máximo 5 oraciones. Español. Sin asteriscos. Sin listas.`;

    try {
      const functions = getFunctions();
      const analyzePhotosFn = httpsCallable(functions, "analyzePhotos");
      const photoUrls = [
        p1.url || toDataURL(p1.base64),
        p2.url || toDataURL(p2.base64),
      ];
      const result = await analyzePhotosFn({ photoUrls, prompt });
      const { analysis: analysisText } = result.data;
      setAnalysis(analysisText || "No se pudo analizar.");
      if (!isPro) setAdWatched(false);
    } catch {
      setAnalysis("Hubo un error al analizar. Verifica tu conexión e intenta de nuevo.");
    }
    setAnalyzing(false);
  }

  async function doDelete(id) {
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    setSelected(prev => prev.filter(x => x !== id));
    setDetailPhoto(null);
    setDeleteTarget(null);
    await deleteFromStorage(uid, id);
    await savePhotos(uid, updated);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
      <div style={{ fontSize: 28, marginBottom: 10, opacity: 0.4 }}>📷</div>
      Cargando fotos...
    </div>
  );

  return (
    <div style={{ paddingBottom: 16 }}>

      {/* Hidden inputs */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment"
        style={{ display: "none" }} onChange={handleFileChange} />
      <input ref={galleryRef} type="file" accept="image/*"
        style={{ display: "none" }} onChange={handleFileChange} />

      {/* Banner fotos pendientes de subir */}
      {pendingBanner && (
        <div style={{
          background: "#2a2a00", border: "1px solid #888800",
          borderRadius: 8, padding: "10px 14px", margin: "8px 0 4px",
          color: "#cccc00", fontSize: 13, display: "flex",
          alignItems: "center", gap: 8
        }}>
          <span>⏳</span>
          <span>Una o más fotos se subirán cuando tengas conexión</span>
          <button onClick={() => setPendingBanner(false)}
            style={{ marginLeft: "auto", background: "none", border: "none",
              color: "#cccc00", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>×</button>
        </div>
      )}

      {/* Overlays */}
      {showSourcePicker && (
        <SourcePicker
          onCamera={() => { setShowSourcePicker(false); cameraRef.current?.click(); }}
          onGallery={() => { setShowSourcePicker(false); galleryRef.current?.click(); }}
          onClose={() => setShowSourcePicker(false)}
        />
      )}
      {detailPhoto && (
        <PhotoDetail
          photo={detailPhoto}
          onClose={() => setDetailPhoto(null)}
          onDelete={() => { setDeleteTarget(detailPhoto.id); setDetailPhoto(null); }}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          onConfirm={() => doDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Note input after selecting photo */}
      {showNoteInput && (
        <div style={{ background: "var(--input-bg)", border: "1px solid var(--accent)", borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 }}>
            📷 Nueva foto ·{" "}
            {exifDate ? (
              <span title="Fecha detectada de la foto">
                {fmtDate(exifDate)}
                <span style={{ marginLeft: 6, background: "rgba(223,255,0,0.15)", borderRadius: 4, padding: "1px 5px", fontSize: 9, letterSpacing: 1 }}>
                  EXIF ✓
                </span>
              </span>
            ) : (
              fmtDate(new Date().toISOString().slice(0, 10))
            )}
          </div>
          {pendingBase64 && (
            <img src={toDataURL(pendingBase64)} alt="preview"
              style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10, marginBottom: 10 }} />
          )}
          <input className="input" placeholder="Nota opcional (ej: Semana 4, volumen)" maxLength={60}
            value={note} onChange={e => setNote(e.target.value)}
            style={{ marginBottom: 10, fontSize: 13 }} />

          {/* Save progress bar */}
          {saveProgress > 0 && (
            <div style={{ height: 4, background: "var(--border)", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
              <div style={{
                height: "100%", background: "var(--accent)", borderRadius: 2,
                width: `${saveProgress}%`, transition: "width 0.3s ease",
              }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { setPendingBase64(null); setShowNoteInput(false); setNote(""); setExifDate(null); }}
              style={{ flex: 1, background: "none", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 0", color: "var(--text-muted)", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>
              Cancelar
            </button>
            <button onClick={confirmUpload} disabled={uploading}
              style={{ flex: 2, background: "var(--accent)", border: "none", borderRadius: 10, padding: "10px 0", color: "#09090B", cursor: uploading ? "default" : "pointer", fontWeight: 900, fontSize: 13, fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1, opacity: uploading ? 0.7 : 1 }}>
              {uploading ? "Guardando..." : "✓ Guardar foto"}
            </button>
          </div>
        </div>
      )}

      {/* Progreso Físico header + actions */}
      {!showNoteInput && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 900,
                fontSize: 26, letterSpacing: 3, color: "var(--text)",
                textTransform: "uppercase", lineHeight: 1,
              }}>
                Progreso
              </div>
              <div style={{
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 500,
                fontSize: 13, letterSpacing: 4, color: "var(--accent)",
                textTransform: "uppercase", marginTop: 2, opacity: 0.85,
              }}>
                FÍSICO
              </div>
            </div>
            {photos.length > 0 && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2,
              }}>
                <span style={{
                  fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800,
                  fontSize: 20, color: "var(--accent)", lineHeight: 1,
                }}>
                  {photos.length}
                </span>
                <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase" }}>
                  / {MAX_PHOTOS} fotos
                </span>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => setShowSourcePicker(true)}
              disabled={uploading}
              style={{
                flex: 1, background: "var(--input-bg)", border: "2px dashed var(--border)",
                borderRadius: 12, padding: "13px 0", color: "var(--accent)", cursor: "pointer",
                fontFamily: "Barlow Condensed, sans-serif", fontWeight: 800, fontSize: 15,
                letterSpacing: 1, transition: "all 0.2s",
              }}
            >
              {uploading ? "⏳" : "📷"} + FOTO
            </button>

            {photos.length >= 2 && (
              <button
                onClick={() => { setCompareMode(m => !m); setSelected([]); setAnalysis(null); }}
                style={{
                  flex: 1, borderRadius: 12, padding: "13px 0",
                  border: compareMode ? "none" : "1px solid rgba(223,255,0,0.3)",
                  background: compareMode ? "var(--accent)" : "rgba(223,255,0,0.06)",
                  color: compareMode ? "#09090B" : "var(--accent)",
                  cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                  fontWeight: 800, fontSize: 13, letterSpacing: 1,
                  transition: "all 0.2s",
                }}
              >
                {compareMode ? "✕ CANCELAR" : "⚡ Analizar con IA"}
              </button>
            )}
          </div>
        </>
      )}

      {/* Compare mode panel */}
      {compareMode && !showNoteInput && (
        <div style={{
          background: selected.length === 2 ? "rgba(223,255,0,0.06)" : "var(--input-bg)",
          border: `1px solid ${selected.length === 2 ? "var(--accent)" : "var(--border)"}`,
          borderRadius: 12, padding: "12px 14px", marginBottom: 14,
          transition: "all 0.2s",
        }}>
          {/* Step indicator */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, alignItems: "center" }}>
            {[0, 1].map(i => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: selected.length > i ? "var(--accent)" : "var(--border)",
                  color: selected.length > i ? "#09090B" : "var(--text-muted)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 900, transition: "all 0.2s",
                }}>
                  {selected.length > i ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: 12, color: selected.length > i ? "var(--text)" : "var(--text-muted)", fontWeight: selected.length > i ? 700 : 400 }}>
                  {i === 0 ? "Foto inicial" : "Foto actual"}
                </span>
                {i === 0 && <span style={{ color: "var(--border)", fontSize: 12, margin: "0 2px" }}>→</span>}
              </div>
            ))}
          </div>

          {selected.length < 2 && (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {selected.length === 0
                ? `Toca tu foto de punto de partida${firstName(userName) ? `, ${firstName(userName)}` : ""}`
                : "Ahora elige la foto más reciente para ver el cambio"}
            </div>
          )}

          {selected.length === 2 && !analysis && !analyzing && (
            canCompare ? (
              <>
                <button onClick={analyzePhotos} style={{
                  width: "100%", background: "var(--accent)", border: "none",
                  borderRadius: 10, padding: "12px 0", color: "#09090B",
                  cursor: "pointer", fontFamily: "Barlow Condensed, sans-serif",
                  fontWeight: 900, fontSize: 15, letterSpacing: 2,
                }}>
                  ⚡ Analizar con IA
                </button>
              </>
            ) : (
              <button onClick={handleWatchAd} disabled={watchingAd} style={{
                width: "100%", background: "rgba(223,255,0,0.08)",
                border: "1px solid rgba(223,255,0,0.3)", borderRadius: 10,
                padding: "12px 0", color: "var(--accent)", cursor: "pointer",
                fontWeight: 700, fontSize: 13,
              }}>
                {watchingAd ? "⏳ Cargando video..." : "▶ Ver video para desbloquear Analizar con IA"}
              </button>
            )
          )}

          {/* Privacy banner — always visible in compare mode */}
          <div style={{
            marginTop: 10, padding: "8px 12px",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 8,
          }}>
            <span style={{ fontSize: 13, flexShrink: 0 }}>🔒</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Tus fotos <strong style={{ color: "var(--text)" }}>no se almacenan ni comparten</strong> con terceros. El análisis ocurre en el momento y las imágenes no salen de tu sesión.
            </span>
          </div>

          {analyzing && (
            <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
              <div style={{ fontSize: 22, marginBottom: 6 }}>⚡</div>
              {firstName(userName)
                ? `Analizando tu progreso, ${firstName(userName)}...`
                : "Analizando tu progreso..."}
            </div>
          )}

          {analysis && (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#22c55e", letterSpacing: 1.5, fontFamily: "Barlow Condensed, sans-serif" }}>Progreso Físico</span>
                <span style={{ background: "rgba(34,197,94,0.2)", color: "#22c55e", fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, letterSpacing: 1 }}>ANÁLISIS IA</span>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text)" }}>{analysis}</div>
              <button onClick={() => { setAnalysis(null); setSelected([]); }} style={{
                marginTop: 14, width: "100%",
                background: "rgba(223,255,0,0.08)",
                border: "1px solid rgba(223,255,0,0.3)",
                borderRadius: 10, padding: "11px 0",
                color: "var(--accent)",
                cursor: "pointer", fontSize: 14, fontWeight: 800,
                fontFamily: "Barlow Condensed, sans-serif", letterSpacing: 1,
                transition: "all 0.2s",
              }}>
                ⚡ Nuevo análisis
              </button>
            </div>
          )}
        </div>
      )}

      {/* Photos: empty state */}
      {photos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0 32px" }}>
          <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.4 }}>📷</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>
            {firstName(userName) ? `${firstName(userName)}, aún no hay fotos` : "Sin fotos aún"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 260, margin: "0 auto 12px" }}>
            {userStats?.totalSessions
              ? `Llevas ${userStats.totalSessions} sesiones entrenadas — ya es hora de capturar cómo se ve ese trabajo`
              : "Agrega tu primera foto y deja que Progreso Físico trackee tu evolución"}
          </div>
          <span style={{ background: "rgba(223,255,0,0.08)", border: "1px solid rgba(223,255,0,0.25)", color: "var(--accent)", fontSize: 10, fontWeight: 800, padding: "3px 10px", borderRadius: 6, letterSpacing: 1.5, fontFamily: "Barlow Condensed, sans-serif" }}>
            Progreso Físico · ANÁLISIS IA
          </span>
        </div>
      ) : (
        /* Timeline by month */
        monthKeys.map(monthKey => (
          <div key={monthKey} style={{ marginBottom: 22 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: 2,
              color: "var(--text-muted)", textTransform: "uppercase",
              marginBottom: 10, paddingLeft: 2,
            }}>
              {fmtMonth(monthKey + "-01")}
              <span style={{ marginLeft: 8, fontWeight: 400, letterSpacing: 0, opacity: 0.6 }}>
                · {photosByMonth[monthKey].length} foto{photosByMonth[monthKey].length !== 1 ? "s" : ""}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {photosByMonth[monthKey].map(photo => {
                const isSelected = selected.includes(photo.id);
                const selIdx = selected.indexOf(photo.id);
                return (
                  <div
                    key={photo.id}
                    onClick={() => toggleSelect(photo.id)}
                    style={{
                      position: "relative", borderRadius: 12, overflow: "hidden",
                      cursor: "pointer",
                      border: isSelected ? "2px solid var(--accent)" : "2px solid transparent",
                      boxShadow: isSelected ? "0 0 14px rgba(223,255,0,0.25)" : "none",
                      transition: "all 0.15s",
                      transform: isSelected ? "scale(0.97)" : "scale(1)",
                    }}
                  >
                    <img
                      src={photo.url || toDataURL(photo.base64)}
                      alt={photo.date}
                      style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", display: "block" }}
                    />

                    {/* Compare: selection badge */}
                    {compareMode && isSelected && (
                      <div style={{
                        position: "absolute", top: 7, left: 7,
                        background: "var(--accent)", color: "#09090B",
                        borderRadius: "50%", width: 24, height: 24,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 900, fontSize: 13,
                      }}>
                        {selIdx + 1}
                      </div>
                    )}

                    {/* Normal mode: VER badge */}
                    {!compareMode && (
                      <div style={{
                        position: "absolute", top: 7, left: 7,
                        background: "rgba(0,0,0,0.5)", borderRadius: 6,
                        padding: "3px 6px", fontSize: 9, color: "rgba(255,255,255,0.7)",
                        fontWeight: 700, letterSpacing: 0.5,
                      }}>
                        VER
                      </div>
                    )}

                    {/* Date + note overlay */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.82))",
                      padding: "18px 8px 8px",
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{fmtDate(photo.date)}</div>
                      {photo.note && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 1 }}>📝 {photo.note}</div>}
                    </div>

                    {/* Delete button (solo en modo normal) */}
                    {!compareMode && (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteTarget(photo.id); }}
                        style={{
                          position: "absolute", top: 7, right: 7,
                          background: "rgba(0,0,0,0.55)", border: "none",
                          borderRadius: "50%", width: 26, height: 26,
                          color: "#fff", cursor: "pointer", fontSize: 11,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Footer: photo count */}
      {photos.length > 0 && (
        <div style={{ textAlign: "center", marginTop: 4, fontSize: 11, color: "var(--text-muted)", opacity: 0.4 }}>
          {photos.length} / {MAX_PHOTOS} fotos
        </div>
      )}
    </div>
  );
}