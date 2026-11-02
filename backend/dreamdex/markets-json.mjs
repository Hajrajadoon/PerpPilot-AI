import {
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  SomniaMarkets,
} from "@somnia-chain/markets-sdk";

import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://hideki-dev.smk.somnia.host/v1/graphql";

function formatUnits(value, decimals = 18) {
  if (value == null) return null;

  const n = BigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = n / divisor;
  const fraction = (n % divisor).toString().padStart(decimals, "0");

  return `${whole}.${fraction}`.replace(/\.?0+$/, "");
}

async function main() {
  const markets = new SomniaMarkets({
    chain: hidekiTestnet,
    indexerUrl: INDEXER_URL,
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  });

  const mode = process.argv[2] || "markets";

  if (mode === "candles") {
    const requestedSymbol = (process.argv[3] || "BTC-PERP").toUpperCase();
    const intervalSeconds = Number(process.argv[4] || 900);
    const limit = Math.min(500, Math.max(10, Number(process.argv[5] || 100)));

    const validIntervals = [60, 300, 900, 3600, 14400, 86400];

    if (!validIntervals.includes(intervalSeconds)) {
      throw new Error("Unsupported candle interval.");
    }

    const result = await markets.client.listPerpMarkets();
    const list = Array.isArray(result) ? result : result?.markets ?? [];

    const market = list.find(
      (item) =>
        `${item.baseSymbol}-PERP`.toUpperCase() === requestedSymbol ||
        item.baseSymbol.toUpperCase() === requestedSymbol
    );

    if (!market) {
      throw new Error(`DreamDEX market not found: ${requestedSymbol}`);
    }

    const poolAddress = market.poolAddress;

    const candles = await markets.client.getCandles(
      poolAddress,
      intervalSeconds,
      {
        limit,
        market: poolAddress,
      }
    );

    const output = candles.map((candle) => ({
      time: Number(candle.bucketStart) * 1000,
      open: Number(formatUnits(candle.openPrice, market.quoteDecimals)),
      high: Number(formatUnits(candle.high, market.quoteDecimals)),
      low: Number(formatUnits(candle.low, market.quoteDecimals)),
      close: Number(formatUnits(candle.closePrice, market.quoteDecimals)),
      volume: Number(formatUnits(candle.baseVolume, market.baseDecimals)),
      quoteVolume: formatUnits(candle.quoteVolume, market.quoteDecimals),
      tradeCount: candle.tradeCount,
    }));

    console.log(JSON.stringify({
      network: "Somnia Hideki Testnet",
      chainId: hidekiTestnet.id,
      symbol: `${market.baseSymbol}-PERP`,
      poolAddress,
      intervalSeconds,
      candleCount: output.length,
      candles: output,
    }));

    return;
  }

  const result = await markets.client.listPerpMarkets();
  const list = Array.isArray(result) ? result : result?.markets ?? [];

  const output = list.map((market) => ({
    symbol: `${market.baseSymbol}-PERP`,
    baseSymbol: market.baseSymbol,
    quoteSymbol: market.quoteSymbol,
    poolAddress: market.poolAddress,
    marginBank: market.marginBank,
    chainId: market.chainId,
    marketType: market.marketType,
    markPriceRaw: market.markPrice ?? null,
    markPrice: formatUnits(market.markPrice),
    indexPriceRaw: market.indexPrice ?? null,
    lastPriceRaw: market.lastPrice ?? null,
    fundingRateRaw: market.fundingRate ?? null,
    openInterestRaw: market.openInterest ?? null,
    initialMarginBps: market.initialMarginBps,
    baseDecimals: market.baseDecimals,
    quoteDecimals: market.quoteDecimals,
    minQuantity: market.minQuantity,
    tickSize: market.tickSize,
    feedHealthy: null,
    feedUpdatedAt: market.indexUpdatedAt ?? null,
    feedError: null,
  }));

  console.log(JSON.stringify({
    network: "Somnia Hideki Testnet",
    chainId: hidekiTestnet.id,
    marketCount: output.length,
    markets: output,
  }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
