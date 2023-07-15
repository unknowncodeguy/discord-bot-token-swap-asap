const mongoose = require('mongoose');

const SwapSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
      },
    tokenAddress: {
        type: String,
        required: true
    },
    limitBuyPrice: {
        type: Number,
        required: true
    },
    limitBuyPercentage: {
        type: Number,
        require: true
    },
    limitSellPrice: {
        type: Number,
        required: true
    },
    limitSellPercentage: {
        type: Number,
        require: true
    }
})

module.exports = mongoose?.model('Swap', SwapSchema);