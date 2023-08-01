const { ethers } = require("ethers");

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

	ADD_LIQUIDITY_FUNC: '0xe8e33700',
	ADD_LIQUIDITY_ETH_FUNC: '0xf305d719',
	ADD_LIQUIDITY_AVAX_FUNC: '0xf91b3f72',
	ADD_LIQUIDITY_BURNT_FUNC: '0x02751cec',

	SWAP_ETH_TO_TOKEN: `0xfb3bdb41`,

	SWAP_BUY_BY_BOT: `0xa83d93e9`,
	SWAP_SELL_BY_BOT: `0x8e870408`,

	UNISWAP_METHODS: {
		swapExactETHForTokens: `0x7ff36ab5`,
		swapETHForExactTokens: `0xfb3bdb41`,
		swapExactETHForTokensSupportingFeeOnTransferTokens: `0xb6f9de95`,
		swapExactTokensForETH: `0x18cbafe5`,
		swapExactTokensForETHSupportingFeeOnTransferTokens: `0x791ac947`,
		swapExactTokensForTokens: `0x38ed1739`,
		swapExactTokensForTokensSupportingFeeOnTransferTokens: `0x5c11d795`,
		swapTokensForExactETH: `0x4a25d94a`,
		swapTokensForExactTokens: `0x8803dbee`,
		addLiquidity: `0xe8e33700`,
		addLiquidityETH: `0xf305d719`
	},

	UNISWAP_ABI: [
		'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
		'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		'function addLiquidity( address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline ) external returns (uint amountA, uint amountB, uint liquidity)',
		'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
		'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
		'function addLiquidityETH( address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
		'function removeLiquidityETH( address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external payable returns (uint amountToken, uint amountETH)',
		'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
		'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
		'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline ) external returns (uint[] memory amounts)',
		'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		'function swapTokensForExactTokens( uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline ) external returns (uint[] memory amounts)'
	],

	ADD_LIQUIDITY_UNK_FUNC: '0x267dd102',
	ADD_LIQUIDITY_UNK2_FUNC: '0xe8078d94',

	TEAM_FINANCE_LOCK: '0x5af06fed',
	UNICRYPT_LOCK: '0x8af416f6',

	CREATE_PAIR_FUNC: '0xc9c65396',

	USDT_WETH_PAIR :'0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36',
	USDT_ADDRESS:'0xdAC17F958D2ee523a2206206994597C13D831ec7',

	DEFAULT_GAS_LIMIT: 600000,
	APPROVE_AMOUNT: 1000000,

	SWAP_CONTRACT_ABI: `[{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"admin","type":"address"}],"name":"AdminRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"}],"name":"AdminWalletChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"}],"name":"AssistWalletChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"id","type":"uint256"},{"indexed":true,"internalType":"address","name":"trader","type":"address"}],"name":"DoSwap","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"string","name":"discordID","type":"string"},{"indexed":false,"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"ReferralCodeGenerated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"minAmount","type":"uint256"}],"name":"MinimumClaimableChanged","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"referrer","type":"address"},{"indexed":false,"internalType":"address","name":"referred","type":"address"}],"name":"ReferredRegistered","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"ReferrerClaimedProfit","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"account","type":"address"}],"name":"Unpaused","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"fee","type":"uint256"}],"name":"UserFeeChanged","type":"event"},{"stateMutability":"payable","type":"fallback"},{"inputs":[{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"ClaimReferrerProfit","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"tokenContract","type":"address"},{"internalType":"address","name":"pairFor","type":"address"},{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"SwapEthToToken","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"uint256","name":"tokenAmount","type":"uint256"},{"internalType":"address","name":"tokenContract","type":"address"},{"internalType":"address","name":"pairFor","type":"address"},{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"SwapTokenToEth","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"newWallet","type":"address"},{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"changeUserWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"id","type":"uint256"}],"name":"check","outputs":[{"internalType":"address","name":"trader","type":"address"},{"internalType":"address","name":"token","type":"address"},{"internalType":"uint256","name":"fromTokenAmount","type":"uint256"},{"internalType":"uint256","name":"toTokenAmount","type":"uint256"},{"internalType":"bytes8","name":"referralCode","type":"bytes8"},{"internalType":"enum AsapSwapV1.SwapType","name":"swapType","type":"uint8"},{"internalType":"enum AsapSwapV1.Status","name":"status","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"discordID","type":"string"}],"name":"generateReferralCode","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"getClaimWallet","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"getClaimableAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"etherAmount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"address","name":"pairFor","type":"address"}],"name":"getEstimatedERC20forETH","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"erc20Amount","type":"uint256"},{"internalType":"address","name":"tokenAddress","type":"address"},{"internalType":"address","name":"pairFor","type":"address"}],"name":"getEstimatedETHforERC20","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"bytes8","name":"referralCode","type":"bytes8"}],"name":"getFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"string","name":"discordID","type":"string"}],"name":"getReferralCode","outputs":[{"internalType":"bytes8","name":"","type":"bytes8"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address payable","name":"adminWallet","type":"address"},{"internalType":"address payable","name":"assistWallet","type":"address"},{"internalType":"address","name":"wethAddress","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"paused","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"wallet","type":"address"}],"name":"setAdminFeeWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"wallet","type":"address"}],"name":"setAdminUser","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address payable","name":"wallet","type":"address"}],"name":"setAssistWallet","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"minAmount","type":"uint256"}],"name":"setMinimumClaimable","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"defaultSwapFee","type":"uint256"},{"internalType":"uint256","name":"adminProfit","type":"uint256"},{"internalType":"uint256","name":"assitProfit","type":"uint256"},{"internalType":"uint256","name":"referrerProfit","type":"uint256"},{"internalType":"uint256","name":"referredDiscount","type":"uint256"}],"name":"setSwapRatio","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"wethAddress","type":"address"}],"name":"setWethAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"totalVolume","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"tradeAmount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"unpause","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]`,

	REFERRAL_TOKEN_ADDRESS: `0xc36ad98e62598ae24d4487d8012209f687c30d45`,
	REFERRAL_DETECT_TOKEN_NUMBER: 100, //set to 100
	REFERRAL_LINK_MAX_USE: 0,
	REFERRAL_LINK_EXPIRE_SEC: 0,
	REFERRAL_START_MEMBER: 10,  //set to 10

	MAX_CREATABLE_WALLET: 2,

	MEMBER_ADD_TYPE: {
		DIRECT: `direct`,
		REFERRAL: `referral`
	},

	MINIMUM_BALANCE_CHANGE: 0.04,
}

module.exports = items;