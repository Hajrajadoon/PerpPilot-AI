from dataclasses import dataclass
import math


@dataclass
class RiskResult:
    balance: float
    risk_percent: float
    risk_amount: float
    entry_price: float
    stop_loss_price: float
    take_profit_price: float
    risk_per_unit: float
    position_size: float
    potential_loss: float
    potential_profit: float
    risk_reward_ratio: float


def calculate_trade_risk(
    balance: float,
    entry_price: float,
    side: str,
    risk_percent: float = 1.0,
    stop_loss_percent: float = 1.0,
    take_profit_percent: float = 2.0,
) -> RiskResult:
    side = side.upper().strip()

    if side not in {"LONG", "SHORT"}:
        raise ValueError("Side must be LONG or SHORT.")

    values = {
        "Balance": balance,
        "Entry price": entry_price,
        "Risk percentage": risk_percent,
        "Stop loss percentage": stop_loss_percent,
        "Take profit percentage": take_profit_percent,
    }
    for name, value in values.items():
        if not math.isfinite(float(value)):
            raise ValueError(f"{name} must be a finite number.")

    if balance <= 0:
        raise ValueError("Balance must be greater than zero.")
    if entry_price <= 0:
        raise ValueError("Entry price must be greater than zero.")
    if not 0 < risk_percent <= 5:
        raise ValueError("Risk percentage must be between 0 and 5.")
    if not 0 < stop_loss_percent <= 20:
        raise ValueError("Stop loss percentage must be between 0 and 20.")
    if not 0 < take_profit_percent <= 50:
        raise ValueError("Take profit percentage must be between 0 and 50.")

    risk_amount = balance * (risk_percent / 100)

    if side == "LONG":
        stop_loss_price = entry_price * (1 - stop_loss_percent / 100)
        take_profit_price = entry_price * (1 + take_profit_percent / 100)
    else:
        stop_loss_price = entry_price * (1 + stop_loss_percent / 100)
        take_profit_price = entry_price * (1 - take_profit_percent / 100)

    risk_per_unit = abs(entry_price - stop_loss_price)
    if risk_per_unit <= 0:
        raise ValueError("Stop-loss distance must be greater than zero.")

    position_size = risk_amount / risk_per_unit
    potential_loss = position_size * risk_per_unit
    reward_per_unit = abs(take_profit_price - entry_price)
    potential_profit = position_size * reward_per_unit
    risk_reward_ratio = potential_profit / potential_loss

    return RiskResult(
        balance=round(balance, 2),
        risk_percent=round(risk_percent, 2),
        risk_amount=round(risk_amount, 2),
        entry_price=round(entry_price, 4),
        stop_loss_price=round(stop_loss_price, 4),
        take_profit_price=round(take_profit_price, 4),
        risk_per_unit=round(risk_per_unit, 6),
        position_size=round(position_size, 6),
        potential_loss=round(potential_loss, 2),
        potential_profit=round(potential_profit, 2),
        risk_reward_ratio=round(risk_reward_ratio, 2),
    )
