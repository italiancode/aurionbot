// Direct import to avoid reference issues
const exportWallet = require("../../solana/wallet/export");

module.exports = function handleExport(bot) {
  bot.onText(/\/exportwallet/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id.toString();
    
    try {
      // Send a temporary message while retrieving wallet
      const loadingMsg = await bot.sendMessage(
        chatId,
        "⏳ Retrieving your wallet details..."
      );
      
      // Get the wallet using exportWallet function
      const userWallet = exportWallet(userId);
      
      if (!userWallet) {
        await bot.editMessageText(
          `❌ No wallet found. Use /createwallet to create a new wallet or /import to import an existing one.`,
          {
            chat_id: chatId,
            message_id: loadingMsg.message_id
          }
        );
        return;
      }
      
      // Send wallet details with security warning
      await bot.editMessageText(
        `🔐 Your active wallet details:\n\n📌 Name: ${userWallet.name || 'Unnamed wallet'}\n\n🔑 Public Key:\n\`${userWallet.publicKey}\`\n\n🔑 Private Key:\n\`${userWallet.privateKey}\`\n\n⚠️ SECURITY WARNING: Anyone who has access to this private key has full control of your wallet. Keep it confidential and never share it in public chats.`,
        {
          chat_id: chatId,
          message_id: loadingMsg.message_id,
          parse_mode: "Markdown"
        }
      );
      
      // Send a self-destruct message notice
      setTimeout(() => {
        bot.sendMessage(
          chatId,
          "⚠️ For security reasons, please delete the above message containing your private key after you've saved it."
        );
      }, 5000); // Send after 5 seconds
      
    } catch (error) {
      console.error("Export wallet error:", error.message);
      bot.sendMessage(
        chatId,
        `❌ Failed to export wallet: ${error.message}`
      );
    }
  });
}