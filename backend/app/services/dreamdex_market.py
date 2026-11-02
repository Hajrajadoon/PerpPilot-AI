import json
import subprocess
from pathlib import Path


DREAMDEX_DIR = Path(__file__).resolve().parents[2] / "dreamdex"
SCRIPT_PATH = DREAMDEX_DIR / "markets-json.mjs"


def get_perp_markets():
    if not SCRIPT_PATH.exists():
        raise RuntimeError("DreamDEX market bridge script was not found.")

    result = subprocess.run(
        ["node", str(SCRIPT_PATH)],
        cwd=str(DREAMDEX_DIR),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip() or "DreamDEX SDK request failed."
        )

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError(
            f"Invalid response from DreamDEX SDK: {error}"
        ) from error

    if not isinstance(data.get("markets"), list):
        raise RuntimeError("DreamDEX returned an unexpected market response.")

    return data
