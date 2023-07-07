import mongoose from 'mongoose'

const BotStatusSchema = new mongoose.Schema({
    volumes: {
        type: Number,
        required: true
    },
    trades: {
        type: Number,
        required: true
    }
})

module.exports = mongoose?.model('BotStatus', BotStatusSchema);