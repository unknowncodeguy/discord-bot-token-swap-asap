const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
      },
    walletPrivateKey: {
        type: String,
        required: true
    }
})

module.exports = mongoose?.model('Wallet', WalletSchema);