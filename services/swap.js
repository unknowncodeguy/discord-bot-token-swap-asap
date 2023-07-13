const SwapModel = require('../models/swap');

module.exports = {
	setSwapInfo: async (discordId, walletAddress, tokenPair, tokenAddress, limitPrice) => {
        try {
            const filter = {
                discordId, walletAddress, tokenPair, tokenAddress
            }
            const update = { $set: { limitPrice: limitPrice } };
            const res = new SwapModel.updateOne(filter, );
    
            const info = await SwapModel.findOne(filter);
    
            if(info) {
                await SwapModel.updateOne(filter, update);
            }
            else {
                await SwapModel.insertOne({...update, limitPrice: limitPrice})
            }
    
            return true;
        }
        catch (err) {
            console.log("Error when setting limit order info to DB: " + err);
        }
    
        return false;
    },

    getSwapInfo: async (discordId, walletAddress, tokenPair, tokenAddress) => {
        try {
            const info = await SwapModel.findOne({
                discordId,
                walletAddress,
                tokenPair,
                tokenAddress
            });
    
            return info;
        }
        catch(err) {
            console.log("Error when getting limit order info from DB: " + err);
        }
    
        return null;
    }
};