const OrderModel = require('./../models/order');

module.exports = {
	setOrder: async (discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy) => {
        try {
            console.log(`Start set order`);
            console.log(`discordId ${discordId}`);
            console.log(`tokenAddress  ${tokenAddress}`);
            console.log(`mentionedPrice  ${mentionedPrice}`);
            console.log(`purchaseAmount  ${purchaseAmount}`);
            console.log(`slippagePercentage  ${slippagePercentage}`);
            console.log(`isBuy  ${isBuy}`);
            const newData = new OrderModel({discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy});
            await newData.save();

            return true;
        }
        catch (err) {
            console.log("Error when setting order info to DB: " + err);
        }
    
        return null;
    },

    getOrders: async (discordId, tokenAddress) => {
        try{
            return await OrderModel.find({
                discordId,
                tokenAddress
            });
        }
        catch(err) {
            console.log(`Error when getting order data per user and token: ${err}`);
        }

        return [];
    },

    getOrderUsers: async (tokenAddress) => {
        try{
            return await OrderModel.find({
                tokenAddress
            });
        }
        catch(err) {
            console.log(`Error when getting order data per user and token: ${err}`);
        }

        return [];
    },

    deleteOrder: async (_id) => {
        try{
            const deletedCount =  await OrderModel.deleteOne({
                _id
            });

            if(deletedCount?.deletedCount) {
                return true;
            }
        }
        catch(err) {
            console.log(`Error when deleting order data per user and token: ${err}`);
        }

        return false;
    }
};