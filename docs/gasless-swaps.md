# Gasless Swaps in AurionOne

This document explains how the gasless swap feature works in AurionOne.

## Overview

Gasless swaps allow users to swap tokens to SOL even when they don't have any SOL for transaction fees. The feature works by deducting the transaction fee from the SOL amount received after the swap.

## Technical Implementation

### API Integration

AurionOne leverages SpiderSwap's API for gasless swaps. The key component is the `gasless` boolean parameter:

```javascript
// Example API request
const params = {
  owner: walletAddress,
  fromMint: sourceTokenMint,
  toMint: SOL_MINT, // Must be SOL (So11111111111111111111111111111111111111112)
  amount: amountInLamports,
  slippage: 100, // 1% slippage (in basis points)
  provider: "raydium",
  gasless: true // Enable gasless transaction
};
```

### Important Notes

1. Gasless swaps only work when the destination token is SOL
2. The gas fee is deducted from the SOL amount received
3. Users don't need to have any SOL in their wallet to perform the swap

## User Flow

1. User selects source token and SOL as the destination token
2. User enables the "Gasless" toggle in the interface
3. AurionOne passes `gasless: true` to the SpiderSwap API
4. The swap executes without requiring the user to pay for gas upfront

## Implementation Details

The gasless feature is implemented in:
- `solana/spiderswap/swap.js` - Handles the API call with the gasless parameter
- `bot/handlers/swapHandler.js` - Provides the UI for toggling gasless mode

## Limitations

- Only works when swapping to SOL
- The transaction will fail if the user attempts to enable gasless for non-SOL output
- There may be a minimum swap amount to cover the gas fees
