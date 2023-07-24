const mongoose = require('mongoose');

const PriceSchema = new mongoose.Schema({
    tokenAddress: {
        type: String,
        required: true,
      },
    price: {
        type: String,
        required: true
    },
    updateAt: {
        type: Number,
        required: true
    }
})

module.exports = mongoose?.model('Price', PriceSchema);