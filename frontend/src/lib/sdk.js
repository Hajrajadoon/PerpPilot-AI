import {
  SOMNIA_HIDEKI_TESTNET_ADDRESSES,
  SomniaMarkets,
} from "@somnia-chain/markets-sdk";

import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const INDEXER_URL = "https://hideki-dev.smk.somnia.host/v1/graphql";
const WS_RPC_URL = "wss://api.hideki2.infra.testnet.somnia.network/ws";

let sdkInstance = null;

export function getSdk() {
  if (!sdkInstance) {
    sdkInstance = new SomniaMarkets({
      chain: hidekiTestnet,
      wsRpcUrl: WS_RPC_URL,
      indexerUrl: INDEXER_URL,
      addresses: SOMNIA_HIDEKI_TESTNET_ADDRESSES,
    });
  }

  return sdkInstance;
}
