import json
import os
import secrets
import sqlite3
import subprocess
import time
from pathlib import Path

from dotenv import load_dotenv
from fastapi import APIRouter, HTTPException

from backend.app.services.dreamdex_market import get_perp_markets

router = APIRouter(prefix="/api/dreamdex/bot", tags=["DreamDEX Bot"])

BACKEND_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_DIR / ".env", override=False)

SCRIPT = BACKEND_DIR / "dreamdex" / "bot-execute.mjs"
DATA_DIR = BACKEND_DIR / "data"
DB_PATH = DATA_DIR / "bot-authorizations.sqlite3"

EXPECTED_OWNER = "0x893946f0479115b49d49D0A030838609749F9a10"
EXPECTED_REQUESTER = "0x35d5CfCdcacaBF2d50b534a2E50098b5Da192BF6"
EXPECTED_BOT = "0x34E65aA7867c03F26483f5663aCb5308119D6324"
CHAIN_ID = 50383


def db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=15)
    connection.execute("""
        CREATE TABLE IF NOT EXISTS authorizations (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            used INTEGER NOT NULL DEFAULT 0
        )
    """)
    connection.commit()
    return connection


def config():
    owner = os.getenv("DREAMDEX_OWNER_ADDRESS", "").strip()
    requester = os.getenv("DREAMDEX_REQUESTER_ADDRESS", "").strip()
    if owner.lower() != EXPECTED_OWNER.lower():
        raise HTTPException(503, "DreamDEX owner configuration is incorrect.")
    if requester.lower() != EXPECTED_REQUESTER.lower():
        raise HTTPException(503, "MetaMask requester configuration is incorrect.")
    if not os.getenv("DREAMDEX_BOT_PRIVATE_KEY", "").strip():
        raise HTTPException(503, "Bot signer is not configured.")
    return owner, requester


def find_market(symbol):
    result = get_perp_markets()
    markets = result.get("markets", []) if isinstance(result, dict) else result
    market = next(
        (item for item in markets if item.get("symbol", "").upper() == symbol.upper()),
        None,
    )
    if not market:
        raise HTTPException(404, "Market not found.")
    if int(market.get("chainId", 0)) != CHAIN_ID:
        raise HTTPException(400, "Market is not on Somnia Hideki Testnet.")
    return market


TYPES = {
    "BotAuthorization": [
        {"name": "action", "type": "string"},
        {"name": "symbol", "type": "string"},
        {"name": "isBid", "type": "bool"},
        {"name": "price", "type": "uint256"},
        {"name": "quantity", "type": "uint256"},
        {"name": "orderId", "type": "uint128"},
        {"name": "nonce", "type": "bytes32"},
        {"name": "expiresAt", "type": "uint64"},
        {"name": "requester", "type": "address"},
        {"name": "owner", "type": "address"},
        {"name": "bot", "type": "address"},
        {"name": "pool", "type": "address"},
        {"name": "chainId", "type": "uint256"},
    ]
}


@router.post("/challenge")
def create_challenge(body: dict):
    owner, requester = config()

    action = str(body.get("action", "")).lower()
    symbol = str(body.get("symbol", "")).upper()
    if action not in ("place", "cancel"):
        raise HTTPException(400, "Unsupported bot action.")

    market = find_market(symbol)
    pool = market.get("poolAddress")
    if not pool:
        raise HTTPException(400, "Market pool address is missing.")

    is_bid = bool(body.get("isBid", False))
    price = int(body.get("priceRaw", 0) or 0)
    quantity = int(body.get("quantityRaw", 0) or 0)
    order_id = int(body.get("orderId", 0) or 0)

    if action == "place":
        if price <= 0 or quantity <= 0:
            raise HTTPException(400, "Order price and quantity must be positive.")
        tick = int(market.get("tickSize") or 0)
        lot = int(market.get("lotSize") or 0)
        minimum = int(market.get("minQuantity") or 0)
        if not tick or not lot or price % tick:
            raise HTTPException(400, "Order price does not match the market tick size.")
        if quantity < minimum or quantity % lot:
            raise HTTPException(400, "Order quantity does not match the market minimum or lot size.")
    else:
        if order_id <= 0:
            raise HTTPException(400, "A valid order ID is required.")

    expires_at = int(time.time()) + 120
    nonce = "0x" + secrets.token_hex(32)
    challenge_id = secrets.token_urlsafe(32)

    typed_data = {
        "domain": {
            "name": "PerpPilot",
            "version": "1",
            "chainId": CHAIN_ID,
            "verifyingContract": pool,
        },
        "types": TYPES,
        "primaryType": "BotAuthorization",
        "message": {
            "action": action,
            "symbol": symbol,
            "isBid": is_bid,
            "price": str(price),
            "quantity": str(quantity),
            "orderId": str(order_id),
            "nonce": nonce,
            "expiresAt": expires_at,
            "requester": requester,
            "owner": owner,
            "bot": EXPECTED_BOT,
            "pool": pool,
            "chainId": CHAIN_ID,
        },
    }

    stored = {
        "typedData": typed_data,
        "market": market,
        "action": action,
    }

    connection = db()
    try:
        connection.execute(
            "INSERT INTO authorizations(id,payload,expires_at,used) VALUES(?,?,?,0)",
            (challenge_id, json.dumps(stored), expires_at),
        )
        connection.commit()
    finally:
        connection.close()

    return {
        "challengeId": challenge_id,
        "expiresAt": expires_at,
        "typedData": typed_data,
    }


@router.post("/execute")
def execute_authorized_action(body: dict):
    config()

    challenge_id = str(body.get("challengeId", ""))
    signature = str(body.get("signature", ""))
    if not challenge_id or not signature.startswith("0x"):
        raise HTTPException(400, "Challenge ID and signature are required.")

    connection = db()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT payload, expires_at, used FROM authorizations WHERE id=?",
            (challenge_id,),
        ).fetchone()

        if not row:
            connection.rollback()
            raise HTTPException(404, "Authorization challenge not found.")
        if row[2]:
            connection.rollback()
            raise HTTPException(409, "This authorization has already been used.")
        if int(row[1]) < int(time.time()):
            connection.execute(
                "UPDATE authorizations SET used=1 WHERE id=?",
                (challenge_id,),
            )
            connection.commit()
            raise HTTPException(410, "Authorization expired. Request a new one.")

        payload = json.loads(row[0])
        connection.execute(
            "UPDATE authorizations SET used=1 WHERE id=? AND used=0",
            (challenge_id,),
        )
        connection.commit()
    finally:
        connection.close()

    if not SCRIPT.exists():
        raise HTTPException(500, "Bot execution script is missing.")

    try:
        result = subprocess.run(
            ["node", str(SCRIPT)],
            cwd=str(SCRIPT.parent),
            input=json.dumps({
                **payload,
                "signature": signature,
            }),
            env=os.environ.copy(),
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "Bot execution timed out. Check the chain before retrying.")

    if result.returncode != 0:
        # Do not return environment data or private-key-related diagnostics.
        detail = result.stderr.strip()[-1200:] or "Bot execution failed."
        raise HTTPException(502, detail)

    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        raise HTTPException(502, "Bot returned an invalid transaction response.")
