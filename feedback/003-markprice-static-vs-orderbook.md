# Perp market mark price appears frozen while the order book and candles move
Severity: normal
Area: API

## Steps to reproduce
1. Load the perp market list (`listPerpMarkets` data as exposed through the market feed) and note the BTC-PERP mark price.
2. Read top of book with `client.getBookTopsOnchain` and recent candles for the same market.
3. Re-read the market list 10 to 15 minutes later.

## Expected
The mark price follows the price feed closely, or the response includes a timestamp showing when the mark was last updated.

## Actual
In one session the BTC-PERP mark price stayed at exactly 80,375.4788 across two reads taken about 13 minutes apart (11:56 and 12:09 local), while the best bid moved to 80,804.10 and best ask to 80,812.40, a gap of about 0.5% above the mark. The page's other markets (for example ZRO, LIT, VVV, ZEC) also showed identical marks across those reads.

## Evidence
- Reads at 11:56:29 and 12:09:01: Mark 80,375.4788 both times.
- Top of book at 12:09: bid 80,804.10 / ask 80,812.40.
- Screenshots: `feedback/evidence/003-mark-vs-book.png` (add before submitting)

## Environment
SDK version: @somnia-chain/markets-sdk 0.32.1
Network: Somnia Tokyo testnet (Hideki, chain 50383)
Wallet address: `<paste full address>`
