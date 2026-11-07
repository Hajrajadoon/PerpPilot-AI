
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
