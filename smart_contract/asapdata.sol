/**
 * @title AsapSwap
 * @dev ContractDescription
 * @custom:dev-run-script browser/scripts/asap_swap.ts
 */
pragma solidity 0.6.2;
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";

contract AsapData is Initializable, OwnableUpgradeSafe, PausableUpgradeSafe {
   
    using Address for address;


    enum Status {SUCCESS,FAILED}

    enum SwapType {ETH_TO_ERC20,ERC20_TO_ETH,ERC20_TO_ERC20}

    struct Swap {
        uint256 fromTokenAmount;
        uint256 toTokenAmount;
        address payable trader;
        address fromContractAddress;
        address toContractAddress;
        SwapType swapType;
        Status status;
    }

    //Global swap id. Also give total number of swaps made so far
    uint256 private _swapId;
    //total volume of swap made by asap bot
    uint256 private _totalVolume;
    mapping(uint256 => Swap) private _swaps;
    mapping(address => uint256) private _userFees;

    // Proxy Contract
    address payable private _proxyContract;
    address payable private _swapContract;

    modifier onlyContract(address account) {
        require( account.isContract(), "[ASAP DATA Validation] The address does not contain a contract");
        _;
    }
    modifier onlyProxy(address account) {
        require( account.isContract(), "[ASAP DATA Validation] The address does not contain a contract");
        require( account == _proxyContract, "[ASAP DATA Validation] The address does not contain a contract");
        _;
    }
    modifier onlySwap(address account) {
        require( account.isContract(), "[ASAP DATA Validation] The address does not contain a contract");
        require( account == _swapContract, "[ASAP DATA Validation] The address does not contain a contract");
        _;
    }
    constructor(){

    }
    /**
     * @dev initialize
     */
    function initialize(
        address payable asapProxyContract,
        address payable asapSwapContract
    ) public {
        __AsapData_init(asapProxyContract, asapSwapContract);
    }

    function __AsapData_init(
        address payable asapProxyContract,
        address payable asapSwapContract
    ) internal initializer {
        _totalVolume = 0;
        _swapId = 0;
        __AsapData_init_unchained(asapProxyContract, asapSwapContract);
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Pausable_init_unchained();

    }

    function __AsapData_init_unchained(
        address payable asapProxyContract,
        address payable asapSwapContract
    ) internal initializer {
        require( asapProxyContract != address(0), "[ASAP DATA Validation] ProxyContract is the zero address");
        require( asapSwapContract != address(0), "[ASAP DATA Validation] SwapContract is the zero address");

        _proxyContract = adminWallet;
        _swapContract = assistWallet;
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
        require( wallet != address(0), "[Validation] feesWallet is the zero address" );
        _feesAdminWallet = wallet;
        emit AdminWalletChanged(wallet);
    }

    /**
     * @dev Allows admin to set fee receiver wallet
     * @param wallet New wallet address
     */
    function setAssistWallet(address payable wallet) external onlyOwner {
        require( wallet != address(0), "[Validation] devWallet is the zero address" );
        _feesAssistWallet = wallet;
        emit AssistWalletChanged(wallet);
    }

    function setUserFee(address wallet, uint256 fee) external onlyOwner {
        _userFees[wallet] = fee;

        emit UserFeeChanged(wallet, fee);
    }

    function checkFee(uint limitFee) internal view {
        uint256 _feePercentage = DEFAULT_FEE_PERCENTAGE;

        if (_userFees[msg.sender] > 0) _feePercentage = _userFees[msg.sender];
        require( limitFee >= _feePercentage, "[Validation] swapp fee of user looks higher than expected" );
    }

    function getFee(uint256 amount) public view returns (uint256) {
        uint256 _feePercentage = DEFAULT_FEE_PERCENTAGE;

        if (_userFees[msg.sender] > 0) _feePercentage = _userFees[msg.sender];

        //_ethFeePercentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
        return amount.mul(_feePercentage).div(1000); // 1%
    }

    function _distributeFees(uint256 fee) private {
        uint256 admin_fee = fee.mul(MAIN_WALLET_PERCENTAGE).div(100); //85%
        uint256 assit_fee = fee.mul(ASSIST_WALLET_PERCENTAGE).div(100); //15%
        TransferHelper.safeTransferETH(_feesAdminWallet, admin_fee);
        TransferHelper.safeTransferETH(_feesAssistWallet, assit_fee);
    }

    function SwapEthToToken(
        address tokenContract,
        uint256 limitPrice,
        uint256 limitFee,
        uint256 limitTax
    ) external payable whenNotPaused {
        require( msg.value > 0, "[Validation] The trade amount has to be larger than 0" );
        _swapEthToToken( msg.value, tokenContract, limitPrice, limitFee, limitTax );
    }

    function SwapTokenToEth(
        uint256 tokenAmount,
        address tokenContract,
        uint256 limitPrice,
        uint256 limitFee,
        uint256 limitTax
    ) external payable whenNotPaused {
        require(
            tokenAmount > 0,
            "[Validation] The trade amount has to be larger than 0"
        );
        _swapTokenToEth( tokenAmount, tokenContract, limitPrice, limitFee, limitTax );
    }

    function _swapEthToToken(
        uint256 ethAmount,
        address toTokenContract,
        uint256 minOutput,
        uint256 limitFee,
        uint256 limitTax
    ) private whenNotPaused onlyContract(toTokenContract) {
            uint256 totalfeeInSwap = getFee(ethAmount);
            if (limitFee > 0) // check limit fee
            {
                checkFee(limitFee);
            }
            uint256 buyAmount = ethAmount.sub(totalfeeInSwap);
            _totalVolume = _totalVolume.add(buyAmount);
            uint256 _estimatedTokenAmount = getEstimatedERC20forETH( buyAmount, toTokenContract);
            if (minOutput > 0) {
                require( minOutput < _estimatedTokenAmount, "[Validation] Token price is too high ");
            }
            IERC20 tokenContract = IERC20(toTokenContract);
            // send eth to pair contract
            IWETH(ETH_ADDRESS).deposit{value: buyAmount}();
            assert(
                IWETH(ETH_ADDRESS).transfer( pairFor(ETH_ADDRESS, toTokenContract), buyAmount)
            );
            // token balance before swap
            uint balanceBefore = tokenContract.balanceOf(msg.sender);
            /// swap
            {
                (address input, address output) = (ETH_ADDRESS, toTokenContract);
                (address token0, ) = sortTokens(input, output);
                IUniswapV2Pair pair = IUniswapV2Pair(pairFor(input, output));
                uint amountInput;
                uint amountOutput;
                {
                    // scope to avoid stack too deep errors
                    (uint reserveInput, uint reserveOutput) = getReserves( input, output);
                    amountInput = IERC20(input).balanceOf(address(pair)).sub( reserveInput);
                    amountOutput = getAmountOut( amountInput, reserveInput, reserveOutput);
                }
                (uint amount0Out, uint amount1Out) = ETH_ADDRESS == token0 ? (uint(0), amountOutput) : (amountOutput, uint(0));
                pair.swap(amount0Out, amount1Out, msg.sender, new bytes(0));
            }
            uint outTokenAmount = tokenContract.balanceOf(msg.sender).sub(balanceBefore);
            if( minOutput>0){
                require( outTokenAmount >= minOutput, "ASAP BOT : swapped token amount is less that minimum expect");
            }
            // check tax
            if (limitTax > 0) {
                require( _estimatedTokenAmount.sub(outTokenAmount).mul(10000).div(_estimatedTokenAmount) >= limitTax, "ASAP BOT : Tax is higher than expected");
            }
            _distributeFees(totalfeeInSwap);
            _swapId = _swapId.add(1);
            _swaps[_swapId] = Swap({ fromTokenAmount: ethAmount, toTokenAmount: 0, trader: msg.sender, fromContractAddress: ETH_ADDRESS, toContractAddress: toTokenContract, swapType: SwapType.ETH_TO_ERC20, status: Status.SUCCESS });
            emit DoSwap(_swapId, msg.sender);
    }

    function _swapTokenToEth(
        uint256 tokenAmount,
        address fromTokenContract,
        uint256 minOutput,
        uint256 limitFee,
        uint256 limitTax
    ) private whenNotPaused onlyContract(fromTokenContract) {
        require( tokenAmount > 0, "[Validation] The ERC-20 amount has to be larger than 0");
        if (limitFee > 0) // check limit fee
        {
            checkFee(limitFee);
        }
        uint256 _estimateEthOut = getEstimatedETHforERC20( tokenAmount, fromTokenContract);
        if (minOutput > 0) {
            require( minOutput < _estimateEthOut - getFee(_estimateEthOut), "[Validation] Token price is too low ");
        }

        IUniswapV2Pair pair =  IUniswapV2Pair(pairFor(fromTokenContract, ETH_ADDRESS));
        emit BeforeSwap(IERC20(ETH_ADDRESS).balanceOf(address(pair)));
        TransferHelper.safeTransferFrom(
            fromTokenContract, msg.sender, address(pair), tokenAmount
        );
        emit AfterTransfer(IERC20(ETH_ADDRESS).balanceOf(address(pair)));
        
        uint256 beforeSwap = IERC20(ETH_ADDRESS).balanceOf(address(this));
        // swap ether for tokens
        {
            (address token0, ) = sortTokens(fromTokenContract, ETH_ADDRESS);
            // scope to avoid stack too deep errors
            (uint reserveInput, uint reserveOutput) = getReserves( fromTokenContract, ETH_ADDRESS);
            uint amountInput = IERC20(fromTokenContract).balanceOf(address(pair)).sub(reserveInput);
            uint amountOutput = getAmountOut( amountInput, reserveInput, reserveOutput);
            (uint amount0Out, uint amount1Out) = fromTokenContract == token0? (uint(0), amountOutput): (amountOutput, uint(0));
            pair.swap(amount0Out, amount1Out, address(this), new bytes(0));
        }
        emit AfterSwap(IERC20(ETH_ADDRESS).balanceOf(address(pair)));
        // withdraw ether for tokens
        uint256 ethOut=0;
        {
            ethOut = IERC20(ETH_ADDRESS).balanceOf(address(this)) - beforeSwap;
            require( ethOut >= minOutput, "ASAP BOT: Swapped ether amount is less than minimum expect");
            IWETH(ETH_ADDRESS).withdraw(ethOut);
           _totalVolume = _totalVolume.add(ethOut);
            uint256 swapFee =  getFee(ethOut);
            ethOut = ethOut - swapFee;
             
            TransferHelper.safeTransferETH(msg.sender, ethOut);
            _distributeFees(swapFee);
        }
        // check tax
        if (limitTax > 0) {
            require( _estimateEthOut.sub(ethOut).mul(10000).div(_estimateEthOut) >= limitTax, "ASAP BOT : Tax is higher than expected");
        }
        _swapId = _swapId.add(1);
        // Store the details of the swap.
        _swaps[_swapId] = Swap({fromTokenAmount: tokenAmount, toTokenAmount: ethOut, trader: msg.sender, fromContractAddress: fromTokenContract, toContractAddress: ETH_ADDRESS, swapType: SwapType.ERC20_TO_ETH, status: Status.SUCCESS });
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
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "ASAP BOT: INSUFFICIENT_OUTPUT_AMOUNT");
        require(
            reserveIn > 0 && reserveOut > 0,
            "ASAP BOT: INSUFFICIENT_LIQUIDITY"
        );
        uint256 numerator = reserveIn.mul(amountOut).mul(1000);
        uint256 denominator = reserveOut.sub(amountOut).mul(997);
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
        uint256 amountOut,
        address[] memory path
    ) internal view returns (uint256[] memory amounts) {
        require(path.length >= 2, "ASAP BOT: INVALID_PATH");
        amounts = new uint256[](path.length);
        amounts[amounts.length - 1] = amountOut;

        //IUniswapV2Pair pair = IUniswapV2Pair(pairFor(path[0], path[1]));
        (uint256 reserve0, uint256 reserve1) = getReserves(path[0], path[1]);
        amounts[0] = getAmountIn(amounts[1], reserve0, reserve1);
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

    function getEstimatedETHforERC20(
        uint256 erc20Amount,
        address tokenAddress
    ) public view returns (uint256) {
        //return getAmountsIn(erc20Amount, getPathForETHtoERC20(tokenAddress))[0];

        uint256 _estimatedEthAmountFor1000token = getAmountsIn(
            1000,
            getPathForERC20toETH(tokenAddress)
        )[0];

        uint256 _estimatedTokenAmount = _estimatedEthAmountFor1000token
            .mul(erc20Amount)
            .div(1000); //.div(1 ether);
        return _estimatedTokenAmount;
    }

    function getPathForETHtoERC20(
        address tokenAddress
    ) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = ETH_ADDRESS;
        path[1] = tokenAddress;
        return path;
    }

    function getEstimatedERC20forETH(
        uint256 etherAmount,
        address tokenAddress
    ) public view returns (uint256) {
        uint256 _estimatedTokenAmountFor1Eth = getAmountsIn(
            1,
            getPathForETHtoERC20(tokenAddress)
        )[0];

        uint256 _estimatedTokenAmount = _estimatedTokenAmountFor1Eth.mul(
            etherAmount
        ); //.div(1 ether);
        return _estimatedTokenAmount;
    }

    function totalVolume() public view returns(uint256){
        return _totalVolume;
    }
    function tradeAmount() public view returns(uint256){
        return _swapId;
    }
    function getPathForERC20toETH(
        address tokenAddress
    ) internal pure returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = tokenAddress;
        path[1] = ETH_ADDRESS;
        return path;
    }

    function getReserves(
        address tokenA,
        address tokenB
    ) internal view returns (uint reserveA, uint reserveB) {
        (address token0, ) = sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1, ) = IUniswapV2Pair(
            pairFor(tokenA, tokenB)
        ).getReserves();
        (reserveA, reserveB) = tokenA == token0
            ? (reserve0, reserve1)
            : (reserve1, reserve0);
    }
    
    receive() external payable {
        assert(msg.sender == ETH_ADDRESS); // only accept ETH via fallback from the WETH contract
    }
    fallback() external payable {}
}
