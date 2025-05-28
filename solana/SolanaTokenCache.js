const fs = require("fs");
const { PublicKey } = require("@solana/web3.js");
const { TokenListProvider } = require("@solana/spl-token-registry");
const connection = require("./connection");

class TokenDetailsCache {
  constructor({ cacheFile = "token-cache.json" } = {}) {
    this.connection = connection;
    this.cacheFile = cacheFile;
    this.cache = this.loadCache();
    this.tokenList = null; // Initialize token list
    this.loadTokenList();  // Load token list on init
  }

  async loadTokenList() {
    try {
      const tokens = await new TokenListProvider().resolve();
      this.tokenList = tokens.filterByClusterSlug("mainnet-beta").getList();
      console.log("✅ Token list loaded.");
    } catch (error) {
      console.error("Failed to load token list:", error);
    }
  }

  getTokenMetadata(mintAddress) {
    if (!this.tokenList) return null;
    return this.tokenList.find(token => token.address === mintAddress);
  }

  loadCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        const fileContents = fs.readFileSync(this.cacheFile, "utf-8");
        return JSON.parse(fileContents);
      }
    } catch (error) {
      console.error("Error loading cache file:", error);
    }
    return {};
  }

  saveCache() {
    try {
      fs.writeFileSync(this.cacheFile, JSON.stringify(this.cache, null, 2));
    } catch (error) {
      console.error("Error saving cache file:", error);
    }
  }

  async fetchTokenDetails(mintAddress) {
    if (!mintAddress) throw new Error("Mint address cannot be null or undefined");
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const tokenInfo = await this.connection.getParsedAccountInfo(mintPublicKey);

      if (!tokenInfo.value) throw new Error("Token account not found");
      const { data } = tokenInfo.value;
      if (!data.parsed || data.parsed.type !== "mint") throw new Error("Invalid token mint account");

      const details = data.parsed.info;

      // Lookup name and symbol from token list
      const metadata = this.getTokenMetadata(mintAddress);
      const tokenDetails = {
        mint: mintAddress,
        name: metadata?.name || "Unknown Token",
        symbol: metadata?.symbol || "Unknown",
        decimals: details.decimals,
        supply: details.supply,
        mintAuthority: details.mintAuthority,
        freezeAuthority: details.freezeAuthority,
        isInitialized: details.isInitialized,
        lastUpdated: new Date().toISOString(),
      };

      this.cache[mintAddress] = tokenDetails;
      this.saveCache();
      return tokenDetails;
    } catch (error) {
      console.error(`Error fetching token details for ${mintAddress}:`, error);
      throw error;
    }
  }

  async getTokenDetails(mintAddress) {
    if (this.cache[mintAddress]) return this.cache[mintAddress];
    return this.fetchTokenDetails(mintAddress);
  }

  async getMultipleTokenDetails(mintAddresses) {
    const results = {};
    for (const mintAddress of mintAddresses) {
      try {
        results[mintAddress] = await this.getTokenDetails(mintAddress);
      } catch (error) {
        results[mintAddress] = { error: error.message };
      }
    }
    return results;
  }
}

module.exports = TokenDetailsCache;
