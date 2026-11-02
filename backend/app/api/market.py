from fastapi import APIRouter, HTTPException, Query

from backend.app.services.weex_market import (
    get_candles,
    get_ticker,
)


router = APIRouter(
    prefix="/api/market",
    tags=["Market Data"],
)


@router.get("/ticker")
def market_ticker(
    symbol: str = Query(
        default="BTCUSDT",
        description="WEEX futures symbol",
    )
):
    try:
        return get_ticker(symbol)

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"WEEX market data error: {str(error)}",
        )


@router.get("/candles")
def market_candles(
    symbol: str = Query(
        default="BTCUSDT",
        description="WEEX futures symbol",
    ),
    interval: str = Query(
        default="15m",
        description="Candle interval",
    ),
    limit: int = Query(
        default=100,
        ge=10,
        le=1000,
        description="Number of candles",
    ),
):
    try:
        return {
            "symbol": symbol.upper(),
            "interval": interval,
            "candles": get_candles(
                symbol=symbol,
                interval=interval,
                limit=limit,
            ),
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"WEEX candle data error: {str(error)}",
        )