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
        //main net
        //0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2

        //goerli
        0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6
    );
    address constant private UNISWAP_ROUTER_ADDRESS = address(
        //main net
        //0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D

        // goerli
        0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D
    );

    // FEE percentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
    uint256 constant private DEFAULT_FEE_PERCENTAGE = 10; 
    uint256 constant private MAIN_WALLET_PERCENTAGE = 85;
    uint256 constant private ASSIST_WALLET_PERCENTAGE = 15;
    uint256 constant private DEFAULT_SLIPPAGE_PERCENTAGE = 10;
    uint256 constant private MINI_ETHER = 1000000000000000; // 0.01 ether
    //Global swap id. Also give total number of swaps made so far
    uint256 private _swapId;

    mapping (uint256 => Swap) private _swaps;

    //Wallet where fees will go
    address payable private _feesAdminWallet;
    address payable private _feesAssistWallet;


    /// swap id, trader
    event Swap(uint256 indexed id, address indexed trader);
    event AdminWalletChanged(address indexed wallet);
    event AssistWalletChanged(address indexed wallet);
    

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

        emit AssistWalletChanged(wallet);
    }


    function getFee(uint256 amount, address token, address buyer)
    public
    view
    returns (uint256) 
    {
        //_ethFeePercentage is a percentage expressed in 1/10 (a tenth) of a percent hence we divide by 1000
        return amount.mul(DEFAULT_FEE_PERCENTAGE).div(1000);  // 1% 
    }

    

    function _distributeFees(uint256 fee)
    private
    {
        uint256 admin_fee = fee.mul(MAIN_WALLET_PERCENTAGE).div(100); //85%
        uint256 assit_fee = fee.mul(ASSIST_WALLET_PERCENTAGE).div(100); //15%

        _swapToken.safeTransferFrom(msg.sender, _feesAdminWallet, admin_fee);
        _swapToken.safeTransferFrom(msg.sender, _feesAssistWallet, assit_fee);
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
        uint256 limitFee
    )
    external
    payable
    whenNotPaused
    {
        require(fromTokenAmount > 0, "[Validation] The trade amount has to be larger than 0");
        require(ETH_ADDRESS == fromTokenContract || ETH_ADDRESS == toTokenContract, "[Validation] only accept swap with weth.");
        if(ETH_ADDRESS == fromTokenContract)
        {
            _swapEthToToken(
                fromTokenAmount,
                toTokenContract,
                limitPrice,
                limitFee
            );
        } 
        else if(ETH_ADDRESS == toTokenContract)
        {
            _swapTokenToEth(
                fromTokenAmount,
                fromTokenContract,
                limitPrice,
                limitFee
            );
        }
    }

    function _swapEthToToken(
        uint256 ethAmount,
        address toTokenContract,
        uint256 limitPrice,
        uint256 limitFee
    )
    private
    whenNotPaused
    onlyContract(toTokenContract)
    {
        require(msg.value >= ethAmount, "[Validation] Enough ETH not sent");
        require(ethAmount > 0, "[Validation] The ETH amount has to be larger than 0");
        
        uint256 totalfeeInSwap = getFee(ethAmount, toTokenContract, _msgSender());
        if(limitFee > 0) // check limit fee
        {
            require(totalfeeInSwap < limitFee, "[Validation] Swap fee is too high");
        }
        if(limitPrice > 0) {
            uint256 _estimatedTokenAmount = getEstimatedERC20forETH( MINI_ETHER, toTokenContract);
            require(limitPrice < _estimatedTokenAmount, "[Validation] Token price is too high ");
              
        }
            require(fromTokenAmount > 0, "[Validation] The trade amount has to be larger than 0");

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


    function check(uint256 id)
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
        Swap memory swap = _swaps[id];
        return (
            swap.fromTokenAmount, 
            swap.fromContractAddress, 
            swap.trader, 
            swap.toTokenAmount, 
            swap.toContractAddress, 
            swap.swapType,
            swap.status
        );
    }
    
  function getEstimatedETHforERC20(uint256 erc20Amount, address tokenAddress)
  external
  view
  returns (uint256[] memory)
  {
    return uniswapRouter.getAmountsIn(erc20Amount, _getPathForETHtoERC20(tokenAddress));
  }

  function _getPathForETHtoERC20(address tokenAddress)
  internal
  view
  returns (address[] memory)
  {
    address[] memory path = new address[](2);
    path[0] = uniswapRouter.WPLS();
    path[1] = tokenAddress;
    return path;
  }

  function getEstimatedERC20forETH(uint256 etherAmount, address tokenAddress)
  external
  view
  returns (uint256[] memory)
  {
    return uniswapRouter.getAmountsIn(etherAmount, _getPathForERC20toETH(tokenAddress));
  }

  function _getPathForERC20toETH(address tokenAddress)
  internal
  view
  returns (address[] memory)
  {
    address[] memory path = new address[](2);
    path[0] = tokenAddress;
    path[1] = uniswapRouter.WPLS();
    return path;
  }

}