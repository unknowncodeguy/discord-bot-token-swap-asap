const mongoose = require('mongoose');

const FeeSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
      },
    
    walletAddress: {
        type: String,
        required: true
    },

    fee: {
        type: Number,
        required: true
    }
})

module.exports = mongoose?.model('Fee', FeeSchema);