const mongoose = require('mongoose');
const constants = require("./../libs/constants");

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
    joinType: {
        type: String,
        enum: [constants.MEMBER_ADD_TYPE.DIRECT, constants.MEMBER_ADD_TYPE.REFERRAL],
        default: constants.MEMBER_ADD_TYPE.DIRECT
    }
})

module.exports = mongoose?.model('Account', AccountSchema);