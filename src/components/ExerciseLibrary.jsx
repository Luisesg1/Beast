import { useState } from "react";
import { EXERCISE_DB, MUSCLES } from "../exerciseDb";
import ExerciseGif, { useCustomGifs } from "./ExerciseGif";
import GIF_MAP from "../assets/gif/gifMap.js";

function ExerciseLibraryItem({ ex, onSelect, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const { gifs } = useCustomGifs();
  const src = gifs[ex.name] || GIF_MAP[ex.name];

  return (
    <>
      <div className="lib-item" onClick={() => setExpanded(true)} style={{ cursor: "zoom-in" }}>
        <ExerciseGif exName={ex.name} size={44} />
        <div className="lib-info">
          <span className="lib-name">{ex.name}</span>
          <span className="lib-meta">{ex.equipment} · {ex.machine ? "Requiere máquina" : "Sin máquina"}</span>
        </div>
      </div>
      {expanded && src && (
        <div onClick={() => setExpanded(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.88)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999, cursor:"zoom-out", backdropFilter:"blur(10px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ textAlign:"center", padding:24 }}>
            <img src={src} alt={ex.name} style={{ maxWidth:"80vw", maxHeight:"65vh", borderRadius:20, border:"2px solid var(--accent)", boxShadow:"0 0 60px rgba(59,130,246,0.3)" }} />
            <div style={{ color:"white", marginTop:16, fontFamily:"Barlow Condensed, sans-serif", fontSize:28, fontWeight:800 }}>{ex.name}</div>
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:12, marginTop:6 }}>
              Toca para cerrar ·{" "}
              <span
                onClick={e => { e.stopPropagation(); setExpanded(false); onSelect(ex.name); onClose(); }}
                style={{ color:"var(--accent)", cursor:"pointer", fontWeight:700 }}
              >
                + Agregar al entreno
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ExerciseLibrary({ onSelect, onClose }) {
  const [search, setSearch] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("Todos");
  const [machineFilter, setMachineFilter] = useState("Todos");

  const filtered = EXERCISE_DB.filter(ex => {
    const matchSearch = ex.name.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = muscleFilter === "Todos" || ex.muscle === muscleFilter;
    const matchMachine = machineFilter === "Todos" || (machineFilter === "Máquina" ? ex.machine : !ex.machine);
    return matchSearch && matchMuscle && matchMachine;
  });

  const grouped = MUSCLES.reduce((acc, m) => {
    const exs = filtered.filter(e => e.muscle === m);
    if (exs.length > 0) acc[m] = exs;
    return acc;
  }, {});

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal modal-library" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">📚 Ejercicios</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="lib-filters">
          <input className="input" placeholder="Buscar…" value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
          <select className="input" value={machineFilter} onChange={e => setMachineFilter(e.target.value)} style={{ width: "auto" }}>
            <option>Todos</option>
            <option>Máquina</option>
            <option>Sin máquina</option>
          </select>
        </div>
        <div className="muscle-chips">
          {["Todos", ...MUSCLES].map(m => (
            <button key={m} className={`muscle-chip ${muscleFilter === m ? "active" : ""}`} onClick={() => setMuscleFilter(m)}>{m}</button>
          ))}
        </div>
        <div className="lib-list">
          {Object.entries(grouped).map(([muscle, exs]) => (
            <div key={muscle} className="lib-group">
              <div className="lib-group-title">{muscle}</div>
              {exs.map(ex => <ExerciseLibraryItem key={ex.name} ex={ex} onSelect={onSelect} onClose={onClose} />)}
            </div>
          ))}
          {Object.keys(grouped).length === 0 && <p className="text-muted" style={{ padding: "20px 0", textAlign: "center" }}>Sin resultados</p>}
        </div>
      </div>
    </div>
  );
}