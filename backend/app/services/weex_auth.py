import base64
import hashlib
import hmac
import os
import time
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

WEEX_BASE_URL = os.getenv(
    "WEEX_BASE_URL",
    "https://api-contract.weex.com",
).rstrip("/")


class WEEXAuthenticationError(Exception):
    """Raised when WEEX authentication configuration is invalid."""


class WEEXAuthenticator:
    def __init__(self):
        self.api_key = os.getenv("WEEX_API_KEY", "").strip()
        self.secret_key = os.getenv("WEEX_SECRET_KEY", "").strip()
        self.passphrase = os.getenv("WEEX_PASSPHRASE", "").strip()
        self._server_time_offset_ms = 0

    def is_configured(self) -> bool:
        return bool(self.api_key and self.secret_key and self.passphrase)

    def configuration_status(self) -> dict:
        return {
            "configured": self.is_configured(),
            "api_key_present": bool(self.api_key),
            "secret_key_present": bool(self.secret_key),
            "passphrase_present": bool(self.passphrase),
        }

    def sync_server_time(self) -> int:
        response = requests.get(
            f"{WEEX_BASE_URL}/capi/v3/market/time",
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        server_time = self._extract_server_time(data)
        local_time = int(time.time() * 1000)
        self._server_time_offset_ms = server_time - local_time
        return server_time

    @staticmethod
    def _extract_server_time(data) -> int:
        if isinstance(data, (int, float)):
            return int(data)
        if isinstance(data, str):
            return int(data)
        if isinstance(data, dict):
            for key in ("serverTime", "server_time", "time", "timestamp"):
                value = data.get(key)
                if value is not None:
                    return int(value)
            if data.get("data") is not None:
                return WEEXAuthenticator._extract_server_time(data["data"])
        if isinstance(data, list) and data:
            return WEEXAuthenticator._extract_server_time(data[0])
        raise WEEXAuthenticationError(
            f"Unable to determine WEEX server time from response: {data}"
        )

    def get_timestamp(self) -> str:
        return str(int(time.time() * 1000) + self._server_time_offset_ms)

    def sign(
        self,
        timestamp: str,
        method: str,
        request_path: str,
        query_string: str = "",
        body: str = "",
    ) -> str:
        method = method.upper()
        message = f"{timestamp}{method}{request_path}"
        if query_string:
            message += f"?{query_string}"
        message += body

        digest = hmac.new(
            self.secret_key.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(digest).decode("utf-8")

    def build_headers(
        self,
        method: str,
        request_path: str,
        query_string: str = "",
        body: str = "",
        timestamp: Optional[str] = None,
    ) -> dict:
        if not self.is_configured():
            raise WEEXAuthenticationError(
                "WEEX API credentials are not configured. Set "
                "WEEX_API_KEY, WEEX_SECRET_KEY and WEEX_PASSPHRASE."
            )

        timestamp = timestamp or self.get_timestamp()
        signature = self.sign(
            timestamp=timestamp,
            method=method,
            request_path=request_path,
            query_string=query_string,
            body=body,
        )

        return {
            "ACCESS-KEY": self.api_key,
            "ACCESS-SIGN": signature,
            "ACCESS-PASSPHRASE": self.passphrase,
            "ACCESS-TIMESTAMP": timestamp,
            "Content-Type": "application/json",
        }

    def prepare(self) -> dict:
        if not self.is_configured():
            return {
                "configured": False,
                "server_time_synced": False,
                "message": "WEEX API credentials are not configured.",
            }

        try:
            server_time = self.sync_server_time()
            return {
                "configured": True,
                "server_time_synced": True,
                "server_time": server_time,
                "timestamp_offset_ms": self._server_time_offset_ms,
                "message": "WEEX authentication is ready.",
            }
        except Exception as error:
            return {
                "configured": True,
                "server_time_synced": False,
                "timestamp_offset_ms": self._server_time_offset_ms,
                "message": f"Server-time synchronization failed: {error}",
            }


weex_authenticator = WEEXAuthenticator()
