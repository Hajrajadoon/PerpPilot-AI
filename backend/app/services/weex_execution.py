import json
import math
import os
import re
from typing import Optional
from uuid import uuid4

import requests
from dotenv import load_dotenv

from backend.app.services.weex_auth import (
    WEEX_BASE_URL,
    WEEXAuthenticationError,
    weex_authenticator,
)

load_dotenv()

LIVE_TRADING_ENABLED = (
    os.getenv("WEEX_LIVE_TRADING", "false").strip().lower() == "true"
)

MAX_LIVE_ORDER_NOTIONAL_USDT = float(
    os.getenv("WEEX_MAX_LIVE_ORDER_NOTIONAL_USDT", "100")
)

SUPPORTED_SYMBOLS = {
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "DOGEUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "BNBUSDT",
    "LTCUSDT",
}

CLIENT_ORDER_ID_PATTERN = re.compile(
    r"^[A-Z:/a-z0-9_-]{1,36}$"
)

_SEEN_CLIENT_ORDER_IDS: set[str] = set()


class WEEXExecutionError(Exception):
    """Raised when WEEX order execution fails."""


def generate_client_order_id(prefix: str = "aegis") -> str:
    unique_part = uuid4().hex[:16]
    return f"{prefix}-{unique_part}"[:36]


def validate_client_order_id(client_order_id: str) -> str:
    if not client_order_id:
        raise ValueError("Client order ID cannot be empty.")

    if len(client_order_id) > 36:
        raise ValueError(
            "Client order ID cannot exceed 36 characters."
        )

    if not CLIENT_ORDER_ID_PATTERN.fullmatch(client_order_id):
        raise ValueError(
            "Client order ID contains unsupported characters."
        )

    return client_order_id


def normalize_side(side: str) -> str:
    side = side.upper().strip()

    if side not in {"LONG", "SHORT"}:
        raise ValueError(
            "Position side must be LONG or SHORT."
        )

    return side


def position_side_to_order_side(position_side: str) -> str:
    return (
        "BUY"
        if normalize_side(position_side) == "LONG"
        else "SELL"
    )


def validate_symbol(symbol: str) -> str:
    symbol = symbol.upper().strip()

    if symbol not in SUPPORTED_SYMBOLS:
        raise ValueError(
            "Unsupported symbol. Choose from: "
            + ", ".join(sorted(SUPPORTED_SYMBOLS))
        )

    return symbol


def validate_positive_number(
    value: float,
    field_name: str,
) -> float:
    try:
        numeric = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(
            f"{field_name} must be a valid number."
        ) from error

    if not math.isfinite(numeric) or numeric <= 0:
        raise ValueError(
            f"{field_name} must be greater than zero."
        )

    return numeric


def validate_protection_prices(
    position_side: str,
    entry_price: Optional[float],
    take_profit: Optional[float],
    stop_loss: Optional[float],
) -> None:

    if entry_price is None:
        if take_profit is not None or stop_loss is not None:
            raise ValueError(
                "Entry price is required when take-profit "
                "or stop-loss is provided."
            )

        return

    entry = validate_positive_number(
        entry_price,
        "Entry price",
    )

    side = normalize_side(position_side)

    if take_profit is not None:
        tp = validate_positive_number(
            take_profit,
            "Take-profit price",
        )

        if side == "LONG" and tp <= entry:
            raise ValueError(
                "For LONG trades, take-profit must be "
                "above entry price."
            )

        if side == "SHORT" and tp >= entry:
            raise ValueError(
                "For SHORT trades, take-profit must be "
                "below entry price."
            )

    if stop_loss is not None:
        sl = validate_positive_number(
            stop_loss,
            "Stop-loss price",
        )

        if side == "LONG" and sl >= entry:
            raise ValueError(
                "For LONG trades, stop-loss must be "
                "below entry price."
            )

        if side == "SHORT" and sl <= entry:
            raise ValueError(
                "For SHORT trades, stop-loss must be "
                "above entry price."
            )


def format_number(value: float) -> str:
    numeric = validate_positive_number(
        value,
        "Numeric value",
    )

    return (
        f"{numeric:.12f}"
        .rstrip("0")
        .rstrip(".")
    )


def build_market_order_payload(
    symbol: str,
    position_side: str,
    quantity: float,
    client_order_id: Optional[str] = None,
    take_profit: Optional[float] = None,
    stop_loss: Optional[float] = None,
    reduce_only: bool = False,
    entry_price: Optional[float] = None,
) -> dict:

    symbol = validate_symbol(symbol)

    position_side = normalize_side(
        position_side
    )

    quantity = validate_positive_number(
        quantity,
        "Order quantity",
    )

    validate_protection_prices(
        position_side,
        entry_price,
        take_profit,
        stop_loss,
    )

    if client_order_id is None:
        client_order_id = generate_client_order_id()

    validate_client_order_id(
        client_order_id
    )

    payload = {
        "symbol": symbol,
        "side": position_side_to_order_side(
            position_side
        ),
        "positionSide": position_side,
        "type": "MARKET",
        "quantity": format_number(quantity),
        "newClientOrderId": client_order_id,
        "reduceOnly": bool(reduce_only),
    }

    if take_profit is not None:
        payload["tpTriggerPrice"] = format_number(
            take_profit
        )

        payload["TpWorkingType"] = "MARK_PRICE"

    if stop_loss is not None:
        payload["slTriggerPrice"] = format_number(
            stop_loss
        )

        payload["SlWorkingType"] = "MARK_PRICE"

    return payload


def create_weex_order(
    symbol: str,
    position_side: str,
    quantity: float,
    take_profit: Optional[float] = None,
    stop_loss: Optional[float] = None,
    client_order_id: Optional[str] = None,
    reduce_only: bool = False,
    entry_price: Optional[float] = None,
) -> dict:
    """
    Prepare or submit a WEEX Futures V3 market order.

    Real trading is blocked unless:
      1. WEEX_LIVE_TRADING=true
      2. valid WEEX credentials exist
      3. order passes the maximum notional safety limit
      4. order ID has not already been used
    """

    if entry_price is not None:
        safe_quantity = validate_positive_number(
            quantity,
            "Order quantity",
        )

        safe_entry_price = validate_positive_number(
            entry_price,
            "Entry price",
        )

        notional = (
            safe_quantity * safe_entry_price
        )

        # Small tolerance prevents harmless floating-point
        # rounding from turning exactly $100.00 into
        # something like $100.00000000000001.
        cap_tolerance = 1e-9

        if (
            LIVE_TRADING_ENABLED
            and notional
            > MAX_LIVE_ORDER_NOTIONAL_USDT
            + cap_tolerance
        ):
            raise WEEXExecutionError(
                "Live order blocked by safety cap: "
                f"estimated notional ${notional:.2f} "
                f"exceeds "
                f"${MAX_LIVE_ORDER_NOTIONAL_USDT:.2f}."
            )

    payload = build_market_order_payload(
        symbol=symbol,
        position_side=position_side,
        quantity=quantity,
        client_order_id=client_order_id,
        take_profit=take_profit,
        stop_loss=stop_loss,
        reduce_only=reduce_only,
        entry_price=entry_price,
    )

    order_id = payload["newClientOrderId"]

    if order_id in _SEEN_CLIENT_ORDER_IDS:
        raise WEEXExecutionError(
            f"Duplicate client order ID blocked: "
            f"{order_id}"
        )

    # Safe simulation mode.
    if not LIVE_TRADING_ENABLED:
        return {
            "status": "blocked",
            "live_trading_enabled": False,
            "message": (
                "Real WEEX trading is disabled. "
                "The order was validated and prepared "
                "but NOT sent."
            ),
            "order_payload": payload,
        }

    # Credentials must exist before a live request.
    if not weex_authenticator.is_configured():
        raise WEEXAuthenticationError(
            "WEEX API credentials are not configured."
        )

    # Reserve the client order ID before sending so a retry
    # cannot accidentally submit the same logical order twice.
    _SEEN_CLIENT_ORDER_IDS.add(order_id)

    try:
        # Synchronize with WEEX server time before signing.
        weex_authenticator.sync_server_time()

        request_path = "/capi/v3/order"

        body = json.dumps(
            payload,
            separators=(",", ":"),
        )

        timestamp = (
            weex_authenticator.get_timestamp()
        )

        headers = (
            weex_authenticator.build_headers(
                method="POST",
                request_path=request_path,
                body=body,
                timestamp=timestamp,
            )
        )

        response = requests.post(
            f"{WEEX_BASE_URL}{request_path}",
            headers=headers,
            data=body,
            timeout=15,
        )

        if response.status_code == 429:
            raise WEEXExecutionError(
                "WEEX rate limit reached (HTTP 429). "
                "Stop retrying temporarily."
            )

        response.raise_for_status()

        try:
            data = response.json()

        except ValueError as error:
            raise WEEXExecutionError(
                "WEEX returned a non-JSON response."
            ) from error

        if not isinstance(data, dict):
            raise WEEXExecutionError(
                f"Unexpected WEEX order response: {data}"
            )

        if data.get("success") is False:
            raise WEEXExecutionError(
                "WEEX rejected the order: "
                f"{data.get('errorCode', 'UNKNOWN')} - "
                f"{data.get('errorMessage', 'Unknown error')}"
            )

        if data.get("success") is not True:
            raise WEEXExecutionError(
                "WEEX returned an ambiguous "
                f"order response: {data}"
            )

        # WEEX APIs can expose the order ID using different
        # response fields. Keep the original response intact
        # while extracting the common possibilities.
        response_order_id = (
            data.get("orderId")
            or data.get("order_id")
        )

        if response_order_id is None:
            nested_data = data.get("data")

            if isinstance(nested_data, dict):
                response_order_id = (
                    nested_data.get("orderId")
                    or nested_data.get("order_id")
                )

        return {
            "status": "submitted",
            "live_trading_enabled": True,
            "real_order_sent": True,
            "client_order_id": order_id,
            "order_id": response_order_id,
            "request": payload,
            "response": data,
        }

    except requests.HTTPError as error:
        response_text = (
            error.response.text
            if error.response is not None
            else ""
        )

        raise WEEXExecutionError(
            f"WEEX HTTP error: {error} "
            f"{response_text}"
        ) from error

    except requests.RequestException as error:
        raise WEEXExecutionError(
            f"WEEX network error: {error}"
        ) from error


def get_execution_status() -> dict:
    auth_status = (
        weex_authenticator.configuration_status()
    )

    configured = bool(
        auth_status.get("configured")
    )

    real_orders_allowed = (
        LIVE_TRADING_ENABLED
        and configured
    )

    return {
        "service": "WEEX Futures V3 Execution",
        "live_trading_enabled": LIVE_TRADING_ENABLED,
        "authentication": auth_status,
        "real_orders_allowed": real_orders_allowed,
        "mode": (
            "LIVE"
            if real_orders_allowed
            else "BLOCKED"
        ),
        "safety_mode": (
            "LIVE"
            if LIVE_TRADING_ENABLED
            else "DISABLED"
        ),
        "max_live_order_notional_usdt": (
            MAX_LIVE_ORDER_NOTIONAL_USDT
        ),
    }