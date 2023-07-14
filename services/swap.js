const SwapModel = require('../models/swap');

module.exports = {
	setSwapInfo: async (discordId, walletAddress, tokenPair, tokenAddress, limitPrice) => {
        try {
            const filter = {
                discordId, walletAddress, tokenPair, tokenAddress
            }
            const update = { $set: { limitPrice: limitPrice } };
    
            const info = await SwapModel.findOne(filter);
            
            console.log(`start set swap info from DB`);
            console.log("discordId" + discordId);
            console.log("walletAddress" + walletAddress);
            console.log("tokenPair" + tokenPair);
            console.log("tokenAddress" + tokenAddress);
            console.log("limitPrice" + limitPrice);

            console.log("info" + info);

    
            if(info) {
                await SwapModel.updateOne(filter, update);
            }
            else {
                const newData = new SwapModel({...filter, limitPrice: limitPrice});
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

    getSwapInfo: async (discordId, walletAddress, tokenPair, tokenAddress) => {
        try {
            console.log(`start get swap info from DB`);
            console.log("discordId" + discordId);
            console.log("walletAddress" + walletAddress);
            console.log("tokenPair" + tokenPair);
            console.log("tokenAddress" + tokenAddress);

            const info = await SwapModel.findOne({
                discordId,
                walletAddress,
                tokenPair,
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
    }
};