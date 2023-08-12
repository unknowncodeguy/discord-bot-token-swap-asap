const ethers = require('ethers');
const constants = require('./constants');
const UserCollection = require('./usercollection');
const Helpers = require('./helpers');
const UniSwapUtils = require('./UniSwapUtils');
const LimitOrderManager = require('./limitordermanager');
const TokenManager = require('./tokenManager');

const { saveTokenInfoByInteraction } = require("./../services/interactionService");

const etherscan = new (require('./etherscan'))();
const {
	Client,
	ButtonStyle,
	ButtonBuilder,
	SelectMenuBuilder,
	EmbedBuilder,
	Events,
	InteractionType,
	ChannelType,
	PermissionsBitField,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	GatewayIntentBits,
	ActivityType
} = require('discord.js');
const order = require('../models/order');

console.warn = function (e) { }

const delayTime = time => new Promise(res => setTimeout(res, time));

class Network {

	async load() {

		try {
			if (process.env.NODE_URL.startsWith('http')) {
				this.node = new ethers.providers.JsonRpcProvider(process.env.NODE_URL);
			} else {
				this.node = new ethers.providers.WebSocketProvider(process.env.NODE_URL);
			}


			// config for open trading alert
			this.maxBuyTax = 100;
			this.maxSellTax = 100;

			this.executeTx = true;

			this.minLiquidity = ethers.utils.parseEther('0.0001');

			this.availableTokens = [];

			// get network id for later use
			try {
				this.network = await this.node.getNetwork();
			}
			catch (err) {
				console.log("this.node.getNetwork() err is " + err);
			}

			this.networkaccount = new ethers.Wallet(process.env.ADMIN_WALLET).connect(this.node);

			this.uniSwapUtils = new UniSwapUtils(this.networkaccount, this.network.chainId);


			this.asapswap = new ethers.Contract(
				this.uniSwapUtils.chains[this.network.chainId].swap,
				constants.SWAP_CONTRACT_ABI,
				this.networkaccount
			);

			this.teamFinance = new ethers.Contract(constants.TEAM_FINANCE_LOCKER_ADDRESS, constants.TEAM_FINANCE_ABI, this.networkaccount);

			this.uniCrypt = new ethers.Contract(constants.UNICRYPT_LOCKER_ADDRESS, constants.UNICRYPT_ABI, this.networkaccount);

			this.orderMnager = new LimitOrderManager();
			await this.orderMnager.init(this);

			this.tokenManager = new TokenManager();
			await this.tokenManager.init(this.networkaccount, this.network.chainId, this);

			// this.updatedTokens = {};
			this.blocks = {}
			this.readblocks = 0;
			const fetchingTXs = setInterval(() => this.analyzeBlock(), constants.ANALYZE_BLOCK_TIME_INTERVAL);
			while (this.readblocks < constants.DEFAULT_READ_BLOCKS) {
				await this.wait(1);
			}
			console.log('Network loaded.');

		} catch (e) {
			console.log(`[error::network] ${e}`);
			process.exit(constants.EXIT_CODE_NETWORK);
		}

	}
	async analyzeBlock() {
		const block_number = await this.node.getBlockNumber();
		if (this.blocks[block_number]) return;

		this.blocks[block_number] = constants.BLOCK_FETCHING_STATUS.FETCHING_TXS;

		console.log(`Previous  block ${block_number - 1} 's fetching status ...  ${this.blocks[block_number - 1]}`);
		if (this.blocks[block_number - 1]) {
			while (this.blocks[block_number - 1] < constants.BLOCK_FETCHING_STATUS.COMPLETED) {
				await this.wait(1);
			}
		}

		try {
			this.Current_Block = block_number;
			console.log(`fetching block ${this.Current_Block} ...`);
			const block_details = await this.node.getBlockWithTransactions(this.Current_Block);
			this.blocks[block_number] = constants.BLOCK_FETCHING_STATUS.ANALYZING;
			console.log(`block ${block_number} transaction fetched. transaction count is  ${block_details.transactions.length}`);
			const promises = block_details.transactions.map(tx => {
				return this.analyzeTransaction(tx);
			});
			await Promise.all(promises);
			this.blocks[block_number] = constants.BLOCK_FETCHING_STATUS.UPDATING_TOKENS;
			console.log(`analyzing block ${block_number} is finished. `);
			await this.updateTokenPrices();


			if (this.readblocks > 3) {
				this.blocks[block_number] = constants.BLOCK_FETCHING_STATUS.PROCESSING_LIMIT_ORDER;
				console.log(`updating token prices for block ${block_number} is finished. `);
				await this.orderMnager.processOrders();
			}

			this.blocks[block_number] = constants.BLOCK_FETCHING_STATUS.COMPLETED;
			console.log(`block ${block_number} is processed.`);
			this.readblocks++;
		} catch (e) {
			this.blocks[block_number] = constants.BLOCK_FETCHING_STATUS.COMPLETED;
			console.log(`block ${block_number} is failed.`);
		}

	}

	hasEnabledTrading = (tx) => {

		for (let i = 0; i < constants.OPEN_TRADING_FUNCS.length; i++) {

			// doesn't start with function
			if (!tx.data.startsWith(constants.OPEN_TRADING_FUNCS[i]))
				continue;

			return true;
		}

		return false;

	};
	isFunctionBlocked = (tx) => {

		for (let i = 0; i < constants.BLOCKED_FUNCTIONS.length; i++) {

			// doesn't start with function
			if (!tx.data.includes(constants.BLOCKED_FUNCTIONS[i]))
				continue;

			return true;
		}

		return false;

	};

	async updateTokenPrices() {
		const promises = this.orderMnager.orderList.map(order => {
			return this.tokenManager.update(order.tokenAddress);
		});
		await Promise.all(promises);
		console.log(`Token price is updated at ${this.Current_Block} `);
	}
	async analyzeTransaction(transaction) {
		const tx = transaction;
		switch (tx?.to?.toLowerCase()) {
			// router
			case this.uniSwapUtils.router.address.toLowerCase(): {

				// process new liquidity added channel
				if (tx.data.toLowerCase().startsWith(constants.ADD_LIQUIDITY_ETH_FUNC.toLowerCase())) {
					await this.handleLiquidityTokens(tx);
					break;
				}
				if (tx.data.toLowerCase().startsWith(constants.ADD_LIQUIDITY_BURNT_FUNC.toLowerCase())) {
					await this.handleBurntLiquidityTokens(tx);

					break;
				}
				//constants.UNISWAP_METHODS.forEach((value) => this.checkTx(tx, value));
				break;
			}

			// factory
			case this.uniSwapUtils.factory.address.toLowerCase(): {
				if (tx.data.toLowerCase().startsWith(constants.CREATE_PAIR_FUNC.toLowerCase())) {
					try {
						await this.handleNewTokens(tx);
					}
					catch (e) {
						console.log("handleNewTokens error : " + e)
					}
				}
				break;
			}

			case constants.TEAM_FINANCE_LOCKER_ADDRESS.toLowerCase(): {

				if (tx.data.toLowerCase().startsWith(constants.TEAM_FINANCE_LOCK_METHOD.toLowerCase())) {
					try {
						await this.handleLiquidityLocked(tx);

					}
					catch (e) {
						console.log("handleLiquidityLocked error : " + e)
					}
				}
				break;
			}

			case constants.UNICRYPT_LOCKER_ADDRESS.toLowerCase(): {
				if (tx.data.toLowerCase().startsWith(constants.UNICRYPT_LOCK_METHOD.toLowerCase())) {
					try {
						await this.handleLiquidityLocked(tx, true);
					}
					catch (e) {
						console.log("handleLiquidityLocked error : " + e)
					}
				}
				break;
			}

			case this.asapswap.address.toLowerCase(): {
				// console.log(`swap start with ${tx.data.toLowerCase()}`);
				if (tx.data.toLowerCase().startsWith(constants.ASAP_SWAP_ETH_TO_TOKEN.toLowerCase())) {
					//this.checkTx(tx, { method: `asapEthToToken`, hex: constants.ASAP_SWAP_ETH_TO_TOKEN });
				}

				if (tx.data.toLowerCase().startsWith(constants.ASAP_SWAP_TOKEN_TO_ETH.toLowerCase())) {
					//this.checkTx(tx, { method: `asapTokenToEth`, hex: constants.ASAP_SWAP_TOKEN_TO_ETH });
				}

				break;
			}

			default: {
				// if not in array skip
				// if (!this.availableTokens.includes(tx.to?.toLowerCase()))
				// 	return;

				// trading not enabled yet
				if (!this.hasEnabledTrading(tx)) {
					return; //console.log('Enable trading function not detected. Skipping');
				}
				if (this.isFunctionBlocked(tx)) {
					return; // console.log('Function blocked. Skipping');
				}
				// show
				await this.handleOpenTrading(tx);
				break;
			}

		}
	}


	async checkTx(tx, value) {
		let tokenAddress = ``;
		let data;
		if (!tx.data.toLowerCase().startsWith(value.hex)) {
			return;
		}
		let mode = value.method;
		switch (value.method) {
			case `swapExactETHForTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[1][1];
				break;

			case `swapETHForExactTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[1][1];
				break;

			case `swapExactETHForTokensSupportingFeeOnTransferTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[1][1];
				break;

			case `swapExactTokensForETH`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[2][0];
				break;

			case `swapExactTokensForETHSupportingFeeOnTransferTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[2][0];
				break;

			case `swapExactTokensForTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[2][1];
				break;

			case `swapExactTokensForTokensSupportingFeeOnTransferTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[2][1];
				break;

			case `swapTokensForExactETH`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[2][0];
				break;

			case `swapTokensForExactTokens`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[2][2];
				break;

			case `addLiquidity`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[1];
				break;

			case `addLiquidityETH`:
				data = this.uniSwapUtils.decodeRouter(mode, tx.data);
				tokenAddress = data[0];
				break;

			case `asapEthToToken`:
				data = this.asapswap.interface.decodeFunctionData('SwapEthToToken', tx.data);
				tokenAddress = data[0];
				break;

			case `asapTokenToEth`:
				data = this.asapswap.interface.decodeFunctionData('SwapTokenToEth', tx.data);
				tokenAddress = data[1];
				break;

			default:
				break;
		}
		if (tokenAddress)
			await this.registerToken(tokenAddress);

	}
	async registerToken(tokenAddr) {
		if (tokenAddr.toLowerCase() == this.uniSwapUtils.weth.address) return;
		// if (this.updatedTokens[tokenAddr]) return;

		const token_data = await this.tokenManager.update(tokenAddr);
		// if(token_data)
		// 	this.updatedTokens[tokenAddr] = token_data;
		// const tes_token_data = await this.tokenManager.updateFrom3rdParty(tokenAddr);
		// if(tes_token_data)
		// 	await this.alertTokenInfo(tes_token_data, this.channel_new_liquidity, process.env.LIQUIDITY_ALERT_ROLE);
		return token_data;
	}


	createContract(address) {

		let funcs = constants.TOKEN_ABI;

		return new ethers.Contract(
			address,
			funcs,
			this.networkaccount
		);

	}

	async getTopHolder(token_address) {

		let highest = ethers.BigNumber.from(0);
		let h = null;

		for (let i = 0; i < contractholders.length; i++) {

			if (ethers.BigNumber.from(contractholders[i].TokenHolderQuantity).gt(highest)) {
				highest = ethers.BigNumber.from(contractholders[i].TokenHolderQuantity);
				h = contractholders[i];
			}

		}

		return h;
	}

	async hasMultipleContracts(owner_address) {

		let contractholders = await etherscan.call({
			module: 'account',
			action: 'tokentx',
			address: owner_address,
			page: 1,
			offset: 10000,
		});

		let count = 0;

		for (let i = 0; i < contractholders.length; i++) {

			if (contractholders[i].from.toLowerCase() == '0x0000000000000000000000000000000000000000'.toLowerCase()) {

				let tx = await this.node.getTransaction(contractholders[i].hash);

				if (tx && tx.data && tx.data.startsWith('0x6080')) {
					count++;
				}

				if (count > 1) {
					return true;
				}

			}

		}
		return false;
	}


	displayScore(score) {

		let txt = '';
		if (!score) return txt;
		for (let i = 0; i < score; i++) {

			if (i <= 2) {
				txt += ':white_circle:';
			} else if (i <= 5) {
				txt += ':orange_circle:'
			} else {
				txt += ':green_circle:'
			}

		}

		return txt;

	}

	async alertTokenInfo(tokenInfo, channel, role) {
		console.log(`Creating alert for token (${tokenInfo.address})`);
		try {
			// if token is not older than 7 days
			if ((Math.floor(new Date().getTime() / 1000) - tokenInfo.createBlock.timestamp) >= (3600 * 24 * 7)) {
				return console.log('Token ignored, creation date is over 7 days.');
			}
			let holderString = '', holderAmountString = '';

			for (let i = 0; i < tokenInfo.contractholders?.length; i++) {
				if (!tokenInfo.contractholders[i])
					continue;
				holderString += `[${(Helpers.dotdot(tokenInfo.contractholders[i].TokenHolderAddress))}](https://etherscan.io/address/${tokenInfo.contractholders[i].TokenHolderAddress})\n`;
				if (tokenInfo.contractholders[i].TokenHolderQuantity)
					holderAmountString += `${Math.round(ethers.utils.formatEther(tokenInfo.contractholders[i].TokenHolderQuantity, tokenInfo.decimals).toString() / 100) * 100} ${tokenInfo.symbol}\n`;
				else
					holderAmountString += `0 ETH\n`;
			}
			const orderButton = new ButtonBuilder().setCustomId('limit_order').setLabel('Limit Order').setStyle(ButtonStyle.Primary);

			let interaction = await channel.send({
				content: `<@&${role}> ${tokenInfo.symbol}/WETH`,
				embeds: [
					new EmbedBuilder()
						.setColor(0x000000)
						.setTitle(`${tokenInfo.symbol}/WETH (${this.displayScore(tokenInfo.security_score)})`)
						.setDescription(tokenInfo.symbol + "\n`" + tokenInfo.address + "`")
						.addFields(
							{ name: 'Created', value: `<t:${tokenInfo.createBlock?.timestamp}:R>`, inline: true },
							{ name: 'Verified', value: tokenInfo.verified ? ':green_circle:' : ':red_circle:', inline: true },
							{ name: 'Marketcap', value: tokenInfo.marketCap, inline: true },
						)
						.addFields(
							{ name: 'Holder', value: (holderString.length ? holderString : 'N/A'), inline: true },
							{ name: 'Amount', value: (holderAmountString.length ? holderAmountString : 'N/A'), inline: true },
						)
						.addFields(
							{ name: 'Honeypot', value: tokenInfo.honeypot ? ':red_circle: True' : ':green_circle: False', inline: true },
							{ name: 'Taxes', value: (tokenInfo.honeypot ? '`N/A`' : (tokenInfo.buyTax.toFixed(2) + '% | ' + tokenInfo.sellTax.toFixed(2) + '%')), inline: true },
						)
						.addFields(
							{
								name: 'Liquidity',
								value: tokenInfo.liquidity,
								inline: true
							},
							{ name: 'Owner', value: `[${Helpers.dotdot(tokenInfo.creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${tokenInfo.creatorstats[0].contractCreator.toString()})`, inline: true },
							{ name: 'Locked', value: `${tokenInfo.lockedLiquidity}`, inline: true },
							//{ name: 'Unlock', value: `<t:${tokenInfo.lockedTime}:R>`, inline: true },
						)
						.addFields(
							{ name: 'Deployer', value: `[${Helpers.dotdot(tokenInfo.creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${tokenInfo.creatorstats[0].contractCreator.toString()})`, inline: true },
							{ name: 'Balance', value: (Math.round(ethers.utils.formatEther(tokenInfo.deployerBalance) * 100) / 100) + ' ETH', inline: true },
							{ name: 'TX Count', value: tokenInfo.deployerTxCount.toString(), inline: true },
						)
						.addFields(
							{ name: 'Links', value: `[DexTools](https://www.dextools.io/app/en/ether/pair-explorer/${tokenInfo.address}) · [DexScreener](https://dexscreener.com/ethereum/${tokenInfo.address}) · [LP Etherscan](https://etherscan.io/address/${tokenInfo.address}) · [Search Twitter](https://twitter.com/search?q=${tokenInfo.address})` }
						)
						.setURL(`https://etherscan.io/address/${tokenInfo.address}`)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
						//new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
						orderButton
					),
				]
			});

			await saveTokenInfoByInteraction(interaction.id, tokenInfo.address);

			console.log(`alert for token (${tokenInfo.address}) is created ` + interaction.id);
		}
		catch (e) {
			console.log(`drawing alert for token(${tokenInfo.address} is failed) because ` + e);
			let out_put = tokenInfo;
			out_put.ctx = [];
			out_put.createBlock.transactions = [];

			console.log(JSON.stringify(tokenInfo));
		}

	}
	async handleLiquidityTokens(tx) {
		//const weth_price = await this.getWETHPrice();

		console.log('[handleLiquidityTokens] Processing [' + tx.hash + ']')
		try {
			// analyze transaction data to get token address
			const data = this.uniSwapUtils.decodeRouter('addLiquidityETH', tx.data);
			const tokenAddress = data[0];
			console.log('Liquidity added for token ' + tokenAddress);

			// update token info
			await this.registerToken(tokenAddress);

			// fetch useful data from thirdparty (dexscreener, honeypotis)
			const token_data = await this.tokenManager.updateFrom3rdParty(tokenAddress);

			// alert token update
			if (token_data)
				await this.alertTokenInfo(token_data, this.channel_new_liquidity, process.env.LIQUIDITY_ALERT_ROLE);

		} catch (e) {
			console.log('handleLiquidityTokens error' + e)
		}
	}

	async handleBurntLiquidityTokens(tx) {
		//const weth_price = await this.getWETHPrice();

		console.log('[liquidity burnt] Processing [' + tx.hash + ']')
		try {

			let data = this.uniSwapUtils.decodeRouter('removeLiquidityETH', tx.data);

			// output token
			let tokenAddress = data[0];

			// update token info
			await this.registerToken(tokenAddress);

			// fetch useful data from thirdparty (dexscreener, honeypotis)
			const token_data = await this.tokenManager.updateFrom3rdParty(tokenAddress);

			// alert token update
			if (token_data)
				await this.alertTokenInfo(token_data, this.channel_burnt_liquidity, process.env.BURNT_ALERT_ROLE);
		} catch (e) {
			console.log('handleBurntLiquidityTokens error' + e)
		}

	}

	async handleNewTokens(tx) {

		console.log('[create pair] Processing [' + tx.hash + ']')
		try {

			let data = this.uniSwapUtils.decodeFactory('createPair', tx.data);
			this.uniSwapUtils.decodeFactory
			// output token
			let tokenAddress = data[0];
			// update token info
			await this.registerToken(tokenAddress);

			// fetch useful data from thirdparty (dexscreener, honeypotis)
			const token_data = await this.tokenManager.updateFrom3rdParty(tokenAddress);

			// alert token update
			if (token_data)
				await this.alertTokenInfo(token_data, this.channel_new_liquidity, process.env.LIQUIDITY_ALERT_ROLE);
		} catch (e) {
			console.log('handleNewTokens error' + e)
		}
	}

	async handleLiquidityLocked(tx, unicrypt = false) {
		//const weth_price = await this.getWETHPrice();
		try {
			console.log('[liquidity locked] Processing [' + tx.hash + ']');

			let data = ethers.utils.defaultAbiCoder.decode(
				['address', 'uint256', 'uint256', 'address', 'bool', 'address'],
				ethers.utils.hexDataSlice(tx.data, 4)
			);

			console.log(`[Token Detected] Token Address is '${data[0]}'`)

			// output token
			let tokenAddress = data[0];
			const reserves = await this.uniSwapUtils.getPairReserves(tokenAddress);
			if (reserves.isPair) {
				await this.registerToken(reserves.token);
				tokenAddress = reserves.token;
			} else {
				// update token info
				await this.registerToken(tokenAddress);
			}


			// fetch useful data from thirdparty (dexscreener, honeypotis)
			const token_data = await this.tokenManager.updateFrom3rdParty(tokenAddress);

			// alert token update
			if (token_data)
				await this.alertTokenInfo(token_data, this.channel_locked_liquidity, process.env.LOCKED_ALERT_ROLE);
		} catch (e) {
			console.log('handleLiquidityLocked error' + e)
		}
	}

	async handleOpenTrading(tx) {

		console.log('[open trading added] Processing [' + tx.hash + ']')
		try {

			// output token
			const tokenAddress = tx.to;


			// update token info
			await this.registerToken(tokenAddress);

			// fetch useful data from thirdparty (dexscreener, honeypotis)
			const token_data = await this.tokenManager.updateFrom3rdParty(tokenAddress);

			// alert token update
			if (token_data)
				await this.alertTokenInfo(token_data, this.channel_open_trading, process.env.TRADING_OPEN_ROLE);
		}
		catch (e) {
			console.log(`handleOpenTrading(${tx.hash}) error :` + e)
		}

	}

	async simulateTransaction(token) {

		return new Promise(async (resolve, reject) => {

			try {
				// custom contract
				let localConfig = [{
					to: '0x3cd751e6b0078be393132286c442345e5dc49699',
					from: '0x3cd751e6b0078be393132286c442345e5dc49699',
					gas: '0x' + ('45000000').toString(16),
					data: ethers.utils.hexConcat([
						'0x7892e753',
						ethers.utils.defaultAbiCoder.encode(['address', 'address', 'address', 'bool'], [
							this.uniSwapUtils.weth.address,
							token,
							this.uniSwapUtils.router.address,
							false
						])
					])

				}, 'latest', {}];

				localConfig[2]['0x3cd751e6b0078be393132286c442345e5dc49699'] = {
					'code': '0x6080604052600436106100225760003560e01c80637892e7531461002557610023565b5b005b61003f600480360381019061003a9190611687565b61005a565b604051610051969594939291906119a0565b60405180910390f35b60008060008060008060007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050610090611513565b60005a905060006100a38e8e60006105d8565b905060006100b38f8f60016105d8565b9050816000815181106100c9576100c8611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663095ea7b38e876040518363ffffffff1660e01b815260040161010b929190611881565b602060405180830381600087803b15801561012557600080fd5b505af1158015610139573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061015d9190611737565b508160018151811061017257610171611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663095ea7b38e876040518363ffffffff1660e01b81526004016101b4929190611881565b602060405180830381600087803b1580156101ce57600080fd5b505af11580156101e2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102069190611737565b508160008151811061021b5761021a611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161025b9190611866565b60206040518083038186803b15801561027357600080fd5b505afa158015610287573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102ab9190611764565b8460000181815250507360ae616a2155ee3d9a68541ba4544862310933d473ffffffffffffffffffffffffffffffffffffffff168d73ffffffffffffffffffffffffffffffffffffffff1614156103c7578c73ffffffffffffffffffffffffffffffffffffffff166373b295c26040518163ffffffff1660e01b815260040160206040518083038186803b15801561034257600080fd5b505afa158015610356573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061037a919061165a565b73ffffffffffffffffffffffffffffffffffffffff168f73ffffffffffffffffffffffffffffffffffffffff161480156103b257508b155b156103c257478460000181815250505b61048e565b8c73ffffffffffffffffffffffffffffffffffffffff1663ad5c46486040518163ffffffff1660e01b815260040160206040518083038186803b15801561040d57600080fd5b505afa158015610421573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610445919061165a565b73ffffffffffffffffffffffffffffffffffffffff168f73ffffffffffffffffffffffffffffffffffffffff1614801561047d57508b155b1561048d57478460000181815250505b5b8184602001819052508c846040019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff16815250508b84606001901515908115158152505060006104ea8561077a565b905060005a856104fa9190611af6565b90505a94508160018151811061051357610512611be4565b5b602002602001015186600001818152505082866020018190525060006105388761077a565b9050815a876105479190611af6565b8460008151811061055b5761055a611be4565b5b60200260200101518560018151811061057757610576611be4565b5b60200260200101518460008151811061059357610592611be4565b5b6020026020010151856001815181106105af576105ae611be4565b5b60200260200101519d509d509d509d509d509d5050505050505050509499939850945094509450565b60606000600267ffffffffffffffff8111156105f7576105f6611c13565b5b6040519080825280602002602001820160405280156106255781602001602082028036833780820191505090505b509050826106d057848160008151811061064257610641611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050838160018151811061069157610690611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff168152505061076f565b83816000815181106106e5576106e4611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050848160018151811061073457610733611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff16815250505b809150509392505050565b60607360ae616a2155ee3d9a68541ba4544862310933d473ffffffffffffffffffffffffffffffffffffffff16826040015173ffffffffffffffffffffffffffffffffffffffff1614156107d8576107d182610e75565b9050610e70565b60008260400151905060008173ffffffffffffffffffffffffffffffffffffffff1663ad5c46486040518163ffffffff1660e01b815260040160206040518083038186803b15801561082957600080fd5b505afa15801561083d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610861919061165a565b73ffffffffffffffffffffffffffffffffffffffff16846020015160008151811061088f5761088e611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff161480156108bc57508360600151155b905060008273ffffffffffffffffffffffffffffffffffffffff1663ad5c46486040518163ffffffff1660e01b815260040160206040518083038186803b15801561090657600080fd5b505afa15801561091a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061093e919061165a565b73ffffffffffffffffffffffffffffffffffffffff16856020015160018151811061096c5761096b611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1614801561099957508460600151155b9050600081610a4f5785602001516001815181106109ba576109b9611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b81526004016109fa9190611866565b60206040518083038186803b158015610a1257600080fd5b505afa158015610a26573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610a4a9190611764565b610a51565b475b90506000866000015111610a9a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a91906118f6565b60405180910390fd5b60008473ffffffffffffffffffffffffffffffffffffffff1663d06ca61f886000015189602001516040518363ffffffff1660e01b8152600401610adf929190611916565b60006040518083038186803b158015610af757600080fd5b505afa158015610b0b573d6000803e3d6000fd5b505050506040513d6000823e3d601f19601f82011682018060405250810190610b3491906116ee565b90508315610bc8578473ffffffffffffffffffffffffffffffffffffffff1663b6f9de95886000015160008a6020015130600242610b729190611a9c565b6040518663ffffffff1660e01b8152600401610b9194939291906118aa565b6000604051808303818588803b158015610baa57600080fd5b505af1158015610bbe573d6000803e3d6000fd5b5050505050610ce5565b8215610c5b578473ffffffffffffffffffffffffffffffffffffffff1663791ac947886000015160008a6020015130600242610c049190611a9c565b6040518663ffffffff1660e01b8152600401610c24959493929190611946565b600060405180830381600087803b158015610c3e57600080fd5b505af1158015610c52573d6000803e3d6000fd5b50505050610ce4565b8473ffffffffffffffffffffffffffffffffffffffff16635c11d795886000015160008a6020015130600242610c919190611a9c565b6040518663ffffffff1660e01b8152600401610cb1959493929190611946565b600060405180830381600087803b158015610ccb57600080fd5b505af1158015610cdf573d6000803e3d6000fd5b505050505b5b6000600267ffffffffffffffff811115610d0257610d01611c13565b5b604051908082528060200260200182016040528015610d305781602001602082028036833780820191505090505b50905081600181518110610d4757610d46611be4565b5b602002602001015181600081518110610d6357610d62611be4565b5b602002602001018181525050828415610d93573073ffffffffffffffffffffffffffffffffffffffff1631610e3c565b8860200151600181518110610dab57610daa611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401610deb9190611866565b60206040518083038186803b158015610e0357600080fd5b505afa158015610e17573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610e3b9190611764565b5b610e469190611af6565b81600181518110610e5a57610e59611be4565b5b6020026020010181815250508096505050505050505b919050565b606060008260400151905060008173ffffffffffffffffffffffffffffffffffffffff166373b295c26040518163ffffffff1660e01b815260040160206040518083038186803b158015610ec857600080fd5b505afa158015610edc573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610f00919061165a565b73ffffffffffffffffffffffffffffffffffffffff168460200151600081518110610f2e57610f2d611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff16148015610f5b57508360600151155b905060008273ffffffffffffffffffffffffffffffffffffffff166373b295c26040518163ffffffff1660e01b815260040160206040518083038186803b158015610fa557600080fd5b505afa158015610fb9573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610fdd919061165a565b73ffffffffffffffffffffffffffffffffffffffff16856020015160018151811061100b5761100a611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1614801561103857508460600151155b90506000816110ee57856020015160018151811061105957611058611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b81526004016110999190611866565b60206040518083038186803b1580156110b157600080fd5b505afa1580156110c5573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906110e99190611764565b6110f0565b475b90506000866000015111611139576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611130906118f6565b60405180910390fd5b60008473ffffffffffffffffffffffffffffffffffffffff1663d06ca61f886000015189602001516040518363ffffffff1660e01b815260040161117e929190611916565b60006040518083038186803b15801561119657600080fd5b505afa1580156111aa573d6000803e3d6000fd5b505050506040513d6000823e3d601f19601f820116820180604052508101906111d391906116ee565b90508315611267578473ffffffffffffffffffffffffffffffffffffffff1663c57559dd886000015160008a60200151306002426112119190611a9c565b6040518663ffffffff1660e01b815260040161123094939291906118aa565b6000604051808303818588803b15801561124957600080fd5b505af115801561125d573d6000803e3d6000fd5b5050505050611384565b82156112fa578473ffffffffffffffffffffffffffffffffffffffff1663762b1562886000015160008a60200151306002426112a39190611a9c565b6040518663ffffffff1660e01b81526004016112c3959493929190611946565b600060405180830381600087803b1580156112dd57600080fd5b505af11580156112f1573d6000803e3d6000fd5b50505050611383565b8473ffffffffffffffffffffffffffffffffffffffff16635c11d795886000015160008a60200151306002426113309190611a9c565b6040518663ffffffff1660e01b8152600401611350959493929190611946565b600060405180830381600087803b15801561136a57600080fd5b505af115801561137e573d6000803e3d6000fd5b505050505b5b6000600267ffffffffffffffff8111156113a1576113a0611c13565b5b6040519080825280602002602001820160405280156113cf5781602001602082028036833780820191505090505b509050816001815181106113e6576113e5611be4565b5b60200260200101518160008151811061140257611401611be4565b5b602002602001018181525050828415611432573073ffffffffffffffffffffffffffffffffffffffff16316114db565b886020015160018151811061144a57611449611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161148a9190611866565b60206040518083038186803b1580156114a257600080fd5b505afa1580156114b6573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906114da9190611764565b5b6114e59190611af6565b816001815181106114f9576114f8611be4565b5b602002602001018181525050809650505050505050919050565b60405180608001604052806000815260200160608152602001600073ffffffffffffffffffffffffffffffffffffffff1681526020016000151581525090565b600061156661156184611a26565b611a01565b9050808382526020820190508285602086028201111561158957611588611c47565b5b60005b858110156115b9578161159f8882611645565b84526020840193506020830192505060018101905061158c565b5050509392505050565b6000813590506115d281611c90565b92915050565b6000815190506115e781611c90565b92915050565b600082601f83011261160257611601611c42565b5b8151611612848260208601611553565b91505092915050565b60008135905061162a81611ca7565b92915050565b60008151905061163f81611ca7565b92915050565b60008151905061165481611cbe565b92915050565b6000602082840312156116705761166f611c51565b5b600061167e848285016115d8565b91505092915050565b600080600080608085870312156116a1576116a0611c51565b5b60006116af878288016115c3565b94505060206116c0878288016115c3565b93505060406116d1878288016115c3565b92505060606116e28782880161161b565b91505092959194509250565b60006020828403121561170457611703611c51565b5b600082015167ffffffffffffffff81111561172257611721611c4c565b5b61172e848285016115ed565b91505092915050565b60006020828403121561174d5761174c611c51565b5b600061175b84828501611630565b91505092915050565b60006020828403121561177a57611779611c51565b5b600061178884828501611645565b91505092915050565b600061179d83836117a9565b60208301905092915050565b6117b281611b2a565b82525050565b6117c181611b2a565b82525050565b60006117d282611a62565b6117dc8185611a7a565b93506117e783611a52565b8060005b838110156118185781516117ff8882611791565b975061180a83611a6d565b9250506001810190506117eb565b5085935050505092915050565b61182e81611b72565b82525050565b6000611841601583611a8b565b915061184c82611c67565b602082019050919050565b61186081611b68565b82525050565b600060208201905061187b60008301846117b8565b92915050565b600060408201905061189660008301856117b8565b6118a36020830184611857565b9392505050565b60006080820190506118bf6000830187611825565b81810360208301526118d181866117c7565b90506118e060408301856117b8565b6118ed6060830184611857565b95945050505050565b6000602082019050818103600083015261190f81611834565b9050919050565b600060408201905061192b6000830185611857565b818103602083015261193d81846117c7565b90509392505050565b600060a08201905061195b6000830188611857565b6119686020830187611825565b818103604083015261197a81866117c7565b905061198960608301856117b8565b6119966080830184611857565b9695505050505050565b600060c0820190506119b56000830189611857565b6119c26020830188611857565b6119cf6040830187611857565b6119dc6060830186611857565b6119e96080830185611857565b6119f660a0830184611857565b979650505050505050565b6000611a0b611a1c565b9050611a178282611b84565b919050565b6000604051905090565b600067ffffffffffffffff821115611a4157611a40611c13565b5b602082029050602081019050919050565b6000819050602082019050919050565b600081519050919050565b6000602082019050919050565b600082825260208201905092915050565b600082825260208201905092915050565b6000611aa782611b68565b9150611ab283611b68565b9250817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0483118215151615611aeb57611aea611bb5565b5b828202905092915050565b6000611b0182611b68565b9150611b0c83611b68565b925082821015611b1f57611b1e611bb5565b5b828203905092915050565b6000611b3582611b48565b9050919050565b60008115159050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000611b7d82611b68565b9050919050565b611b8d82611c56565b810181811067ffffffffffffffff82111715611bac57611bab611c13565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f536e6970723a20494e56414c49445f414d4f554e540000000000000000000000600082015250565b611c9981611b2a565b8114611ca457600080fd5b50565b611cb081611b3c565b8114611cbb57600080fd5b50565b611cc781611b68565b8114611cd257600080fd5b5056fea2646970667358221220acee5f2c1c0e029fa09a41d0a9d4a886353273a73f2e236bae64339d2638d67b64736f6c63430008070033'
				};

				// custom rpc call
				let response = await this.node.send('eth_call', localConfig);

				// decode
				let values = ethers.utils.defaultAbiCoder.decode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], response);

				// store in object
				let txReturned = {

					bGasUsed: parseInt(ethers.utils.parseUnits(`${values[0]}`, 'wei')),
					sGasUsed: parseInt(ethers.utils.parseUnits(`${values[1]}`, 'wei')),

					buyExpected: parseInt(ethers.utils.parseUnits(`${values[2]}`, 'wei')),
					buyReceived: parseInt(ethers.utils.parseUnits(`${values[3]}`, 'wei')),

					sellExpected: parseInt(ethers.utils.parseUnits(`${values[4]}`, 'wei')),
					sellReceived: parseInt(ethers.utils.parseUnits(`${values[5]}`, 'wei'))

				};

				return resolve({

					buyGas: txReturned.bGasUsed,
					sellGas: txReturned.sGasUsed,
					buyTax: Math.round(((txReturned.buyExpected - txReturned.buyReceived) / txReturned.buyExpected * 100 * 10) / 10),
					sellTax: Math.round(((txReturned.sellExpected - txReturned.sellReceived) / txReturned.sellExpected * 100 * 10) / 10)

				});

			} catch (err) {
				return resolve({
					error: err
				});
			}

		});
	}

	async honeypotCheck(interaction, tokenAddress) {
		// initialize ctx
		let ctx = new ethers.Contract(
			tokenAddress,
			constants.TOKEN_ABI,
			this.networkaccount
		);

		tokenAddress = tokenAddress.trim();

		// fetch ticker
		let ticker = await ctx.symbol();
		let decimals = await ctx.decimals();

		// fetch hp / tax info
		let simulation = await this.simulateTransaction(tokenAddress);

		let honeypot = simulation.error ? true : false;

		let buyTax = honeypot ? '-' : simulation.buyTax;
		let sellTax = honeypot ? '-' : simulation.sellTax;

		let buyGas = honeypot ? '-' : simulation.buyGas;
		let sellGas = honeypot ? '-' : simulation.sellGas;

		// fetch if verified

		let verified = this.isContractVerified(tokenAddress) ? 'false' : 'true';

		// fetch contract info
		// let contractinfo = await etherscan.call({
		// 	module: 'token',
		// 	action: 'tokeninfo',
		// 	contractaddress: tokenAddress
		// });

		// fetch holder info

		let contractholders = await this.fetchContractHolders(tokenAddress)

		let holderString = '', holderAmountString = '';

		for (let i = 0; i < contractholders.length; i++) {

			if (!contractholders[i])
				continue;

			holderString += `[${(Helpers.dotdot(contractholders[i].TokenHolderAddress))}](https://etherscan.io/address/${contractholders[i].TokenHolderAddress})\n`;

			if (contractholders[i].TokenHolderQuantity)
				holderAmountString += `${Math.round(ethers.utils.formatEther(contractholders[i].TokenHolderQuantity, decimals).toString() / 100) * 100} ${ticker}\n`;
			else
				holderAmountString += `0 ETH\n`;
		}

		interaction.reply({
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(honeypot ? 0xbd0000 : 0x02bd00)
					.setTitle(`${ticker}/WETH`)
					.setDescription(hptext)
					.addFields(
						{ name: 'Buy Tax', value: buyTax.toString(), inline: true },
						{ name: 'Buy Gas', value: buyGas.toString(), inline: true },
						{ name: 'Buy', value: (honeypot ? ':red_circle:' : ':green_circle:'), inline: true },
					)
					.addFields(
						{ name: 'Sell Tax', value: sellTax.toString(), inline: true },
						{ name: 'Sell Gas', value: sellGas.toString(), inline: true },
						{ name: 'Sell', value: (honeypot ? ':red_circle:' : ':green_circle:'), inline: true },
					)
					.addFields(
						{ name: 'Holder', value: holderString, inline: true },
						{ name: 'Amount', value: holderAmountString, inline: true },
					)
					.addFields(
						{ name: 'Verified', value: verified },
					)
				// .addFields(
				// 	{ name: 'Description', value: contractinfo[0].description, inline: true }
				// )
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					// new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
				),
			]
		});

		// if doesn't exist
		// if (!this.isTokenAvailable(tokenAddress)) {
		// 	this.availableTokens.push({
		// 		address: tokenAddress.toLowerCase(),
		// 		interaction: interaction.id

		// 	});
		// }
	}

	async wait(seconds) {

		return new Promise((resolve, reject) => {

			setTimeout(() => {
				resolve();
			}, seconds * 1000)

		});

	}

	getMinutesFromNow(minutes) {
		return Date.now() + 1000 * 60 * minutes;
	}

	matchWithOrder(orderData, curTokenPrice) {

		console.log(`orderData?.mentionedPrice ${orderData?.mentionedPrice}`);
		const mentionedPrice = ethers.BigNumber.from(orderData?.mentionedPrice);
		const changedAmount = mentionedPrice.mul(orderData?.slippagePercentage).div(100);
		console.log(`changedAmount ${changedAmount}`);
		console.log(`orderData?.isBuy ${orderData?.isBuy}`);

		let slippedPrice;
		if (orderData?.isBuy) {
			slippedPrice = mentionedPrice.sub(changedAmount);
		}
		else {
			slippedPrice = mentionedPrice.add(changedAmount);
		}

		console.log(`slippedPrice ${slippedPrice}`);
		console.log(`is gt? ${curTokenPrice.gt(slippedPrice)}`);
		console.log(`is lt? ${curTokenPrice.lt(slippedPrice)}`);
		console.log(`curTokenPrice ${curTokenPrice}`);
		if (!orderData?.isBuy) {
			return curTokenPrice.gt(slippedPrice);
		}
		else {
			return curTokenPrice.lt(slippedPrice);
		}
	}


	async getBalnaceForETH(walletAddress) {
		console.log(`start getBalnaceForETH`);
		try {

			const bal = await this.node.getBalance(walletAddress.toLowerCase());
			console.log(`balance of wallet${walletAddress} is ${ethers.utils.formatEther(bal)}eth.`);
			return bal;
		}
		catch (err) {
			console.log(`error in node.getBalance is ${err}`)
			throw `Error: Getting balance of wallet(${walletAddress}) get failed.\nError :` + err;
		}

		return ethers.utils.parseUnits(`0`, 18);
	}
}

module.exports = new Network();