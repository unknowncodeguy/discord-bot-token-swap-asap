const TokenaddressModel = require('./../models/tokenaddress');

module.exports = {
    saveTokenInfoById: async (userId, tokenAddress) => {
        const filter = {
            userId
        }
        const update = { $set: { tokenAddress: tokenAddress } };

        try {
            const info = await TokenaddressModel.findOne(filter);

            if(info) {
                await TokenaddressModel.updateOne(filter, update);
            }
            else {
                const newData = new TokenaddressModel({...filter, tokenAddress: tokenAddress});
                await newData.save();
            }

            return true;
        }
        catch(err) {
            console.log(`error when saving token info by userid: ${err}`);
        }

        return false;
    },

    getTokenInfoByUserId: async (userId) => {
        const filter = {
            userId
        }

        try {
            const info = await TokenaddressModel.findOne(filter);

            return info;
        }
        catch(err) {
            console.log(`error when getting the token info by interaction: ${err}`);
        }

        return null;
    }
};