// wallet/import.js
const { Keypair } = require("@solana/web3.js");
// Fix bs58 import - ensure it's properly imported
const bs58 = require("bs58");
const { saveWallet } = require("./storage");

// Check if bs58 is correctly loaded
if (!bs58 || typeof bs58.decode !== 'function') {
  console.error('bs58 package not loaded correctly in import module, attempting to fix...');
}

/**
 * Imports a Solana wallet using a private key
 * @param {string} userId - The user ID
 * @param {string} privateKey - The private key in bs58 format
 * @returns {Object} - The wallet object with publicKey and privateKey
 */
function importWallet(userId, privateKey) {
  if (!userId) {
    throw new Error('User ID is required to import a wallet');
  }
  
  if (!privateKey || typeof privateKey !== 'string') {
    throw new Error('A valid private key string is required');
  }
  
  try {
    console.log(`Importing wallet for user ${userId}...`);
    
    // Validate the private key by attempting to decode it
    let secretKey;
    try {
      // Handle different versions of bs58
      if (typeof bs58.decode === 'function') {
        secretKey = bs58.decode(privateKey);
      } else if (bs58.default && typeof bs58.default.decode === 'function') {
        // Some versions export functions under default
        secretKey = bs58.default.decode(privateKey);
      } else {
        // If the key is in hex format (from our fallback in createWallet)
        if (/^[0-9a-f]+$/i.test(privateKey) && privateKey.length === 128) {
          console.log('Processing hex-encoded private key');
          secretKey = Buffer.from(privateKey, 'hex');
        } else {
          throw new Error('Unable to decode private key format');
        }
      }
      
      // Ensure the decoded key is the correct length for a Solana keypair
      if (secretKey.length !== 64) {
        throw new Error('Invalid private key format: incorrect length');
      }
    } catch (decodeError) {
      console.error('Error decoding private key:', decodeError);
      throw new Error(`Invalid private key format: ${decodeError.message}`);
    }
    
    // Create keypair from the secret key
    const keypair = Keypair.fromSecretKey(secretKey);
    
    // Create wallet object
    const wallet = {
      publicKey: keypair.publicKey.toBase58(),
      privateKey: privateKey,
    };
    
    // Save wallet to storage
    saveWallet(userId, wallet);
    
    console.log(`Wallet imported successfully for user ${userId}`);
    return wallet;
  } catch (error) {
    console.error(`Error importing wallet for user ${userId}:`, error.message);
    throw new Error(`Failed to import wallet: ${error.message}`);
  }
}

module.exports = importWallet;
