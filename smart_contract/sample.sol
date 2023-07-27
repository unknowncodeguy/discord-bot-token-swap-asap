// Proxy contract
contract SwapProxy {
    address public implementation;

    constructor(address _implementation) {
        implementation = _implementation;
    }

    fallback() external payable {
        address _impl = implementation;
        assembly {
            let ptr := mload(0x40)
            calldatacopy(ptr, 0, calldatasize())
            let result := delegatecall(gas(), _impl, ptr, calldatasize(), 0, 0)
            let size := returndatasize()
            returndatacopy(ptr, 0, size)

            switch result
            case 0 { revert(ptr, size) }
            default { return(ptr, size) }
        }
    }
}

// Implementation contract
contract SwapImplementation {
    mapping(address => uint256) public balances;

    function swap(uint256 _amount) external {
        balances[msg.sender] += _amount;
    }
}

// Usage
contract Swap {
    address public proxy;
    address public implementation;

    constructor() {
        implementation = address(new SwapImplementation());
        proxy = address(new SwapProxy(implementation));
    }

    function upgrade(address _newImplementation) external {
        implementation = _newImplementation;
    }

    function swap(uint256 _amount) external {
        (bool success, ) = proxy.delegatecall(abi.encodeWithSignature("swap(uint256)", _amount));
        require(success, "Swap failed");
    }
}
