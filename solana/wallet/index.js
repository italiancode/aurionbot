// wallet/index.js
const createWallet = require('./create');
const importWallet = require('./import');
const exportWallet = require('./export');
const storage = require('./storage');

// Export all functions directly to avoid reference issues
module.exports = {
  createWallet,
  importWallet,
  exportWallet,
  getWallet: storage.getWallet,
  saveWallet: storage.saveWallet
};
