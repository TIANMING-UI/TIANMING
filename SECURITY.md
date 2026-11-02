# Security

- Contracts have **no owner and no admin functions**. Nothing can be paused, changed or withdrawn by the team after deploy.
- The only addresses that receive funds are fixed at deploy: the PancakeSwap pair (95% USDT + LP burned), and the treasury wallet (5% USDT + 2% trade fee). There is no team or builder allocation.
- Always check the mint contract address on this site before sending funds. Ignore anyone in DMs offering another address.
- Known limits: sells via router must use the fee-on-transfer swap functions.
- Not audited by a third party yet. Please report issues privately to security@tianming.xyz before disclosing them.
