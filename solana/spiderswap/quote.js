// solana/spiderswap/quote.js
const axios = require("axios");
const TokenDetailsCache = require("../SolanaTokenCache");

const tokenCache = new TokenDetailsCache();

/**
 * Convert token amount to lamports based on token decimals
 * @param {number|string} amount - Amount in token units
 * @param {number} decimals - Token decimals
 * @returns {number} - Amount in lamports
 */
function toLamports(amount, decimals = 9) {
  return Math.round(parseFloat(amount) * Math.pow(10, decimals));
}

/**
 * Get a swap quote from Spider Swap
 * @param {string} fromMint - Source token mint address
 * @param {string} toMint - Destination token mint address
 * @param {number|string} amount - Amount to swap in token units (not lamports)
 * @param {number} slippage - Slippage tolerance in basis points (100 = 1%)
 * @param {string} provider - Optional liquidity provider (e.g., 'meteora')
 * @param {string} pool - Optional custom pool address
 * @returns {Promise<Object>} - Quote data
 */
async function getSwapQuote(fromMint, toMint, amount, slippage, provider = 'raydium', pool = null) {
  try {
    // Get token decimals for both tokens to convert amounts properly
    let fromDecimals = 9;
    let toDecimals = 9;
    
    try {
      const fromTokenDetails = await tokenCache.getTokenDetails(fromMint);
      if (fromTokenDetails && typeof fromTokenDetails.decimals === "number") {
        fromDecimals = fromTokenDetails.decimals;
        console.log("From Token Decimals:", fromDecimals);
      }
    } catch (e) {
      console.warn(`Could not fetch decimals for ${fromMint}, defaulting to 9.`);
    }
    
    try {
      const toTokenDetails = await tokenCache.getTokenDetails(toMint);
      if (toTokenDetails && typeof toTokenDetails.decimals === "number") {
        toDecimals = toTokenDetails.decimals;
        console.log("To Token Decimals:", toDecimals);
      }
    } catch (e) {
      console.warn(`Could not fetch decimals for ${toMint}, defaulting to 9.`);
    }
    
    // Convert amount to lamports
    const lamports = toLamports(amount, fromDecimals);
    
    console.log(`Quote request - From: ${fromMint}, To: ${toMint}, Amount: ${amount} (${lamports} lamports)`);
    
    // Prepare params
    const params = {
      fromMint,
      toMint,
      amount: lamports, // in lamports
      slippage, // in BPS
      provider
    };
    
    // Add custom pool if provided
    if (pool) {
      params.pool = pool;
    }
    
    // Log the request being made
    console.log(`Making API request to Spider Swap with params:`, {
      ...params,
      apiKey: process.env.SPIDER_API_KEY ? 'PRESENT' : 'MISSING'
    });
    
    if (!process.env.SPIDER_API_KEY) {
      console.error('SPIDER_API_KEY is not configured in .env file');
      throw new Error('API key is not configured. Please set the SPIDER_API_KEY in the .env file.');
    }
    
    // Make API request
    const { data } = await axios.get(
      'https://api.spiderswap.io/spider-api/v1/quote',
      {
        params,
        headers: { 'X-API-KEY': process.env.SPIDER_API_KEY }
      }
    );
    
    // Log the response for debugging
    console.log('API Response:', JSON.stringify(data, null, 2));
    
    // Check if the API returned the required data
    if (!data || !data.data || !data.data.outAmount) {
      console.warn('No valid outAmount received from API');
      console.log('Data structure:', data);
      
      // Return error indicating the API didn't provide valid data
      return {
        success: false,
        error: 'Could not get a valid swap rate from the API. Please try again later.',
        data: data
      };
    }
    // Prepare the output amount based on the output decimals
    // If outputDecimals is not provided, default to toDecimals
    const outputDecimals = data.outputDecimals || toDecimals;
    const outAmount = data.data.outAmount ? (parseInt(data.data.outAmount) / Math.pow(10, outputDecimals)).toFixed(6) : '0';
    
    return {
      success: true,
      data: data,
      fromAmount: amount,
      fromDecimals: fromDecimals,
      toDecimals: outputDecimals,
      fromLamports: lamports,
      toAmount: outAmount,
      outAmountRaw: data.data.outAmount,
      priceImpact: data.data.priceImpactPercent ? parseFloat(data.data.priceImpactPercent).toFixed(2) : null,
      // Note: minimumReceived is not always provided, handle it gracefully
      // If minimumReceived is not provided, we can assume it's null or 0
      // This is the minimum amount the user will receive after slippage
      minimumReceived: data.data.minimumReceived ? (parseInt(data.data.minimumReceived) / Math.pow(10, outputDecimals)).toFixed(6) : null,
      // fee: data.data.fee || null
    };
  } catch (error) {
    console.error("Quote error:", {
      message: error.message,
      response: error.response
        ? {
            status: error.response.status,
            data: error.response.data,
          }
        : "No response data",
      request: error.config
        ? {
            url: error.config.url,
            params: error.config.params,
            headers: {
              ...error.config.headers,
              "X-API-KEY": "[REDACTED]" // Don't log the actual API key
            },
          }
        : "No request data",
    });
    
    // Handle specific API errors
    if (error.response && error.response.data && error.response.data.error) {
      return {
        success: false,
        error: `${error.response.data.error.message || error.response.data.error}`
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { getSwapQuote, toLamports };
