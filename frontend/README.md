<div align="center">

<img src="./frontend/public/perppilot-logo.svg" alt="PerpPilot AI logo" width="140">

# PerpPilot AI

### Trade-intelligence cockpit for dreamDEX perps on Somnia

**Navigate markets. Trade with intelligence.**

</div>

PerpPilot AI is a trader tool for **dreamDEX perpetual markets** on the Somnia Tokyo testnet (Hideki, chain `50383`). It turns live order-book and candle data into a readable trade idea, sizes the position against your risk budget, lets you rehearse it with a paper account, and then places and cancels real testnet limit orders from your own wallet.

> The signal never trades for you. Every on-chain action is a transaction you review and approve in your wallet.

---

## Who it is for

- **Perps traders who want a second opinion**, with the reasoning shown in plain English instead of a bare "LONG".
- **New dreamDEX users** who want to practise sizing and stop placement before risking collateral.
- **Builders** looking for a working example of the Somnia Markets SDK: market data, order book tops, margin reads, order placement and cancellation, and smart-account trading.

## What it does

| Area | What you get |
|---|---|
| Live market data | All dreamDEX perp markets, mark price, best bid / best ask from the on-chain book, trailing 24h volume and trade count, candles at 5m / 15m / 1h / 4h |
| Signal engine | LONG / SHORT / HOLD with a confidence score from EMA 9/21, RSI 14, MACD, ATR volatility, trend-vs-chop regime and recent support / resistance |
| Explanations | A plain-English "why this signal" panel, a risk rating (Low / Medium / High) and the exact condition that would invalidate the idea |
| Trade plan | Entry, ATR-based stop-loss and two targets (1.5R, 2.5R) |
| Position sizing | Risk calculator: equity, risk %, stop distance gives size, leverage and required margin, with warnings. One click fills the order form |
| Paper trading | 10,000 virtual USDso, long / short from any signal, live profit and loss, automatic stop / target closes, full trade history, win rate and R multiple |
| Real testnet orders | Place and cancel limit orders on the selected market. Pre-checks for lot size, tick size, minimum size and available capacity |
| Account monitor | Equity, collateral, margin health, margin used, buffer above maintenance, and each open order's distance from the mark |
| Wallet | MetaMask or any EIP-1193 wallet, automatic add / switch to chain 50383, chain and account detection |
| Smart wallet mode (experimental) | Trades through your dreamDEX smart wallet (the account that holds Perps Arena collateral) with your wallet as owner |

## Architecture

```mermaid
flowchart LR
    subgraph Browser["Frontend (React + Vite)"]
        UI[Dashboard UI]
        SIG[Signal engine<br/>lib/analysis.js]
        PAPER[Paper engine<br/>lib/paper.js]
        TRADE[Trading panel<br/>PerpTradingPanel]
        SDK[Somnia Markets SDK]
    end
    subgraph Backend["Backend (FastAPI + Node helper)"]
        API[REST API]
        NODE[markets-json.mjs<br/>SDK reads]
    end
    W[Wallet<br/>MetaMask]
    CH[(Somnia Tokyo testnet<br/>dreamDEX perps)]

    UI --> API --> NODE --> CH
    UI --> SIG
    UI --> PAPER
    UI --> TRADE --> SDK
    SDK -->|reads: book tops, stats, margin, orders| CH
    TRADE -->|sign + send| W --> CH
```

More detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quick start

**Requirements:** Node.js 20.19+ (or 22), Python 3.10+, MetaMask (or a compatible wallet).

```bash
# 1. Backend helper dependencies (repo root)
cd backend/dreamdex && npm install && cd ../..

# 2. Backend API
python -m venv venv
# Windows: venv\Scripts\activate      macOS/Linux: source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload        # http://127.0.0.1:8000

# 3. Frontend (new terminal)
cd frontend
npm install
npm run dev                                   # http://localhost:5173
```

Optional environment files: `frontend/.env.example` (`VITE_API_URL`) and `backend/.env.example` (`FRONTEND_ORIGINS`).

## Trading with real testnet orders

1. Join the **Perps Arena** at <https://app.testnet.dreamdex.io> with your wallet to receive paper USDso.
2. Make sure the wallet holds some **STT on Hideki** for gas (keep at least 0.4 STT free; Somnia writes reserve a high gas ceiling).
3. In PerpPilot, connect the same wallet. If a dreamDEX smart wallet is found, it is selected as the **Trading account**. Press **Refresh account** and check that equity is above zero.
4. Pick a market, choose a direction, then place a limit order well away from the market first (about 1% to 2% below the best bid for a buy) so it rests, then cancel it from the open-orders table.

### Order evidence

| What | Transaction hash | Explorer |
|---|---|---|
| Limit order placed | `<add after first live order>` | |
| Order cancelled | `<add after first live cancel>` | |

## How the signal works

1. **Trend:** EMA 9 versus EMA 21 and the slope of EMA 9.
2. **Momentum:** RSI 14, MACD (12/26) and the last few candles.
3. **Confirmation:** volume versus its 20-candle average.
4. **Context:** an efficiency ratio labels the market Trending, Transitional or Choppy; ATR versus its 50-candle average labels volatility Compressing, Normal or Expanding; recent swing high and low give support and resistance.
5. **Score and confidence:** factors add up to a score; LONG at +6 or above, SHORT at -6 or below, otherwise HOLD. Confidence is reduced in choppy or expanding-volatility markets and near support or resistance.

Rule-based and fully explainable by design. It is a decision aid, not a prediction.

## Safety

- Testnet only. No real funds.
- Nothing is sent without a wallet confirmation. There are no background trades.
- Voucher claims are simulated first and not sent if they would revert, so a failing call does not cost gas.
- Orders are validated against lot size, tick size, minimum size and available capacity before the wallet opens.

## Feedback for dreamDEX

Issues found while building are in [`feedback/`](feedback), one Markdown file each:

- [001: `claimPerpVoucher` reverts with `0x3e31dcc2` although eligibility reports eligible](feedback/001-claimperpvoucher-reverts-0x3e31dcc2.md)
- [002: error selector not present in the SDK's ABIs](feedback/002-error-selector-not-in-sdk-abis.md)
- [003: mark price appears frozen while the book moves](feedback/003-markprice-static-vs-orderbook.md)
- [004: docs gap for obtaining the first STT for gas](feedback/004-docs-first-stt-for-gas.md)

## X posts

<!-- Replace with 2 or 3 real post links that tag @DreamDEXSomnia. Drafts: docs/X-POSTS.md -->

1. `<https://x.com/jadoon_hajra/status/2118591863007728111>`
2. `<https://x.com/jadoon_hajra/status/2118592977253613894>`
3. `<link to post 3>`

## Project structure

```
backend/
  app/                FastAPI app (market, dreamdex, trading routers)
  dreamdex/           Node helper that reads dreamDEX through the Somnia Markets SDK
frontend/
  src/
    App.jsx           Dashboard and layout
    lib/              analysis.js (signals), paper.js (paper engine), sdk.js, useMarketTicker.js
    components/       WalletConnect, PerpTradingPanel, SignalInsights, RiskCalculator, PaperTrading
docs/                 Architecture, X post drafts, demo script
feedback/             Reproducible reports for the dreamDEX Feedback track
```

## Tech stack

React 19, Vite, Recharts, viem, `@somnia-chain/markets-sdk` 0.32.1, FastAPI, Node.js.

## Known limitations

- Paper results ignore fees and slippage and are stored in the browser only.
- Prices for paper positions update for the selected market only.
- The signal engine is technical and rule-based; it does not use funding rates or open interest yet.
- Smart-wallet trading depends on your wallet being an owner of your dreamDEX smart wallet at threshold 1.

## License

MIT. Testnet prototype for the dreamDEX Perps Builder Bounty. Not financial advice.