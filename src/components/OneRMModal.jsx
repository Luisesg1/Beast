import { useState } from "react";
import { calc1RM } from "../utils/gymCalcs";
import { numWeight, numReps } from "../utils/helpers";

export default function OneRMModal({ onClose }) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const result = calc1RM(weight, reps);
  const percentages = [100, 95, 90, 85, 80, 75, 70, 65, 60];

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">🧮 Calculadora 1RM</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>Fórmula de Epley: peso × (1 + reps / 30)</p>
        <div style={{ fontSize: 11, color: "var(--text-muted)", background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 16, lineHeight: 1.5 }}>
          ⚠️ <strong style={{ color: "#f59e0b" }}>Estimación aproximada.</strong> Más precisa en ejercicios compuestos (sentadilla, press banca, peso muerto) con 1–10 reps. Puede sobreestimar en ejercicios de aislamiento o con muchas repeticiones.
        </div>
        <div className="form-row">
          <div className="field">
            <label className="field-label">Peso (kg)</label>
            <input className="input" placeholder="0" value={weight} onChange={e => setWeight(numWeight(e.target.value))} inputMode="decimal" />
          </div>
          <div className="field">
            <label className="field-label">Repeticiones</label>
            <input className="input" placeholder="0" value={reps} onChange={e => setReps(numReps(e.target.value))} inputMode="decimal" />
          </div>
        </div>
        {result > 0 && (
          <div>
            <div style={{ background: "var(--accent-dim)", border: "1px solid var(--accent)", borderRadius: 12, padding: "16px", textAlign: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>1RM Estimado</div>
              <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "Barlow Condensed, sans-serif", color: "var(--text)" }}>{result} kg</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {percentages.map(p => {
                const kg = Math.round(result * p / 100);
                const estReps = p === 100 ? 1 : Math.max(1, Math.round(30 * (result / kg - 1)));
                const repsLabel = estReps >= 15 ? "15+ reps" : `${estReps} rep${estReps !== 1 ? "s" : ""}`;
                return (
                  <div key={p} style={{ background: "var(--input-bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{p}%</div>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{kg} kg</div>
                    <div style={{ fontSize: 10, color: "var(--accent)", fontWeight: 600, marginTop: 2 }}>{repsLabel}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}