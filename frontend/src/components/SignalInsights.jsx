import { priceDigits } from "../lib/analysis.js";

const RISK_COLORS = {
  Low: { fg: "#3cdb94", bg: "rgba(60, 219, 148, 0.10)" },
  Medium: { fg: "#e3bb69", bg: "rgba(227, 187, 105, 0.10)" },
  High: { fg: "#ef7774", bg: "rgba(239, 83, 80, 0.10)" },
  Unknown: { fg: "#9ca3af", bg: "rgba(156, 163, 175, 0.10)" },
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  gap: "12px",
  padding: "8px 0",
  borderTop: "1px solid rgba(255,255,255,0.06)",
  fontSize: "13px",
};

const muted = { color: "#8b9a93" };

const money = (value, digits) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

export default function SignalInsights({ analysis, symbol, quoteSymbol }) {
  const risk = RISK_COLORS[analysis.risk?.level] || RISK_COLORS.Unknown;
  const plan = analysis.plan;
  const dp = priceDigits(plan?.entry ?? analysis.ema9 ?? 1);
  const isLong = plan?.side === "LONG";

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">TRADING INTELLIGENCE</p>
          <h3>Why this signal · {symbol}</h3>
        </div>

        <span
          style={{
            padding: "6px 10px",
            borderRadius: "7px",
            fontSize: "11px",
            fontWeight: 700,
            color: risk.fg,
            background: risk.bg,
          }}
        >
          {analysis.risk?.level || "Unknown"} risk
        </span>
      </div>

      <div style={{ marginTop: "14px", display: "grid", gap: "8px" }}>
        {(analysis.explanation || []).map((line) => (
          <p
            key={line}
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.5,
              color: line.startsWith("Caution") ? "#e3bb69" : "#cfd8d3",
            }}
          >
            {line}
          </p>
        ))}
      </div>

      <div style={{ marginTop: "16px" }}>
        <p className="eyebrow" style={{ marginBottom: "4px" }}>
          SUGGESTED TRADE PLAN
        </p>

        {plan ? (
          <>
            <div style={row}>
              <span style={muted}>Direction</span>
              <strong style={{ color: isLong ? "#3cdb94" : "#ef7774" }}>
                {isLong ? "Long / Buy" : "Short / Sell"}
              </strong>
            </div>
            <div style={row}>
              <span style={muted}>Entry (current)</span>
              <strong>{money(plan.entry, dp)} {quoteSymbol}</strong>
            </div>
            <div style={row}>
              <span style={muted}>Stop-loss ({plan.stopPct.toFixed(2)}% away)</span>
              <strong style={{ color: "#ef7774" }}>{money(plan.stop, dp)}</strong>
            </div>
            <div style={row}>
              <span style={muted}>Target 1 (1.5R)</span>
              <strong style={{ color: "#3cdb94" }}>{money(plan.target1, dp)}</strong>
            </div>
            <div style={row}>
              <span style={muted}>Target 2 (2.5R)</span>
              <strong style={{ color: "#3cdb94" }}>{money(plan.target2, dp)}</strong>
            </div>

            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("perppilot:paper-open", {
                    detail: { side: plan.side },
                  })
                )
              }
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid rgba(60,219,148,0.4)",
                background: "rgba(60,219,148,0.10)",
                color: "#3cdb94",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open {isLong ? "LONG" : "SHORT"} paper trade from this signal
            </button>
          </>
        ) : (
          <p style={{ ...muted, fontSize: "13px", margin: "6px 0 0" }}>
            No trade plan: the engine sees no clear edge right now.
            {analysis.levels && (
              <>
                {" "}Watch for a break above {money(analysis.levels.resistance, dp)}{" "}
                (bullish) or below {money(analysis.levels.support, dp)} (bearish).
              </>
            )}
          </p>
        )}
      </div>

      <div style={{ marginTop: "16px" }}>
        <p className="eyebrow" style={{ marginBottom: "4px" }}>
          RISK CHECK
        </p>
        <div style={row}>
          <span style={muted}>Market regime</span>
          <strong>{analysis.regime}</strong>
        </div>
        <div style={row}>
          <span style={muted}>Volatility</span>
          <strong>
            {analysis.volatility?.label} ({(analysis.volatility?.atrPct ?? 0).toFixed(2)}% / candle)
          </strong>
        </div>
        <div style={row}>
          <span style={muted}>Risk factors</span>
          <strong style={{ textAlign: "right" }}>
            {(analysis.risk?.reasons || []).join(" · ")}
          </strong>
        </div>
      </div>

      <p style={{ ...muted, fontSize: "11px", marginTop: "14px", marginBottom: 0 }}>
        Rule-based technical analysis for testnet use. Not financial advice.
        Signals can be wrong, and nothing is traded automatically.
      </p>
    </div>
  );
}
