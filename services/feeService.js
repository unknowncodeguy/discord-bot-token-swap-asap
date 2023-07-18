const FeeModel = require('../models/fee');

module.exports = {
	setFeeInfo: async (discordId, walletAddress, fee) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: {  walletAddress: walletAddress, fee: fee } };
    
            const info = await FeeModel.findOne(filter);
            
            console.log(`start setting fee info from DB`);
            console.log("info" + info);
            let oldWallet = ``;

            if(info) {
                await FeeModel.updateOne(filter, update);
                oldWallet = info?.walletAddress || ``;
            }
            else {
                const newData = new FeeModel({...filter, walletAddress: walletAddress, fee: fee});
                await newData.save();
            }

            return {
                result: true,
                oldWalletAddress: oldWallet
            }
        }
        catch (err) {
            console.log("Error when setting fee info to DB: " + err);
        }
    
        return {
            result: false,
            oldWalletAddress: ``
        }
    },

    getFeeInfo: async (discordId) => {
        try {
            console.log(`start getting fee info from DB`);

            const info = await FeeModel.findOne({
                discordId
            });
            console.log("fee info is" + info);
            console.log(`end get swap info from DB`);
    
            return info;
        }
        catch(err) {
            console.log("Error when getting fee info from DB: " + err);
        }
    
        return null;
    }
};