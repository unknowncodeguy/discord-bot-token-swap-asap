const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
    },
    tokenAddress: {
        type: String,
        required: true
    },
    mentionedPrice: {
        type: String,
        required: true
    },
    purchaseAmount: {
        type: Number,
        required: true
    },
    slippagePercentage: {
        type: Number,
        required: true
    },
    isBuy: {
        type: Boolean,
        require: true
    }
})

module.exports = mongoose?.model('Order', OrderSchema);