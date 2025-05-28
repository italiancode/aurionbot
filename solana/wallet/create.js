// wallet/create.js
const { Keypair } = require('@solana/web3.js');
// Fix bs58 import - ensure it's properly imported
const bs58 = require('bs58');
const { saveWallet } = require('./storage');

// Check if bs58 is correctly loaded
if (!bs58 || typeof bs58.encode !== 'function') {
  console.error('bs58 package not loaded correctly, attempting to fix...');
}

/**
 * Creates a new Solana wallet for a user
 * @param {string} userId - The user ID
 * @returns {Object} - The wallet object with publicKey and privateKey
 */
function createWallet(userId) {
  if (!userId) {
    throw new Error('User ID is required to create a wallet');
  }
  
  try {
    console.log(`Creating new wallet for user ${userId}...`);
    
    // Generate a new Solana keypair
    const keypair = Keypair.generate();
    
    // Encode the secret key to Base58 format
    // Use a more compatible approach to handle the Uint8Array
    let privateKey;
    try {
      // Different versions of bs58 might have different APIs
      if (typeof bs58.encode === 'function') {
        privateKey = bs58.encode(keypair.secretKey);
      } else if (bs58.default && typeof bs58.default.encode === 'function') {
        // Some versions export functions under default
        privateKey = bs58.default.encode(keypair.secretKey);
      } else {
        // Manual fallback for encoding
        const secretKeyBuffer = Buffer.from(keypair.secretKey);
        privateKey = secretKeyBuffer.toString('hex');
        console.log('Using hex encoding as fallback for private key');
      }
    } catch (encodeError) {
      console.error('Error encoding private key:', encodeError.message);
      // Fallback to hex encoding if bs58 fails
      const secretKeyBuffer = Buffer.from(keypair.secretKey);
      privateKey = secretKeyBuffer.toString('hex');
      console.log('Using hex encoding as fallback for private key');
    }
    
    // Create wallet object
    const wallet = {
      publicKey: keypair.publicKey.toBase58(),
      privateKey,
    };
    
    // Save wallet to storage
    saveWallet(userId, wallet);
    
    console.log(`Wallet created successfully for user ${userId}`);
    return wallet;
  } catch (error) {
    console.error(`Error creating wallet for user ${userId}:`, error.message);
    throw new Error(`Failed to create wallet: ${error.message}`);
  }
}

module.exports = createWallet;
