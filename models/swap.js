const mongoose = require('mongoose');

const SwapSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
      },
    walletAddress: {
        type: String,
        required: true
    },
    tokenAddress: {
        type: String,
        required: true
    },
    limitPrice: {
        type: Number,
        required: true
    }
})

module.exports = mongoose?.model('Swap', SwapSchema);