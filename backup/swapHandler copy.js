// bot/handlers/swapHandler.js
const { swapTokens } = require("../../solana/spiderswap/swap");
const { getSwapQuote } = require("../../solana/spiderswap/quote");
const { getWallet } = require("../../solana/wallet/storage");
const TokenDetailsCache = require("../../solana/SolanaTokenCache");

// Common token addresses and details
const TOKENS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};

const tokenCache = new TokenDetailsCache();

// Session storage for interactive swap flow
const swapSessions = {};

// Main entry point for swap flow when Swap button is clicked
function initSwapFlow(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from ? msg.from.id.toString() : msg.chat.id.toString();

  // Initialize or reset session
  swapSessions[userId] = {
    fromToken: null,
    toToken: null,
    amount: null,
    currentStep: "initial",
  };

  // Display popular pairs and options
  const popularPairsKeyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "USDC → SOL", callback_data: "swap_pair_usdc_sol" },
          { text: "USDT → SOL", callback_data: "swap_pair_usdt_sol" },
        ],
        [
          { text: "Select From Token", callback_data: "swap_select_from" },
          { text: "Select To Token", callback_data: "swap_select_to" },
        ],
        [
          { text: "Enter Amount", callback_data: "swap_enter_amount" },
          { text: "Back to Main Menu", callback_data: "back_to_main" },
        ],
      ],
    },
  };

  bot.sendMessage(
    chatId,
    "Let's swap some tokens! 🚀 Here are some popular pairs to get started:\n" +
      "1. USDC → SOL\n" +
      "2. USDT → SOL\n\n" +
      "Or select tokens and amount manually:\n",
    popularPairsKeyboard
  );
}

// Handle all swap-related callbacks
function handleSwapCallbacks(bot, callbackQuery) {
  const data = callbackQuery.data;
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();

  // Ensure session exists
  if (!swapSessions[userId]) {
    swapSessions[userId] = {
      fromToken: null,
      toToken: null,
      amount: null,
      currentStep: "initial",
    };
  }

  // Answer callback to remove loading state
  bot.answerCallbackQuery(callbackQuery.id);

  // Handle different callback types based on data prefix
  if (data === "swap_select_from" || data === "swap_select_to") {
    const tokenType = data === "swap_select_from" ? "from" : "to";
    showTokenSelection(bot, chatId, userId, tokenType);
  } else if (data === "swap_enter_amount") {
    promptForAmount(bot, chatId, userId);
  } else if (data === "swap_add_custom_from" || data === "swap_add_custom_to") {
    const tokenType = data === "swap_add_custom_from" ? "from" : "to";
    promptForCustomToken(bot, chatId, userId, tokenType);
  } else if (data.startsWith("swap_from_") || data.startsWith("swap_to_")) {
    const isFromToken = data.startsWith("swap_from_");
    const tokenKey = isFromToken ? "fromToken" : "toToken";
    const prefix = isFromToken ? "swap_from_" : "swap_to_";
    const tokenMint = data.replace(prefix, "");
    setToken(bot, chatId, userId, tokenKey, tokenMint);
  } else if (data === "swap_confirm") {
    confirmSwap(bot, chatId, userId);
  } else if (data === "swap_execute") {
    executeSwap(bot, callbackQuery);
  } else if (data === "swap_cancel") {
    cancelSwap(bot, chatId, userId);
  } else if (data === "swap_again") {
    initSwapFlow(bot, msg);
  } else if (data.startsWith("swap_pair_")) {
    // Handle predefined pairs
    const pairConfig = {
      swap_pair_sol_usdc: { from: TOKENS.SOL, to: TOKENS.USDC },
      swap_pair_usdc_sol: { from: TOKENS.USDC, to: TOKENS.SOL },
      swap_pair_usdt_sol: { from: TOKENS.USDT, to: TOKENS.SOL },
    };

    if (pairConfig[data]) {
      const { from, to } = pairConfig[data];
      swapSessions[userId].fromToken = from;
      swapSessions[userId].toToken = to;
      updateSwapMessage(bot, chatId, userId);
    }
  }
}

// Show token selection keyboard
function showTokenSelection(bot, chatId, userId, tokenType) {
  const isFromToken = tokenType === "from";
  const title = `Select the token you want to swap ${
    isFromToken ? "from" : "to"
  }:`;
  const callbackPrefix = isFromToken ? "swap_from_" : "swap_to_";

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "SOL", callback_data: `${callbackPrefix}${TOKENS.SOL}` },
          { text: "USDC", callback_data: `${callbackPrefix}${TOKENS.USDC}` },
        ],
        [
          { text: "USDT", callback_data: `${callbackPrefix}${TOKENS.USDT}` },
          {
            text: "Add Custom Token",
            callback_data: `swap_add_custom_${tokenType}`,
          },
        ],
        [{ text: "Cancel", callback_data: "swap_cancel" }],
      ],
    },
  };

  // Store current step
  swapSessions[userId].currentStep = isFromToken ? "select_from" : "select_to";

  bot.sendMessage(chatId, title, keyboard);
}

// Set token selection and update UI
async function setToken(bot, chatId, userId, tokenKey, tokenMint) {
  swapSessions[userId][tokenKey] = tokenMint;
  await updateSwapMessage(bot, chatId, userId);
}

// Helper function to get token symbol for display
async function getTokenSymbol(tokenMint, defaultText = "(not selected)") {
  // Return default text if tokenMint is null or undefined
  if (!tokenMint) {
    return defaultText;
  }
  
  try {
    const tokenMintDetails = await tokenCache.getTokenDetails(tokenMint);
    // console.log(`Token details for ${tokenMint}:`, tokenMintDetails);
    return tokenMintDetails.symbol || "Custom Token";
  } catch (error) {
    console.error(`Error getting token symbol for ${tokenMint}:`, error);
    return "Unknown Token";
  }
}

// Fetch and display a swap quote with one-click confirmation
async function fetchAndDisplayQuote(bot, chatId, userId, amount) {
  const session = swapSessions[userId];
  const fromSymbol = getTokenSymbol(session.fromToken);
  const toSymbol = getTokenSymbol(session.toToken);

  // Send loading message
  const loadingMsg = await bot.sendMessage(
    chatId,
    `⏳ Calculating swap rate for ${amount} ${fromSymbol} to ${toSymbol}...`
  );

  try {
    // Fetch quote with 1% slippage
    const quote = await getSwapQuote(
      session.fromToken,
      session.toToken,
      amount,
      100
    );
    session.quoteData = quote;

    if (quote.success) {
      await handleSuccessfulQuote(
        bot,
        chatId,
        loadingMsg.message_id,
        session,
        amount,
        fromSymbol,
        toSymbol
      );
    } else {
      await handleFailedQuote(
        bot,
        chatId,
        loadingMsg.message_id,
        quote,
        amount,
        fromSymbol
      );
    }
  } catch (error) {
    console.error("Error fetching quote:", error);
    await bot.editMessageText(
      `❌ Error getting swap rate: ${error.message}\n\nPlease try again.`,
      {
        chat_id: chatId,
        message_id: loadingMsg.message_id,
        reply_markup: createActionButtons("swap_enter_amount").reply_markup,
      }
    );
  }
}

// Handle successful quote response
async function handleSuccessfulQuote(
  bot,
  chatId,
  messageId,
  session,
  amount,
  fromSymbol,
  toSymbol
) {
  const quote = session.quoteData;
  const receiveAmount = quote.toAmount;
  const priceImpact = parseFloat(quote.priceImpact);
  const minimumReceived = quote.minimumReceived;

  let messageText =
    `💰 Swap Preview:\n` +
    `From: ${amount} ${fromSymbol}\n` +
    `To: ~${receiveAmount} ${toSymbol}\n` +
    `Min. received: ${minimumReceived} ${toSymbol}\n` +
    `Price impact: ${priceImpact.toFixed(2)}%\n` +
    `Slippage: 1%`;

  // Add warning if price impact is high
  if (priceImpact > 5) {
    messageText += `\n\n⚠️ Warning: High price impact of ${priceImpact.toFixed(
      2
    )}%!`;
  }

  session.currentStep = "confirm";

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Swap Now", callback_data: "swap_execute" }],
        [
          { text: "🔄 Change Amount", callback_data: "swap_enter_amount" },
          { text: "❌ Cancel", callback_data: "swap_cancel" },
        ],
      ],
    },
  };

  await bot.editMessageText(messageText, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard.reply_markup,
  });
}

// Handle failed quote response
async function handleFailedQuote(
  bot,
  chatId,
  messageId,
  quote,
  amount,
  fromSymbol
) {
  const messageText =
    `⚠️ Quote Error: ${quote.error || "Unknown error"}\n\n` +
    `Could not get a valid swap quote. Please try again later.\n` +
    `From: ${amount} ${fromSymbol}`;

  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Try Again", callback_data: "swap_enter_amount" }],
        [{ text: "Cancel", callback_data: "swap_cancel" }],
      ],
    },
  };

  await bot.editMessageText(messageText, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: keyboard.reply_markup,
  });
}

// Update the swap message with current selections
async function updateSwapMessage(bot, chatId, userId) {
  const session = swapSessions[userId];
  const fromSymbol = await getTokenSymbol(session.fromToken);
  const toSymbol = await getTokenSymbol(session.toToken);
  const bothTokensSelected = session.fromToken && session.toToken;

  // Prepare message based on current state
  const message = bothTokensSelected
    ? `🎉 You've selected both tokens!\n` +
      `From: ${fromSymbol}\n` +
      `To: ${toSymbol}\n` +
      `Amount: ${session.amount || "(not set)"}`
    : `Current Selection:\n` +
      `From: ${fromSymbol}\n` +
      `To: ${toSymbol}\n` +
      `Amount: ${session.amount || "(not set)"}`;

  // Base keyboard with token selection options
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Select From Token", callback_data: "swap_select_from" },
          { text: "Select To Token", callback_data: "swap_select_to" },
        ],
      ],
    },
  };

  // Add appropriate action button based on current state
  if (bothTokensSelected && session.amount) {
    // All selections complete - show confirm button
    keyboard.reply_markup.inline_keyboard.push([
      { text: "🔄 Show Quote & Confirm", callback_data: "swap_confirm" },
    ]);
  } else if (bothTokensSelected) {
    // Both tokens selected but no amount - show amount entry button
    keyboard.reply_markup.inline_keyboard.push([
      {
        text: "💰 Enter Amount to See Quote",
        callback_data: "swap_enter_amount",
      },
    ]);
  } else {
    // Still selecting tokens - show regular amount button
    keyboard.reply_markup.inline_keyboard.push([
      { text: "Enter Amount", callback_data: "swap_enter_amount" },
    ]);
  }

  // Always add navigation option
  keyboard.reply_markup.inline_keyboard.push([
    { text: "Back to Main Menu", callback_data: "back_to_main" },
  ]);

  bot.sendMessage(chatId, message, keyboard);
}

// Prompt user for custom token
function promptForCustomToken(bot, chatId, userId, tokenType) {
  bot.sendMessage(
    chatId,
    `Please send the token address of the '${tokenType}' token\n` +
      `(e.g., ${TOKENS.USDC} for USDC).`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Cancel", callback_data: "swap_cancel" }]],
      },
    }
  );

  // Set current step to track context for incoming messages
  swapSessions[userId].currentStep = `custom_token_${tokenType}`;
}

// Prompt user for amount
function promptForAmount(bot, chatId, userId) {
  const session = swapSessions[userId];

  // Require from token to be selected first
  if (!session.fromToken) {
    return bot.sendMessage(chatId, "Please select a 'from' token first", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Select From Token", callback_data: "swap_select_from" }],
        ],
      },
    });
  }

  const fromSymbol = getTokenSymbol(session.fromToken, "tokens");

  bot.sendMessage(
    chatId,
    `How much ${fromSymbol} would you like to swap?\n` +
      `(Enter a number, e.g., 10)`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "Cancel", callback_data: "swap_cancel" }]],
      },
    }
  );

  // Track context for incoming messages
  swapSessions[userId].currentStep = "enter_amount";
}

// Helper function to create buttons with optional try again button
function createActionButtons(tryAgainAction = null) {
  const buttons = [];
  if (tryAgainAction) {
    buttons.push([{ text: "Try Again", callback_data: tryAgainAction }]);
  }
  buttons.push([{ text: "Cancel", callback_data: "swap_cancel" }]);

  return {
    reply_markup: {
      inline_keyboard: buttons,
    },
  };
}

// Process custom token or amount from text message
async function processMessageInput(bot, msg) {
  const chatId = msg.chat.id;
  const userId = msg.from ? msg.from.id.toString() : msg.chat.id.toString();
  const text = msg.text.trim();

  if (!swapSessions[userId]) {
    return false;
  }

  const session = swapSessions[userId];

  // Check if user is in a custom token input step
  if (
    session.currentStep === "custom_token_from" ||
    session.currentStep === "custom_token_to"
  ) {
    return await processTokenInput(bot, chatId, userId, session, text);
  } else if (session.currentStep === "enter_amount") {
    return await processAmountInput(bot, chatId, userId, session, text);
  }

  return false;
}

// Process token address input
async function processTokenInput(bot, chatId, userId, session, text) {
  const isFromToken = session.currentStep === "custom_token_from";
  const tokenKey = isFromToken ? "fromToken" : "toToken";
  const tryAgainAction = isFromToken
    ? "swap_add_custom_from"
    : "swap_add_custom_to";

  // Validate token address (simplified validation)
  if (text.length >= 32 && text.length <= 44) {
    session[tokenKey] = text;
    session.currentStep = null;
    await updateSwapMessage(bot, chatId, userId);
  } else {
    bot.sendMessage(
      chatId,
      "Invalid token address. Please try again or cancel.",
      createActionButtons(tryAgainAction)
    );
  }
  return true;
}

// Process amount input
async function processAmountInput(bot, chatId, userId, session, text) {
  const amount = parseFloat(text);
  if (!isNaN(amount) && amount > 0) {
    session.amount = amount;
    session.currentStep = null;

    // If both tokens are selected, immediately fetch and show a quote
    if (session.fromToken && session.toToken) {
      await fetchAndDisplayQuote(bot, chatId, userId, amount);
    } else {
      // Otherwise just update the selection message
      await updateSwapMessage(bot, chatId, userId);
    }
  } else {
    bot.sendMessage(
      chatId,
      "Please enter a valid number (e.g., 10).",
      createActionButtons("swap_enter_amount")
    );
  }
  return true;
}

// Confirm and execute swap
async function confirmSwap(bot, chatId, userId) {
  const session = swapSessions[userId];

  // Validate all required inputs are present
  if (!session.fromToken || !session.toToken || !session.amount) {
    return bot.sendMessage(
      chatId,
      "Please complete all selections before confirming.",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "Back", callback_data: "swap_cancel" }]],
        },
      }
    );
  }

  // Validate tokens are different
  if (session.fromToken === session.toToken) {
    return bot.sendMessage(
      chatId,
      "Please select different tokens for swapping.",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Select From Token", callback_data: "swap_select_from" }],
            [{ text: "Select To Token", callback_data: "swap_select_to" }],
          ],
        },
      }
    );
  }

  console.log("sessssssss", session.fromToken)

  const fromSymbol = await getTokenSymbol(session.fromToken, "Custom Token");
  console.log("fromSymbol", fromSymbol)
  const toSymbol = await getTokenSymbol(session.toToken, "Custom Token");
  const loadingMsg = await bot.sendMessage(
    chatId,
    "⏳ Fetching quote from Spider Swap..."
  );

  try {
    // Get quote with 1% slippage
    const quote = await getSwapQuote(
      session.fromToken,
      session.toToken,
      session.amount,
      100
    );
    session.quoteData = quote;

    if (quote.success) {
      await displaySuccessfulQuote(
        bot,
        chatId,
        loadingMsg.message_id,
        session,
        fromSymbol,
        toSymbol
      );
    } else {
      await displayFailedQuote(
        bot,
        chatId,
        loadingMsg.message_id,
        quote,
        session,
        fromSymbol,
        toSymbol
      );
    }
  } catch (error) {
    console.error("Error fetching quote:", error);
    await handleQuoteError(
      bot,
      chatId,
      loadingMsg.message_id,
      error,
      session,
      fromSymbol,
      toSymbol
    );
  }

  // Update session step
  swapSessions[userId].currentStep = "confirm";
}

// Display successful quote
async function displaySuccessfulQuote(
  bot,
  chatId,
  messageId,
  session,
  fromSymbol,
  toSymbol
) {
  const quote = session.quoteData;
  const { amount } = session;
  const receiveAmount = quote.toAmount;
  const priceImpact = parseFloat(quote.priceImpact);
  const minimumReceived = quote.minimumReceived;

  const messageText =
    `Review your swap:\n` +
    `From: ${fromSymbol}\n` +
    `To: ${toSymbol}\n` +
    `Amount: ${amount} ${fromSymbol}\n` +
    `You'll receive: ~${receiveAmount} ${toSymbol}\n` +
    `Min. received: ${minimumReceived} ${toSymbol}\n` +
    `Price impact: ${priceImpact.toFixed(2)}%\n` +
    `Slippage: 1%\n` +
    `Gasless: Yes`;

  await bot.editMessageText(messageText, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Confirm Swap", callback_data: "swap_execute" }],
        [{ text: "❌ Cancel", callback_data: "swap_cancel" }],
      ],
    },
  });
}

// Display failed quote
async function displayFailedQuote(
  bot,
  chatId,
  messageId,
  quote,
  session,
  fromSymbol,
  toSymbol
) {
  const messageText =
    `⚠️ Could not fetch accurate quote: ${quote.error || "Unknown error"}\n\n` +
    `Could not proceed with the swap.\n` +
    `From: ${fromSymbol}\n` +
    `To: ${toSymbol}\n` +
    `Amount: ${session.amount} ${fromSymbol}\n` +
    `Please try again later.`;

  await bot.editMessageText(messageText, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Try Again", callback_data: "swap_enter_amount" }],
        [{ text: "❌ Cancel", callback_data: "swap_cancel" }],
      ],
    },
  });
}

// Handle quote error
async function handleQuoteError(
  bot,
  chatId,
  messageId,
  error,
  session,
  fromSymbol,
  toSymbol
) {
  // Set the session to error state
  session.quoteData = {
    success: false,
    error: error.message,
  };

  const messageText =
    `⚠️ Error fetching quote: ${error.message}\n\n` +
    `Unable to get swap information at this time.\n` +
    `From: ${fromSymbol}\n` +
    `To: ${toSymbol}\n` +
    `Amount: ${session.amount} ${fromSymbol}\n` +
    `Please try again later.`;

  await bot.editMessageText(messageText, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{ text: "Try Again", callback_data: "swap_enter_amount" }],
        [{ text: "❌ Cancel", callback_data: "swap_cancel" }],
      ],
    },
  });
}

// Execute the swap
async function executeSwap(bot, callbackQuery) {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();
  const session = swapSessions[userId];

  // Answer callback to remove loading state
  bot.answerCallbackQuery(callbackQuery.id);

  // Validate session
  if (!session || session.currentStep !== "confirm") {
    return bot.sendMessage(chatId, "Swap session expired. Please start again.");
  }

  const { fromToken, toToken, amount } = session;
  const executingMsg = await bot.sendMessage(
    chatId,
    "Executing your swap... ⚡"
  );

  try {
    // Execute the swap
    const signature = await swapTokens(userId, fromToken, toToken, amount);

    // Show success message with transaction link
    await bot.sendMessage(
      chatId,
      `Swap completed! 🎉\n` +
        `Transaction: https://solscan.io/tx/${signature}`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Swap Again", callback_data: "swap_again" },
              { text: "Back to Main Menu", callback_data: "back_to_main" },
            ],
          ],
        },
      }
    );
  } catch (error) {
    // Handle error
    await bot.sendMessage(
      chatId,
      `❌ Swap failed: ${error.message}\nPlease try again or contact support.`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "Try Again", callback_data: "swap_again" },
              { text: "Back to Main Menu", callback_data: "back_to_main" },
            ],
          ],
        },
      }
    );
  } finally {
    // Clean up session in all cases
    delete swapSessions[userId];
  }
}

// Cancel swap flow and return to main menu
function cancelSwap(bot, chatId, userId) {
  // Clean up session
  delete swapSessions[userId];

  // Show main menu options
  const keyboard = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 Swap", callback_data: "swap" },
          { text: "👛 View Wallet", callback_data: "wallet" },
        ],
      ],
    },
  };

  bot.sendMessage(chatId, "What's next, Captain?", keyboard);
}

// Export public API
module.exports = {
  initSwapFlow,
  handleSwapCallbacks,
  processMessageInput,
  executeSwap,
};
