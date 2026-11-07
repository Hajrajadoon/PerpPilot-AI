
import subprocess
from fastapi import APIRouter, HTTPException, Query

from backend.app.services.dreamdex_market import get_perp_markets
from backend.app.services.dreamdex_candles import get_perp_candles


router = APIRouter(
    prefix="/api/dreamdex",
    tags=["DreamDEX Perps"],
)


@router.get("/markets")
def dreamdex_markets():
    try:
        return get_perp_markets()

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="DreamDEX market request timed out.",
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"DreamDEX market data error: {str(error)}",
        )


@router.get("/candles")
def dreamdex_candles(
    symbol: str = Query(default="BTC-PERP"),
    interval: str = Query(default="15m"),
    limit: int = Query(default=100, ge=10, le=500),
):
    try:
        return get_perp_candles(
            symbol=symbol,
            interval=interval,
            limit=limit,
        )

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="DreamDEX candle request timed out.",
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"DreamDEX candle data error: {str(error)}",
        )

# Read-only DreamDEX bot status check.
import os
import json
from pathlib import Path
from dotenv import load_dotenv

_BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(_BACKEND_DIR / ".env", override=False)

_BOT_STATUS_SCRIPT = _BACKEND_DIR / "dreamdex" / "bot-status.mjs"


@router.get("/bot/status")
def dreamdex_bot_status():
    if not _BOT_STATUS_SCRIPT.exists():
        raise HTTPException(status_code=500, detail="Bot status script is missing.")

    try:
        result = subprocess.run(
            ["node", str(_BOT_STATUS_SCRIPT)],
            cwd=str(_BOT_STATUS_SCRIPT.parent),
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
        )
        if result.returncode != 0:
            raise HTTPException(
                status_code=502,
                detail="Bot status check failed. Check the backend terminal for details.",
            )
        return json.loads(result.stdout)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Bot status check timed out.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=502, detail="Bot status returned an invalid response.")