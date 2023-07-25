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
            console.log("user info is" + info);
            console.log(`end get pk info from DB`);
    
            return info;
        }
        catch(err) {
            console.log("Error when getting user info from DB: " + err);
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
    },

    setReferralLink: async (discordId, referralLink) => {
        try {
            const filter = {
                discordId
            }
            const update = { $set: { referralLink: referralLink } };
    
            const info = await AccountModel.findOne(filter);
            
            console.log(`start setting referralLink info from DB`);
            console.log("info" + info);

            if(info) {
                await AccountModel.updateOne(filter, update);
            }
            else {
                const newData = new AccountModel({...filter, referralLink: referralLink});
                await newData.save();
            }

            return true;
        }
        catch (err) {
            console.log("Error when setting referralLink info to DB: " + err);
        }
    
        return false;
    },

    increaseReferralCount: async (discordId, invitedUser) => {
        try {
            const filter = {
                discordId
            }

            const info = await AccountModel.findOne(filter);
            
            console.log(`start setting inviteCount info from DB`);
            console.log("info" + info);

            if(info) {
                const oldCnt = info?.inviteCount;
                if(Array.isArray(oldCnt)) {
                    oldCnt.push(invitedUser);
                    const update = { $set: { inviteCount: oldCnt } };
                    await AccountModel.updateOne(filter, update);
    
                    return oldCnt;
                }
            }
        }
        catch (err) {
            console.log("Error when setting inviteCount info to DB: " + err);
        }
    
        return null;
    },

    getCreator: async (referralLink) => {
        try {
            const filter = {
                referralLink
            }

            const info = await AccountModel.findOne(filter);
            
            console.log(`start getCreator info from DB`);
            console.log("info" + info);

            return info;
        }
        catch (err) {
            console.log("Error when setting inviteCount info to DB: " + err);
        }
    
        return null;
    },

    getInviter: async (invitedUser) => {
        try {
            const result = await AccountModel.findOne({
                inviteCount: {$in: [invitedUser]}
            });

            return result;
        }
        catch (err) {
            console.log("Error when getInviter: " + err);
        }
    
        return null;
    },

    upsertAccountData: async (discordId, data) => {
        try {
            const filter = { discordId };
            const update = { $set: data };

            const info = await AccountModel.findOne(filter);

            if(info) {
                await AccountModel.updateOne(filter, update);
            }
            else {
                const newData = new AccountModel({...filter, ...data});
                await newData.save();
            }

            return true;
        }
        catch (err) {
            console.log("Error when upsertAccountData in account service: " + err);
        }
    
        return false;
    },
};