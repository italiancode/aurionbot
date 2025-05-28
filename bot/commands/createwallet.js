// Direct imports to avoid reference issues
const createWallet = require("../../solana/wallet/create");
const { getAllWallets } = require("../../solana/wallet/storage");

module.exports = function handleCreateWallet(bot) {
  bot.onText(/\/createwallet/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    try {
      // Check if user has reached wallet limit
      const existingWallets = getAllWallets(userId);
      if (existingWallets && existingWallets.length >= 5) {
        return bot.sendMessage(
          chatId,
          `⚠️ You've reached the maximum wallet limit (5 wallets).\n\nPlease remove an existing wallet before creating a new one.`,
          { parse_mode: "Markdown" }
        );
      }
      
      // Send a temporary message while creating wallet
      const loadingMsg = await bot.sendMessage(
        chatId,
        "⏳ Creating your new Solana wallet..."
      );
      
      // Create the wallet
      const newWallet = createWallet(userId);
      
      // Edit the message with wallet details
      await bot.editMessageText(
        `✅ New wallet created!\n\n📌 Name: ${newWallet.name}\n\n🔑 Public Key:\n\`${newWallet.publicKey}\`\n\n🔐 Private Key (store securely):\n\`${newWallet.privateKey}\`\n\n⚠️ IMPORTANT: Save this private key in a secure place. It will be needed to recover your wallet if you lose access to this bot.\n\nThis wallet has been added to your wallet list. Use /start to manage your wallets.`,
        {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown"
        }
      );
    } catch (error) {
      console.error("Create wallet error:", error.message);
      bot.sendMessage(
        chatId,
        `❌ Failed to create wallet: ${error.message}`
      );
    }
  });
}