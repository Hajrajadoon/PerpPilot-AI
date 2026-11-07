import { createWalletClient, custom } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const CHAIN_ID = 50383;

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.detail || data.error || `Request failed (${response.status})`
    );
  }

  return data;
}

// Read-only: who owns the margin, which bot is linked, and its permissions.
export async function fetchBotStatus(apiUrl) {
  const response = await fetch(`${apiUrl}/api/dreamdex/bot/status`);
  return readResponse(response);
}

// 1) The backend prepares a one-time, 2-minute authorization for this exact action.
// 2) MetaMask signs it (a signature only: no transaction, no gas).
// 3) The backend verifies the signature, and the linked bot sends the order or
//    cancellation for your dreamDEX wallet. The bot key never leaves the backend.
export async function executeBotAuthorization({
  apiUrl,
  provider,
  account,
  action,
  symbol,
  isBid = false,
  priceRaw = "0",
  quantityRaw = "0",
  orderId = "0",
}) {
  if (!provider || !account) {
    throw new Error("Connect MetaMask before authorizing this action.");
  }

  const [chain, accounts] = await Promise.all([
    provider.request({ method: "eth_chainId" }),
    provider.request({ method: "eth_accounts" }),
  ]);

  if (Number.parseInt(chain, 16) !== CHAIN_ID) {
    throw new Error("Switch MetaMask to Somnia Hideki Testnet (chain 50383).");
  }

  if (!accounts?.[0] || accounts[0].toLowerCase() !== account.toLowerCase()) {
    throw new Error("The connected MetaMask account changed. Reconnect and try again.");
  }

  const challengeResponse = await fetch(`${apiUrl}/api/dreamdex/bot/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      symbol,
      isBid,
      priceRaw: String(priceRaw),
      quantityRaw: String(quantityRaw),
      orderId: String(orderId),
    }),
  });

  const challenge = await readResponse(challengeResponse);

  if (!challenge.challengeId || !challenge.typedData) {
    throw new Error("The backend returned an incomplete authorization challenge.");
  }

  const walletClient = createWalletClient({
    account,
    chain: hidekiTestnet,
    transport: custom(provider),
  });

  const { domain, types, primaryType, message } = challenge.typedData;

  const signature = await walletClient.signTypedData({
    account,
    domain,
    types,
    primaryType,
    message,
  });

  const executeResponse = await fetch(`${apiUrl}/api/dreamdex/bot/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature,
    }),
  });

  return readResponse(executeResponse);
}
