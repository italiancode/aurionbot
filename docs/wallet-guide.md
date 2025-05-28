# Wallet Creation and Storage in Aurion Swap Bot

This document explains how the Aurion Swap Bot creates, imports, exports, and stores cryptocurrency wallets. It provides both a high-level overview and the technical implementation details.

## What is a Wallet?

In cryptocurrency, a "wallet" isn't like a physical wallet that stores money. Instead, it's a pair of special keys:

- **Public Key**: Think of this as your account number that you can share with others. People use this to send you cryptocurrency.
- **Private Key**: Think of this as your password. Anyone who has this can access and spend your funds. You should NEVER share this with anyone.

### Technical Implementation

At the cryptographic level, a Solana wallet consists of:

- A 256-bit (32-byte) Ed25519 private key, which is a cryptographically secure random number
- A corresponding public key derived through the Ed25519 elliptic curve algorithm
- These keys are represented as binary data (Uint8Array in JavaScript)

## Technical Deep Dive: How the Technologies Work

### 1. Solana Web3.js Library

The bot uses Solana's official JavaScript library (`@solana/web3.js`) to interact with the Solana blockchain ecosystem. Here's what happens technically:

```javascript
const { Keypair } = require('@solana/web3.js');

// Generate a new keypair with cryptographically secure random values
const keypair = Keypair.generate();

// Access the public key (as a PublicKey object)
const publicKey = keypair.publicKey;

// Access the private key (as a Uint8Array of 64 bytes)
const secretKey = keypair.secretKey;
```

The `Keypair.generate()` function uses the crypto module's secure random number generator to create a cryptographically secure keypair. The resulting secret key is a 64-byte array where:
- The first 32 bytes are the actual private key
- The second 32 bytes are the public key (which is redundant but included for compatibility)

### 2. BS58 Encoding

Base58 is a binary-to-text encoding scheme used to represent large integers or binary data as human-readable text. It's similar to Base64 but avoids using characters that might be confused with each other (like 0 and O, 1 and l).

The bot uses the `bs58` package to convert between binary keypair data and text:

```javascript
const bs58 = require('bs58');

// Convert binary secret key to Base58 string for storage/display
const privateKeyString = bs58.encode(keypair.secretKey);

// Convert Base58 string back to binary for cryptographic operations
const secretKeyBinary = bs58.decode(privateKeyString);
```

Base58 encoding produces strings that are more compact than hexadecimal representation while still being human-readable.

### 3. CryptoJS Encryption

For security, private keys are never stored in plain text. The bot uses the CryptoJS library to implement AES encryption:

```javascript
const CryptoJS = require('crypto-js');

// Encrypt the private key with AES using a secret passphrase
function encrypt(text) {
  return CryptoJS.AES.encrypt(text, process.env.WALLET_SECRET).toString();
}

// Decrypt the private key when needed
function decrypt(cipherText) {
  const bytes = CryptoJS.AES.decrypt(cipherText, process.env.WALLET_SECRET);
  return bytes.toString(CryptoJS.enc.Utf8);
}
```

AES (Advanced Encryption Standard) is a symmetric encryption algorithm that uses the same key for both encryption and decryption. The implementation:

1. Uses the WALLET_SECRET environment variable as the encryption key
2. Encrypts the Base58-encoded private key string
3. Produces a ciphertext that can only be decrypted with knowledge of the secret key
4. Uses CBC mode and PKCS#7 padding by default in CryptoJS

### 4. Node.js File System for Storage

The bot uses the Node.js `fs` module to persist wallet data to a JSON file:

```javascript
const fs = require('fs');
const path = require('path');

// File path for wallet storage
const filePath = path.join(__dirname, '../../wallets.json');

// Save wallet data
function saveWallet(userId, wallet) {
  // Read existing data or create new object
  let db = {};
  if (fs.existsSync(filePath)) {
    db = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  
  // Encrypt the private key
  const encryptedPrivateKey = encrypt(wallet.privateKey);
  
  // Store wallet data keyed by user ID
  db[userId] = {
    publicKey: wallet.publicKey,
    privateKey: encryptedPrivateKey,
  };
  
  // Write data back to file
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2));
}
```

The wallet data structure in the JSON file looks like:

```json
{
  "userId1": {
    "publicKey": "8m5rxJhiSWaddyFqh9nR1zNaTAX8qrL4qnL5gqCxsMqm",
    "privateKey": "U2FsdGVkX19xxxxxxxxxxx..." // Encrypted text
  },
  "userId2": {
    "publicKey": "AnotherPublicKey...",
    "privateKey": "U2FsdGVkX19yyyyyyy..." // Encrypted text
  }
}
```

## Wallet Operations Workflow

### Create Wallet Process

When you use the `/createwallet` command, the following happens technically:

1. The bot generates a cryptographically secure Ed25519 keypair using Solana's library
2. The 64-byte secret key (Uint8Array) is encoded to Base58 format
3. The public key is also converted to Base58 format using `publicKey.toBase58()`
4. The private key is encrypted using AES with the WALLET_SECRET as the key
5. The data is stored in a JSON file with your Telegram user ID as the lookup key
6. The unencrypted keys are sent to you via Telegram (only once for private key)

### Import Wallet Process

When you use the `/importwallet [private key]` command:

1. The bot decodes your Base58 private key to binary format
2. It validates that the key is the correct length (64 bytes for Solana)
3. It recreates a keypair from this binary data using `Keypair.fromSecretKey()`
4. The public key is derived automatically from the private key
5. The private key is encrypted and stored as with wallet creation

### Export Wallet Process

When you use the `/exportwallet` command:

1. The bot retrieves your encrypted wallet data using your Telegram user ID
2. It decrypts the private key using the WALLET_SECRET
3. It returns both the public and private keys to you

## Security Considerations

- Your private key is only shown once when created or when you explicitly request it with `/exportwallet`
- Messages containing private keys should be deleted after you've saved the information
- Anyone with access to your private key can control your funds, so keep it secure
- The bot encrypts your private key, but you should still treat it as sensitive information

## Commands for Managing Your Wallet

- `/createwallet` - Creates a new Solana wallet
- `/importwallet [private key]` - Imports an existing wallet using your private key
- `/exportwallet` - Shows your wallet details (public and private keys)

## What Happens Behind the Scenes

1. **Wallet Creation**: 
   - The bot generates random numbers in a specific pattern (a Solana keypair)
   - It converts these numbers into a text format that's easier to handle
   - It encrypts your private key before storage

2. **Wallet Import**:
   - The bot takes your private key and verifies it's in the correct format
   - It recreates your public key from the private key (this is how cryptography works)
   - It encrypts and stores this information

3. **Wallet Export**:
   - The bot retrieves your encrypted private key
   - It decrypts it using the secret encryption key
   - It shows you both your public and private keys

All this happens without the bot ever needing to connect to the Solana blockchain - wallet creation is completely local and secure.
