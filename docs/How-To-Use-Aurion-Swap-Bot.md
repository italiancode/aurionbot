# How to Use the Solana Token Swap Telegram Bot

This Telegram bot allows you to manage your Solana wallet and swap SPL tokens right from your chat interface.

---

## Available Commands

### 1. `/createwallet`

Generate a new Solana wallet for you. The bot will give you the public and private keys.

**Important:** Store your private key securely. Anyone with your private key can control your tokens.

---

### 2. `/import <privateKey>`

Import an existing Solana wallet using your private key.

**Example:**

```
/import 3dj6fS...yourBase58PrivateKeyHere...x93b
```

---

### 3. `/export`

Get your current wallet’s public and private keys stored by the bot.

---

### 4. `/swap <fromMint> <toMint> <amount>`

Swap tokens on the Solana blockchain.

- **fromMint** — Token mint address you want to swap from.
- **toMint** — Token mint address you want to swap to.
- **amount** — Amount in lamports (smallest token unit).

**Example:**

```
/swap So11111111111111111111111111111111111111112 USDCz1234567890abcdef1234567890abcdef1234 1000000
```

The bot will process the swap and reply with a transaction confirmation and Solscan link.

---

## How It Works

- Your wallet keys are stored securely in encrypted storage.
- You can create, import, or export wallets.
- The bot uses your wallet to sign and send token swap transactions via the SpiderSwap API.
- Swap transactions include a slippage tolerance of 1%.
- You receive real-time feedback and transaction links.

---

## Security Reminder

- Never share your private key with anyone except the bot commands.
- Keep your private key safe and never share it outside this bot.
- The bot stores your private key encrypted on the backend (if implemented).
- The bot currently uses local or simple storage — please use with caution and avoid large funds until secure storage is confirmed.

---

## Example Workflow

**User:**

```
/createwallet
```

**Bot:**

```
✅ New wallet created!
🧾 Public Key:
So11111111111111111111111111111111111111112

🔐 Private Key (store securely):
3dj6fS...yourPrivateKey...
```

---

**User:**

```
/swap So11111111111111111111111111111111111111112 USDCz1234567890abcdef1234567890abcdef1234 1000000
```

**Bot:**

```
🔁 Processing your swap...
✅ Swap complete!
🔗 https://solscan.io/tx/5EyLkPzj1QxqLm1u2v6H98XbV...
```
