const { swapTokens } = require("../../solana/spiderswap/swap");
const TokenDetailsCache = require("../../solana/SolanaTokenCache");
const { getSwapQuote } = require("../../solana/spiderswap/quote");
const { TOKENS, gaslessSupportedTokens } = require("../../solana/KnownTokens");

const { safeDelete, sendTempMessage } = require("../helpers/help");

const tokenCache = new TokenDetailsCache();
const swapSessions = {};

async function cleanupAndSend(bot, chatId, userId, msg, opts = {}) {
  const s = swapSessions[userId];
  if (s?.messageId) await safeDelete(bot, chatId, s.messageId);
  const m = await bot.sendMessage(chatId, msg, opts);
  if (s) s.messageId = m.message_id;
  return m;
}

function createMenu(session) {
  const allSet = session.fromToken && session.toToken && session.amount;
  const isToSOL = session.toToken === gaslessSupportedTokens.SOL;

  // keyboard.push([
  //   // Always add gasless toggle button with same text
  //   {
  //     text: `${session.gasless && isToSOL ? "🟢" : "🔴"} Gasless`,
  //     callback_data: "swap_toggle_gasless",
  //   },
  // ]);

  // Build the keyboard
  const keyboard = [
    [
      // Always add gasless toggle button with same text
      {
        text: `${session.gasless && isToSOL ? "🟢" : "🔴"} Gasless`,
        callback_data: "swap_toggle_gasless",
      },
    ],
    [
      {
        text: `${session.fromToken ? "🔄" : "📤"} From`,
        callback_data: "swap_select_from",
      },
      {
        text: `${session.toToken ? "🔄" : "📥"} To`,
        callback_data: "swap_select_to",
      },
    ],
    [
      {
        text: `${session.amount ? "✏️" : "💰"} Amount`,
        callback_data: "swap_set_amount",
      },
    ],
  ];

  // Add reverse button
  if (session.fromToken && session.toToken) {
    keyboard.push([{ text: "🔃 Reverse", callback_data: "swap_reverse" }]);
  }

  // Add get quote button
  if (allSet) {
    keyboard.push([{ text: "📊 Get Quote", callback_data: "swap_get_quote" }]);
  }

  // Add navigation buttons
  keyboard.push([
    { text: "🏠 Main Menu", callback_data: "back_to_main" },
    { text: "❌ Cancel", callback_data: "swap_cancel" },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

function getProgress(session) {
  if (session.fromToken && session.toToken && session.amount)
    return "🎯 *Ready to get quote!*";
  if (session.fromToken && session.toToken) return "💰 *Set amount to swap*";
  if (session.fromToken || session.toToken)
    return "⚡ *Complete remaining steps*";
  return "🚀 *Start by selecting tokens*";
}

async function showMenu(
  bot,
  chatId,
  userId,
  editId = null,
  skipQuoteFetch = false
) {
  if (!swapSessions[userId])
    swapSessions[userId] = {
      fromToken: null,
      toToken: null,
      amount: null,
      messageId: null,
      chatId,
      gasless: false,
    };

  const s = swapSessions[userId];
  if (s.fromToken && s.toToken && s.amount && !skipQuoteFetch) {
    await cleanupAndSend(bot, chatId, userId, "⏳ Fetching quote...", {
      parse_mode: "Markdown",
    });
    return await fetchQuote(bot, chatId, userId);
  }

  const from = s.fromToken ? await getTokenInfo(s.fromToken) : null;
  const to = s.toToken ? await getTokenInfo(s.toToken) : null;
  const step1 = s.fromToken ? "✅" : "1️⃣";
  const step2 = s.toToken ? "✅" : "2️⃣";
  const step3 = s.amount ? "✅" : "3️⃣";

  const msg = `🔄 *Token Swap*\n\n╔════════════════╗\n║ ${step1} *FROM*  \n║   ${
    from ? `🔸 ${from.symbol}` : "❌ Select Token"
  }\n╠════════════════╣\n║ ${step2} *TO*\n║   ${
    to ? `🔹 ${to.symbol}` : "❌ Select Token"
  }\n╠════════════════╣\n║ ${step3} *AMOUNT*\n║   ${
    s.amount
      ? `💰 ${formatNumber(s.amount)} ${from?.symbol || ""}`
      : "❌ Enter amount"
  }\n╚════════════════╝\n\n${getProgress(s)} 
 `; // \n🕹️ Powered by SpiderSwap Protocol 🌐

  if (editId) {
    bot.editMessageText(msg, {
      chat_id: chatId,
      message_id: editId,
      reply_markup: createMenu(s),
      parse_mode: "Markdown",
    });
  } else {
    bot
      .sendMessage(chatId, msg, {
        reply_markup: createMenu(s),
        parse_mode: "Markdown",
      })
      .then((m) => {
        swapSessions[userId].messageId = m.message_id;
      });
  }
}

async function handleCallbacks(bot, cb) {
  try {
    await bot.answerCallbackQuery(cb.id).catch(() => {});
    const data = cb.data,
      msg = cb.message,
      chatId = msg.chat.id;
    const userId = cb.from.id.toString(),
      chatKey = chatId.toString();

    let s = swapSessions[userId] || swapSessions[chatKey];
    if (!s) {
      s = {
        fromToken: null,
        toToken: null,
        amount: null,
        messageId: null,
        chatId,
        gasless: false,
      };
      swapSessions[userId] = s;
      if (userId !== chatKey) swapSessions[chatKey] = s;
      return showMenu(bot, chatId, userId);
    }

    switch (data) {
      case "swap_select_from":
        showTokens(bot, chatId, userId, "from");
        break;
      case "swap_select_to":
        showTokens(bot, chatId, userId, "to");
        break;
      case "swap_set_amount":
        promptAmount(bot, chatId, userId);
        break;
      case "swap_get_quote":
        fetchQuote(bot, chatId, userId);
        break;
      case "swap_execute":
        execute(bot, cb);
        break;
      case "swap_cancel":
        cancel(bot, chatId, userId);
        break;
      case "swap_back":
        showMenu(bot, chatId, userId, s.messageId, true);
        break;
      case "swap_reverse":
        reverse(bot, chatId, userId);
        break;
      case "swap_toggle_gasless":
        // Only toggle if destination is SOL
        if (s.toToken === gaslessSupportedTokens.SOL) {
          // Toggle gasless mode
          s.gasless = !s.gasless;
          console.log(
            `Gasless mode ${
              s.gasless ? "enabled" : "disabled"
            } for user ${userId}`
          );
          return showMenu(bot, chatId, userId, msg.message_id);
        } else {
          // Show warning if destination is not SOL (auto-deletes after 5 seconds)
          await sendTempMessage(
            bot,
            cb.message.chat.id,
            "⚠️ Gasless swaps are only available when swapping to SOL"
          );
          return;
        }
      default:
        if (data.startsWith("swap_from_")) {
          s.fromToken = data.replace("swap_from_", "");
          checkQuote(bot, chatId, userId, s.messageId);
        } else if (data.startsWith("swap_to_")) {
          s.toToken = data.replace("swap_to_", "");
          checkQuote(bot, chatId, userId, s.messageId);
        } else if (data.startsWith("swap_custom_")) {
          // Handle custom token input
          const tokenType = data.replace("swap_custom_", "");
          promptCustomToken(bot, chatId, userId, tokenType);
        }
    }
  } catch (e) {
    console.error(`Callback error: ${e.message}`);
    try {
      bot.sendMessage(cb.message.chat.id, "⚠️ Error processing request");
    } catch {}
  }
}

function reverse(bot, chatId, userId) {
  const s = swapSessions[userId];
  if (s?.fromToken && s.toToken) {
    [s.fromToken, s.toToken] = [s.toToken, s.fromToken];
    s.amount = null;
    showMenu(bot, chatId, userId, s.messageId);
  }
}

function showTokens(bot, chatId, userId, type) {
  const prefix = `swap_${type}_`;
  bot.editMessageText(`🎯 Select ${type.toUpperCase()} token:`, {
    chat_id: chatId,
    message_id: swapSessions[userId].messageId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "SOL", callback_data: `${prefix}${TOKENS.SOL}` },
          { text: "USDC", callback_data: `${prefix}${TOKENS.USDC}` },
        ],
        [
          { text: "USDT", callback_data: `${prefix}${TOKENS.USDT}` },
          { text: "Custom", callback_data: `swap_custom_${type}` },
        ],
        [
          { text: "🔙 Back", callback_data: "swap_back" },
          { text: "❌ Cancel", callback_data: "swap_cancel" },
        ],
      ],
    },
    parse_mode: "Markdown",
  });
}

async function promptAmount(bot, chatId, userId) {
  const s = swapSessions[userId];

  // Check if from token is selected
  if (!s.fromToken) {
    // Show warning and guide user to select from token first
    await bot.editMessageText(
      `⚠️ *Select FROM token first*\n\nYou need to select a token to swap from before setting the amount.\n\n${getProgress(
        s
      )}`,
      {
        chat_id: chatId,
        message_id: s.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `📤 Select FROM Token`,
                callback_data: "swap_select_from",
              },
            ],
            [
              { text: "🔙 Back", callback_data: "swap_back" },
              { text: "❌ Cancel", callback_data: "swap_cancel" },
            ],
          ],
        },
        parse_mode: "Markdown",
      }
    );
    return;
  }

  // From token is selected, prompt for amount
  const sym = await getSymbol(s.fromToken);
  await cleanupAndSend(
    bot,
    chatId,
    userId,
    `💰 *Enter amount of ${sym} to swap*\n\n_Reply with a number_ (e.g. 10 or 0.5)`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 Back", callback_data: "swap_back" },
            { text: "❌ Cancel", callback_data: "swap_cancel" },
          ],
        ],
      },
      parse_mode: "Markdown",
    }
  );
  s.waitingForAmount = true;
}

async function fetchQuote(bot, chatId, userId) {
  const s = swapSessions[userId];
  if (!s.fromToken || !s.toToken || !s.amount)
    return showMenu(bot, chatId, userId);

  // Default slippage in basis points (100 = 1%)
  const slippageBps = 100;
  const isToSOL = s.toToken === gaslessSupportedTokens.SOL;

  try {
    await cleanupAndSend(bot, chatId, userId, "⏳ Fetching quote...", {
      parse_mode: "Markdown",
    });
    const quote = await getSwapQuote(
      s.fromToken,
      s.toToken,
      s.amount,
      slippageBps
    );
    if (!quote.success) throw new Error(quote.error || "Failed");

    const fromSym = await getSymbol(s.fromToken),
      toSym = await getSymbol(s.toToken);
    const impact = parseFloat(quote.priceImpact) || 0;
    // Calculate slippage percentage from basis points (100 basis points = 1%)
    const slippagePercent = (slippageBps / 100).toFixed(1);

    // Add gasless indicator to the message if applicable
    const gaslessInfo = isToSOL
      ? `\n⚡ **Gasless:** ${s.gasless ? "Enabled" : "Disabled"}`
      : "";

    const msg = `💱 *Quote*\n\n📤 **From:** ${formatNumber(
      s.amount
    )} ${fromSym}\n📥 **To:** ~${formatNumber(
      quote.toAmount
    )} ${toSym}\n🛡️ **Min:** ${formatNumber(
      quote.minimumReceived
    )} ${toSym}\n📊 **Impact:** ${impact.toFixed(
      2
    )}%\n⚡ **Slippage:** ${slippagePercent}%${gaslessInfo}\n\n_Expires in 30s_`;

    bot.editMessageText(msg, {
      chat_id: chatId,
      message_id: s.messageId,
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Confirm Swap", callback_data: "swap_execute" }],
          [
            { text: "🔄 From", callback_data: "swap_select_from" },
            { text: "🔄 To", callback_data: "swap_select_to" },
          ],
          [{ text: "✏️ Amount", callback_data: "swap_set_amount" }],
          [
            { text: "🔙 Back", callback_data: "swap_back" },
            { text: "❌ Cancel", callback_data: "swap_cancel" },
          ],
        ],
      },
      parse_mode: "Markdown",
    });
    s.quote = quote;
  } catch (e) {
    bot.editMessageText(`❌ *Error*\n${e.message}\nTry again or adjust.`, {
      chat_id: chatId,
      message_id: s.messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔄 Try Again", callback_data: "swap_get_quote" },
            { text: "🔙 Back", callback_data: "swap_back" },
          ],
          [{ text: "❌ Cancel", callback_data: "swap_cancel" }],
        ],
      },
      parse_mode: "Markdown",
    });
  }
}

async function execute(bot, cb) {
  const msg = cb.message,
    chatId = msg.chat.id,
    userId = cb.from.id.toString();
  if (!swapSessions[userId])
    swapSessions[userId] = {
      fromToken: null,
      toToken: null,
      amount: null,
      messageId: msg.message_id,
      chatId,
      gasless: false,
    };
  const s = swapSessions[userId];

  try {
    const isToSOL = s.toToken === gaslessSupportedTokens.SOL;
    const gaslessInfo =
      isToSOL && s.gasless ? "\n⚡ *Gasless mode enabled*" : "";

    await bot.editMessageText(
      `⚡ *Executing Swap*\nProcessing...${gaslessInfo}`,
      {
        chat_id: chatId,
        message_id: s.messageId,
        parse_mode: "Markdown",
      }
    );
    const tx = await swapTokens(
      userId,
      s.fromToken,
      s.toToken,
      s.amount,
      s.gasless
    );
    const fromSym = await getSymbol(s.fromToken),
      toSym = await getSymbol(s.toToken);
    await bot.editMessageText(
      `✅ *Success!*\nSwapped ${formatNumber(
        s.amount
      )} ${fromSym} → ${toSym}\n🔗 [View TX](https://solscan.io/tx/${tx})`,
      {
        chat_id: chatId,
        message_id: s.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 New Swap", callback_data: "swap_again" },
              { text: "🏠 Main Menu", callback_data: "back_to_main" },
            ],
          ],
        },
        parse_mode: "Markdown",
      }
    );
  } catch (e) {
    await bot.editMessageText(
      `❌ *Failed Swap*\n${e.message}\nFunds are safe.`,
      {
        chat_id: chatId,
        message_id: s.messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🔄 Try Again", callback_data: "swap_back" },
              { text: "🏠 Main Menu", callback_data: "back_to_main" },
            ],
          ],
        },
        parse_mode: "Markdown",
      }
    );
  } finally {
    delete swapSessions[userId];
    if (userId !== chatId.toString()) delete swapSessions[chatId.toString()];
  }
}

function cancel(bot, chatId, userId) {
  const s = swapSessions[userId];
  delete swapSessions[userId];
  if (userId !== chatId.toString()) delete swapSessions[chatId.toString()];
  bot.editMessageText("❌ *Cancelled*\nNo changes made.", {
    chat_id: chatId,
    message_id: s?.messageId,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "🔄 New Swap", callback_data: "swap_again" },
          { text: "🏠 Main Menu", callback_data: "back_to_main" },
        ],
      ],
    },
    parse_mode: "Markdown",
  });
}

async function getSymbol(tokenMint) {
  try {
    return (await tokenCache.getTokenDetails(tokenMint)).symbol || "Custom";
  } catch {
    return "Custom";
  }
}

async function getTokenInfo(tokenMint) {
  try {
    const d = await tokenCache.getTokenDetails(tokenMint);
    return { symbol: d.symbol || "Custom", name: d.name || "Custom Token" };
  } catch {
    return { symbol: "Custom", name: "Custom Token" };
  }
}

function formatNumber(num) {
  if (num == null) return "0";
  if (typeof num === "string") num = parseFloat(num) || 0;
  if (typeof num !== "number" || isNaN(num)) return "0";
  if (num < 0.001 && num > 0) return num.toExponential(4);
  if (num < 1) return num.toFixed(6);
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

async function promptCustomToken(bot, chatId, userId, tokenType) {
  const s = swapSessions[userId];
  s.waitingForCustomToken = tokenType; // 'from' or 'to'

  await bot.editMessageText(
    `💎 *Enter custom token address*\n\nPlease paste the Solana token mint address\n\n_Example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_`,
    {
      chat_id: chatId,
      message_id: s.messageId,
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🔙 Back", callback_data: "swap_back" },
            { text: "❌ Cancel", callback_data: "swap_cancel" },
          ],
        ],
      },
      parse_mode: "Markdown",
    }
  );
}

async function processMsg(bot, msg) {
  const chatId = msg.chat.id,
    fromId = msg.from?.id.toString(),
    chatKey = chatId.toString();
  let userId = fromId || chatKey,
    s = swapSessions[userId] || swapSessions[chatKey];
  if (!s) return false;

  if (s.waitingForCustomToken) {
    // Handle custom token input
    const tokenAddress = msg.text.trim();
    const tokenType = s.waitingForCustomToken; // 'from' or 'to'

    // Basic validation for Solana token address (should be 32-44 chars)
    if (tokenAddress.length >= 32 && tokenAddress.length <= 44) {
      if (tokenType === "from") {
        s.fromToken = tokenAddress;
      } else if (tokenType === "to") {
        s.toToken = tokenAddress;
      }
      s.waitingForCustomToken = null;
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch {}
      await checkQuote(bot, chatId, userId, s.messageId);
      return true;
    } else {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch {}
      await bot.editMessageText(
        `❌ *Invalid token address*\n\nPlease enter a valid Solana token mint address\n\n_Example: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v_`,
        {
          chat_id: chatId,
          message_id: s.messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔙 Back", callback_data: "swap_back" },
                { text: "❌ Cancel", callback_data: "swap_cancel" },
              ],
            ],
          },
          parse_mode: "Markdown",
        }
      );
      return true;
    }
  } else if (s.waitingForAmount) {
    const amount = parseFloat(msg.text);
    if (!isNaN(amount) && amount > 0) {
      s.amount = amount;
      s.waitingForAmount = false;
      try {
        // await bot.deleteMessage(chatId, msg.message_id);
      } catch {}
      await checkQuote(bot, chatId, userId);
      return true;
    } else {
      try {
        await bot.deleteMessage(chatId, msg.message_id);
      } catch {}
      await bot.editMessageText(
        `❌ *Invalid*\nEnter number > 0\n_Example: 10 or 0.5_`,
        {
          chat_id: chatId,
          message_id: s.messageId,
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔙 Back", callback_data: "swap_back" },
                { text: "❌ Cancel", callback_data: "swap_cancel" },
              ],
            ],
          },
          parse_mode: "Markdown",
        }
      );
      return true;
    }
  }
  return false;
}

async function checkQuote(bot, chatId, userId, editId = null) {
  const s = swapSessions[userId];
  if (s?.fromToken && s.toToken && s.amount)
    await fetchQuote(bot, chatId, userId);
  else showMenu(bot, chatId, userId, editId);
}

function initSwap(bot, msg) {
  const chatId = msg.chat.id,
    userId = msg.from?.id.toString() || chatId.toString();
  const s = {
    fromToken: null,
    toToken: null,
    amount: null,
    messageId: null,
    chatId,
    gasless: false,
  };
  swapSessions[userId] = s;
  if (userId !== chatId.toString()) swapSessions[chatId.toString()] = s;
  showMenu(bot, chatId, userId);
}

module.exports = {
  initSwapFlow: initSwap,
  handleSwapCallbacks: handleCallbacks,
  processMessageInput: processMsg,
};
