/**
 * @title AsapSwap
 * @dev ContractDescription
 * @custom:dev-run-script browser/scripts/asap_swap.ts
 */

pragma solidity 0.6.2;
import "@openzeppelin/contracts-ethereum-package/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/utils/Pausable.sol";

contract AsapProxy is Initializable, OwnableUpgradeSafe, PausableUpgradeSafe {

    using SafeMath for uint256;
    using Address for address;

    uint private _version;
    mapping(uint => address) private _swapContracts;
    mapping(uint => address) private _dataContracts;

    event ContractUpgraded(uint version, address dataContract, address swapContract);
    modifier onlyContract(address account) {
        require( account.isContract(), "[Validation] The address does not contain a contract");
        _;
    }
    modifier onlyInitilized() {
        require( initialized, "[ASAP Proxy Validation] contract is not initialized");
        _;
    }

    /**
     * @dev initialize
     */
    function initialize(
        address dataContract,
        address swapContract
    ) public {
        __AsapProxy_init(dataContract, swapContract);
    }

    function __AsapProxy_init(
        address dataContract,
        address swapContract
    ) internal initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
        __Pausable_init_unchained();
        __AsapProxy_init_unchained(dataContract, swapContract);

    }

    function __AsapProxy_init_unchained(
        address dataContract,
        address swapContract
    ) internal initializer {
        require( dataContract != address(0), "[ASAP Proxy Validation] dataContract is the zero address");
        require( swapContract != address(0), "[ASAP Proxy Validation] swapContract is the zero address");
        _version = 1;
        _swapContracts[_version] = swapContract;
        _dataContracts[_version] = dataContract;
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
     * @dev Allows admin to upgrade contracts
     * @param dataContract : contract address that holds data
     * @param swapContract : contract address that do swap
     */
    
    function upgrade(address dataContract, address swapContract) external onlyOwner onlyContract(dataContract) onlyContract(swapContract) onlyInitilized{
        require( dataContract != address(0), "[ASAP Proxy Validation] dataContract is the zero address");
        require( swapContract != address(0), "[ASAP Proxy Validation] swapContract is the zero address");
        _version = _version + 1;
        _swapContracts[_version] = swapContract;
        _dataContracts[_version] = dataContract;
        emit ContractUpgraded(_version, dataContract, swapContract);
    }

    function setUserFee(address wallet, uint256 fee) external onlyOwner onlyInitilized{
      
    }


    function SwapEthToToken(
        address tokenContract,
        uint256 limitPrice,
        uint256 limitFee,
        uint256 limitTax
    ) external payable whenNotPaused onlyInitilized{
        
    }

    function SwapTokenToEth(
        uint256 tokenAmount,
        address tokenContract,
        uint256 limitPrice,
        uint256 limitFee,
        uint256 limitTax
    ) external payable whenNotPaused onlyInitilized{
        
    }

    function check(
        uint256 id
    )
        external
        view
        onlyInitilized
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
        
    }
    function getFee(uint256 amount, address wallet) public view onlyInitilized returns (uint256) {
       return 1;
    }
    function totalVolume() public view onlyInitilized returns(uint256){
        return 1;
    }
    function tradeAmount() public view onlyInitilized returns(uint256){
        return 1;
    }

    function version() public view onlyInitilized returns (uint ver, address dataContract, address swapContract) {
       return (_version, address, address);
    }
}
