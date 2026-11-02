import subprocess
import json
from pathlib import Path

DREAMDEX_DIR = Path(__file__).resolve().parents[2] / "dreamdex"
SCRIPT_PATH = DREAMDEX_DIR / "markets-json.mjs"

INTERVALS = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
}


def get_perp_candles(symbol="BTC-PERP", interval="15m", limit=100):
    symbol = symbol.upper().strip()
    interval = interval.lower().strip()

    if interval not in INTERVALS:
        raise ValueError("Unsupported interval. Use 1m, 5m, 15m, 1h, 4h, or 1d.")

    if not symbol.endswith("-PERP"):
        symbol = f"{symbol}-PERP"

    limit = max(10, min(int(limit), 500))

    result = subprocess.run(
        [
            "node",
            str(SCRIPT_PATH),
            "candles",
            symbol,
            str(INTERVALS[interval]),
            str(limit),
        ],
        cwd=str(DREAMDEX_DIR),
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "DreamDEX candle request failed.")

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Invalid DreamDEX candle response: {error}") from error

    if not isinstance(data.get("candles"), list):
        raise RuntimeError("DreamDEX returned an unexpected candle response.")

    return data
