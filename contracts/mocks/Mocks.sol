// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockUSDT is ERC20 {
    constructor() ERC20("Tether", "USDT") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
}

contract MockAgentId {
    mapping(address => uint256) public balanceOf;
    function give(address a) external { balanceOf[a] = 1; }
}

/// Simple UniswapV2-like pair: mint() uses balance - reserve.
contract MockPair is ERC20 {
    address public token0;
    address public token1;
    uint256 public reserve0;
    uint256 public reserve1;
    constructor(address a, address b) ERC20("LP", "LP") { token0 = a; token1 = b; }
    /// test helper: mimics a pair sending tokens out on a swap (buy)
    function swapOut(address token, address to, uint256 amount) external {
        IERC20(token).transfer(to, amount);
    }
    function getReserves() external view returns (uint112, uint112, uint32) {
        return (uint112(reserve0), uint112(reserve1), 0);
    }
    function sync() external {
        reserve0 = IERC20(token0).balanceOf(address(this));
        reserve1 = IERC20(token1).balanceOf(address(this));
    }
    function mint(address to) external returns (uint256 liq) {
        uint256 b0 = IERC20(token0).balanceOf(address(this));
        uint256 b1 = IERC20(token1).balanceOf(address(this));
        uint256 a0 = b0 - reserve0;
        uint256 a1 = b1 - reserve1;
        require(totalSupply() == 0, "only first");
        liq = _sqrt(a0 * a1) - 1000;
        _mint(address(0xdead), 1000);
        _mint(to, liq);
        reserve0 = b0; reserve1 = b1;
    }
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) { z = y; uint256 x = y / 2 + 1; while (x < z) { z = x; x = (y / x + x) / 2; } } else if (y != 0) z = 1;
    }
}

contract MockFactory {
    mapping(address => mapping(address => address)) public getPair;
    function createPair(address a, address b) external returns (address p) {
        p = address(new MockPair(a, b));
        getPair[a][b] = p; getPair[b][a] = p;
    }
}
