const WalletModel = require('./../models/wallet');

module.exports = {
	setUserWallet: async (discordId, walletPrivateKey) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: { walletPrivateKey: walletPrivateKey} };
    
            const info = await WalletModel.findOne(filter);
            
            console.log(`start set user wallet pk info to DB`);
            console.log("discordId" + discordId);
            console.log("info" + info);

    
            if(info) {
                await WalletModel.updateOne(filter, update);
            }
            else {
                const newData = new WalletModel({...filter, walletPrivateKey: walletPrivateKey});
                await newData.save();
            }

            console.log(`end set user wallet pk to DB`);
    
            return true;
        }
        catch (err) {
            console.log("Error when setting limit order info to DB: " + err);
        }
    
        return false;
    },

    getUserWallet: async (discordId) => {
        try {
            console.log(`start getting wallet Pvk from DB`);

            const info = await WalletModel.findOne({
                discordId
            });
            console.log("pk info is" + info);
            console.log(`end get pk info from DB`);
    
            return info;
        }
        catch(err) {
            console.log("Error when getting pk info from DB: " + err);
        }
    
        return null;
    }
};