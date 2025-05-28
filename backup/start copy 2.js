// Command handler for /start
const { getWallet, getAllWallets, setActiveWallet, removeWallet, renameWallet } = require("../solana/wallet/storage");

module.exports = function handleStart(bot) {
  // Set up a message handler for wallet renaming
  bot.on('message', (msg) => {
    const userId = msg.from.id.toString();
    const chatId = msg.chat.id;
    const text = msg.text;
    
    // Check if user is in the process of renaming a wallet
    if (global.userSessions && 
        global.userSessions[userId] && 
        global.userSessions[userId].awaitingRename && 
        !text.startsWith('/') && 
        text) {
      
      const walletId = global.userSessions[userId].renameWalletId;
      
      // Attempt to rename the wallet
      const success = renameWallet(userId, walletId, text);
      
      // Clear session state
      global.userSessions[userId].awaitingRename = false;
      delete global.userSessions[userId].renameWalletId;
      
      if (success) {
        bot.sendMessage(
          chatId, 
          `✅ Wallet renamed to "${text}" successfully.`,
          { reply_markup: { inline_keyboard: [[{ text: "View Wallets", callback_data: "wallet" }]] } }
        );
      } else {
        bot.sendMessage(
          chatId,
          "❌ Failed to rename wallet. Please try again.",
          { reply_markup: { inline_keyboard: [[{ text: "Back to Manage Wallets", callback_data: "manage_wallets" }]] } }
        );
      }
      
      // Return to prevent handling this message elsewhere
      return;
    }
  });
  
  // Handle the /start command
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Create inline keyboard with Swap and Wallet buttons
    const inlineKeyboard = {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Swap", callback_data: "swap" },
            { text: "👛 View Wallet", callback_data: "wallet" }
          ]
        ]
      }
    };
    
    bot.sendMessage(
      chatId,
      "Hey, I'm Aurion — your gasless swap assistant built on SpiderSwap and powered by Solana.\nWhat would you like to do?",
      inlineKeyboard
    );
  });
  
  // Handle callback queries from inline buttons
  bot.on("callback_query", async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;
    
    // Acknowledge the callback query
    bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === "wallet") {
      try {
        // Get all user's wallets
        const wallets = getAllWallets(userId);
        
        if (wallets && wallets.length > 0) {
          // Get active wallet information
          const activeWallet = getWallet(userId);
          
          // Create inline keyboard for wallet management
          const walletButtons = [
            [{ text: "📤 Export Active Wallet", callback_data: "export_wallet" }],
            [{ text: "✨ Add New Wallet", callback_data: "add_new_wallet" }],
          ];
          
          // Add wallet selection buttons if there's more than one wallet
          if (wallets.length > 1) {
            walletButtons.push([{ text: "🔍 Select Active Wallet", callback_data: "select_wallet" }]);
          }
          
          // Add wallet management buttons
          walletButtons.push([{ text: "🔙 Back to Main Menu", callback_data: "back_to_main" }]);
          
          const walletKeyboard = {
            reply_markup: {
              inline_keyboard: walletButtons
            }
          };
          
          // Prepare wallet list text
          let walletListText = "";
          if (wallets.length > 1) {
            walletListText = "\n\n*Your Wallets:*\n";
            wallets.forEach((w) => {
              walletListText += `${w.isActive ? "✅ " : ""} ${w.name}: \`${w.publicKey}\`\n`;
            });
          }
          
          // Send wallet information
          bot.sendMessage(
            chatId,
            `*Your Wallet Information*\n\n🧾 *Active Wallet*: ${activeWallet.name}\n\n🔑 *Public Key*:\n\`${activeWallet.publicKey}\`\n\n💰 *Balance*: Loading...${walletListText}\n\n_Future updates will show your token balances and more wallet features here._`,
            { parse_mode: "Markdown", ...walletKeyboard }
          );
        } else {
          // User doesn't have a wallet yet
          const createWalletKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [{ text: "✨ Create New Wallet", callback_data: "create_new_wallet" }],
                [{ text: "📥 Import Existing Wallet", callback_data: "import_wallet" }],
                [{ text: "🔙 Back to Main Menu", callback_data: "back_to_main" }]
              ]
            }
          };
          
          bot.sendMessage(
            chatId,
            "You don't have a wallet yet. Would you like to create a new one or import an existing wallet?",
            createWalletKeyboard
          );
        }
      } catch (error) {
        console.error("Error handling wallet button:", error.message);
        bot.sendMessage(chatId, `Error accessing wallet information: ${error.message}`);
      }
    } else if (data === "swap") {
      // Handle swap button click
      bot.sendMessage(
        chatId,
        "💱 *Swap Feature*\n\nTo swap tokens, use the /swap command followed by the tokens you want to exchange.\n\nExample: `/swap SOL USDC`\n\nMore advanced swap features coming soon!",
        { parse_mode: "Markdown" }
      );
    } else if (data === "back_to_main") {
      // Handle back to main menu button
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Swap", callback_data: "swap" },
              { text: "👛 View Wallet", callback_data: "wallet" }
            ]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        "What would you like to do?",
        inlineKeyboard
      );
    } else if (data === "create_new_wallet") {
      // Trigger the createwallet command
      bot.sendMessage(chatId, "Use the /createwallet command to create your new wallet.");
    } else if (data === "import_wallet") {
      // Guide user to import wallet
      bot.sendMessage(chatId, "To import your wallet, use the /importwallet command followed by your private key.\n\nExample: `/importwallet your_private_key_here`");
    } else if (data === "export_wallet") {
      // Guide user to export wallet
      bot.sendMessage(chatId, "Use the /exportwallet command to see your wallet's private key.");
    } else if (data === "add_new_wallet") {
      // Provide wallet addition options
      const addWalletKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Create New Wallet", callback_data: "create_new_wallet" }],
            [{ text: "📥 Import Existing Wallet", callback_data: "import_wallet" }],
            [{ text: "🔙 Back to Wallet", callback_data: "wallet" }]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        "*Add a New Wallet*\n\nYou can add up to 5 wallets. Choose how you'd like to add a new wallet:",
        { parse_mode: "Markdown", ...addWalletKeyboard }
      );
    } else if (data === "select_wallet") {
      // Get all user's wallets
      const wallets = getAllWallets(userId);
      
      if (!wallets || wallets.length === 0) {
        return bot.sendMessage(chatId, "You don't have any wallets yet.");
      }
      
      // Create keyboard with all wallets
      const walletButtons = wallets.map(wallet => [
        { 
          text: `${wallet.isActive ? "✅ " : ""}${wallet.name} (${wallet.publicKey.substring(0, 8)}...)`, 
          callback_data: `set_active_${wallet.id}` 
        }
      ]);
      
      // Add manage wallets and back buttons
      walletButtons.push([{ text: "⚙️ Manage Wallets", callback_data: "manage_wallets" }]);
      walletButtons.push([{ text: "🔙 Back to Wallet", callback_data: "wallet" }]);
      
      const selectWalletKeyboard = {
        reply_markup: {
          inline_keyboard: walletButtons
        }
      };
      
      bot.sendMessage(
        chatId,
        "*Select Active Wallet*\n\nChoose which wallet you want to set as active for all operations:\n\nℹ️ The active wallet is used for swaps and other transactions.",
        { parse_mode: "Markdown", ...selectWalletKeyboard }
      );
    } else if (data === "manage_wallets") {
      // Get all user's wallets
      const wallets = getAllWallets(userId);
      
      if (!wallets || wallets.length === 0) {
        return bot.sendMessage(chatId, "You don't have any wallets yet.");
      }
      
      // Create keyboard for wallet management
      const walletButtons = wallets.map(wallet => [
        { 
          text: `${wallet.isActive ? "✅ " : ""}${wallet.name}`, 
          callback_data: `manage_${wallet.id}` 
        }
      ]);
      
      // Add back button
      walletButtons.push([{ text: "🔙 Back to Wallet", callback_data: "wallet" }]);
      
      const manageWalletsKeyboard = {
        reply_markup: {
          inline_keyboard: walletButtons
        }
      };
      
      bot.sendMessage(
        chatId,
        "*Manage Your Wallets*\n\nSelect a wallet to rename or remove it:\n\nℹ️ You can have up to 5 wallets.",
        { parse_mode: "Markdown", ...manageWalletsKeyboard }
      );
    } else if (data.startsWith("set_active_")) {
      // Extract wallet ID from callback data
      const walletId = data.replace("set_active_", "");
      
      // Set wallet as active
      const success = setActiveWallet(userId, walletId);
      
      if (success) {
        bot.sendMessage(
          chatId,
          "✅ Active wallet updated successfully!",
          { reply_markup: { inline_keyboard: [[{ text: "View Wallets", callback_data: "wallet" }]] } }
        );
      } else {
        bot.sendMessage(
          chatId,
          "❌ Failed to update active wallet. Please try again.",
          { reply_markup: { inline_keyboard: [[{ text: "Back to Wallets", callback_data: "wallet" }]] } }
        );
      }
    } else if (data.startsWith("manage_")) {
      // Extract wallet ID from callback data
      const walletId = data.replace("manage_", "");
      
      // Get all wallets to find the one being managed
      const wallets = getAllWallets(userId);
      const wallet = wallets.find(w => w.id === walletId);
      
      if (!wallet) {
        return bot.sendMessage(chatId, "❌ Wallet not found.");
      }
      
      // Create keyboard for wallet management options
      const walletManageKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "📝 Rename Wallet", callback_data: `rename_${walletId}` }],
            [{ text: "🚮 Remove Wallet", callback_data: `remove_${walletId}` }],
            [{ text: "🔙 Back to Manage Wallets", callback_data: "manage_wallets" }]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        `*Manage Wallet: ${wallet.name}*\n\n🔑 Public Key:\n\`${wallet.publicKey}\`\n\nWhat would you like to do with this wallet?`,
        { parse_mode: "Markdown", ...walletManageKeyboard }
      );
    } else if (data.startsWith("rename_")) {
      // Extract wallet ID from callback data
      const walletId = data.replace("rename_", "");
      
      // Store wallet ID in user session (for simplicity, we'll use a global object here)
      if (!global.userSessions) global.userSessions = {};
      if (!global.userSessions[userId]) global.userSessions[userId] = {};
      global.userSessions[userId].renameWalletId = walletId;
      global.userSessions[userId].awaitingRename = true;
      
      bot.sendMessage(
        chatId,
        "Please send the new name for your wallet:\n\nReply with text or click Cancel to abort.",
        { reply_markup: { inline_keyboard: [[{ text: "Cancel", callback_data: "cancel_rename" }]] } }
      );
    } else if (data === "cancel_rename") {
      // Clear rename session
      if (global.userSessions && global.userSessions[userId]) {
        delete global.userSessions[userId].renameWalletId;
        global.userSessions[userId].awaitingRename = false;
      }
      
      bot.sendMessage(
        chatId,
        "❌ Wallet rename cancelled.",
        { reply_markup: { inline_keyboard: [[{ text: "Back to Manage Wallets", callback_data: "manage_wallets" }]] } }
      );
    } else if (data.startsWith("remove_")) {
      // Extract wallet ID from callback data
      const walletId = data.replace("remove_", "");
      
      // Get all wallets to find the one being removed
      const wallets = getAllWallets(userId);
      const wallet = wallets.find(w => w.id === walletId);
      
      if (!wallet) {
        return bot.sendMessage(chatId, "❌ Wallet not found.");
      }
      
      // Confirmation keyboard
      const confirmKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "❌ No, Keep It", callback_data: "manage_wallets" },
              { text: "✅ Yes, Remove", callback_data: `confirm_remove_${walletId}` }
            ]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        `⚠️ *Are you sure you want to remove wallet "${wallet.name}"?*\n\nThis action cannot be undone. Make sure you have exported the private key if you need it.`,
        { parse_mode: "Markdown", ...confirmKeyboard }
      );
    } else if (data.startsWith("confirm_remove_")) {
      // Extract wallet ID from callback data
      const walletId = data.replace("confirm_remove_", "");
      
      // Remove wallet
      const success = removeWallet(userId, walletId);
      
      if (success) {
        bot.sendMessage(
          chatId,
          "✅ Wallet removed successfully.",
          { reply_markup: { inline_keyboard: [[{ text: "Back to Wallets", callback_data: "wallet" }]] } }
        );
      } else {
        bot.sendMessage(
          chatId,
          "❌ Failed to remove wallet. Please try again.",
          { reply_markup: { inline_keyboard: [[{ text: "Back to Manage Wallets", callback_data: "manage_wallets" }]] } }
        );
      }
    } else if (data === "create_new_wallet") {
      // Guide user to create a new wallet
      bot.sendMessage(
        chatId,
        "📝 *Add a New Wallet*\n\nUse the /createwallet command to create a new wallet.\n\nThis will be added to your wallet list without replacing your existing wallets.",
        { parse_mode: "Markdown" }
      );
    } else if (data === "import_wallet") {
      // Guide user to import a wallet
      bot.sendMessage(
        chatId,
        "📝 *Import a Wallet*\n\nUse the /importwallet command followed by the private key of the wallet you want to import.\n\nExample: `/importwallet your_private_key_here`\n\nThis will be added to your wallet list without replacing your existing wallets.",
        { parse_mode: "Markdown" }
      );
    }
  });
}