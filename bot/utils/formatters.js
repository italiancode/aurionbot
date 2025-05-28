// bot/utils/formatters.js

/**
 * Utility functions for formatting messages and improving user experience
 */

/**
 * Format a number with appropriate decimal places and commas
 * @param {number|string} number - Number to format
 * @param {number} decimals - Number of decimal places (default: 6)
 * @returns {string} - Formatted number
 */
function formatNumber(number, decimals = 6) {
  if (!number || isNaN(number)) return '0';
  
  const num = parseFloat(number);
  if (num === 0) return '0';
  
  // For very small numbers, use scientific notation
  if (num < 0.000001 && num > 0) {
    return num.toExponential(2);
  }
  
  // For large numbers, use commas
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  
  // Regular formatting with appropriate decimals
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

/**
 * Format a token amount with symbol
 * @param {number|string} amount - Token amount
 * @param {string} symbol - Token symbol
 * @param {number} decimals - Decimal places
 * @returns {string} - Formatted token amount
 */
function formatTokenAmount(amount, symbol = '', decimals = 6) {
  const formattedAmount = formatNumber(amount, decimals);
  return symbol ? `${formattedAmount} ${symbol}` : formattedAmount;
}

/**
 * Format a percentage with appropriate styling
 * @param {number|string} percentage - Percentage value
 * @param {boolean} showSign - Whether to show + for positive values
 * @returns {string} - Formatted percentage
 */
function formatPercentage(percentage, showSign = false) {
  if (!percentage || isNaN(percentage)) return '0%';
  
  const num = parseFloat(percentage);
  const sign = showSign && num > 0 ? '+' : '';
  
  return `${sign}${num.toFixed(2)}%`;
}

/**
 * Format a Solana address for display (truncated)
 * @param {string} address - Solana address
 * @param {number} startChars - Characters to show at start (default: 4)
 * @param {number} endChars - Characters to show at end (default: 4)
 * @returns {string} - Formatted address
 */
function formatAddress(address, startChars = 4, endChars = 4) {
  if (!address || address.length <= startChars + endChars) {
    return address || '';
  }
  
  return `${address.substring(0, startChars)}...${address.substring(address.length - endChars)}`;
}

/**
 * Format a transaction signature for display
 * @param {string} signature - Transaction signature
 * @returns {string} - Formatted signature
 */
function formatTxSignature(signature) {
  return formatAddress(signature, 8, 8);
}

/**
 * Create a progress bar for loading states
 * @param {number} progress - Progress percentage (0-100)
 * @param {number} length - Length of progress bar (default: 10)
 * @returns {string} - Progress bar string
 */
function createProgressBar(progress, length = 10) {
  const filled = Math.round((progress / 100) * length);
  const empty = length - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format time duration in a human-readable way
 * @param {number} seconds - Duration in seconds
 * @returns {string} - Formatted duration
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  } else {
    return `${Math.round(seconds / 3600)}h`;
  }
}

/**
 * Create a formatted swap summary
 * @param {Object} swapData - Swap data object
 * @returns {string} - Formatted swap summary
 */
function formatSwapSummary(swapData) {
  const {
    fromAmount,
    fromSymbol,
    toAmount,
    toSymbol,
    priceImpact,
    minimumReceived,
    slippage
  } = swapData;

  let summary = `💱 **Swap Summary**\n\n`;
  summary += `**From:** ${formatTokenAmount(fromAmount, fromSymbol)}\n`;
  summary += `**To:** ~${formatTokenAmount(toAmount, toSymbol)}\n`;
  
  if (minimumReceived) {
    summary += `**Min. Received:** ${formatTokenAmount(minimumReceived, toSymbol)}\n`;
  }
  
  if (priceImpact) {
    const impact = parseFloat(priceImpact);
    const impactEmoji = impact > 5 ? '🔴' : impact > 1 ? '🟡' : '🟢';
    summary += `**Price Impact:** ${impactEmoji} ${formatPercentage(priceImpact)}\n`;
  }
  
  if (slippage) {
    summary += `**Slippage:** ${formatPercentage(slippage / 100)}\n`;
  }
  
  summary += `**Gas:** Free ⚡\n`;
  
  return summary;
}

/**
 * Create a formatted wallet info display
 * @param {Object} wallet - Wallet object
 * @param {Array} balances - Token balances (optional)
 * @returns {string} - Formatted wallet info
 */
function formatWalletInfo(wallet, balances = []) {
  let info = `👛 **${wallet.name}**\n\n`;
  info += `**Address:** \`${wallet.publicKey}\`\n`;
  info += `**Short:** ${formatAddress(wallet.publicKey)}\n\n`;
  
  if (balances && balances.length > 0) {
    info += `**Balances:**\n`;
    balances.forEach(balance => {
      info += `• ${formatTokenAmount(balance.amount, balance.symbol)}\n`;
    });
  } else {
    info += `**Balances:** Loading...\n`;
  }
  
  return info;
}

/**
 * Create a formatted error message with helpful context
 * @param {string} error - Error message
 * @param {string} context - Additional context
 * @param {Array} suggestions - Suggested actions
 * @returns {string} - Formatted error message
 */
function formatErrorMessage(error, context = '', suggestions = []) {
  let message = `❌ **Error**\n\n`;
  message += `${error}\n`;
  
  if (context) {
    message += `\n**Context:** ${context}\n`;
  }
  
  if (suggestions && suggestions.length > 0) {
    message += `\n**Suggestions:**\n`;
    suggestions.forEach((suggestion, index) => {
      message += `${index + 1}. ${suggestion}\n`;
    });
  }
  
  return message;
}

/**
 * Create a loading message with animation
 * @param {string} action - Action being performed
 * @param {number} step - Current step (optional)
 * @param {number} totalSteps - Total steps (optional)
 * @returns {string} - Loading message
 */
function formatLoadingMessage(action, step = null, totalSteps = null) {
  let message = `⏳ ${action}`;
  
  if (step !== null && totalSteps !== null) {
    const progress = Math.round((step / totalSteps) * 100);
    const progressBar = createProgressBar(progress, 8);
    message += `\n\n${progressBar} ${progress}%`;
    message += `\nStep ${step} of ${totalSteps}`;
  } else {
    message += '...';
  }
  
  return message;
}

/**
 * Format price impact with appropriate warning level
 * @param {number} priceImpact - Price impact percentage
 * @returns {Object} - Object with formatted text and warning level
 */
function formatPriceImpact(priceImpact) {
  const impact = parseFloat(priceImpact);
  
  let emoji = '🟢';
  let warningLevel = 'low';
  let message = '';
  
  if (impact > 15) {
    emoji = '🔴';
    warningLevel = 'critical';
    message = 'Very high price impact! Consider reducing swap amount.';
  } else if (impact > 5) {
    emoji = '🟡';
    warningLevel = 'high';
    message = 'High price impact. Please review carefully.';
  } else if (impact > 1) {
    emoji = '🟡';
    warningLevel = 'medium';
    message = 'Moderate price impact.';
  } else {
    emoji = '🟢';
    warningLevel = 'low';
    message = 'Low price impact.';
  }
  
  return {
    formatted: `${emoji} ${formatPercentage(impact)}`,
    warningLevel,
    message,
    emoji
  };
}

module.exports = {
  formatNumber,
  formatTokenAmount,
  formatPercentage,
  formatAddress,
  formatTxSignature,
  createProgressBar,
  formatDuration,
  formatSwapSummary,
  formatWalletInfo,
  formatErrorMessage,
  formatLoadingMessage,
  formatPriceImpact
};
