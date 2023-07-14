const SwapModel = require('../models/swap');
const TokenModel = require('../models/token');

module.exports = {
	setSwapInfo: async (discordId, tokenAddress, limitPrice, limitSlippage) => {
        try {
            const filter = {
                discordId, tokenAddress
            }
            const update = { $set: { limitPrice: limitPrice, limitSlippage: limitSlippage } };
    
            const info = await SwapModel.findOne(filter);
            
            console.log(`start set swap info from DB`);
            console.log("discordId" + discordId);
            console.log("tokenAddress" + tokenAddress);
            console.log("limitPrice" + limitPrice);
            console.log("limitSlippage" + limitSlippage);

            console.log("info" + info);

    
            if(info) {
                await SwapModel.updateOne(filter, update);
            }
            else {
                const newData = new SwapModel({...filter, limitPrice: limitPrice, limitSlippage: limitSlippage});
                await newData.save();
            }

            console.log(`end set swap info from DB`);
    
            return true;
        }
        catch (err) {
            console.log("Error when setting limit order info to DB: " + err);
        }
    
        return false;
    },

    getSwapInfo: async (discordId, tokenAddress) => {
        try {
            console.log(`start get swap info from DB`);
            console.log("discordId" + discordId);
            console.log("tokenAddress" + tokenAddress);

            const info = await SwapModel.findOne({
                discordId,
                tokenAddress
            });
            console.log("info" + info);
            console.log(`end get swap info from DB`);
    
            return info;
        }
        catch(err) {
            console.log("Error when getting limit order info from DB: " + err);
        }
    
        return null;
    },

    saveTokenInfoByInteraction: async (interaction, tokenAddress) => {
        const filter = {
            interaction
        }
        const update = { $set: { tokenAddress: tokenAddress } };

        try {
            const info = await TokenModel.findOne(filter);

            if(info) {
                await TokenModel.updateOne(filter, update);
            }
            else {
                const newData = new TokenModel({...filter, tokenAddress: tokenAddress});
                await newData.save();
            }

            return true;
        }
        catch(err) {
            console.log(`error when saving token info by interaction: ${err}`);
        }

        return false;
    },

    getTokenInfoByInteraction: async (interaction) => {
        const filter = {
            interaction
        }

        try {
            const info = await TokenModel.findOne(filter);

            return info;
        }
        catch(err) {
            console.log(`error when getting the token info by interaction: ${err}`);
        }

        return null;
    }
};