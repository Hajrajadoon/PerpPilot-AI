from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from backend.app.services.paper_trading import paper_engine
from backend.app.services.risk_manager import calculate_trade_risk
from backend.app.services.weex_auth import (
    WEEXAuthenticationError,
    weex_authenticator,
)
from backend.app.services.weex_execution import (
    WEEXExecutionError,
    create_weex_order,
    get_execution_status,
)

router = APIRouter(prefix="/api/trading", tags=["Trading"])


class RiskRequest(BaseModel):
    balance: float = Field(default=10000, gt=0)
    entry_price: float = Field(gt=0)
    side: str
    risk_percent: float = Field(default=1.0, gt=0, le=5)
    stop_loss_percent: float = Field(default=1.0, gt=0, le=20)
    take_profit_percent: float = Field(default=2.0, gt=0, le=50)


@router.post("/risk/calculate")
def calculate_risk(request: RiskRequest):
    try:
        result = calculate_trade_risk(
            balance=request.balance,
            entry_price=request.entry_price,
            side=request.side,
            risk_percent=request.risk_percent,
            stop_loss_percent=request.stop_loss_percent,
            take_profit_percent=request.take_profit_percent,
        )

        return {
            "status": "success",
            "risk": result.__dict__,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


class OpenTradeRequest(BaseModel):
    symbol: str = "BTCUSDT"
    side: str
    entry_price: float = Field(gt=0)
    quantity: float = Field(gt=0)
    stop_loss: float = Field(gt=0)
    take_profit: float = Field(gt=0)
    confidence: float = Field(default=50, ge=0, le=100)
    signal_reason: str = ""


class CloseTradeRequest(BaseModel):
    symbol: str = "BTCUSDT"
    exit_price: float = Field(gt=0)
    reason: str = "MANUAL"


@router.post("/paper/open")
def open_paper_trade(request: OpenTradeRequest):
    try:
        position = paper_engine.open_position(
            symbol=request.symbol,
            side=request.side,
            entry_price=request.entry_price,
            quantity=request.quantity,
            stop_loss=request.stop_loss,
            take_profit=request.take_profit,
            confidence=request.confidence,
            signal_reason=request.signal_reason,
        )

        return {
            "status": "success",
            "message": "Paper trade opened.",
            "position": position,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.post("/paper/close")
def close_paper_trade(request: CloseTradeRequest):
    try:
        trade = paper_engine.close_position(
            symbol=request.symbol,
            exit_price=request.exit_price,
            reason=request.reason,
        )

        return {
            "status": "success",
            "message": "Paper trade closed.",
            "trade": trade,
        }

    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error


@router.get("/paper/status")
def paper_status():
    return paper_engine.get_status()


@router.post("/paper/reset")
def paper_reset():
    return paper_engine.reset()


# ------------------------------------------------------------------
# WEEX AUTHENTICATION
# ------------------------------------------------------------------

@router.get("/weex/auth/status")
def weex_auth_status():
    """
    Safe configuration check.

    This never returns the actual API key, secret key or passphrase.
    """
    return weex_authenticator.configuration_status()


@router.post("/weex/auth/prepare")
def prepare_weex_auth():
    """
    Day 6B authentication preparation.

    This checks backend credentials and synchronizes local time
    with the WEEX server. Secrets never leave the backend.
    """
    try:
        result = weex_authenticator.prepare()

        if not result.get("configured"):
            return {
                **result,
                "ready_for_live_orders": False,
            }

        if not result.get("server_time_synced"):
            return {
                **result,
                "ready_for_live_orders": False,
            }

        return {
            **result,
            "ready_for_live_orders": True,
        }

    except WEEXAuthenticationError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to synchronize WEEX server time: {error}",
        ) from error


# ------------------------------------------------------------------
# WEEX EXECUTION
# ------------------------------------------------------------------

@router.get("/weex/execution/status")
def weex_execution_status():
    return get_execution_status()


class WEEXOrderRequest(BaseModel):
    symbol: str = "BTCUSDT"
    position_side: str
    quantity: float = Field(gt=0)
    entry_price: Optional[float] = Field(default=None, gt=0)
    take_profit: Optional[float] = Field(default=None, gt=0)
    stop_loss: Optional[float] = Field(default=None, gt=0)
    client_order_id: Optional[str] = None
    reduce_only: bool = False


@router.post("/weex/order")
def create_weex_trade(request: WEEXOrderRequest):
    try:
        return create_weex_order(
            symbol=request.symbol,
            position_side=request.position_side,
            quantity=request.quantity,
            entry_price=request.entry_price,
            take_profit=request.take_profit,
            stop_loss=request.stop_loss,
            client_order_id=request.client_order_id,
            reduce_only=request.reduce_only,
        )

    except (
        ValueError,
        WEEXAuthenticationError,
        WEEXExecutionError,
    ) as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        ) from error

    except Exception as error:
        raise HTTPException(
            status_code=502,
            detail=f"WEEX execution error: {error}",
        ) from error