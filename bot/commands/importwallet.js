// Direct imports to avoid reference issues
const importWallet = require("../../solana/wallet/import");
const { getAllWallets } = require("../../solana/wallet/storage");

module.exports = function handleImport(bot) {
  // Handle /import command with no parameters
  bot.onText(/^\/importwallet$/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `ℹ️ To import a wallet, please provide your private key:\n\n/importwallet YOUR_PRIVATE_KEY\n\nExample:\n/importwallet 4YourActualPrivateKeyHere123456789`
    );
  });

  // Handle /import command with private key parameter
  bot.onText(/\/importwallet (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    const privateKey = match[1].trim();

    try {
      // Check if user has reached wallet limit
      const existingWallets = getAllWallets(userId);
      if (existingWallets && existingWallets.length >= 5) {
        return bot.sendMessage(
          chatId,
          `⚠️ You've reached the maximum wallet limit (5 wallets).\n\nPlease remove an existing wallet before importing a new one.`,
          { parse_mode: "Markdown" }
        );
      }

      // Send a temporary message while importing wallet
      const loadingMsg = await bot.sendMessage(
        chatId,
        "⏳ Importing your Solana wallet..."
      );

      // Import the wallet
      const importedWallet = importWallet(userId, privateKey);
      
      // Edit the message with successful import details
      await bot.editMessageText(
        `✅ Wallet imported successfully!\n\n📌 Name: ${importedWallet.name}\n\n🔑 Public Key:\n\`${importedWallet.publicKey}\`\n\nYour wallet has been added to your wallet list. Use /start to manage your wallets.`,
        {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown"
        }
      );
    } catch (error) {
      console.error("Import wallet error:", error.message);
      bot.sendMessage(
        chatId,
        `❌ Failed to import wallet: ${error.message.includes('private key') ? 'Invalid private key format' : error.message}`
      );
    }
  });
}