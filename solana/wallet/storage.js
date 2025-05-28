// wallet/storage.js
const fs = require('fs');
const path = require('path');
const CryptoJS = require('crypto-js');

// Use a path relative to the project root
const filePath = path.join(__dirname, '../../wallets.json');

// Verify WALLET_SECRET is set
if (!process.env.WALLET_SECRET) {
  console.error('WALLET_SECRET environment variable is not set');
  process.exit(1);
}

const secret = process.env.WALLET_SECRET;

/**
 * Encrypts a text string using AES encryption
 * @param {string} text - The text to encrypt
 * @returns {string} - The encrypted text
 */
function encrypt(text) {
  if (!text) {
    throw new Error('Cannot encrypt empty or undefined text');
  }
  try {
    return CryptoJS.AES.encrypt(text, secret).toString();
  } catch (error) {
    console.error('Encryption error:', error.message);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts a cipher text string
 * @param {string} cipherText - The encrypted text to decrypt
 * @returns {string|null} - The decrypted text or null if decryption fails
 */
function decrypt(cipherText) {
  if (!cipherText) {
    console.error('Cannot decrypt empty or undefined cipher text');
    return null;
  }
  
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, secret);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    
    if (!decrypted) {
      console.error('Decryption produced empty result');
      return null;
    }
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error.message);
    return null;
  }
}

/**
 * Gets the database of all wallets
 * @returns {Object} - The wallet database
 */
function getDatabase() {
  let db = {};
  if (fs.existsSync(filePath)) {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      db = JSON.parse(fileContent);
    } catch (err) {
      console.error('Error reading wallet file:', err.message);
    }
  }
  return db;
}

/**
 * Save database to file
 * @param {Object} db - The database to save
 */
function saveDatabase(db) {
  try {
    // Create directory if it doesn't exist
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
  } catch (error) {
    console.error('Error saving database:', error.message);
    throw new Error('Failed to save wallet database');
  }
}

/**
 * Adds a new wallet for a user
 * @param {string} userId - The user ID
 * @param {Object} wallet - The wallet with publicKey and privateKey
 * @param {string} walletName - Optional name for the wallet
 * @param {boolean} setAsActive - Whether to set this as the active wallet
 * @returns {Object} - The saved wallet information with ID
 */
function saveWallet(userId, wallet, walletName = '', setAsActive = true) {
  if (!userId || !wallet || !wallet.publicKey || !wallet.privateKey) {
    throw new Error('Invalid wallet data for saving');
  }
  
  try {
    // Get database
    let db = getDatabase();
    
    // Initialize user data if it doesn't exist
    if (!db[userId]) {
      db[userId] = {
        wallets: [],
        activeWalletId: null
      };
    }
    
    // Check wallet limit (5 wallets max)
    if (db[userId].wallets.length >= 5) {
      throw new Error('Wallet limit reached (maximum 5 wallets). Please remove a wallet before adding a new one.');
    }
    
    // Generate a unique wallet ID
    const walletId = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
    
    // Set a default name if none provided
    let name = walletName || `Wallet #${db[userId].wallets.length + 1}`;
    
    // Ensure wallet name is unique
    if (db[userId].wallets.some(w => w.name === name)) {
      // If name exists, add a unique suffix
      let counter = 1;
      let baseName = name;
      while (db[userId].wallets.some(w => w.name === name)) {
        name = `${baseName} (${counter})`;
        counter++;
      }
    }
    
    // Encrypt the private key
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    
    // Create wallet entry
    const walletEntry = {
      id: walletId,
      name: name,
      publicKey: wallet.publicKey,
      privateKey: encryptedPrivateKey,
      createdAt: new Date().toISOString()
    };
    
    // Add wallet to user's wallet list
    db[userId].wallets.push(walletEntry);
    
    // Set as active wallet if requested or if it's the first wallet
    if (setAsActive || db[userId].activeWalletId === null) {
      db[userId].activeWalletId = walletId;
    }
    
    // Save database
    saveDatabase(db);
    
    console.log(`Wallet "${name}" saved for user ${userId}`);
    
    return {
      id: walletId,
      name: name,
      publicKey: wallet.publicKey,
      isActive: db[userId].activeWalletId === walletId
    };
  } catch (error) {
    console.error('Error saving wallet:', error.message);
    throw new Error(`Failed to save wallet: ${error.message}`);
  }
}

/**
 * Gets the active wallet for a user
 * @param {string} userId - The user ID
 * @returns {Object|null} - The wallet object or null if not found
 */
function getWallet(userId) {
  if (!userId) {
    console.error('Invalid user ID provided to getWallet');
    return null;
  }
  
  try {
    // Get database
    const db = getDatabase();
    
    // Check if user exists
    if (!db[userId] || !db[userId].wallets || !db[userId].wallets.length) {
      console.log(`No wallets found for user ${userId}`);
      return null;
    }
    
    // Get active wallet ID
    const activeWalletId = db[userId].activeWalletId;
    
    // If no active wallet ID, use the first wallet
    let activeWallet;
    if (!activeWalletId) {
      activeWallet = db[userId].wallets[0];
      // Update active wallet ID
      db[userId].activeWalletId = activeWallet.id;
      saveDatabase(db);
    } else {
      // Find active wallet
      activeWallet = db[userId].wallets.find(w => w.id === activeWalletId);
      if (!activeWallet && db[userId].wallets.length > 0) {
        // If active wallet not found but wallets exist, use the first one
        activeWallet = db[userId].wallets[0];
        db[userId].activeWalletId = activeWallet.id;
        saveDatabase(db);
      }
    }
    
    if (!activeWallet) {
      console.log(`No active wallet found for user ${userId}`);
      return null;
    }
    
    // Decrypt private key
    const decryptedPrivateKey = decrypt(activeWallet.privateKey);
    if (!decryptedPrivateKey) {
      console.error(`Failed to decrypt private key for wallet ${activeWallet.id}`);
      return null;
    }
    
    return {
      id: activeWallet.id,
      name: activeWallet.name,
      publicKey: activeWallet.publicKey,
      privateKey: decryptedPrivateKey,
      isActive: true
    };
  } catch (error) {
    console.error('Error retrieving wallet:', error.message);
    return null;
  }
}

/**
 * Gets all wallets for a user
 * @param {string} userId - The user ID
 * @returns {Array|null} - Array of wallet objects or null if none found
 */
function getAllWallets(userId) {
  if (!userId) {
    console.error('Invalid user ID provided to getAllWallets');
    return null;
  }
  
  try {
    // Get database
    const db = getDatabase();
    
    // Check if user exists
    if (!db[userId] || !db[userId].wallets || !db[userId].wallets.length) {
      console.log(`No wallets found for user ${userId}`);
      return [];
    }
    
    const activeWalletId = db[userId].activeWalletId;
    
    // Return list of wallets with minimal info (no private keys)
    return db[userId].wallets.map(wallet => ({
      id: wallet.id,
      name: wallet.name,
      publicKey: wallet.publicKey,
      isActive: wallet.id === activeWalletId,
      createdAt: wallet.createdAt
    }));
  } catch (error) {
    console.error('Error retrieving all wallets:', error.message);
    return [];
  }
}

/**
 * Sets a wallet as the active wallet for a user
 * @param {string} userId - The user ID
 * @param {string} walletId - The wallet ID to set as active
 * @returns {boolean} - Whether the operation was successful
 */
function setActiveWallet(userId, walletId) {
  if (!userId || !walletId) {
    console.error('Invalid user ID or wallet ID provided to setActiveWallet');
    return false;
  }
  
  try {
    // Get database
    const db = getDatabase();
    
    // Check if user exists
    if (!db[userId] || !db[userId].wallets || !db[userId].wallets.length) {
      console.log(`No wallets found for user ${userId}`);
      return false;
    }
    
    // Check if wallet exists
    const walletExists = db[userId].wallets.some(w => w.id === walletId);
    if (!walletExists) {
      console.log(`Wallet ${walletId} not found for user ${userId}`);
      return false;
    }
    
    // Set active wallet
    db[userId].activeWalletId = walletId;
    saveDatabase(db);
    
    console.log(`Wallet ${walletId} set as active for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error setting active wallet:', error.message);
    return false;
  }
}

/**
 * Removes a wallet for a user
 * @param {string} userId - The user ID
 * @param {string} walletId - The wallet ID to remove
 * @returns {boolean} - Whether the operation was successful
 */
function removeWallet(userId, walletId) {
  if (!userId || !walletId) {
    console.error('Invalid user ID or wallet ID provided to removeWallet');
    return false;
  }
  
  try {
    // Get database
    const db = getDatabase();
    
    // Check if user exists
    if (!db[userId] || !db[userId].wallets || !db[userId].wallets.length) {
      console.log(`No wallets found for user ${userId}`);
      return false;
    }
    
    // Find wallet index
    const walletIndex = db[userId].wallets.findIndex(w => w.id === walletId);
    if (walletIndex === -1) {
      console.log(`Wallet ${walletId} not found for user ${userId}`);
      return false;
    }
    
    // Remove wallet
    db[userId].wallets.splice(walletIndex, 1);
    
    // If removed wallet was active, set a new active wallet if any exist
    if (db[userId].activeWalletId === walletId) {
      if (db[userId].wallets.length > 0) {
        db[userId].activeWalletId = db[userId].wallets[0].id;
      } else {
        db[userId].activeWalletId = null;
      }
    }
    
    // Save database
    saveDatabase(db);
    
    console.log(`Wallet ${walletId} removed for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error removing wallet:', error.message);
    return false;
  }
}

/**
 * Rename a wallet
 * @param {string} userId - The user ID
 * @param {string} walletId - The wallet ID to rename
 * @param {string} newName - The new name for the wallet
 * @returns {boolean} - Whether the operation was successful
 */
function renameWallet(userId, walletId, newName) {
  if (!userId || !walletId || !newName) {
    console.error('Missing required parameters for renameWallet');
    return false;
  }
  
  try {
    // Get database
    const db = getDatabase();
    
    // Check if user exists
    if (!db[userId] || !db[userId].wallets || !db[userId].wallets.length) {
      console.log(`No wallets found for user ${userId}`);
      return false;
    }
    
    // Find wallet to rename
    const walletIndex = db[userId].wallets.findIndex(w => w.id === walletId);
    if (walletIndex === -1) {
      console.log(`Wallet with ID ${walletId} not found for user ${userId}`);
      return false;
    }
    
    // Ensure name uniqueness
    let finalName = newName;
    if (db[userId].wallets.some((w, idx) => w.name === newName && idx !== walletIndex)) {
      // If name exists, add a unique suffix
      let counter = 1;
      let baseName = newName;
      while (db[userId].wallets.some((w, idx) => w.name === finalName && idx !== walletIndex)) {
        finalName = `${baseName} (${counter})`;
        counter++;
      }
    }
    
    // Update wallet name
    db[userId].wallets[walletIndex].name = finalName;
    
    // Save database
    saveDatabase(db);
    
    console.log(`Wallet ${walletId} renamed to "${finalName}" for user ${userId}`);
    return true;
  } catch (error) {
    console.error('Error renaming wallet:', error.message);
    return false;
  }
}

// Export all functions
module.exports = {
  saveWallet,      // Add a new wallet
  getWallet,       // Get the active wallet
  getAllWallets,   // Get all wallets for a user
  setActiveWallet, // Set a wallet as active
  removeWallet,    // Remove a wallet
  renameWallet     // Rename a wallet
};
