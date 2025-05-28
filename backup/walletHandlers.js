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
    bot.sendMessage(chatId, "❌ *Error*\n\nUnable to identify user. Please try again.", { parse_mode: "Markdown" });
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

      // Create clean, organized button layout
      const walletButtons = [];

      // Primary actions row
      walletButtons.push([
        { text: "📤 Export Wallet", callback_data: "export_wallet" },
        { text: "➕ Add Wallet", callback_data: "add_new_wallet" }
      ]);

      // Management actions (only show if multiple wallets or management needed)
      if (wallets.length > 1) {
        walletButtons.push([
          { text: "🔄 Switch Wallet", callback_data: "select_wallet" },
          { text: "⚙️ Manage Wallets", callback_data: "manage_wallets" }
        ]);
      } else {
        walletButtons.push([
          { text: "⚙️ Manage Wallets", callback_data: "manage_wallets" }
        ]);
      }

      // Navigation
      walletButtons.push([
        { text: "🔙 Main Menu", callback_data: "back_to_main" }
      ]);

      const walletKeyboard = {
        reply_markup: {
          inline_keyboard: walletButtons
        }
      };

      // Enhanced wallet display
      let message = `🏦 *WALLET OVERVIEW*\n\n`;
      message += `✅ *Active Wallet*\n`;
      message += `📛 Name: \`${activeWallet.name}\`\n`;
      message += `🔑 Address: \`${activeWallet.publicKey}\`\n`;
      message += `💰 Balance: Loading...\n\n`;

      // Show wallet count and list if multiple
      if (wallets.length > 1) {
        message += `📋 *Your Wallets* (${wallets.length}/5)\n`;
        message += `┌─────────────────────────\n`;
        wallets.forEach((w, index) => {
          const status = w.isActive ? "🟢" : "⚪";
          const shortKey = `${w.publicKey.substring(0, 4)}...${w.publicKey.substring(-4)}`;
          message += `${index === wallets.length - 1 ? "└" : "├"} ${status} ${w.name} (${shortKey})\n`;
        });
        message += `\n`;
      }

      message += `ℹ️ _Token balances and portfolio details coming soon_`;

      // Send wallet information
      bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...walletKeyboard });
    } else {
      // Enhanced no wallet state
      const noWalletKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✨ Create Wallet", callback_data: "create_new_wallet" },
              { text: "📥 Import Wallet", callback_data: "import_wallet" }
            ],
            [
              { text: "🔙 Main Menu", callback_data: "back_to_main" }
            ]
          ]
        }
      };

      const message = `🏦 *WALLET SETUP*\n\n` +
        `🚀 *Get Started*\n` +
        `You need a wallet to start trading and managing your tokens.\n\n` +
        `Choose an option below to set up your first wallet:`;

      bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...noWalletKeyboard });
    }
  } catch (error) {
    console.error("Error displaying wallet info:", error.message);
    bot.sendMessage(chatId, `❌ *Error*\n\n${error.message}`, { parse_mode: "Markdown" });
  }
}

/**
 * Guide user to export wallet
 */
function guideExportWallet(bot, chatId) {
  const message = `🔐 *EXPORT WALLET*\n\n` +
    `🔑 To view your private key, use:\n` +
    `\`/exportwallet\`\n\n` +
    `⚠️ *Security Warning*\n` +
    `• Never share your private key\n` +
    `• Store it securely offline\n` +
    `• Anyone with your private key controls your funds`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

/**
 * Show options to add a new wallet
 */
function showAddWalletOptions(bot, chatId) {
  const addWalletKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✨ Create New", callback_data: "create_new_wallet" },
          { text: "📥 Import Existing", callback_data: "import_wallet" }
        ],
        [
          { text: "🔙 Back to Wallet", callback_data: "wallet" }
        ]
      ]
    }
  };

  const message = `➕ *ADD NEW WALLET*\n\n` +
    `📊 *Current Status*\n` +
    `You can manage up to 5 wallets total.\n\n` +
    `🎯 *Choose Method*\n` +
    `• **Create New** - Generate a fresh wallet\n` +
    `• **Import Existing** - Add wallet from private key`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...addWalletKeyboard });
}

/**
 * Show wallet selection menu
 */
function showWalletSelectionMenu(bot, chatId, userId) {
  // Get all user's wallets
  const wallets = getAllWallets(userId);

  if (!wallets || wallets.length === 0) {
    return bot.sendMessage(chatId, "❌ *No Wallets Found*\n\nPlease create a wallet first.", { parse_mode: "Markdown" });
  }

  // Create clean wallet selection buttons
  const walletButtons = wallets.map(wallet => {
    const shortKey = `${wallet.publicKey.substring(0, 4)}...${wallet.publicKey.substring(-4)}`;
    const status = wallet.isActive ? "🟢" : "⚪";
    return [{
      text: `${status} ${wallet.name} (${shortKey})`,
      callback_data: `set_active_${wallet.id}`
    }];
  });

  // Add navigation
  walletButtons.push([{ text: "🔙 Back to Wallet", callback_data: "wallet" }]);

  const selectWalletKeyboard = {
    reply_markup: {
      inline_keyboard: walletButtons
    }
  };

  const message = `🔄 *SWITCH ACTIVE WALLET*\n\n` +
    `🎯 *Select New Active Wallet*\n` +
    `Choose which wallet to use for all transactions:\n\n` +
    `🟢 = Currently Active\n` +
    `⚪ = Available`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...selectWalletKeyboard });
}

/**
 * Show wallet management menu
 */
function showWalletManagementMenu(bot, chatId, userId) {
  // Get all user's wallets
  const wallets = getAllWallets(userId);

  if (!wallets || wallets.length === 0) {
    return bot.sendMessage(chatId, "❌ *No Wallets Found*\n\nPlease create a wallet first.", { parse_mode: "Markdown" });
  }

  // Create wallet management buttons
  const walletButtons = wallets.map(wallet => {
    const status = wallet.isActive ? "🟢" : "⚪";
    return [{
      text: `${status} ${wallet.name}`,
      callback_data: `manage_${wallet.id}`
    }];
  });

  // Add navigation
  walletButtons.push([{ text: "🔙 Back to Wallet", callback_data: "wallet" }]);

  const manageWalletsKeyboard = {
    reply_markup: {
      inline_keyboard: walletButtons
    }
  };

  const message = `⚙️ *MANAGE WALLETS*\n\n` +
    `📊 *Wallet Count:* ${wallets.length}/5\n\n` +
    `🎯 *Select Wallet to Manage*\n` +
    `Choose a wallet to rename or remove:\n\n` +
    `🟢 = Active Wallet\n` +
    `⚪ = Inactive Wallet`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...manageWalletsKeyboard });
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
    const message = `✅ *WALLET ACTIVATED*\n\n` +
      `🎯 Your active wallet has been updated successfully!\n\n` +
      `All future transactions will use the selected wallet.`;

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "📋 View Wallets", callback_data: "wallet" }
        ]]
      }
    });
  } else {
    const message = `❌ *ACTIVATION FAILED*\n\n` +
      `Unable to update active wallet. Please try again.`;

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Try Again", callback_data: "select_wallet" }
        ]]
      }
    });
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
    return bot.sendMessage(chatId, "❌ *Wallet Not Found*\n\nThe selected wallet could not be found.", { parse_mode: "Markdown" });
  }

  // Create management options
  const walletManageKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📝 Rename", callback_data: `rename_${walletId}` },
          { text: "🗑️ Remove", callback_data: `remove_${walletId}` }
        ],
        [
          { text: "🔙 Back", callback_data: "manage_wallets" }
        ]
      ]
    }
  };

  const shortKey = `${wallet.publicKey.substring(0, 8)}...${wallet.publicKey.substring(-8)}`;
  const status = wallet.isActive ? "🟢 Active" : "⚪ Inactive";

  const message = `⚙️ *WALLET MANAGEMENT*\n\n` +
    `📛 *Name:* ${wallet.name}\n` +
    `📊 *Status:* ${status}\n` +
    `🔑 *Address:* \`${shortKey}\`\n\n` +
    `🎯 *Management Options*\n` +
    `Choose an action for this wallet:`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...walletManageKeyboard });
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

  const message = `📝 *RENAME WALLET*\n\n` +
    `✏️ *Enter New Name*\n` +
    `Send me the new name for your wallet.\n\n` +
    `💡 *Tips:*\n` +
    `• Keep it short and memorable\n` +
    `• Use letters, numbers, spaces\n` +
    `• Max 20 characters`;

  bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "❌ Cancel", callback_data: "cancel_rename" }
      ]]
    }
  });
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

  const message = `❌ *RENAME CANCELLED*\n\n` +
    `The wallet rename operation has been cancelled.`;

  bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[
        { text: "🔙 Back", callback_data: "manage_wallets" }
      ]]
    }
  });
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
    return bot.sendMessage(chatId, "❌ *Wallet Not Found*\n\nThe selected wallet could not be found.", { parse_mode: "Markdown" });
  }

  // Confirmation keyboard
  const confirmKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Yes, Remove", callback_data: `confirm_remove_${walletId}` }
        ],
        [
          { text: "❌ Cancel", callback_data: "manage_wallets" }
        ]
      ]
    }
  };

  const message = `⚠️ *CONFIRM REMOVAL*\n\n` +
    `🗑️ **Wallet:** ${wallet.name}\n\n` +
    `❗ *Warning*\n` +
    `This action cannot be undone!\n\n` +
    `Make sure you have:\n` +
    `• ✅ Exported the private key\n` +
    `• ✅ Saved it securely\n` +
    `• ✅ Transferred any funds\n\n` +
    `Are you absolutely sure?`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown", ...confirmKeyboard });
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
    const message = `✅ *WALLET REMOVED*\n\n` +
      `🗑️ The wallet has been successfully removed from your account.\n\n` +
      `Your remaining wallets are still secure and accessible.`;

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "📋 View Wallets", callback_data: "wallet" }
        ]]
      }
    });
  } else {
    const message = `❌ *REMOVAL FAILED*\n\n` +
      `Unable to remove the wallet. Please try again.`;

    bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[
          { text: "🔄 Try Again", callback_data: "manage_wallets" }
        ]]
      }
    });
  }
}

/**
 * Guide user to create a new wallet
 */
function guideCreateNewWallet(bot, chatId) {
  const message = `✨ *CREATE NEW WALLET*\n\n` +
    `🚀 *Ready to Create*\n` +
    `Use this command to generate a new wallet:\n\n` +
    `\`/createwallet\`\n\n` +
    `💡 *What Happens Next*\n` +
    `• A new wallet will be generated\n` +
    `• It will be added to your wallet list\n` +
    `• Your existing wallets remain safe\n` +
    `• You can manage up to 5 total wallets`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
}

/**
 * Guide user to import a wallet
 */
function guideImportWallet(bot, chatId) {
  const message = `📥 *IMPORT WALLET*\n\n` +
    `🔐 *Import Command*\n` +
    `Use this format to import your wallet:\n\n` +
    `\`/importwallet your_private_key_here\`\n\n` +
    `⚠️ *Security Reminder*\n` +
    `• Only import wallets you own\n` +
    `• Never share your private key\n` +
    `• Delete the message after importing\n\n` +
    `💡 *After Import*\n` +
    `Your imported wallet will be added to your collection without affecting existing wallets.`;

  bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
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

    // Validate name length
    if (text.length > 20) {
      bot.sendMessage(chatId,
        `❌ *Name Too Long*\n\nWallet names must be 20 characters or less.\n\nPlease try a shorter name.`,
        { parse_mode: "Markdown" }
      );
      return true;
    }

    // Attempt to rename the wallet
    const success = renameWallet(userId, walletId, text);

    // Clear session state
    global.userSessions[userId].awaitingRename = false;
    delete global.userSessions[userId].renameWalletId;

    if (success) {
      const message = `✅ *WALLET RENAMED*\n\n` +
        `📛 **New Name:** ${text}\n\n` +
        `Your wallet has been successfully renamed!`;

      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "📋 View Wallets", callback_data: "wallet" }
          ]]
        }
      });
    } else {
      const message = `❌ *RENAME FAILED*\n\n` +
        `Unable to rename the wallet. Please try again.`;

      bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [[
            { text: "🔄 Try Again", callback_data: "manage_wallets" }
          ]]
        }
      });
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