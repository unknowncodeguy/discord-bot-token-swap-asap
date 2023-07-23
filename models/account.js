const mongoose = require('mongoose');

const AccountSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
      },
    walletPrivateKey: {
        type: String
    },
    walletAddress: {
        type: String
    },
    fee: {
        type: Number
    },
    referralLink: {
        type: String
    },
    inviteCount: {
        type: [String]
    },
    
})

module.exports = mongoose?.model('Account', AccountSchema);