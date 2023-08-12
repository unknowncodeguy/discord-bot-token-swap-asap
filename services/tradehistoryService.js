const TradehistoryModel = require('../models/tradehistory');

module.exports = {
	registerHistory: async (discordId, walletAddress, tradeMode, tokenAdress, tradeAmount, transaction, thenPrice, tradeAt, symbol, decimals) => {
        try {
            const newData = new TradehistoryModel({
                discordId,
                walletAddress,
                tradeMode, 
                tokenAdress,
                tradeAmount: tradeAmount || `0`,
                transaction,
                tradeAt: tradeAt,
                thenPrice: thenPrice || `0`,
                tokenSymbol: symbol,
                tokenDecimals: decimals
            });
            await newData.save();

            return true;
        }
        catch (err) {
            console.log("Saving the trade history failed with error: " + err);
        }
    
        return false;
    },

    getTradeHistory: async (discordId) => {
        try {
            const hostiries = await TradehistoryModel.find({
                discordId
            });
    
            return hostiries;
        }
        catch(err) {
            console.log(`Fetching the trade history of user(${discordId}) failed with error: ` + err);
        }
    
        return [];
    },
};