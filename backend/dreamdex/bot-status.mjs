import {
  createPublicClient,
  formatEther,
  getAddress,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const EXPECTED_OWNER = "0x893946f0479115b49d49D0A030838609749F9a10";
const EXPECTED_BOT = "0x34E65aA7867c03F26483f5663aCb5308119D6324";
const EXPECTED_REQUESTER = "0x35d5CfCdcacaBF2d50b534a2E50098b5Da192BF6";
const BTC_POOL = "0x4181dd08e73bbcdd1ba3e615a18f6abd941b94c0";

const poolAbi = [{
  type: "function",
  name: "isOperatorAuthorized",
  stateMutability: "view",
  inputs: [
    { name: "owner", type: "address" },
    { name: "operator", type: "address" },
    { name: "selector", type: "bytes4" },
  ],
  outputs: [{ name: "authorized", type: "bool" }],
}];

async function main() {
  const rawKey = process.env.DREAMDEX_BOT_PRIVATE_KEY?.trim();
  const ownerValue = process.env.DREAMDEX_OWNER_ADDRESS?.trim();
  const requesterValue = process.env.DREAMDEX_REQUESTER_ADDRESS?.trim();
  const rpcUrl = process.env.SOMNIA_RPC_URL?.trim();

  if (!rawKey || !ownerValue || !requesterValue || !rpcUrl) {
    throw new Error("One or more required backend environment variables are missing.");
  }

  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("The configured bot private key has an invalid format.");
  }

  const account = privateKeyToAccount(privateKey);
  const owner = getAddress(ownerValue);
  const requester = getAddress(requesterValue);
  const bot = getAddress(account.address);

  if (owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    throw new Error("Configured owner does not match the expected DreamDEX Wallet 1.");
  }
  if (requester.toLowerCase() !== EXPECTED_REQUESTER.toLowerCase()) {
    throw new Error("Configured requester does not match the expected MetaMask address.");
  }
  if (bot.toLowerCase() !== EXPECTED_BOT.toLowerCase()) {
    throw new Error("Configured private key does not match the linked DreamDEX bot.");
  }

  const client = createPublicClient({
    chain: hidekiTestnet,
    transport: http(rpcUrl),
  });

  const chainId = await client.getChainId();
  if (chainId !== 50383) {
    throw new Error(`Wrong network. Expected 50383; received ${chainId}.`);
  }

  const [poolCode, balance, canPlaceOrders, canCancelOrders] = await Promise.all([
    client.getCode({ address: BTC_POOL }),
    client.getBalance({ address: bot }),
    client.readContract({
      address: BTC_POOL,
      abi: poolAbi,
      functionName: "isOperatorAuthorized",
      args: [owner, bot, "0x80054449"],
    }),
    client.readContract({
      address: BTC_POOL,
      abi: poolAbi,
      functionName: "isOperatorAuthorized",
      args: [owner, bot, "0xe37b444b"],
    }),
  ]);

  if (!poolCode || poolCode === "0x") {
    throw new Error("BTC-PERP pool address has no contract code on this network.");
  }

  console.log(JSON.stringify({
    status: canPlaceOrders && canCancelOrders ? "ready" : "permissions_missing",
    network: "Somnia Hideki Testnet",
    chainId,
    market: "BTC-PERP",
    poolAddress: BTC_POOL,
    ownerAddress: owner,
    requesterAddress: requester,
    botAddress: bot,
    botBalanceSTT: formatEther(balance),
    permissions: {
      placeOrders: canPlaceOrders,
      cancelOrders: canCancelOrders,
    },
    transactionSent: false,
  }, null, 2));
}

main().catch((error) => {
  console.error("Bot status check failed:", error.shortMessage || error.message);
  process.exitCode = 1;
});