const PriceModel = require('../models/price');

module.exports = {
	setTokenPrice: async (tokenAddress, price) => {
        try {
            const filter = {
                tokenAddress
            }
            const update = { $set: { price: price, updateAt: new Date().getTime() } };
    
            const info = await PriceModel.findOne(filter);
            
            console.log(`start setTokenPrice to DB`);

            if(info) {
                await PriceModel.updateOne(filter, update);
            }
            else {
                const newData = new PriceModel({...filter, price: price, updateAt: new Date().getTime()});
                await newData.save();
            }

            console.log(`end setTokenPrice to DB`);
    
            return true;
        }
        catch (err) {
            console.log("Error when setTokenPrice to DB: " + err);
        }
    
        return false;
    }
};