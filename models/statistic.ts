import mongoose from 'mongoose'

const StatisticSchema = new mongoose.Schema({
    volumes: {
        type: Number,
        required: true
    },
    trades: {
        type: Number,
        required: true
    }
})

module.exports = mongoose?.model('Statistic', StatisticSchema);