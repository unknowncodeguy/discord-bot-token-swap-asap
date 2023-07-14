const mongoose = require('mongoose');

const TokenSchema = new mongoose.Schema({
    interaction: {
        type: String,
        required: true,
      },
    tokenAddress: {
        type: String,
        required: true
    }
})

module.exports = mongoose?.model('Token', TokenSchema);