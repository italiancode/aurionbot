# Aurion Telegram Token Swap Bot — Architecture & Workflow

## Overview

This Telegram bot enables users to swap SPL tokens on Solana directly via chat commands. Each user has their own encrypted Solana wallet managed by the bot, ensuring personalized and secure transactions.

---

## Project Structure

```
/bot
  /handlers
    swapHandler.js       # Telegram command handler for token swaps
  utils
    sendMessage.js       # Wrapper utility for sending Telegram messages

/solana
  connection.js          # Creates Solana RPC connection from .env config
  wallet/
    storage.js           # Manage encrypted user wallets storage (create/import/export)
    wallet.js            # Load user's wallet and return Keypair dynamically
  spiderSwap.js          # SpiderSwap API integration: build and send swap transactions

.env                    # Stores sensitive config like API keys and RPC URLs
wallets.json            # Encrypted storage of user wallets (local file, prototype)
```

---

## Key Components & Flow

### 1. Wallet Management (`/solana/wallet/storage.js`, `/solana/wallet/wallet.js`)

- Users create/import/export wallets via Telegram commands (not covered yet, planned).
- Wallet private keys are encrypted and stored in `wallets.json` indexed by user ID.
- `wallet.js` exports `getUserKeypair(userId)` to load and decrypt a wallet, returning a Solana Keypair for signing transactions.

### 2. Solana Connection (`/solana/connection.js`)

- Initializes Solana `Connection` with the RPC endpoint from `.env`.
- All transactions and queries use this connection.

### 3. SpiderSwap Integration (`/solana/spiderSwap.js`)

- `swapTokens(userId, fromMint, toMint, amount)` fetches a prepared swap transaction from SpiderSwap API.
- Deserializes and signs the transaction with the user's Keypair.
- Sends the raw transaction on Solana network.
- Returns the transaction signature.

### 4. Telegram Command Handler (`/bot/handlers/swapHandler.js`)

- Parses user input from `/swap <fromMint> <toMint> <amount>`.
- Validates input and retrieves the user's wallet.
- Calls `swapTokens` with user context.
- Sends confirmation or error messages back to user.

---

## Workflow Summary

1. **User issues swap command** in Telegram:
   `/swap <fromMint> <toMint> <amount>`

2. **swapHandler** parses the command, extracts `userId`, token mints, and amount.

3. Calls `swapTokens(userId, fromMint, toMint, amount)` which:

   - Retrieves user's Solana Keypair securely.
   - Calls SpiderSwap API for swap transaction.
   - Signs and sends transaction on Solana network.

4. Telegram bot sends back the transaction signature link (`https://solscan.io/tx/<signature>`).

---

## Next Steps & Enhancements

- Implement wallet creation, import, and export commands with encrypted storage.
- Add better error handling and validation for token mints and amounts.
- Persist user wallets in a database instead of local JSON for scalability.
- Add user session management and optional notifications on transaction status.
- Enhance UI/UX with estimated swap output before execution.
