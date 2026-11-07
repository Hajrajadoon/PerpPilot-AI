import fs from "node:fs";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  verifyTypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";

const EXPECTED_OWNER = "0x893946f0479115b49d49D0A030838609749F9a10";
const EXPECTED_REQUESTER = "0x35d5CfCdcacaBF2d50b534a2E50098b5Da192BF6";
const EXPECTED_BOT = "0x34E65aA7867c03F26483f5663aCb5308119D6324";
const CHAIN_ID = 50383;
const GAS = 6_000_000n;
const ZERO = "0x0000000000000000000000000000000000000000";

const abi = [
  {
    type: "function",
    name: "isOperatorAuthorized",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "operator", type: "address" },
      { name: "selector", type: "bytes4" },
    ],
    outputs: [{ name: "authorized", type: "bool" }],
  },
  {
    type: "function",
    name: "placeOrderFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "isBid", type: "bool" },
      { name: "userData", type: "uint64" },
      { name: "price", type: "uint256" },
      { name: "quantity", type: "uint256" },
      { name: "expireTimestampNs", type: "uint64" },
      { name: "orderType", type: "uint8" },
      { name: "selfMatchingOption", type: "uint8" },
      { name: "builder", type: "address" },
      { name: "builderFeeBpsTimes1k", type: "uint96" },
    ],
    outputs: [
      { name: "success", type: "bool" },
      { name: "orderId", type: "uint128" },
    ],
  },
  {
    type: "function",
    name: "cancelOrderFor",
    stateMutability: "nonpayable",
    inputs: [
      { name: "owner", type: "address" },
      { name: "orderId", type: "uint128" },
    ],
    outputs: [],
  },
];

async function main() {
  const input = JSON.parse(fs.readFileSync(0, "utf8"));
  const { typedData, market, action, signature } = input;
  const rawKey = process.env.DREAMDEX_BOT_PRIVATE_KEY?.trim();
  const rpcUrl = process.env.SOMNIA_RPC_URL?.trim();

  if (!rawKey || !rpcUrl) throw new Error("Bot configuration is incomplete.");

  const privateKey = rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("Bot signer configuration is invalid.");
  }

  const account = privateKeyToAccount(privateKey);
  const owner = getAddress(process.env.DREAMDEX_OWNER_ADDRESS || "");
  const requester = getAddress(process.env.DREAMDEX_REQUESTER_ADDRESS || "");
  const bot = getAddress(account.address);
  const message = typedData.message;
  const pool = getAddress(market.poolAddress);

  if (owner.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) throw new Error("Owner mismatch.");
  if (requester.toLowerCase() !== EXPECTED_REQUESTER.toLowerCase()) throw new Error("Requester mismatch.");
  if (bot.toLowerCase() !== EXPECTED_BOT.toLowerCase()) throw new Error("Bot signer mismatch.");
  if (Number(message.chainId) !== CHAIN_ID) throw new Error("Wrong chain.");
  if (message.expiresAt < Math.floor(Date.now() / 1000)) throw new Error("Authorization expired.");
  if (getAddress(message.owner) !== owner ||
      getAddress(message.requester) !== requester ||
      getAddress(message.bot) !== bot ||
      getAddress(message.pool) !== pool ||
      getAddress(typedData.domain.verifyingContract) !== pool) {
    throw new Error("Authorization fields do not match the configured accounts or market.");
  }
  if (message.action !== action || message.symbol !== market.symbol) {
    throw new Error("Authorization action or market mismatch.");
  }

  const valid = await verifyTypedData({
    address: requester,
    domain: typedData.domain,
    types: typedData.types,
    primaryType: typedData.primaryType,
    message,
    signature,
  });
  if (!valid) throw new Error("MetaMask authorization signature is invalid.");

  const publicClient = createPublicClient({
    chain: hidekiTestnet,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: hidekiTestnet,
    transport: http(rpcUrl),
  });

  if (await publicClient.getChainId() !== CHAIN_ID) throw new Error("RPC chain mismatch.");

  const selector = action === "place" ? "0x80054449" : "0xe37b444b";
  const authorized = await publicClient.readContract({
    address: pool,
    abi,
    functionName: "isOperatorAuthorized",
    args: [owner, bot, selector],
  });
  if (!authorized) throw new Error("Bot operator permission is not enabled for this market.");

  let request;
  let simulatedOrderId = null;

  if (action === "place") {
    const expiryNs = BigInt(Date.now()) * 1_000_000n + 7n * 24n * 60n * 60n * 1_000_000_000n;
    const simulation = await publicClient.simulateContract({
      account,
      address: pool,
      abi,
      functionName: "placeOrderFor",
      args: [
        owner,
        message.isBid,
        0n,
        BigInt(message.price),
        BigInt(message.quantity),
        expiryNs,
        0,
        0,
        ZERO,
        0n,
      ],
      gas: GAS,
    });
    if (simulation.result?.[0] === false) throw new Error("DreamDEX rejected the order simulation.");
    simulatedOrderId = simulation.result?.[1]?.toString?.() ?? null;
    request = simulation.request;
  } else if (action === "cancel") {
    const simulation = await publicClient.simulateContract({
      account,
      address: pool,
      abi,
      functionName: "cancelOrderFor",
      args: [owner, BigInt(message.orderId)],
      gas: GAS,
    });
    request = simulation.request;
  } else {
    throw new Error("Unsupported action.");
  }

  const hash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  console.log(JSON.stringify({
    hash,
    orderId: simulatedOrderId,
    receipt: { status: receipt.status },
    ownerAddress: owner,
    botAddress: bot,
    market: market.symbol,
  }));
}

main().catch((error) => {
  console.error(error.shortMessage || error.message || "Bot execution failed.");
  process.exitCode = 1;
});
