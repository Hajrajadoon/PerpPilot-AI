# Linked-bot setup and test checklist

PerpPilot places real orders for your **dreamDEX wallet** through a bot you link inside dreamDEX. MetaMask only signs a one-time authorization per action.

## 1. One-time setup
1. In <https://app.testnet.dreamdex.io> open your wallet panel and choose **Link a bot**.
2. Paste the bot address (the address of the key you generated for this app). Keep **Perps** enabled and let dreamDEX send the bot a little STT for gas.
3. Create `backend/.env` from `backend/.env.example` and fill in:
   - `DREAMDEX_BOT_PRIVATE_KEY`: the bot's private key (0x + 64 hex characters)
   - `DREAMDEX_OWNER_ADDRESS`: your dreamDEX wallet address (holds the margin)
   - `DREAMDEX_REQUESTER_ADDRESS`: the MetaMask account that may authorize actions
   - `SOMNIA_RPC_URL`: the Hideki RPC
4. `backend/.env` is git-ignored. Never commit it, paste it in a chat, or zip it for someone else.

## 2. Start
Terminal 1, from the project root:
```
.\venv\Scripts\Activate.ps1
uvicorn backend.app.main:app --reload
```
Terminal 2:
```
cd frontend
npm run dev
```

## 3. Check the backend first
Open <http://127.0.0.1:8000/api/dreamdex/bot/status>. You should see `"status": "ready"`, your owner address, the bot address, its STT balance, and `placeOrders` and `cancelOrders` both `true`. Nothing is sent by this check.

## 4. Test in the app
1. Connect MetaMask (the authorized account). The **Trading account** card shows your dreamDEX wallet, the bot and "place yes · cancel yes".
2. Press **Refresh**. Account equity should show your collateral (for example about 1,000).
3. Choose a market, **Buy / Long**, a price about 1% to 2% below the best bid, and a small quantity.
4. Click **Review & Sign Limit Order**, press OK. MetaMask shows a **signature request** (not a transaction). Sign.
5. After a few seconds the message says the order was sent and the **Transaction log** shows the hash. The order appears in **Your open orders**.
6. Click **Cancel**, sign again. The cancellation hash is added to the log and the order disappears.
7. Copy both hashes into the README "Order evidence" table.

## 5. If something fails
| Message | Meaning |
|---|---|
| Cannot reach the PerpPilot backend | Backend not running (Terminal 1) |
| Bot ... permission is not enabled for this market | Link a bot in dreamDEX and enable Perps for the bot |
| Bot configuration is incomplete / mismatch | `backend/.env` values missing or the key does not match the linked bot |
| Authorization expired | You took more than 2 minutes to sign; try again |
| DreamDEX rejected the order simulation | Check price tick, minimum size, margin and capacity |
| Signature rejected in MetaMask | You pressed Reject; nothing was sent |

## 6. Security notes
- The bot can place, cancel and reduce orders for your wallet. It cannot withdraw.
- Anyone who has the bot key can trade your account and spend the bot's gas. If the key was ever shared, unlink that bot in dreamDEX, generate a new key, link the new bot and update `backend/.env`.
- The backend API is meant for local use. Do not expose it to the internet without adding authentication.
