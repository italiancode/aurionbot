// index.js
require("dotenv").config();
const http = require("http");
const { initBot } = require("./bot");

try {
  console.log("🤖 Starting Aurion Swap Bot...");
  const bot = initBot();

  // Handle application termination
  process.on("SIGINT", () => {
    console.log("\n👋 Bot is shutting down...");
    if (bot && bot.isPolling()) {
      bot.stopPolling();
    }
    process.exit(0);
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    console.error("❌ Uncaught exception:", err);
    process.exit(1);
  });
} catch (error) {
  console.error("❌ Failed to start bot:", error.message);
  process.exit(1);
}

// HTTP server for keep-alive (Render)
const server = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({ status: "up", timestamp: new Date().toISOString() })
    );
  } else if (req.url === "/ping") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("pong");
  } else {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});

// Simple logger fallback
const logger = {
  info: console.log,
  error: console.error,
  debug: console.debug,
};

let keepAliveInterval;
function setupKeepAlive() {
  if (keepAliveInterval) clearInterval(keepAliveInterval);

  const serverUrl = process.env.RENDER_SERVER_URL || `http://localhost:${PORT}`;
  const fullServerUrl = serverUrl.includes("://")
    ? serverUrl
    : `https://${serverUrl}`;

  logger.info(`Setting up keep-alive ping to ${fullServerUrl}`);

  keepAliveInterval = setInterval(() => {
    const pingUrl = `${fullServerUrl}/ping`;
    const options = { method: "GET", timeout: 10000 };
    const httpClient = pingUrl.startsWith("https") ? require("https") : http;

    const req = httpClient.request(pingUrl, options, (res) => {
      // Optionally log response
    });

    req.on("error", (error) => {
      logger.error(`Keep-alive ping failed: ${error.message}`);
      // Try alternative Render URL if needed
      try {
        const renderApp = process.env.RENDER_APP_NAME || "aurion-swap-bot";
        if (!renderApp) {
          logger.error("RENDER_APP_NAME environment variable is not set.");
          return;
        }
        const renderUrl = `https://${renderApp}.onrender.com/ping`;
        const altReq = require("https").request(
          renderUrl,
          { method: "GET", timeout: 10000 },
          () => {}
        );
        altReq.on("error", (altError) => {
          logger.error(`Alternative ping also failed: ${altError.message}`);
        });
        altReq.end();
      } catch (backupError) {
        logger.error(`Failed to perform backup ping: ${backupError.message}`);
      }
    });

    req.end();
  }, 5 * 60 * 1000); // Every 5 minutes

  logger.info("Keep-alive ping mechanism initialized");
}

// After server.listen(...)
setupKeepAlive();
