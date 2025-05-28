// Command handler for /start
const { getWallet } = require("../../solana/wallet/storage");
const swapHandler = require("../handlers/swapHandler");
const {
  handleWalletCallbacks,
  handleRenameMessage,
} = require("../handlers/walletHandlers");

module.exports = function handleStart(bot) {
  // Set up a message handler for wallet renaming
  bot.on("message", (msg) => {
    if (handleRenameMessage(bot, msg)) {
      return; // Message handled by wallet logic
    }

    // Handle other message types here if needed
  });

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 Swap", callback_data: "swap" },
          { text: "👛 View Wallet", callback_data: "wallet" },
        ],
      ],
    },
  };

  // Handle the /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();

    bot.sendMessage(
      chatId,
      `*Welcome to Aurion Swap Bot!*\n\n` +
        `Swap any token on Solana ⚡️\n\n` +
        `🚀 *Gasless swaps?* Yup.\nSwap any token *to SOL* — even with *0 SOL* in your wallet.\n\n` +
        `What’s next, Captain?`,
      { parse_mode: "Markdown", ...keyboard }
    );
  });

  // Handle callback queries (button clicks)
  bot.on("callback_query", async (callbackQuery) => {
    const data = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const userId = callbackQuery.from.id.toString();

    bot.answerCallbackQuery(callbackQuery.id);

    if (data === "swap") {
      // bot.sendMessage(
      //   chatId,
      //   `*Token Swap*\n\n` +
      //     `_Token swap feature is coming soon!_\n\n` +
      //     `You'll be able to swap between any tokens on Solana — smooth and simple.`,
      //   { parse_mode: "Markdown" }
      // );
      swapHandler();
    } else if (data === "back_to_main") {
      // const keyboard = {
      //   reply_markup: {
      //     inline_keyboard: [
      //       [
      //         { text: "🔄 Swap", callback_data: "swap" },
      //         { text: "👛 View Wallet", callback_data: "wallet" },
      //       ],
      //     ],
      //   },
      // };

      bot.sendMessage(
        chatId,
        `*Welcome to Aurion Swap Bot!*\n\n` +
          `Swap any token on Solana ⚡️\n\n` +
          `🚀 *Gasless swaps?* Yup.\nSwap any token *to SOL* — even with *0 SOL* in your wallet.\n\n` +
          `What’s next, Captain?`,
        { parse_mode: "Markdown", ...keyboard }
      );
    } else {
      handleWalletCallbacks(bot, msg, data, userId);
    }
  });
};
