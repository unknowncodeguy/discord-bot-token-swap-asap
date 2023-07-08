pragma solidity 0.6.2;

import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";
import "./IERC20Extended.sol";
import "./IUniswapV2Router02.sol";

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
    address constant private ETH_ADDRESS = address(
        0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2
    );
    address constant private UNISWAP_ROUTER_ADDRESS = address(
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    );

    // FEE percentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
    uint256 constant private DEFAULT_FEE_PERCENTAGE = 10; 
    uint256 constant private MAIN_WALLET_PERCENTAGE = 85;
    uint256 constant private ASSIST_WALLET_PERCENTAGE = 15;
    uint256 constant private DEFAULT_SLIPPAGE_PERCENTAGE = 10;
    //Global swap id. Also give total number of swaps made so far
    uint256 private _swapId;

    mapping (uint256 => Swap) private _swaps;

    //Wallet where fees will go
    address payable private _feesAdminWallet;
    address payable private _feesAssistWallet;


    /// swap id, trader
    event Swap(uint256 indexed id, address indexed trader);
    event AdminWalletChanged(address indexed wallet);
    event AssisWalletChanged(address indexed wallet);
    

    modifier onlyContract(address account)
    {
        require(account.isContract(), "[Validation] The address does not contain a contract");
        _;
    }

    modifier onlySuccessSwaps(uint256 id) {
        Swap memory swap = _swaps[id];
        require (swap.status == Status.FAILED);
        _;
    }

    /**
    * @dev initialize
    */
    function initialize(
        address payable adminWallet,
        address payable assistWallet
    )
        {
        __AsapSwap_init(adminWallet, assistWallet);
    }

    function __AsapSwap_init(
        address payable adminWallet,
        address payable assistWallet
    )
    internal
    initializer
    {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Pausable_init_unchained();
        __AsapSwap_init_unchained(adminWallet, assistWallet);

        uniswapRouter = IUniswapV2Router02(UNISWAP_ROUTER_ADDRESS);
    }

    function __AsapSwap_init_unchained(
        address payable adminWallet,
        address payable assistWallet
    )
    internal
    initializer
    {
        
        require(adminWallet != address(0), "[Validation] adminWallet is the zero address");
        require(assistWallet != address(0), "[Validation] assistWallet is the zero address");
       
        _feesAdminWallet = adminWallet;
        _feesAssistWallet = assistWallet;
       
    }

    /**
    * @dev Called by an admin to pause, triggers stopped state.
    */
    function pause()
    external
    onlyOwner 
    {
        _pause();
    }

    /**
    * @dev Called by an admin to unpause, returns to normal state.
    */
    function unpause()
    external
    onlyOwner
    {
        _unpause();
    }

  

    /**
    * @dev Allows admin to set fee receiver wallet
    * @param wallet New wallet address
    */
    function setAdminFeeWallet(address payable wallet)
    external
    onlyOwner
    {
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
    function setAssistWallet(address payable wallet)
    external
    onlyOwner
    {
        require(
            wallet != address(0),
            "[Validation] devWallet is the zero address"
        );
        _feesAssistWallet = wallet;

        emit AssisWalletChanged(wallet);
    }


    function getFee(uint256 amount, address token, address buyer)
    public
    view
    returns (uint256) 
    {
        //_ethFeePercentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
        return amount.mul(DEFAULT_FEE_PERCENTAGE).div(1000); 
    }

    

    function _distributeFees(uint256 fee)
    private
    {
        uint256 admin_fee = fee.mul(MAIN_WALLET_PERCENTAGE).div(100); //10%
        uint256 assit_fee = fee.mul(ASSIST_WALLET_PERCENTAGE).div(100); //10%

        _swapToken.safeTransferFrom(msg.sender, _feesAdminWallet, admin_fee);
        _swapToken.safeTransferFrom(msg.sender, _feesAssistWallet, assit_fee);
    }

    function swap(
        uint256 fromTokenAmount,
        address fromTokenContract,
        address toTokenContract
    )
    external
    payable
    whenNotPaused
    {
        require(fromTokenAmount > 0, "[Validation] The trade amount has to be larger than 0");

        if(ETH_ADDRESS == fromTokenContract)
        {
            _swapEthToToken(
                fromTokenAmount,
                toTokenContract
            );
        } 
        else if(ETH_ADDRESS == toTokenContract)
        {
            _swapTokenToEth(
                fromTokenAmount,
                fromTokenContract
            );
        }
        else
        {
            _swapTokenToToken(
                fromTokenAmount,
                fromTokenContract,
                toTokenContract
            );
        }
    }

    function _swapEthToToken(
        uint256 ethAmount,
        address toTokenContract
    )
    private
    whenNotPaused
    onlyContract(toTokenContract)
    {
        require(msg.value >= ethAmount, "[Validation] Enough ETH not sent");
        require(ethAmount > 0, "[Validation] The ETH amount has to be larger than 0");
        uint256 totalfeeInSwap = getFee(ethAmount, toTokenContract, _msgSender());
         _distributeFees(totalfeeInSwap);

        _swapId = _swapId.add(1);

        

        // Transfer the ERC20 funds from the ERC20 trader to the ETH trader.
        IERC20 tokenContract = IERC20(swap.toTokenContract);
        require(swap.closeValue <= erc20Contract.allowance(swap.closeTrader, address(this)));
        require(erc20Contract.transferFrom(swap.closeTrader, swap.openTrader, swap.closeValue));
        uniswapRouter.swapExactETHForTokensSupportingFeeOnTransferTokens(
				ethAmount,
				[ETH_ADDRESS, toTokenContract],
				_msgSender()
			);
            
        // Transfer the ETH funds from this contract to the ERC20 trader.
        swap.closeTrader.transfer(swap.openValue);

        // Store the details of the swap.
        _swaps[_swapId] = Swap({
            fromTokenAmount: ethAmount,
            toTokenAmount:0,
            trader: msg.sender,
            fromContractAddress: ETH_ADDRESS,
            toContractAddress: toTokenContract,

            swapType: SwapType.ETH_TO_ERC20,
            status: Status.OPEN
        });
        emit Swap(_swapId, msg.sender);
    }

    function _swapTokenToEth(
        uint256 tokenAmount,
        address fromTokenContract
    )
    private
    whenNotPaused
    onlyContract(fromTokenContract)
    {
        require(tokenAmount > 0, "[Validation] The ERC-20 amount has to be larger than 0");
        uint256 totalfeeInSwap = getFee(tokenAmount, fromTokenContract, _msgSender());
         _distributeFees(totalfeeInSwap);

       
        // Transfer value from the opening trader to this contract.
        IERC20 tokenContract = IERC20(fromTokenContract);
        require(tokenAmount <= tokenContract.allowance(msg.sender, address(this)));
        require(tokenContract.transferFrom(msg.sender, address(this), tokenAmount));

        _swapId = _swapId.add(1);

        // Store the details of the swap.
        _swaps[_swapId] = Swap({
            fromTokenAmount: tokenAmount,
            toTokenAmount:0,
            trader: msg.sender,
            fromContractAddress: tokenContract,
            toContractAddress: ETH_ADDRESS,

            swapType: SwapType.ERC20_TO_ETH,
            status: Status.OPEN
        });
        emit Swap(_swapId, msg.sender);
    }

    function _openERC20ToERC20(
        uint256 openValue,
        address openContractAddress,
        uint256 closeValue,
        address payable closeTrader,
        address closeContractAddress,
        uint256 fee,
        bool isFeeInSwap,
        bool calcFeeUsingTotalSupply
    )
    private
    whenNotPaused
    {
        require(openValue > 0, "[Validation] The open ERC-20 amount has to be larger than 0");
        require(closeValue > 0, "[Validation] The close ERC-20 amount has to be larger than 0");
        
        if(!isFreeToken(openContractAddress)) {
            //Transfer fee to the wallet
            if(isFeeInSwap){
                uint256 minRequiredFeeInSwap = getFeeInSwapForERC20(openValue, openContractAddress, calcFeeUsingTotalSupply);
                uint256 feeDiff = 0;
                if( fee < minRequiredFeeInSwap ) {
                    feeDiff = minRequiredFeeInSwap.sub(fee);
                    uint256 feeSlippagePercentage = feeDiff.mul(100).div(minRequiredFeeInSwap);
                    //will allow if diff is less than 5%
                    require(feeSlippagePercentage < _allowedFeeSlippagePercentage, "[Validation] Fee (SWAP) is below minimum required fee");
                }
                _distributeFees(minRequiredFeeInSwap);
            }
            else {
                uint256 minRequiredFeeInEth = calcFeeUsingTotalSupply ? 
                    getFeeInEthForERC20UsingTotalSupply(openValue, openContractAddress) : 
                    getFeeInEthForERC20(openValue, openContractAddress);
                require(fee >= minRequiredFeeInEth, "[Validation] Fee (ETH) is below minimum required fee");
                require(msg.value >= minRequiredFeeInEth, "[Validation] msg.value doesn't contain enough ETH for fee");
                (bool success,) = _feesWallet.call.value(minRequiredFeeInEth)("");
                require(success, "[Validation] Transfer of fee failed");
            }
        }

        // Transfer value from the opening trader to this contract.
        IERC20 openERC20Contract = IERC20(openContractAddress);
        require(openValue <= openERC20Contract.allowance(msg.sender, address(this)));
        require(openERC20Contract.transferFrom(msg.sender, address(this), openValue));

        _swapId = _swapId.add(1);

        // Store the details of the swap.
        _swaps[_swapId] = Swap({
            openValue: openValue,
            openTrader: msg.sender,
            openContractAddress: openContractAddress,
            closeValue: closeValue,
            closeTrader: closeTrader,
            closeContractAddress: closeContractAddress,
            swapType: SwapType.ERC20_TO_ERC20,
            status: Status.OPEN
        });

        emit Open(_swapId, msg.sender, closeTrader);
    }

    function close(
        uint256 id,
        uint256 fee,
        bool isFeeInSwap,
        bool calcFeeUsingTotalSupply
    )
    external
    payable
    onlyOpenSwaps(id)
    {
        Swap memory swap = _swaps[id];
        require(swap.closeTrader == _msgSender(), "[Validation]: The caller is not authorized to close the trade");
        if(SwapType.ETH_TO_ERC20 == swap.swapType)
        {
            _closeEtherToERC20(
                id,
                fee,
                isFeeInSwap,
                calcFeeUsingTotalSupply
            );
        } 
        else if(SwapType.ERC20_TO_ETH == swap.swapType)
        {
            _closeERC20ToEther(
                id,
                fee,
                isFeeInSwap
            );
        }
        else
        {
            _closeERC20ToERC20(
                id,
                fee,
                isFeeInSwap,
                calcFeeUsingTotalSupply
            );
        }
    }

    function _closeEtherToERC20(
        uint256 id,
        uint256 fee,
        bool isFeeInSwap,
        bool calcFeeUsingTotalSupply
    )
    private
    onlyOpenSwaps(id)
    {
        Swap storage swap = _swaps[id];

        if(!isFreeToken(swap.closeContractAddress)) {
            //Transfer fee to the wallet
            if(isFeeInSwap){
                uint256 minRequiredFeeInSwap = getFeeInSwapForERC20(swap.closeValue, swap.closeContractAddress, calcFeeUsingTotalSupply);
                uint256 feeDiff = 0;
                if( fee < minRequiredFeeInSwap ) {
                    feeDiff = minRequiredFeeInSwap.sub(fee);
                    uint256 feeSlippagePercentage = feeDiff.mul(100).div(minRequiredFeeInSwap);
                    //will allow if diff is less than 5%
                    require(feeSlippagePercentage < _allowedFeeSlippagePercentage, "[Validation] Fee (SWAP) is below minimum required fee");
                }
                _distributeFees(minRequiredFeeInSwap);
            }
            else {
                uint256 minRequiredFeeInEth = calcFeeUsingTotalSupply ? 
                    getFeeInEthForERC20UsingTotalSupply(swap.closeValue, swap.closeContractAddress) : 
                    getFeeInEthForERC20(swap.closeValue, swap.closeContractAddress);
                require(fee >= minRequiredFeeInEth, "[Validation] Fee (ETH) is below minimum required fee");
                require(msg.value >= minRequiredFeeInEth, "[Validation] msg.value doesn't contain enough ETH for fee");
                (bool success,) = _feesWallet.call.value(minRequiredFeeInEth)("");
                require(success, "[Validation] Transfer of fee failed");
            }
        }
        // Close the swap.
        swap.status = Status.CLOSED;

        // Transfer the ERC20 funds from the ERC20 trader to the ETH trader.
        IERC20 erc20Contract = IERC20(swap.closeContractAddress);
        require(swap.closeValue <= erc20Contract.allowance(swap.closeTrader, address(this)));
        require(erc20Contract.transferFrom(swap.closeTrader, swap.openTrader, swap.closeValue));

        // Transfer the ETH funds from this contract to the ERC20 trader.
        swap.closeTrader.transfer(swap.openValue);
        
        emit Close(id);
    }

    function _closeERC20ToEther(
        uint256 id,
        uint256 fee,
        bool isFeeInSwap
    )
    private
    onlyOpenSwaps(id)
    {
        Swap storage swap = _swaps[id];

        //Transferring fee to the wallet
        if(isFeeInSwap){
            require(msg.value >= swap.closeValue, "[Validation] Enough ETH not sent");
            uint256 minRequiredFeeInSwap = getFeeInSwapForETH(swap.closeValue);
            uint256 feeDiff = 0;
            if( fee < minRequiredFeeInSwap ) {
                feeDiff = minRequiredFeeInSwap.sub(fee);
                uint256 feeSlippagePercentage = feeDiff.mul(100).div(minRequiredFeeInSwap);
                //will allow if diff is less than 5%
                require(feeSlippagePercentage < _allowedFeeSlippagePercentage, "[Validation] Fee (SWAP) is below minimum required fee");
            }
            _distributeFees(minRequiredFeeInSwap);
        }
        else {
            uint256 minRequiredFeeInEth = getFeeInEthForEth(swap.closeValue);
            require(fee >= minRequiredFeeInEth, "[Validation] Fee (ETH) is below minimum required fee");
            require(msg.value >= swap.closeValue.add(minRequiredFeeInEth), "[Validation] Enough ETH not sent");
            (bool success,) = _feesWallet.call.value(minRequiredFeeInEth)("");
            require(success, "[Validation] Transfer of fee failed");
        }

        // Close the swap.
        swap.status = Status.CLOSED;

        // Transfer the opening funds from this contract to the eth trader.
        IERC20 openERC20Contract = IERC20(swap.openContractAddress);
        require(openERC20Contract.transfer(swap.closeTrader, swap.openValue));

        (bool success,) = swap.openTrader.call.value(swap.closeValue)("");
        require(success, "[Validation] Transfer of eth failed");
        
        emit Close(id);
    }

    function _closeERC20ToERC20(
        uint256 id,
        uint256 fee,
        bool isFeeInSwap,
        bool calcFeeUsingTotalSupply
    )
    private
    onlyOpenSwaps(id)
    {
        Swap storage swap = _swaps[id];

        if(!isFreeToken(swap.closeContractAddress)) {
            //Transfer fee to the wallet
            if(isFeeInSwap){
                uint256 minRequiredFeeInSwap = getFeeInSwapForERC20(swap.closeValue, swap.closeContractAddress, calcFeeUsingTotalSupply);
                uint256 feeDiff = 0;
                if( fee < minRequiredFeeInSwap ) {
                    feeDiff = minRequiredFeeInSwap.sub(fee);
                    uint256 feeSlippagePercentage = feeDiff.mul(100).div(minRequiredFeeInSwap);
                    //will allow if diff is less than 5%
                    require(feeSlippagePercentage < _allowedFeeSlippagePercentage, "[Validation] Fee (SWAP) is below minimum required fee");
                }
                _distributeFees(minRequiredFeeInSwap);
            }
            else {
                uint256 minRequiredFeeInEth = calcFeeUsingTotalSupply ? 
                    getFeeInEthForERC20UsingTotalSupply(swap.closeValue, swap.closeContractAddress) : 
                    getFeeInEthForERC20(swap.closeValue, swap.closeContractAddress);
                require(fee >= minRequiredFeeInEth, "[Validation] Fee (ETH) is below minimum required fee");
                require(msg.value >= minRequiredFeeInEth, "[Validation] msg.value doesn't contain enough ETH for fee");
                (bool success,) = _feesWallet.call.value(minRequiredFeeInEth)("");
                require(success, "[Validation] Transfer of fee failed");
            }
        }

        // Close the swap.
        swap.status = Status.CLOSED;

        // Transfer the closing funds from the closing trader to the opening trader.
        IERC20 closeERC20Contract = IERC20(swap.closeContractAddress);
        require(swap.closeValue <= closeERC20Contract.allowance(swap.closeTrader, address(this)));
        require(closeERC20Contract.transferFrom(swap.closeTrader, swap.openTrader, swap.closeValue));

        // Transfer the opening funds from this contract to the closing trader.
        IERC20 openERC20Contract = IERC20(swap.openContractAddress);
        require(openERC20Contract.transfer(swap.closeTrader, swap.openValue));

        emit Close(id);
    }

    
    function check(uint256 id)
    external
    view
    returns (
        uint256 fromTokenAmount,
        address fromContractAddress,
        address trader,
        uint256 toTokenAmount,
        address toContractAddress,
        address closeContractAddress,
        SwapType swapType,
        Status status
    )
    {
        Swap memory swap = _swaps[id];
        return (
            swap.fromTokenAmount, 
            swap.fromContractAddress, 
            swap.trader, 
            swap.toTokenAmount, 
            swap.closeTcrader, 
            swap.swapType,
            swap.status
        );
    }

}