# Repo cleanup before submitting

Delete or ignore these files so judges see a clean PerpPilot repository:

- `PerpPilot-AI.zip` (an archive of the project inside the project)
- `aegistrade-ai-logo.png` (old project logo; the new one is `frontend/public/perppilot-logo.svg`)
- `ws-test.cjs`
- `frontend/package-before-day3.json`, `frontend/package-lock-before-day3.json`
- `frontend/read-account-test.mjs` (or move it into a `scripts/` folder and mention it)
- `backend/app/services/weex_*.py` and the WEEX parts of `backend/app/api/trading.py` are leftovers from an earlier project; they are not used by PerpPilot. Remove them only if the backend still starts afterwards (`uvicorn backend.app.main:app`).

Commands (PowerShell, from the repo root):

```
git rm --cached PerpPilot-AI.zip
del PerpPilot-AI.zip, ws-test.cjs, aegistrade-ai-logo.png
del frontend\package-before-day3.json, frontend\package-lock-before-day3.json
```

Do not commit `.env` files. `.gitignore` already excludes them.
