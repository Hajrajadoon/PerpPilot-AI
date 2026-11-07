import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { priceDigits, sizePosition } from "../lib/analysis.js";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px",
  marginTop: "6px",
  borderRadius: "8px",
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(0,0,0,0.25)",
  color: "#fff",
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

export default function RiskCalculator({ analysis, market }) {
  const [equity, setEquity] = useState("1000");
  const [riskPct, setRiskPct] = useState("1");
  const [side, setSide] = useState("LONG");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [sent, setSent] = useState(false);

  const plan = analysis.plan;
  const symbol = market?.symbol;

  // Pre-fill from the signal plan; with no plan (HOLD), fall back to the
  // current mark price and a 1.5 x ATR stop so the calculator stays usable.
  useEffect(() => {
    const apply = () => {
      if (plan) {
        const dp = priceDigits(plan.entry);
        setSide(plan.side);
        setEntry(plan.entry.toFixed(dp));
        setStop(plan.stop.toFixed(dp));
        setSent(false);
        return;
      }

      const mark = Number(market?.markPrice);
      const atr = Number(analysis.volatility?.atr);
      if (!Number.isFinite(mark) || mark <= 0 || !Number.isFinite(atr) || atr <= 0) {
        return;
      }

      const dp = priceDigits(mark);
      setEntry(mark.toFixed(dp));
      setStop((side === "SHORT" ? mark + atr * 1.5 : mark - atr * 1.5).toFixed(dp));
      setSent(false);
    };

    const timer = setTimeout(apply, 0);
    return () => clearTimeout(timer);
  }, [symbol, side, plan?.side, plan?.entry, plan?.stop]); // eslint-disable-line react-hooks/exhaustive-deps

  const lotSizeUnits = useMemo(() => {
    try {
      if (!market?.lotSize || market.baseDecimals == null) return null;
      return Number(formatUnits(BigInt(market.lotSize), market.baseDecimals));
    } catch {
      return null;
    }
  }, [market]);

  const result = useMemo(
    () =>
      sizePosition({
        equity,
        riskPct,
        entry,
        stop,
        side,
        initialMarginBps: market?.initialMarginBps,
        lotSizeUnits,
      }),
    [equity, riskPct, entry, stop, side, market?.initialMarginBps, lotSizeUnits]
  );

  const qtyDigits = lotSizeUnits
    ? Math.min(8, Math.max(0, Math.ceil(-Math.log10(lotSizeUnits))))
    : 6;

  const sendToOrderForm = () => {
    window.dispatchEvent(
      new CustomEvent("perppilot:fill-order", {
        detail: {
          side: side === "LONG" ? "long" : "short",
          quantity: result.quantity.toFixed(qtyDigits),
          price: entry,
        },
      })
    );
    setSent(true);
  };

  const quote = market?.quoteSymbol || "USDso";
  const base = market?.baseSymbol || "";

  return (
    <div className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">RISK MANAGEMENT</p>
          <h3>Position size calculator</h3>
        </div>
      </div>

      <p style={{ ...muted, fontSize: "12px", margin: "10px 0 0" }}>
        Decide how much you can lose before you trade. Defaults come from the
        signal plan and can be edited.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
          gap: "10px",
          marginTop: "12px",
        }}
      >
        <label style={{ fontSize: "12px", ...muted }}>
          Equity ({quote})
          <input type="number" min="0" value={equity}
            onChange={(e) => setEquity(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: "12px", ...muted }}>
          Risk per trade (%)
          <input type="number" min="0" step="0.1" value={riskPct}
            onChange={(e) => setRiskPct(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: "12px", ...muted }}>
          Direction
          <select value={side} onChange={(e) => setSide(e.target.value)} style={inputStyle}>
            <option value="LONG">Long / Buy</option>
            <option value="SHORT">Short / Sell</option>
          </select>
        </label>
        <label style={{ fontSize: "12px", ...muted }}>
          Entry price
          <input type="number" min="0" step="any" value={entry}
            onChange={(e) => setEntry(e.target.value)} style={inputStyle} />
        </label>
        <label style={{ fontSize: "12px", ...muted }}>
          Stop-loss price
          <input type="number" min="0" step="any" value={stop}
            onChange={(e) => setStop(e.target.value)} style={inputStyle} />
        </label>
      </div>

      <div style={{ marginTop: "14px" }}>
        {result.ok ? (
          <>
            <div style={row}>
              <span style={muted}>Max loss if stopped out</span>
              <strong style={{ color: "#ef7774" }}>
                {result.riskAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {quote}
              </strong>
            </div>
            <div style={row}>
              <span style={muted}>Position size</span>
              <strong>{result.quantity.toFixed(qtyDigits)} {base}</strong>
            </div>
            <div style={row}>
              <span style={muted}>Position value</span>
              <strong>{result.notional.toLocaleString(undefined, { maximumFractionDigits: 2 })} {quote}</strong>
            </div>
            <div style={row}>
              <span style={muted}>Effective leverage</span>
              <strong>{result.leverage.toFixed(2)}x</strong>
            </div>
            <div style={row}>
              <span style={muted}>Margin required (initial)</span>
              <strong>
                {result.marginRequired === null
                  ? "--"
                  : `${result.marginRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quote}`}
              </strong>
            </div>
          </>
        ) : null}

        {result.warnings.map((w) => (
          <p key={w} style={{ color: "#e3bb69", fontSize: "12px", margin: "8px 0 0" }}>
            {w}
          </p>
        ))}
      </div>

      <button
        type="button"
        onClick={sendToOrderForm}
        disabled={!result.ok}
        style={{
          width: "100%",
          marginTop: "14px",
          padding: "11px 14px",
          borderRadius: "8px",
          border: "1px solid rgba(60,219,148,0.4)",
          background: "rgba(60,219,148,0.10)",
          color: "#3cdb94",
          fontWeight: 700,
          cursor: result.ok ? "pointer" : "not-allowed",
          opacity: result.ok ? 1 : 0.5,
        }}
      >
        {sent ? "Sent to order form" : "Use in order form"}
      </button>

      <p style={{ ...muted, fontSize: "11px", marginBottom: 0 }}>
        This only fills the form below. You still review and approve every
        order in your wallet.
      </p>
    </div>
  );
}
