// bot/utils/sendMessage.js

/**
 * Enhanced message sending utility with better error handling and formatting
 */

/**
 * Send a message with enhanced error handling and retry logic
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Message text
 * @param {Object} options - Additional options (parse_mode, reply_markup, etc.)
 * @param {number} retries - Number of retries on failure
 * @returns {Promise<Object>} - Message object or null on failure
 */
async function sendMessage(bot, chatId, message, options = {}, retries = 2) {
  try {
    // Ensure message is not empty
    if (!message || message.trim().length === 0) {
      console.warn('Attempted to send empty message');
      return null;
    }

    // Truncate message if too long (Telegram limit is 4096 characters)
    let finalMessage = message;
    if (message.length > 4000) {
      finalMessage = message.substring(0, 3997) + '...';
      console.warn(`Message truncated from ${message.length} to ${finalMessage.length} characters`);
    }

    const result = await bot.sendMessage(chatId, finalMessage, options);
    return result;
  } catch (error) {
    console.error('Error sending message:', {
      chatId,
      error: error.message,
      retries
    });

    // Retry logic for network errors
    if (retries > 0 && (error.code === 'ETELEGRAM' || error.code === 'ECONNRESET')) {
      console.log(`Retrying message send... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      return sendMessage(bot, chatId, message, options, retries - 1);
    }

    // Handle specific Telegram errors
    if (error.response && error.response.body) {
      const errorBody = error.response.body;
      if (errorBody.error_code === 429) {
        console.warn('Rate limited by Telegram API');
      } else if (errorBody.error_code === 403) {
        console.warn('Bot was blocked by user or chat not found');
      }
    }

    return null;
  }
}

/**
 * Send a formatted message with loading animation
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Message text
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Message object
 */
async function sendLoadingMessage(bot, chatId, message = "⏳ Processing...", options = {}) {
  return sendMessage(bot, chatId, message, options);
}

/**
 * Edit a message with enhanced error handling
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {number} messageId - Message ID to edit
 * @param {string} newText - New message text
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Edited message object or null on failure
 */
async function editMessage(bot, chatId, messageId, newText, options = {}) {
  try {
    if (!newText || newText.trim().length === 0) {
      console.warn('Attempted to edit with empty message');
      return null;
    }

    // Truncate message if too long
    let finalText = newText;
    if (newText.length > 4000) {
      finalText = newText.substring(0, 3997) + '...';
    }

    const result = await bot.editMessageText(finalText, {
      chat_id: chatId,
      message_id: messageId,
      ...options
    });
    return result;
  } catch (error) {
    console.error('Error editing message:', {
      chatId,
      messageId,
      error: error.message
    });

    // If edit fails, try sending a new message instead
    if (error.response && error.response.body && error.response.body.error_code === 400) {
      console.log('Edit failed, sending new message instead');
      return sendMessage(bot, chatId, newText, options);
    }

    return null;
  }
}

/**
 * Send a success message with emoji
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Success message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Message object
 */
async function sendSuccessMessage(bot, chatId, message, options = {}) {
  const successMessage = `✅ ${message}`;
  return sendMessage(bot, chatId, successMessage, options);
}

/**
 * Send an error message with emoji
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Error message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Message object
 */
async function sendErrorMessage(bot, chatId, message, options = {}) {
  const errorMessage = `❌ ${message}`;
  return sendMessage(bot, chatId, errorMessage, options);
}

/**
 * Send a warning message with emoji
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Warning message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Message object
 */
async function sendWarningMessage(bot, chatId, message, options = {}) {
  const warningMessage = `⚠️ ${message}`;
  return sendMessage(bot, chatId, warningMessage, options);
}

/**
 * Send an info message with emoji
 * @param {Object} bot - Telegram bot instance
 * @param {string|number} chatId - Chat ID
 * @param {string} message - Info message
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Message object
 */
async function sendInfoMessage(bot, chatId, message, options = {}) {
  const infoMessage = `ℹ️ ${message}`;
  return sendMessage(bot, chatId, infoMessage, options);
}

module.exports = {
  sendMessage,
  sendLoadingMessage,
  editMessage,
  sendSuccessMessage,
  sendErrorMessage,
  sendWarningMessage,
  sendInfoMessage
};
