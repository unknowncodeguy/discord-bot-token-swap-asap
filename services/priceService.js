const PriceModel = require('../models/price');

module.exports = {
	setTokenPrice: async (tokenAddress, price) => {
        try {
            const filter = {
                tokenAddress
            }
            const update = { $set: { price: price, updateAt: new Date().getTime() } };
    
            const info = await PriceModel.findOne(filter);
            

            if(info) {
                await PriceModel.updateOne(filter, update);
            }
            else {
                const newData = new PriceModel({...filter, price: price, updateAt: new Date().getTime()});
                await newData.save();
            }

    
            return true;
        }
        catch (err) {
            console.log("Error when setTokenPrice to DB: " + err);
        }
    
        return false;
    }
};