import { useEffect, useMemo, useRef, useState } from "react";
import { priceDigits } from "../lib/analysis.js";
import {
  PAPER_START,
  closePosition,
  emptyAccount,
  evaluate,
  openPosition,
  pnlOf,
  sanitizeAccount,
  stats,
  usedMargin,
} from "../lib/paper.js";

const STORAGE_KEY = "perppilot.paper.v1";

const muted = { color: "#8b9a93" };
const green = "#3cdb94";
const red = "#ef7774";
const amber = "#e3bb69";

const cardStyle = {
  background: "rgba(0, 0, 0, 0.28)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  padding: "14px 16px",
};

const thStyle = { padding: "8px 6px", textAlign: "left", color: "#8b9a93" };
const tdStyle = { padding: "8px 6px", borderTop: "1px solid rgba(255,255,255,0.06)" };

function loadAccount() {
  try {
    return sanitizeAccount(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    return emptyAccount();
  }
}

const num = (value, digits = 2) =>
  Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signed = (value, digits = 2) => `${value >= 0 ? "+" : "-"}$${num(Math.abs(value), digits)}`;

const pnlColor = (value) => (value > 0 ? green : value < 0 ? red : "#cfd8d3");

const when = (ms) =>
  new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function PaperTrading({ symbol, price, analysis, market }) {
  const [account, setAccount] = useState(loadAccount);
  const [riskPct, setRiskPct] = useState("1");
  const [message, setMessage] = useState("");

  const accountRef = useRef(account);
  const openRef = useRef(null);

  const atr = analysis?.volatility?.atr || 0;
  const base = market?.baseSymbol || symbol?.split("-")[0] || "";
  const dp = priceDigits(price || 1);
  const imRatio = Number(market?.initialMarginBps) / 10000 || 0.05;

  // Persist
  useEffect(() => {
    accountRef.current = account;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
    } catch {
      // storage unavailable: the simulation still works for this session
    }
  }, [account]);

  // Mark to market and auto-close at stop / target for the selected market
  useEffect(() => {
    if (!symbol || !(price > 0)) return;

    const before = accountRef.current;
    const after = evaluate(before, symbol, price);

    if (after !== before) {
      setAccount(after);

      if (after.history.length > before.history.length) {
        const h = after.history[0];
        setMessage(
          `${h.symbol} ${h.side} paper trade closed: ${h.reason} (${signed(h.pnl)}).`
        );
      }
    }
  }, [symbol, price]);

  const openTrade = (side) => {
    const result = openPosition(accountRef.current, {
      symbol,
      side,
      price,
      atr,
      riskPct: Number(riskPct),
      imRatio,
    });

    if (result.error) {
      setMessage(result.error);
      return;
    }

    setAccount(result.account);
    const p = result.position;
    setMessage(
      `Opened paper ${side}: ${num(p.qty, 4)} ${base} at ${num(p.entry, dp)}. ` +
        `Stop ${num(p.stop, dp)}, target ${num(p.target, dp)}.`
    );
  };

  openRef.current = openTrade;

  // "Open paper trade" button inside the signal plan
  useEffect(() => {
    const onOpen = (event) => openRef.current?.(event?.detail?.side);
    window.addEventListener("perppilot:paper-open", onOpen);
    return () => window.removeEventListener("perppilot:paper-open", onOpen);
  }, []);

  const closeNow = (position) => {
    const exit = position.symbol === symbol && price > 0 ? price : position.lastPrice;
    setAccount((prev) => closePosition(prev, position.id, exit, "Closed manually"));
    setMessage(`${position.symbol} ${position.side} paper trade closed manually.`);
  };

  const resetAccount = () => {
    if (!window.confirm("Reset the paper account to 10,000 USDso and clear all history?")) return;
    setAccount(emptyAccount());
    setMessage("Paper account reset.");
  };

  const summary = useMemo(() => {
    const unrealized = account.positions.reduce((sum, p) => {
      const mark = p.symbol === symbol && price > 0 ? price : p.lastPrice;
      return sum + pnlOf(p, mark);
    }, 0);

    return {
      unrealized,
      equity: account.balance + unrealized,
      available: account.balance - usedMargin(account),
      ...stats(account),
    };
  }, [account, symbol, price]);

  const canTrade = price > 0 && atr > 0;

  return (
    <section className="panel" style={{ marginTop: "15px" }}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">PAPER TRADING</p>
          <h3>Simulation account</h3>
        </div>

        <span
          style={{
            padding: "6px 10px",
            borderRadius: "7px",
            fontSize: "11px",
            fontWeight: 700,
            color: amber,
            background: "rgba(227, 187, 105, 0.10)",
          }}
        >
          SIMULATION · NO REAL FUNDS
        </span>
      </div>

      <p style={{ ...muted, fontSize: "12px", margin: "10px 0 0" }}>
        Practice the signals with virtual money. Trades use the live DreamDEX
        price, a 1.5×ATR stop-loss and a 1.5R take-profit, and close
        automatically when hit. Prices update for the selected market.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <div style={cardStyle}>
          <span style={{ ...muted, fontSize: "12px" }}>Equity</span>
          <strong style={{ display: "block", fontSize: "20px", marginTop: "6px" }}>
            ${num(summary.equity)}
          </strong>
          <small style={muted}>
            Cash ${num(account.balance)} · Free ${num(summary.available)}
          </small>
        </div>

        <div style={cardStyle}>
          <span style={{ ...muted, fontSize: "12px" }}>Open positions</span>
          <strong style={{ display: "block", fontSize: "20px", marginTop: "6px" }}>
            {account.positions.length}
          </strong>
          <small style={{ color: pnlColor(summary.unrealized) }}>
            Unrealised {signed(summary.unrealized)}
          </small>
        </div>

        <div style={cardStyle}>
          <span style={{ ...muted, fontSize: "12px" }}>Total trades</span>
          <strong style={{ display: "block", fontSize: "20px", marginTop: "6px" }}>
            {summary.trades}
          </strong>
          <small style={muted}>
            {summary.wins} wins · {summary.losses} losses
          </small>
        </div>

        <div style={cardStyle}>
          <span style={{ ...muted, fontSize: "12px" }}>Win rate</span>
          <strong style={{ display: "block", fontSize: "20px", marginTop: "6px" }}>
            {summary.winRate.toFixed(1)}%
          </strong>
          <small style={{ color: pnlColor(summary.realized) }}>
            Realised {signed(summary.realized)}
          </small>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "10px",
          alignItems: "flex-end",
          marginTop: "16px",
        }}
      >
        <label style={{ fontSize: "12px", ...muted }}>
          Risk per trade (%)
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={riskPct}
            onChange={(event) => setRiskPct(event.target.value)}
            style={{
              display: "block",
              width: "130px",
              boxSizing: "border-box",
              padding: "10px",
              marginTop: "6px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(0,0,0,0.28)",
              color: "#fff",
            }}
          />
        </label>

        <button
          type="button"
          disabled={!canTrade}
          onClick={() => openTrade("LONG")}
          style={{
            padding: "11px 18px",
            borderRadius: "8px",
            border: 0,
            fontWeight: 700,
            color: "#04130c",
            background: "linear-gradient(135deg, #35d48c, #1fa971)",
            cursor: canTrade ? "pointer" : "not-allowed",
            opacity: canTrade ? 1 : 0.5,
          }}
        >
          Open LONG paper trade · {symbol}
        </button>

        <button
          type="button"
          disabled={!canTrade}
          onClick={() => openTrade("SHORT")}
          style={{
            padding: "11px 18px",
            borderRadius: "8px",
            border: "1px solid rgba(239,119,116,0.45)",
            fontWeight: 700,
            color: red,
            background: "rgba(239,119,116,0.10)",
            cursor: canTrade ? "pointer" : "not-allowed",
            opacity: canTrade ? 1 : 0.5,
          }}
        >
          Open SHORT paper trade · {symbol}
        </button>

        <button
          type="button"
          onClick={resetAccount}
          style={{
            padding: "11px 14px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.2)",
            background: "transparent",
            color: "#cfd8d3",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      {message && (
        <p role="status" style={{ color: amber, fontSize: "13px", margin: "12px 0 0" }}>
          {message}
        </p>
      )}

      <div style={{ marginTop: "20px", overflowX: "auto" }}>
        <p className="eyebrow" style={{ marginBottom: "6px" }}>
          OPEN POSITIONS
        </p>

        {account.positions.length === 0 ? (
          <p style={{ ...muted, fontSize: "13px", margin: 0 }}>
            No open paper trades. Use the buttons above or the signal plan.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {["Market", "Side", "Entry", "Now", "Stop", "Target", "Size", "P&L", ""].map(
                  (h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {account.positions.map((p) => {
                const live = p.symbol === symbol && price > 0;
                const mark = live ? price : p.lastPrice;
                const pnl = pnlOf(p, mark);
                const pdp = priceDigits(p.entry);

                return (
                  <tr key={p.id}>
                    <td style={tdStyle}>{p.symbol}</td>
                    <td style={{ ...tdStyle, color: p.side === "LONG" ? green : red, fontWeight: 700 }}>
                      {p.side}
                    </td>
                    <td style={tdStyle}>{num(p.entry, pdp)}</td>
                    <td style={tdStyle}>
                      {num(mark, pdp)}
                      {!live && <span style={muted}> (last seen)</span>}
                    </td>
                    <td style={{ ...tdStyle, color: red }}>{num(p.stop, pdp)}</td>
                    <td style={{ ...tdStyle, color: green }}>{num(p.target, pdp)}</td>
                    <td style={tdStyle}>{num(p.qty, 4)}</td>
                    <td style={{ ...tdStyle, color: pnlColor(pnl), fontWeight: 700 }}>
                      {signed(pnl)}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => closeNow(p)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: "#cfd8d3",
                          cursor: "pointer",
                        }}
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ marginTop: "22px", overflowX: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <p className="eyebrow" style={{ marginBottom: "6px" }}>
            TRADE HISTORY
          </p>
          <span style={{ ...muted, fontSize: "12px" }}>
            {summary.trades} completed · avg {summary.avgR.toFixed(2)}R · started with ${num(PAPER_START, 0)}
          </span>
        </div>

        {account.history.length === 0 ? (
          <p style={{ ...muted, fontSize: "13px", margin: 0 }}>
            No completed paper trades yet.
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                {["Closed", "Market", "Side", "Entry", "Exit", "P&L", "R", "Result"].map((h) => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {account.history.slice(0, 25).map((h) => {
                const hdp = priceDigits(h.entry);

                return (
                  <tr key={`${h.id}-${h.closedAt}`}>
                    <td style={tdStyle}>{when(h.closedAt)}</td>
                    <td style={tdStyle}>{h.symbol}</td>
                    <td style={{ ...tdStyle, color: h.side === "LONG" ? green : red, fontWeight: 700 }}>
                      {h.side}
                    </td>
                    <td style={tdStyle}>{num(h.entry, hdp)}</td>
                    <td style={tdStyle}>{num(h.exit, hdp)}</td>
                    <td style={{ ...tdStyle, color: pnlColor(h.pnl), fontWeight: 700 }}>
                      {signed(h.pnl)}
                    </td>
                    <td style={tdStyle}>{h.rMultiple.toFixed(2)}R</td>
                    <td style={{ ...tdStyle, color: pnlColor(h.pnl) }}>
                      {h.result} <span style={muted}>· {h.reason}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p style={{ ...muted, fontSize: "11px", marginBottom: 0, marginTop: "14px" }}>
        Paper results are saved in this browser only. Simulated fills ignore
        fees and slippage, so real results will differ.
      </p>
    </section>
  );
}
