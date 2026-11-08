import { Component } from "react";

// Keeps one crashing panel from blanking the whole page, and shows the error text
// so it can be copied and fixed.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`PerpPilot: ${this.props.label || "app"} crashed`, error, info);
  }

  render() {
    const { error } = this.state;

    if (!error) return this.props.children;

    const compact = Boolean(this.props.label);
    const text = String(error?.stack || error?.message || error);

    return (
      <div
        role="alert"
        style={{
          width: compact ? "min(1366px, calc(100% - 32px))" : "min(900px, calc(100% - 32px))",
          margin: compact ? "15px auto" : "60px auto",
          padding: "20px",
          borderRadius: "14px",
          border: "1px solid rgba(239,119,116,0.45)",
          background: "rgba(239,119,116,0.08)",
          color: "#f4f7f5",
          textAlign: "left",
        }}
      >
        <h3 style={{ margin: "0 0 8px" }}>
          {compact ? `The ${this.props.label} section hit an error` : "PerpPilot hit an error"}
        </h3>

        <p style={{ margin: "0 0 10px", fontSize: "13px", color: "#cfd8d3" }}>
          The rest of the page keeps working. Copy the text below to report it.
        </p>

        <pre
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            fontSize: "11px",
            maxHeight: "220px",
            overflow: "auto",
            background: "rgba(0,0,0,0.35)",
            padding: "12px",
            borderRadius: "8px",
          }}
        >
          {text}
        </pre>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.2)",
              background: "transparent",
              color: "#f4f7f5",
              cursor: "pointer",
            }}
          >
            Try again
          </button>

          <button
            type="button"
            onClick={() => {
              try {
                localStorage.removeItem("perppilot.paper.v1");
              } catch {
                // storage unavailable
              }
              window.location.reload();
            }}
            style={{
              padding: "9px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(227,187,105,0.45)",
              background: "rgba(227,187,105,0.10)",
              color: "#e3bb69",
              cursor: "pointer",
            }}
          >
            Reset saved paper account and reload
          </button>
        </div>
      </div>
    );
  }
}
