import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, parseUnits } from "viem";
import { getSdk } from "../lib/sdk.js";
import { executeBotAuthorization, fetchBotStatus } from "../lib/dreamdexBot.js";

const CHAIN_ID = 50383;
const DEFAULT_API_URL = "http://127.0.0.1:8000";
const EXPLORER_TX = "https://explorer.testnet.somnia.network/tokyo/tx/";
const TX_LOG_KEY = "perppilot.txlog.v1";

const panelStyle = {
  background: "rgba(13, 25, 20, 0.88)",
  color: "#f4f7f5",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "17px",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.18)",
  padding: "25px",
  width: "min(1366px, calc(100% - 32px))",
  margin: "15px auto 50px",
  textAlign: "left",
};

const cardStyle = {
  background: "rgba(0, 0, 0, 0.28)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "10px",
  padding: "16px",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px",
  marginTop: "6px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  background: "rgba(0, 0, 0, 0.28)",
  color: "#fff",
};

const ghostButton = {
  padding: "11px 18px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "transparent",
  color: "#f4f7f5",
  cursor: "pointer",
};

const muted = { color: "#8b9a93" };
const green = "#3cdb94";
const amber = "#e3bb69";
const red = "#ef7774";

function jsonSafe(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2
  );
}

function findMaxQuantity(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  if (!value || typeof value !== "object") return null;

  for (const key of ["maxQuantity", "maxOrderSize", "maxSize", "quantity", "size", "max"]) {
    const found = findMaxQuantity(value[key]);
    if (found !== null) return found;
  }

  return null;
}

function displayCollateral(value) {
  try {
    return Number(formatUnits(BigInt(value ?? 0), 18)).toLocaleString(undefined, {
      maximumFractionDigits: 4,
    });
  } catch {
    return "—";
  }
}

function toNumber(value) {
  try {
    return Number(formatUnits(BigInt(value ?? 0), 18));
  } catch {
    return 0;
  }
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function friendlyError(error, fallback) {
  const text = String(error?.shortMessage || error?.message || "");

  if (
    error?.code === 4001 ||
    /user rejected|user denied|rejected the request|denied message signature/i.test(text)
  ) {
    return "Signature rejected in MetaMask. Nothing was sent.";
  }

  if (/failed to fetch|networkerror|load failed/i.test(text)) {
    return "Cannot reach the PerpPilot backend. Start it from the project folder with: uvicorn backend.app.main:app --reload";
  }

  return text || fallback;
}

function loadTxLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TX_LOG_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function PerpTradingPanel({ market, apiUrl = DEFAULT_API_URL, liveMark = null }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [side, setSide] = useState("long");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [bot, setBot] = useState({ state: "loading", data: null, message: "" });
  const [margin, setMargin] = useState(null);
  const [health, setHealth] = useState(null);
  const [openOrders, setOpenOrders] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [cancellingId, setCancellingId] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [txLog, setTxLog] = useState(loadTxLog);
  const [copied, setCopied] = useState("");

  const priceFilledFor = useRef("");
  const provider = typeof window !== "undefined" ? window.ethereum : null;

  const ownerAddress = bot.data?.ownerAddress || "";
  const requesterAddress = bot.data?.requesterAddress || "";
  const walletMatches =
    Boolean(account) &&
    Boolean(requesterAddress) &&
    account.toLowerCase() === requesterAddress.toLowerCase();
  const correctNetwork = chainId === CHAIN_ID;
  const botReady = bot.state === "ready";
  const canTrade = Boolean(account) && correctNetwork && walletMatches && botReady;

  // ---- transaction log persistence
  useEffect(() => {
    try {
      localStorage.setItem(TX_LOG_KEY, JSON.stringify(txLog));
    } catch {
      // storage unavailable: the log still works for this session
    }
  }, [txLog]);

  const recordTx = useCallback((label, result) => {
    const hash = result?.hash;
    if (!hash) return;
    setTxLog((previous) => [{ label, hash, at: Date.now() }, ...previous].slice(0, 30));
  }, []);

  const copyHash = async (hash) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(hash);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setMessage("Copy failed. Select the hash text and copy it manually.");
    }
  };

  // ---- wallet and network synchronisation
  useEffect(() => {
    if (!provider) return undefined;

    const sync = async () => {
      try {
        const [accounts, chain] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);
        setAccount(accounts?.[0] || "");
        setChainId(Number.parseInt(chain, 16));
      } catch {
        setMessage("Could not read wallet status.");
      }
    };

    const onAccounts = (accounts) => setAccount(accounts?.[0] || "");
    const onChain = (chain) => setChainId(Number.parseInt(chain, 16));
    const onAppDisconnect = () => {
      setAccount("");
      setMessage("Wallet disconnected from PerpPilot.");
    };

    // Fired by the Risk Calculator ("Use in order form")
    const onFillOrder = (event) => {
      const detail = event?.detail || {};
      if (detail.side) setSide(detail.side);
      if (detail.quantity) setQuantity(String(detail.quantity));
      if (detail.price) setPrice(String(detail.price));
      setMessage("Order form filled from the risk calculator. Review it, then sign.");
    };

    const first = setTimeout(sync, 0);

    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    window.addEventListener("perppilot:wallet-disconnected", onAppDisconnect);
    window.addEventListener("perppilot:wallet-connected", sync);
    window.addEventListener("perppilot:fill-order", onFillOrder);

    return () => {
      clearTimeout(first);
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
      window.removeEventListener("perppilot:wallet-disconnected", onAppDisconnect);
      window.removeEventListener("perppilot:wallet-connected", sync);
      window.removeEventListener("perppilot:fill-order", onFillOrder);
    };
  }, [provider]);

  // ---- linked bot status (read-only backend call)
  const loadBotStatus = useCallback(async () => {
    try {
      const data = await fetchBotStatus(apiUrl);
      setBot({
        state: data.status === "ready" ? "ready" : "permissions_missing",
        data,
        message: "",
      });
    } catch (error) {
      setBot({ state: "offline", data: null, message: friendlyError(error, "Bot status unavailable.") });
    }
  }, [apiUrl]);

  useEffect(() => {
    const first = setTimeout(loadBotStatus, 0);
    return () => clearTimeout(first);
  }, [loadBotStatus]);

  // ---- default limit price: live mark, aligned to the tick, once per market
  useEffect(() => {
    if (!market?.symbol || market.quoteDecimals == null) return;
    if (priceFilledFor.current === market.symbol) return;

    try {
      const tick = BigInt(market.tickSize ?? 0);
      if (tick <= 0n) return;

      const markRaw =
        liveMark != null
          ? parseUnits(String(liveMark.toFixed(Math.min(market.quoteDecimals, 8))), market.quoteDecimals)
          : market.markPriceRaw
            ? BigInt(market.markPriceRaw)
            : null;

      if (markRaw === null) return;

      const aligned = ((markRaw + tick / 2n) / tick) * tick;
      const fill = setTimeout(() => {
        priceFilledFor.current = market.symbol;
        setPrice(formatUnits(aligned, market.quoteDecimals));
      }, 0);
      return () => clearTimeout(fill);
    } catch {
      // leave the price empty; the user can type one
    }
  }, [market, liveMark]);

  // ---- account reads for the dreamDEX wallet (no wallet connection needed)
  const refreshAccount = useCallback(async () => {
    if (!ownerAddress || !market?.marginBank || !market?.poolAddress) return;

    setBusy(true);
    setMessage("");

    try {
      const client = getSdk().client;

      const reads = await Promise.allSettled([
        client.getMarginAccount(market.marginBank, ownerAddress),
        client.getAccountHealth(market.marginBank, ownerAddress),
        client.getOpenOrdersOnchain([market.poolAddress], ownerAddress),
      ]);

      const setters = [setMargin, setHealth, setOpenOrders];
      const labels = ["Margin account", "Account health", "Open orders"];
      const failures = [];

      reads.forEach((result, index) => {
        if (result.status === "fulfilled") {
          setters[index](result.value);
        } else {
          setters[index](null);
          failures.push(
            `${labels[index]}: ${result.reason?.shortMessage || result.reason?.message || "Read failed"}`
          );
        }
      });

      setLastChecked(new Date());
      setMessage(
        failures.length
          ? `Some testnet reads failed: ${failures.join(" | ")}`
          : "Account information refreshed."
      );
    } catch (error) {
      setMessage(friendlyError(error, "Account information could not be loaded."));
    } finally {
      setBusy(false);
    }
  }, [ownerAddress, market]);

  useEffect(() => {
    const first = setTimeout(refreshAccount, 0);
    return () => clearTimeout(first);
  }, [refreshAccount]);

  const refreshAll = async () => {
    setBot((previous) => ({ ...previous, state: "loading" }));
    await loadBotStatus();
    await refreshAccount();
  };

  const requireReady = () => {
    if (!provider || !account) return "Connect MetaMask first.";
    if (!correctNetwork) return "Switch MetaMask to Somnia Hideki Testnet (chain 50383).";
    if (bot.state === "offline") return bot.message || "The PerpPilot backend is not reachable.";
    if (!botReady) return "The linked bot does not have permission to trade yet. Check Link a bot in the dreamDEX app.";
    if (!walletMatches) {
      return `Connect the MetaMask account ${shortAddress(requesterAddress)} that is authorized for this app.`;
    }
    if (!market?.poolAddress || !market?.marginBank) return "This market is missing trading metadata.";
    return "";
  };

  // ---- place an order (MetaMask signs, the linked bot sends)
  const submitOrder = async () => {
    const blocker = requireReady();
    if (blocker) {
      setMessage(blocker);
      return;
    }

    if (!market?.baseDecimals || market.quoteDecimals == null || !market?.lotSize || !market?.tickSize || !market?.minQuantity) {
      setMessage("This market is missing required trading metadata.");
      return;
    }

    let quantityRaw;
    let priceRaw;

    try {
      quantityRaw = parseUnits(quantity, market.baseDecimals);
      priceRaw = parseUnits(price, market.quoteDecimals);
    } catch {
      setMessage("Enter a valid quantity and price.");
      return;
    }

    const lotSize = BigInt(market.lotSize);
    const tickSize = BigInt(market.tickSize);
    const minQuantity = BigInt(market.minQuantity);

    if (quantityRaw <= 0n || priceRaw <= 0n) {
      setMessage("Quantity and price must be greater than zero.");
      return;
    }

    if (quantityRaw < minQuantity || quantityRaw % lotSize !== 0n) {
      setMessage(
        `Quantity must be at least ${formatUnits(minQuantity, market.baseDecimals)} ${market.baseSymbol} and a multiple of ${formatUnits(lotSize, market.baseDecimals)}.`
      );
      return;
    }

    if (priceRaw % tickSize !== 0n) {
      setMessage(`Price must be a multiple of ${formatUnits(tickSize, market.quoteDecimals)}.`);
      return;
    }

    const confirmed = window.confirm(
      `Review order:\n\n${side === "long" ? "BUY / LONG" : "SELL / SHORT"} ${quantity} ${market.baseSymbol}\n` +
        `${market.symbol} limit at ${price} ${market.quoteSymbol}\n\n` +
        `Next, MetaMask asks you to SIGN a message. This is not a transaction and costs no gas.\n` +
        `Your linked bot then sends the order for your dreamDEX wallet ${shortAddress(ownerAddress)}.`
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("Checking order capacity...");

    try {
      const capacity = await getSdk().client.getMaxPerpOrderSize({
        pool: market.poolAddress,
        marginBank: market.marginBank,
        account: ownerAddress,
        isBid: side === "long",
        price: priceRaw,
      });

      if (capacity?.placeable === false) {
        throw new Error(
          `The dreamDEX account cannot place this order (${capacity.limitedBy || "limit reached"}).`
        );
      }

      const maxQuantity = findMaxQuantity(capacity);

      if (maxQuantity !== null && maxQuantity === 0n) {
        throw new Error("This dreamDEX account has no trading capacity for that order.");
      }

      if (maxQuantity !== null && quantityRaw > maxQuantity) {
        throw new Error(
          `Quantity is above your capacity. Maximum is ${formatUnits(maxQuantity, market.baseDecimals)} ${market.baseSymbol}.`
        );
      }

      setMessage("Waiting for your MetaMask signature...");

      const result = await executeBotAuthorization({
        apiUrl,
        provider,
        account,
        action: "place",
        symbol: market.symbol,
        isBid: side === "long",
        priceRaw: priceRaw.toString(),
        quantityRaw: quantityRaw.toString(),
      });

      recordTx(`Place ${side === "long" ? "LONG" : "SHORT"} limit ${market.symbol}`, result);

      if (result?.receipt?.status === "reverted") {
        throw new Error("The order transaction reverted on-chain. No order was placed.");
      }

      setMessage(
        `Order sent by your bot. Transaction ${shortAddress(result.hash)} is in the transaction log below. Refreshing...`
      );
      await refreshAccount();
    } catch (error) {
      setMessage(friendlyError(error, "Order submission failed."));
    } finally {
      setBusy(false);
    }
  };

  // ---- cancel an open order
  const cancelOrder = async (order) => {
    const blocker = requireReady();
    if (blocker) {
      setMessage(blocker);
      return;
    }

    const orderId = BigInt(order.orderId);

    const confirmed = window.confirm(
      `Cancel order #${orderId} on ${market.symbol}?\n\nMetaMask will ask you to SIGN a message (no gas). Your linked bot then sends the cancellation.`
    );
    if (!confirmed) return;

    setCancellingId(orderId.toString());
    setMessage("Waiting for your MetaMask signature...");

    try {
      const result = await executeBotAuthorization({
        apiUrl,
        provider,
        account,
        action: "cancel",
        symbol: market.symbol,
        orderId: orderId.toString(),
      });

      recordTx(`Cancel order #${orderId} ${market.symbol}`, result);

      if (result?.receipt?.status === "reverted") {
        throw new Error("The cancellation reverted on-chain. The order may already be filled or cancelled.");
      }

      setMessage(`Order #${orderId} cancelled. Refreshing...`);
      await refreshAccount();
    } catch (error) {
      setMessage(friendlyError(error, "Cancellation failed."));
    } finally {
      setCancellingId(null);
    }
  };

  // ---- derived values
  let markNumber = null;
  if (liveMark != null) {
    markNumber = liveMark;
  } else if (market?.markPriceRaw && market.quoteDecimals != null) {
    try {
      markNumber = Number(formatUnits(BigInt(market.markPriceRaw), market.quoteDecimals));
    } catch {
      markNumber = null;
    }
  }

  const monitor = useMemo(() => {
    if (!health && !margin) return { status: "Not loaded", tone: "#8b9a93" };

    const equity = toNumber(health?.equity ?? margin?.equity);
    const imReq = toNumber(health?.imReq);
    const mmReq = toNumber(health?.mmReq);
    const usage = equity > 0 ? (imReq / equity) * 100 : 0;
    const marginStatus = health?.marginStatus || margin?.marginStatus;

    let status = "Safe";
    let tone = green;
    let note = "Margin usage is low.";

    if (equity <= 0) {
      status = "No collateral";
      tone = amber;
      note = "The dreamDEX wallet has no collateral yet.";
    } else if (marginStatus && marginStatus !== "Healthy") {
      status = "At risk";
      tone = red;
      note = "The account is not healthy. Reduce exposure or add collateral.";
    } else if (usage > 80) {
      status = "Danger";
      tone = red;
      note = "Over 80% of equity is committed as margin.";
    } else if (usage > 50) {
      status = "Caution";
      tone = amber;
      note = "Over half of equity is committed as margin.";
    }

    return { status, tone, note, equity, imReq, mmReq, usage, buffer: equity - mmReq };
  }, [health, margin]);

  const orderDistance = (order) => {
    try {
      if (!markNumber) return null;
      const orderPrice = Number(formatUnits(BigInt(order.price), market.quoteDecimals ?? 18));
      return ((orderPrice - markNumber) / markNumber) * 100;
    } catch {
      return null;
    }
  };

  if (!market) return null;

  const botGas = Number(bot.data?.botBalanceSTT);

  return (
    <section style={panelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <h2 style={{ margin: 0 }}>Perp Trading</h2>
          <p style={{ ...muted, margin: "6px 0" }}>Somnia Hideki Testnet · {market.symbol}</p>
        </div>

        <span style={{ fontSize: "12px", color: canTrade ? green : amber }}>
          {canTrade ? "Ready to trade" : "Setup needed (see below)"}
        </span>
      </div>

      {/* Trading account / linked bot */}
      <div style={{ ...cardStyle, marginTop: "12px" }}>
        <p style={{ ...muted, fontSize: "12px", margin: 0 }}>Trading account (your dreamDEX wallet + linked bot)</p>

        {bot.state === "loading" && <p style={{ margin: "8px 0 0", fontSize: "13px" }}>Checking the linked bot...</p>}

        {bot.state === "offline" && (
          <p style={{ color: amber, margin: "8px 0 0", fontSize: "13px", overflowWrap: "anywhere" }}>
            {bot.message || "The PerpPilot backend is not reachable."} Start it from the project folder with{" "}
            <code>uvicorn backend.app.main:app --reload</code>, then press Refresh.
          </p>
        )}

        {(bot.state === "ready" || bot.state === "permissions_missing") && bot.data && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "12px", marginTop: "10px", fontSize: "13px" }}>
            <div>
              <span style={muted}>dreamDEX wallet (holds margin)</span>
              <br />
              <strong style={{ fontFamily: "monospace" }}>{shortAddress(ownerAddress)}</strong>
            </div>
            <div>
              <span style={muted}>Linked bot (sends orders)</span>
              <br />
              <strong style={{ fontFamily: "monospace" }}>{shortAddress(bot.data.botAddress)}</strong>
              <span style={{ ...muted, marginLeft: "8px" }}>
                gas {Number.isFinite(botGas) ? botGas.toFixed(3) : "?"} STT
              </span>
            </div>
            <div>
              <span style={muted}>Bot permissions</span>
              <br />
              <strong style={{ color: bot.data.permissions?.placeOrders ? green : red }}>
                place {bot.data.permissions?.placeOrders ? "yes" : "no"}
              </strong>
              {" · "}
              <strong style={{ color: bot.data.permissions?.cancelOrders ? green : red }}>
                cancel {bot.data.permissions?.cancelOrders ? "yes" : "no"}
              </strong>
            </div>
            <div>
              <span style={muted}>Your MetaMask</span>
              <br />
              <strong style={{ color: walletMatches ? green : amber }}>
                {account ? shortAddress(account) : "not connected"}
                {account && !walletMatches ? ` (expected ${shortAddress(requesterAddress)})` : ""}
              </strong>
            </div>
          </div>
        )}

        {bot.state === "permissions_missing" && (
          <p style={{ color: amber, fontSize: "13px", margin: "10px 0 0" }}>
            The bot is linked but lacks place/cancel permission. In app.testnet.dreamdex.io open your wallet, choose
            Link a bot, and make sure Perps is enabled for the bot.
          </p>
        )}

        {botReady && Number.isFinite(botGas) && botGas < 0.1 && (
          <p style={{ color: amber, fontSize: "13px", margin: "10px 0 0" }}>
            The bot is low on gas. Top it up from the dreamDEX wallet panel (Link a bot, send STT).
          </p>
        )}

        {botReady && account && !walletMatches && (
          <p style={{ color: amber, fontSize: "13px", margin: "10px 0 0" }}>
            Switch MetaMask to the authorized account {shortAddress(requesterAddress)}.
          </p>
        )}

        {account && !correctNetwork && (
          <p style={{ color: amber, fontSize: "13px", margin: "10px 0 0" }}>
            MetaMask is on the wrong network. Use the wallet button at the top to switch to Hideki.
          </p>
        )}

        {!account && (
          <p style={{ color: amber, fontSize: "13px", margin: "10px 0 0" }}>
            Connect MetaMask with the wallet button at the top of the page.
          </p>
        )}

        <p style={{ ...muted, fontSize: "12px", margin: "10px 0 0" }}>
          Your MetaMask only signs a one-time authorization for each action. The bot can place and cancel orders for
          your dreamDEX wallet but can never withdraw funds, and its key stays on your backend.
        </p>
      </div>

      {/* Order form */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "12px", marginTop: "16px" }}>
        <div>
          <label>Direction</label>
          <select value={side} onChange={(event) => setSide(event.target.value)} style={inputStyle}>
            <option value="long">Buy / Long</option>
            <option value="short">Sell / Short</option>
          </select>
        </div>

        <div>
          <label>Quantity ({market.baseSymbol})</label>
          <input type="number" min="0" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Enter quantity" style={inputStyle} />
        </div>

        <div>
          <label>Limit price ({market.quoteSymbol})</label>
          <input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Enter limit price" style={inputStyle} />
        </div>
      </div>

      <p style={{ ...muted, fontSize: "12px" }}>
        {liveMark != null ? "Live mark" : "Mark"} price: {markNumber != null ? markNumber.toLocaleString(undefined, { maximumFractionDigits: 6 }) : "unavailable"} ·
        Minimum quantity: {market.minQuantity != null && market.baseDecimals != null ? formatUnits(BigInt(market.minQuantity), market.baseDecimals) : "?"} {market.baseSymbol} ·
        Step: {market.lotSize != null && market.baseDecimals != null ? formatUnits(BigInt(market.lotSize), market.baseDecimals) : "?"} ·
        Price tick: {market.tickSize != null && market.quoteDecimals != null ? formatUnits(BigInt(market.tickSize), market.quoteDecimals) : "?"}
      </p>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "16px" }}>
        <button
          onClick={submitOrder}
          disabled={busy || !canTrade}
          style={{
            padding: "11px 18px",
            borderRadius: "8px",
            border: 0,
            background: "linear-gradient(135deg, #35d48c, #1fa971)",
            color: "#04130c",
            fontWeight: 700,
            cursor: busy ? "wait" : canTrade ? "pointer" : "not-allowed",
            opacity: busy || !canTrade ? 0.5 : 1,
          }}
        >
          {busy ? "Please wait..." : "Review & Sign Limit Order"}
        </button>

        <button onClick={refreshAll} disabled={busy} style={{ ...ghostButton, opacity: busy ? 0.5 : 1 }}>
          Refresh
        </button>
      </div>

      {message && (
        <p role="status" style={{ color: amber, marginTop: "14px", overflowWrap: "anywhere" }}>
          {message}
        </p>
      )}

      {/* dreamDEX wallet metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px", marginTop: "24px" }}>
        {[
          ["Account equity", margin ? displayCollateral(margin.equity) : "—"],
          ["Available collateral", margin ? displayCollateral(margin.unlockedCollateralBalance) : "—"],
          ["Locked collateral", margin ? displayCollateral(margin.lockedCollateral) : "—"],
          ["Margin status", health?.marginStatus || margin?.marginStatus || "—"],
        ].map(([label, value]) => (
          <div key={label} style={cardStyle}>
            <p style={{ ...muted, fontSize: "12px", margin: 0 }}>{label}</p>
            <strong style={{ display: "block", fontSize: "20px", marginTop: "9px" }}>{value}</strong>
          </div>
        ))}
      </div>

      {/* Risk monitor */}
      <div style={{ ...cardStyle, marginTop: "16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
          <p style={{ ...muted, fontSize: "12px", margin: 0 }}>Position &amp; risk monitor</p>
          <strong style={{ color: monitor.tone }}>{monitor.status}</strong>
        </div>

        {monitor.note && <p style={{ fontSize: "13px", margin: "8px 0 0" }}>{monitor.note}</p>}

        {monitor.equity > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px", marginTop: "12px", fontSize: "13px" }}>
            <div>
              <span style={muted}>Margin used</span>
              <br />
              <strong>{monitor.usage.toFixed(1)}%</strong>
            </div>
            <div>
              <span style={muted}>Initial margin required</span>
              <br />
              <strong>{monitor.imReq.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong>
            </div>
            <div>
              <span style={muted}>Buffer above maintenance</span>
              <br />
              <strong>{monitor.buffer.toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong>
            </div>
          </div>
        )}

        <p style={{ color: "#6f7f78", fontSize: "11px", margin: "10px 0 0" }}>
          {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}. Use Refresh to update.` : "Not checked yet."}
        </p>
      </div>

      {/* Open orders */}
      <div style={{ marginTop: "16px", overflowX: "auto" }}>
        <p style={{ ...muted, fontSize: "12px", margin: "0 0 6px" }}>
          Your open orders on {market.symbol} ({openOrders ? openOrders.orders?.length ?? 0 : "not loaded"})
        </p>

        {openOrders?.orders?.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ ...muted, textAlign: "left" }}>
                <th style={{ padding: "6px" }}>ID</th>
                <th style={{ padding: "6px" }}>Side</th>
                <th style={{ padding: "6px" }}>Price ({market.quoteSymbol})</th>
                <th style={{ padding: "6px" }}>Vs mark</th>
                <th style={{ padding: "6px" }}>Remaining ({market.baseSymbol})</th>
                <th style={{ padding: "6px" }} />
              </tr>
            </thead>

            <tbody>
              {openOrders.orders.map((order) => {
                const id = order.orderId.toString();
                const distance = orderDistance(order);

                return (
                  <tr key={id} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "6px" }}>#{id}</td>
                    <td style={{ padding: "6px", color: order.isBid ? green : red }}>{order.isBid ? "Long / Buy" : "Short / Sell"}</td>
                    <td style={{ padding: "6px" }}>{formatUnits(BigInt(order.price), market.quoteDecimals ?? 18)}</td>
                    <td style={{ padding: "6px" }}>
                      {distance === null ? "—" : `${distance >= 0 ? "+" : ""}${distance.toFixed(2)}%`}
                      {distance !== null && Math.abs(distance) < 0.3 && <span style={{ color: amber }}> · near market</span>}
                      {distance !== null && Math.abs(distance) > 5 && <span style={muted}> · far from market</span>}
                    </td>
                    <td style={{ padding: "6px" }}>{formatUnits(BigInt(order.quantityRemaining), market.baseDecimals ?? 18)}</td>
                    <td style={{ padding: "6px", textAlign: "right" }}>
                      <button
                        onClick={() => cancelOrder(order)}
                        disabled={busy || cancellingId !== null || !canTrade}
                        style={{
                          background: "rgba(239,119,116,.10)",
                          color: red,
                          border: "1px solid rgba(239,119,116,.35)",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity: busy || cancellingId !== null || !canTrade ? 0.5 : 1,
                        }}
                      >
                        {cancellingId === id ? "Cancelling..." : "Cancel"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p style={{ color: "#6f7f78", fontSize: "13px", margin: 0 }}>
            No open orders. After you place a limit order that does not fill immediately, it appears here with a Cancel button.
          </p>
        )}
      </div>

      {/* Transaction log */}
      <div style={{ marginTop: "16px" }}>
        <p style={{ ...muted, fontSize: "12px", margin: "0 0 6px" }}>Transaction log (real on-chain transactions sent for you)</p>

        {txLog.length === 0 ? (
          <p style={{ color: "#6f7f78", fontSize: "13px", margin: 0 }}>
            No transactions yet. After you place or cancel a REAL order (sign in MetaMask), the transaction hash appears here with Copy and Explorer buttons.
            Paper trades never appear here because they are not on the blockchain.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                {txLog.map((tx) => (
                  <tr key={tx.hash} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "8px 6px", ...muted, whiteSpace: "nowrap" }}>{new Date(tx.at).toLocaleString()}</td>
                    <td style={{ padding: "8px 6px" }}>{tx.label}</td>
                    <td style={{ padding: "8px 6px", fontFamily: "monospace", overflowWrap: "anywhere" }}>{tx.hash}</td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      <button type="button" onClick={() => copyHash(tx.hash)} style={{ ...ghostButton, padding: "5px 10px", marginRight: "6px" }}>
                        {copied === tx.hash ? "Copied" : "Copy"}
                      </button>
                      <a href={`${EXPLORER_TX}${tx.hash}`} target="_blank" rel="noreferrer" style={{ color: green }}>
                        Explorer
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details style={{ marginTop: "16px", ...muted }}>
        <summary style={{ cursor: "pointer" }}>View technical details</summary>
        {[
          [bot.data, "Bot status not loaded."],
          [health, "Account health not loaded."],
          [openOrders, "Open orders not loaded."],
        ].map(([value, fallback]) => (
          <pre
            key={fallback}
            style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "11px", background: "rgba(0,0,0,0.28)", padding: "12px", borderRadius: "8px" }}
          >
            {value ? jsonSafe(value) : fallback}
          </pre>
        ))}
      </details>

      <p style={{ ...muted, fontSize: "11px" }}>
        Testnet prototype. Nothing is traded automatically. Every order and cancellation needs your MetaMask signature
        and is executed by your linked bot for your dreamDEX wallet.
      </p>
    </section>
  );
}
