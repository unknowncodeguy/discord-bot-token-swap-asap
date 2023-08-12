const mongoose = require('mongoose');
const constants = require("./../libs/constants");

const TradehistorySchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true
    },
    walletAddress: {
        type: String,
        required: true
    },
    tradeMode: {
        type: String,
        enum: [constants.TRADE_MODE.SELL, constants.TRADE_MODE.BUY],
        required: true
    },
    tokenAdress: {
        type: String,
        required: true
    },
    tradeAmount: {
        type: String,
        required: true
    },
    transaction: {
        type: String,
        required: true
    },
    tradeAt: {
        type: Date,
        default: Date.now
    },
    thenPrice: {
        type: String,
        required: true
    }, 
})

module.exports = mongoose?.model('Tradehistory', TradehistorySchema);