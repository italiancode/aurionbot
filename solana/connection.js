// solana/connection.js
require("dotenv").config();
const Web3 = require("@solana/web3.js");

const connection = new Web3.Connection(process.env.HELIUS_RPC, "confirmed");

module.exports = connection;
