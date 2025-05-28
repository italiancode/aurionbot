const { showWalletInfo } = require("../handlers/walletHandlers");

module.exports = function handleWallet(bot) {
  bot.onText(/\/wallet/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    showWalletInfo(bot, chatId, userId);
  });
} 