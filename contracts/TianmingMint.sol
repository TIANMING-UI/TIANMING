// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TianmingToken} from "./TianmingToken.sol";

interface IAgentIdRegistry {
    function balanceOf(address owner) external view returns (uint256);
}

interface IPancakeFactory {
    function getPair(address a, address b) external view returns (address);
    function createPair(address a, address b) external returns (address);
}

interface IPancakePair {
    function mint(address to) external returns (uint256 liquidity);
}

/// @title TianmingMint — 天命 fair mint exclusively for wallets holding a .ai Agent ID
/// @notice No owner, no pause, no team withdraw function.
///   Mint    : every share is paid. Price starts at BASE_PRICE and rises by
///             STEP_PRICE every STEP_SHARES shares. All USDT is held in the contract.
///   Token   : sent straight to the minter's wallet on mint, locked until the pool opens.
///   Target  : when share number TARGET_SHARES is minted, the contract creates the
///             PancakeSwap pool itself and sends the LP to the dead address.
///             The split is hardcoded: 95% of USDT to the pool, 5% to the treasury
///             (project development + airdrops for Agent ID holders).
///   Failure : if the target is not reached before DEADLINE, anyone
///             can refund 100% of their USDT. The team cannot take the funds.
///   Team    : no team token allocation. Supply = minter allocation + pool allocation.
contract TianmingMint is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------- configuration (immutable) ----------
    IAgentIdRegistry public immutable agentId;
    IERC20 public immutable usdt;
    IPancakeFactory public immutable factory;
    TianmingToken public immutable token;

    uint256 public immutable TARGET_SHARES;
    uint256 public immutable BASE_PRICE;         // tier 1 price, USDT with 18 decimals
    uint256 public immutable STEP_PRICE;         // increase per tier
    uint256 public immutable STEP_SHARES;        // tier size
    uint256 public immutable TOKENS_PER_SHARE;   // to the minter
    uint256 public immutable POOL_TOKENS_PER_SHARE; // reserved for the pool
    uint256 public immutable DEADLINE;

    address public immutable treasury;
    uint256 public constant TREASURY_BPS = 500; // 5%, immutable

    uint256 public constant BASE_QUOTA = 5;
    uint256 public constant MAX_PER_TX = 5;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    // ---------- state ----------
    uint256 public totalMinted;
    uint256 public parkedUsdt;
    bool public poolOpened;
    uint256 public openedAt;
    address public pair;

    mapping(address => uint256) public paidMinted;   // number of paid shares
    mapping(address => uint256) public paidUsdt;     // for refunds

    event Minted(address indexed user, uint256 shares, uint256 cost);
    event PoolOpened(address pair, uint256 usdtAmount, uint256 tokenAmount, uint256 liquidity);
    event TreasuryFunded(address indexed treasury, uint256 usdtAmount);
    event Refunded(address indexed user, uint256 amount);

    error NoAgent();
    error BadShares();
    error SoldOut();
    error Quota();
    error Ended();
    error NotFailed();
    error Nothing();

    struct Config {
        address agentIdRegistry;
        address usdt;
        address factory;
        string name;
        string symbol;
        uint256 targetShares;
        uint256 basePrice;
        uint256 stepPrice;
        uint256 stepShares;
        uint256 tokensPerShare;
        uint256 poolTokensPerShare;
        uint256 duration;      // seconds until the deadline
        address treasury;      // fixed forever at deploy
    }

    constructor(Config memory c) {
        require(c.targetShares > 0 && c.stepShares > 0 && c.basePrice > 0, "config");
        require(c.treasury != address(0), "treasury");
        agentId = IAgentIdRegistry(c.agentIdRegistry);
        usdt = IERC20(c.usdt);
        factory = IPancakeFactory(c.factory);
        TARGET_SHARES = c.targetShares;
        BASE_PRICE = c.basePrice;
        STEP_PRICE = c.stepPrice;
        STEP_SHARES = c.stepShares;
        TOKENS_PER_SHARE = c.tokensPerShare;
        POOL_TOKENS_PER_SHARE = c.poolTokensPerShare;
        DEADLINE = block.timestamp + c.duration;
        treasury = c.treasury;

        uint256 supply = c.targetShares * (c.tokensPerShare + c.poolTokensPerShare);
        token = new TianmingToken(c.name, c.symbol, supply, address(this), c.treasury);
    }

    // ---------- gate ----------
    function isAgent(address w) public view returns (bool) {
        return agentId.balanceOf(w) > 0;
    }

    modifier onlyAgent() {
        if (!isAgent(msg.sender)) revert NoAgent();
        _;
    }

    modifier live() {
        if (poolOpened || block.timestamp > DEADLINE) revert Ended();
        _;
    }

    // ---------- tiered pricing ----------
    /// @notice Price of the share with sequence number `serial` (starting at 1).
    function priceAt(uint256 serial) public view returns (uint256) {
        return BASE_PRICE + ((serial - 1) / STEP_SHARES) * STEP_PRICE;
    }

    /// @notice Total cost of the next `shares` shares. A transaction that crosses
    ///         a tier boundary pays each share's own price.
    function costOf(uint256 shares) public view returns (uint256 cost) {
        uint256 s = totalMinted;
        uint256 left = shares;
        while (left > 0) {
            uint256 tierEnd = (s / STEP_SHARES + 1) * STEP_SHARES; // last serial of this tier
            uint256 n = tierEnd - s;
            if (n > left) n = left;
            cost += n * priceAt(s + 1);
            s += n;
            left -= n;
        }
    }

    function currentPrice() external view returns (uint256) {
        return priceAt(totalMinted + 1);
    }

    // ---------- mint ----------
    function quotaOf(address) public pure returns (uint256) {
        return BASE_QUOTA;
    }

    function mint(uint256 shares) external nonReentrant live onlyAgent {
        if (shares == 0 || shares > MAX_PER_TX) revert BadShares();
        if (totalMinted + shares > TARGET_SHARES) revert SoldOut();
        if (paidMinted[msg.sender] + shares > quotaOf(msg.sender)) revert Quota();

        uint256 cost = costOf(shares);
        usdt.safeTransferFrom(msg.sender, address(this), cost);

        paidMinted[msg.sender] += shares;
        paidUsdt[msg.sender] += cost;
        parkedUsdt += cost;
        totalMinted += shares;

        // Tokens go straight to the minter's wallet. They are locked (cannot be
        // moved/sold) until the pool opens; after that they can be sold right away.
        IERC20(address(token)).safeTransfer(msg.sender, shares * TOKENS_PER_SHARE);

        emit Minted(msg.sender, shares, cost);

        if (totalMinted == TARGET_SHARES) _openPool();
    }

    // ---------- automatic pool ----------
    function _openPool() internal {
        poolOpened = true;
        openedAt = block.timestamp;
        address p = factory.getPair(address(token), address(usdt));
        if (p == address(0)) p = factory.createPair(address(token), address(usdt));
        pair = p;
        token.openTrading(p);

        uint256 tokenAmt = TARGET_SHARES * POOL_TOKENS_PER_SHARE;
        uint256 total = parkedUsdt;
        parkedUsdt = 0;
        uint256 treasuryAmt = (total * TREASURY_BPS) / 10_000;
        uint256 usdtAmt = total - treasuryAmt;
        // Send directly to the pair + mint LP to DEAD.
        // Resistant to USDT donations to the pair before the pool opens (cannot be DoSed via router quotes).
        IERC20(address(token)).safeTransfer(p, tokenAmt);
        usdt.safeTransfer(p, usdtAmt);
        uint256 liq = IPancakePair(p).mint(DEAD);
        emit PoolOpened(p, usdtAmt, tokenAmt, liq);
        if (treasuryAmt > 0) {
            usdt.safeTransfer(treasury, treasuryAmt);
            emit TreasuryFunded(treasury, treasuryAmt);
        }
    }

    // ---------- refund on failure ----------
    function failed() public view returns (bool) {
        return !poolOpened && block.timestamp > DEADLINE;
    }

    function refund() external nonReentrant {
        if (!failed()) revert NotFailed();
        uint256 amt = paidUsdt[msg.sender];
        if (amt == 0) revert Nothing();
        paidUsdt[msg.sender] = 0;
        parkedUsdt -= amt;
        usdt.safeTransfer(msg.sender, amt);
        emit Refunded(msg.sender, amt);
    }

    // ---------- views for web/agent ----------
    function overview()
        external
        view
        returns (
            uint256 minted,
            uint256 target,
            uint256 price,
            uint256 nextTierAt,
            uint256 usdtParked,
            bool opened,
            bool isFailed,
            uint256 deadline
        )
    {
        uint256 next = (totalMinted / STEP_SHARES + 1) * STEP_SHARES;
        if (next > TARGET_SHARES) next = TARGET_SHARES;
        return (totalMinted, TARGET_SHARES, priceAt(totalMinted + 1), next, parkedUsdt, poolOpened, failed(), DEADLINE);
    }

    function walletStatus(address w)
        external
        view
        returns (bool eligible, uint256 paid, uint256 quota, uint256 tokens, uint256 refundable)
    {
        return (isAgent(w), paidMinted[w], quotaOf(w), paidMinted[w] * TOKENS_PER_SHARE, failed() ? paidUsdt[w] : 0);
    }
}
