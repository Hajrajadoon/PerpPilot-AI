# PerpPilot AI architecture

## Layers

| Layer | Responsibility | Files |
|---|---|---|
| Market feed | Lists perp markets and candles through the Somnia Markets SDK | `backend/dreamdex/markets-json.mjs`, `backend/app/services/dreamdex_*.py`, `backend/app/api/dreamdex.py` |
| Live ticker | Best bid / ask from on-chain top-of-book and trailing 24h stats, refreshed every 30 s | `frontend/src/lib/useMarketTicker.js`, `frontend/src/lib/sdk.js` |
| Signal engine | Indicators, regime, scoring, explanation, trade plan, sizing. Pure functions | `frontend/src/lib/analysis.js` |
| Paper engine | Virtual account, positions, auto-close, history, statistics. Pure functions | `frontend/src/lib/paper.js` |
| Wallet | Connect, add / switch chain 50383, account and chain detection | `frontend/src/components/WalletConnect.jsx` |
| Trading | Margin reads, voucher claim, order placement and cancellation, risk monitor | `frontend/src/components/PerpTradingPanel.jsx` |

## Data flow

1. The backend runs a small Node script that calls the SDK and returns market metadata and candles as JSON.
2. The frontend refreshes every 30 seconds, runs `generateSignal(candles)` and renders the explanation, plan and calculator.
3. The ticker hook reads the on-chain book and 24h stats directly with the SDK (read-only, no wallet).
4. Paper trades are evaluated against the live mid price on every refresh.
5. Real orders go through the trading panel: validate, check capacity, then the wallet signs.

## Trading identity: linked bot

```mermaid
sequenceDiagram
    participant U as User (MetaMask)
    participant F as Frontend
    participant B as Backend
    participant N as bot-execute.mjs
    participant C as dreamDEX pool (chain 50383)

    U->>F: Review & Sign Limit Order
    F->>B: POST /bot/challenge (action, market, price, quantity)
    B-->>F: one-time EIP-712 challenge (valid 2 minutes)
    F->>U: signTypedData (no gas, not a transaction)
    U-->>F: signature
    F->>B: POST /bot/execute (challengeId, signature)
    B->>N: run with the stored challenge
    N->>N: verify signature = authorized MetaMask account
    N->>C: isOperatorAuthorized(owner, bot, selector)
    N->>C: simulate then placeOrderFor(owner, ...)
    C-->>N: transaction hash
    N-->>F: hash, order id, receipt status
```

- The dreamDEX wallet (owner) keeps the margin. The bot is linked inside dreamDEX with Perps permission and can place, cancel and reduce orders, never withdraw.
- Each challenge is single-use and expires after 2 minutes. The backend marks it used before running the bot.
- The bot key lives only in `backend/.env` (`DREAMDEX_BOT_PRIVATE_KEY`) and is never sent to the browser.
- Account reads (margin, health, open orders) are made directly from the browser with the SDK for the owner address and need no wallet.

## Safety design

- No signal path reaches the chain without a wallet confirmation.
- Pre-flight checks: lot size, tick size, minimum size, capacity (`getMaxPerpOrderSize`), STT balance.
- Voucher claims are simulated with `eth_call` first.
- Stale-price guard in the paper engine ignores prices more than 50% from a position's entry.
