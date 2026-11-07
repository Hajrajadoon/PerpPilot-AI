# claimPerpVoucher reverts with custom error 0x3e31dcc2 although eligibility reports eligible
Severity: major
Area: contracts

## Steps to reproduce
1. Connect an EOA wallet (never claimed before) to Somnia Hideki / Tokyo testnet (chain 50383).
2. Read eligibility: `sdk.client.getPerpVoucherEligibility(marginBank, owner)`.
3. Read status: `sdk.client.getPerpVoucher(marginBank, owner)`.
4. Build the claim: `trader.buildClaimPerpVoucher({ marginBank })` and simulate it with `getViemClient().call({ account: owner, to, data, gas })`.
5. Send the real claim with `trader.claimPerpVoucher({ marginBank })`.

## Expected
Either the claim succeeds and credits the grant, or the eligibility read returns `eligible: false` with a reason.

## Actual
- Eligibility returns eligible with a grant of 1,000 USDso.
- Status returns `{ "claimed": false, "floor": "0", "expiresAt": "0" }`.
- The simulation and the real transaction both revert with the custom error selector `0x3e31dcc2`.
- The same revert happens on BTC-PERP and ETH-PERP margin banks.
- The selector does not match any of the 1,097 error definitions shipped in SDK 0.32.1, so it cannot be named from the SDK.
- A real transaction that reverted still consumed gas (wallet showed "Transaction failed on-chain: Custom error: 0x3e31dcc2").

## Evidence
- Revert data: `0x3e31dcc2`
- Wallet shows: "Failed transaction - Transaction failed on-chain: Custom error: 0x3e31dcc2"
- Screenshots: `feedback/evidence/001-claim-revert.png`, `feedback/evidence/001-eligibility.png` (add before submitting)
- Transaction hash of the failed claim: `<paste from explorer>`

## Environment
SDK version: @somnia-chain/markets-sdk 0.32.1
Network: Somnia Tokyo testnet (Hideki, chain 50383)
Wallet address: `<paste full address>`
