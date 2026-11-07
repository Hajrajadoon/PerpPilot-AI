# SDK 0.32.1 perp pool ABI has no placeOrderFor / cancelOrderFor, so linked bots cannot be used through the SDK
Severity: normal
Area: SDK

## Steps to reproduce
1. Install `@somnia-chain/markets-sdk@0.32.1`.
2. Load the perp pool write ABI used by `trader.placePerpOrder` and list its function names.
3. Look for `placeOrderFor` and `cancelOrderFor` (the functions a linked dreamDEX bot calls on the owner's behalf).
4. Read `client.isOperatorAuthorized(...)`, which exists and is documented.

## Expected
The SDK exposes the operator write path that its own `isOperatorAuthorized` read implies (for example `trader.placePerpOrderFor` / `cancelOrderFor`, or the ABI entries), so an app can trade for a user who linked a bot.

## Actual
The operator authorization read exists, but the perp write ABI only has `placeOrder` / `cancelOrder`. To trade through a linked bot an app has to hand-write the ABI. `isOperatorAuthorized` (in `operatorAuthorizationReadAbi`) takes a function selector, so the operator functions are clearly part of the protocol, but their ABI is not shipped.

## Evidence
- ABI inspection of `dist/tradeAbi.js` in SDK 0.32.1 (function names listed, no `placeOrderFor` for perps).
- Listing every exported ABI array in `dist/`: `placeOrder` and `cancelOrder` appear in `perpPoolWriteAbi`; `placeOrderFor` and `cancelOrderFor` appear in none; `isOperatorAuthorized` appears in `operatorAuthorizationReadAbi`.

## Environment
SDK version: @somnia-chain/markets-sdk 0.32.1
Network: Somnia Tokyo testnet (Hideki, chain 50383)
Wallet address: `<paste your MetaMask address>`
