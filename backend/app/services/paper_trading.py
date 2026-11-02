import os
from datetime import datetime, timezone
from math import isfinite
from uuid import uuid4

import requests


INITIAL_BALANCE = 10_000.0

# Paper-trading safety settings.
# The frontend/risk manager still determines the intended position size,
# stop loss and take profit. These limits only protect the simulation
# from corrupted/mismatched prices.
PRICE_VALIDATION_TOLERANCE = 0.10  # 10%

WEEX_BASE_URL = os.getenv(
    "WEEX_BASE_URL",
    "https://api-contract.weex.com",
).rstrip("/")

MARKET_TIMEOUT = (5, 8)


class PaperTradingEngine:
    def __init__(self):
        self.balance = INITIAL_BALANCE
        self.positions = {}
        self.trade_history = []

    # ------------------------------------------------------------------
    # MARKET PRICE VALIDATION
    # ------------------------------------------------------------------

    def _get_live_price(self, symbol: str) -> float:
        """
        Get the current WEEX futures price for the exact requested symbol.

        Paper trading uses this only as a safety validation layer. It prevents
        a price belonging to one asset from being accidentally used for
        another asset.
        """
        symbol = symbol.upper().strip()

        if not symbol:
            raise ValueError("Trading symbol is required.")

        url = f"{WEEX_BASE_URL}/capi/v3/market/ticker/24hr"

        try:
            response = requests.get(
                url,
                params={"symbol": symbol},
                timeout=MARKET_TIMEOUT,
            )
            response.raise_for_status()
            payload = response.json()

        except requests.RequestException as error:
            raise ValueError(
                f"Unable to validate {symbol} against the WEEX market price."
            ) from error

        except ValueError as error:
            raise ValueError(
                f"WEEX returned invalid market data for {symbol}."
            ) from error

        ticker = None

        if isinstance(payload, dict):
            # Some API responses may return the ticker directly.
            if payload.get("symbol"):
                ticker = payload

            # Some responses may wrap the result.
            elif isinstance(payload.get("data"), dict):
                ticker = payload["data"]

            elif isinstance(payload.get("data"), list) and payload["data"]:
                ticker = payload["data"][0]

        elif isinstance(payload, list) and payload:
            # WEEX may return a list for ticker endpoints.
            for item in payload:
                if isinstance(item, dict):
                    item_symbol = str(item.get("symbol", "")).upper()
                    if item_symbol == symbol:
                        ticker = item
                        break

            if ticker is None and isinstance(payload[0], dict):
                ticker = payload[0]

        if not isinstance(ticker, dict):
            raise ValueError(
                f"Unable to read WEEX market price for {symbol}."
            )

        ticker_symbol = str(ticker.get("symbol", "")).upper()

        if ticker_symbol and ticker_symbol != symbol:
            raise ValueError(
                f"WEEX price symbol mismatch: expected {symbol}, "
                f"received {ticker_symbol}."
            )

        raw_price = ticker.get("lastPrice")

        if raw_price is None:
            raw_price = ticker.get("price")

        try:
            live_price = float(raw_price)
        except (TypeError, ValueError) as error:
            raise ValueError(
                f"WEEX returned an invalid price for {symbol}."
            ) from error

        if not isfinite(live_price) or live_price <= 0:
            raise ValueError(
                f"WEEX returned an invalid market price for {symbol}."
            )

        return live_price

    def _validate_price_against_market(
        self,
        symbol: str,
        requested_price: float,
        price_name: str,
    ) -> float:
        """
        Verify that the requested price is reasonably close to the actual
        WEEX price for the same symbol.

        This protects against frontend state/race-condition bugs where,
        for example, BTC entry data is accidentally submitted for ETH.
        """
        live_price = self._get_live_price(symbol)

        difference_ratio = abs(requested_price - live_price) / live_price

        if difference_ratio > PRICE_VALIDATION_TOLERANCE:
            raise ValueError(
                f"{price_name.title()} price does not match the current "
                f"{symbol} market price. "
                f"Requested: {requested_price:.8f}; "
                f"WEEX: {live_price:.8f}."
            )

        return live_price

    # ------------------------------------------------------------------
    # OPEN POSITION
    # ------------------------------------------------------------------

    def open_position(
        self,
        symbol: str,
        side: str,
        entry_price: float,
        quantity: float,
        stop_loss: float,
        take_profit: float,
        confidence: float = 50.0,
        signal_reason: str = "",
    ) -> dict:
        symbol = symbol.upper().strip()
        side = side.upper().strip()

        numeric_values = {
            "entry price": entry_price,
            "quantity": quantity,
            "stop loss": stop_loss,
            "take profit": take_profit,
            "confidence": confidence,
        }

        for name, value in numeric_values.items():
            if not isfinite(float(value)):
                raise ValueError(f"{name.title()} must be a finite number.")

        if side not in {"LONG", "SHORT"}:
            raise ValueError("Side must be LONG or SHORT.")

        if entry_price <= 0:
            raise ValueError("Entry price must be greater than zero.")

        if quantity <= 0:
            raise ValueError("Quantity must be greater than zero.")

        if stop_loss <= 0 or take_profit <= 0:
            raise ValueError(
                "Stop loss and take profit must be greater than zero."
            )

        if not 0 <= confidence <= 100:
            raise ValueError("Confidence must be between 0 and 100.")

        if not symbol:
            raise ValueError("Symbol is required.")

        if symbol in self.positions:
            raise ValueError(
                f"A paper position for {symbol} is already open."
            )

        # --------------------------------------------------------------
        # Validate that the entry price belongs to this symbol.
        # --------------------------------------------------------------

        self._validate_price_against_market(
            symbol=symbol,
            requested_price=entry_price,
            price_name="entry",
        )

        # --------------------------------------------------------------
        # Validate trade direction and SL/TP structure.
        # --------------------------------------------------------------

        if side == "LONG":
            if stop_loss >= entry_price:
                raise ValueError(
                    "For LONG trades, stop loss must be below entry price."
                )

            if take_profit <= entry_price:
                raise ValueError(
                    "For LONG trades, take profit must be above entry price."
                )

        else:
            if stop_loss <= entry_price:
                raise ValueError(
                    "For SHORT trades, stop loss must be above entry price."
                )

            if take_profit >= entry_price:
                raise ValueError(
                    "For SHORT trades, take profit must be below entry price."
                )

        # Planned risk and reward are stored with the position so the
        # paper engine can enforce the configured SL/TP boundaries.
        if side == "LONG":
            planned_loss = (entry_price - stop_loss) * quantity
            planned_profit = (take_profit - entry_price) * quantity
        else:
            planned_loss = (stop_loss - entry_price) * quantity
            planned_profit = (entry_price - take_profit) * quantity

        if not isfinite(planned_loss) or planned_loss < 0:
            raise ValueError("Calculated planned loss is invalid.")

        if not isfinite(planned_profit) or planned_profit < 0:
            raise ValueError("Calculated planned profit is invalid.")

        position = {
            "id": str(uuid4())[:8],
            "symbol": symbol,
            "side": side,
            "entry_price": round(entry_price, 4),
            "quantity": round(quantity, 6),
            "stop_loss": round(stop_loss, 4),
            "take_profit": round(take_profit, 4),
            "planned_loss": round(planned_loss, 2),
            "planned_profit": round(planned_profit, 2),
            "confidence": round(confidence, 2),
            "signal_reason": signal_reason,
            "opened_at": datetime.now(timezone.utc).isoformat(),
        }

        self.positions[symbol] = position

        return position

    # ------------------------------------------------------------------
    # CLOSE POSITION
    # ------------------------------------------------------------------

    def close_position(
        self,
        symbol: str,
        exit_price: float,
        reason: str = "MANUAL",
    ) -> dict:
        symbol = symbol.upper().strip()

        if symbol not in self.positions:
            raise ValueError(
                f"No open paper position for {symbol}."
            )

        if not isfinite(float(exit_price)) or exit_price <= 0:
            raise ValueError(
                "Exit price must be greater than zero."
            )

        position = self.positions[symbol]

        entry_price = float(position["entry_price"])
        quantity = float(position["quantity"])
        side = position["side"]
        stop_loss = float(position["stop_loss"])
        take_profit = float(position["take_profit"])

        # --------------------------------------------------------------
        # Validate that the exit price belongs to this exact symbol.
        # --------------------------------------------------------------

        self._validate_price_against_market(
            symbol=symbol,
            requested_price=exit_price,
            price_name="exit",
        )

        # --------------------------------------------------------------
        # Respect SL/TP boundaries.
        #
        # If the requested market price has moved beyond the configured
        # stop loss or take profit, the paper engine records the trade at
        # the configured SL/TP level instead of allowing an unrealistic
        # unlimited P&L.
        # --------------------------------------------------------------

        effective_exit_price = exit_price
        effective_reason = reason

        if side == "LONG":
            if exit_price <= stop_loss:
                effective_exit_price = stop_loss
                effective_reason = "STOP_LOSS"

            elif exit_price >= take_profit:
                effective_exit_price = take_profit
                effective_reason = "TAKE_PROFIT"

        else:
            if exit_price >= stop_loss:
                effective_exit_price = stop_loss
                effective_reason = "STOP_LOSS"

            elif exit_price <= take_profit:
                effective_exit_price = take_profit
                effective_reason = "TAKE_PROFIT"

        # --------------------------------------------------------------
        # Calculate P&L from the validated, bounded exit price.
        # --------------------------------------------------------------

        if side == "LONG":
            pnl = (effective_exit_price - entry_price) * quantity
        else:
            pnl = (entry_price - effective_exit_price) * quantity

        if not isfinite(pnl):
            raise ValueError("Calculated P&L is invalid.")

        self.balance += pnl

        # Prevent floating-point drift from producing an invalid balance.
        if not isfinite(self.balance) or self.balance <= 0:
            raise ValueError(
                "Paper trading balance became invalid."
            )

        position_notional = entry_price * quantity

        if position_notional <= 0:
            raise ValueError(
                "Paper trading position notional is invalid."
            )

        trade = {
            **position,
            "exit_price": round(effective_exit_price, 4),
            "requested_exit_price": round(exit_price, 4),
            "pnl": round(pnl, 2),
            "pnl_percent": round(
                (pnl / position_notional) * 100,
                4,
            ),
            "exit_reason": effective_reason,
            "closed_at": datetime.now(timezone.utc).isoformat(),
            "balance_after": round(self.balance, 2),
            "status": "CLOSED",
        }

        self.trade_history.insert(0, trade)

        del self.positions[symbol]

        return trade

    # ------------------------------------------------------------------
    # STATUS
    # ------------------------------------------------------------------

    def get_status(self) -> dict:
        return {
            "mode": "SIMULATION",
            "balance": round(self.balance, 2),
            "initial_balance": INITIAL_BALANCE,
            "open_positions": list(self.positions.values()),
            "open_position_count": len(self.positions),
            "total_trades": len(self.trade_history),
            "trade_history": self.trade_history,
        }

    # ------------------------------------------------------------------
    # RESET
    # ------------------------------------------------------------------

    def reset(self) -> dict:
        self.balance = INITIAL_BALANCE
        self.positions = {}
        self.trade_history = []

        return self.get_status()


paper_engine = PaperTradingEngine()