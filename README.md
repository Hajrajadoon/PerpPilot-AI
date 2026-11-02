<div align="center">

<img src="./aegistrade-ai-logo.png" alt="AegisTrade AI Logo" width="180">

# AegisTrade AI

### AI-Powered Trading Intelligence

**Trade smarter. Trade with Aegis.**

</div>

## AI-Powered Trading Intelligence for WEEX Futures

> **Trade smarter. Trade with Aegis.**

AegisTrade AI is an AI-powered futures trading intelligence platform developed for **WEEX AI Wars II: Human vs AI**.

The platform combines real-time WEEX futures market data, multi-indicator technical analysis, AI-assisted trading signals, risk management, paper trading, and protected WEEX execution into a unified trading workflow.

The core design principle is:

> **An AI signal should never become an exchange order directly. It must first pass through risk validation and execution-safety controls.**

---

# Table of Contents

* [Overview](#overview)
* [Problem](#problem)
* [Solution](#solution)
* [Key Features](#key-features)
* [How AegisTrade AI Works](#how-aegistrade-ai-works)
* [System Architecture](#system-architecture)
* [Architecture Components](#architecture-components)
* [AI Signal Strategy](#ai-signal-strategy)
* [Signal Decision Logic](#signal-decision-logic)
* [Why HOLD Matters](#why-hold-matters)
* [Risk Management](#risk-management)
* [Execution Safety](#execution-safety)
* [WEEX Integration](#weex-integration)
* [Paper Trading](#paper-trading)
* [Security](#security)
* [Technology Stack](#technology-stack)
* [Project Structure](#project-structure)
* [Local Setup](#local-setup)
* [Environment Variables](#environment-variables)
* [Running the Application](#running-the-application)
* [Deployment](#deployment)
* [Demo Flow](#demo-flow)
* [Supported Markets](#supported-markets)
* [Testing Philosophy](#testing-philosophy)
* [Future Improvements](#future-improvements)
* [Competition](#competition)
* [Disclaimer](#disclaimer)

---

# Overview

AegisTrade AI provides an integrated environment for monitoring futures markets, analyzing market conditions, generating AI-assisted trading signals, applying risk controls, and safely demonstrating trade execution.

The platform brings the following workflow together:

**Market Data → Analysis → Decision → Risk Validation → Execution**

Instead of requiring a trader to manually inspect multiple indicators, calculate position sizing, evaluate risk, and then execute a trade, AegisTrade organizes these processes into a structured trading intelligence pipeline.

### Core Capabilities

* Real-time WEEX futures market data
* Technical indicator analysis
* AI-assisted LONG / SHORT / HOLD signals
* Signal confidence scoring
* Market-condition explanations
* Risk calculations
* Position sizing
* Stop-loss and take-profit validation
* Paper trading
* Simulated P&L tracking
* Trade history
* WEEX execution protection
* Backend-controlled live trading switch

---

# Problem

Futures trading often requires several decisions to be made within a short period of time.

A trader may need to:

1. Monitor price movement
2. Identify the current trend
3. Analyze momentum
4. Evaluate RSI
5. Compare moving averages
6. Inspect MACD
7. Analyze volume
8. Calculate position size
9. Determine stop-loss and take-profit levels
10. Evaluate whether the trade is worth taking
11. Execute the order

Performing these tasks manually can lead to:

* Delayed decisions
* Inconsistent analysis
* Emotional trading
* Poor risk control
* Overtrading
* Incorrect position sizing
* Execution based on outdated information

AegisTrade AI addresses this problem by bringing market intelligence, signal generation, risk validation, and execution protection into one structured system.

---

# Solution

AegisTrade AI continuously processes market information and produces a structured trading decision.

Multiple technical indicators contribute to the decision rather than relying on a single indicator.

The resulting signal is then passed through risk-management and execution-safety layers before a trading action can occur.

### Core Trading Pipeline

```text
┌──────────────────────────┐
│     WEEX Market Data     │
│                          │
│ • Price                 │
│ • Bid / Ask             │
│ • Volume                │
│ • Candles               │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Market Intelligence    │
│                          │
│ • Market conditions      │
│ • Price analysis         │
│ • Market statistics      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Technical Analysis     │
│                          │
│ • EMA 9 / EMA 21         │
│ • RSI 14                 │
│ • MACD                   │
│ • Momentum               │
│ • Volume Ratio           │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    AI Signal Engine      │
│                          │
│ • LONG                   │
│ • SHORT                  │
│ • HOLD                   │
│ • Confidence             │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      Risk Manager        │
│                          │
│ • Position sizing        │
│ • Balance validation     │
│ • Stop-loss / Take-profit│
│ • Exposure limits        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Execution Safety       │
│                          │
│ • Fresh price check      │
│ • Notional limit         │
│ • Duplicate protection   │
│ • Live trading switch    │
└────────────┬─────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────────┐ ┌──────────────┐
│    Paper     │ │     WEEX     │
│   Trading    │ │   Futures    │
│    Engine    │ │  Execution   │
└──────────────┘ └──────────────┘
```

This architecture makes risk management part of the trading workflow rather than treating it as an afterthought.

---

# Key Features

## 1. Real-Time WEEX Market Intelligence

AegisTrade connects to WEEX futures market endpoints to retrieve current market information.

The platform can process information such as:

* Current price
* Best bid
* Best ask
* 24-hour high
* 24-hour low
* 24-hour volume
* Price change
* Candlestick data
* Trading symbols
* Chart intervals

Market information is retrieved by the backend before being provided to the frontend.

---

## 2. Multi-Indicator AI Signal Engine

The signal engine evaluates multiple technical inputs:

* EMA 9
* EMA 21
* RSI 14
* MACD
* Momentum
* Volume Ratio

These indicators are combined into a directional scoring system.

The resulting market classification is:

| Signal    | Meaning                                            |
| --------- | -------------------------------------------------- |
| **LONG**  | Bullish conditions provide sufficient confirmation |
| **SHORT** | Bearish conditions provide sufficient confirmation |
| **HOLD**  | Market evidence is insufficient or conflicting     |

The dashboard also provides a confidence score and an explanation of the current market intelligence.

---

## 3. Risk Management

Risk management is positioned between signal generation and execution.

The system includes controls for:

* Balance validation
* Position sizing
* Stop-loss
* Take-profit
* Maximum order notional
* Duplicate-position protection
* Fresh market-price validation
* Live trading protection

This prevents a trading signal from automatically bypassing the application's safety controls.

---

## 4. Paper Trading

AegisTrade includes a simulated trading environment for development, testing, and demonstration.

The paper trading engine tracks:

* Simulated balance
* Open positions
* Entry price
* Exit price
* Position direction
* Profit and loss
* Trade history

The default simulated starting balance is:

**10,000 USDT**

Paper trading allows the complete trading workflow to be demonstrated without sending real orders to the exchange.

---

## 5. Protected WEEX Execution

AegisTrade contains a backend WEEX execution layer responsible for authenticated trading operations.

Live trading is controlled through a backend environment variable:

```env
WEEX_LIVE_TRADING=false
```

When live trading is disabled, an order can be validated by the application without being sent as a real exchange order.

This provides an additional safety barrier during development and competition demonstrations.

---

# How AegisTrade AI Works

The complete system follows a structured sequence from market data to trading action.

```text
┌──────────────────────────┐
│      WEEX Futures        │
│       Market Data        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Market Intelligence    │
│                          │
│ • Price                  │
│ • Bid / Ask              │
│ • Volume                 │
│ • Candles                │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Technical Indicators   │
│                          │
│ • EMA 9                  │
│ • EMA 21                 │
│ • RSI 14                 │
│ • MACD                   │
│ • Momentum               │
│ • Volume Ratio           │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    AI Signal Engine      │
│                          │
│   LONG / SHORT / HOLD    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      Risk Manager        │
│                          │
│  Validate proposed trade │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Execution Safety       │
│                          │
│  Validate before action  │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
┌──────────────┐ ┌──────────────┐
│    Paper     │ │     WEEX     │
│   Trading    │ │   Futures    │
│    Engine    │ │  Execution   │
└──────────────┘ └──────────────┘
```

### Workflow Explanation

**Step 1 — Market Data**

The backend retrieves market information from WEEX.

**Step 2 — Market Intelligence**

The system processes current price, bid/ask, volume, candles, and other market information.

**Step 3 — Technical Analysis**

Technical indicators are calculated from the available market data.

**Step 4 — AI Signal**

The indicator results are combined to produce a LONG, SHORT, or HOLD classification.

**Step 5 — Risk Validation**

The proposed trade is checked against the configured risk requirements.

**Step 6 — Execution Safety**

Additional safety checks are performed before a trading action.

**Step 7 — Trading Action**

The validated action can either be:

* Executed in the paper trading engine, or
* Passed to the protected WEEX execution layer when live trading is explicitly enabled.

---

# System Architecture



```mermaid
flowchart TB
    A["AegisTrade AI<br/>React Frontend<br/>Hosted on Netlify"]
    B["FastAPI Backend<br/>Hosted on Render"]
    C["WEEX Market Data"]
    D["AI Signal Engine"]
    E["Risk Management Layer"]
    F["Execution Safety Layer"]
    G["Paper Trading Engine"]
    H["WEEX Futures Execution"]

    A -->|HTTPS / REST API| B
    B --> C
    B --> D
    B --> E
    C -->|Market data| D
    D -->|Trade signal| E
    C -->|Current price| F
    D -->|Validated signal| F
    E -->|Approved trade plan| F
    F -->|Simulation mode| G
    F -->|Live trading enabled| H
    G -->|Results and positions| B
    H -->|Order status and fills| B
    B -->|Status| A
```

AegisTrade AI uses a layered architecture that separates market data, AI signal generation, risk management, execution safety, and trading execution.

### Architecture Components

#### 1. React Frontend

The React frontend provides the user interface for market monitoring, AI signals, risk controls, paper trading, and execution status.

#### 2. FastAPI Backend

The FastAPI backend provides the application API and coordinates communication between the frontend, market data, AI strategy, risk management, and execution services.

#### 3. WEEX Market Data

The system retrieves ticker, candle, bid/ask, and volume information from WEEX to support real-time market analysis.

#### 4. AI Signal Engine

The signal engine evaluates indicators including EMA, RSI, MACD, momentum, and volume to generate LONG, SHORT, or HOLD decisions.

#### 5. Risk Management Layer

The risk layer handles position sizing, stop-loss/take-profit calculations, risk limits, balance validation, and trade validation.

#### 6. Execution Safety Layer

Before execution, the system performs fresh-price validation, notional-limit checks, duplicate-position protection, and live-trading safety checks.

#### 7. Execution Destinations

Validated trades can be processed by the paper trading engine or, when explicitly enabled, the WEEX futures execution layer.


### Architecture Principle

The frontend is responsible for presentation and user interaction.

The backend handles:

* Market-data communication
* Trading logic
* Risk validation
* Paper trading
* WEEX authentication
* Execution protection
* Security-sensitive operations

Exchange credentials remain on the backend.

---

# Architecture Components

## Frontend

The frontend is built using React.

It provides the main user interface for:

* Market monitoring
* Technical analysis
* AI signals
* Confidence information
* Risk information
* Paper trading
* WEEX execution status
* Trade history
* Interactive charts

The production frontend is hosted on Netlify.

---

## Backend

The backend is built using Python and FastAPI.

It handles:

* API endpoints
* Market-data requests
* Trading operations
* Risk calculations
* Paper trading
* WEEX authentication
* WEEX execution
* Backend configuration
* Security-sensitive operations

The production backend is hosted on Render.

---

## WEEX Market Service

The market service communicates with WEEX futures market endpoints.

It retrieves and validates:

* Ticker information
* Bid / ask information
* 24-hour market statistics
* Candlestick data

The service also validates supported symbols and market values before passing them into the application.

---

## AI Signal Engine

The signal engine combines multiple technical indicators into a structured market decision.

The current indicator set includes:

* EMA 9
* EMA 21
* RSI 14
* MACD
* Momentum
* Volume Ratio

The combined indicator results contribute to the directional score.

---

## Risk Manager

The risk layer determines whether a proposed trade satisfies the configured risk requirements.

It considers factors such as:

* Entry price
* Available balance
* Position size
* Risk parameters
* Stop-loss
* Take-profit
* Maximum exposure
* Trading constraints

---

## Execution Safety Layer

The execution safety layer provides additional protection before a trade reaches an exchange.

It includes:

* Fresh price validation
* Maximum order-notional protection
* Duplicate-position protection
* Live trading switch
* Order validation

This layer is deliberately separated from the AI signal engine.

---

## Paper Trading Engine

The paper trading engine provides a simulated trading environment.

It tracks:

* Simulated balance
* Open positions
* Entry prices
* Exit prices
* P&L
* Trade history

No real exchange funds are required for paper trading.

---

# AI Signal Strategy

AegisTrade does not rely on a single technical indicator.

Instead, multiple indicators contribute to the overall market assessment.

## EMA 9

EMA 9 represents a shorter-term trend measurement.

It helps identify recent price direction.

---

## EMA 21

EMA 21 represents a longer comparison period.

Comparing EMA 9 and EMA 21 helps identify directional trend conditions.

---

## RSI 14

RSI is used to evaluate momentum and relative bullish or bearish market strength.

---

## MACD

MACD contributes information about momentum and trend direction.

---

## Momentum

Recent price movement is used as an additional directional input.

---

## Volume Ratio

Volume behavior provides additional information about market activity and can help confirm or weaken a directional signal.

---

# Signal Decision Logic

The current signal engine uses a combined scoring approach.

The primary classification thresholds are:

```text
              ┌─────────────────┐
              │  Combined Score │
              └────────┬────────┘
                       │
             ┌─────────┼─────────┐
             │         │         │
             ▼         ▼         ▼
       Score >= 6  -5 to +5  Score <= -6
             │         │         │
             ▼         ▼         ▼
          ┌──────┐  ┌──────┐  ┌──────┐
          │ LONG │  │ HOLD │  │SHORT │
          └──────┘  └──────┘  └──────┘
```

### Signal Interpretation

|      Score | Classification |
| ---------: | -------------- |
|     `>= 6` | LONG           |
| `-5 to +5` | HOLD           |
|    `<= -6` | SHORT          |

The system also calculates a confidence value based on the strength of the combined signal.

The confidence value should be interpreted as the model's confidence in its current classification, **not as a guaranteed probability of profit**.

---

# Why HOLD Matters

AegisTrade does not force a trade when market evidence is mixed.

If the technical signals do not provide sufficient directional confirmation, the system returns:

**HOLD**

This is intentional.

For example, a market may show:

* Neutral RSI
* Nearly equal short- and long-term EMAs
* Weak MACD momentum
* Conflicting directional signals

Instead of artificially choosing LONG or SHORT, AegisTrade can wait for stronger confirmation.

This creates a more risk-aware trading workflow and helps reduce unnecessary trades.

---

# Risk Management

Risk management is one of the core architectural principles of AegisTrade AI.

The system does not treat the AI signal as an automatic order instruction.

Instead, the workflow is:

```text
┌──────────────────────────┐
│       AI Signal          │
│   LONG / SHORT / HOLD    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Fresh Market Price     │
│      Validation          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    Risk Calculation      │
│                          │
│ • Position size          │
│ • Exposure               │
│ • SL / TP                │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Risk Validation      │
│                          │
│   Trade allowed?          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Execution Safety       │
│                          │
│ • Notional limit         │
│ • Duplicate protection   │
│ • Live trading switch    │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
┌──────────────┐ ┌──────────────┐
│    Paper     │ │     WEEX     │
│   Trading    │ │   Execution  │
└──────────────┘ └──────────────┘
```

## Fresh Price Validation

Before important trading actions, the system requests fresh market information.

This reduces the risk of making an execution decision using an outdated displayed price.

---

## Position Sizing

The system calculates a proposed position size using configured risk parameters and available balance.

This helps prevent uncontrolled position exposure.

---

## Stop-Loss and Take-Profit

The risk layer validates protective trading levels before a position is opened.

These controls are intended to structure the risk associated with a proposed trade.

---

## Balance Validation

The paper trading system validates the available simulated balance before opening a position.

---

## Duplicate Position Protection

The paper trading engine prevents multiple open positions for the same symbol.

This helps prevent accidental repeated exposure.

---

## Maximum Order Notional

The WEEX execution layer supports a maximum live-order notional setting.

Example:

```env
WEEX_MAX_LIVE_ORDER_NOTIONAL_USDT=100
```

This provides an additional exposure limit for live execution.

---

# Execution Safety

AegisTrade deliberately separates signal generation from order execution.

The execution sequence is:

```text
┌──────────────────────────┐
│       AI Signal          │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    Fresh Market Price    │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Risk Calculation     │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Risk Validation      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Execution Safety       │
│                          │
│ • Notional limit         │
│ • Duplicate protection   │
│ • Live switch            │
└────────────┬─────────────┘
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
┌──────────────┐ ┌──────────────┐
│    Paper     │ │     WEEX     │
│    Trade     │ │     Order    │
└──────────────┘ └──────────────┘
```

The objective is to ensure that an AI-generated signal cannot directly bypass the application's risk and safety controls.

---

# WEEX Integration

AegisTrade integrates with the WEEX futures API for market information and protected trading operations.

## Market Data

The backend retrieves information such as:

* 24-hour ticker
* Current price
* Best bid
* Best ask
* Volume
* Candlestick data

---

## Authentication

Authenticated WEEX operations use backend-side credentials and the required request-signing mechanism.

The credentials are intended to remain exclusively on the backend.

They should never be placed in the React frontend.

---

## Live Trading Protection

Live trading is controlled through:

```env
WEEX_LIVE_TRADING=false
```

When live trading is disabled, the intended behavior is:

```text
┌──────────────────────────┐
│       Order Request      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│        Validation        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Safety Checks        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  Live Trading Disabled   │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    Order NOT Sent to     │
│          WEEX             │
└──────────────────────────┘
```

This is the recommended configuration during development and safe competition demonstrations.

---

# Paper Trading

Paper trading allows the complete trading workflow to be tested without real financial exposure.

The system can:

* Open simulated positions
* Close simulated positions
* Calculate simulated P&L
* Track simulated balance
* Record trade history

### Default Starting Balance

```text
10,000 USDT
```

Paper trading is intended for:

* Development
* Testing
* Demonstration
* Strategy evaluation
* Frontend/backend integration testing

---

# Security

Security is especially important because AegisTrade interacts with exchange APIs.

## Credentials

Real WEEX credentials must remain in backend environment variables.

Never expose:

```text
WEEX_API_KEY
WEEX_SECRET_KEY
WEEX_PASSPHRASE
```

in:

* Frontend source code
* React components
* GitHub repositories
* README files
* Screenshots
* Demo videos
* Public documentation

---

## Environment Files

The project uses:

```text
.env
.env.example
```

The real `.env` file should remain private and should never be committed to GitHub.

The `.env.example` file should contain placeholders only.

Example:

```env
WEEX_API_KEY=YOUR_WEEX_API_KEY
WEEX_SECRET_KEY=YOUR_WEEX_SECRET_KEY
WEEX_PASSPHRASE=YOUR_WEEX_PASSPHRASE

WEEX_BASE_URL=https://api-contract.weex.com

WEEX_LIVE_TRADING=false
WEEX_MAX_LIVE_ORDER_NOTIONAL_USDT=100
```

---

# Technology Stack

## Frontend

| Technology   | Purpose             |
| ------------ | ------------------- |
| React        | User interface      |
| Vite         | Frontend build tool |
| Axios        | HTTP communication  |
| Lucide React | Interface icons     |
| Recharts     | Data visualization  |

## Backend

| Technology | Purpose                      |
| ---------- | ---------------------------- |
| Python     | Backend programming language |
| FastAPI    | REST API framework           |
| Uvicorn    | ASGI server                  |
| Requests   | HTTP communication           |

## Exchange

| Service          | Purpose                             |
| ---------------- | ----------------------------------- |
| WEEX Futures API | Market data and protected execution |

## Deployment

| Platform | Component      |
| -------- | -------------- |
| Netlify  | Frontend       |
| Render   | Backend        |
| GitHub   | Source control |

---

# Project Structure

```text
aegistrade-ai/
│
├── frontend/
│   ├── src/
│   │   └── App.jsx
│   ├── package.json
│   └── ...
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   │
│   │   ├── api/
│   │   │   ├── market.py
│   │   │   └── trading.py
│   │   │
│   │   └── services/
│   │       ├── weex_market.py
│   │       ├── weex_auth.py
│   │       ├── weex_execution.py
│   │       └── paper_trading.py
│   │
│   └── requirements.txt
│
├── .env.example
├── .gitignore
└── README.md
```

---

# Local Setup

## Requirements

Install:

* Python 3.10+
* Node.js
* npm
* Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/Hajrajadoon/aegistrade-ai.git
cd aegistrade-ai
```

---

## 2. Backend Setup

Create a Python virtual environment:

```bash
python -m venv venv
```

Activate it on Windows PowerShell:

```powershell
.\venv\Scripts\Activate.ps1
```

Install backend dependencies:

```bash
pip install -r backend/requirements.txt
```

---

## 3. Configure Environment Variables

Create a local `.env` file.

Example:

```env
WEEX_API_KEY=YOUR_WEEX_API_KEY
WEEX_SECRET_KEY=YOUR_WEEX_SECRET_KEY
WEEX_PASSPHRASE=YOUR_WEEX_PASSPHRASE

WEEX_BASE_URL=https://api-contract.weex.com

WEEX_LIVE_TRADING=false
WEEX_MAX_LIVE_ORDER_NOTIONAL_USDT=100
```

**Do not place real credentials in public documentation.**

---

# Environment Variables

| Variable                            | Purpose                             |
| ----------------------------------- | ----------------------------------- |
| `WEEX_API_KEY`                      | WEEX API key                        |
| `WEEX_SECRET_KEY`                   | WEEX secret key                     |
| `WEEX_PASSPHRASE`                   | WEEX API passphrase                 |
| `WEEX_BASE_URL`                     | WEEX futures API base URL           |
| `WEEX_LIVE_TRADING`                 | Enables/disables live execution     |
| `WEEX_MAX_LIVE_ORDER_NOTIONAL_USDT` | Maximum allowed live order notional |
| `VITE_API_URL`                      | Frontend URL for the backend API    |

### Recommended Development Configuration

```env
WEEX_LIVE_TRADING=false
```

Live trading should only be enabled deliberately after authentication, validation, risk controls, and execution behavior have been tested.

---

# Running the Application

## Start the Backend

From the project root:

```bash
python -m uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend:

```text
http://127.0.0.1:8000
```

FastAPI Swagger documentation:

```text
http://127.0.0.1:8000/docs
```

---

## Start the Frontend

Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Then open:

```text
http://localhost:5173
```

---

# Deployment

AegisTrade AI uses a separated production deployment architecture.

```text
                         ┌──────────────────────────┐
                         │     GitHub Repository    │
                         │                          │
                         │   Source Control         │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
                ┌──────────────────┐     ┌──────────────────┐
                │      Netlify     │     │      Render      │
                │                  │     │                  │
                │ React Frontend   │     │ FastAPI Backend  │
                └────────┬─────────┘     └────────┬─────────┘
                         │                        │
                         │      HTTP API          │
                         └───────────┬────────────┘
                                     │
                                     ▼
                         ┌──────────────────────────┐
                         │      WEEX Futures API    │
                         │                          │
                         │ • Market Data            │
                         │ • Protected Execution    │
                         └──────────────────────────┘
```

## Production Frontend

```text
https://aegistrade-ai.netlify.app
```

The frontend uses the backend URL configured through:

```env
VITE_API_URL
```

---

## Production Backend

```text
https://aegistrade-ai.onrender.com
```

Backend health endpoint:

```text
https://aegistrade-ai.onrender.com/
```

---

# Demo Flow

```mermaid
flowchart TB
    %% AegisTrade AI — End-to-End Demo Workflow

    START(["AegisTrade AI<br/>End-to-End Demo Workflow"])

    subgraph PHASE1["Phase 1 · Launch & Live Data"]
        direction LR
        S1["1. Open AegisTrade AI"] --> S2["2. Show Live WEEX Data"]
    end

    subgraph PHASE2["Phase 2 · Market Context"]
        direction LR
        S3["3. Select Futures Symbol"] --> S4["4. Show Price & Market Information"] --> S5["5. Show Technical Indicators"]
    end

    subgraph PHASE3["Phase 3 · AI Intelligence"]
        direction LR
        S6["6. Show AI Signal<br/>LONG / SHORT / HOLD"] --> S7["7. Explain Confidence"]
    end

    subgraph PHASE4["Phase 4 · Risk & Paper Trading"]
        direction LR
        S8["8. Show Risk Controls"] --> S9["9. Open Paper Trade"] --> S10["10. Show Position, Balance & P&L"]
    end

    subgraph PHASE5["Phase 5 · Safety & Architecture"]
        direction LR
        S11["11. Show WEEX Execution Protection"] --> S12["12. Explain System Architecture"]
    end

    START --> PHASE1
    PHASE1 --> PHASE2
    PHASE2 --> PHASE3
    PHASE3 -->|"Signal passes risk validation"| PHASE4
    PHASE4 --> PHASE5

    NOTE["Core principle:<br/>An AI signal never becomes<br/>an exchange order directly."]
    PHASE3 -.-> NOTE
```

### Recommended Presentation Sequence

1. Open the dashboard.
2. Show that market data is connected.
3. Select a supported futures symbol.
4. Demonstrate current price and market information.
5. Show EMA, RSI, MACD, momentum, and volume information.
6. Explain the generated signal.
7. Explain why the system can return HOLD.
8. Show confidence information.
9. Demonstrate risk controls.
10. Open a paper trade.
11. Show the simulated position and P&L.
12. Explain that live WEEX execution is protected by backend controls.
13. Finish by explaining the architecture.

---

# Supported Markets

The current application supports the following futures symbols:

| Symbol   |
| -------- |
| BTCUSDT  |
| ETHUSDT  |
| SOLUSDT  |
| DOGEUSDT |
| XRPUSDT  |
| ADAUSDT  |
| BNBUSDT  |
| LTCUSDT  |

### Supported Chart Intervals

* 5m
* 15m
* 1h
* 4h

---

# Testing Philosophy

AegisTrade was developed with a safety-oriented testing approach.

Testing areas include:

* Backend API testing
* Market ticker validation
* Candlestick validation
* Paper trading testing
* Risk validation
* WEEX authentication testing
* Protected WEEX order testing
* Frontend-backend connectivity
* Local development testing
* Production deployment testing

The recommended demonstration configuration keeps live trading disabled while validating the complete trading workflow through paper trading and protected execution logic.

---

# Future Improvements

Potential future improvements include:

## Intelligence

* More advanced machine-learning models
* More sophisticated signal models
* Strategy optimization
* Market-regime detection
* Improved signal explainability

## Trading

* Historical backtesting
* Portfolio-level risk management
* Advanced execution monitoring
* Expanded exchange integrations

## Infrastructure

* Persistent trading database
* Persistent user accounts
* Persistent trading history
* Production-grade logging
* Observability and monitoring
* Improved market-data retry and recovery handling

These improvements can be developed as the project evolves beyond the competition prototype.

---

# Competition

AegisTrade AI was developed for:

**WEEX AI Wars II: Human vs AI**

The project focuses on combining AI-driven market intelligence with controlled futures trading workflows.

### Project Tagline

> **Trade smarter. Trade with Aegis.**

---

# Disclaimer

AegisTrade AI is a software project and competition prototype.

It does not guarantee trading profits.

AI-generated signals and confidence scores should not be interpreted as guaranteed probabilities of successful trades.

Futures trading involves significant financial risk, particularly when leverage is used.

Users should understand the risks of leveraged trading before using any live trading functionality.

**Always test with paper trading first and never expose exchange credentials publicly.**

---

# AegisTrade AI

**AI-Powered Trading Intelligence for WEEX Futures**

> **Trade smarter. Trade with Aegis.**
