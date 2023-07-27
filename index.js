const ethers = require('ethers');
const fs = require('node:fs');
const path = require('node:path');

const Cryptr = require('cryptr');

const mongoose = require('mongoose');

const { getTokenInfoByInteraction } = require("./services/swap");
const { getTokenInfoByUserId } = require("./services/tokenService");
const { setOrder, getOrders, updateOrder, getOrder, deleteOrder } = require("./services/orderService");
const { setFeeInfo, setReferralLink, increaseReferralCount, getCreator, getUserInfo, upsertAccountData } = require("./services/accountService");
const { setTokenPrice } = require("./services/priceService");

const Contract = require('./libs/contract.js');

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
	Invite,
	ChannelType,
	PermissionsBitField,
	ModalBuilder,
	TextInputBuilder, 
	TextInputStyle, 
	ActionRowBuilder, 
	GatewayIntentBits,
	GatewayDispatchEvents,
	ActivityType
} = require('discord.js');
const paginationEmbed = require('discord.js-pagination');
const Fetch = require('./libs/fetchcoins');

const etherscan = new(require('./libs/etherscan'))(process.env.EHTERSCAN_API_KEY);

const cryptr = new Cryptr(process.env.ENCRYPT_KEY, { pbkdf2Iterations: 10000, saltLength: 10 });

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

	const mongoUri = process.env.MONGO_DB_URL;

	mongoose?.connect(mongoUri);
	mongoose?.connection.on('error', () => {
		console.log(`unable to connect to database: ${mongoUri}`);
		return;
	})
	mongoose?.connection.on('success', () => {
		console.log(`connected to database: ${mongoUri}`)
	})

	// load network
	await Network.load();

	// initialize client
	const client = new Client({ intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers ] });
	client.commands = new Collection();
	client.invites = new Collection();

	// listen for commands
	client.on(Events.InteractionCreate, async (interaction) => {
		
		if(!UserCollection.exists(interaction.user.id)) {

			UserCollection.add(
				interaction.user.id, 
				new User(interaction.user.username, interaction.user.id)
			);
			const new_user = UserCollection.get(interaction.user.id);
			await new_user.init();
		}

		// fetch user
		let _user = UserCollection.get(interaction.user.id);

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
				
				case 'create_wallet': {
					console.log(`start create wallet`);
					let msg = `Wallet Creating is failed. Please try again!`;
					try {
						const wallet = ethers.Wallet.createRandom();

						if(wallet?.address) {
							const res_before_change = await _user.beforeChangeWallet(wallet.privateKey)
							if(res_before_change?.result) {
								const res = await _user.setWallet(wallet.privateKey);
							
								if(res) {
									msg = `Private key is: ${wallet.privateKey}\nPublic Key is: ${wallet.address}`;
								}
							}
							else {
								if(res_before_change?.msg) {
									msg = res_before_change?.msg;
								}
							}
						}
					}
					catch(err) {
						console.log(`Error when creating wallet: ${err}`)
					}
					await interaction.reply({ content: msg, ephemeral: true});
					return;
				}

				// case 'restore_wallet': {
				// 	console.log(`start restore wallet`);
				// 	let msg = `Wallet Restoring is failed. Please try again!`;
				// 	try {
				// 		const result = await _user.init();
				// 		if(result) {
				// 			msg = `Wallet Restored!`;
				// 		}
				// 		else {
				// 			msg = `You have not previous wallet!`;
				// 		}
				// 	}
				// 	catch(err) {
				// 		console.log(`Error when restoring wallet: ${err}`)
				// 	}
				// 	await interaction.reply({ content: msg, ephemeral: true});
				// 	break;
				// }
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
						if(result?.oldWalletAddress) {
							await Network.setUserFee(result?.oldWalletAddress, feepercentage);
						}
						msg = `User ${userID}'s fee is set to ${feepercentage}%!`;
					}

					await interaction.reply({ content: msg });
				}

				case 'set_wallet_key': {	

					if(!_user.isValidPrivateKey(interaction.fields.getTextInputValue('wallet-key').trim())) {
						return interaction.reply({ content: 'Invalid privatekey specified.', ephemeral: true});
					}
					const res_before_change = await _user.beforeChangeWallet(interaction.fields.getTextInputValue('wallet-key').trim())

					if(res_before_change?.result) {
						const res = await _user.setWallet(interaction.fields.getTextInputValue('wallet-key').trim());
						if(res) {
							await _user.showSettings(interaction, true);
							return;
						}
					}

					if(!res_before_change?.result && res_before_change?.msg) {
						return interaction.reply({ content: res_before_change?.msg, ephemeral: true});
					}

					return interaction.reply({ content: 'Wallet setting is failed. Plaese try again!', ephemeral: true});
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
					console.log(`token_address is ${interaction.fields.getTextInputValue('token-address')}`);
					let slippage = interaction.fields.getTextInputValue('slippage-percentage');
					console.log(`slippage is ${slippage}`);
					if(!Helpers.isInt(slippage) || parseInt(slippage) < 1 || parseInt(slippage) > 100) {
						return interaction.reply({ content: 'Slippage percentage must be a valid number (1-100).', ephemeral: true});
					}

					let gaslimit = interaction.fields.getTextInputValue('gas-limit');
					console.log(`gaslimit is ${gaslimit}`);

					if(gaslimit.length != 0 && !Helpers.isInt(gaslimit)) {
						return interaction.reply({ content: 'Gas limit must be a valid number.', ephemeral: true })
					}

					let input = interaction.fields.getTextInputValue('token-amount-eth').toString();
					console.log(`input is ${input}`);
					if(!Helpers.isFloat(input)) {
						return interaction.reply({ content: 'Token amount must be a valid number.', ephemeral: true});
					}

					// check if balance is enough
					let _balance = await _user.getBalance();
					console.log(`_balance is ${_balance}`);

					// not enough
					if(_balance.lt(ethers.utils.parseUnits(input, 18)) || _balance.eq(0)) {
						return interaction.reply({ content: 'You don\'t have enough ETH', ephemeral: true});
					}
					console.log(`_balance is enough`);
					await interaction.reply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});

					const curPrice = await Network.getCurTokenPrice(interaction.fields.getTextInputValue('token-address'));
					console.log(`cur pruice` + curPrice);

					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;				

					// store gaslimit
					_user.config.gasLimit = !gaslimit ? null : gaslimit;
					console.log(`_user.config.gasLimit is ${_user.config.gasLimit}`);
					// set contractethers
					await _user.setContract(interaction.fields.getTextInputValue('token-address'));

					// set values from form
					_user.config.inputAmount = ethers.utils.parseUnits(
						input, 
						18
					);

					console.log(`_user.config.inputAmount is ${_user.config.inputAmount}`);

					// _user.defaultConfig.inputAmount = ethers.utils.parseUnits(
					// 	input, 
					// 	18
					// );
					// consol.log(_user.defaultConfig.inputAmount)

					// set slippage
					_user.config.slippage = slippage;
					console.log(`_user.config.slippage is ${_user.config.slippage}`);

					// do buying action
					await _user.sendNormalTransaction(interaction);

					break;
				}

				case 'sell_new': {

					if(!ethers.utils.isAddress(interaction.fields.getTextInputValue('token-address'))) {
						return await interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
					}
					console.log(`token address input is ${interaction.fields.getTextInputValue('token-address')}`);

					let slippage = interaction.fields.getTextInputValue('slippage-percentage');
					console.log(`slippage input is ${interaction.fields.getTextInputValue('slippage-percentage')}`);

					if(!Helpers.isInt(slippage) || parseInt(slippage) < 1 || parseInt(slippage) > 100) {
						return await interaction.reply({ content: 'Slippage percentage must be a valid number (1-100).', ephemeral: true});
					}

					let gaslimit = interaction.fields.getTextInputValue('gas-limit');
					console.log(`gaslimit input is ${interaction.fields.getTextInputValue('gas-limit')}`);

					if(gaslimit.length != 0 && !Helpers.isInt(gaslimit)) {
						return await interaction.reply({ content: 'Gas limit must be a valid number.', ephemeral: true })
					}

					let percentage = interaction.fields.getTextInputValue('sell-percentage');
					console.log(`percentage input is ${interaction.fields.getTextInputValue('sell-percentage')}`);
					
					if(!Helpers.isInt(percentage) || parseInt(percentage) < 1 || parseInt(percentage) > 100) {
						return await interaction.reply({ content: 'Sell percentage must be a valid number (1-100).', ephemeral: true});
					}

					const curPrice = await Network.getCurTokenPrice(interaction.fields.getTextInputValue('token-address'));
					console.log(`cur pruice` + curPrice);

					await interaction.reply({
						content: 'Transaction has been sent.',
						embeds: [],
						ephemeral: true
					});

					// overwrite with defaultConfig
					_user.config = _user.defaultConfig;

					// store gaslimit
					_user.config.gasLimit = !gaslimit ? null : gaslimit;
					console.log(`_user.config.gasLimit is ${_user.config.gasLimit}`);

					// set contract
					await _user.setContract(interaction.fields.getTextInputValue('token-address'));

					// check if balance is enough
					let _balance = await _user.contract.ctx.balanceOf(_user.account.address);
					console.log(`_balance ${_balance}`);

					// not enough
					// if(_balance.lt(_balance.div(100).mul(_user.config.sellPercentage)) || _balance.eq(0)) {
					// 	return await interaction.followUp({ content: 'You don\'t have enough tokens.', ephemeral: true});
					// }

					console.log(`_balance.div(100).mul(_user.config.sellPercentage): ${_balance.div(100).mul(_user.config.sellPercentage)}`);

					// set values from form
					_user.config.sellPercentage = percentage;
					console.log(`_user.config.sellPercentage: ${_user.config.sellPercentage}`);


					// set slippage
					_user.config.slippage = slippage;
					console.log(`_user.config.slippage: ${_user.config.slippage}`);

					// do selling action
					await _user.sendNormalTransaction(interaction, true);

					break;
				}

				case 'show_select_order_buy': {
					const orderAmount = interaction.fields.getTextInputValue('show_select_order_buy_amount').toString();
					console.log(`orderAmount when buying: ${orderAmount}`);
					if(!Helpers.isFloat(orderAmount)) {
						return interaction.reply({ content: 'Order amount must be a valid number.', ephemeral: true});
					}

					const orderPercentage = interaction.fields.getTextInputValue('show_select_order_buy_percentage').toString();
					console.log(`orderPercentage when buying: ${orderPercentage}`);
					if(!Helpers.isInt(orderPercentage) || orderPercentage < -100 || orderPercentage > 0) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and -100.', ephemeral: true});
					}

					const tokenDataByInteraction = await getTokenInfoByUserId(_user.discordId);
					console.log("interaction:" + interaction);
					console.log("message:" + interaction.message.id);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenAddress: " + tokenAddress);

					const curPrice = await Network.getCurTokenPrice(tokenAddress);

					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const res = await setOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), true);

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

				case 'set_limit_order_buy': {

					const orderAmount = interaction.fields.getTextInputValue('set_limit_order_buy_amount').toString();
					console.log(`orderAmount when buying: ${orderAmount}`);
					if(!Helpers.isFloat(orderAmount)) {
						return interaction.reply({ content: 'Order amount must be a valid number.', ephemeral: true});
					}

					const orderPercentage = interaction.fields.getTextInputValue('set_limit_order_buy_percentage').toString();
					console.log(`orderPercentage when buying: ${orderPercentage}`);
					if(!Helpers.isInt(orderPercentage) || orderPercentage < -100 || orderPercentage > 0) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and -100.', ephemeral: true});
					}

					const tokenAddress = interaction.fields.getTextInputValue('set_limit_order_buy_token').toString();
					if(!ethers.utils.isAddress(tokenAddress)) {
						return interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
					}
					console.log("tokenAddress: " + tokenAddress);

					const curPrice = await Network.getCurTokenPrice(tokenAddress);

					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const res = await setOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), true);

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

				case 'show_select_order_sell': {

					const orderAmount = interaction.fields.getTextInputValue('show_select_order_sell_amount').toString();
					console.log(`orderAmount when selling: ${orderAmount}`);
					if(!Helpers.isInt(orderAmount) || orderAmount < -100 || orderAmount < 0) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and -100.', ephemeral: true});
					}

					const orderPercentage = interaction.fields.getTextInputValue('show_select_order_sell_percentage').toString();
					console.log(`orderPercentage when selling: ${orderPercentage}`);
					if(!Helpers.isInt(orderPercentage) || orderPercentage < -100 || orderPercentage > 0) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and -100.', ephemeral: true});
					}

					const tokenDataByInteraction = await getTokenInfoByUserId(_user.discordId);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenAddress: " + tokenAddress);

					const curPrice = await Network.getCurTokenPrice(tokenAddress);

					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const res = await setOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), false);

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

				case 'set_limit_order_sell': {

					const orderAmount = interaction.fields.getTextInputValue('set_limit_order_sell_amount').toString();
					console.log(`orderAmount when selling: ${orderAmount}`);
					if(!Helpers.isInt(orderAmount) || orderAmount > 100 || orderAmount < 1) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true});
					}

					const orderPercentage = interaction.fields.getTextInputValue('set_limit_order_sell_percentage').toString();
					console.log(`orderPercentage when selling: ${orderPercentage}`);
					if(!Helpers.isInt(orderPercentage) || orderPercentage > 100 || orderPercentage < 1) {
						return interaction.reply({ content: 'Percentage must be a valid number between 0 and 100.', ephemeral: true});
					}

					const tokenAddress = interaction.fields.getTextInputValue('set_limit_order_sell_token').toString();
					if(!ethers.utils.isAddress(tokenAddress)) {
						return interaction.reply({ content: 'Invalid token address specified.', ephemeral: true});
					}
					console.log("tokenAddress: " + tokenAddress);

					const curPrice = await Network.getCurTokenPrice(tokenAddress);

					let msg = `Your orders were not saved! Please check you network!`;
					try {
						const res = await setOrder(interaction.user.id, tokenAddress, curPrice.toString(), Number(orderAmount), Number(orderPercentage), false);

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

				case 'set_limit_order': {
					await _user.showOrderSetting(interaction, _user.setOrder);

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

				case 'claim_invite_rewards': {
					await _user.claimInviteRewards(interaction);

					break
				}

				case 'set_limit_order_buy': {
					const modal = new ModalBuilder()
				        .setCustomId('set_limit_order_buy')
				        .setTitle('Set Order for Buying')
				        .addComponents([
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('set_limit_order_buy_token').setLabel('The Token Address')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(``)
									.setPlaceholder('Enter the token address')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('set_limit_order_buy_percentage').setLabel('The % of Token Price Drops')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and -100')
					              	.setRequired(true),
				            ),
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('set_limit_order_buy_amount').setLabel('Buy Amount In ETH')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the amount in ETH for buying token')
					              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				} 

				case 'set_limit_order_sell': {
					const modal = new ModalBuilder()
				        .setCustomId('set_limit_order_sell')
				        .setTitle('Set Order for Selling')
				        .addComponents([
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('set_limit_order_sell_token').setLabel('The Token Address')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(``)
									.setPlaceholder('Enter the token address')
					              	.setRequired(true),
				            ),
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('set_limit_order_sell_percentage').setLabel('The % of Token Price Increases')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and 100')
					              	.setRequired(true),
				            ),
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('set_limit_order_sell_amount').setLabel('The % of The Tokens To Sell')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and 100')
					              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				} 

				case 'show_select_order_buy': {
					const tokenDataByInteraction = await getTokenInfoByUserId(_user.discordId);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenAddress: " + tokenAddress);
					let curPrice = await Network.getCurTokenPrice(tokenAddress);
					curPrice = ethers.utils.formatEther(`${curPrice}`);

					console.log(`curprice to ETH: ${curPrice}`);

					const modal = new ModalBuilder()
				        .setCustomId('show_select_order_buy')
				        .setTitle('Set Buy Order')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('show_select_order_buy_percentage').setLabel(`The % of Drops: (Price: ${curPrice}ETH)`)
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and -100')
					              	.setRequired(true)
				            ),
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('show_select_order_buy_amount').setLabel('Limit amount of order')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the amount in ETH for buying token')
					              	.setRequired(true)
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'show_select_order_sell': {
					const tokenDataByInteraction = await getTokenInfoByUserId(_user.discordId);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenAddress: " + tokenAddress);
					let curPrice = await Network.getCurTokenPrice(tokenAddress);
					curPrice = ethers.utils.formatEther(`${curPrice}`);

					const modal = new ModalBuilder()
				        .setCustomId('show_select_order_sell')
				        .setTitle('Set Sell Order')
				        .addComponents([
				            new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('show_select_order_sell_percentage').setLabel(`The % of Increases: (Price: ${curPrice}ETH)`)
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and 100')
					              	.setRequired(true),
				            ),
							new ActionRowBuilder().addComponents(
					            new TextInputBuilder()
					              	.setCustomId('show_select_order_sell_amount').setLabel('The % of The Tokens To Sell')
					              	.setStyle(TextInputStyle.Short)
					              	.setValue(`0`)
									.setPlaceholder('Enter the percentage between 0 and 100')
					              	.setRequired(true),
				            )
				        ]);

				    await interaction.showModal(modal);

					break;
				}

				case 'show_select_order_list': {
					const tokenDataByInteraction = await getTokenInfoByUserId(_user.discordId);
					const { tokenAddress } = tokenDataByInteraction;
					console.log("tokenAddress: " + tokenAddress);

					const orderList = await getOrders(interaction.user.id, tokenAddress);

					if(!orderList || orderList.length == 0) {
						return interaction.reply({ content: 'No order sets on this token.', ephemeral: true});
					}

					for(let i = 0; i < orderList.length; i++) {
						const order = orderList[i];
						if(i == 0) {
							await interaction.reply({
								content: `Show Order List`,
								embeds: [
									new EmbedBuilder()
										.setColor(0x000000)
										.setTitle(`Order List`)
										.setDescription(`This shows the order list`)
										.addFields(
											{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
											{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}ETH` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
											{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})` , inline: false },
											{ name: 'Percentage', value: `${order?.slippagePercentage}%` , inline: false }
										)
								],
								components: [
									new ActionRowBuilder().addComponents(
										// new ButtonBuilder().setCustomId('edit_order').setLabel('Edit').setStyle(ButtonStyle.Primary),
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
						else {
							await interaction.followUp({
								content: `Show Order List`,
								embeds: [
									new EmbedBuilder()
										.setColor(0x000000)
										.setTitle(`Order List`)
										.setDescription(`This shows the order list`)
										.addFields(
											{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
											{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}ETH` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
											{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})` , inline: false },
											{ name: 'Percentage', value: `${order?.slippagePercentage}%` , inline: false },
										)
								],
								components: [
									new ActionRowBuilder().addComponents(
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
					}
					break;
				}

				case 'show_limit_order': {
					const orderList = await getOrders(interaction.user.id);

					if(!orderList || orderList.length == 0) {
						return interaction.reply({ content: 'You set no order.', ephemeral: true});
					}

					for(let i = 0; i < orderList.length; i++) {
						const order = orderList[i];
						if(i == 0) {
							await interaction.reply({
								content: `Show Order List`,
								embeds: [
									new EmbedBuilder()
										.setColor(0x000000)
										.setTitle(`Order List`)
										.setDescription(`This shows the order list`)
										.addFields(
											{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
											{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}ETH` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
											{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})` , inline: false },
											{ name: 'Percentage', value: `${order?.slippagePercentage}%` , inline: false }
										)
								],
								components: [
									new ActionRowBuilder().addComponents(
										// new ButtonBuilder().setCustomId('edit_order').setLabel('Edit').setStyle(ButtonStyle.Primary),
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
						else {
							await interaction.followUp({
								content: `Show Order List`,
								embeds: [
									new EmbedBuilder()
										.setColor(0x000000)
										.setTitle(`Order List`)
										.setDescription(`This shows the order list`)
										.addFields(
											{ name: 'Mode', value: order?.isBuy ? `Buy` : `Sell`, inline: false },
											{ name: 'Amount', value: order?.isBuy ? `${order?.purchaseAmount.toFixed(3)}` : `${order?.purchaseAmount.toFixed(3)}%`, inline: false },
											{ name: 'Token Address', value: `[${(Helpers.dotdot(order?.tokenAddress))}](https://etherscan.io/address/${order?.tokenAddress})` , inline: false },
											{ name: 'Percentage', value: `${order?.slippagePercentage}%` , inline: false },
										)
								],
								components: [
									new ActionRowBuilder().addComponents(
										new ButtonBuilder().setCustomId(`deleteorder_${order?._id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger)
									),
								]
							});
						}
					}
					break;
				}

				case 'limit_order': {
					const tokenDataByInteraction = await getTokenInfoByInteraction(interaction.message.id);
					const { tokenAddress } = tokenDataByInteraction;
					
					await _user.showSelectOrder(interaction, tokenAddress);

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

				case 'create_invite': {
					const user = interaction.user;
					const channel = interaction.channel;

					const userInfo = await getUserInfo(user.id);
					if(userInfo?.referralLink) {
						return await interaction.reply({ content: 'You already have your invite link', ephemeral: true });
					}

					const ctx = Network.createContract(constants.REFERRAL_TOKEN_ADDRESS);
					const decimals = await ctx.decimals();
					console.log(`create_invite decimals is ${decimals}`);
					const tokenNumber = await _user.getTokenNumber(constants.REFERRAL_TOKEN_ADDRESS, decimals);
					console.log(`tokenNumber ${tokenNumber}`);

					if(tokenNumber.gte(ethers.utils.parseUnits(`${constants.REFERRAL_DETECT_TOKEN_NUMBER}`, decimals))) {
						const invite = await channel.createInvite({
							maxAge: constants.REFERRAL_LINK_EXPIRE_SEC,
							maxUses: constants.REFERRAL_LINK_MAX_USE,
							unique: true,
							inviter: user
						  });

						console.log(`invite ${invite.url}`);
						
						const userInviteLink = invite?.url;

						if(userInviteLink) {
							const result = await setReferralLink(_user.discordId, userInviteLink);

							if(result) {
								await interaction.reply({ content: `Invite Link is ${userInviteLink}`, ephemeral: true });
							}
							else {
								await interaction.reply({ content: 'Creating Invite Link was failed!', ephemeral: true });
							}
						}

					}
					else {
						await interaction.reply({ content: 'You do not have enough token amount to create invite link!', ephemeral: true });
					}

					return;
				}

				case 'start_temp': {
					try {
						await Network.test();
					}
					catch(err) {
						console.log(`ERROR IN START TEMP ${err}`);
					}
				}
			}

			if(interaction.customId.startsWith(`deleteorder`)) {
				const customId = interaction.customId;
				const dataId = customId.split('_')[1];
				const deletedFromDB = await deleteOrder(dataId);
				if(deletedFromDB) {
					await interaction.message.delete();
					await interaction.reply({ content: 'The order was deleted successfully!', ephemeral: true });
				}

				return;
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
		Network.channel_burnt_liquidity = c.channels.cache.get(process.env.CHANNEL_BURNT_ALERT);

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
		// const adminChannel = c.channels.cache.get(process.env.CHANNEL_ADMIN);

		// if(!adminChannel) {
		// 	console.log(`Can not find admin channel, Confirm the channel ID.`);
		// }
		// else {
		// 	adminChannel.messages.fetch({ limit: 100 })
		// 					.then(messages => {
		// 						adminChannel.bulkDelete(messages);
		// 					})
  		// 					.catch((err) => {
		// 						console.log(`Error in clearing in the admin channel: ${err}`);
		// 					});

		// 	await adminChannel.send({
		// 		content: 'Welcome, This is the admin channel.',
		// 		components: [
		// 			new ActionRowBuilder().addComponents(
		// 				new ButtonBuilder().setCustomId('set_user_fee').setLabel('Set User Fee').setStyle(ButtonStyle.Primary)
		// 			),
		// 		]
		// 	});
		// }

		// save config
		await fs.writeFileSync('conf.json', JSON.stringify(content));

		await content.mainchannel.send({ 
			content: 'Welcome, what do you want me to do?', 
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('start').setLabel('Start').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('setup').setLabel('Config').setStyle(ButtonStyle.Secondary),
					new ButtonBuilder().setCustomId('create_wallet').setLabel('Create Wallet').setStyle(ButtonStyle.Secondary)

				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('create_invite').setLabel('Create Invite Link').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('claim_invite_rewards').setLabel('Claim Invite Rewards').setStyle(ButtonStyle.Success),
				),
				// new ActionRowBuilder().addComponents(
				// 	new ButtonBuilder().setCustomId('start_auto').setLabel('Start Auto Buying').setStyle(ButtonStyle.Primary),
				// 	new ButtonBuilder().setCustomId('setup_auto').setLabel('Config').setStyle(ButtonStyle.Secondary),
				// ),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('set_limit_order').setLabel('Set Limit Order').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('show_limit_order').setLabel('Show Limit Orders').setStyle(ButtonStyle.Secondary),
					// new ButtonBuilder().setCustomId('start_temp').setLabel('Start temp').setStyle(ButtonStyle.Secondary)
				)
			]
		});
	});

	client.on(Events.GuildMemberAdd, async member => {
		const inviteManager = member.guild.invites;
		const invites = await inviteManager.fetch();
		const usedInvite = invites.find(
			(invite) => {
				try {
					return invite.uses > (client.invites.get(invite.code) || { uses: 0 }).uses
				}
				catch(err){
					console.log(`err in fetch invites: ${err}`);
					return false;
				}
			}
		);

		console.log(`usedInvite is ${usedInvite}`);
		console.log(`new user is ${member.user.id}`);
		if(usedInvite) {
			if(usedInvite?.code) {
				client.invites.set(usedInvite?.code, usedInvite);
			}
			
			const creatorData = await getCreator(usedInvite?.url);
			const creator = creatorData?.discordId;

			if(creator) {
				try {
					await upsertAccountData(member.user.id, {
						fee: constants.SWAP_REFERRAL_FEE,
						joinType: constants.MEMBER_ADD_TYPE.REFERRAL,
						inviter: creator
					});
					await increaseReferralCount(creator, member.user.id);
				}
				catch(err) {
					console.log(`err when set referral fee ${err}`)
				}
			}
		}
		else {
			await upsertAccountData(member.user.id, {
				fee: constants.SWAP_TOTAL_FEE,
				joinType: constants.MEMBER_ADD_TYPE.DIRECT
			});
		}
	  });

	// login
	await client.login(process.env.TOKEN);
})();