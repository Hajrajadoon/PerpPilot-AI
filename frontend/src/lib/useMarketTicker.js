import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { getSdk } from "./sdk.js";

const EMPTY = {
  forPool: null,
  bid: null,
  ask: null,
  volume: null,
  trades: null,
  mark: null,
  fundingRate: null,
  openInterest: null,
  bookLoaded: false,
  statsLoaded: false,
  stateLoaded: false,
};

function toNumber(raw, decimals) {
  try {
    if (raw === null || raw === undefined) return null;
    return Number(formatUnits(BigInt(raw), decimals));
  } catch {
    return null;
  }
}

// Best bid / ask (chain top-of-book), trailing 24h volume, and the live on-chain
// perp state (mark price, funding rate, open interest). The market-list row only
// advances its mark price at funding settlement, so the live state is read here.
export function useMarketTicker(market, refreshMs = 30000) {
  const [ticker, setTicker] = useState(EMPTY);

  const pool = market?.poolAddress;
  const quoteDecimals = market?.quoteDecimals;
  const baseDecimals = market?.baseDecimals;

  useEffect(() => {
    if (!pool || quoteDecimals == null) {
      const reset = setTimeout(() => setTicker(EMPTY), 0);
      return () => clearTimeout(reset);
    }

    let cancelled = false;

    const load = async () => {
      const client = getSdk().client;

      const [book, stats, state] = await Promise.allSettled([
        client.getBookTopsOnchain([{ id: pool, poolAddress: pool }]),
        client.getMarketStats24h({ pool }),
        client.getPerpState(pool),
      ]);

      if (cancelled) return;

      const next = { ...EMPTY, forPool: pool };

      if (book.status === "fulfilled") {
        const top = book.value?.tops?.[pool.toLowerCase()];
        next.bookLoaded = true;
        next.bid = toNumber(top?.bestBid, quoteDecimals);
        next.ask = toNumber(top?.bestAsk, quoteDecimals);
      }

      if (stats.status === "fulfilled") {
        next.statsLoaded = true;
        next.volume = toNumber(stats.value?.volume24h, quoteDecimals);
        next.trades = stats.value?.trades24h ?? null;
      }

      if (state.status === "fulfilled") {
        next.stateLoaded = true;

        if (state.value?.markPriceOk) {
          next.mark = toNumber(state.value.markPrice, quoteDecimals);
        }

        next.fundingRate = toNumber(state.value?.fundingRate, 18);
        next.openInterest =
          baseDecimals != null ? toNumber(state.value?.openInterest, baseDecimals) : null;
      }

      setTicker(next);
    };

    const first = setTimeout(load, 0);
    const timer = setInterval(load, refreshMs);

    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [pool, quoteDecimals, baseDecimals, refreshMs]);

  // Never show one market's numbers while another market is loading.
  return ticker.forPool === pool ? ticker : EMPTY;
}
