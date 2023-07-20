const ethers = require('ethers');
const fs = require('node:fs');
const path = require('node:path');

const Cryptr = require('cryptr');

const mongoose = require('mongoose');

const { getTokenInfoByInteraction } = require("./services/swap");
const { setOrder, getOrders } = require("./services/orderService");
const { setFeeInfo } = require("./services/accountService");

const { User, UserCollection, Helpers, Network } = require('./libs/main.js');
const constants = require('./libs/constants.js');
require('dotenv').config()
const { 
	Client, 
	Collection,
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
const Fetch = require('./libs/fetchcoins');

const etherscan = new(require('./libs/etherscan'))(constants.EHTERSCAN_API_KEY);

const cryptr = new Cryptr(constants.ENCRYPT_KEY, { pbkdf2Iterations: 10000, saltLength: 10 });

let originalLog = console.log;

console.log = function(msg) {

	fs.appendFile('debug.log', `[${getFormattedDate()}] ${msg}\n`, err => {
	  if (err) {
	    console.error(err);
	  }
	});

	return originalLog(`[${getFormattedDate()}] ${msg}`);
}

function getFormattedDate() {
    let date = new Date();

    let hours = "", minutes = "", seconds = "";

    if(date.getHours() < 10)
        hours = "0" + date.getHours();
    else 
        hours = date.getHours();

    if(date.getMinutes() < 10)
        minutes = "0" + date.getMinutes();
    else 
        minutes = date.getMinutes();

    if(date.getSeconds() < 10)
        seconds = "0" + date.getSeconds();
    else 
        seconds = date.getSeconds();

    let str = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + hours + ":" + minutes + ":" + seconds;

    return str;
}

process.on('uncaughtException', (e, origin) => {

    let error = e.error ? e.error : e;

    console.log(`Exception: ${error}`);

    if(e.stack) {
    	console.log(e.stack);
    }

});

// main wrapper
(async () => {
	
	mongoose.Promise = Promise;

	let mongoUri = `mongodb://devopshint:devopshint@44.197.67.107:27017/asap?authSource=admin`;
	if (constants.IS_TEST_MODE) {
		mongoUri = `mongodb://devopshint:devopshint@44.197.67.107:27017/asap-test?authSource=admin`;
	}

	mongoose?.connect(mongoUri);
	mongoose?.connection.on('error', () => {
		console.log(`unable to connect to database: ${mongoUri}`)
	})
	mongoose?.connection.on('success', () => {
		console.log(`connected to database: ${mongoUri}`)
	})

	// load network
	await Network.load();

	if(false) {
		const oldWalletPK = cryptr.decrypt(`989efa962500763d4fa3deaec67c8679804a0b5fea9a4031a354c5297b61b9c8f14ab70bc418398cd55fa721a325cd55ea5e9f7704d12b15ea4dedc24a328769fa120fd68bc0f4f55800fef0a029e96776d822cd028d85e90f70b9543a7e922dd887ba6ca4cbaf05f0d6`);
		console.log(oldWalletPK);
		return;
	}

	// initialize client
	const client = new Client({ intents: [ GatewayIntentBits.Guilds ] });
	client.commands = new Collection();

	// listen for commands
	client.on(Events.InteractionCreate, async (interaction) => {
		
		if(!UserCollection.exists(interaction.user.id)) {

			UserCollection.add(
				interaction.user.id, 
				new User(interaction.user.username, interaction.user.id)
			);

		}

		// fetch user
		let _user = UserCollection.get(interaction.user.id);
		await _user.init();

		if(interaction.isChatInputCommand()) {

			const command = interaction.client.commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
			}

			return;

		}

		// interactions that don't care about auth (use return to stop code)
		if(interaction.isButton()) {

			switch(interaction.customId) {
				case `set_user_fee`: {					
					const modal = new ModalBuilder()
									.setCustomId('set_user_fee')
									.setTitle('Set User Fee')
									.addComponents([
										new ActionRowBuilder().addComponents(
											new TextInputBuilder()
												.setCustomId('discord_id_user').setLabel('Discord Id')
												.setStyle(TextInputStyle.Short)
												.setValue(``)
												.setPlaceholder("Enter User's Discord ID")
												.setRequired(true),
										),
										new ActionRowBuilder().addComponents(
											new TextInputBuilder()
												.setCustomId('user_fee').setLabel('Fee value of Discord User')
												.setStyle(TextInputStyle.Short)
												.setValue(`0`)
												.setPlaceholder('Enter the fee percentage between 0 and 100')
												.setRequired(true),
										)
									]);

					await interaction.showModal(modal);
				}

				case 'setup': {

					await _user.showSettings(interaction);

					return;
				}

				case 'set_wallet': {

					const modal = new ModalBuilder()
				        .setCustomId('set_wallet_key')
				        .setTitle('Set Wallet')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
				              	.setCustomId('wallet-key').setLabel('Enter your wallet private key')
				              	.setStyle(TextInputStyle.Paragraph).setMinLength(64)
				              	.setPlaceholder('0x1234..')
				              	.setRequired(true),
				          	),
				        ]);

				    await interaction.showModal(modal);

				   	return;
				}

				case 'setup_auto': {
					await _user.showAutoBuyFilters(interaction);

					return;
				}

				case 'uc_req_ver': {

					_user.autoBuySettings.requireVerified = !_user.autoBuySettings.requireVerified;

					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'uc_req_hp': {

					_user.autoBuySettings.requireHoneypotCheck = !_user.autoBuySettings.requireHoneypotCheck;

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}

				case 'uc_req_liq': {

					_user.autoBuySettings.requireLiquidityLock = !_user.autoBuySettings.requireLiquidityLock;

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}

				case 'uc_allow_prev_contracts': {

					_user.autoBuySettings.allowPrevContracts = !_user.autoBuySettings.allowPrevContracts;

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}

				case 'uc_set_btax': {

					const modal = new ModalBuilder()
				        .setCustomId('set_btax')
				        .setTitle('Set Max. Buy Tax')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('b-tax').setLabel('Max Buy Tax')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setMaxLength(3)
					              	.setValue(_user.autoBuySettings.maximumBuyTax)
					              	.setPlaceholder('A value between 0 and 100.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					return;
				}

				case 'uc_set_stax': {

					const modal = new ModalBuilder()
				        .setCustomId('set_stax')
				        .setTitle('Set Max. Sell Tax')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('s-tax').setLabel('Max Sell Tax')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setMaxLength(3)
					              	.setValue(_user.autoBuySettings.maximumSellTax)
					              	.setPlaceholder('A value between 0 and 100.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					return;
				}

				case 'uc_set_tholder_threshold': {

					const modal = new ModalBuilder()
				        .setCustomId('set_tholder')
				        .setTitle('Set Max Top Holder Threshold')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('holder_threshold').setLabel('Threshold')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setMaxLength(3)
					              	.setValue(_user.autoBuySettings.topHolderThreshold)
					              	.setPlaceholder('A value between 0 and 100.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					return;
				}

				case 'uc_set_lock_liquidity': {

					const modal = new ModalBuilder()
				        .setCustomId('set_lockedliq')
				        .setTitle('Set Min. Locked Liquidity Percentage')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('locked_liq').setLabel('Min. Locked Liquidity')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setValue(ethers.utils.formatEther(_user.autoBuySettings.minimumLockedLiq))
					              	.setPlaceholder('A value ETH value.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					return;
				}

				case 'uc_set_min_liq': {

					const modal = new ModalBuilder()
				        .setCustomId('set_min_liq')
				        .setTitle('Set Min. Liquidity')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('min_liq').setLabel('Min. Liquidity In ETH')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setValue(ethers.utils.formatEther(_user.autoBuySettings.minimumLiquidity))
					              	.setPlaceholder('A valid ETH value.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					return;
				}
			}

		} else if(interaction.isModalSubmit()) {

			switch(interaction.customId) {

				case `set_user_fee`: {
					let feepercentage = interaction.fields.getTextInputValue('user_fee').toString();
					console.log(`feepercentage: ${feepercentage}`);
					if(!Helpers.isInt(feepercentage) || feepercentage > 100 || feepercentage < 1) {
						return interaction.reply({ content: 'Fee percentage must be a valid number between 0 and 100.', ephemeral: true});
					}

					let userID = interaction.fields.getTextInputValue('discord_id_user').toString();
					if(!Helpers.isValidDiscordUserId(userID)) {
						return interaction.reply({ content: `User ID ${userID} is invalid!`, ephemeral: true});
					}

					const result = await setFeeInfo(userID, Number(feepercentage));
					let msg = `Setring user fee is failed. Please check your network!`;
					if(result?.result) {
						await Network.setUserFee(walletAddress, feepercentage);
						if(result?.oldWalletAddress) {
							await Network.setUserDefaultFee(result?.oldWalletAddress);
						}
						msg = `User ${userID}'s fee is set to ${feepercentage}%!`;
					}

					await interaction.reply({ content: msg });
				}

				case 'set_wallet_key': {	

					if(!_user.isValidPrivateKey(interaction.fields.getTextInputValue('wallet-key').trim())) {
						return interaction.reply({ content: 'Invalid privatekey specified.', ephemeral: true});
					}

					// set wallet
					await _user.setWallet(interaction.fields.getTextInputValue('wallet-key').trim());

					await _user.showSettings(interaction, true);
					
					return;
				}

				case 'set_btax': {

					let tax = interaction.fields.getTextInputValue('b-tax');

					if(!Helpers.isInt(tax) || tax > 100 || tax < 1) {
						return interaction.reply({ content: 'Buy tax must be a valid number between 0 and 100.', ephemeral: true});
					}

					_user.autoBuySettings.maximumBuyTax = tax;

					await _user.showAutoBuyFilters(interaction, true);

					return;
				}

				case 'set_stax': {

					let tax = interaction.fields.getTextInputValue('s-tax');

					if(!Helpers.isInt(tax) || tax > 100 || tax < 1) {
						return interaction.reply({ content: 'Sell tax must be a valid number between 0 and 100.', ephemeral: true});
					}

					_user.autoBuySettings.maximumSellTax = tax;

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}

				case 'set_tholder': {

					let tax = interaction.fields.getTextInputValue('holder_threshold');

					if(!Helpers.isInt(tax) || tax > 100 || tax < 1) {
						return interaction.reply({ content: 'Threshold must be a valid number between 0 and 100.', ephemeral: true});
					}

					_user.autoBuySettings.topHolderThreshold = tax;

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}

				case 'set_lockedliq': {

					let tax = interaction.fields.getTextInputValue('locked_liq');

					if(!Helpers.isFloat(tax)) {
						return interaction.reply({ content: 'ETH value must be a valid float.', ephemeral: true});
					}

					_user.autoBuySettings.minimumLockedLiq = ethers.utils.parseEther(tax);

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}

				case 'set_min_liq': {

					let tax = interaction.fields.getTextInputValue('min_liq');

					if(!Helpers.isFloat(tax)) {
						return interaction.reply({ content: 'ETH value must be a valid float.', ephemeral: true});
					}

					_user.autoBuySettings.minimumLiquidity = ethers.utils.parseEther(tax);

					await _user.showAutoBuyFilters(interaction, true);
					
					return;
				}
			}

		}

		// if we've gotten till here, that means that we're looking for auth
		if(!_user.account) {
			return interaction.reply({
				content: 'You must set a default wallet first.',
				ephemeral: true,
				embeds: [],
				components: []
			});
		} 

		if(interaction.isStringSelectMenu()) {

			switch(interaction.customId) {

				case 'select_token': {

					if(_user.tokenList[interaction.values[0]] == null) {
						return interaction.reply({
							content: 'Something went wrong..',
							ephemeral: true
						});
					}

					// process
					await _user.selectFromTokenList(interaction, interaction.values[0])

					break;
				}

			}

		}
		else if(interaction.isModalSubmit()) {

			switch(interaction.customId) {

				case 'set_sell_percentage': {

					if(!Helpers.isInt(interaction.fields.getTextInputValue('sell-percentage'))) {
						return interaction.reply({ content: 'Sell percentage must be a valid number.', ephemeral: true});
					}

					_user.defaultConfig.sellPercentage = interaction.fields.getTextInputValue('sell-percentage');

					await _user.showSettings(interaction, true);

					break;
				}

				case 'add_token': {

					if(!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
						return interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
					}

					let status = await _user.addManualTokenToList(interaction.fields.getTextInputValue('token-address'));

					if(!status) {

						return interaction.reply({
							content: 'Invalid token specified.',
							embeds: [],
							components: [],
							ephemeral: true
						});

					}

					await _user.showStart(interaction, true);

					break;
				}

				case 'buy_new': {

					if(!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
						return interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
					}

					let slippage = interaction.fields.getTextInputValue('slippage-percentage');

					if(!Helpers.isInt(slippage) || parseInt(slippage) < 1 || parseInt(slippage) > 100) {
						return interaction.reply({ content: 'Slippage percentage must be a valid number (1-100).', ephemeral: true});
					}

					let gaslimit = interaction.fields.getTextInputValue('gas-limit');

					if(gaslimit.length != 0 && !Helpers.isInt(gaslimit)) {
						return interaction.reply({ content: 'Gas limit must be a valid number.', ephemeral: true })
					}

					let input = interaction.fields.getTextInputValue('token-amount-eth').toString();

					if(!Helpers.isFloat(input)) {
						return interaction.reply({ content: 'Token amount must be a valid number.', ephemeral: true});
					}

					// check if balance is enough
					let _balance = await _user.getBalance();

					// not enough
					if(_balance.lt(ethers.utils.parseUnits(input, 18)) || _balance.eq(0)) {
						return interaction.reply({ content: 'You don\'t have enough ETH', ephemeral: true});
					}

					await interaction.reply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});

					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;				

					// store gaslimit
					_user.config.gasLimit = !gaslimit ? null : gaslimit;

					// set contractethers
					await _user.setContract(interaction.fields.getTextInputValue('token-address'));

					// set values from form
					_user.config.inputAmount = ethers.utils.parseUnits(
						input, 
						18
					);
					// _user.defaultConfig.inputAmount = ethers.utils.parseUnits(
					// 	input, 
					// 	18
					// );
					// consol.log(_user.defaultConfig.inputAmount)

					// set slippage
					_user.config.slippage = slippage;

					// do buying action
					await _user.sendNormalTransaction(interaction);

					break;
				}

				case 'sell_new': {

					if(!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
						return interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
					}

					let slippage = interaction.fields.getTextInputValue('slippage-percentage');

					if(!Helpers.isInt(slippage) || parseInt(slippage) < 1 || parseInt(slippage) > 100) {
						return interaction.reply({ content: 'Slippage percentage must be a valid number (1-100).', ephemeral: true});
					}

					let gaslimit = interaction.fields.getTextInputValue('gas-limit');

					if(gaslimit.length != 0 && !Helpers.isInt(gaslimit)) {
						return interaction.reply({ content: 'Gas limit must be a valid number.', ephemeral: true })
					}

					let percentage = interaction.fields.getTextInputValue('sell-percentage');

					if(!Helpers.isInt(percentage) || parseInt(percentage) < 1 || parseInt(percentage) > 100) {
						return interaction.reply({ content: 'Sell percentage must be a valid number (1-100).', ephemeral: true});
					}

					await interaction.reply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});

					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;

					// store gaslimit
					_user.config.gasLimit = !gaslimit ? null : gaslimit;

					// set contract
					await _user.setContract(interaction.fields.getTextInputValue('token-address'));

					// check if balance is enough
					let _balance = await _user.contract.ctx.balanceOf(_user.account.address);

					// not enough
					if(_balance.lt(_balance.div(100).mul(_user.config.sellPercentage)) || _balance.eq(0)) {
						return interaction.reply({ content: 'You don\'t have enough tokens.', ephemeral: true});
					}

					// set values from form
					_user.config.sellPercentage = percentage;

					// set slippage
					_user.config.slippage = slippage;

					// do selling action
					await _user.sendNormalTransaction(interaction, true);

					break;
				}

				case 'set_buy_order': {

					const orderAmount = interaction.fields.getTextInputValue('order_buy_amount').toString();
					console.log(`orderAmount when buying: ${orderAmount}`);
					if(!Helpers.isFloat(orderAmount)) {
						return interaction.reply({ content: 'Order amount must be a valid number.', ephemeral: true});
					}

					const orderPercentage = interaction.fields.getTextInputValue('order_buy_percentage').toString();
					console.log(`orderPercentage when buying: ${orderPercentage}`);
					if(!Helpers.isInt(orderPercentage) || orderPercentage > 100 || orderPercentage < 1) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true});
					}

					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenDataByInteraction: " + tokenDataByInteraction);
					console.log("tokenAddress: " + tokenAddress);

					const curPrice = await Network.getCurTokenPrice(tokenAddress);

					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const res = await setOrder(interaction.user.id, tokenAddress, curPrice, Number(orderAmount), Number(orderPercentage), true);

						if(res) {
							msg = `Your orders were saved successfully!`;
						}
					}
					catch(err) {
						console.log(`error when saving limit values to DB: ${err}`)
					}

					await interaction.reply({ content: msg });

					break;
				}

				case 'set_sell_order': {

					const orderAmount = interaction.fields.getTextInputValue('order_sell_amount').toString();
					console.log(`orderAmount when selling: ${orderAmount}`);
					if(!Helpers.isFloat(orderAmount)) {
						return interaction.reply({ content: 'Order amount must be a valid number.', ephemeral: true});
					}

					const orderPercentage = interaction.fields.getTextInputValue('order_sell_percentage').toString();
					console.log(`orderPercentage when buying: ${orderPercentage}`);
					if(!Helpers.isInt(orderPercentage) || orderPercentage < -100 || orderPercentage > 0) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and -100.', ephemeral: true});
					}

					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenDataByInteraction: " + tokenDataByInteraction);
					console.log("tokenAddress: " + tokenAddress);

					const curPrice = await Network.getCurTokenPrice(tokenAddress);

					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const res = await setOrder(interaction.user.id, tokenAddress, curPrice, Number(orderAmount), Number(orderPercentage), false);

						if(res) {
							msg = `Your orders were saved successfully!`;
						}
					}
					catch(err) {
						console.log(`error when saving limit values to DB: ${err}`)
					}

					await interaction.reply({ content: msg });

					break;
				}

				case 'set_priority_fee': {
					if(!Helpers.isFloat(interaction.fields.getTextInputValue('priority-fee'))) {
						return interaction.reply({ content: 'Input must be a valid number.', ephemeral: true});
					}

					_user.defaultConfig.maxPriorityFee = ethers.utils.parseUnits(interaction.fields.getTextInputValue('priority-fee'), 'gwei');

					await _user.showSettings(interaction, true);

					break;
				}

				case 'set_input_amount': {
					if(!Helpers.isFloat(interaction.fields.getTextInputValue('input-amount'))) {
						return interaction.reply({ content: 'Input must be a valid number.', ephemeral: true});
					}

					let formattedInput = ethers.utils.parseUnits(
						interaction.fields.getTextInputValue('input-amount').toString(), 
						18
					);

					let bal = await _user.getBalance();

					if(bal.lt(formattedInput)) {
						return interaction.reply({ content: 'You don\'t have enough ETH.', ephemeral: true});
					}

					// store formatted input
					_user.defaultConfig.inputAmount = formattedInput;

					await _user.showSettings(interaction, true);

					break;
				}

				case 'set_slippage': {
			
					if(!Helpers.isInt(interaction.fields.getTextInputValue('slippage'))) {
						return interaction.reply({ content: 'Slippage must be a valid number.', ephemeral: true});
					}

					// store in private key cfg
					_user.defaultConfig.slippage = interaction.fields.getTextInputValue('slippage');

					await _user.showSettings(interaction, true);

					break;
				}
			}

		} else if(interaction.isButton()) {

			// actions that require a valid wallet
			switch(interaction.customId) {
				
				case 'start': {

					await _user.showStart(interaction);

					break;
				} 
				
				case 'start_auto': {

					if(!_user.isConfigCompleted()) {
						return interaction.reply({
							content: 'You must fill in all the fields in the config.',
							ephemeral: true,
							embeds: [],
							components: []
						});
					}

					_user.defaultConfig.autoBuying = true;

					await _user.showAutoStart(interaction);

					Network.handleLiquidityTokens({
						hash: '0x53029d961cc27b3410052d0aab4a4b9054d4de5de4dfd8d702bbcad34875b20d',
						data: '0xf305d719000000000000000000000000ec59c15ea71e2e325470b534a64e9faa1319d3710000000000000000000000000000000000000000033b2e3c9fd0803ce80000000000000000000000000000000000000000000000033b2e3c9fd0803ce80000000000000000000000000000000000000000000000000000000e043da6172500000000000000000000000000006a6eed3ccc894f13f39b76c9aa99efdacf7d7f990000000000000000000000000000000000000000000000000000000064600187'
					});

					break;
				}

				case 'refresh_auto': {
					await _user.showAutoStart(interaction);
					break;
				}

				case 'stop_auto': {

					_user.defaultConfig.autoBuying = false;

					await _user.showAutoStart(interaction);

					break;
				}

				case 'buy': {

					// if interaction id is found, set contract
					for(let i = 0; i < Network.availableTokens.length; i++) {

						if(Network.availableTokens[i].interaction != interaction.message.id)
							continue;

						await _user.setContract(Network.availableTokens[i].address);

						break;

					}

					const modal = new ModalBuilder()
				        .setCustomId('buy_new')
				        .setTitle('Buy A Token')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
					              	.setCustomId('token-address').setLabel('Token Address')
					              	.setStyle(TextInputStyle.Short).setMaxLength(42)
					              	.setValue((_user.contract.ctx) ? _user.contract.ctx.address : '').setPlaceholder('0x123')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
					              	.setCustomId('token-amount-eth').setLabel('Amount In ETH')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(_user.defaultConfig.inputAmount != null ? ethers.utils.formatUnits(_user.defaultConfig.inputAmount.toString(), 18) : '0.1').setPlaceholder('0.001')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('slippage-percentage').setLabel('Slippage Percentage')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(_user.defaultConfig.slippage).setPlaceholder('10')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('gas-limit').setLabel('Gas Limit')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setMaxLength(10)
					              	.setPlaceholder('Leave empty to retrieve gaslimit automatically.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'sell': {

					// if interaction id is found, set contract
					for(let i = 0; i < Network.availableTokens.length; i++) {

						if(Network.availableTokens[i].interaction != interaction.message.id)
							continue;

						await _user.setContract(Network.availableTokens[i].address);

						break;

					}

					const modal = new ModalBuilder()
				        .setCustomId('sell_new')
				        .setTitle('Sell A Token')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
					              	.setCustomId('token-address').setLabel('Token Address')
					              	.setStyle(TextInputStyle.Short).setMaxLength(42)
					              	.setValue((_user.contract.ctx) ? _user.contract.ctx.address : '').setPlaceholder('0x123')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
					              	.setCustomId('sell-percentage').setLabel('Sell Percentage')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(_user.defaultConfig.sellPercentage).setPlaceholder('10')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('slippage-percentage').setLabel('Slippage Percentage')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(_user.defaultConfig.slippage).setPlaceholder('10')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('gas-limit').setLabel('Gas Limit')
					              	.setStyle(TextInputStyle.Short)
					              	.setRequired(false)
					              	.setMaxLength(10)
					              	.setPlaceholder('Leave empty to retrieve gaslimit automatically.'),
				            ),
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'set_buy_order': {
					const modal = new ModalBuilder()
				        .setCustomId('set_buy_order')
				        .setTitle('Set Order')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('order_buy_percentage').setLabel('The percantage of order')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and 100')
					              	.setRequired(true),
				            ),
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('order_buy_amount').setLabel('Limit amount of order')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the limit amount in ETH for buying token')
					              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'set_sell_order': {
					const modal = new ModalBuilder()
				        .setCustomId('set_sell_order')
				        .setTitle('Set Order')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('order_sell_percentage').setLabel('The percantage of order')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and -100')
					              	.setRequired(true),
				            ),
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('order_sell_amount').setLabel('Limit amount of order')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the limit amount in ETH for selling token')
					              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'order_list': {
					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenDataByInteraction: " + tokenDataByInteraction);
					console.log("tokenAddress: " + tokenAddress);

					const orderList = await getOrders(interaction.user.id, tokenAddress);

					if(!orderList || orderList.length == 0) {
						return interaction.reply({ content: 'No order set on this token.', ephemeral: true});
					}

					let modeList = ``, amoutList = ``, tokenList = ``, percentList = ``, cancelList = ``;
					orderList.forEach((order) => {
						if(order?.isBuy) {
							modeList = modeList + `Buy \n`;
							amoutList = amoutList + `${order?.purchaseAmount.toFixed(3)} \n`;
						}
						else {
							modeList = modeList + `Sell \n`;
							amoutList = amoutList + `${order?.purchaseAmount.toFixed(3)}% \n`;
						}

						tokenList += `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})\n`;
						percentList = percentList + `${order?.slippagePercentage}% \n`;
						cancelList = cancelList + `Cancel \n`;
					});

					const msgsent = await interaction.user.send({
						content: ``,
						embeds: [
							new EmbedBuilder()
								.setColor(0x000000)
								.setTitle(`Order List`)
								.setDescription(``)
								.addFields(
									{ name: 'Mode', value: modeList, inline: true },
									{ name: 'Amount', value: amoutList, inline: true },
									{ name: 'Token Address', value: tokenList , inline: true },
									{ name: 'Percentage', value: percentList , inline: true },
									{ name: 'Cancel', value: cancelList , inline: true },
								)
						],
					});

					break;
				}

				case 'limit_order': {
					const orderBuyButton = new ButtonBuilder().setCustomId('set_buy_order').setLabel('Set Order For Buying').setStyle(ButtonStyle.Primary);
					const orderSellButton = new ButtonBuilder().setCustomId('set_sell_order').setLabel('Set Order For Selling').setStyle(ButtonStyle.Primary);
					const orderListButton = new ButtonBuilder().setCustomId('order_list').setLabel('Order List').setStyle(ButtonStyle.Primary);

					const modal = new ModalBuilder()
				        .setCustomId('limit_order')
				        .setTitle('Set Order')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            orderBuyButton
				            ),
							new ActionRowBuilder().addComponents(
					            orderSellButton
				            ),
							new ActionRowBuilder().addComponents(
					            orderSorderListButtonellButton
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'ape': {

					// if interaction id is found, set contract
					for(let i = 0; i < Network.availableTokens.length; i++) {

						if(Network.availableTokens[i].interaction != interaction.message.id)
							continue;

						await _user.setContract(Network.availableTokens[i].address);

						break;

					}

					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;

					_user.sendNormalTransactionApe(interaction, false);

					await interaction.reply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});

					break;

				}

				case 'set_input': {

					const modal = new ModalBuilder()
				        .setCustomId('set_input_amount')
				        .setTitle('Set Input Amount')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            new TextInputBuilder()
				              	.setCustomId('input-amount').setLabel('Enter the amount you wish to spend.')
				              	.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(64)
				              	.setValue(_user.defaultConfig.inputAmount != null ? ethers.utils.formatUnits(_user.defaultConfig.inputAmount.toString(), 18) : '0.1').setPlaceholder('0.1')
				              	.setRequired(true),
				          	),
				        ]);

				    await interaction.showModal(modal);

				    break;
				}

				case 'set_slippage': {

					const modal = new ModalBuilder()
				        .setCustomId('set_slippage')
				        .setTitle('Set Slippage')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
				              	.setCustomId('slippage').setLabel('Enter the buy slippage')
				              	.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(3)
				              	.setValue(_user.defaultConfig.slippage || '10').setPlaceholder('10')
				              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

				    break;
				}

				case 'add_token_to_list': {

					const modal = new ModalBuilder()
				        .setCustomId('add_token')
				        .setTitle('Add Token To List')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
				              	.setCustomId('token-address').setLabel('Enter the address of the token')
				              	.setStyle(TextInputStyle.Short).setMinLength(40).setMaxLength(42)
				              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'clear_zero_balances': {

					await _user.updateTokenList();

					await _user.showStart(interaction, true);

					break;
				}

				case 'set_sell_percentage': {

					const modal = new ModalBuilder()
				        .setCustomId('set_sell_percentage')
				        .setTitle('Set Sell Percentage')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
				              	.setCustomId('sell-percentage').setLabel('Enter the sell percentage')
				              	.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(3)
				              	.setValue(_user.defaultConfig.sellPercentage).setPlaceholder('10')
				              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);
					
					break;
				}

				case 'set_priority_fee': {

					const modal = new ModalBuilder()
				        .setCustomId('set_priority_fee')
				        .setTitle('Set Max Priority Fee')
				        .addComponents([
				          	new ActionRowBuilder().addComponents(
				            	new TextInputBuilder()
				              	.setCustomId('priority-fee').setLabel('Enter the max priority fee in gwei')
				              	.setStyle(TextInputStyle.Short).setMinLength(1).setMaxLength(3)
				              	.setValue(ethers.utils.formatUnits(_user.defaultConfig.maxPriorityFee.toString(), 'gwei')).setPlaceholder('10')
				              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

				    break;
				}

				case 'enable_auto_buying': {

					_user.defaultConfig.autoBuying = !_user.defaultConfig.autoBuying;

					// show main page
					await _user.showSettings(interaction, true);

					break;

				}

				case 'delete': {

					// if token is not found, show start
					if(_user.tokenList[_user.savedToken] == null) {
						return _user.showStart(interaction, true);
					}

					// remove
					_user.tokenList.splice(_user.savedToken, 1);

					// reset
					_user.savedToken = null;

					// show main page
					await _user.showStart(interaction, true);

					break;
				}

				case 'back_to_start': {

					await _user.showStart(interaction, true);

					break;
				}

			}

		}
	});

	client.once(Events.ClientReady, async (c) => {

		console.log(`Logged in as ${c.user.tag}`);

		let content = JSON.parse((await fs.readFileSync('conf.json')));

		// store channels
		Network.channel_new_liquidity = c.channels.cache.get(process.env.CHANNEL_NEW_LIQUIDTY);
		Network.channel_locked_liquidity = c.channels.cache.get(process.env.CHANNEL_LOCKED_LIQUIDITY);
		Network.channel_open_trading = c.channels.cache.get(process.env.CHANNEL_OPEN_TRADING);

		// if channel is stored, delete the old one
		if(content.mainchannel) {

			let channel = c.channels.cache.get(content.mainchannel.id);

			if(channel) {
				await channel.delete();
			}
		}
		
		let guild = c.guilds.cache.get(process.env.SERVER_ID);
	
		// create new one
		content.mainchannel = await guild.channels.create({
		    name: process.env.BOT_NAME,
		    type: ChannelType.GuildText,
		    permissionOverwrites: [
		    	{
		    		id: guild.roles.everyone,
		    		allow: [PermissionsBitField.Flags.ViewChannel],
		    	}
		    ]
		});

		// add to parent
		await content.mainchannel.setParent(process.env.WALLET_MANAGER_CATEGORY_ID);

		// Declare the admin channel
		const adminChannel = c.channels.cache.get(process.env.CHANNEL_ADMIN);

		if(!adminChannel) {
			console.log(`Can not find admin channel, Comfirm the channel ID.`);
		}
		else {
			adminChannel.messages.fetch({ limit: 100 })
							.then(messages => {
								adminChannel.bulkDelete(messages);
							})
  							.catch((err) => {
								console.log(`Error in clearing in the admin channel: ${err}`);
							});

			await adminChannel.send({
				content: 'Welcome, This is the admin channel.',
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('set_user_fee').setLabel('Set User Fee').setStyle(ButtonStyle.Primary)
					),
				]
			});
		}

		// save config
		await fs.writeFileSync('conf.json', JSON.stringify(content));

		await content.mainchannel.send({ 
			content: 'Welcome, what do you want me to do?', 
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('start').setLabel('Start').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('setup').setLabel('Config').setStyle(ButtonStyle.Secondary),
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('start_auto').setLabel('Start Auto Buying').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('setup_auto').setLabel('Config').setStyle(ButtonStyle.Secondary),
				)
			]
		});
	});

	// login
	await client.login(process.env.TOKEN);
})();