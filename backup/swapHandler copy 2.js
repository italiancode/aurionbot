const { swapTokens } = require("../solana/spiderswap/swap");
const { getWallet } = require("../solana/wallet/storage");
const TokenDetailsCache = require("../solana/SolanaTokenCache");
const { getSwapQuote } = require("../solana/spiderswap/quote");

const tokenCache = new TokenDetailsCache();
const swapSessions = {};

// Enhanced token list with icons
const TOKENS = {
  SOL: {
    address: "So11111111111111111111111111111111111111112",
    symbol: "SOL",
    name: "Solana",
    icon: "☀️"
  },
  USDC: {
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    symbol: "USDC",
    name: "USD Coin",
    icon: "💵"
  },
  USDT: {
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    symbol: "USDT",
    name: "Tether",
    icon: "💚"
  }
};

// Main entry point with enhanced welcome message
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
    chatId: chatId,
    quote: null
  };
  
  swapSessions[sessionKey] = sessionData;
  if (sessionKey !== chatKey) {
    swapSessions[chatKey] = sessionData;
  }
  
  showWelcomeMessage(bot, chatId, sessionKey);
}

async function showWelcomeMessage(bot, chatId, userId) {
  const welcomeMessage = 
    `🚀 *Welcome to SpiderSwap*\n\n` +
    `⚡ *Lightning Fast Token Swaps*\n` +
    `🔒 *Secure & Decentralized*\n` +
    `💎 *Best Rates Guaranteed*\n\n` +
    `Ready to swap your tokens? Let's get started! 👇`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Start New Swap", callback_data: "swap_start" }
      ],
      [
        { text: "📊 View Portfolio", callback_data: "view_portfolio" },
        { text: "ℹ️ Help", callback_data: "swap_help" }
      ]
    ]
  };

  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: keyboard,
    parse_mode: "Markdown"
  }).then(msg => {
    swapSessions[userId].messageId = msg.message_id;
  });
}

async function showMainSwapMenu(bot, chatId, userId, editMessageId = null) {
  const session = swapSessions[userId];
  
  // Get token details for display
  const fromTokenInfo = session.fromToken ? await getTokenDisplayInfo(session.fromToken) : null;
  const toTokenInfo = session.toToken ? await getTokenDisplayInfo(session.toToken) : null;
  
  // Progress indicators
  const step1 = session.fromToken ? "✅" : "1️⃣";
  const step2 = session.toToken ? "✅" : "2️⃣";
  const step3 = session.amount ? "✅" : "3️⃣";
  
  const message = 
    `🔄 *Token Swap Configuration*\n\n` +
    `┌─────────────────────────────┐\n` +
    `│ ${step1} **FROM TOKEN**\n` +
    `│ ${fromTokenInfo ? `${fromTokenInfo.icon} ${fromTokenInfo.symbol} (${fromTokenInfo.name})` : "❌ Select token to swap from"}\n` +
    `├─────────────────────────────┤\n` +
    `│ ${step2} **TO TOKEN**\n` +
    `│ ${toTokenInfo ? `${toTokenInfo.icon} ${toTokenInfo.symbol} (${toTokenInfo.name})` : "❌ Select token to receive"}\n` +
    `├─────────────────────────────┤\n` +
    `│ ${step3} **AMOUNT**\n` +
    `│ ${session.amount ? `💰 ${formatNumber(session.amount)} ${fromTokenInfo?.symbol || ""}` : "❌ Enter swap amount"}\n` +
    `└─────────────────────────────┘\n\n` +
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
        [{ text: "🔄 Swap Tokens", callback_data: "swap_reverse" }]
      ] : []),
      ...(allSet ? [
        [{ text: "📊 Get Quote & Preview", callback_data: "swap_get_quote" }]
      ] : []),
      [
        { text: "🏠 Main Menu", callback_data: "swap_main" },
        { text: "❌ Cancel", callback_data: "swap_cancel" }
      ]
    ]
  };
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

async function handleSwapCallbacks(bot, callbackQuery) {
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
  
  if (!session && data !== "swap_start") {
    bot.answerCallbackQuery(callbackQuery.id, { 
      text: "⚠️ Session expired. Starting fresh!", 
      show_alert: false 
    });
    return initSwapFlow(bot, { chat: { id: chatId }, from: { id: fromId } });
  }

  bot.answerCallbackQuery(callbackQuery.id);

  switch (data) {
    case "swap_start":
      if (!session) {
        const sessionData = {
          fromToken: null,
          toToken: null,
          amount: null,
          messageId: null,
          chatId: chatId,
          quote: null
        };
        swapSessions[fromId] = sessionData;
        if (fromId !== chatIdStr) {
          swapSessions[chatIdStr] = sessionData;
        }
      }
      showMainSwapMenu(bot, chatId, fromId, msg.message_id);
      break;
    case "swap_main":
      showWelcomeMessage(bot, chatId, userId);
      break;
    case "swap_select_from":
      showTokenSelection(bot, chatId, userId, "from");
      break;
    case "swap_select_to":
      showTokenSelection(bot, chatId, userId, "to");
      break;
    case "swap_set_amount":
      promptForAmount(bot, chatId, userId);
      break;
    case "swap_reverse":
      reverseTokens(bot, chatId, userId);
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
    case "swap_help":
      showHelpMessage(bot, chatId, userId);
      break;
    default:
      if (data.startsWith("swap_from_")) {
        swapSessions[userId].fromToken = data.replace("swap_from_", "");
        showMainSwapMenu(bot, chatId, userId, swapSessions[userId].messageId);
      } else if (data.startsWith("swap_to_")) {
        swapSessions[userId].toToken = data.replace("swap_to_", "");
        showMainSwapMenu(bot, chatId, userId, swapSessions[userId].messageId);
      }
  }
}

function showTokenSelection(bot, chatId, userId, type) {
  const isFrom = type === "from";
  const prefix = isFrom ? "swap_from_" : "swap_to_";
  const emoji = isFrom ? "📤" : "📥";
  
  const message = 
    `${emoji} *Select ${type.toUpperCase()} Token*\n\n` +
    `Choose from popular tokens or enter a custom address:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: `${TOKENS.SOL.icon} ${TOKENS.SOL.symbol}`, callback_data: `${prefix}${TOKENS.SOL.address}` },
        { text: `${TOKENS.USDC.icon} ${TOKENS.USDC.symbol}`, callback_data: `${prefix}${TOKENS.USDC.address}` }
      ],
      [
        { text: `${TOKENS.USDT.icon} ${TOKENS.USDT.symbol}`, callback_data: `${prefix}${TOKENS.USDT.address}` }
      ],
      [
        { text: "🔍 Custom Token", callback_data: `swap_custom_${type}` }
      ],
      [
        { text: "↩️ Back", callback_data: "swap_back" },
        { text: "❌ Cancel", callback_data: "swap_cancel" }
      ]
    ]
  };

  bot.editMessageText(message, {
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

  const tokenInfo = await getTokenDisplayInfo(session.fromToken);
  
  const message = 
    `💰 *Enter Swap Amount*\n\n` +
    `${tokenInfo.icon} **${tokenInfo.symbol}** (${tokenInfo.name})\n\n` +
    `💡 *Examples:*\n` +
    `• \`0.5\` - Half token\n` +
    `• \`10\` - Ten tokens\n` +
    `• \`100.25\` - With decimals\n\n` +
    `Please enter the amount you want to swap:`;

  bot.editMessageText(message, {
    chat_id: chatId,
    message_id: session.messageId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "↩️ Back", callback_data: "swap_back" },
          { text: "❌ Cancel", callback_data: "swap_cancel" }
        ]
      ]
    },
    parse_mode: "Markdown"
  });
  
  session.waitingForAmount = true;
}

function reverseTokens(bot, chatId, userId) {
  const session = swapSessions[userId];
  if (session.fromToken && session.toToken) {
    const temp = session.fromToken;
    session.fromToken = session.toToken;
    session.toToken = temp;
    session.amount = null; // Reset amount since we switched tokens
    
    bot.answerCallbackQuery(callbackQuery.id, { 
      text: "🔄 Tokens swapped!", 
      show_alert: false 
    });
  }
  showMainSwapMenu(bot, chatId, userId, session.messageId);
}

async function fetchAndShowQuote(bot, chatId, userId) {
  const session = swapSessions[userId];
  const { fromToken, toToken, amount } = session;

  try {
    const loadingMsg = await bot.editMessageText(
      "⏳ *Fetching best quote...*\n\n" +
      "🔍 Scanning DEX pools\n" +
      "📊 Calculating rates\n" +
      "⚡ Finding optimal path",
      {
        chat_id: chatId,
        message_id: session.messageId,
        parse_mode: "Markdown"
      }
    );

    const quote = await getSwapQuote(fromToken, toToken, amount, 100);
    
    if (!quote.success) {
      throw new Error(quote.error || "Failed to get quote");
    }

    const fromTokenInfo = await getTokenDisplayInfo(fromToken);
    const toTokenInfo = await getTokenDisplayInfo(toToken);
    const priceImpact = parseFloat(quote.priceImpact).toFixed(2);
    const rate = (parseFloat(quote.toAmount) / parseFloat(amount)).toFixed(6);

    const message = 
      `📊 *Swap Quote Preview*\n\n` +
      `┌─ **SWAP DETAILS** ─────────┐\n` +
      `│ 📤 **From:** ${formatNumber(amount)} ${fromTokenInfo.symbol}\n` +
      `│ 📥 **To:** ~${formatNumber(quote.toAmount)} ${toTokenInfo.symbol}\n` +
      `│ 🛡️ **Min Receive:** ${formatNumber(quote.minimumReceived)} ${toTokenInfo.symbol}\n` +
      `├─ **RATE INFO** ────────────┤\n` +
      `│ 📈 **Rate:** 1 ${fromTokenInfo.symbol} = ${rate} ${toTokenInfo.symbol}\n` +
      `│ 📊 **Impact:** ${priceImpact}%\n` +
      `│ ⚡ **Slippage:** 1.0%\n` +
      `└────────────────────────────┘\n\n` +
      `${getPriceImpactWarning(priceImpact)}`;

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
          { text: "↩️ Back", callback_data: "swap_back" },
          { text: "❌ Cancel", callback_data: "swap_cancel" }
        ]
      ]
    };

    await bot.editMessageText(message, {
      chat_id: chatId,
      message_id: loadingMsg.message_id,
      reply_markup: keyboard,
      parse_mode: "Markdown"
    });

    session.quote = quote;
  } catch (error) {
    bot.editMessageText(
      `❌ *Quote Failed*\n\n` +
      `🚫 **Error:** ${error.message}\n\n` +
      `💡 **Try:**\n` +
      `• Different amount\n` +
      `• Different token pair\n` +
      `• Check network status`,
      {
        chat_id: chatId,
        message_id: session.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Retry", callback_data: "swap_get_quote" },
              { text: "↩️ Back", callback_data: "swap_back" }
            ]
          ]
        },
        parse_mode: "Markdown"
      }
    );
  }
}

function getPriceImpactWarning(priceImpact) {
  const impact = parseFloat(priceImpact);
  if (impact > 5) {
    return "⚠️ **HIGH PRICE IMPACT** - Consider smaller amount";
  } else if (impact > 2) {
    return "⚡ **Moderate impact** - Review before confirming";
  } else {
    return "✅ **Low impact** - Good rate!";
  }
}

async function executeSwap(bot, callbackQuery) {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id.toString();
  const session = swapSessions[userId];

  try {
    // Animated execution messages
    const steps = [
      "🔐 Preparing transaction...",
      "📝 Signing transaction...",
      "🚀 Broadcasting to network...",
      "⏳ Confirming swap..."
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await bot.editMessageText(
        `⚡ *Executing Swap*\n\n${steps[i]}\n\n` +
        `${"▓".repeat(i + 1)}${"░".repeat(3 - i)} ${Math.round((i + 1) * 25)}%`,
        {
          chat_id: chatId,
          message_id: session.messageId,
          parse_mode: "Markdown"
        }
      );
    }

    const tx = await swapTokens(
      userId,
      session.fromToken,
      session.toToken,
      session.amount
    );

    const fromTokenInfo = await getTokenDisplayInfo(session.fromToken);
    const toTokenInfo = await getTokenDisplayInfo(session.toToken);

    await bot.editMessageText(
      `🎉 *Swap Successful!*\n\n` +
      `✅ **Transaction Completed**\n\n` +
      `📤 **Swapped:** ${formatNumber(session.amount)} ${fromTokenInfo.symbol}\n` +
      `📥 **Received:** ~${formatNumber(session.quote.toAmount)} ${toTokenInfo.symbol}\n\n` +
      `🔗 **Transaction Hash:**\n\`${tx}\`\n\n` +
      `🔍 [View on Solscan](https://solscan.io/tx/${tx})`,
      {
        chat_id: chatId,
        message_id: session.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 New Swap", callback_data: "swap_start" },
              { text: "📊 Portfolio", callback_data: "view_portfolio" }
            ],
            [
              { text: "🏠 Main Menu", callback_data: "swap_main" }
            ]
          ]
        },
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    await bot.editMessageText(
      `❌ *Swap Failed*\n\n` +
      `🚫 **Error:** ${error.message}\n\n` +
      `💡 **Possible Solutions:**\n` +
      `• Check wallet balance\n` +
      `• Try smaller amount\n` +
      `• Wait for network congestion to clear\n` +
      `• Contact support if issue persists`,
      {
        chat_id: chatId,
        message_id: session.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Try Again", callback_data: "swap_back" },
              { text: "🏠 Main Menu", callback_data: "swap_main" }
            ]
          ]
        },
        parse_mode: "Markdown"
      }
    );
  } finally {
    // Clean up session
    setTimeout(() => {
      delete swapSessions[userId];
      const chatIdStr = chatId.toString();
      if (userId !== chatIdStr) {
        delete swapSessions[chatIdStr];
      }
    }, 5000); // Keep session for 5 seconds for user to see result
  }
}

function cancelSwap(bot, chatId, userId) {
  const session = swapSessions[userId];
  delete swapSessions[userId];
  const chatIdStr = chatId.toString();
  if (userId !== chatIdStr) {
    delete swapSessions[chatIdStr];
  }
  
  bot.editMessageText(
    `❌ *Swap Cancelled*\n\n` +
    `Your swap has been cancelled safely.\n` +
    `No transactions were executed.`,
    {
      chat_id: chatId,
      message_id: session?.messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 New Swap", callback_data: "swap_start" },
            { text: "🏠 Main Menu", callback_data: "swap_main" }
          ]
        ]
      },
      parse_mode: "Markdown"
    }
  );
}

function showHelpMessage(bot, chatId, userId) {
  const helpMessage = 
    `ℹ️ *SpiderSwap Help*\n\n` +
    `**How to Swap:**\n` +
    `1️⃣ Select FROM token (what you want to swap)\n` +
    `2️⃣ Select TO token (what you want to receive)\n` +
    `3️⃣ Enter the amount to swap\n` +
    `4️⃣ Review the quote and confirm\n\n` +
    `**Features:**\n` +
    `🔄 Reverse swap direction\n` +
    `📊 Real-time quotes\n` +
    `🛡️ Slippage protection\n` +
    `⚡ Fast execution\n\n` +
    `**Need Help?**\n` +
    `Contact our support team!`;

  bot.editMessageText(helpMessage, {
    chat_id: chatId,
    message_id: swapSessions[userId]?.messageId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 Start Swap", callback_data: "swap_start" },
          { text: "🏠 Main Menu", callback_data: "swap_main" }
        ]
      ]
    },
    parse_mode: "Markdown"
  });
}

// Helper functions
async function getTokenDisplayInfo(tokenAddress) {
  // Check if it's a predefined token first
  for (const [key, token] of Object.entries(TOKENS)) {
    if (token.address === tokenAddress) {
      return token;
    }
  }
  
  // Try to get from cache
  try {
    const details = await tokenCache.getTokenDetails(tokenAddress);
    return {
      symbol: details.symbol || "UNKNOWN",
      name: details.name || "Custom Token",
      icon: "🪙",
      address: tokenAddress
    };
  } catch {
    return {
      symbol: "CUSTOM",
      name: "Custom Token",
      icon: "🪙",
      address: tokenAddress
    };
  }
}

async function getTokenSymbol(tokenMint) {
  const info = await getTokenDisplayInfo(tokenMint);
  return info.symbol;
}

function formatNumber(num) {
  const n = parseFloat(num);
  if (n < 0.01) return n.toFixed(6);
  if (n < 1) return n.toFixed(4);
  if (n < 1000) return n.toFixed(2);
  if (n < 1000000) return (n / 1000).toFixed(1) + "K";
  return (n / 1000000).toFixed(1) + "M";
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
      
      // Delete the user's message for cleaner UI
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch (e) {
        // Ignore deletion errors
      }
      
      showMainSwapMenu(bot, chatId, userId, session.messageId);
      return true;
    } else {
      const errorMsg = await bot.sendMessage(chatId, 
        `❌ *Invalid Amount*\n\n` +
        `Please enter a valid number greater than 0.\n\n` +
        `**Examples:** \`0.5\`, \`10\`, \`100.25\``, {
        parse_mode: "Markdown"
      });
      
      // Auto-delete error message after 3 seconds
      setTimeout(() => {
        bot.deleteMessage(chatId, errorMsg.message_id).catch(() => {});
        bot.deleteMessage(chatId, msg.message_id).catch(() => {});
      }, 3000);
      
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