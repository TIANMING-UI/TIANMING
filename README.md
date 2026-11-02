# 天命 Tianming ($MING)

A presale only `.ai` agents can join. Fair mint on BNB Smart Chain for wallets holding a Binance `.ai` Agent ID, automatic PancakeSwap listing at share 5,000, LP burned forever.

> Independent project, not affiliated with Binance. Not an investment offer. Contracts are not audited yet.

## How it works

| | |
|---|---|
| Who can mint | Only wallets holding a `.ai` Agent ID. After listing, anyone can buy and sell on PancakeSwap. |
| Price | 2 USDT per share, the same for every share |
| Quota | 5 shares per wallet, max 5 per transaction. No referral. |
| Listing | Share 5,000 creates the PancakeSwap $MING/USDT pool in the same transaction |
| USDT split | 95% to the pool, 5% to the treasury wallet (constant) |
| Liquidity | LP tokens sent to `0x…dEaD` |
| Missed target | No listing within 10 days → every payer calls `refund()` for 100% |
| Trade fee | 2% on pool buys/sells, all to the treasury wallet (funds development and the team). No burn. Wallet transfers 0%. |
| Admin | No owner, no pause, no blacklist, no team withdraw |
| Team allocation | **0%.** The contract has no team or builder tokens. |

### Supply: 100,000,000,000 $MING

| | Amount | Share |
|---|---|---|
| Minters | 16,000,000 per share × 5,000 | 80% |
| PancakeSwap pool | 4,000,000 per share × 5,000 | 20% |
| Team | none | 0% |

## Repo

```
contracts/      TianmingMint.sol (mint, auto pool, refund)
                TianmingToken.sol (fixed supply, 2% trade fee)
                mocks/ (local + testnet only)
test/           12 unit tests
test-fork/      7 tests against real BSC mainnet contracts (fork)
scripts/        deploy-testnet.js · grant-testnet.js · deploy-mainnet.js · verify.js
web/            website (GitHub Pages) + deployments.json
tools/          build_web.py (builds web/index.html from the design file)
```

## Develop

```bash
npm install
npm test                       # 12 tests

# full flow on a local chain
npm run node                   # terminal 1
npm run deploy:local           # terminal 2
npm run serve                  # open http://localhost:8080/?net=local
```

## Testnet

```bash
cp .env.example .env           # DEPLOYER_KEY of a test wallet with tBNB
npm run deploy:testnet         # mock Agent ID + mock USDT + real PancakeSwap testnet
ADDR=0xYourWallet npm run grant:testnet
```
Open the site with `?net=testnet`.

## Mainnet (run from your own computer)

1. Create a dedicated treasury wallet for `TREASURY` (fixed forever at deploy).
2. Fill `.env`: `DEPLOYER_KEY` (deploy-only wallet with a little BNB), `TREASURY`, `BSCSCAN_API_KEY`.
3. `npm run deploy:mainnet` → read the summary.
4. `CONFIRM=TIANMING npm run deploy:mainnet` → deploys, writes `deployments/bsc.json`, `web/deployments.json`. The site and the agent prompt pick up the address automatically.
5. `npm run verify:mainnet`
6. Commit and push → GitHub Pages publishes the live site.

## Security

See [SECURITY.md](SECURITY.md). Never commit `.env` or private keys.
