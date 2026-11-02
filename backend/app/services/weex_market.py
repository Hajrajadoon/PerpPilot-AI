import math

import requests

WEEX_BASE_URL = "https://api-contract.weex.com"

SUPPORTED_SYMBOLS = [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "DOGEUSDT",
    "XRPUSDT",
    "ADAUSDT",
    "BNBUSDT",
    "LTCUSDT",
]


def _safe_float(value, field_name: str) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError) as error:
        raise ValueError(f"WEEX returned invalid {field_name}: {value}") from error
    if not math.isfinite(number):
        raise ValueError(f"WEEX returned invalid {field_name}: {value}")
    return number


def _validate_symbol(symbol: str) -> str:
    symbol = symbol.upper().strip()
    if symbol not in SUPPORTED_SYMBOLS:
        raise ValueError(
            f"Unsupported symbol. Choose from: {', '.join(SUPPORTED_SYMBOLS)}"
        )
    return symbol


def get_ticker(symbol: str = "BTCUSDT") -> dict:
    symbol = _validate_symbol(symbol)

    ticker_response = requests.get(
        f"{WEEX_BASE_URL}/capi/v3/market/ticker/24hr",
        params={"symbol": symbol},
        timeout=10,
    )
    ticker_response.raise_for_status()
    data = ticker_response.json()

    if isinstance(data, list):
        if not data:
            raise ValueError("WEEX returned an empty ticker response.")
        data = data[0]
    if not isinstance(data, dict):
        raise ValueError(f"Unexpected WEEX ticker response: {data}")

    book_response = requests.get(
        f"{WEEX_BASE_URL}/capi/v3/market/ticker/bookTicker",
        params={"symbol": symbol},
        timeout=10,
    )
    book_response.raise_for_status()
    book_data = book_response.json()

    if isinstance(book_data, list):
        book_data = book_data[0] if book_data else {}
    if not isinstance(book_data, dict):
        raise ValueError(f"Unexpected WEEX book ticker response: {book_data}")

    return {
        "symbol": data.get("symbol", symbol),
        "last_price": _safe_float(data.get("lastPrice", 0), "last price"),
        "best_bid": _safe_float(book_data.get("bidPrice", 0), "best bid"),
        "best_ask": _safe_float(book_data.get("askPrice", 0), "best ask"),
        "high_24h": _safe_float(data.get("highPrice", 0), "24h high"),
        "low_24h": _safe_float(data.get("lowPrice", 0), "24h low"),
        "volume_24h": _safe_float(data.get("quoteVolume", 0), "24h volume"),
        "price_change_percent": _safe_float(data.get("priceChangePercent", 0), "price change"),
        "mark_price": _safe_float(data.get("markPrice", 0), "mark price"),
        "index_price": _safe_float(data.get("indexPrice", 0), "index price"),
        "timestamp": int(data.get("closeTime", 0)),
        "bid_quantity": _safe_float(book_data.get("bidQty", 0), "bid quantity"),
        "ask_quantity": _safe_float(book_data.get("askQty", 0), "ask quantity"),
        "book_timestamp": int(book_data.get("time", 0)),
    }


def get_candles(symbol: str = "BTCUSDT", interval: str = "15m", limit: int = 100) -> list:
    symbol = _validate_symbol(symbol)
    allowed_intervals = ["1m", "5m", "15m", "30m", "1h", "4h", "12h", "1d", "1w"]
    if interval not in allowed_intervals:
        raise ValueError(
            f"Unsupported interval. Choose from: {', '.join(allowed_intervals)}"
        )

    limit = max(10, min(int(limit), 1000))
    response = requests.get(
        f"{WEEX_BASE_URL}/capi/v3/market/klines",
        params={"symbol": symbol, "interval": interval, "limit": limit},
        timeout=10,
    )
    response.raise_for_status()
    raw_data = response.json()

    if not isinstance(raw_data, list):
        raise ValueError(f"Unexpected WEEX candle response: {raw_data}")

    candles = []
    for item in raw_data:
        if not isinstance(item, list) or len(item) < 6:
            continue
        candles.append({
            "time": int(item[0]),
            "open": _safe_float(item[1], "candle open"),
            "high": _safe_float(item[2], "candle high"),
            "low": _safe_float(item[3], "candle low"),
            "close": _safe_float(item[4], "candle close"),
            "volume": _safe_float(item[5], "candle volume"),
        })

    candles.sort(key=lambda candle: candle["time"])
    if not candles:
        raise ValueError("WEEX returned no usable candle data.")
    return candles
