import React from "react";
import { trackError } from "../utils/analytics";

// Captura errores de renderizado de React para evitar la pantalla en blanco.
// En su lugar muestra una pantalla de recuperación y reporta el error.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    trackError(error, "react-render");
    if (info?.componentStack) console.error(info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: "1rem",
        padding: "2rem", textAlign: "center",
        background: "#121212", color: "#f5f5f5",
        fontFamily: "Barlow, system-ui, sans-serif",
      }}>
        <div style={{ fontSize: "2.5rem" }}>💪</div>
        <h2 style={{ margin: 0, fontWeight: 600 }}>Algo salió mal</h2>
        <p style={{ margin: 0, color: "#9a9a9a", maxWidth: 320, lineHeight: 1.5 }}>
          La app encontró un error inesperado. Tus datos están a salvo.
          Recarga para continuar.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            marginTop: "0.5rem", padding: "0.7rem 1.6rem", border: "none",
            borderRadius: 10, background: "#DFFF00", color: "#111",
            fontWeight: 700, fontSize: "1rem", cursor: "pointer",
          }}
        >
          Recargar
        </button>
      </div>
    );
  }
}
