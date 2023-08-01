const ethers = require('ethers');

class UniSwapUtils {

	constructor() {
		
		// supported chains
		this.chains = {

			// ETH Mainnet
			'1': {
				'name': 'Ethereum',
				'symbol': 'ETH',
				'wrapped': 'WETH',
				'token': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
				'router': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
				'factory': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
				'page': 'https://etherscan.io',
				'swap': process.env.CONTRACT_ADDRESS,
			},

			// goerli
			'5': {
				'name': 'Goerli',
				'symbol': 'ETH',
				'wrapped': 'WETH',
				'token': '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
				'router': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
				'factory': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
				'page': 'https://goerli.etherscan.io',
				'swap': process.env.CONTRACT_ADDRESS,
			},

			// BSC Mainnet
			'56': {
				'name': 'Binance Smart Chain',
				'symbol': 'BNB',
				'wrapped': 'WBNB',
				'token': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
				'router': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
				'factory': '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
				'page': 'https://bscscan.com',
				'swap': process.env.CONTRACT_ADDRESS,
			},

		};

		this.weth = new ethers.Contract(
			this.chains[Network.network.chainId].token,
			constants.TOKEN_ABI,
			this.account
		);
		this.factory = new ethers.Contract(
			this.chains[Network.network.chainId].factory,
			[
				'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
				'function getPair(address tokenA, address tokenB) external view returns (address pair)'
			],
			this.account
		);

		// set router
		this.router = new ethers.Contract(
			this.chains[Network.network.chainId].router,
			constants.UNISWAP_ABI,
			this.account
		);
	}

	async getPair(token_addr) {

		let pairAddress = await this.factory.getPair(this.weth.address, token_addr);

		if(!pairAddress || (pairAddress.toString().indexOf('0x0000000000000') > -1))
			return false;

	    return pairAddress;
	}

	async getLiquidity(pair) {

		let liquidity = await this.token_in.balanceOf(pair);


		return liquidity;

	}

	decodeFactory(method, data){
		return this.factory.interface.decodeFunctionData(method, data);
	}
	decodeRouther(method, data){
		return this.uniSwapUtils.decodeRouther(method, data);
	}
	
}

module.exports = UniSwapUtils;