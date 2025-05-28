// Command handler for /start
const { getWallet, getAllWallets } = require("../../solana/wallet/storage");
const {
  handleWalletCallbacks,
  handleRenameMessage,
} = require("../handlers/walletHandlers");

const {
  initSwapFlow,
  handleSwapCallbacks,
  processMessageInput,
  executeSwap,
} = require("../handlers/swapHandler");

module.exports = function handleStart(bot) {
  // Set up a message handler for wallet renaming and swap input
  bot.on("message", async (msg) => {
    if (handleRenameMessage(bot, msg)) {
      return; // Message handled by wallet logic
    }

    // Try to process as swap input (token address or amount)
    try {
      if (await processMessageInput(bot, msg)) {
        return; // Message handled by swap flow
      }
    } catch (error) {
      console.error("Error processing message input:", error);
      // Optionally notify user of the error
      bot.sendMessage(
        msg.chat.id,
        "❌ An error occurred processing your input. Please try again."
      );
      return;
    }

    // Handle other message types here if needed
  });

  // Define keyboard options based on whether user has a wallet
  function getStartKeyboard(userId) {
    const wallets = getAllWallets(userId);

    // Standard keyboard for all users
    return {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Swap", callback_data: "swap" },
            { text: "👛 Wallet", callback_data: "wallet" },
          ],
          [
            { text: "📊 Portfolio", callback_data: "portfolio" },
            { text: "ℹ️ Help", callback_data: "help" },
          ],
        ],
      },
    };
  }

  // Handle the /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    bot.sendMessage(
      chatId,
      `🚀 *Welcome to Aurion Swap*\n\n` +
        `⚡ *Lightning Fast Solana Swaps*\n` +
        `🔒 *Secure & Decentralized*\n` +
        `💎 *Best Rates Guaranteed*\n\n` +
        `🚀 *Gasless swaps?* Yup.\nSwap any token *to SOL* — even with *0 SOL* in your wallet.\n\n` +
        `Ready to get started? 👇`,
      { parse_mode: "Markdown", ...getStartKeyboard(userId) }
    );
  });

  // Handle callback queries (button clicks)
  bot.on("callback_query", async (callbackQuery) => {
    const data = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();

    // Delegate to appropriate handler based on callback data
    if (data === "swap") {
      // Check if user has a wallet before starting swap flow
      const wallets = getAllWallets(userId);

      if (wallets && wallets.length > 0) {
        // User has a wallet, start swap flow
        initSwapFlow(bot, msg);
      } else {
        // User doesn't have a wallet, show wallet creation options
        bot.answerCallbackQuery(callbackQuery.id);
        bot.editMessageText(
          `🔐 *Wallet Required*\n\n` +
            `To start swapping, you need a Solana wallet.\n\n` +
            `**Choose an option:**\n` +
            `• Create a new wallet (recommended for beginners)\n` +
            `• Import your existing wallet`,
          {
            chat_id: chatId,
            message_id: msg.message_id,
            parse_mode: "Markdown",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "✨ Create New Wallet",
                    callback_data: "create_new_wallet",
                  },
                  { text: "📥 Import Wallet", callback_data: "import_wallet" },
                ],
                [
                  {
                    text: "↩️ Back to Main",
                    callback_data: "back_to_main",
                  },
                ],
              ],
            },
          }
        );
      }
    } else if (data === "back_to_main") {
      bot.answerCallbackQuery(callbackQuery.id);
      bot.editMessageText(
        `🚀 *Welcome to Aurion Swap*\n\n` +
          `⚡ *Lightning Fast Solana Swaps*\n` +
          `🔒 *Secure & Decentralized*\n` +
          `💎 *Best Rates Guaranteed*\n\n` +
          `🚀 *Gasless swaps?* Yup.\nSwap any token *to SOL* — even with *0 SOL* in your wallet.\n\n` +
          `Ready to get started? 👇`,
        {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
          ...getStartKeyboard(userId),
        }
      );
    } else if (data.startsWith("swap_")) {
      // Handle all swap-related callbacks
      handleSwapCallbacks(bot, callbackQuery);
    } else {
      // Handle wallet-related callbacks
      bot.answerCallbackQuery(callbackQuery.id);
      handleWalletCallbacks(bot, msg, data, userId);
    }
  });
};
