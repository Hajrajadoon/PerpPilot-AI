// Paper-trading engine: pure functions, no React, no network.
// All state lives in one plain object so it is easy to persist and test.

export const PAPER_START = 10000;
const HISTORY_LIMIT = 200;

export function emptyAccount() {
  return {
    version: 1,
    startBalance: PAPER_START,
    balance: PAPER_START,
    positions: [],
    history: [],
    nextId: 1,
  };
}

export function usedMargin(account) {
  return account.positions.reduce((sum, p) => sum + p.margin, 0);
}

export function pnlOf(position, price) {
  const dir = position.side === "LONG" ? 1 : -1;
  return (price - position.entry) * position.qty * dir;
}

export function openPosition(account, input) {
  const { symbol, side, price, atr, riskPct, imRatio, maxLeverage = 10, now = Date.now() } = input;

  if (side !== "LONG" && side !== "SHORT") return { account, error: "Choose long or short." };
  if (!(price > 0)) return { account, error: "No live price yet. Wait for market data." };
  if (!(atr > 0)) return { account, error: "Not enough market data to set a stop-loss yet." };
  if (!(riskPct > 0) || riskPct > 10) {
    return { account, error: "Risk per trade must be between 0 and 10%." };
  }
  if (account.positions.some((p) => p.symbol === symbol)) {
    return { account, error: `You already have an open ${symbol} paper trade. Close it first.` };
  }

  const dir = side === "LONG" ? 1 : -1;
  const stopDistance = atr * 1.5;
  const stop = price - dir * stopDistance;
  const target = price + dir * stopDistance * 1.5;

  const riskAmount = account.balance * (riskPct / 100);
  let qty = riskAmount / stopDistance;
  const maxQty = (account.balance * maxLeverage) / price;
  if (qty > maxQty) qty = maxQty;

  const notional = qty * price;
  const margin = notional * (imRatio > 0 ? imRatio : 0.05);
  const available = account.balance - usedMargin(account);

  if (!(qty > 0) || !(notional > 0)) return { account, error: "Position size came out as zero." };
  if (margin > available) {
    return { account, error: "Not enough virtual balance for this position." };
  }

  const position = {
    id: account.nextId,
    symbol,
    side,
    entry: price,
    stop,
    target,
    qty,
    margin,
    riskAmount: Math.min(riskAmount, qty * stopDistance),
    lastPrice: price,
    openedAt: now,
  };

  return {
    account: { ...account, positions: [position, ...account.positions], nextId: account.nextId + 1 },
    position,
    error: null,
  };
}

export function closePosition(account, id, exitPrice, reason, now = Date.now()) {
  const position = account.positions.find((p) => p.id === id);
  if (!position) return account;

  const pnl = pnlOf(position, exitPrice);
  const entry = {
    id: position.id,
    symbol: position.symbol,
    side: position.side,
    entry: position.entry,
    exit: exitPrice,
    qty: position.qty,
    pnl,
    rMultiple: position.riskAmount > 0 ? pnl / position.riskAmount : 0,
    result: pnl > 0 ? "WIN" : pnl < 0 ? "LOSS" : "FLAT",
    reason,
    openedAt: position.openedAt,
    closedAt: now,
  };

  return {
    ...account,
    balance: account.balance + pnl,
    positions: account.positions.filter((p) => p.id !== id),
    history: [entry, ...account.history].slice(0, HISTORY_LIMIT),
  };
}

// Update last price for positions on this symbol and auto-close at stop/target.
export function evaluate(account, symbol, price, now = Date.now()) {
  if (!(price > 0)) return account;

  let next = account;

  for (const p of account.positions) {
    if (p.symbol !== symbol) continue;
    // Guard against a stale price from another market during a market switch.
    if (Math.abs(price / p.entry - 1) > 0.5) continue;

    const hitStop = p.side === "LONG" ? price <= p.stop : price >= p.stop;
    const hitTarget = p.side === "LONG" ? price >= p.target : price <= p.target;

    if (hitStop) next = closePosition(next, p.id, p.stop, "Stop-loss hit", now);
    else if (hitTarget) next = closePosition(next, p.id, p.target, "Take-profit hit", now);
    else if (p.lastPrice !== price) {
      next = {
        ...next,
        positions: next.positions.map((q) => (q.id === p.id ? { ...q, lastPrice: price } : q)),
      };
    }
  }

  return next;
}

export function stats(account) {
  const trades = account.history.length;
  const wins = account.history.filter((h) => h.result === "WIN").length;
  const losses = account.history.filter((h) => h.result === "LOSS").length;
  const realized = account.history.reduce((s, h) => s + h.pnl, 0);
  const avgR = trades ? account.history.reduce((s, h) => s + h.rMultiple, 0) / trades : 0;

  const decisive = wins + losses;

  return {
    trades,
    wins,
    losses,
    flats: trades - decisive,
    // Win rate counts only trades that made or lost money; flat closes are ignored.
    winRate: decisive ? (wins / decisive) * 100 : 0,
    realized,
    avgR,
  };
}

// Validate and load a saved account (storage can hold anything).
export function sanitizeAccount(raw) {
  try {
    if (!raw || raw.version !== 1) return emptyAccount();
    if (!Number.isFinite(raw.balance) || !Array.isArray(raw.positions) || !Array.isArray(raw.history)) {
      return emptyAccount();
    }
    return {
      ...emptyAccount(),
      ...raw,
      nextId: Number.isFinite(raw.nextId) ? raw.nextId : raw.history.length + raw.positions.length + 1,
    };
  } catch {
    return emptyAccount();
  }
}
