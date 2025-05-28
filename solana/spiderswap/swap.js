// solana/spiderSwap.js
const Web3 = require("@solana/web3.js");
const axios = require("axios");
const bs58 = require("bs58");

const connection = require("../connection");
const { getUserKeypair } = require("../wallet");
const TokenDetailsCache = require("../SolanaTokenCache");

const tokenCache = new TokenDetailsCache();

function toLamports(amount, decimals = 9) {
  return Math.round(parseFloat(amount) * Math.pow(10, decimals));
}

async function swapTokens(userId, fromMint, toMint, amount, gasless = false) {
  try {
    const keypair = await getUserKeypair(userId);

    // Dynamically fetch decimals for fromMint
    let decimals = 9;
    try {
      const tokenDetails = await tokenCache.getTokenDetails(fromMint);
      if (tokenDetails && typeof tokenDetails.decimals === "number") {
        decimals = tokenDetails.decimals;

        console.log("Token Decimals:", decimals);
      }
    } catch (e) {
      console.warn(
        `Could not fetch decimals for ${fromMint}, defaulting to 9.`
      );
    }
    const lamports = toLamports(amount, decimals);

    console.log(
      `Swap request - From: ${fromMint}, To: ${toMint}, Amount: ${amount} (${lamports} lamports), Owner: ${keypair.publicKey.toBase58()}`
    );

    const res = await axios.get(
      "https://api.spiderswap.io/spider-api/v1/swap",
      {
        params: {
          owner: keypair.publicKey.toBase58(),
          fromMint,
          toMint,
          amount: lamports, // Send in lamports!
          slippage: 100, // in basis points (100 = 1%)
          pool: null, // Optional custom pool address
          provider: "raydium",
          gasless: gasless, // Use the parameter passed to the function
        },
        headers: {
          "X-API-KEY": process.env.SPIDER_API_KEY,
        },
      }
    );

    const swapTransactionBuf = Buffer.from(
      res.data.data.base64Transaction,
      "base64"
    );
    const transaction =
      Web3.VersionedTransaction.deserialize(swapTransactionBuf);

    const signers = res.data.data.signers || [];
    if (signers.length > 0) {
      transaction.sign([Web3.Keypair.fromSecretKey(bs58.decode(signers[0]))]);
    }

    transaction.sign([keypair]);

    const signature = await connection.sendRawTransaction(
      transaction.serialize()
    );
    return signature;
  } catch (error) {
    console.error("Swap error details:", {
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
              "X-API-KEY": "[REDACTED]", // Don't log the actual API key
            },
          }
        : "No request data",
    });

    // Handle specific error cases
    if (error.message.includes("AccountNotFound")) {
      throw new Error(
        "Token account not found. Your wallet may not have enough tokens or the token account hasn't been created yet. Please fund your wallet with some tokens first."
      );
    }

    // Throw a more detailed error message for API errors
    if (error.response && error.response.data && error.response.data.error) {
      throw new Error(
        `${error.response.data.error.message || error.response.data.error}`
      );
    }
    throw error;
  }
}

module.exports = { swapTokens };
