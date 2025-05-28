// bot/handlers/swapHandler.js
const { swapTokens } = require("../../solana/spiderSwap");
const { sendMessage } = require("../utils/sendMessage");

// Define common tokens with their addresses
const COMMON_TOKENS = {
  SOL: {
    symbol: "SOL",
    mint: "So11111111111111111111111111111111111111112",
    name: "Solana",
    icon: "🌞"
  },
  USDC: {
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    name: "USD Coin",
    icon: "💵"
  },
  USDT: {
    symbol: "USDT",
    mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "Tether USD",
    icon: "💲"
  },
  BONK: {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    name: "Bonk",
    icon: "🐶"
  }
};

// Store active swap sessions for each user
const swapSessions = {};

// Legacy swap handler for command-based swaps
async function swapHandler(bot, msg, match) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString(); // Telegram user ID as string
  const [fromMint, toMint, amountStr] = match.slice(1);
  const amount = parseInt(amountStr);

  if (!fromMint || !toMint || isNaN(amount)) {
    return sendMessage(
      bot,
      chatId,
      "⚠️ Please use the correct format: /swap <fromMint> <toMint> <amount>"
    );
  }

  try {
    await sendMessage(bot, chatId, "🔁 Processing your swap...");
    const signature = await swapTokens(userId, fromMint, toMint, amount);
    await sendMessage(
      bot,
      chatId,
      `✅ Swap complete!\n🔗 https://solscan.io/tx/${signature}`
    );
  } catch (error) {
    await sendMessage(bot, chatId, `❌ Error: ${error.message}`);
  }
}

// Helper to create token selection buttons
function createTokenButtons() {
  const buttons = [];
  const tokensPerRow = 2;
  const tokenKeys = Object.keys(COMMON_TOKENS);
  
  for (let i = 0; i < tokenKeys.length; i += tokensPerRow) {
    const row = [];
    for (let j = 0; j < tokensPerRow && i + j < tokenKeys.length; j++) {
      const token = COMMON_TOKENS[tokenKeys[i + j]];
      row.push({
        text: `${token.icon} ${token.symbol}`,
        callback_data: `select_token_${token.symbol}`
      });
    }
    buttons.push(row);
  }
  
  // Add custom token option and cancel button
  buttons.push([{ text: "➕ Add Custom Token", callback_data: "add_custom_token" }]);
  buttons.push([{ text: "❌ Cancel", callback_data: "cancel_swap" }]);
  
  return buttons;
}

// Helper to create a swap summary keyboard
function createSwapSummaryKeyboard(session) {
  const keyboard = {
    inline_keyboard: [
      [
        { text: "Change From Token", callback_data: "change_from_token" },
        { text: "Change To Token", callback_data: "change_to_token" }
      ]
    ]
  };
  
  // Only show Enter Amount button if both tokens are selected
  if (session.fromToken && session.toToken) {
    keyboard.inline_keyboard.push([
      { text: "💰 Enter Amount", callback_data: "enter_amount" }
    ]);
  }
  
  keyboard.inline_keyboard.push([
    { text: "🔙 Back to Main Menu", callback_data: "back_to_main" }
  ]);
  
  return keyboard;
}

// Helper to get token details
function getTokenDetails(symbol) {
  return COMMON_TOKENS[symbol] || null;
}

// Helper to create confirmation keyboard
function createConfirmationKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "✅ Confirm Swap", callback_data: "confirm_swap" },
        { text: "❌ Cancel", callback_data: "cancel_swap" }
      ]
    ]
  };
}

// Helper to create post-swap keyboard
function createPostSwapKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🔄 Swap Again", callback_data: "swap" },
        { text: "🔙 Back to Main Menu", callback_data: "back_to_main" }
      ]
    ]
  };
}

// Update swap summary message
async function updateSwapSummary(bot, chatId, session) {
  let message = "🔄 *Let's set up your swap:*\n\n";
  
  if (session.fromToken) {
    message += `*From:* ${session.fromToken.icon} ${session.fromToken.name} (${session.fromToken.symbol})\n`;
  } else {
    message += "*From:* (not selected)\n";
  }
  
  if (session.toToken) {
    message += `*To:* ${session.toToken.icon} ${session.toToken.name} (${session.toToken.symbol})\n`;
  } else {
    message += "*To:* (not selected)\n";
  }
  
  if (session.amount) {
    message += `*Amount:* ${session.amount} ${session.fromToken.symbol}\n`;
  } else {
    message += "*Amount:* (not set)\n";
  }
  
  // Add celebration if both tokens are selected
  if (session.fromToken && session.toToken && !session.amount) {
    message = "🎉 *You've selected both tokens!*\n\n" + message;
  }
  
  // If we've shown this message before, edit it; otherwise, send new
  if (session.summaryMessageId) {
    try {
      await bot.editMessageText(message, {
        chat_id: chatId,
        message_id: session.summaryMessageId,
        parse_mode: "Markdown",
        reply_markup: createSwapSummaryKeyboard(session)
      });
    } catch (error) {
      console.error("Error updating message:", error);
      // Send a new message if edit fails
      const newMsg = await bot.sendMessage(chatId, message, {
        parse_mode: "Markdown",
        reply_markup: createSwapSummaryKeyboard(session)
      });
      session.summaryMessageId = newMsg.message_id;
    }
  } else {
    const msg = await bot.sendMessage(chatId, message, {
      parse_mode: "Markdown",
      reply_markup: createSwapSummaryKeyboard(session)
    });
    session.summaryMessageId = msg.message_id;
  }
}

// Handler for the amount input message
function setupAmountInputHandler(bot, userId, chatId) {
  const session = swapSessions[userId];
  if (!session) return;
  
  // Create one-time message handler for amount input
  const messageHandler = async (msg) => {
    // Remove the handler
    bot.removeListener('message', messageHandler);
    
    if (!msg.text || msg.text.startsWith("/")) {
      await bot.sendMessage(chatId, "❌ Operation canceled. Please try again.");
      return;
    }
    
    const amount = parseFloat(msg.text.trim());
    if (isNaN(amount) || amount <= 0) {
      await bot.sendMessage(
        chatId, 
        "⚠️ Invalid amount. Please enter a valid number (e.g., 10).", 
        { reply_markup: { inline_keyboard: [[{ text: "Try Again", callback_data: "enter_amount" }]] } }
      );
      return;
    }
    
    // Update session with amount
    session.amount = amount;
    
    // Show swap review
    await showSwapReview(bot, chatId, userId);
  };
  
  // Register the handler
  bot.on('message', messageHandler);
}

// Show swap review with details
async function showSwapReview(bot, chatId, userId) {
  const session = swapSessions[userId];
  if (!session || !session.fromToken || !session.toToken || !session.amount) {
    await bot.sendMessage(chatId, "❌ Swap session expired or incomplete. Please start again.");
    delete swapSessions[userId];
    return;
  }
  
  // In a real implementation, you'd fetch the actual swap details from Spider Swap API
  // For now, we'll use a placeholder value
  const estimatedReceive = (session.amount * 0.99).toFixed(4); // 1% slippage example
  const rate = (session.amount / estimatedReceive).toFixed(4);
  
  const message = `📝 *Review your swap:*\n\n` +
    `*From:* ${session.fromToken.icon} ${session.amount} ${session.fromToken.symbol}\n` +
    `*To:* ${session.toToken.icon} ${estimatedReceive} ${session.toToken.symbol}\n` +
    `*Rate:* 1 ${session.fromToken.symbol} = ${1/rate} ${session.toToken.symbol}\n` +
    `*Gasless:* Yes ✅\n\n` +
    `Ready to swap?`;
  
  await bot.sendMessage(chatId, message, {
    parse_mode: "Markdown",
    reply_markup: createConfirmationKeyboard()
  });
}

// Execute the swap
async function executeSwap(bot, chatId, userId) {
  const session = swapSessions[userId];
  if (!session || !session.fromToken || !session.toToken || !session.amount) {
    await bot.sendMessage(chatId, "❌ Swap session expired or incomplete. Please start again.");
    delete swapSessions[userId];
    return;
  }
  
  await bot.sendMessage(chatId, "Executing your swap... ⚡");
  
  try {
    // Call the actual swap function
    const signature = await swapTokens(
      userId, 
      session.fromToken.mint, 
      session.toToken.mint, 
      session.amount
    );
    
    // Show success message
    await bot.sendMessage(chatId, 
      `✅ *Swap completed!* 🎉\n\n` +
      `Transaction: [${signature.slice(0, 8)}...](https://solscan.io/tx/${signature})`, 
      {
        parse_mode: "Markdown",
        disable_web_page_preview: true,
        reply_markup: createPostSwapKeyboard()
      }
    );
    
    // Clean up the session
    delete swapSessions[userId];
    
  } catch (error) {
    console.error("Swap error:", error);
    await bot.sendMessage(chatId, 
      `❌ *Swap failed*: ${error.message || "Unknown error"}\n\nPlease try again.`, 
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "Try Again", callback_data: "swap" }],
            [{ text: "🔙 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  }
}

// Initialize the interactive swap flow
function swapHandle(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  
  // Initialize or reset the swap session
  swapSessions[userId] = {
    step: 'init',
    fromToken: null,
    toToken: null,
    amount: null,
    customTokenAddress: null
  };
  
  // Show popular pairs message
  bot.sendMessage(
    chatId,
    "Let's swap some tokens! 🚀 Here are some popular pairs to get started:\n\n" +
    "1. SOL → USDC\n" +
    "2. USDC → SOL\n",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Select From Token", callback_data: "select_from_token" },
            { text: "Select To Token", callback_data: "select_to_token" }
          ],
          [
            { text: "🔙 Back to Main Menu", callback_data: "back_to_main" }
          ]
        ]
      }
    }
  );
}

// Process swap flow callbacks
function handleSwapCallbacks(bot, callbackQuery) {
  const data = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();
  
  // Initialize session if it doesn't exist
  if (!swapSessions[userId] && !data.startsWith("back_to_main") && !data.startsWith("swap")) {
    swapSessions[userId] = {
      step: 'init',
      fromToken: null,
      toToken: null,
      amount: null,
      customTokenAddress: null
    };
  }
  
  const session = swapSessions[userId];
  
  // Process callback data
  if (data === "select_from_token") {
    // Show token selection for "from" token
    bot.sendMessage(
      chatId,
      "Select the token you want to swap from:",
      {
        reply_markup: {
          inline_keyboard: createTokenButtons()
        }
      }
    );
    session.step = 'select_from';
  } 
  else if (data === "select_to_token") {
    // Show token selection for "to" token
    bot.sendMessage(
      chatId,
      "Select the token you want to swap to:",
      {
        reply_markup: {
          inline_keyboard: createTokenButtons()
        }
      }
    );
    session.step = 'select_to';
  } 
  else if (data.startsWith("select_token_")) {
    // Handle token selection
    const tokenSymbol = data.replace("select_token_", "");
    const tokenDetails = getTokenDetails(tokenSymbol);
    
    if (!tokenDetails) {
      bot.sendMessage(chatId, "❌ Invalid token selection. Please try again.");
      return;
    }
    
    if (session.step === 'select_from') {
      session.fromToken = tokenDetails;
      
      // Check if they selected the same token for both
      if (session.toToken && session.fromToken.symbol === session.toToken.symbol) {
        bot.sendMessage(chatId, 
          "⚠️ Please select different tokens for from and to.", 
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Select From Token", callback_data: "select_from_token" },
                  { text: "Select To Token", callback_data: "select_to_token" }
                ]
              ]
            }
          }
        );
        return;
      }
      
      updateSwapSummary(bot, chatId, session);
    } 
    else if (session.step === 'select_to') {
      session.toToken = tokenDetails;
      
      // Check if they selected the same token for both
      if (session.fromToken && session.fromToken.symbol === session.toToken.symbol) {
        bot.sendMessage(chatId, 
          "⚠️ Please select different tokens for from and to.", 
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: "Select From Token", callback_data: "select_from_token" },
                  { text: "Select To Token", callback_data: "select_to_token" }
                ]
              ]
            }
          }
        );
        return;
      }
      
      updateSwapSummary(bot, chatId, session);
    }
  } 
  else if (data === "add_custom_token") {
    // Handle custom token addition
    const stepText = session.step === 'select_from' ? "'from'" : "'to'";
    bot.sendMessage(
      chatId,
      `Please send the token address of the ${stepText} token (e.g., EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v for USDC).`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "cancel_custom_token" }]
          ]
        }
      }
    );
    
    session.step = session.step === 'select_from' ? 'add_custom_from' : 'add_custom_to';
    
    // Set up a one-time message handler for the token address input
    const messageHandler = async (msg) => {
      if (msg.chat.id !== chatId || msg.from.id.toString() !== userId) return;
      
      // Remove the handler
      bot.removeListener('message', messageHandler);
      
      if (!msg.text || msg.text.startsWith("/")) {
        await bot.sendMessage(chatId, "❌ Operation canceled. Please try again.");
        return;
      }
      
      const tokenAddress = msg.text.trim();
      
      // In a real implementation, you'd validate this is a real token on Solana
      // and fetch its metadata (name, symbol, etc.)
      // For now, we'll just accept any input as valid
      
      // Create a custom token object
      const customToken = {
        symbol: "CUSTOM",
        name: "Custom Token",
        mint: tokenAddress,
        icon: "🪙"
      };
      
      if (session.step === 'add_custom_from') {
        session.fromToken = customToken;
        session.step = 'select_from';
      } else if (session.step === 'add_custom_to') {
        session.toToken = customToken;
        session.step = 'select_to';
      }
      
      await bot.sendMessage(
        chatId,
        `Token added! ${session.step === 'select_from' ? 'From' : 'To'}: ${customToken.icon} ${customToken.name} (${tokenAddress.slice(0, 6)}...${tokenAddress.slice(-4)})`
      );
      
      // Update the swap summary
      updateSwapSummary(bot, chatId, session);
    };
    
    // Register the handler
    bot.on('message', messageHandler);
  } 
  else if (data === "cancel_custom_token") {
    // Reset to previous step
    session.step = session.step === 'add_custom_from' ? 'select_from' : 'select_to';
    const actionText = session.step === 'select_from' ? "Select From Token" : "Select To Token";
    const callbackData = session.step === 'select_from' ? "select_from_token" : "select_to_token";
    
    bot.sendMessage(
      chatId,
      "Operation canceled.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: actionText, callback_data: callbackData }],
            [{ text: "🔙 Back to Main Menu", callback_data: "back_to_main" }]
          ]
        }
      }
    );
  } 
  else if (data === "change_from_token") {
    // Change from token
    bot.sendMessage(
      chatId,
      "Select a new 'from' token:",
      {
        reply_markup: {
          inline_keyboard: createTokenButtons()
        }
      }
    );
    session.step = 'select_from';
  } 
  else if (data === "change_to_token") {
    // Change to token
    bot.sendMessage(
      chatId,
      "Select a new 'to' token:",
      {
        reply_markup: {
          inline_keyboard: createTokenButtons()
        }
      }
    );
    session.step = 'select_to';
  } 
  else if (data === "enter_amount") {
    // Prompt for amount input
    if (!session.fromToken || !session.toToken) {
      bot.sendMessage(
        chatId,
        "⚠️ Please select both tokens before entering an amount."
      );
      return;
    }
    
    bot.sendMessage(
      chatId,
      `How much ${session.fromToken.symbol} would you like to swap to ${session.toToken.symbol}? (Enter a number, e.g., 10)`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "❌ Cancel", callback_data: "cancel_swap" }]
          ]
        }
      }
    );
    
    // Set up the message handler for amount input
    setupAmountInputHandler(bot, userId, chatId);
  } 
  else if (data === "confirm_swap") {
    // Execute the swap
    executeSwap(bot, chatId, userId);
  } 
  else if (data === "cancel_swap") {
    // Cancel the swap
    bot.sendMessage(
      chatId,
      "Swap canceled. What would you like to do next?",
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Swap Again", callback_data: "swap" },
              { text: "🔙 Back to Main Menu", callback_data: "back_to_main" }
            ]
          ]
        }
      }
    );
    
    // Clean up the session
    delete swapSessions[userId];
  }
}

module.exports = { swapHandler, swapHandle, handleSwapCallbacks };
