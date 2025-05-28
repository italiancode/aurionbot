// Wallet-related callback handlers
const { 
  getWallet, 
  getAllWallets, 
  setActiveWallet, 
  removeWallet, 
  renameWallet 
} = require("../../solana/wallet/storage");

// Global session state for wallet operations
if (!global.userSessions) global.userSessions = {};

/**
 * Handle wallet management operations
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Message object
 * @param {String} data - Callback data
 */
function handleWalletCallbacks(bot, msg, data, userId) {
  const chatId = msg.chat.id;
  
  // If userId is not provided, try to extract it from the message
  // This is needed because in callbacks, msg.from might not be available
  if (!userId && msg.from) {
    userId = msg.from.id.toString();
  }
  
  // Safety check - if we still don't have a userId, log error and return
  if (!userId) {
    console.error("No userId available in handleWalletCallbacks");
    bot.sendMessage(chatId, "❌ Error: Unable to identify user. Please try again.");
    return;
  }
  
  if (data === "wallet") {
    showWalletInfo(bot, chatId, userId);
  } else if (data === "export_wallet") {
    guideExportWallet(bot, chatId);
  } else if (data === "add_new_wallet") {
    showAddWalletOptions(bot, chatId);
  } else if (data === "select_wallet") {
    showWalletSelectionMenu(bot, chatId, userId);
  } else if (data === "manage_wallets") {
    showWalletManagementMenu(bot, chatId, userId);
  } else if (data.startsWith("set_active_")) {
    handleSetActiveWallet(bot, chatId, userId, data);
  } else if (data.startsWith("manage_")) {
    showWalletManagementOptions(bot, chatId, userId, data);
  } else if (data.startsWith("rename_")) {
    startWalletRenameProcess(bot, chatId, userId, data);
  } else if (data === "cancel_rename") {
    cancelWalletRename(bot, chatId, userId);
  } else if (data.startsWith("remove_")) {
    confirmWalletRemoval(bot, chatId, userId, data);
  } else if (data.startsWith("confirm_remove_")) {
    removeUserWallet(bot, chatId, userId, data);
  } else if (data === "create_new_wallet") {
    guideCreateNewWallet(bot, chatId);
  } else if (data === "import_wallet") {
    guideImportWallet(bot, chatId);
  }
}

/**
 * Show wallet information
 */
function showWalletInfo(bot, chatId, userId) {
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
        [{ text: "⚙️ Manage Wallets", callback_data: "manage_wallets" }],
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
      // No wallet found, guide user to create one
      const noWalletKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✨ Create Wallet", callback_data: "create_new_wallet" }],
            [{ text: "📥 Import Wallet", callback_data: "import_wallet" }],
            [{ text: "🔙 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        "*No Wallet Found*\n\nYou need to create or import a wallet to get started.",
        { parse_mode: "Markdown", ...noWalletKeyboard }
      );
    }
  } catch (error) {
    console.error("Error displaying wallet info:", error.message);
    bot.sendMessage(chatId, `❌ Error: ${error.message}`);
  }
}

/**
 * Guide user to export wallet
 */
function guideExportWallet(bot, chatId) {
  bot.sendMessage(chatId, "Use the /exportwallet command to see your wallet's private key.");
}

/**
 * Show options to add a new wallet
 */
function showAddWalletOptions(bot, chatId) {
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
}

/**
 * Show wallet selection menu
 */
function showWalletSelectionMenu(bot, chatId, userId) {
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
}

/**
 * Show wallet management menu
 */
function showWalletManagementMenu(bot, chatId, userId) {
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
}

/**
 * Handle setting active wallet
 */
function handleSetActiveWallet(bot, chatId, userId, data) {
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
}

/**
 * Show options for managing a specific wallet
 */
function showWalletManagementOptions(bot, chatId, userId, data) {
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
}

/**
 * Start wallet rename process
 */
function startWalletRenameProcess(bot, chatId, userId, data) {
  // Extract wallet ID from callback data
  const walletId = data.replace("rename_", "");
  
  // Store wallet ID in user session
  if (!global.userSessions[userId]) global.userSessions[userId] = {};
  global.userSessions[userId].renameWalletId = walletId;
  global.userSessions[userId].awaitingRename = true;
  
  bot.sendMessage(
    chatId,
    "Please send the new name for your wallet:\n\nReply with text or click Cancel to abort.",
    { reply_markup: { inline_keyboard: [[{ text: "Cancel", callback_data: "cancel_rename" }]] } }
  );
}

/**
 * Cancel wallet rename process
 */
function cancelWalletRename(bot, chatId, userId) {
  // Clear rename session
  if (global.userSessions[userId]) {
    delete global.userSessions[userId].renameWalletId;
    global.userSessions[userId].awaitingRename = false;
  }
  
  bot.sendMessage(
    chatId,
    "❌ Wallet rename cancelled.",
    { reply_markup: { inline_keyboard: [[{ text: "Back to Manage Wallets", callback_data: "manage_wallets" }]] } }
  );
}

/**
 * Confirm wallet removal
 */
function confirmWalletRemoval(bot, chatId, userId, data) {
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
}

/**
 * Remove wallet after confirmation
 */
function removeUserWallet(bot, chatId, userId, data) {
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
}

/**
 * Guide user to create a new wallet
 */
function guideCreateNewWallet(bot, chatId) {
  bot.sendMessage(
    chatId,
    "📝 *Add a New Wallet*\n\nUse the /createwallet command to create a new wallet.\n\nThis will be added to your wallet list without replacing your existing wallets.",
    { parse_mode: "Markdown" }
  );
}

/**
 * Guide user to import a wallet
 */
function guideImportWallet(bot, chatId) {
  bot.sendMessage(
    chatId,
    "📝 *Import a Wallet*\n\nUse the /importwallet command followed by the private key of the wallet you want to import.\n\nExample: `/importwallet your_private_key_here`\n\nThis will be added to your wallet list without replacing your existing wallets.",
    { parse_mode: "Markdown" }
  );
}

/**
 * Handle text messages for wallet rename
 */
function handleRenameMessage(bot, msg) {
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
    
    return true; // Message was handled
  }
  
  return false; // Message was not handled
}

module.exports = {
  handleWalletCallbacks,
  handleRenameMessage,
  showWalletInfo
};
