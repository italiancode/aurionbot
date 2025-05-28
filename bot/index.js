// bot/index.js

require('dotenv').config();

const TelegramBot = require("node-telegram-bot-api");
const handleStart = require("./commands/start");
const handleSwap = require("./commands/swap");
const handleCreateWallet = require("./commands/createwallet");
const handleImport = require("./commands/importwallet");
const handleExport = require("./commands/exportwallet");
const handleWallet = require("./commands/wallet");


function initBot() {
  if (!process.env.TELEGRAM_TOKEN) {
    console.error("❌ TELEGRAM_TOKEN is not set in .env file");
    process.exit(1);
  }

  if (!process.env.WALLET_SECRET) {
    console.error("❌ WALLET_SECRET is not set in .env file");
    process.exit(1);
  }

  try {
    let bot;
    const isProduction = process.env.NODE_ENV === 'production' || process.env.RENDER === 'true';
    
    if (isProduction && process.env.WEBHOOK_URL) {
      // Use webhook in production
      console.log("🔌 Starting bot in webhook mode...");
      const webhookUrl = process.env.WEBHOOK_URL;
      
      bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {
        webHook: {
          port: process.env.PORT || 3000
        }
      });
      
      // Set webhook
      bot.setWebHook(`${webhookUrl}/bot${process.env.TELEGRAM_TOKEN}`);
      console.log(`🔗 Webhook set to: ${webhookUrl}`);
    } else {
      // Use polling in development
      console.log("🔄 Starting bot in polling mode...");
      bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
      
      // Add error handling for polling
      bot.on('polling_error', (error) => {
        console.error('Polling error:', error);
      });
    }
    
    console.log("🚀 Telegram bot started...");

    // Register command handlers
    handleStart(bot);
    handleSwap(bot);
    handleCreateWallet(bot);
    handleImport(bot);
    handleExport(bot);
    handleWallet(bot);

    return bot;
  } catch (error) {
    console.error("❌ Failed to initialize bot:", error.message);
    process.exit(1);
  }
}

module.exports = { initBot };
