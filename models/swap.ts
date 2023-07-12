import mongoose from 'mongoose'

const SwapSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
      },
    walletAddress: {
        type: String,
        required: true
    },
    tokenPair: {
        type: String,
        required: true
    },
    limitPrice: {
        type: Number,
        required: true
    },
    changePercentage: {
        type: Number,
        required: true
    }
})

module.exports = mongoose?.model('Swap', SwapSchema);