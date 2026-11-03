# Security

- Contracts have **no owner and no admin functions**. Nothing can be paused, changed or withdrawn by the team after deploy.
- The only addresses that receive funds are fixed at deploy: the PancakeSwap pair (95% USDT + LP burned), and the treasury wallet (5% USDT + 2% trade fee). There is no team or builder allocation.
- Official contracts (source verified on BscScan):
  - Mint `0xE26a505CE2Ec77140D30f7b4684b31fbB5812f2b`
  - $MING `0xFED9Eab43aFa900BD24055CDef39d0F5b7d34844`
- Always check the mint contract address on tianming.xyz before sending funds. Ignore anyone in DMs offering another address.

## Review status

- **Not audited by a third party.**
- Internal reviews, including an independent adversarial pass with malicious USDT, registry, pair and factory contracts: no critical, high or medium findings. Guarantees checked: mint only for `.ai` Agent ID holders and only inside `OPEN_AT..DEADLINE`; 100% refund for every minter after a missed deadline with nothing to the treasury; refund only for wallets that minted, once; no refund after the pool opens; no claim/owner/pause/withdraw/rescue path.
- Regression tests: `test/AuditProperties.test.js`, `test/TianmingMint.test.js`, `test-fork/fork.test.js`.
- `.ai` Agent ID transfer probe against the live registry (fork): `transferFrom` by the holder reverts, so an ID cannot be moved between wallets. `test-fork/agentid-probe.test.js` fails if this ever changes.

## Known limits

- Quota is per wallet, not per person.
- Sells must use the router's `...SupportingFeeOnTransferTokens` functions; a plain sell reverts. Third-party liquidity adds pay the 2% fee on the $MING side.
- The treasury is a single-key wallet, not a multisig.
- USDT or $MING sent directly to the mint contract is locked forever (there is no rescue function).
- The minter of the last share pays the gas for creating the pool (several million gas).

Please report issues privately through GitHub (Security tab → "Report a vulnerability") before disclosing them.
