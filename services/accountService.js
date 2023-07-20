const Cryptr = require('cryptr');
const ethers = require('ethers');

const AccountModel = require('../models/account');

module.exports = {
	setUserWallet: async (discordId, walletPrivateKey, walletAddress) => {
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
    },

    getUserInfo: async (discordId) => {
        try {
            console.log(`start getting wallet Pvk from DB`);

            const info = await AccountModel.findOne({
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
    },

    setFeeInfo: async (discordId, fee) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: { fee: fee } };
    
            const info = await AccountModel.findOne(filter);
            
            console.log(`start setting fee info from DB`);
            console.log("info" + info);
            let oldWallet = ``;

            if(info) {
                await AccountModel.updateOne(filter, update);
                oldWallet = info?.walletAddress || ``;
            }
            else {
                const newData = new AccountModel({...filter, fee: fee});
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
    }
};