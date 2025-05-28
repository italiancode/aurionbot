## 🕸️ Aurion Swap — Context & Product Overview

### 📌 One-Liner

> **Aurion** is a gasless token swap Telegram bot built on **SpiderSwap**, powered by **Solana**. It enables users to swap tokens instantly with zero gas and minimal friction—right from Telegram.

---

## 🚀 Purpose

To simplify and gamify on-chain token swaps by removing complexity, gas fees, and dApp barriers. Aurion serves as a smooth entry point for Solana users who want:

- Fast swaps
- Mobile-first UI (Telegram)
- Gasless execution (via SpiderSwap)
- Zero-code, tap-to-trade flow

---

## 🔧 Tech Stack Overview

| Component       | Tool/Service                         |
| --------------- | ------------------------------------ |
| Bot Platform    | Telegram Bot API                     |
| Swap Aggregator | [SpiderSwap](https://spiderswap.xyz) |
| Network         | Solana (gasless execution)           |
| Language        | Node.js (recommended)                |

---

## 🧠 Core Flow (User Journey)

```plaintext
User opens Telegram → Taps /start → Sees “Swap” button → Selects token pair → Enters amount → Gets quote → Confirms → Transaction executes gaslessly → Sees result
```

---

## 🧱 Basic Commands & Interactions

| Command/Button | Purpose                              |
| -------------- | ------------------------------------ |
| `/start`       | Greets user, offers \[Swap] button   |
| `Swap`         | Begins token swap journey            |
| `Choose From`  | Token to swap from (SOL, USDC, etc.) |
| `Choose To`    | Token to receive                     |
| `Enter Amount` | Amount of token to swap              |
| `Get Quote`    | Fetch quote via SpiderSwap API       |
| `Confirm`      | Executes the swap                    |
| `Status`       | Returns success/fail + explorer link |

---

## 🛠️ Example Bot Dialog

```plaintext
🟢 User: /start
🤖 Bot: Welcome to **Aurion** — your gasless swap assistant on Solana. Ready to swap?

[Swap]

🟢 User: Swap
🤖 Bot: What token do you want to swap **from**?
[SOL] [USDC] [BONK] [More Tokens]

🟢 User: SOL
🤖 Bot: Great. What token do you want to swap **to**?
[USDC] [JUP] [BONK] [Search]

🟢 User: USDC
🤖 Bot: How much SOL do you want to swap?

🟢 User: 2
🤖 Bot: You’ll receive ~33.21 USDC.
Zero gas. Rate expires in 60 seconds. Proceed?

[Confirm] [Cancel]

🟢 User: Confirm
🤖 Bot: ✅ Done! View it on Solana Explorer: [link]
```

---

## 🔗 API Integration Overview

### SpiderSwap API

- **Quote endpoint:** Get best rate & route
- **Execute endpoint:** Submit gasless swap
- **Token list endpoint:** Get supported tokens

Example API Flow:

1. `GET /quote?from=SOL&to=USDC&amount=2`
2. Show estimated amount + slippage
3. `POST /swap` with transaction details
4. Receive success or error

Let me know when you're ready to wire it with SpiderSwap’s real API—we can mock first if needed.

---

## 🎨 Branding & Personality

- **Tone:** Clear, fast, confident
- **Logo Vibe:** Futuristic + clean (web3 energy)
- **Theme Colors:** Deep purple, black, electric green
- **Bot Bio:** “Gasless. Frictionless. Aurion on Solana.”

---

## 📌 Developer Notes

- Use inline buttons for a smooth UI.
- Add rate expiry logic to quotes.
- Handle user wallet addresses securely.
- Consider integrating Phantom deep links later.
