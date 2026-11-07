import { useCallback, useEffect, useMemo, useState } from "react";
import { createWalletClient, custom, formatUnits, parseUnits } from "viem";
import { hidekiTestnet } from "@somnia-chain/markets-sdk/chains";
import { getSdk } from "../lib/sdk.js";

const CHAIN_ID = 50383;

// The SDK defaults to a 10,000,000 gas ceiling, which makes the wallet
// require ~0.6 STT free for every write. Somnia gas is expensive, so 6,000,000
// keeps headroom while needing only ~0.36 STT free; unused gas is refunded.
const TX_GAS = 6_000_000n;
const MIN_STT_FOR_TX = 0.4;

const panelStyle = {
  background: "rgba(13, 25, 20, 0.88)",
  color: "#f4f7f5",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "17px",
  boxShadow: "0 18px 50px rgba(0, 0, 0, 0.18)",
  padding: "25px",
  width: "min(1366px, calc(100% - 32px))",
  margin: "15px auto 50px",
  textAlign: "left",
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "11px",
  marginTop: "6px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.14)",
  background: "rgba(0, 0, 0, 0.28)",
  color: "#fff",
};

const actionButtonStyle = {
  padding: "11px 18px",
  borderRadius: "8px",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  background: "transparent",
  color: "white",
  cursor: "pointer",
};

const cardStyle = {
  background: "rgba(0, 0, 0, 0.28)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "10px",
  padding: "16px",
};

function jsonSafe(value) {
  return JSON.stringify(
    value,
    (_, item) => (typeof item === "bigint" ? item.toString() : item),
    2
  );
}

function findMaxQuantity(value) {
  if (typeof value === "bigint") return value;

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }

  if (!value || typeof value !== "object") return null;

  for (const key of [
    "maxQuantity",
    "maxOrderSize",
    "maxSize",
    "quantity",
    "size",
    "max",
  ]) {
    const found = findMaxQuantity(value[key]);
    if (found !== null) return found;
  }

  return null;
}

function displayCollateral(value) {
  try {
    return Number(formatUnits(BigInt(value ?? 0), 18)).toLocaleString(
      undefined,
      { maximumFractionDigits: 4 }
    );
  } catch {
    return "—";
  }
}

function toNumber(value) {
  try {
    return Number(formatUnits(BigInt(value ?? 0), 18));
  } catch {
    return 0;
  }
}

function errorMessage(error, fallback) {
  return (
    error?.shortMessage ||
    error?.cause?.shortMessage ||
    error?.message ||
    fallback
  );
}

const TX_LOG_KEY = "perppilot.txlog.v1";
const EXPLORER_TX = "https://explorer.testnet.somnia.network/tokyo/tx/";

const SMART_KEY = "perppilot.smartwallet.v1";
const isAddress = (value) => /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());

function loadCustomSmart() {
  try {
    return localStorage.getItem(SMART_KEY) || "";
  } catch {
    return "";
  }
}

function loadTxLog() {
  try {
    const parsed = JSON.parse(localStorage.getItem(TX_LOG_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shortAddress(address) {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function revertData(error) {
  return (
    error?.data ||
    error?.cause?.data ||
    error?.cause?.cause?.data ||
    error?.walk?.((e) => typeof e?.data === "string")?.data ||
    ""
  );
}

export default function PerpTradingPanel({ market }) {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [side, setSide] = useState("long");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [margin, setMargin] = useState(null);
  const [health, setHealth] = useState(null);
  const [voucher, setVoucher] = useState(null);
  const [voucherStatus, setVoucherStatus] = useState(null);
  const [openOrders, setOpenOrders] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [txResult, setTxResult] = useState(null);
  const [voucherTxResult, setVoucherTxResult] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);
  const [smart, setSmart] = useState({ status: "idle" });
  const [customSmart, setCustomSmart] = useState(loadCustomSmart);
  const [customInput, setCustomInput] = useState(loadCustomSmart);
  const [txLog, setTxLog] = useState(loadTxLog);
  const [copied, setCopied] = useState("");
  const [mode, setMode] = useState("smart");

  const provider =
    typeof window !== "undefined" ? window.ethereum : null;

  const sdk = getSdk();

  // Which on-chain account trades: the DreamDEX smart wallet (where Perps
  // Arena collateral lives) or the connected wallet itself.
  const useSmart = smart.status === "ready" && mode === "smart";
  const tradeAccount = useSmart ? smart.address : account;

  const makeTrader = useCallback(() => {
    const walletClient = createWalletClient({
      account,
      chain: hidekiTestnet,
      transport: custom(provider),
    });

    const client = sdk.client;

    if (useSmart) {
      // Your wallet is an owner of the smart wallet: it sends one transaction
      // per action and the smart wallet is the trader every pool sees.
      const inner = client.createExecutor({ walletClient, account });
      const spec = { smartAccount: smart.address, inner };

      if (smart.path?.length) {
        spec.through = smart.path;
        spec.signer = {
          address: account,
          signTypedData: (typedData) =>
            walletClient.signTypedData({ account, ...typedData }),
        };
      }

      return client.createTrader({
        executor: client.createExecutor(spec),
        gas: TX_GAS,
      });
    }

    return client.createTrader({ walletClient, gas: TX_GAS });
  }, [account, provider, sdk, useSmart, smart]);

  // Look for the DreamDEX smart wallet derived from the connected wallet
  useEffect(() => {
    if (!account || chainId !== CHAIN_ID) {
      setSmart({ status: "idle" });
      return undefined;
    }

    let cancelled = false;

    (async () => {
      setSmart({ status: "checking" });

      try {
        const client = sdk.client;
        const custom = customSmart.trim();
        const customValid = isAddress(custom);
        const firstAddress = client.accounts.addressOf(account, 0n);

        // Your own pasted address first, then the accounts derived from your wallet.
        const candidates = [];
        if (customValid) candidates.push(custom);
        for (let index = 0n; index < 5n; index += 1n) {
          candidates.push(client.accounts.addressOf(account, index));
        }

        let found = null;
        let withoutAuthority = null;

        for (const address of candidates) {
          const code = await client.getViemClient().getCode({ address });

          if (!code || code === "0x") continue;

          const path = await client.accounts.authorityPath(address, account);

          if (path === null) {
            if (!withoutAuthority) withoutAuthority = address;
            continue;
          }

          found = { address, path: [...path] };
          break;
        }

        if (cancelled) return;

        if (found) {
          setSmart({ status: "ready", ...found });
        } else if (withoutAuthority) {
          let owners = [];
          let threshold = "";

          try {
            const set = await client.accounts.ownersOf(withoutAuthority);
            owners = set.owners.map((owner) => ({
              address: owner.address,
              kind: owner.kind,
            }));
            threshold = String(set.threshold);
          } catch {
            // owner list is a nice-to-have
          }

          if (!cancelled) {
            setSmart({ status: "noauthority", address: withoutAuthority, owners, threshold });
          }
        } else {
          setSmart({
            status: "missing",
            address: firstAddress,
            customMissing: customValid,
            custom,
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSmart({
            status: "error",
            message: errorMessage(error, "Could not check for a smart wallet."),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [account, chainId, sdk, customSmart]);

  useEffect(() => {
    try {
      localStorage.setItem(TX_LOG_KEY, JSON.stringify(txLog));
    } catch {
      // storage unavailable: the log still works for this session
    }
  }, [txLog]);

  const recordTx = useCallback((label, result) => {
    const hash = result?.hash;
    if (!hash) return;
    setTxLog((previous) =>
      [{ label, hash, at: Date.now() }, ...previous].slice(0, 30)
    );
  }, []);

  const copyHash = async (hash) => {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(hash);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      setMessage("Copy failed. Select the hash text and copy it manually.");
    }
  };

  // Wallet and network synchronization
  useEffect(() => {
    if (!provider) return undefined;

    const sync = async () => {
      try {
        const [accounts, chain] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);

        setAccount(accounts?.[0] || "");
        setChainId(Number.parseInt(chain, 16));
      } catch {
        setMessage("Could not read wallet status.");
      }
    };

    const clearAccountData = () => {
      setMargin(null);
      setHealth(null);
      setVoucher(null);
      setVoucherStatus(null);
      setOpenOrders(null);
      setTxResult(null);
      setVoucherTxResult(null);
    };

    const onAccounts = (accounts) => {
      setAccount(accounts?.[0] || "");
      clearAccountData();
    };

    const onChain = (chain) => {
      setChainId(Number.parseInt(chain, 16));
      clearAccountData();
    };

    const onAppDisconnect = () => {
      setAccount("");
      clearAccountData();
      setMessage("Wallet disconnected from PerpPilot.");
    };

    // Fired by the Risk Calculator ("Use in order form")
    const onFillOrder = (event) => {
      const detail = event?.detail || {};
      if (detail.side) setSide(detail.side);
      if (detail.quantity) setQuantity(String(detail.quantity));
      if (detail.price) setPrice(String(detail.price));
      setMessage(
        "Order form filled from the risk calculator. Review it, then submit."
      );
    };

    sync();

    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);

    window.addEventListener("perppilot:wallet-disconnected", onAppDisconnect);
    window.addEventListener("perppilot:wallet-connected", sync);
    window.addEventListener("perppilot:fill-order", onFillOrder);

    return () => {
      window.removeEventListener("perppilot:wallet-connected", sync);
      window.removeEventListener("perppilot:fill-order", onFillOrder);
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);

      window.removeEventListener(
        "perppilot:wallet-disconnected",
        onAppDisconnect
      );
    };
  }, [provider]);

  // Align mark price to the market tick size
  useEffect(() => {
    if (market?.markPriceRaw && market.quoteDecimals != null) {
      try {
        const rawPrice = BigInt(market.markPriceRaw);
        const tick = BigInt(market.tickSize ?? 0);

        if (tick <= 0n) {
          setPrice("");
          return;
        }

        const alignedPrice = ((rawPrice + tick / 2n) / tick) * tick;

        setPrice(formatUnits(alignedPrice, market.quoteDecimals));
      } catch {
        setPrice("");
      }
    }
  }, [
    market?.symbol,
    market?.markPriceRaw,
    market?.quoteDecimals,
    market?.tickSize,
  ]);

  // Refresh account, voucher eligibility, voucher status and orders
  const refreshAccount = useCallback(async () => {
    if (
      !tradeAccount ||
      chainId !== CHAIN_ID ||
      !market?.marginBank ||
      !market?.poolAddress
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const owner = tradeAccount;
      const bank = market.marginBank;
      const pool = market.poolAddress;

      const reads = await Promise.allSettled([
        sdk.client.getMarginAccount(bank, owner),
        sdk.client.getAccountHealth(bank, owner),
        sdk.client.getPerpVoucherEligibility(bank, owner),
        sdk.client.getOpenOrdersOnchain([pool], owner),
        sdk.client.getPerpVoucher(bank, owner),
      ]);

      const setters = [
        setMargin,
        setHealth,
        setVoucher,
        setOpenOrders,
        setVoucherStatus,
      ];

      const labels = [
        "Margin account",
        "Account health",
        "Voucher eligibility",
        "Open orders",
        "Voucher status",
      ];

      const failures = [];

      reads.forEach((result, index) => {
        if (result.status === "fulfilled") {
          setters[index](result.value);
        } else {
          setters[index](null);

          failures.push(
            `${labels[index]}: ${
              result.reason?.shortMessage ||
              result.reason?.message ||
              "Read failed"
            }`
          );
        }
      });

      setLastChecked(new Date());

      setMessage(
        failures.length
          ? `Some testnet reads failed: ${failures.join(" | ")}`
          : "Account information refreshed successfully."
      );
    } catch (error) {
      setMessage(
        errorMessage(error, "Account information could not be loaded.")
      );
    } finally {
      setBusy(false);
    }
  }, [tradeAccount, chainId, market, sdk]);

  useEffect(() => {
    refreshAccount();
  }, [refreshAccount]);

  // Manually claim the perp voucher
  const claimVoucher = async () => {
    if (!provider || !account) {
      setMessage("Connect your wallet first.");
      return;
    }

    if (chainId !== CHAIN_ID) {
      setMessage("Switch your wallet to Somnia Hideki Testnet.");
      return;
    }

    if (!market?.marginBank) {
      setMessage("The selected market is missing its margin bank address.");
      return;
    }

    if (!voucher?.eligible) {
      setMessage(
        `Voucher is not currently eligible: ${
          voucher?.reason || "Refresh account and check eligibility."
        }`
      );
      return;
    }

    if (voucherStatus?.claimed) {
      setMessage("This wallet has already claimed its perp voucher.");
      return;
    }

    const grantAmount = displayCollateral(voucher.grantAmount);

    const confirmed = window.confirm(
      `Claim your ${grantAmount} USDso testnet perp voucher?\n\n` +
        "The app first simulates the claim and only sends it if the " +
        "simulation succeeds, so a failing claim will not waste gas."
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("Checking STT gas balance...");

    try {
      // 1. Gas balance check
      try {
        const balanceWei = await sdk.client.getNativeBalance(account);
        const stt = Number(formatUnits(balanceWei, 18));

        if (stt < MIN_STT_FOR_TX) {
          throw new Error(
            `Your wallet has only ${stt.toFixed(3)} STT on Hideki. ` +
              `At least ${MIN_STT_FOR_TX} STT is needed to send a transaction.`
          );
        }
      } catch (balanceError) {
        if (String(balanceError?.message).includes("STT on Hideki")) {
          throw balanceError;
        }
        // Balance read itself failed: continue, the simulation will catch real problems.
      }

      // 2. Recheck eligibility immediately before claiming
      setMessage("Rechecking voucher eligibility...");

      const latestEligibility = await sdk.client.getPerpVoucherEligibility(
        market.marginBank,
        tradeAccount
      );

      if (!latestEligibility?.eligible) {
        setVoucher(latestEligibility ?? null);

        setMessage(
          `Voucher cannot be claimed: ${
            latestEligibility?.reason || "Eligibility has changed."
          }`
        );

        await refreshAccount();
        return;
      }

      const latestStatus = await sdk.client.getPerpVoucher(
        market.marginBank,
        tradeAccount
      );

      setVoucherStatus(latestStatus);

      if (latestStatus?.claimed) {
        setMessage("This wallet has already claimed its perp voucher.");
        await refreshAccount();
        return;
      }

      const trader = makeTrader();

      // 3. Dry-run the claim. A failed claim mines and costs gas, so never
      //    send it if the simulation reverts.
      setMessage("Simulating the claim before sending...");

      const unsigned = await trader.buildClaimPerpVoucher({
        marginBank: market.marginBank,
      });

      try {
        await sdk.client.getViemClient().call({
          account: tradeAccount,
          to: unsigned.to,
          data: unsigned.data,
          gas: TX_GAS,
        });
      } catch (simulationError) {
        const data = revertData(simulationError);

        console.error("Voucher claim simulation reverted:", simulationError);

        throw new Error(
          "The claim would revert on-chain, so it was NOT sent and no gas was spent. " +
            (data
              ? `Revert data: ${data}. `
              : `${errorMessage(simulationError, "")} `) +
            "Send this text to the DreamDEX/Somnia organizers."
        );
      }

      // 4. Send
      setMessage("Please approve the voucher claim in your wallet...");

      const result = await trader.claimPerpVoucher({
        marginBank: market.marginBank,
        gas: TX_GAS,
      });

      setVoucherTxResult(result);
      recordTx("Voucher claim", result);

      if (result?.receipt?.status === "reverted") {
        throw new Error("Voucher claim transaction reverted on-chain.");
      }

      setMessage(
        "Voucher claimed. Refreshing account status..."
      );

      await refreshAccount();
    } catch (error) {
      console.error("Perp voucher claim failed:", error);

      setMessage(
        error?.code === 4001
          ? "Voucher claim rejected in wallet."
          : errorMessage(
              error,
              "Voucher claim failed. Check your wallet, eligibility, and testnet STT gas balance."
            )
      );
    } finally {
      setBusy(false);
    }
  };

  // Submit a limit order
  const submitOrder = async () => {
    if (!provider || !account) {
      setMessage("Connect your wallet first.");
      return;
    }

    if (chainId !== CHAIN_ID) {
      setMessage("Switch your wallet to Somnia Hideki Testnet.");
      return;
    }

    if (
      !market?.poolAddress ||
      !market?.marginBank ||
      !market?.baseDecimals ||
      market.quoteDecimals == null ||
      !market?.lotSize ||
      !market?.tickSize ||
      !market?.minQuantity ||
      !market?.markPriceRaw
    ) {
      setMessage("This market is missing required trading metadata.");
      return;
    }

    let quantityRaw;
    let priceRaw;

    try {
      quantityRaw = parseUnits(quantity, market.baseDecimals);
      priceRaw = parseUnits(price, market.quoteDecimals);
    } catch {
      setMessage("Enter a valid quantity and price.");
      return;
    }

    const lotSize = BigInt(market.lotSize);
    const tickSize = BigInt(market.tickSize);
    const minQuantity = BigInt(market.minQuantity);

    if (quantityRaw <= 0n || priceRaw <= 0n) {
      setMessage("Quantity and price must be greater than zero.");
      return;
    }

    if (quantityRaw < minQuantity || quantityRaw % lotSize !== 0n) {
      setMessage(
        "Quantity is below the minimum or does not match the market lot size."
      );
      return;
    }

    if (priceRaw % tickSize !== 0n) {
      setMessage("Price does not match this market's tick size.");
      return;
    }

    const confirmed = window.confirm(
      `Review order:\n\n${side.toUpperCase()} ${quantity} ${market.baseSymbol}\n` +
        `${market.symbol} at ${price} ${market.quoteSymbol}\n\n` +
        "Continue to the wallet for transaction approval?"
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("Checking order capacity...");
    setTxResult(null);

    try {
      const trader = makeTrader();

      const capacity = await sdk.client.getMaxPerpOrderSize({
        pool: market.poolAddress,
        marginBank: market.marginBank,
        account: tradeAccount,
        isBid: side === "long",
        price: priceRaw,
      });

      const maxQuantity = findMaxQuantity(capacity);

      if (maxQuantity === null) {
        throw new Error(
          "Could not interpret the SDK order-capacity result. No order was sent."
        );
      }

      if (maxQuantity === 0n) {
        throw new Error(
          "No trading capacity: this account has no usable margin yet. " +
            "Claim the perp voucher or deposit collateral first, then try again."
        );
      }

      if (quantityRaw > maxQuantity) {
        throw new Error(
          `Quantity is above your current capacity. Maximum is ${formatUnits(
            maxQuantity,
            market.baseDecimals
          )} ${market.baseSymbol}.`
        );
      }

      setMessage("Waiting for wallet approval...");

      const result = await trader.placePerpOrder({
        pool: market.poolAddress,
        isBid: side === "long",
        price: priceRaw,
        quantity: quantityRaw,
        orderType: 0,
      });

      setTxResult(result);
      recordTx(
        `Place ${side === "long" ? "LONG" : "SHORT"} limit ${market.symbol}`,
        result
      );

      if (result?.receipt?.status === "reverted") {
        throw new Error(
          "Order transaction reverted on-chain. No order was placed."
        );
      }

      setMessage(
        result?.orderId != null
          ? `Order #${result.orderId} placed. Refreshing account...`
          : "Order transaction confirmed (it may have filled immediately). Refreshing account..."
      );

      await refreshAccount();
    } catch (error) {
      setMessage(
        error?.code === 4001
          ? "Order rejected in wallet."
          : errorMessage(
              error,
              "Order submission failed. Check your wallet and network."
            )
      );
    } finally {
      setBusy(false);
    }
  };

  // Cancel an open order
  const cancelOrder = async (order) => {
    if (!provider || !account) {
      setMessage("Connect your wallet first.");
      return;
    }

    if (chainId !== CHAIN_ID) {
      setMessage("Switch your wallet to Somnia Hideki Testnet.");
      return;
    }

    if (!market?.poolAddress) {
      setMessage("Market pool address is missing. No cancellation was sent.");
      return;
    }

    const orderId = BigInt(order.orderId);

    const confirmed = window.confirm(
      `Cancel order #${orderId} on ${market.symbol}?\n\n` +
        "This sends a testnet transaction from your wallet."
    );

    if (!confirmed) return;

    setCancellingId(orderId.toString());
    setMessage("Waiting for wallet approval to cancel...");

    try {
      const trader = makeTrader();

      const result = await trader.cancelOrder({
        pool: market.poolAddress,
        orderId,
        gas: TX_GAS,
      });

      recordTx(`Cancel order #${orderId} ${market.symbol}`, result);

      if (result?.receipt?.status === "reverted") {
        throw new Error(
          "Cancellation reverted on-chain. The order may already be filled or cancelled."
        );
      }

      setMessage(`Order #${orderId} cancelled. Refreshing account...`);

      await refreshAccount();
    } catch (error) {
      setMessage(
        error?.code === 4001 || error?.shortMessage?.includes("rejected")
          ? "Cancellation rejected in wallet."
          : errorMessage(
              error,
              "Cancellation failed. Check your wallet and network."
            )
      );
    } finally {
      setCancellingId(null);
    }
  };

  // Risk monitor values
  const monitor = useMemo(() => {
    if (!health && !margin) {
      return { status: "Not loaded", tone: "#8b9a93" };
    }

    const equity = toNumber(health?.equity ?? margin?.equity);
    const imReq = toNumber(health?.imReq);
    const mmReq = toNumber(health?.mmReq);
    const usage = equity > 0 ? (imReq / equity) * 100 : 0;
    const buffer = equity - mmReq;
    const marginStatus = health?.marginStatus || margin?.marginStatus;

    let status = "Safe";
    let tone = "#3cdb94";
    let note = "Margin usage is low.";

    if (equity <= 0) {
      status = "No collateral";
      tone = "#e3bb69";
      note =
        "No collateral on this account yet. Join the Perps Arena at app.testnet.dreamdex.io to receive paper USDso, then press Refresh account.";
    } else if (marginStatus && marginStatus !== "Healthy") {
      status = "At risk";
      tone = "#ef7774";
      note = "The account is not healthy. Reduce exposure or add collateral.";
    } else if (usage > 80) {
      status = "Danger";
      tone = "#ef7774";
      note = "Over 80% of equity is committed as margin.";
    } else if (usage > 50) {
      status = "Caution";
      tone = "#e3bb69";
      note = "Over half of equity is committed as margin.";
    }

    return { status, tone, note, equity, imReq, mmReq, usage, buffer };
  }, [health, margin]);

  const markPriceNumber = useMemo(() => {
    try {
      if (!market?.markPriceRaw || market.quoteDecimals == null) return null;
      return Number(
        formatUnits(BigInt(market.markPriceRaw), market.quoteDecimals)
      );
    } catch {
      return null;
    }
  }, [market?.markPriceRaw, market?.quoteDecimals]);

  const orderDistance = (order) => {
    try {
      if (!markPriceNumber) return null;
      const orderPrice = Number(
        formatUnits(BigInt(order.price), market.quoteDecimals ?? 18)
      );
      return ((orderPrice - markPriceNumber) / markPriceNumber) * 100;
    } catch {
      return null;
    }
  };

  if (!market) return null;

  const correctNetwork = chainId === CHAIN_ID;
  const voucherClaimed = Boolean(voucherStatus?.claimed);

  const voucherButtonDisabled =
    busy ||
    !account ||
    !correctNetwork ||
    !voucher?.eligible ||
    voucherClaimed ||
    !market?.marginBank;

  return (
    <section style={panelStyle}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Perp Trading</h2>
          <p style={{ color: "#8b9a93", margin: "6px 0" }}>
            Somnia Hideki Testnet · {market.symbol}
          </p>
        </div>

        <span
          style={{
            fontSize: "12px",
            color: correctNetwork ? "#3cdb94" : "#e3bb69",
          }}
        >
          {account
            ? correctNetwork
              ? "Wallet connected · Network verified"
              : "Wrong network"
            : "Wallet not connected"}
        </span>
      </div>

      {!account && (
        <p style={{ color: "#e3bb69" }}>
          Connect MetaMask or Rabby using the wallet button above.
        </p>
      )}

      {account && (
        <p style={{ color: "#8b9a93", fontSize: "12px" }}>
          {account.slice(0, 8)}...{account.slice(-6)}
        </p>
      )}

      {account && correctNetwork && (
        <div style={{ ...cardStyle, marginTop: "12px", padding: "14px 16px" }}>
          <p style={{ color: "#8b9a93", fontSize: "12px", margin: 0 }}>
            Trading account
          </p>

          {smart.status === "checking" && (
            <p style={{ margin: "8px 0 0", fontSize: "13px" }}>
              Looking for your DreamDEX smart wallet...
            </p>
          )}

          {smart.status === "ready" && (
            <>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                {[
                  ["smart", `DreamDEX smart wallet · ${shortAddress(smart.address)}`],
                  ["wallet", `Connected wallet · ${shortAddress(account)}`],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontWeight: 700,
                      fontSize: "12px",
                      cursor: "pointer",
                      border:
                        mode === value
                          ? "1px solid rgba(60,219,148,0.6)"
                          : "1px solid rgba(255,255,255,0.14)",
                      background:
                        mode === value ? "rgba(60,219,148,0.12)" : "transparent",
                      color: mode === value ? "#3cdb94" : "#cfd8d3",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <p style={{ color: "#8b9a93", fontSize: "12px", margin: "8px 0 0" }}>
                {useSmart
                  ? "Orders are executed by your smart wallet, the account that holds Perps Arena collateral. Your wallet signs and pays gas (STT)."
                  : "Orders are placed directly from your connected wallet."}
              </p>
            </>
          )}

          {smart.status === "missing" && (
            <p style={{ color: "#e3bb69", fontSize: "13px", margin: "8px 0 0" }}>
              {smart.customMissing
                ? `No smart wallet exists at ${shortAddress(smart.custom)} on Hideki. Check the address.`
                : `No smart wallet derived from this wallet exists on Hideki (it would be ${shortAddress(smart.address)}). If you already use dreamDEX, paste the address shown in the dreamDEX wallet panel below. Orders use your connected wallet until a smart wallet is found.`}
            </p>
          )}

          {smart.status === "noauthority" && (
            <div style={{ color: "#e3bb69", fontSize: "13px", margin: "8px 0 0" }}>
              <p style={{ margin: 0 }}>
                A smart wallet exists at {shortAddress(smart.address)}, but the
                connected wallet ({shortAddress(account)}) is not one of its
                owners, so it cannot trade for it.
              </p>

              {smart.owners?.length > 0 && (
                <p style={{ margin: "6px 0 0", overflowWrap: "anywhere" }}>
                  Owners of that smart wallet:{" "}
                  {smart.owners
                    .map((owner) => `${owner.address} (${owner.kind})`)
                    .join(", ")}
                  {smart.threshold ? ` · signatures needed: ${smart.threshold}` : ""}.
                  Switch MetaMask to one of those accounts, or sign in to
                  dreamDEX with the wallet you are using here.
                </p>
              )}
            </div>
          )}

          {smart.status === "error" && (
            <p style={{ color: "#e3bb69", fontSize: "13px", margin: "8px 0 0" }}>
              {smart.message}
            </p>
          )}

          {smart.status !== "checking" && (
            <div style={{ marginTop: "12px" }}>
              <p style={{ color: "#8b9a93", fontSize: "12px", margin: "0 0 6px" }}>
                Already use dreamDEX? Paste your dreamDEX wallet address (shown
                in its wallet panel) to trade with its collateral:
              </p>

              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={customInput}
                  onChange={(event) => setCustomInput(event.target.value)}
                  placeholder="0x..."
                  style={{ ...inputStyle, marginTop: 0, flex: "1 1 320px", fontFamily: "monospace" }}
                />

                <button
                  type="button"
                  disabled={!isAddress(customInput)}
                  onClick={() => {
                    const value = customInput.trim();
                    setCustomSmart(value);
                    try {
                      localStorage.setItem(SMART_KEY, value);
                    } catch {
                      // storage unavailable
                    }
                  }}
                  style={{
                    ...actionButtonStyle,
                    opacity: isAddress(customInput) ? 1 : 0.5,
                  }}
                >
                  Use this address
                </button>

                {customSmart && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomSmart("");
                      setCustomInput("");
                      try {
                        localStorage.removeItem(SMART_KEY);
                      } catch {
                        // storage unavailable
                      }
                    }}
                    style={actionButtonStyle}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order form */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <div>
          <label>Direction</label>
          <select
            value={side}
            onChange={(event) => setSide(event.target.value)}
            style={inputStyle}
          >
            <option value="long">Buy / Long</option>
            <option value="short">Sell / Short</option>
          </select>
        </div>

        <div>
          <label>Quantity ({market.baseSymbol})</label>
          <input
            type="number"
            min="0"
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            placeholder="Enter quantity"
            style={inputStyle}
          />
        </div>

        <div>
          <label>Limit price ({market.quoteSymbol})</label>
          <input
            type="number"
            min="0"
            step="any"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="Enter limit price"
            style={inputStyle}
          />
        </div>
      </div>

      <p style={{ color: "#8b9a93", fontSize: "12px" }}>
        Mark price: {market.markPrice ?? "Unavailable"} · Minimum raw
        quantity: {market.minQuantity} · Tick size: {market.tickSize}
      </p>

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "16px",
        }}
      >
        <button
          onClick={submitOrder}
          disabled={busy || !account || !correctNetwork}
          style={{
            padding: "11px 18px",
            borderRadius: "8px",
            border: 0,
            background: "linear-gradient(135deg, #35d48c, #1fa971)",
            color: "#04130c",
            fontWeight: 700,
            cursor: busy ? "wait" : "pointer",
            opacity: busy || !account || !correctNetwork ? 0.5 : 1,
          }}
        >
          {busy ? "Please wait..." : "Review & Submit Limit Order"}
        </button>

        <button
          onClick={refreshAccount}
          disabled={busy || !account || !correctNetwork}
          style={{
            ...actionButtonStyle,
            opacity: busy || !account || !correctNetwork ? 0.5 : 1,
          }}
        >
          Refresh account
        </button>
      </div>

      {message && (
        <p
          role="status"
          style={{
            color: "#e3bb69",
            marginTop: "14px",
            overflowWrap: "anywhere",
          }}
        >
          {message}
        </p>
      )}

      {/* Account metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "12px",
          marginTop: "24px",
        }}
      >
        {[
          ["Account equity", margin ? displayCollateral(margin.equity) : "—"],
          [
            "Available collateral",
            margin
              ? displayCollateral(margin.unlockedCollateralBalance)
              : "—",
          ],
          [
            "Locked collateral",
            margin ? displayCollateral(margin.lockedCollateral) : "—",
          ],
          [
            "Margin status",
            health?.marginStatus || margin?.marginStatus || "—",
          ],
        ].map(([label, value]) => (
          <div key={label} style={cardStyle}>
            <p style={{ color: "#8b9a93", fontSize: "12px", margin: 0 }}>
              {label}
            </p>

            <strong
              style={{
                display: "block",
                fontSize: "20px",
                marginTop: "9px",
              }}
            >
              {value}
            </strong>
          </div>
        ))}
      </div>

      {/* Risk monitor */}
      <div style={{ ...cardStyle, marginTop: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <p style={{ color: "#8b9a93", fontSize: "12px", margin: 0 }}>
            Position &amp; risk monitor
          </p>

          <strong style={{ color: monitor.tone }}>{monitor.status}</strong>
        </div>

        {monitor.note && (
          <p style={{ fontSize: "13px", margin: "8px 0 0" }}>
            {monitor.note}
          </p>
        )}

        {monitor.equity > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
              marginTop: "12px",
              fontSize: "13px",
            }}
          >
            <div>
              <span style={{ color: "#8b9a93" }}>Margin used</span>
              <br />
              <strong>{monitor.usage.toFixed(1)}%</strong>
            </div>
            <div>
              <span style={{ color: "#8b9a93" }}>Initial margin required</span>
              <br />
              <strong>
                {monitor.imReq.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
              </strong>
            </div>
            <div>
              <span style={{ color: "#8b9a93" }}>Buffer above maintenance</span>
              <br />
              <strong>
                {monitor.buffer.toLocaleString(undefined, {
                  maximumFractionDigits: 4,
                })}
              </strong>
            </div>
          </div>
        )}

        <p style={{ color: "#6f7f78", fontSize: "11px", margin: "10px 0 0" }}>
          {lastChecked
            ? `Last checked ${lastChecked.toLocaleTimeString()}. Use Refresh account to update.`
            : "Not checked yet."}
        </p>
      </div>

      {/* Voucher and open orders */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <div style={{ ...cardStyle, flex: "1 1 260px", padding: "14px" }}>
          <p style={{ color: "#8b9a93", fontSize: "12px", margin: 0 }}>
            Perp voucher
          </p>

          <strong style={{ display: "block", marginTop: "8px" }}>
            {voucherClaimed
              ? "Already claimed"
              : voucher
                ? voucher.eligible
                  ? "Eligible to claim"
                  : "Not eligible"
                : "Not loaded"}
          </strong>

          <p style={{ color: "#8b9a93", fontSize: "12px" }}>
            {voucherClaimed
              ? "This wallet has already claimed its voucher."
              : voucher?.eligible
                ? `Grant amount: ${displayCollateral(
                    voucher.grantAmount
                  )} USDso`
                : voucher?.reason ||
                  "Refresh account to check voucher eligibility."}
          </p>

          <button
            type="button"
            onClick={claimVoucher}
            disabled={voucherButtonDisabled}
            style={{
              width: "100%",
              marginTop: "8px",
              padding: "11px 14px",
              borderRadius: "8px",
              border: 0,
              background: voucherButtonDisabled ? "rgba(255, 255, 255, 0.10)" : "#1fa971",
              color: "white",
              fontWeight: 700,
              cursor: voucherButtonDisabled ? "not-allowed" : "pointer",
              opacity: voucherButtonDisabled ? 0.6 : 1,
            }}
          >
            {voucherClaimed
              ? "Voucher Already Claimed"
              : busy
                ? "Please wait..."
                : voucher?.eligible
                  ? `Claim ${displayCollateral(voucher.grantAmount)} USDso`
                  : "Voucher Unavailable"}
          </button>

          <p style={{ color: "#e3bb69", fontSize: "11px", marginBottom: 0 }}>
            Testnet STT is required for gas. The claim is simulated first and
            sent only if it will succeed.
          </p>
        </div>

        <div style={{ ...cardStyle, flex: "1 1 220px", padding: "14px" }}>
          <p style={{ color: "#8b9a93", fontSize: "12px", margin: 0 }}>
            Open orders
          </p>

          <strong style={{ display: "block", marginTop: "8px" }}>
            {openOrders
              ? `${openOrders.orders?.length ?? 0} active`
              : "Not loaded"}
          </strong>

          <p style={{ color: "#8b9a93", fontSize: "12px" }}>
            {openOrders
              ? "Orders for the selected market"
              : "Refresh account to check."}
          </p>
        </div>
      </div>

      {/* Voucher transaction details */}
      {voucherTxResult && (
        <details style={{ marginTop: "14px", color: "#8b9a93" }}>
          <summary style={{ cursor: "pointer" }}>
            Voucher claim transaction details
          </summary>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: "11px",
              background: "rgba(0, 0, 0, 0.28)",
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            {jsonSafe(voucherTxResult)}
          </pre>
        </details>
      )}

      {/* Open orders table */}
      {openOrders?.orders?.length > 0 && (
        <div style={{ marginTop: "16px", overflowX: "auto" }}>
          <h3 style={{ margin: "0 0 8px" }}>Your open orders</h3>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "13px",
            }}
          >
            <thead>
              <tr style={{ color: "#8b9a93", textAlign: "left" }}>
                <th style={{ padding: "6px" }}>ID</th>
                <th style={{ padding: "6px" }}>Side</th>
                <th style={{ padding: "6px" }}>Price (USDso)</th>
                <th style={{ padding: "6px" }}>Vs mark</th>
                <th style={{ padding: "6px" }}>
                  Remaining ({market.symbol?.split("-")[0]})
                </th>
                <th style={{ padding: "6px" }} />
              </tr>
            </thead>

            <tbody>
              {openOrders.orders.map((order) => {
                const id = order.orderId.toString();
                const distance = orderDistance(order);

                return (
                  <tr key={id} style={{ borderTop: "1px solid rgba(255, 255, 255, 0.08)" }}>
                    <td style={{ padding: "6px" }}>#{id}</td>

                    <td
                      style={{
                        padding: "6px",
                        color: order.isBid ? "#3cdb94" : "#ef7774",
                      }}
                    >
                      {order.isBid ? "Long / Buy" : "Short / Sell"}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {formatUnits(
                        BigInt(order.price),
                        market.quoteDecimals ?? 18
                      )}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {distance === null ? (
                        "—"
                      ) : (
                        <>
                          {distance >= 0 ? "+" : ""}
                          {distance.toFixed(2)}%
                          {Math.abs(distance) < 0.3 && (
                            <span style={{ color: "#e3bb69" }}>
                              {" "}
                              · near market
                            </span>
                          )}
                          {Math.abs(distance) > 5 && (
                            <span style={{ color: "#8b9a93" }}>
                              {" "}
                              · far from market
                            </span>
                          )}
                        </>
                      )}
                    </td>

                    <td style={{ padding: "6px" }}>
                      {formatUnits(
                        BigInt(order.quantityRemaining),
                        market.baseDecimals ?? 18
                      )}
                    </td>

                    <td style={{ padding: "6px", textAlign: "right" }}>
                      <button
                        onClick={() => cancelOrder(order)}
                        disabled={
                          busy || cancellingId !== null || !correctNetwork
                        }
                        style={{
                          background: "rgba(239,83,80,.10)",
                          color: "#ef7774",
                          border: "1px solid rgba(239,83,80,.35)",
                          borderRadius: "8px",
                          padding: "6px 12px",
                          fontWeight: 700,
                          cursor: "pointer",
                          opacity:
                            busy || cancellingId !== null ? 0.5 : 1,
                        }}
                      >
                        {cancellingId === id ? "Cancelling..." : "Cancel"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Transaction log */}
      <div style={{ marginTop: "16px" }}>
        <p style={{ color: "#8b9a93", fontSize: "12px", margin: "0 0 6px" }}>
          Transaction log (hashes of transactions sent from this app)
        </p>

        {txLog.length === 0 ? (
          <p style={{ color: "#6f7f78", fontSize: "13px", margin: 0 }}>
            No transactions yet. After you place or cancel an order, the
            transaction hash appears here with Copy and Explorer buttons.
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                {txLog.map((tx) => (
                  <tr key={tx.hash} style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <td style={{ padding: "8px 6px", color: "#8b9a93", whiteSpace: "nowrap" }}>
                      {new Date(tx.at).toLocaleString()}
                    </td>
                    <td style={{ padding: "8px 6px" }}>{tx.label}</td>
                    <td style={{ padding: "8px 6px", fontFamily: "monospace", overflowWrap: "anywhere" }}>
                      {tx.hash}
                    </td>
                    <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                      <button
                        type="button"
                        onClick={() => copyHash(tx.hash)}
                        style={{
                          padding: "5px 10px",
                          borderRadius: "8px",
                          border: "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: "#cfd8d3",
                          cursor: "pointer",
                          marginRight: "6px",
                        }}
                      >
                        {copied === tx.hash ? "Copied" : "Copy"}
                      </button>
                      <a
                        href={`${EXPLORER_TX}${tx.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "#3cdb94" }}
                      >
                        Explorer
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Technical details */}
      <details style={{ marginTop: "16px", color: "#8b9a93" }}>
        <summary style={{ cursor: "pointer" }}>
          View technical account details
        </summary>

        {[
          [health, "Account health not loaded."],
          [openOrders, "Open orders not loaded."],
          [voucherStatus, "Voucher status not loaded."],
        ].map(([value, fallback]) => (
          <pre
            key={fallback}
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
              fontSize: "11px",
              background: "rgba(0, 0, 0, 0.28)",
              padding: "12px",
              borderRadius: "8px",
            }}
          >
            {value ? jsonSafe(value) : fallback}
          </pre>
        ))}
      </details>

      {/* Order transaction response */}
      {txResult && (
        <>
          <h3>Order response</h3>

          <pre
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {jsonSafe(txResult)}
          </pre>
        </>
      )}

      <p style={{ color: "#8b9a93", fontSize: "11px" }}>
        Testnet prototype. No automatic trades or collateral deposits. Voucher
        claims, limit orders, and cancellations require explicit wallet
        approval.
      </p>
    </section>
  );
}
