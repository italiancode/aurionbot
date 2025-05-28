/**
 * Safely delete a message without throwing errors
 * @param {Object} bot - Telegram bot instance
 * @param {number|string} chatId - Chat ID
 * @param {number} messageId - Message ID to delete
 * @returns {Promise<boolean>} - Success status
 */
async function safeDelete(bot, chatId, messageId) {
  try {
    await bot.deleteMessage(chatId, messageId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Send a temporary message that will be auto-deleted after specified time
 * @param {Object} bot - Telegram bot instance
 * @param {number|string} chatId - Chat ID
 * @param {string} text - Message text
 * @param {Object} options - Telegram message options (optional)
 * @param {number} deleteAfterMs - Time in milliseconds before deleting the message (default: 5000)
 * @returns {Promise<Object|null>} - Message object or null if failed
 */
async function sendTempMessage(bot, chatId, text, options = {}, deleteAfterMs = 5000) {
  try {
    // Send the message
    const msg = await bot.sendMessage(chatId, text, options);
    
    // Schedule deletion
    if (msg && deleteAfterMs > 0) {
      setTimeout(() => {
        safeDelete(bot, chatId, msg.message_id);
      }, deleteAfterMs);
    }
    
    return msg;
  } catch (error) {
    console.error(`Failed to send temporary message: ${error.message}`);
    return null;
  }
}

module.exports = {
  safeDelete,
  sendTempMessage,
};
