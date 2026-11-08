
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import WalletConnect from "./components/WalletConnect.jsx";
import PerpTradingPanel from "./components/PerpTradingPanel.jsx";
import SignalInsights from "./components/SignalInsights.jsx";
import RiskCalculator from "./components/RiskCalculator.jsx";
import PaperTrading from "./components/PaperTrading.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { generateSignal } from "./lib/analysis.js";
import { useMarketTicker } from "./lib/useMarketTicker.js";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Bot,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./App.css";
import "./theme.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

function money(value, digits = 2) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "--";

  return number.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function getMarketsArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.markets)) return data.markets;
  if (Array.isArray(data?.data?.markets)) return data.data.markets;
  if (Array.isArray(data?.data)) return data.data;

  return [];
}

function getMarketPrice(market) {
  return Number(
    market?.markPrice ??
    market?.mark_price ??
    market?.lastPrice ??
    market?.last_price ??
    0
  );
}

function App() {
  const [markets, setMarkets] = useState([]);
  const [market, setMarket] = useState(null);
  const [candles, setCandles] = useState([]);

  const [selectedSymbol, setSelectedSymbol] = useState("BTC-PERP");
  const [interval, setIntervalValue] = useState("15m");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchMarkets = useCallback(async () => {
    const response = await axios.get(
      `${API_URL}/api/dreamdex/markets`,
      { timeout: 60000 }
    );

    const data = response.data;
    const marketList = getMarketsArray(data);

    setMarkets(marketList);

    return marketList;
  }, []);

  const fetchSelectedMarket = useCallback(async () => {
    const response = await axios.get(
      `${API_URL}/api/dreamdex/markets`,
      { timeout: 60000 }
    );

    const marketList = getMarketsArray(response.data);

    setMarkets(marketList);

    const selected = marketList.find(
      (item) =>
        item.symbol === selectedSymbol ||
        item.baseSymbol === selectedSymbol.replace("-PERP", "")
    );

    if (!selected) {
      throw new Error(
        `Market ${selectedSymbol} was not found on DreamDEX.`
      );
    }

    setMarket(selected);
  }, [selectedSymbol]);

  const fetchCandles = useCallback(async () => {
    const response = await axios.get(
      `${API_URL}/api/dreamdex/candles`,
      {
        params: {
          symbol: selectedSymbol,
          interval,
          limit: 100,
        },
        timeout: 90000,
      }
    );

    const receivedCandles = response.data?.candles;

    if (!Array.isArray(receivedCandles)) {
      throw new Error("DreamDEX returned an invalid candle response.");
    }

    setCandles(receivedCandles);
  }, [selectedSymbol, interval]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      await Promise.all([
        fetchSelectedMarket(),
        fetchCandles(),
      ]);

      setLastUpdated(new Date());
    } catch (err) {
      console.error("DreamDEX dashboard error:", err);

      setError(
        err.response?.data?.detail ||
        err.message ||
        "Unable to load DreamDEX market data."
      );
    } finally {
      setLoading(false);
    }
  }, [fetchSelectedMarket, fetchCandles]);

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      fetchMarkets().catch((err) => {
        console.error("DreamDEX markets loading error:", err);
        setError(
          err.response?.data?.detail ||
          "Unable to load DreamDEX markets."
        );
      });
    }, 0);

    return () => clearTimeout(initialFetch);
  }, [fetchMarkets]);

  useEffect(() => {
    const initialFetch = setTimeout(() => {
      fetchData();
    }, 0);

    const timer = setInterval(fetchData, 30000);

    return () => {
      clearTimeout(initialFetch);
      clearInterval(timer);
    };
  }, [fetchData]);

  const ticker = useMarketTicker(market);

  const analysis = useMemo(
    () => generateSignal(candles),
    [candles]
  );

  const livePrice =
    ticker.bid !== null && ticker.ask !== null
      ? (ticker.bid + ticker.ask) / 2
      : Number(candles[candles.length - 1]?.close || 0);

  const chartData = useMemo(
    () =>
      candles.map((candle) => ({
        time: new Date(Number(candle.time)).toLocaleTimeString(
          [],
          { hour: "2-digit", minute: "2-digit" }
        ),
        price: Number(candle.close),
      })),
    [candles]
  );

  const firstCandlePrice = Number(candles[0]?.close || 0);
  const latestCandlePrice = Number(
    candles[candles.length - 1]?.close || 0
  );

  const priceChange =
    firstCandlePrice > 0
      ? ((latestCandlePrice - firstCandlePrice) / firstCandlePrice) * 100
      : 0;

  const isPositive = priceChange >= 0;

  const selectedName =
    market?.symbol || selectedSymbol;

  const currentPrice = ticker.mark ?? getMarketPrice(market);

  const signalClass =
    analysis.signal === "LONG"
      ? "long"
      : analysis.signal === "SHORT"
        ? "short"
        : "hold";

  const networkName =
    market?.network || "Somnia Hideki Testnet";

  const handleSymbolChange = (event) => {
    setSelectedSymbol(event.target.value);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="brand-icon">
            <ShieldCheck size={28} />
          </div>

          <div>
            <h1>PerpPilot AI</h1>
            <p>AI-Powered Perpetual Trading Intelligence</p>
          </div>
        </div>

        <div className="connection">
          <span className="status-dot"></span>
          DreamDEX · Somnia Testnet
        </div>
        <WalletConnect />
      </header>
<main className="dashboard">
        <section className="hero">
          <div>
            <p className="eyebrow">DECENTRALIZED PERPETUAL MARKETS</p>

            <h2>
              Navigate markets.
              <br />
              <span>Trade with intelligence.</span>
            </h2>

            <p className="hero-text">
              Real-time DreamDEX market data, technical analysis,
              intelligent trading signals and market monitoring
              on Somnia Hideki Testnet.
            </p>
          </div>

          <div className="ai-status">
            <Bot size={30} />

            <div>
              <strong>AI Signal Engine</strong>
              <span>
                {analysis.signal === "HOLD"
                  ? "Monitoring market"
                  : `${analysis.signal} signal detected`}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <section className="section-heading">
          <div>
            <p className="eyebrow">DREAMDEX PERPETUAL MARKETS</p>
            <h3>{selectedName}</h3>
          </div>

          <div className="controls">
            <select
              value={selectedSymbol}
              onChange={handleSymbolChange}
              style={{
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,.12)",
                background: "rgba(255,255,255,.05)",
                color: "inherit",
                fontWeight: 700,
              }}
            >
              {markets.map((item) => (
                <option
                  key={item.symbol}
                  value={item.symbol}
                >
                  {item.symbol}
                </option>
              ))}
            </select>

            <div className="timeframes">
              {INTERVALS.filter((value) =>
                ["5m", "15m", "1h", "4h"].includes(value)
              ).map((value) => (
                <button
                  key={value}
                  className={
                    interval === value
                      ? "timeframe active"
                      : "timeframe"
                  }
                  onClick={() => setIntervalValue(value)}
                >
                  {value}
                </button>
              ))}
            </div>

            <button
              className="refresh-button"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw
                size={17}
                className={loading ? "spin" : ""}
              />
              {loading ? "Updating..." : "Refresh"}
            </button>
          </div>
        </section>

        <section className="market-grid">
          <div className="market-card price-card">
            <div className="card-label">
              <Activity size={17} />
              Mark Price
            </div>

            <div className="price">
              {market
                ? `$${money(currentPrice, 4)}`
                : "--"}
            </div>

            <div
              className={`change ${
                isPositive ? "positive" : "negative"
              }`}
            >
              {isPositive
                ? <ArrowUp size={16} />
                : <ArrowDown size={16} />}

              {candles.length > 1
                ? `${priceChange >= 0 ? "+" : ""}${priceChange.toFixed(2)}%`
                : "--"}

              <span>Change over last {candles.length} × {interval} candles</span>
            </div>
          </div>

          <div className="market-card">
            <div className="card-label">
              <TrendingUp size={17} />
              Best Bid
            </div>

            <div className="metric">
              {ticker.bid !== null
                ? `$${money(ticker.bid, 4)}`
                : "--"}
            </div>
            <small>
              {ticker.bid !== null
                ? "Highest resting buy order"
                : ticker.bookLoaded
                  ? "No buy orders resting on the book"
                  : "Loading order book..."}
            </small>
          </div>

          <div className="market-card">
            <div className="card-label">
              <TrendingDown size={17} />
              Best Ask
            </div>

            <div className="metric">
              {ticker.ask !== null
                ? `$${money(ticker.ask, 4)}`
                : "--"}
            </div>
            <small>
              {ticker.ask !== null
                ? "Lowest resting sell order"
                : ticker.bookLoaded
                  ? "No sell orders resting on the book"
                  : "Loading order book..."}
            </small>
          </div>

          <div className="market-card">
            <div className="card-label">
              <Activity size={17} />
              24h Volume
            </div>

            <div className="metric">
              {ticker.volume !== null
                ? `$${money(ticker.volume, 0)}`
                : "--"}
            </div>
            <small>
              {ticker.volume !== null
                ? `Trailing 24h${ticker.trades != null ? ` · ${ticker.trades} trades` : ""}`
                : ticker.statsLoaded
                  ? "No trades in the last 24h"
                  : "Loading 24h volume..."}
            </small>
          </div>
        </section>

        <section className="watchlist">
          {markets.map((item) => {
            const itemPrice = getMarketPrice(item);

            return (
              <button
                key={item.symbol}
                className={
                  item.symbol === selectedSymbol
                    ? "watch-card active"
                    : "watch-card"
                }
                onClick={() =>
                  setSelectedSymbol(item.symbol)
                }
              >
                <strong>{item.symbol}</strong>

                <span>
                  {itemPrice > 0
                    ? `$${money(itemPrice, 4)}`
                    : "--"}
                </span>

                <small>
                  {item.quoteSymbol || "USDso"}
                </small>
              </button>
            );
          })}
        </section>

        <section className="main-grid">
          <div className="panel chart-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">PRICE ACTION</p>
                <h3>{selectedName}</h3>
              </div>

              <span className="chart-live">TESTNET DATA</span>
            </div>

            <div className="chart">
              {chartData.length ? (
                <ResponsiveContainer width="100%" height={330}>
                  <LineChart
                    data={chartData}
                    margin={{
                      top: 10,
                      right: 10,
                      left: 10,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      strokeOpacity={0.12}
                    />

                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      minTickGap={35}
                    />

                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fontSize: 10 }}
                      width={75}
                    />

                    <Tooltip
                      contentStyle={{
                        background: "#101c17",
                        border: "1px solid rgba(255,255,255,.1)",
                        borderRadius: "8px",
                      }}
                      formatter={(value) => [
                        `$${money(value, 4)}`,
                        "Price",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#39d990"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="chart-empty">
                  {loading
                    ? "Loading DreamDEX candles..."
                    : "No candle data available."}
                </div>
              )}
            </div>
          </div>

          <div className="panel signal-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">AI SIGNAL</p>
                <h3>Market Intelligence</h3>
              </div>

              <Bot size={23} />
            </div>

            <div className={`signal-box ${signalClass}`}>
              <div className="signal-title">
                {analysis.signal}
              </div>

              <div className="confidence">
                {analysis.confidence}% confidence
              </div>

              <p>{analysis.reason}</p>
            </div>

            <div className="indicator-list">
              <div>
                <span>RSI (14)</span>
                <strong>
                  {Number.isFinite(analysis.rsi)
                    ? analysis.rsi.toFixed(1)
                    : "--"}
                </strong>
              </div>

              <div>
                <span>EMA (9)</span>
                <strong>
                  {Number.isFinite(analysis.ema9)
                    ? money(analysis.ema9, 4)
                    : "--"}
                </strong>
              </div>

              <div>
                <span>EMA (21)</span>
                <strong>
                  {Number.isFinite(analysis.ema21)
                    ? money(analysis.ema21, 4)
                    : "--"}
                </strong>
              </div>

              <div>
                <span>MACD</span>
                <strong>
                  {Number.isFinite(analysis.macd)
                    ? money(analysis.macd, 4)
                    : "--"}
                </strong>
              </div>
            </div>

            <div className="risk-list" style={{ marginTop: 18 }}>
              <div>
                <span>Market</span>
                <strong>{selectedSymbol}</strong>
              </div>

              <div>
                <span>Quote Currency</span>
                <strong>{market?.quoteSymbol || "USDso"}</strong>
              </div>

              <div>
                <span>Network</span>
                <strong>Somnia Hideki</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <ErrorBoundary label="trading intelligence">
<SignalInsights
            analysis={analysis}
            symbol={market?.symbol || selectedSymbol}
            quoteSymbol={market?.quoteSymbol || "USDso"}
          />
</ErrorBoundary>
          <ErrorBoundary label="risk calculator">
<RiskCalculator analysis={analysis} market={market} />
</ErrorBoundary>
        </section>

        <ErrorBoundary label="paper trading">
<PaperTrading
          symbol={market?.symbol || selectedSymbol}
          price={livePrice}
          analysis={analysis}
          market={market}
        />
</ErrorBoundary>

        <section className="bottom-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">MARKET INFORMATION</p>
                <h3>Selected Contract</h3>
              </div>

              <span className="safe-badge">
                PERPETUAL
              </span>
            </div>

            <div className="risk-list">
              <div>
                <span>Contract</span>
                <strong>{market?.symbol || selectedSymbol}</strong>
              </div>

              <div>
                <span>Base Asset</span>
                <strong>
                  {market?.baseSymbol || "--"}
                </strong>
              </div>

              <div>
                <span>Quote Asset</span>
                <strong>
                  {market?.quoteSymbol || "USDso"}
                </strong>
              </div>

              <div>
                <span>Market Type</span>
                <strong>
                  {market?.marketType || "PERP"}
                </strong>
              </div>

              <div>
                <span>Funding rate (per window)</span>
                <strong>
                  {ticker.fundingRate !== null
                    ? `${ticker.fundingRate >= 0 ? "+" : ""}${(ticker.fundingRate * 100).toFixed(4)}%`
                    : "--"}
                </strong>
              </div>

              <div>
                <span>Open interest</span>
                <strong>
                  {ticker.openInterest !== null
                    ? `${money(ticker.openInterest, 2)} ${market?.baseSymbol || ""}`
                    : "--"}
                </strong>
              </div>

              <div>
                <span>Initial Margin</span>
                <strong>
                  {Number.isFinite(Number(market?.initialMarginBps))
                    ? `${(Number(market.initialMarginBps) / 100).toFixed(2)}%`
                    : "--"}
                </strong>
              </div>

              <div>
                <span>Chain ID</span>
                <strong>50383</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">SYSTEM STATUS</p>
                <h3>PerpPilot Engine</h3>
              </div>

              <span className="safe-badge">
                MONITORING
              </span>
            </div>

            <div className="system-status">
              <div>
                <span className="status-dot"></span>
                DreamDEX market data
              </div>

              <div>
                <span className="status-dot"></span>
                Somnia Hideki Testnet
              </div>

              <div>
                <span className="status-dot"></span>
                Technical analysis engine
              </div>

              <div>
                <span className="status-dot"></span>
                Candle chart
              </div>

              <div>
                <span className="status-dot"></span>
                Testnet order placement and cancellation (wallet-signed)
              </div>
            </div>
          </div>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">NETWORK</p>
                <h3>Somnia Testnet</h3>
              </div>

              <span className="safe-badge">
                TESTNET ONLY
              </span>
            </div>

            <div className="risk-list">
              <div>
                <span>Network</span>
                <strong>{networkName}</strong>
              </div>

              <div>
                <span>Chain ID</span>
                <strong>50383</strong>
              </div>

              <div>
                <span>RPC</span>
                <strong>Hideki Testnet</strong>
              </div>

              <div>
                <span>Trading</span>
                <strong>Wallet-signed (testnet)</strong>
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">DATA REFRESH</p>
                <h3>Market Feed</h3>
              </div>

              <RefreshCw size={22} />
            </div>

            <div className="risk-list">
              <div>
                <span>Refresh Interval</span>
                <strong>30 seconds</strong>
              </div>

              <div>
                <span>Candle Interval</span>
                <strong>{interval}</strong>
              </div>

              <div>
                <span>Candles Loaded</span>
                <strong>{candles.length}</strong>
              </div>

              <div>
                <span>Last Updated</span>
                <strong>
                  {lastUpdated
                    ? lastUpdated.toLocaleTimeString()
                    : "--"}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </main>
      <ErrorBoundary label="perp trading">
<PerpTradingPanel market={market} apiUrl={API_URL} liveMark={ticker.mark} />
</ErrorBoundary>

      <footer>
        <span>PerpPilot AI</span>
        <span>DreamDEX · Somnia Hideki Testnet</span>
        <span>Testnet only · No real funds</span>
      </footer>
    </div>
  );
}

export default App;


