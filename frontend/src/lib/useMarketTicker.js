import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { getSdk } from "./sdk.js";

const EMPTY = {
  bid: null,
  ask: null,
  volume: null,
  trades: null,
  bookLoaded: false,
  statsLoaded: false,
};

function toNumber(raw, decimals) {
  try {
    if (raw === null || raw === undefined) return null;
    return Number(formatUnits(BigInt(raw), decimals));
  } catch {
    return null;
  }
}

// Best bid / best ask (chain top-of-book) and trailing 24h volume (SDK stats).
export function useMarketTicker(market, refreshMs = 30000) {
  const [ticker, setTicker] = useState(EMPTY);

  const pool = market?.poolAddress;
  const quoteDecimals = market?.quoteDecimals;

  useEffect(() => {
    if (!pool || quoteDecimals == null) {
      setTicker(EMPTY);
      return undefined;
    }

    let cancelled = false;
    setTicker(EMPTY);

    const load = async () => {
      const client = getSdk().client;

      const [book, stats] = await Promise.allSettled([
        client.getBookTopsOnchain([{ id: pool, poolAddress: pool }]),
        client.getMarketStats24h({ pool }),
      ]);

      if (cancelled) return;

      const next = { ...EMPTY };

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

      setTicker(next);
    };

    load();
    const timer = setInterval(load, refreshMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pool, quoteDecimals, refreshMs]);

  return ticker;
}
