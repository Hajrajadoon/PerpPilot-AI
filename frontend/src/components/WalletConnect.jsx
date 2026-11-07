
import { useEffect, useState } from "react";

const CHAIN_ID = 50383;
const CHAIN_HEX = "0xc4cf";

const NETWORK = {
  chainId: CHAIN_HEX,
  chainName: "Somnia Hideki Testnet",
  nativeCurrency: {
    name: "Somnia Test Token",
    symbol: "STT",
    decimals: 18,
  },
  rpcUrls: [
    "https://api.hideki2.infra.testnet.somnia.network",
  ],
  blockExplorerUrls: [
    "https://explorer.testnet.somnia.network/tokyo",
  ],
};

// Confirms the configured Hideki RPC really reports chain 50383.
async function verifyRpcChain() {
  try {
    const res = await fetch(NETWORK.rpcUrls[0], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [],
      }),
    });
    const json = await res.json();
    return Number.parseInt(json.result, 16) === CHAIN_ID;
  } catch {
    return null; // RPC unreachable (not the same as a mismatch)
  }
}

const notifyWalletChanged = () =>
  window.dispatchEvent(new Event("perppilot:wallet-connected"));

export default function WalletConnect() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [disconnected, setDisconnected] = useState(false);

  const provider =
    typeof window !== "undefined" ? window.ethereum : null;

  useEffect(() => {
    if (!provider) return;

    const syncWallet = async () => {
      try {
        const [accounts, chain] = await Promise.all([
          provider.request({ method: "eth_accounts" }),
          provider.request({ method: "eth_chainId" }),
        ]);

        if (!disconnected) {
          setAccount(accounts?.[0] || "");
        }

        setChainId(Number.parseInt(chain, 16));
      } catch {
        setMessage("Unable to detect wallet status.");
      }
    };

    const onAccountsChanged = (accounts) => {
      setAccount(accounts?.[0] || "");
      setDisconnected(!accounts?.length);
      setMessage(accounts?.length ? "" : "Wallet locked or no account selected.");
    };

    const onChainChanged = (chain) => {
      setChainId(Number.parseInt(chain, 16));
      setMessage("");
    };

    const onAppDisconnect = () => {
      setAccount("");
      setDisconnected(true);
      setMessage("Wallet disconnected from PerpPilot.");
    };

    syncWallet();

    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
    window.addEventListener(
      "perppilot:wallet-disconnected",
      onAppDisconnect
    );

    return () => {
      provider.removeListener?.("accountsChanged", onAccountsChanged);
      provider.removeListener?.("chainChanged", onChainChanged);
      window.removeEventListener(
        "perppilot:wallet-disconnected",
        onAppDisconnect
      );
    };
  }, [provider, disconnected]);

  const connectWallet = async () => {
    if (!provider) {
      setMessage("Install MetaMask or another compatible EVM wallet.");
      return;
    }

    try {
      setBusy(true);
      setMessage("");

      const accounts = await provider.request({
        method: "eth_requestAccounts",
      });

      if (!accounts?.length) {
        throw new Error("No wallet account was selected.");
      }

      setAccount(accounts[0]);
      setDisconnected(false);

      let currentChain = await provider.request({
        method: "eth_chainId",
      });

      if (Number.parseInt(currentChain, 16) !== CHAIN_ID) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_HEX }],
          });
        } catch (switchError) {
          if (switchError.code !== 4902) throw switchError;

          await provider.request({
            method: "wallet_addEthereumChain",
            params: [NETWORK],
          });

          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: CHAIN_HEX }],
          });
        }
      }

      currentChain = await provider.request({
        method: "eth_chainId",
      });

      const verifiedChain = Number.parseInt(currentChain, 16);
      setChainId(verifiedChain);

      if (verifiedChain !== CHAIN_ID) {
        throw new Error("Please switch to Somnia Hideki Testnet.");
      }

      const rpcOk = await verifyRpcChain();
      setMessage(
        rpcOk === false
          ? "Network verified in wallet, but the RPC reported a different chain ID."
          : "Wallet connected and network verified."
      );
      notifyWalletChanged();
    } catch (error) {
      if (error.code === 4001) {
        setMessage("Wallet connection or network switch was rejected.");
      } else if (error.code === -32002) {
        setMessage("A wallet request is already pending. Open MetaMask to continue.");
      } else {
        setMessage(error.message || "Wallet connection failed.");
      }
    } finally {
      setBusy(false);
    }
  };

  const disconnectWallet = () => {
    setAccount("");
    setDisconnected(true);
    setMessage("Wallet disconnected from PerpPilot.");

    window.dispatchEvent(
      new Event("perppilot:wallet-disconnected")
    );
  };

  const shortAddress = account
    ? `${account.slice(0, 6)}...${account.slice(-4)}`
    : "";

  const correctNetwork = chainId === CHAIN_ID;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-end",
      gap: "7px",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent: "flex-end",
      }}>
        <button
          onClick={connectWallet}
          disabled={!provider || busy || (!!account && correctNetwork)}
          style={{
            background: correctNetwork && account
              ? "rgba(57,217,144,.14)"
              : "#39d990",
            color: correctNetwork && account
              ? "#39d990"
              : "#07130e",
            border: "1px solid rgba(57,217,144,.35)",
            borderRadius: "9px",
            padding: "10px 15px",
            fontWeight: 700,
            cursor: provider ? "pointer" : "not-allowed",
            opacity: busy ? 0.65 : 1,
          }}
        >
          {busy
            ? "Connecting..."
            : !provider
              ? "Wallet Not Detected"
              : account && correctNetwork
                ? `Connected · ${shortAddress}`
                : account
                  ? "Switch to Hideki"
                  : "Connect Wallet"}
        </button>

        {account && (
          <button
            onClick={disconnectWallet}
            disabled={busy}
            style={{
              background: "rgba(239,83,80,.10)",
              color: "#ef7774",
              border: "1px solid rgba(239,83,80,.35)",
              borderRadius: "9px",
              padding: "10px 12px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Disconnect
          </button>
        )}
      </div>

      <small style={{
        color: correctNetwork && account ? "#39d990" : "#aab5ae",
        fontSize: "11px",
      }}>
        {!provider
          ? "MetaMask / EVM wallet required"
          : account && correctNetwork
            ? "Somnia Hideki · Chain 50383 verified"
            : account && chainId
              ? `Wrong network · Chain ${chainId}`
              : "Wallet not connected"}
      </small>

      {message && (
        <small style={{
          color: message.includes("verified") ? "#39d990" : "#e9b76b",
          maxWidth: "260px",
          textAlign: "right",
        }}>
          {message}
        </small>
      )}
    </div>
  );
}

