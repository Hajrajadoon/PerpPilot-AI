# Contract error selectors can't be decoded from the SDK: 0x3e31dcc2 matches none of the shipped error ABIs
Severity: normal
Area: SDK

## Steps to reproduce
1. Install `@somnia-chain/markets-sdk@0.32.1`.
2. Collect every `type: "error"` item from the ABI arrays under `dist/` (1,097 definitions).
3. Compute `toFunctionSelector("Name(argtypes)")` for each, and compare with `0x3e31dcc2` (the revert data from a failing `claimPerpVoucher`).

## Expected
Every custom error a dreamDEX contract can raise is present in the SDK's ABIs (or in a published error table), so wallets and apps can show a readable reason.

## Actual
No definition matches. A builder only gets the raw selector, with no way to learn what the contract is rejecting, and cannot tell a user how to fix it.

## Evidence
- Search covered all error definitions in `dist/*.js` ABI exports and all error signatures found in `src/`, `docs/` and `README.md`.
- Revert data observed: `0x3e31dcc2` (see feedback 001).

## Environment
SDK version: @somnia-chain/markets-sdk 0.32.1
Network: Somnia Tokyo testnet (Hideki, chain 50383)
Wallet address: `<paste full address>`
