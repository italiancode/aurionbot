// wallet/export.js
const { getWallet } = require('./storage');

/**
 * Exports a user's wallet private key
 * @param {string} userId - The user ID
 * @returns {Object} - Object containing the wallet privateKey and publicKey or null if not found
 */
function exportWallet(userId) {
  if (!userId) {
    throw new Error('User ID is required to export a wallet');
  }
  
  try {
    console.log(`Exporting wallet for user ${userId}...`);
    
    const wallet = getWallet(userId);
    
    if (!wallet) {
      console.log(`No wallet found for user ${userId}`);
      return null;
    }
    
    console.log(`Wallet exported successfully for user ${userId}`);
    return wallet;
  } catch (error) {
    console.error(`Error exporting wallet for user ${userId}:`, error.message);
    throw new Error(`Failed to export wallet: ${error.message}`);
  }
}

module.exports = exportWallet;
