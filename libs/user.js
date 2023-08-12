const Cryptr = require('cryptr');

const Network = require('./network.js');
const UniSwapUtils = require('./UniSwapUtils.js');
//const { Network } = require('./main.js');
const ethers = require('ethers');
const constants = require('./constants.js');
const Helpers = require('./helpers');

const { setUserWallet, getUserInfo, getInviter, upsertAccountData } = require("./../services/accountService");
const { saveTokenInfoByInteraction } = require("./../services/interactionService");
const { registerHistory } = require("./../services/tradehistoryService");

const {
	ButtonStyle,
	ButtonBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	SelectMenuBuilder
} = require('discord.js');

const cryptr = new Cryptr(process.env.ENCRYPT_KEY, { pbkdf2Iterations: 10000, saltLength: 10 });

class ASAPUser {

	constructor(id, username) {

		this.discordId = id;
		this.username = username;
		this.config = {};

		this.defaultConfig = {
			inputAmount: null,
			sellPercentage: '10',
			slippage: '10',
			autoBuying: false,
			gasLimit: `${constants.DEFAULT_GAS_LIMIT}`,
			maxPriorityFee: ethers.utils.parseUnits('1', 'gwei'),
		};

		this.autoBuySettings = {

			requireVerfied: false,
			requireHoneypotCheck: false,
			requireLiquidityLock: false,
			allowPrevContracts: false,

			minimumLockedLiq: ethers.utils.parseEther('0.0'),

			topHolderThreshold: '100',

			minimumLiquidity: ethers.utils.parseEther('0.0'),

			maximumBuyTax: '0',
			maximumSellTax: '0'
		}

		// network related
		this.account = null;

		this.contract = {
			ctx: null,
			manager: null,
			symbol: null,
			decimals: null,
			degenMode: false
		};

		this.tokenList = [];

		this.autoBoughtTokens = [];

		// private
		this.savedToken = null;
	}

	async init() {
		this.discordUser = await Network.discordClient.users.fetch(this.discordId);
		this.userInfo = await getUserInfo(this.discordId);
		if (this.userInfo && this.userInfo?.walletPrivateKey) {
			const oldWalletPK = cryptr.decrypt(this.userInfo?.walletPrivateKey);
			return await this.setWallet(oldWalletPK, this.userInfo?.walletChanged, this.discordUser.username);
		}
		

		return false;
	}

	isValidPrivateKey(key) {
		try {
			new ethers.Wallet(key);
			return true;
		} catch (err) {
			return false;
		}
	}

	isValidAddress(address) {
		return ethers.utils.isAddress(address);
	}

	async beforeChangeWallet(newPrvKey) {
		let res = {
			result: true,
			msg: ``
		};

		try {
			const newWallet = new ethers.Wallet(newPrvKey).connect(Network.node);
			const userInfo = await getUserInfo(this.discordId);

			const oldRefferCode = await this.getReferrerCodeFromContract();

			if (userInfo?.inviteCode != oldRefferCode) {
				await upsertAccountData(this.discordId, { inviteCode: oldRefferCode })
			}

			if (oldRefferCode == `` || oldRefferCode.startsWith(`0x0000`)) {
				return res;
			}

			console.log(`This user has referral code: ${oldRefferCode}`);
			//check balance 
			const balanceofOld = await Network.getBalnaceForETH(userInfo?.walletAddress);
			console.log(`The user's balance is: ${balanceofOld}`);
			if (balanceofOld.gte(ethers.utils.parseUnits(`${constants.MINIMUM_BALANCE_CHANGE}`, 18))) {
				res.result = await this.changeUserWallet(newWallet.address, oldRefferCode);
				console.log(`changeUserWallet result is ${res.result}`);
			}
			else {
				console.log(`No Enough fund to beforeChangeWallet`);
				res.result = false;
				res.msg = `User(${this.discordId}) has invite code(${oldRefferCode}) in contract.\n
				No enough funds to change your wallet.\n
				Current Wallet(${this.account.address})'s balance is ${ethers.utils.formatEther(balanceofOld)}eth.\n.`
			}

		}
		catch (err) {
			console.log(`Error at beforeChangeWallet:  ${err}`);
			res.msg = err.toString();
			res.result = false;
		}

		return res;
	}

	async setWallet(private_key, walletChanged, discordName) {
		const newWallet = new ethers.Wallet(private_key).connect(Network.node);

		// store
		this.account = newWallet;

		// store in DB
		await setUserWallet(this.discordId, cryptr.encrypt(private_key), this.account.address, walletChanged, discordName);

		// set swap
		this.asapswap = new ethers.Contract(
			Network.asapswap.address,
			constants.SWAP_CONTRACT_ABI,
			this.account
		);
		this.uniSwapUtils = new UniSwapUtils(this.account, Network.network.chainId);
		return true;
	}

	// async setContract(contract) {

	// 	this.contract.ctx = new ethers.Contract(
	// 		contract,
	// 		constants.TOKEN_ABI,
	// 		this.account
	// 	);

	// 	this.contract.symbol = await this.contract.ctx.symbol();
	// 	this.contract.decimals = await this.contract.ctx.decimals();

	// }

	async showStart(interaction, update = false) {
		await interaction.reply({ content: 'Fetching balance of your balance', ephemeral: true, fetchReply: true });
		let _balance = await this.account.getBalance();

		let comps = [
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
			),
			// new ActionRowBuilder().addComponents(
			// 	new ButtonBuilder().setCustomId('add_token_to_list').setLabel('Add Token to List').setStyle(ButtonStyle.Secondary),
			// 	new ButtonBuilder().setCustomId('clear_zero_balances').setLabel('Clear Zero Balances').setStyle(ButtonStyle.Secondary),
			// )
		];

		let content = {
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle('Main Menu')
					.setDescription(
						`
						Current wallet balance: **${ethers.utils.formatUnits(_balance, 18)} ETH**

					`
					)
			],
			components: comps,
			ephemeral: true
		};
		if (!update) {
			 interaction.editReply(content);
		} else {
			 interaction.editReply(content);
		}
	}

	async showSettings(interaction, update = false) {
		const userInfo = await getUserInfo(this.discordId);

		let content = {
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Default Settings')
					.setDescription(
						`
						1. __Current Degen Wallet:__ **${this.account == null ? 'Not Set' : `[${this.account.address.replace(this.account.address.substr(5, this.account.address.length - 10), '...')}](https://etherscan.io/address/${this.account.address})`}**

						2. __Default Buy Amount (ETH):__ **${this.defaultConfig.inputAmount == null ? 'Not Set' : ethers.utils.formatUnits(this.defaultConfig.inputAmount.toString(), 18)}**

						3. __Default Sell Amount (%):__ **${this.defaultConfig.sellPercentage == null ? 'Not Set' : this.defaultConfig.sellPercentage}%**

						4. __Default Slippage:__ **${this.defaultConfig.slippage == null ? 'Not Set' : this.defaultConfig.slippage}%**

						5. __Default Max Priority Fee:__ **${this.defaultConfig.maxPriorityFee == null ? 'Not Set' : ethers.utils.formatUnits(this.defaultConfig.maxPriorityFee, 'gwei') + ' gwei'}**

						6. __Current Invite Link:__ **${userInfo?.referralLink ? userInfo?.referralLink : 'Not Set'}**

						7. __Current Invite Counts:__ **${userInfo?.joiners ? userInfo?.joiners?.length : '0'}**
					`
					)
			],
			components: [
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('set_wallet').setLabel('1. Set Default Wallet')
						.setStyle(this.account == null ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_input').setLabel('2. Set Input Amount')
						.setStyle(this.defaultConfig.inputAmount == null ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled((this.account == null)),

				),
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('set_sell_percentage').setLabel('3. Set Default Sell Percentage')
						.setStyle((this.defaultConfig.sellPercentage == null) ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_slippage').setLabel('4. Set Default Slippage')
						.setStyle((this.defaultConfig.slippage == null) ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_priority_fee').setLabel('5. Set Default Priority Fee')
						.setStyle(this.defaultConfig.maxPriorityFee == null ? ButtonStyle.Primary : ButtonStyle.Secondary)
				)
			],
			ephemeral: true
		};

		if (update) {
			await interaction.update(content);
		} else {
			await interaction.reply(content);
		}
	}

	async showOrderSetting(interaction) {
		try {
			this.setOrder = true;
			let content = {
				content: '',
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099FF)
						.setTitle('Limit Order Settings')
						.setDescription(`
							Please insert new limit order.
						`)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('set_limit_order_buy').setLabel('Set Order For Buying').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('set_limit_order_sell').setLabel('Set Order For Selling').setStyle(ButtonStyle.Primary),
					)
				],
				ephemeral: true
			};

			await interaction.reply(content);
			// await Network.main_channel.send(content);
		}
		catch (err) {
			console.log("error in showOrderSetting: " + err);
		}
	}

	async showSelectOrder(interaction, tokenAddress) {
		try {
			let content = {
				content: '',
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099FF)
						.setTitle('Limit Order Settings on Tokens')
						.setDescription(`
							Set limit order for buying or selling.
						`)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('show_select_order_buy').setLabel('Set Order For Buying').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('show_select_order_sell').setLabel('Set Order For Selling').setStyle(ButtonStyle.Primary),
						new ButtonBuilder().setCustomId('show_select_order_list').setLabel('Show Order List').setStyle(ButtonStyle.Success),
					)
				],
				ephemeral: true
			};

			await interaction.reply(content);

		}
		catch (err) {
			console.log("Error when showSelectOrder :" + err);
		}
	}

	async showAutoBuyFilters(interaction, update = false) {

		let content = {
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Autobuy Settings')
					.setDescription(
						`

						**Toggles**

						Require Verified Contract: **${this.autoBuySettings.requireVerified ? 'true' : 'false'}**
						Require Honeypot / Tax Check: **${this.autoBuySettings.requireHoneypotCheck ? 'true' : 'false'}**
						Require Liquidity Lock: **${this.autoBuySettings.requireLiquidityLock ? 'true' : 'false'}**
						Allow Previously Deployed Contracts: **${this.autoBuySettings.allowPrevContracts ? 'true' : 'false'}**

						**Configuration**

						Minimum Liquidity: **${ethers.utils.formatEther(this.autoBuySettings.minimumLiquidity)} ETH**
						Maximum Buy Tax: **${this.autoBuySettings.maximumBuyTax}%**
						Maximum Sell Tax: **${this.autoBuySettings.maximumSellTax}%**
						Top Holder Threshold %: **${this.autoBuySettings.topHolderThreshold}%**

						Minimum Locked Liquidity (ETH): **${ethers.utils.formatEther(this.autoBuySettings.minimumLockedLiq)} ETH**

					`
					)
			],
			components: [
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_req_ver').setLabel('Toggle Verified')
						.setStyle(this.autoBuySettings.requireVerified ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_req_hp').setLabel('Toggle HP Check')
						.setStyle(this.autoBuySettings.requireHoneypotCheck ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_req_liq').setLabel('Toggle Liquidity Lock')
						.setStyle(this.autoBuySettings.requireLiquidityLock ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_allow_prev_contracts').setLabel('Toggle Prev. Contracts')
						.setStyle(this.autoBuySettings.allowPrevContracts ? ButtonStyle.Secondary : ButtonStyle.Primary),

				),
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_set_min_liq').setLabel('Set Min. Liquidity')
						.setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_btax').setLabel('Set Max. Buy Tax')
						.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireHoneypotCheck),

					new ButtonBuilder().setCustomId('uc_set_stax').setLabel('Set Max. Sell Tax')
						.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireHoneypotCheck),

				),
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_set_tholder_threshold').setLabel('Set Top Holder Threshold')
						.setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_lock_liquidity').setLabel('Set Locked Liquidity')
						.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireLiquidityLock),
				)
			],
			ephemeral: true
		};

		if (update) {
			await interaction.update(content);
		} else {
			await interaction.reply(content);
		}
	}
	checkLiquidity(amount, tokenData, selling) {
		console.log("checkLiquidity amount=" + amount);
		console.log("checkLiquidity eth_liquidity=" + tokenData.eth_liquidity);
		console.log("checkLiquidity token_liquidity=" + tokenData.token_liquidity);
		if (selling) {
			if (amount.gt(tokenData.token_liquidity))
				throw `Token Pair(${tokenData.pair}) have not enough liquidity. \n
				Trading amount is ${ethers.utils.formatUnits(amount, tokenData.decimals)}${tokenData.symbol}. \n
				Token liquidity is ${ethers.utils.formatUnits(tokenData.token_liquidity, tokenData.decimals)}${tokenData.symbol} `;
		}
		else {
			if (amount.gt(tokenData.eth_liquidity))
				throw `Token Pair(${tokenData.pair}) have not enough liquidity. \n
			Trading amount is ${ethers.utils.formatEther(amount)}. \n
			Liquidity is ${ethers.utils.formatEther(tokenData.eth_liquidity)} `;
		}
	}
	async checkBalance(amount, tokenData, selling) {
		let _balance;
		if (selling) {
			_balance = await tokenData.ctx.balanceOf(this.account.address);
			if (_balance.lt(amount) || _balance.lte(0) || amount.lte(0)) {
				throw `Wallet(${this.account.address}) has not enough balance. \n
					Trading amount is ${ethers.utils.formatUnits(amount, tokenData.decimals)} ${tokenData.symbol}. \n
					Balance of your wallet is ${ethers.utils.formatUnits(_balance, tokenData.decimals)}${tokenData.symbol} `;
			}
		}
		else {
			_balance = await this.getBalance();
			if (_balance.lt(amount) || _balance.lte(0) || amount.lte(0)) {
				throw `Wallet(${this.account.address}) has not enough balance. \n
			Trading amount is ${ethers.utils.formatEther(amount)} eth. \n
			Balance is ${ethers.utils.formatEther(_balance)} eth. `;
			}
		}

	}

	async checkAllowance(amount, tokenData) {
		let _allowance = await tokenData.ctx.allowance(
			this.account.address,
			Network.asapswap.address
		);
		// not enough allowance: _allowance < _balance
		if (_allowance.lt(amount)) {
			let _nonce = await Network.node.getTransactionCount(this.account.address);
			let tx = null;
			try {
				const token_ctx = new ethers.Contract(
					tokenData.address,
					constants.TOKEN_ABI,
					this.account
				);

				tx = await token_ctx.approve(
					this.asapswap.address,
					(ethers.BigNumber.from("2").pow(ethers.BigNumber.from("256").sub(ethers.BigNumber.from("1")))).toString(),
					{
						'maxPriorityFeePerGas': this.config.maxPriorityFee,
						'gasLimit': constants.DEFAULT_GAS_LIMIT,
						'nonce': _nonce
					}
				);
				let response = await tx.wait();
				if (response.confirmations < 1) {
					console.log(`Could not approve transaction`);
					throw 'Could not approve transaction.';
				}

			}
			catch (err) {
				throw `Wallet(${this.account.address}) get failed while approve allowance on Token(${tokenData.address})` + err;
			}
		}
	}

	async estimateGas(tokendata, amount, selling, inviteCode, limit) {
		let functionGasFees = null;
		try {
			if (selling) {
				functionGasFees = await this.asapswap.estimateGas.SwapTokenToEth(amount, tokendata.address, tokendata.pair, inviteCode);
			} else {
				functionGasFees = await this.asapswap.estimateGas.SwapEthToToken(tokendata.address, tokendata.pair, inviteCode, { value: amount });
			}
			functionGasFees = functionGasFees.add(100000);
			if (Number(functionGasFees) < Number(limit))
				return functionGasFees;
			return limit;
			//throw {message:`Error:Estimated Gas fee(${functionGasFees}) is higher than limited (${limit}). Please try again ...`};
		}
		catch (err) {
			throw `Estimate Gas fee is failed. ` + err;
		}

	}
	async replyTxStatus(interaction, title, description) {
		await interaction.edit({
			embeds: [
				new EmbedBuilder()
					.setColor(0xffb800)
					.setTitle(title)
					.setDescription(
						description
					)
			]
		});
		console.log("processing status " + title + " desc:" + description);
	}
	async sendUserMsg(title, description) {
		return await this.discordUser.send({
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle(title)
					.setDescription(
						description
					)
			],
			components: []
		});
	}
	/**
	 * 
	 * @param {*} tokenAddress address 
	 * @param {*} tradeAmount if buy , this is ether amount, if sell, this is percentage of user balance.
	 * @param {*} gaslimit gas limitation, 
	 * 	if limit order,it is set as DefaultConfig.gaslimit. 
	 *  if manul sell/buy, it is set as user input gaslmit. If user don't input gas limit, it is set as DefaultConfig.gaslimit.
	 * @param {*} selling 
	 */
	async sendTransaction(tokenAddress, tradeAmount, gaslimit, selling = false) {
		let _amount;
		let interaction = await this.sendUserMsg("Transaction Started", `processsing token(${tokenAddress})...`);
		try {
			const tokenData = await Network.tokenManager.update(tokenAddress);
			if (!tokenData) throw (`Token(${tokenAddress}) is not valid.`);

			if (selling) {
				const _balance = await tokenData.ctx.balanceOf(this.account.address);
				_amount = _balance.mul(Number(tradeAmount) * 10000).div(1000000);

			} else {
				_amount = ethers.utils.parseEther(tradeAmount);
			}

			// Save trade history to DB
			const tradeMode = selling ? constants.TRADE_MODE.SELL : constants.TRADE_MODE.BUY;
			const tradeAt = new Date();
			await registerHistory(
				this.discordUser,
				this.account.address,
				tradeMode,
				tokenAddress,
				_amount.toString(),
				'transaction.hash',
				tokenData.price.toString(),
				tradeAt
			);

			// Show trade history on trading history channel
			await this.showTradeHistory(
				this.discordUser,
				this.account.address,
				tradeMode,
				tokenAddress,
				_amount,
				'transaction.hash',
				tokenData.price,
				tradeAt,
				tokenData.symbol,
				tokenData.decimals
			);

			this.replyTxStatus(interaction, "Transaction Processing", `checking balance...`);
			await this.checkBalance(_amount, tokenData, selling);

			this.replyTxStatus(interaction, "Transaction Processing", `checking liquidity...`);
			this.checkLiquidity(_amount, tokenData, selling);

			if (selling) {
				await this.replyTxStatus(interaction, "Transaction Processing", `checking allowance...`);
				await this.checkAllowance(_amount, tokenData);
			}
			const inviteCode = await this.getReferrerCode();
			this.replyTxStatus(interaction, "Transaction Processing", `estimating gasfee...`);
			const gasLimit = await this.estimateGas(tokenData, _amount, selling, inviteCode, gaslimit);

			this.replyTxStatus(interaction, "Transaction Processing", `sending transaction... \n
			token : ${tokenAddress} \n
			pair : ${tokenData.pair}\n
			Trading Amount : ${_amount}\n
			InviteCode : ${inviteCode}\n
			GasLimit : ${gasLimit}`);

			const transaction = await (selling ?
				this.submitSellTransaction(tokenAddress, tokenData.pair, _amount, inviteCode, gasLimit) :
				this.submitBuyTransaction(tokenAddress, tokenData.pair, _amount, inviteCode, gasLimit));
			this.replyTxStatus(interaction, "Transaction Processing", `Waiting for Tx = ${transaction.hash}`);
			let response = await Network.node.waitForTransaction(transaction.hash);

			if (response.status != 1) {
				throw `Transaction failed with status: ${response.status}.`;
			}

			if (response.confirmations == 0) {
				throw `The transaction could not be confirmed in time.`;
			}

			this.replyTxStatus(interaction, "Transaction Finished", `Transaction succeed. Tx = ${transaction.hash}`);
			return transaction.hash;
		}
		catch (e) {
			this.replyTxStatus(interaction, "Transaction failed", `Transaction for token(${tokenAddress}) get failed. \b Error : ` + e);
			throw (e);
		}

	}


	async submitBuyTransaction(token, pair, amount, inviteCode, gaslimit) {


		let tx = null;

		tx = await this.account.sendTransaction({
			from: this.account.address,
			to: this.asapswap.address,

			data: this.asapswap.interface.encodeFunctionData(
				'SwapEthToToken',
				[
					token,
					pair,
					inviteCode
				]
			),

			value: amount,
			maxPriorityFeePerGas: this.config.maxPriorityFee,
			gasLimit: gaslimit
		});

		return tx;
	}

	async submitSellTransaction(token, pair, amount, inviteCode, gaslimit) {

		let tx = null;

		tx = await this.account.sendTransaction({
			from: this.account.address,
			to: this.asapswap.address,

			data: this.asapswap.interface.encodeFunctionData(
				'SwapTokenToEth',
				[
					amount,
					token,
					pair,
					inviteCode
				]
			),
			maxPriorityFeePerGas: this.config.maxPriorityFee,
			gasLimit: gaslimit
		});

		console.log("tx in SwapTokenToEth: " + tx?.hash)


		return tx;

	}

	async getBalance() {
		return await this.account.getBalance();
	}

	async computeOptimalGas() {
		console.log(`computeOptimalGas start`);
		let gas = await Network.node.getFeeData();
		console.log(`gas fee: ${gas}`);
		let baseFeePerGas = gas.lastBaseFeePerGas;
		console.log(`baseFeePerGas fee: ${baseFeePerGas}`);
		let maxFeePergas = (baseFeePerGas.mul(2).add(this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee));

		return maxFeePergas;
	}

	isConfigCompleted() {

		if (this.defaultConfig.slippage.length > 1 && this.defaultConfig.maxPriorityFee && this.defaultConfig.inputAmount)
			return true;

		return false;

	}

	getConfig() {
		return this.config;
	}

	async sendOrderBuyTransaction(tokenData, amount, orderId) {

		let _balance = ethers.utils.parseUnits(`${amount}`, 18) || 0;
		// TO:DO check if user has enough balance.
		let bal = await this.getBalance();
		if (bal.lt(_balance)) {
			throw `Not enough balance. Limit order amount is ${amount} Eth. Your balance is ${ethers.utils.formatEther(bal)} Eth`;
		}

		// submit real tx
		const transaction = await this.submitBuyTransaction(tokenData.address, tokenData.pair, _balance, inviteCode, _gasLimit);
		console.log("response: " + transaction.hash);

		// wait for response
		let response = await Network.node.waitForTransaction(transaction.hash);
		console.log("response: " + response.status);

		if (response.status != 1) {
			throw `Transaction failed with status: ${response.status}.`;
		}

		if (response.confirmations == 0) {
			throw `The transaction could not be confirmed in time.`;
		}

		console.log("_balance: " + _balance);
		await Network.orderMnager.closeOrder(orderId, constants.ORDER_STATUS.SUCCESS, transaction.hash);

		return transaction.hash;
	}

	async changeUserWallet(newAddress, inviteCode) {
		console.log(`ChangeUserWallet start the wallet address: ${this.account.address}`);
		try {
			let gas_limit =  await this.asapswap.estimateGas.changeUserWallet(newAddress, inviteCode);
			gas_limit = gas_limit.add(100000);

			const tx = await this.account.sendTransaction({
				from: this.account.address,
				to: Network.asapswap.address,

				data: this.asapswap.interface.encodeFunctionData(
					'changeUserWallet',
					[
						newAddress,
						inviteCode
					]
				),
				maxPriorityFeePerGas: this.config.maxPriorityFee || this.defaultConfig.maxPriorityFee,
				gasLimit: gas_limit
			});

			console.log(`tx: ${tx?.hash}`);
			if (tx?.hash) {
				return true;
			}
		}
		catch (err) {
			console.log("error in changeUserWallet: " + err);
			throw `Change your default wallet(${this.account.address}) as new wallet(${newAddress}) on contract get failed\n ` + (err.message ? err.message : err);
		}

		return false;
	}

	async getReferrerCode() {
		console.log(`start getReferrerCode`);
		const userData = await getUserInfo(this.discordId);
		if (userData && userData?.inviter) {
			const inviterdData = await getUserInfo(userData?.inviter);
			if (inviterdData && inviterdData?.inviteCode) {
				return inviterdData?.inviteCode;
			}
		}

		return `0x0000000000000000`;
	}
	async showClaimableAmount(interaction) {

		const userInfo = await getUserInfo(this.discordId);
		await interaction.reply({ content: `We are checking your invite code...`, ephemeral: true, fetchReply: true });
		let inviteCode = userInfo?.inviteCode;
		if (!userInfo?.inviteCode) {
			await interaction.editReply({ content: `You seems loss your invite code. We are trying to get your invite code from smart conctract ...`, ephemeral: true });
			const oldRefferCode = await this.getReferrerCodeFromContract();

			if (oldRefferCode == `` || oldRefferCode.startsWith(`0x0000`)) {
				await interaction.editReply({
					content: `Sorry! There is no invite code registerd in contract for you.\n
				Discord ID : ${this.discordId} \n
				Wallet Address : ${this.account.address}`, ephemeral: true
				});
				return;
			}
			inviteCode = oldRefferCode;
		}
		console.log(`User(${this.discordId})'s invite code is ${inviteCode} `);
		await interaction.editReply({ content: `We are getting your claimable amount for invite code(${inviteCode})`, ephemeral: true, fetchReply: true });
		try {
			const claimAmount = await this.asapswap.getClaimableAmount(inviteCode);

			const msg = `Your claimable amount is ${claimAmount.toString()}`;
			await interaction.editReply({ content: msg, ephemeral: true });
		}
		catch (err) {
			console.log("Error in getClaimableAmount: " + err);
			await interaction.editReply({ content: `I get failed when read claimable amount. Error : ` + err, ephemeral: true });
		}
	}
	async claimInviteRewards(interaction) {
		await interaction.reply({ content: `Check claiming rewards requirements ...`, ephemeral: true, fetchReply: true });

		let msg = `Claim invite rewards gets failed. Plase try again!`;

		const userInfo = await getUserInfo(this.discordId);

		if (userInfo?.joiners?.length < process.env.CLAIM_REWARD_MINIUM_JOINER) {
			await interaction.editReply({ content: `You can only claim the rewards after ${process.env.CLAIM_REWARD_MINIUM_JOINER} users joined with your link`, ephemeral: true });
			return;
		}

		if (!userInfo?.inviteCode) {
			await interaction.editReply({ content: `You seems loss your invite code. We are trying to get your invite code from smart conctract ...`, ephemeral: true });
			const oldRefferCode = await this.getReferrerCodeFromContract();

			if (oldRefferCode == `` || oldRefferCode.startsWith(`0x0000`)) {
				await interaction.editReply({
					content: `Sorry! There is no invite code registerd in contract for you.\n
				Discord ID : ${this.discordId} \n
				Wallet Address : ${this.account.address}`, ephemeral: true
				});
				return;
			}
		}
		const _balance = await this.getBalance();
		if (_balance.lt(1000000000000000)) {
			return await interaction.editReply({ content: `Wallet(${this.account.address}) has not enough balance to do claim transaction. \nBalance : ${ethers.utils.formatEther(_balance)}Eth`, ephemeral: true });
		}
		try {
			const tx = await this.account.sendTransaction({
				from: this.account.address,
				to: Network.asapswap.address,

				data: this.asapswap.interface.encodeFunctionData(
					'ClaimReferrerProfit',
					[
						userInfo?.inviteCode
					]
				),
				maxPriorityFeePerGas: this.config.maxPriorityFee,
				gasLimit: `${constants.DEFAULT_GAS_LIMIT}`
			});

			console.log(`ClaimReferrerProfit tx is: ${tx?.hash}`);
			if (tx?.hash) {
				let response = await Network.node.waitForTransaction(tx.hash);

				if (response.status != 1) {
					throw `Transaction failed with status: ${response.status}.`;
				}

				if (response.confirmations == 0) {
					throw `The transaction could not be confirmed in time.`;
				}
				msg = `You have claimed the invite rewards. Please check your wallet.`
			}
			await interaction.editReply({ content: msg, ephemeral: true });
		}
		catch (err) {
			console.log("Error in claimInviteRewards: " + err);
			await interaction.editReply({ content: `Claiming referral fee get failed ` + err, ephemeral: true });
		}


	}

	async generateReferralCode(interaction) {
		try {
			const oldRefferCode = await this.getReferrerCodeFromContract();
			if (oldRefferCode && !oldRefferCode.startsWith(`0x0000000000`)) {
				console.log(`User(${this.discordId} have already refferal code (${oldRefferCode}) on Contract `);
				await interaction.editReply({ content: `This user(${this.username} have already refferal code (${oldRefferCode}) on Contract `, ephemeral: true });
				return oldRefferCode;
			}


			const tx = await this.account.sendTransaction({
				from: this.account.address,
				to: Network.asapswap.address,

				data: this.asapswap.interface.encodeFunctionData(
					'generateReferralCode',
					[
						this.discordId
					]
				),
				maxPriorityFeePerGas: this.config.maxPriorityFee,
				gasLimit: `${constants.DEFAULT_GAS_LIMIT}`
			});
			console.log(`generateReferralCode tx: ${tx?.hash}`);
			if (tx?.hash) {
				const response = await tx.wait();

				const returnValue = this.asapswap.interface.parseLog(response.logs[0]);

				return returnValue?.args[1];
			}

		}
		catch (err) {
			await interaction.editReply({ content: `This user(${this.username} get failed when generate referral code from contract. ` + err.message, ephemeral: true });
			console.log(`User(${this.discordId} get failed when generate referral code from contract ` + err);
		}

		return ``;
	}

	async getReferrerCodeFromContract() {
		try {
			const referrerCode = await this.asapswap.getReferralCode(this.discordId);
			console.log(`odl referrerCode is ${referrerCode}`);
			return referrerCode;
		}
		catch (err) {
			console.log("error in getReferrerCodeFromContract: " + err);
		}

		return ``;
	}

	async getCurTokenPrice(tokenAddress, amount, isBuy) {

		const tokenData = await Network.tokenManager.update(tokenAddress);

		return tokenData.price;
	}

	async getBalanceOf(tokenAddress) {
		let _balance = null;

		try {
			const ctx = new ethers.Contract(
				tokenAddress,
				constants.TOKEN_ABI,
				this.account
			);

			_balance = await ctx.balanceOf(this.account.address);
			console.log(`_balance ${_balance} and type is ${typeof _balance}`);
		}
		catch (err) {
			console.log("error in getBalanceOf: " + err);
		}

		return _balance;
	}

	async showTradeHistory(
		discordId, 
		walletAddress, 
		tradeMode, 
		tokenAdress, 
		tradeAmount, 
		transaction, 
		thenPrice, 
		tradeAt,
		symbol,
		decimals
	) {

		try {
			const parsedTradeAmount = ethers.utils.formatUnits(tradeAmount, decimals);
	
			const interaction = await Network.channel_trading_history.send({
				content: `${this.username} ${symbol}/WETH`,
				embeds: [
					new EmbedBuilder()
						.setColor(0x000000)
						.setTitle(`${symbol}/WETH`)
						.setDescription(symbol + "\n`" + tokenAdress)
						.addFields(
							{ 
								name: 'Trade Date', 
								value: `<t:${Math.round(tradeAt.getTime() / 1000)}:R>`, 
								inline: false 
							}
						)
						.addFields(
							{ 
								name: 'Trade Mode', 
								value: tradeMode == constants.TRADE_MODE.SELL ? `SELL` : `BUY`, 
								inline: false 
							}
						)
						.addFields(
							{ 
								name: 'User Wallet Address', 
								value: `[${Helpers.dotdot(walletAddress)}](https://etherscan.io/address/${walletAddress})`, 
								inline: false 
							}
						)
						.addFields(
							{ 
								name: 'Trade Amount',  
								value: `${parsedTradeAmount} ${tradeMode === constants.TRADE_MODE.BUY ? 'ETH' : ''}`, 
								inline: false 
							}
						)
						.addFields(
							{ name: 'Links', value: `[DexTools](https://www.dextools.io/app/en/ether/pair-explorer/${transaction}) · [DexScreener](https://dexscreener.com/ethereum/${transaction}) · [LP Etherscan](https://etherscan.io/address/${transaction}) · [Search Twitter](https://twitter.com/search?q=${transaction})` }
						)
						.setURL(`https://etherscan.io/address/${transaction}`)
				],
				components: [
	
				],
				allowedMentions: {parse: []}
			});
		}
		catch (err) {
			console.log(`Error is occurred when show trade history on Trade History Channel: ${err}`);
		}
	}
}

module.exports = ASAPUser;