const Cryptr = require('cryptr');
const ethers = require('ethers');

const AccountModel = require('../models/account');

module.exports = {
	setTokenPrice: async (tokenAddress, price) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: { walletPrivateKey: walletPrivateKey, walletAddress: walletAddress} };
    
            const info = await AccountModel.findOne(filter);
            
            console.log(`start set user wallet pk info to DB`);
            console.log("discordId" + discordId);
            console.log("info" + info);

            if(info) {
                await AccountModel.updateOne(filter, update);
            }
            else {
                const newData = new AccountModel({...filter, walletPrivateKey: walletPrivateKey, walletAddress: walletAddress});
                await newData.save();
            }

            console.log(`end set user wallet pk to DB`);
    
            return true;
        }
        catch (err) {
            console.log("Error when setting user wallet to DB: " + err);
        }
    
        return false;
    }
};