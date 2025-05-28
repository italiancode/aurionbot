// solana/wallet.js
const Web3 = require('@solana/web3.js');
const bs58 = require('bs58');
const { getWallet } = require('./wallet/storage');

async function getUserKeypair(userId) {
  const wallet = getWallet(userId);
  if (!wallet) {
    throw new Error(`No wallet found for user ${userId}`);
  }

  const secretKey = Uint8Array.from(bs58.decode(wallet.privateKey));
  return Web3.Keypair.fromSecretKey(secretKey);
}

module.exports = {
  getUserKeypair,
};
