import {
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  SomniaMarkets,
} from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

function units(value, decimals = 18) {
  if (value == null) return "N/A";
  const n = BigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = n / divisor;
  const fraction = (n % divisor).toString().padStart(decimals, "0");
  return `${whole}.${fraction.slice(0, 4)}`;
}

async function main() {
  const markets = new SomniaMarkets({
    chain: hidekiTestnet,
    indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
    addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  });

  const result = await markets.client.listPerpMarkets();
  const list = Array.isArray(result) ? result : result?.markets ?? [];

  console.log(`\nPERPPILOT AI | SOMNIA TESTNET | ${list.length} MARKETS`);
  console.log("Symbol | Mark Price | Feed Healthy | Pool");

  for (const market of list) {
    try {
      const status = await markets.client.getPerpFeedStatus(
        market.poolAddress
      );

      console.log(
        `${market.baseSymbol ?? "?"}-PERP | ` +
        `${units(status.markPrice)} USDso | ` +
        `${status.markPriceOk ? "YES" : "NO"} | ` +
        `${market.poolAddress}`
      );
    } catch (error) {
      console.log(
        `${market.baseSymbol ?? "?"}-PERP | Feed check failed: ${error.message}`
      );
    }
  }
}

main().catch((error) => {
  console.error("Connection failed:", error.message);
  process.exitCode = 1;
});
