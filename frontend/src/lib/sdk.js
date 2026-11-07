import {
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  SomniaMarkets,
} from "@somnia-chain/markets-sdk";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://hideki-dev.smk.somnia.host/v1/graphql";

let instance = null;

// One shared read/write SDK instance for the whole app.
export function getSdk() {
  if (!instance) {
    instance = new SomniaMarkets({
      chain: hidekiTestnet,
      wsRpcUrl: "wss://api.hideki2.infra.testnet.somnia.network/ws",
      indexerUrl: INDEXER_URL,
      addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    });
  }
  return instance;
}
