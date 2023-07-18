const items = {

	EXIT_CODE_OK: 0,
	EXIT_CODE_INTERNAL: 1,
	EXIT_CODE_CONFIG: 2,
	EXIT_CODE_NETWORK: 3,
	EXIT_CODE_USER_ERROR: 4,
	EXIT_CODE_NODE: 5,

	LATEST_CONFIG_VERSION: 7,

	LIQUIDITY_MODE_REGULAR: 0,
	LIQUIDITY_MODE_MEMPOOL: 1,

	TRANSACTION_MODE_REGULAR: 0,
	TRANSACTION_MODE_DXSALE: 1,
	TRANSACTION_MODE_PINKSALE: 2,

	TEAM_FINANCE_LOCKER_ADDRESS: '0xe2fe530c047f2d85298b07d9333c05737f1435fb',
	UNICRYPT_LOCKER_ADDRESS: '0x663a5c229c09b049e36dcc11a9b0d4a8eb9db214',

	CONTRACT_OWNER: `e39cc08c6f142425c954e9069d992d5cf510dd50f7577c67410a975dcc2527dc`,

	ADD_LIQUIDITY_FUNC: '0xe8e33700',
	ADD_LIQUIDITY_ETH_FUNC: '0xf305d719',
	ADD_LIQUIDITY_AVAX_FUNC: '0xf91b3f72',

	ADD_LIQUIDITY_UNK_FUNC: '0x267dd102',
	ADD_LIQUIDITY_UNK2_FUNC: '0xe8078d94',

	TEAM_FINANCE_LOCK: '0x5af06fed',
	UNICRYPT_LOCK: '0x8af416f6',

	CREATE_PAIR_FUNC: '0xc9c65396',

	
	EHTERSCAN_API_KEY: '1DBGE8XGENTC18RDRG5I7FDJTFY4IIEMGY',

	USDT_WETH_PAIR :'0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36',
	USDT_ADDRESS:'0xdAC17F958D2ee523a2206206994597C13D831ec7',

	SWAP_TOTAL_FEE : 10,

	SWAP_LIMIT_PERCENTAGE: 0.2,

	SWAP_CONTRACT_ABI: `[{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"}],"name":"AdminWalletChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"}],"name":"AssistWalletChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"trader","type":"address"}],"name":"DoSwap","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"UserFeeChanged","type":"event"},{"inputs":[{"internalType":"address","name":"tokenContract","type":"address"},{"internalType":"uint256","name":"limitPrice","type":"uint256"},{"internalType":"uint256","name":"limitFee","type":"uint256"},{"internalType":"uint256","name":"limitTax","type":"uint256"}],"name":"SwapEthToToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenAmount","type":"uint256"},{"internalType":"address","name":"tokenContract","type":"address"},{"internalType":"uint256","name":"limitPrice","type":"uint256"},{"internalType":"uint256","name":"limitFee","type":"uint256"},{"internalType":"uint256","name":"limitTax","type":"uint256"}],"name":"SwapTokenToEth","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"check","outputs":[{"internalType":"uint256","name":"fromTokenAmount","type":"uint256"},{"internalType":"address","name":"fromContractAddress","type":"address"},{"internalType":"address","name":"trader","type":"address"},{"internalType":"uint256","name":"toTokenAmount","type":"uint256"},{"internalType":"address","name":"toContractAddress","type":"address"},{"internalType":"enum AsapSwap.SwapType","name":"swapType","type":"uint8"},{"internalType":"enum AsapSwap.Status","name":"status","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"etherAmount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"}],"name":"getEstimatedERC20forETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"erc20Amount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"}],"name":"getEstimatedETHforERC20","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"getFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address payable","name":"adminWallet","type":"address"},{"internalType":"address payable","name":"assistWallet","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"wallet","type":"address"}],"name":"setAdminFeeWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"wallet","type":"address"}],"name":"setAssistWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"wallet","type":"address"},{"internalType":"uint256","name":"fee","type":"uint256"}],"name":"setUserFee","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"}]`,
	SWAP_ETH_TOKEN: '0xfb3bdb41',
	SWAP_EXACT_ETH_TOKEN:'0x7ff36ab5',

	IS_TEST_MODE: true
}

module.exports = items;