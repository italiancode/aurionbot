# Aurion Swap Bot: Token Swap Functionality

This document provides a detailed explanation of how token swapping works in the Aurion Swap Bot, including the technical implementation, user flow, and important observations from testing.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [User Flow](#user-flow)
4. [Technical Implementation](#technical-implementation)
   - [Swap Handler](#swap-handler)
   - [Spider Swap Integration](#spider-swap-integration)
   - [Wallet Integration](#wallet-integration)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [API Integration Notes](#api-integration-notes)

## Overview

The Aurion Swap Bot allows users to swap tokens on the Solana blockchain through a Telegram interface. It features:

- Interactive swap flow with button-based UI
- Support for popular token pairs (USDC→SOL, USDT→SOL)
- Custom token input capability
- Wallet management integration
- Error handling and user feedback

## Architecture

The swap functionality is built using a modular architecture:

```
├── bot/
│   ├── commands/           # Command handlers
│   │   └── start.js        # Main entry point with swap button
│   ├── handlers/
│   │   └── swapHandler.js  # Swap UI flow and logic
│   └── utils/              # Utility functions
├── solana/
│   ├── spiderSwap.js       # Spider Swap API integration
│   ├── wallet.js           # Wallet key handling
│   └── wallet/             # Wallet storage and management
│       └── storage.js      # Wallet data persistence
```

## User Flow

1. **Initiation**: User clicks the "Swap" button in the main menu
2. **Wallet Check**: System verifies user has a wallet; if not, prompts to create/import one
3. **Token Selection**: User selects from/to tokens or chooses from popular pairs
4. **Amount Input**: User enters the amount to swap
5. **Review**: User reviews swap details (amount, rate, gas fees)
6. **Confirmation**: User confirms the swap
7. **Execution**: Swap is executed via Spider Swap API
8. **Result**: User receives success confirmation or error message

## Technical Implementation

### Swap Handler

The `swapHandler.js` file manages the interactive UI flow and session state:

- **Session Management**: Uses `swapSessions` object to track user's swap parameters
- **UI Components**: Creates inline keyboards for token selection and confirmation
- **Flow Control**: Manages the multi-step swap process
- **Input Processing**: Handles text input for custom amounts

Key functions:
- `initSwapFlow()`: Starts the swap process
- `handleSwapCallbacks()`: Processes button interactions
- `confirmSwap()`: Shows final confirmation with estimated rate
- `executeSwap()`: Triggers the actual swap transaction

### Spider Swap Integration

The `spiderSwap.js` file handles the actual token swap logic:

- **API Integration**: Connects to Spider Swap API for swap quotes and execution
- **Transaction Building**: Prepares and signs Solana transactions
- **Key Functions**: 
  - `swapTokens()`: Main function that executes the swap

```javascript
async function swapTokens(userId, fromMint, toMint, amount) {
  try {
    const keypair = await getUserKeypair(userId);
    
    // Make API request with user-friendly amount
    const res = await axios.get("https://api.spiderswap.io/spider-api/v1/swap", {
      params: {
        owner: keypair.publicKey.toBase58(),
        fromMint,
        toMint,
        amount: amount,
        slippage: 100, // in basis points
        provider: "meteora",
      },
      headers: {
        "X-API-KEY": process.env.SPIDER_API_KEY,
      },
    });

    // Process and sign the transaction
    const transaction = Web3.VersionedTransaction.deserialize(
      Buffer.from(res.data.data.base64Transaction, "base64")
    );
    
    transaction.sign([keypair]);
    
    // Send to blockchain
    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    return signature;
  } catch (error) {
    // Error handling logic
    throw error;
  }
}
```

### Wallet Integration

The swap functionality integrates with the wallet system through:

- `getUserKeypair()`: Retrieves the user's active wallet for transaction signing
- `getWallet()`: Gets wallet information for the UI display
- Wallet permissions: Ensures the user has a wallet before initiating swaps

## Common Issues and Solutions

Through testing, we observed several common issues:

### 1. BS58 Decode Issues

**Problem**: The original implementation encountered `bs58.decode is not a function` errors.

**Solution**: We identified an issue with bs58 version 6.0.0, which has a different API structure. Downgrading to version 5.0.0 resolved this issue.

### 2. Token Amount Conversion

**Problem**: Initially, we converted user-entered amounts to their smallest unit by multiplying by 10^decimals (e.g., 100 USDC → 100,000,000), causing "High price impact" errors.

**Solution**: We discovered the Spider Swap API expects user-friendly amounts directly and handles the decimal conversion internally. Removing our conversion logic fixed the issue.

### 3. Account Not Found Errors

**Problem**: Users encountered "AccountNotFound" errors when trying to swap tokens they don't own.

**Solution**: Improved error handling to provide a clearer message explaining that the wallet needs to be funded with the token being swapped.

### 4. No Wallet Errors

**Problem**: Users could try to swap without having a wallet.

**Solution**: Added wallet existence checks before initiating the swap flow and provided guidance for creating or importing a wallet.

## API Integration Notes

When working with the Spider Swap API:

1. **Authentication**: Requires an API key in the X-API-KEY header
2. **Amount Format**: Send the human-readable amount (e.g., "10" for 10 USDC), not the blockchain amount
3. **Slippage**: Specified in basis points (100 = 1%)
4. **Transaction Flow**:
   - API returns a base64-encoded transaction
   - Transaction must be deserialized, signed, and submitted to the Solana network
5. **Error Handling**: API may return specific error messages that should be shown to the user

## Conclusion

The Aurion Swap Bot's swap functionality provides a user-friendly interface for swapping tokens on Solana. By leveraging the Spider Swap API and implementing a robust error handling system, the bot offers a reliable and intuitive swapping experience.

Future improvements could include:
- Token balance display before swapping
- Swap history tracking
- Price impact warnings
- Additional DEX integrations
