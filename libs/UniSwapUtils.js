const ethers = require('ethers');
const constants = require('./constants');

class UniSwapUtils {

	constructor(account, chainId) {
		
		this.account = account;

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
			this.chains[chainId].token,
			constants.TOKEN_ABI,
			this.account
		);

		this.factory = new ethers.Contract(
			this.chains[chainId].factory,
			[
				'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
				'function getPair(address tokenA, address tokenB) external view returns (address pair)'
			],
			this.account
		);

		// set router
		this.router = new ethers.Contract(
			this.chains[chainId].router,
			constants.UNISWAP_ABI,
			this.account
		);

		this.tokenList = [];
	}

	async getPair(token_addr) {
		//const token_info = updateTokenInfo(token_addr);
		//return token_info.pair;
		console.log("getPair: " + this.weth.address );
		console.log("token_addr: " + token_addr );
		if(token_addr.toLowerCase() == this.weth.address)
			throw new Error("token address could not be weth address. " );
	
		console.log("this.factory: " + this.factory.address );
		
		let pairAddress = await this.factory.getPair(this.weth.address, token_addr);
		console.log("pairAddress: " + pairAddress );


		if(!pairAddress || (pairAddress.toString().indexOf('0x0000000000000') > -1))
		{
			throw new Error("UniSwapUtils.getPair get failed for " + token_addr );
		}
	
		return pairAddress;
	}

	async getLiquidity(pair) {
		
		try{
			let liquidity = await this.weth.balanceOf(pair);
		return liquidity;
		}
		catch(e)	{
			console.log("UniSwapUtils.getLiquidity: " + pair );
			console.log("UniSwapUtils.getLiquidity: " + e );
			return null;
		}
	}

	decodeFactory(method, data){
		try{
			return this.factory.interface.decodeFunctionData(method, data);
		}
		catch(e)	{
			console.log("UniSwapUtils.decodeFactory: " + method );
			console.log("UniSwapUtils.decodeFactory: " + data );
			console.log("UniSwapUtils.decodeFactory: " + e );
			return null;
		}
	}

	decodeRouter(method, data){

		try{
			return this.router.interface.decodeFunctionData(method, data);
		}
		catch(e)	{
			console.log("UniSwapUtils.decodeRouter: " + method );
			console.log("UniSwapUtils.decodeRouter: " + data );
			console.log("UniSwapUtils.decodeRouter: " + e );
			return null;
		}
	}
	async getPairReserves(contractAddr)
	{
		let reserves = {}
		try{
			const abi = await etherscan.call({
				module: 'contract',
				action: 'getabi',
				address: token_address
			});
			const ctx = new ethers.Contract(
				contractAddr,
				abi,
				this.account
			);
			const _reserves = await ctx.getReserves();
			reserves.isPair = true;
			const token0 = await ctx.token0();
			const token1 = await ctx.token1();
			reserves.token = token0.toLowerCase() == this.weth.address ? token1 : token0;
		}
		catch(e){
			reserves.isPair = false;
		}
		return reserves;
	}
}	

module.exports = UniSwapUtils;