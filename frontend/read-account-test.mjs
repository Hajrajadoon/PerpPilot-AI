import {
  SomniaMarkets,
  SOMNIA_HIDEKI_TESTNET_ADDRESSES
} from "@somnia-chain/markets-sdk";

import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const account = "0x35d5CfCdcacaBF2d50b534a2E50098b5Da192BF6";
const bank = "0x478769E1177C0773c43A593DCCc4Ad15F15F1394";

const sdk = new SomniaMarkets({
  chain: hidekiTestnet,
  wsRpcUrl: "wss://api.hideki2.infra.testnet.somnia.network/ws",
  indexerUrl: "https://hideki-dev.smk.somnia.host/v1/graphql",
  addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES
});

const show = (value) =>
  JSON.stringify(value, (_, v) => typeof v === "bigint" ? v.toString() : v, 2);

async function test(name, fn) {
  console.log("\n--- " + name + " ---");
  try {
    console.log(show(await fn()));
  } catch (error) {
    console.log("FAILED:", error.message);
  }
}

await test("MARGIN BANK SYSTEM CONFIG", () =>
  sdk.client.getPerpSystemConfig(bank)
);

await test("ACCOUNT MARGIN STATE", () =>
  sdk.client.getMarginAccount(bank, account)
);

await test("ACCOUNT HEALTH", () =>
  sdk.client.getAccountHealth(bank, account)
);

await test("VOUCHER ELIGIBILITY", () =>
  sdk.client.getPerpVoucherEligibility(bank, account)
);


await test("VOUCHER ELIGIBILITY", () =>
  sdk.client.getPerpVoucherEligibility(bank, account)
);

process.exit(0);
