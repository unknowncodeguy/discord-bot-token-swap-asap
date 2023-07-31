const OrderModel = require('./../models/order');

module.exports = {
	setOrder: async (discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy) => {
        try {
            const newData = new OrderModel({discordId, tokenAddress, mentionedPrice, purchaseAmount, slippagePercentage, isBuy, isFinished: false});
            await newData.save();

            return true;
        }
        catch (err) {
            console.log("Error when setting order info to DB: " + err);
        }
    
        return null;
    },

    getOrders: async (discordId, tokenAddress = ``) => {
        try{
            if(!tokenAddress) {
                return await OrderModel.find({
                    discordId
                });
            }
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
    },

    orderExecuted: async (_id) => {
        try{
            const order =  await OrderModel.findById(_id);

            if(order) {
                await OrderModel.updateOne({_id: _id}, {isFinished: true});
                return true;
            }
        }
        catch(err) {
            console.log(`Error orderExecuted: ${err}`);
        }

        return false;
    },

    getOrderById: async (_id) => {
        try{
            return await OrderModel.findById(_id);
        }
        catch(err) {
            console.log(`Error getOrderById: ${err}`);
        }

        return null;
    }
};