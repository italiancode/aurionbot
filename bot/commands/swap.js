const swapHandler = require("../handlers/swapHandler");

module.exports = function handleSwap(bot) {
  bot.onText(/\/swap (.+) (.+) (.+)/, (msg, match) => {
    swapHandler(bot, msg, match);
  });
} 