const mongoose = require('mongoose');

const TokenaddressSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
      },
    tokenAddress: {
        type: String,
        required: true
    }
})

module.exports = mongoose?.model('Tokenaddress', TokenaddressSchema);