# Docs: no documented way for a new builder to get the first STT for gas on Hideki / Tokyo
Severity: normal
Area: docs

## Steps to reproduce
1. Start as a new builder with an EOA wallet and no testnet funds.
2. Follow the bounty page ("join the Perps Arena ... receive paper USDso") and the SDK docs.
3. Try to send any transaction (for example a voucher claim or an order).

## Expected
The onboarding docs say how to obtain STT on the Hideki/Tokyo network, since every write needs it for gas.

## Actual
- SDK docs state Hideki has no public faucet, and point to bridging from Shannon.
- The SDK's fixed gas ceiling (10,000,000 gas at 60 gwei) means the node and wallets require 0.6 STT free per write even though far less is charged. A wallet holding less shows "Network fee 0 STT" with a red alert and no clear reason.
- The bounty page explains USDso (Perps Arena) but not STT.

## Evidence
- MetaMask transaction request screenshot with "Network fee 0 STT" alert: `feedback/evidence/004-metamask-fee-alert.png` (add before submitting)
- SDK docs: `docs/how-to/get-testnet-funds.md` ("no public faucet") and `src/config.ts` (`DEFAULT_FEES`, fixed 10M gas ceiling).

## Environment
SDK version: @somnia-chain/markets-sdk 0.32.1
Network: Somnia Tokyo testnet (Hideki, chain 50383)
Wallet address: `<paste full address>`
