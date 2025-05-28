const { swapTokens } = require("../solana/spiderswap/swap");
const { getWallet } = require("../solana/wallet/storage");
const TokenDetailsCache = require("../solana/SolanaTokenCache");
const { getSwapQuote } = require("../solana/spiderswap/quote");

const tokenCache = new TokenDetailsCache();
const swapSessions = {};

// Common tokens
const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

// Main entry point
function initSwapFlow(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id.toString() || msg.chat.id.toString();

  const sessionKey = userId;
  const chatKey = msg.chat.id.toString();

  const sessionData = {
    fromToken: null,
    toToken: null,
    amount: null,
    messageId: null,
    chatId: chatId
  };

  swapSessions[sessionKey] = sessionData;
  if (sessionKey !== chatKey) {
    swapSessions[chatKey] = sessionData;
  }

  showMainSwapMenu(bot, chatId, sessionKey);
}

// Helper function to safely delete a message
async function safeDeleteMessage(bot, chatId, messageId) {
  if (!messageId) return;

  try {
    await bot.deleteMessage(chatId, messageId);
  } catch (error) {
    // Silently handle cases where message can't be deleted
    // (already deleted, too old, permissions, etc.)
    console.log(`Could not delete message ${messageId}: ${error.message}`);
  }
}

// Helper function to clean up old messages before showing new content
async function cleanupAndSendMessage(bot, chatId, userId, message, options = {}) {
  const session = swapSessions[userId];

  // Delete the previous swap configuration message if it exists
  if (session && session.messageId) {
    await safeDeleteMessage(bot, chatId, session.messageId);
    session.messageId = null;
  }

  // Send the new message
  const newMsg = await bot.sendMessage(chatId, message, options);

  // Update session with new message ID
  if (session) {
    session.messageId = newMsg.message_id;
  }

  return newMsg;
}

// *** Will moved to a separate file later

function createMainMenuKeyboard(session) {
  const allSet = session.fromToken && session.toToken && session.amount;

  return {
    inline_keyboard: [
      [
        { text: `${session.fromToken ? "🔄" : "📤"} From Token`, callback_data: "swap_select_from" },
        { text: `${session.toToken ? "🔄" : "📥"} To Token`, callback_data: "swap_select_to" }
      ],
      [
        { text: `${session.amount ? "✏️" : "💰"} Set Amount`, callback_data: "swap_set_amount" }
      ],
      ...(session.fromToken && session.toToken ? [
        [{ text: "🔃 Reverse Tokens", callback_data: "swap_reverse" }]
      ] : []),
      ...(allSet ? [
        [{ text: "📊 Get Quote & Preview", callback_data: "swap_get_quote" }]
      ] : []),
      [
        { text: "🏠 Main Menu", callback_data: "back_to_main" },
        { text: "❌ Cancel", callback_data: "swap_cancel" }
      ]
    ]
  };
}

// Check if all swap requirements are met and automatically fetch a quote
async function checkAutoGetQuote(bot, chatId, userId, editMessageId = null) {
  const session = swapSessions[userId];

  if (session && session.fromToken && session.toToken && session.amount) {
    // All requirements met, clean up old message and fetch quote
    await fetchAndShowQuote(bot, chatId, userId);
  } else {
    // Not all requirements met, show regular menu
    showMainSwapMenu(bot, chatId, userId, editMessageId);
  }
}

function getProgressStatus(session) {
  if (session.fromToken && session.toToken && session.amount) {
    return "🎯 *Ready to get quote!* Tap 'Get Quote & Preview' to continue.";
  } else if (session.fromToken && session.toToken) {
    return "💰 *Almost there!* Please set the amount to swap.";
  } else if (session.fromToken || session.toToken) {
    return "⚡ *Good start!* Please complete the remaining steps.";
  } else {
    return "🚀 *Let's begin!* Start by selecting your tokens.";
  }
}

// Will moved to a separate file later *** //

async function showMainSwapMenu(bot, chatId, userId, editMessageId = null) {
  // Ensure session exists
  if (!swapSessions[userId]) {
    swapSessions[userId] = {
      fromToken: null,
      toToken: null,
      amount: null,
      messageId: null,
      chatId: chatId
    };
  }

  const session = swapSessions[userId];

  // Check if all requirements are met for auto-fetch
  const allRequirementsMet = session.fromToken && session.toToken && session.amount;

  // If all requirements are met, automatically fetch quote instead of showing menu
  if (allRequirementsMet) {
    // Clean up old message and show loading state
    await cleanupAndSendMessage(bot, chatId, userId, "⏳ All set! Fetching quote automatically...", {
      parse_mode: "Markdown"
    });

    // Auto-fetch quote
    return await fetchAndShowQuote(bot, chatId, userId);
  }

  // Get token details for display
  const fromTokenInfo = session.fromToken ? await getTokenDisplayInfo(session.fromToken) : null;
  const toTokenInfo = session.toToken ? await getTokenDisplayInfo(session.toToken) : null;

  // Progress indicators
  const step1 = session.fromToken ? "✅" : "1️⃣";
  const step2 = session.toToken ? "✅" : "2️⃣";
  const step3 = session.amount ? "✅" : "3️⃣";

  const message =
    `🔄 *Token Swap Configuration*\n\n` +
    `┌────────────────────┐\n` +
    `│ ${step1} **FROM TOKEN**\n` +
    `│ ${fromTokenInfo ? `${fromTokenInfo.symbol} (${fromTokenInfo.name})` : "❌ Select token to swap from"}\n` +
    `├────────────────────┤\n` +
    `│ ${step2} **TO TOKEN**\n` +
    `│ ${toTokenInfo ? `${toTokenInfo.symbol} (${toTokenInfo.name})` : "❌ Select token to receive"}\n` +
    `├────────────────────┤\n` +
    `│ ${step3} **AMOUNT**\n` +
    `│ ${session.amount ? `💰 ${formatNumber(session.amount)} ${fromTokenInfo?.symbol || ""}` : "❌ Enter swap amount"}\n` +
    `└────────────────────┘\n\n` +
    `${getProgressStatus(session)}`;

  const keyboard = createMainMenuKeyboard(session);

  if (editMessageId) {
    bot.editMessageText(message, {
      chat_id: chatId,
      message_id: editMessageId,
      reply_markup: keyboard,
      parse_mode: "Markdown"
    });
  } else {
    bot.sendMessage(chatId, message, {
      reply_markup: keyboard,
      parse_mode: "Markdown"
    }).then(msg => {
      swapSessions[userId].messageId = msg.message_id;
    });
  }
}

async function handleSwapCallbacks(bot, callbackQuery) {
  try {
    // Answer the callback query to prevent "query is too old" errors
    await bot.answerCallbackQuery(callbackQuery.id).catch(err => {
      // Silently catch expired queries
      if (!err.message.includes('query is too old') && !err.message.includes('query ID is invalid')) {
        console.error(`Error answering callback query: ${err.message}`);
      }
    });

    const data = callbackQuery.data;
    const msg = callbackQuery.message;
    const chatId = msg.chat.id;
    const fromId = callbackQuery.from.id.toString();
    const chatIdStr = chatId.toString();

    let userId = fromId;
    let session = swapSessions[fromId];

    if (!session && swapSessions[chatIdStr]) {
      userId = chatIdStr;
      session = swapSessions[chatIdStr];
    }

    if (!session) {
      bot.answerCallbackQuery(callbackQuery.id, { text: "Session expired. Starting a new swap for you.", show_alert: false });

      const sessionData = {
        fromToken: null,
        toToken: null,
        amount: null,
        messageId: null,
        chatId: chatId
      };

      swapSessions[fromId] = sessionData;
      if (fromId !== chatIdStr) {
        swapSessions[chatIdStr] = sessionData;
      }

      return showMainSwapMenu(bot, chatId, fromId);
    }

    bot.answerCallbackQuery(callbackQuery.id);

    switch (data) {
      case "swap_select_from":
        showTokenSelection(bot, chatId, userId, "from");
        break;
      case "swap_select_to":
        showTokenSelection(bot, chatId, userId, "to");
        break;
      case "swap_set_amount":
        promptForAmount(bot, chatId, userId);
        break;
      case "swap_get_quote":
        fetchAndShowQuote(bot, chatId, userId);
        break;
      case "swap_execute":
        executeSwap(bot, callbackQuery);
        break;
      case "swap_cancel":
        cancelSwap(bot, chatId, userId);
        break;
      case "swap_back":
        showMainSwapMenu(bot, chatId, userId, swapSessions[userId].messageId);
        break;
      case "swap_reverse":
        reverseTokens(bot, chatId, userId);
        break;
      default:
        if (data.startsWith("swap_from_")) {
          swapSessions[userId].fromToken = data.replace("swap_from_", "");
          checkAutoGetQuote(bot, chatId, userId, swapSessions[userId].messageId);
        } else if (data.startsWith("swap_to_")) {
          swapSessions[userId].toToken = data.replace("swap_to_", "");
          checkAutoGetQuote(bot, chatId, userId, swapSessions[userId].messageId);
        }
    }
  } catch (error) {
    console.error(`Error in handleSwapCallbacks: ${error.message}`);
    // Try to inform the user if possible
    try {
      const chatId = callbackQuery.message.chat.id;
      bot.sendMessage(chatId, "Sorry, an error occurred processing your request. Please try again.");
    } catch (e) {
      // Silently fail if we can't even send an error message
    }
  }
}

function reverseTokens(bot, chatId, userId) {
  const session = swapSessions[userId];
  if (session && session.fromToken && session.toToken) {
    // Swap the tokens
    const temp = session.fromToken;
    session.fromToken = session.toToken;
    session.toToken = temp;

    // Clear amount as it may no longer make sense
    session.amount = null;

    // Show updated menu
    showMainSwapMenu(bot, chatId, userId, session.messageId);
  }
}

function showTokenSelection(bot, chatId, userId, type) {
  const isFrom = type === "from";
  const prefix = isFrom ? "swap_from_" : "swap_to_";

  const keyboard = {
    inline_keyboard: [
      [
        { text: "SOL", callback_data: `${prefix}${TOKENS.SOL}` },
        { text: "USDC", callback_data: `${prefix}${TOKENS.USDC}` }
      ],
      [
        { text: "USDT", callback_data: `${prefix}${TOKENS.USDT}` },
        { text: "Custom", callback_data: `swap_custom_${type}` }
      ],
      [
        { text: "🔙 Back", callback_data: "swap_back" },
        { text: "❌ Cancel", callback_data: "swap_cancel" }
      ]
    ]
  };

  bot.editMessageText(`🎯 Select ${type.toUpperCase()} token:\n\nChoose from popular tokens or select Custom for other tokens.`, {
    chat_id: chatId,
    message_id: swapSessions[userId].messageId,
    reply_markup: keyboard,
    parse_mode: "Markdown"
  });
}

async function promptForAmount(bot, chatId, userId) {
  const session = swapSessions[userId];

  if (!session.fromToken) {
    return bot.answerCallbackQuery(callbackQuery.id, {
      text: "⚠️ Please select FROM token first",
      show_alert: true
    });
  }

  const fromSymbol = await getTokenSymbol(session.fromToken);

  // Clean up old message and send new prompt
  await cleanupAndSendMessage(bot, chatId, userId,
    `💰 *Enter Amount*\n\nHow much ${fromSymbol} would you like to swap?\n\n_Example: 10 or 0.5_`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 Back", callback_data: "swap_back" },
            { text: "❌ Cancel", callback_data: "swap_cancel" }
          ]
        ]
      },
      parse_mode: "Markdown"
    }
  );

  session.waitingForAmount = true;
}

async function fetchAndShowQuote(bot, chatId, userId) {
  const session = swapSessions[userId];
  const { fromToken, toToken, amount } = session;

  if (!fromToken || !toToken || !amount) {
    return showMainSwapMenu(bot, chatId, userId);
  }

  try {
    // Clean up the configuration message and show loading
    await cleanupAndSendMessage(bot, chatId, userId, "⏳ Fetching best quote...", {
      parse_mode: "Markdown"
    });

    const quote = await getSwapQuote(fromToken, toToken, amount, 100);

    if (!quote.success) {
      throw new Error(quote.error || "Failed to get quote");
    }

    const fromSymbol = await getTokenSymbol(fromToken);
    const toSymbol = await getTokenSymbol(toToken);
    const minReceived = quote.minimumReceived;
    
    // Safely parse price impact and handle potential non-numeric values
    let priceImpactValue = 0;
    try {
      priceImpactValue = parseFloat(quote.priceImpact);
      if (isNaN(priceImpactValue)) priceImpactValue = 0;
    } catch (e) {
      console.error("Error parsing price impact:", e);
      priceImpactValue = 0;
    }
    const priceImpact = priceImpactValue.toFixed(2);

    const message = `💱 *Swap Quote*\n\n` +
      `📤 **From:** ${formatNumber(amount)} ${fromSymbol}\n` +
      `📥 **To:** ~${formatNumber(quote.toAmount)} ${toSymbol}\n` +
      `🛡️ **Min Received:** ${formatNumber(minReceived)} ${toSymbol}\n` +
      `📊 **Price Impact:** ${priceImpact}%\n` +
      `⚡ **Slippage:** 1.0%\n\n` +
      `_Quote expires in 30 seconds_`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: "✅ Confirm Swap", callback_data: "swap_execute" }
        ],
        [
          { text: "🔄 Change From", callback_data: "swap_select_from" },
          { text: "🔄 Change To", callback_data: "swap_select_to" }
        ],
        [
          { text: "✏️ Change Amount", callback_data: "swap_set_amount" }
        ],
        [
          { text: "🔙 Back to Config", callback_data: "swap_back" },
          { text: "❌ Cancel", callback_data: "swap_cancel" }
        ]
      ]
    };

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: session.messageId,
      reply_markup: keyboard,
      parse_mode: "Markdown"
    });

    session.quote = quote;
  } catch (error) {
    await bot.editMessageText(`❌ *Quote Error*\n\n${error.message}\n\nPlease try again or adjust your parameters.`, {
      chat_id: chatId,
      message_id: session.messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Try Again", callback_data: "swap_get_quote" },
            { text: "🔙 Back", callback_data: "swap_back" }
          ],
          [
            { text: "❌ Cancel", callback_data: "swap_cancel" }
          ]
        ]
      },
      parse_mode: "Markdown"
    });
  }
}

async function executeSwap(bot, callbackQuery) {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();

  // Check if session exists, recreate if needed
  if (!swapSessions[userId]) {
    swapSessions[userId] = {
      fromToken: null,
      toToken: null,
      amount: null,
      messageId: msg.message_id,
      chatId: chatId
    };
  }
  const session = swapSessions[userId];

  try {
    await bot.editMessageText("⚡ *Executing Swap*\n\nProcessing your transaction...\n\n_This may take a few moments_", {
      chat_id: chatId,
      message_id: session.messageId,
      parse_mode: "Markdown"
    });

    const tx = await swapTokens(
      userId,
      session.fromToken,
      session.toToken,
      session.amount
    );

    const fromSymbol = await getTokenSymbol(session.fromToken);
    const toSymbol = await getTokenSymbol(session.toToken);

    await bot.editMessageText(
      `✅ *Swap Successful!*\n\n` +
      `Swapped ${formatNumber(session.amount)} ${fromSymbol} → ${toSymbol}\n\n` +
      `🔗 [View Transaction](https://solscan.io/tx/${tx})\n\n` +
      `_Transaction completed successfully_`,
      {
        chat_id: chatId,
        message_id: session.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 New Swap", callback_data: "swap_again" },
              { text: "🏠 Main Menu", callback_data: "back_to_main" }
            ]
          ]
        },
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    await bot.editMessageText(
      `❌ *Swap Failed*\n\n${error.message}\n\nYour funds are safe. Please try again.`,
      {
        chat_id: chatId,
        message_id: session.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Try Again", callback_data: "swap_back" },
              { text: "🏠 Main Menu", callback_data: "back_to_main" }
            ]
          ]
        },
        parse_mode: "Markdown"
      }
    );
  } finally {
    delete swapSessions[userId];
    // Clean up any duplicate session
    const chatIdStr = chatId.toString();
    if (userId !== chatIdStr) {
      delete swapSessions[chatIdStr];
    }
  }
}

function cancelSwap(bot, chatId, userId) {
  const session = swapSessions[userId];
  delete swapSessions[userId];
  const chatIdStr = chatId.toString();
  if (userId !== chatIdStr) {
    delete swapSessions[chatIdStr];
  }

  bot.editMessageText("❌ *Swap Cancelled*\n\nNo changes were made to your wallet.", {
    chat_id: chatId,
    message_id: session?.messageId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 New Swap", callback_data: "swap_again" },
          { text: "🏠 Main Menu", callback_data: "back_to_main" }
        ]
      ]
    },
    parse_mode: "Markdown"
  });
}

async function getTokenSymbol(tokenMint) {
  if (!tokenMint) return "Unknown";
  try {
    const details = await tokenCache.getTokenDetails(tokenMint);
    return details.symbol || "Custom";
  } catch {
    return "Custom";
  }
}

async function getTokenDisplayInfo(tokenMint) {
  if (!tokenMint) return null;
  try {
    const details = await tokenCache.getTokenDetails(tokenMint);
    return {
      symbol: details.symbol || "Custom",
      name: details.name || "Custom Token"
    };
  } catch {
    return {
      symbol: "Custom",
      name: "Custom Token"
    };
  }
}

function formatNumber(num) {
  // Handle null, undefined or non-numeric values
  if (num === null || num === undefined) return "";
  
  // Convert to number if it's a string
  if (typeof num === 'string') {
    try {
      num = parseFloat(num);
      if (isNaN(num)) return "0";
    } catch (e) {
      console.error("Error parsing number:", e);
      return "0";
    }
  }
  
  // Handle non-number types
  if (typeof num !== 'number' || isNaN(num)) {
    return "0";
  }

  try {
    // For small numbers (less than 0.001), use scientific notation
    if (num < 0.001 && num > 0) {
      return num.toExponential(4);
    }

    // For medium-small numbers, use fixed precision
    if (num < 1) {
      return num.toFixed(6);
    }

    // For larger numbers, use locale string with up to 2 decimal places
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  } catch (e) {
    console.error("Error formatting number:", e, num);
    return String(num); // Fallback to string conversion
  }
}

async function processMessageInput(bot, msg) {
  const chatId = msg.chat.id;
  const fromId = msg.from?.id.toString();
  const chatIdStr = chatId.toString();

  let userId = fromId || chatIdStr;
  let session = fromId ? swapSessions[fromId] : null;

  if (!session && swapSessions[chatIdStr]) {
    userId = chatIdStr;
    session = swapSessions[chatIdStr];
  }

  if (!session) return false;

  if (session.waitingForAmount) {
    const amount = parseFloat(msg.text);
    if (!isNaN(amount) && amount > 0) {
      session.amount = amount;
      session.waitingForAmount = false;

      // Delete the user's input message for cleaner experience
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore if can't delete
      }

      // Update the menu to show the entered amount and potentially auto-fetch quote
      await checkAutoGetQuote(bot, chatId, userId);
      return true;
    } else {
      // Delete the invalid input message
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore if can't delete
      }

      await bot.editMessageText(
        `❌ *Invalid Amount*\n\nPlease enter a valid number greater than 0.\n\n_Example: 10 or 0.5_`,
        {
          chat_id: chatId,
          message_id: session.messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔙 Back", callback_data: "swap_back" },
                { text: "❌ Cancel", callback_data: "swap_cancel" }
              ]
            ]
          },
          parse_mode: "Markdown"
        }
      );
      return true;
    }
  }

  return false;
}

module.exports = {
  initSwapFlow,
  handleSwapCallbacks,
  processMessageInput
};