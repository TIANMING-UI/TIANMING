// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TIANMING token
/// @notice Fixed supply, no owner, no blacklist.
///   - The entire supply is minted once to the mint contract.
///   - Transfers are locked until the mint contract opens the pool (not the team).
///   - Once the pool opens, anyone can buy/sell on PancakeSwap:
///       * 2% fee on buys & sells, all of it to the treasury;
///       * wallet-to-wallet transfers have 0% fee.
///   - The fee percentage and treasury address cannot be changed after deploy.
contract TianmingToken is ERC20 {
    uint256 public constant FEE_BPS = 200; // 2%, all to the treasury

    address public immutable minter;
    address public immutable treasury;
    address public pair;
    bool public tradingOpen;

    error Locked();
    error OnlyMinter();

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 supply,
        address minter_,
        address treasury_
    ) ERC20(name_, symbol_) {
        minter = minter_;
        treasury = treasury_;
        _mint(minter_, supply);
    }

    /// @notice Called once by the mint contract when the pool is created.
    function openTrading(address pair_) external {
        if (msg.sender != minter || tradingOpen) revert OnlyMinter();
        pair = pair_;
        tradingOpen = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (!tradingOpen) {
            if (from != minter && from != address(0)) revert Locked();
            super._update(from, to, value);
            return;
        }

        bool isBuy = from == pair;
        bool isSell = to == pair;

        // Fee applies only to buys/sells; the mint contract (pool creation, claims) is exempt.
        if ((isBuy || isSell) && from != minter && to != minter) {
            uint256 feeAmt = (value * FEE_BPS) / 10_000;
            if (feeAmt > 0) super._update(from, treasury, feeAmt);
            value -= feeAmt;
        }
        super._update(from, to, value);
    }
}
