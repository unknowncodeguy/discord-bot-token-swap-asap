import mongoose from 'mongoose'

const DailySchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
  },
  discordId: {
    type: String,
    required: true,
  },
  swapMode: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  datetime: {
    type: Date,
    required: true
  },
})

module.exports = mongoose?.model('Daily', DailySchema);