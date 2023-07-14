pragma solidity 0.6.2;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/lib/contracts/libraries/TransferHelper.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import "./IUniswapV2Router02.sol";


import "./IWETH.sol";

contract AsapSwap is Initializable, OwnableUpgradeSafe, PausableUpgradeSafe {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    using Address for address;

    IUniswapV2Router02 internal uniswapRouter;

    enum Status {
        SUCCESS,
        FAILED
    }

    enum SwapType {
        ETH_TO_ERC20,
        ERC20_TO_ETH,
        ERC20_TO_ERC20
    }

    struct Swap {
        uint256 fromTokenAmount;
        uint256 toTokenAmount;
        address payable trader;
        address fromContractAddress;
        address toContractAddress;
        SwapType swapType;
        Status status;
    }

    /// WETH contract address
    address private constant ETH_ADDRESS =
        address(
            //main net
            //0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

            //goerli
            0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
        );
    address private constant UNISWAP_ROUTER_ADDRESS =
        address(
            //main net
            //0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

            // goerli
            0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
        );

    address private constant UNISWAP_FACTORY_ADDRESS =
        address(
            //main net
            //0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f

            // goerli
            0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f
        );

    // FEE percentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
    uint256 private constant DEFAULT_FEE_PERCENTAGE = 10;
    uint256 private constant MAIN_WALLET_PERCENTAGE = 85;
    uint256 private constant ASSIST_WALLET_PERCENTAGE = 15;
    uint256 private constant DEFAULT_SLIPPAGE_PERCENTAGE = 10;
    uint256 private constant MINI_ETHER = 1000000000000000; // 0.01 ether
    //Global swap id. Also give total number of swaps made so far
    uint256 private _swapId;

    mapping(uint256 => Swap) private _swaps;
    mapping(address => uint256) private _userFees;
    //Wallet where fees will go
    address payable private _feesAdminWallet;
    address payable private _feesAssistWallet;

    /// swap id, trader
    event DoSwap(uint256  id, address indexed trader);
    event AdminWalletChanged(address indexed wallet);
    event AssistWalletChanged(address indexed wallet);
    event UserFeeChanged(address user, uint256 fee);

    modifier onlyContract(address account) {
        require(
            account.isContract(),
            "[Validation] The address does not contain a contract"
        );
        _;
    }

    modifier onlySuccessSwaps(uint256 id) {
        Swap memory swap = _swaps[id];
        require(swap.status == Status.FAILED);
        _;
    }

    /**
     * @dev initialize
     */
    function initialize (
        address payable adminWallet,
        address payable assistWallet
    ) public{
        __AsapSwap_init(adminWallet, assistWallet);
    }

    function __AsapSwap_init(
        address payable adminWallet,
        address payable assistWallet
    ) internal initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Pausable_init_unchained();
        __AsapSwap_init_unchained(adminWallet, assistWallet);

        uniswapRouter = IUniswapV2Router02(UNISWAP_ROUTER_ADDRESS);
    }

    function __AsapSwap_init_unchained(
        address payable adminWallet,
        address payable assistWallet
    ) internal initializer {
        require(
            adminWallet != address(0),
            "[Validation] adminWallet is the zero address"
        );
        require(
            assistWallet != address(0),
            "[Validation] assistWallet is the zero address"
        );

        _feesAdminWallet = adminWallet;
        _feesAssistWallet = assistWallet;
    }

    /**
     * @dev Called by an admin to pause, triggers stopped state.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Called by an admin to unpause, returns to normal state.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Allows admin to set fee receiver wallet
     * @param wallet New wallet address
     */
    function setAdminFeeWallet(address payable wallet) external onlyOwner {
        require(
            wallet != address(0),
            "[Validation] feesWallet is the zero address"
        );
        _feesAdminWallet = wallet;

        emit AdminWalletChanged(wallet);
    }

    /**
     * @dev Allows admin to set fee receiver wallet
     * @param wallet New wallet address
     */
    function setAssistWallet(address payable wallet) external onlyOwner {
        require(
            wallet != address(0),
            "[Validation] devWallet is the zero address"
        );
        _feesAssistWallet = wallet;

        emit AssistWalletChanged(wallet);
    }

    function setUserFee(address wallet, uint256 fee) external onlyOwner {
        _userFees[wallet] = fee;

        emit UserFeeChanged(wallet, fee);
    }

    function getFee(uint256 amount) public view returns (uint256) {
        uint256 _feePercentage = DEFAULT_FEE_PERCENTAGE;
        
        if (_userFees[msg.sender]>0)
            _feePercentage = _userFees[msg.sender];

        //_ethFeePercentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
        return amount.mul(_feePercentage).div(1000); // 1%
    }

    function _distributeFees(address payer, uint256 fee) private {
        uint256 admin_fee = fee.mul(MAIN_WALLET_PERCENTAGE).div(100); //85%
        uint256 assit_fee = fee.mul(ASSIST_WALLET_PERCENTAGE).div(100); //15%
        TransferHelper.safeTransferFrom(
            ETH_ADDRESS,
            payer,
            _feesAdminWallet,
            admin_fee
        );

        TransferHelper.safeTransferFrom(
            ETH_ADDRESS,
            payer,
            _feesAssistWallet,
            assit_fee
        );
    }

    // fromTokenAmount : if fromTokenContract is weth , this value is ether amount. if not, this value should be token amount.
    // fromTokenContract :
    // toTokenContract
    /// limitPrice : this value is token amount for 0.01 eth.
    /// limitFee : maxFeePerGas in GWei
    function swap(
        uint256 fromTokenAmount,
        address fromTokenContract,
        address toTokenContract,
        uint256 limitPrice,
        uint256 limitFee,
        uint256 limitTax
    ) external payable whenNotPaused {
        require(
            fromTokenAmount > 0,
            "[Validation] The trade amount has to be larger than 0"
        );
        require(
            ETH_ADDRESS == fromTokenContract || ETH_ADDRESS == toTokenContract,
            "[Validation] only accept swap with weth."
        );
        if (ETH_ADDRESS == fromTokenContract) {
            _swapEthToToken(
                fromTokenAmount,
                toTokenContract,
                limitPrice,
                limitFee,
                limitTax
            );
        } else if (ETH_ADDRESS == toTokenContract) {
            _swapTokenToEth(
                fromTokenAmount,
                fromTokenContract,
                limitPrice,
                limitFee,
                limitTax
            );
        }
    }

    function _swapEthToToken(
        uint256 ethAmount,
        address toTokenContract,
        uint256 minOutput,
        uint256 limitFee,
        uint256 limitTax
    ) private whenNotPaused onlyContract(toTokenContract) {
        require(msg.value >= ethAmount, "[Validation] Enough ETH not sent");
        require(
            ethAmount > 0,
            "[Validation] The ETH amount has to be larger than 0"
        );

        uint256 totalfeeInSwap = getFee(ethAmount);
        if (limitFee > 0) // check limit fee
        {
            require(
                totalfeeInSwap < limitFee,
                "[Validation] Swap fee is too high"
            );
        }
        uint256 buyAmount = ethAmount - totalfeeInSwap;
        uint256 _estimatedTokenAmount = getEstimatedERC20forETH(
            buyAmount,
            toTokenContract
        );
        if (minOutput > 0) {
            require(
                minOutput < _estimatedTokenAmount,
                "[Validation] Token price is too high "
            );
        }

        // check tax
        if (limitTax > 0) {}

        // Transfer the ERC20 funds from the ERC20 trader to the ETH trader.
        IERC20 tokenContract = IERC20(toTokenContract);
        require(
            _estimatedTokenAmount <=
                tokenContract.allowance(msg.sender, address(this)),
            "[Validation] Allowance is not enough "
        );
// send eth to pair contract
            IWETH(ETH_ADDRESS).deposit{value: buyAmount}();
            assert(
                IWETH(ETH_ADDRESS).transfer(
                    pairFor(
                        ETH_ADDRESS,
                        toTokenContract
                    ),
                    buyAmount
                )
            );

            // token balance before swap
            uint balanceBefore = IERC20(toTokenContract).balanceOf(msg.sender);

        /// swap
        {
            
            (address input, address output) = (ETH_ADDRESS, toTokenContract);
            (address token0, ) = sortTokens(input, output);
            IUniswapV2Pair pair = IUniswapV2Pair(
                pairFor( input, output)
            );
            uint amountInput;
            uint amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint reserve0, uint reserve1, ) = pair.getReserves();
                (uint reserveInput, uint reserveOutput) = input == token0
                    ? (reserve0, reserve1)
                    : (reserve1, reserve0);
                amountInput = IERC20(input).balanceOf(address(pair)).sub(
                    reserveInput
                );
                amountOutput = getAmountOut(
                    amountInput,
                    reserveInput,
                    reserveOutput
                );
            }
            (uint amount0Out, uint amount1Out) = input == token0
                ? (uint(0), amountOutput)
                : (amountOutput, uint(0));

            pair.swap(amount0Out, amount1Out, msg.sender, new bytes(0));

        }
            require(
                tokenContract.balanceOf(msg.sender).sub(
                    balanceBefore
                ) >= minOutput,
                "INSUFFICIENT_OUTPUT_AMOUNT"
            );
        _distributeFees(msg.sender, totalfeeInSwap);

        _swapId = _swapId.add(1);
        _swaps[_swapId] = Swap({
            fromTokenAmount: ethAmount,
            toTokenAmount: 0,
            trader: msg.sender,
            fromContractAddress: ETH_ADDRESS,
            toContractAddress: toTokenContract,
            swapType: SwapType.ETH_TO_ERC20,
            status: Status.SUCCESS
        });
        emit DoSwap(_swapId, msg.sender);
    }

    function _swapTokenToEth(
        uint256 tokenAmount,
        address fromTokenContract,
        uint256 minOutput,
        uint256 limitFee,
        uint256 limitTax
    ) private whenNotPaused onlyContract(fromTokenContract) {
        require(
            tokenAmount > 0,
            "[Validation] The ERC-20 amount has to be larger than 0"
        );

        uint256 _estimateEthOut = getEstimatedETHforERC20(
            tokenAmount,
            fromTokenContract
        );
        uint256 totalfeeInSwap = getFee(_estimateEthOut);
        if (minOutput > 0) {
            require(
                minOutput < _estimateEthOut - totalfeeInSwap,
                "[Validation] Token price is too low "
            );
        }
        // Transfer value from the opening trader to this contract.
        uint256 ethOut = 0;
        {
            uint beforeSwap = IERC20(ETH_ADDRESS).balanceOf(address(this));
            TransferHelper.safeTransferFrom(
                fromTokenContract,
                msg.sender,
                pairFor( ETH_ADDRESS, fromTokenContract),
                tokenAmount
            );

            (address input, address output) = (fromTokenContract, ETH_ADDRESS);
            (address token0, ) = sortTokens(input, output);
            IUniswapV2Pair pair = IUniswapV2Pair(
                pairFor( input, output)
            );
            uint amountInput;
            uint amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint reserve0, uint reserve1, ) = pair.getReserves();
                (uint reserveInput, uint reserveOutput) = input == token0
                    ? (reserve0, reserve1)
                    : (reserve1, reserve0);
                amountInput = IERC20(input).balanceOf(address(pair)).sub(
                    reserveInput
                );
                amountOutput = getAmountOut(
                    amountInput,
                    reserveInput,
                    reserveOutput
                );
            }
            (uint amount0Out, uint amount1Out) = input == token0
                ? (uint(0), amountOutput)
                : (amountOutput, uint(0));
            pair.swap(amount0Out, amount1Out, address(this), new bytes(0));

            ethOut = IERC20(ETH_ADDRESS).balanceOf(address(this)) - beforeSwap;
            require(ethOut >= minOutput, "INSUFFICIENT_OUTPUT_AMOUNT");
            IWETH(ETH_ADDRESS).withdraw(ethOut);
            totalfeeInSwap = getFee(ethOut);
            TransferHelper.safeTransferETH(msg.sender, ethOut - totalfeeInSwap);
        }

        _distributeFees(address(this), totalfeeInSwap);
        _swapId = _swapId.add(1);
        // Store the details of the swap.
        _swaps[_swapId] = Swap({
            fromTokenAmount: tokenAmount,
            toTokenAmount: ethOut - totalfeeInSwap,
            trader: msg.sender,
            fromContractAddress: fromTokenContract,
            toContractAddress: ETH_ADDRESS,
            swapType: SwapType.ERC20_TO_ETH,
            status: Status.SUCCESS
        });
        emit DoSwap(_swapId, msg.sender);
    }

    function check(
        uint256 id
    )
        external
        view
        returns (
            uint256 fromTokenAmount,
            address fromContractAddress,
            address trader,
            uint256 toTokenAmount,
            address toContractAddress,
            SwapType swapType,
            Status status
        )
    {
        Swap memory swapInfo = _swaps[id];
        return (
            swapInfo.fromTokenAmount,
            swapInfo.fromContractAddress,
            swapInfo.trader,
            swapInfo.toTokenAmount,
            swapInfo.toContractAddress,
            swapInfo.swapType,
            swapInfo.status
        );
    }


    function getAmountIn(
        uint amountOut,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountIn) {
        require(amountOut > 0, "ASAP BOT: INSUFFICIENT_OUTPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "ASAP BOT: INSUFFICIENT_LIQUIDITY"
        );
        uint numerator = reserveIn.mul(amountOut).mul(1000);
        uint denominator = reserveOut.sub(amountOut).mul(997);
        amountIn = (numerator / denominator).add(1);
    }

    // given an input amount of an asset and pair reserves, returns the maximum output amount of the other asset
    function getAmountOut(
        uint amountIn,
        uint reserveIn,
        uint reserveOut
    ) internal pure returns (uint amountOut) {
        require(amountIn > 0, "ASAP BOT: INSUFFICIENT_INPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "ASAP BOT: INSUFFICIENT_LIQUIDITY"
        );
        uint amountInWithFee = amountIn.mul(997);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(1000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }

    function getAmountsIn(
        uint amountOut,
        address[] memory path
    ) internal view returns (uint[] memory amounts) {
        require(path.length >= 2, "ASAP BOT: INVALID_PATH");
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        
            IUniswapV2Pair pair = IUniswapV2Pair(
                pairFor( path[0], path[1])
            );
        (uint reserve0, uint reserve1, ) = pair.getReserves();
        amounts[0] = getAmountIn(amounts[0], reserve0, reserve1);
    }

    // calculates the CREATE2 address for a pair without making any external calls
    function pairFor(
        address tokenA,
        address tokenB
    ) internal pure returns (address pair) {
        (address token0, address token1) = sortTokens(tokenA, tokenB);
        pair = address(
            uint(
                keccak256(
                    abi.encodePacked(
                        hex"ff",
                        UNISWAP_FACTORY_ADDRESS,
                        keccak256(abi.encodePacked(token0, token1)),
                        hex"96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f" // init code hash
                    )
                )
            )
        );
    }

    // returns sorted token addresses, used to handle return values from pairs sorted in this order
    function sortTokens(
        address tokenA,
        address tokenB
    ) internal pure returns (address token0, address token1) {
        require(tokenA != tokenB, "ASAP BOT: IDENTICAL_ADDRESSES");
        (token0, token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "ASAP BOT: ZERO_ADDRESS");
    }



  function getEstimatedETHforERC20(uint256 erc20Amount, address tokenAddress)
  public
  view
  returns (uint256 )
  {
    return getAmountsIn(erc20Amount, getPathForETHtoERC20(tokenAddress))[0];
  }

  function getPathForETHtoERC20(address tokenAddress)
  internal
  pure
  returns (address[] memory)
  {
    address[] memory path = new address[](2);
    path[0] = ETH_ADDRESS;
    path[1] = tokenAddress;
    return path;
  }

  function getEstimatedERC20forETH(uint256 etherAmount, address tokenAddress)
  public
  view
  returns (uint256 )
  {
    return getAmountsIn(etherAmount, getPathForERC20toETH(tokenAddress))[0];
  }

  function getPathForERC20toETH(address tokenAddress)
  internal
  pure
  returns (address[] memory)
  {
    address[] memory path = new address[](2);
    path[0] = tokenAddress;
    path[1] = ETH_ADDRESS;
    return path;
  }
}
