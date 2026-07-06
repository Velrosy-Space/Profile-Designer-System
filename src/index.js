require('dotenv').config();
require('./console/watermark'); 
const config = require('./config');

const fs = require('fs');
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const readFile = promisify(fs.readFile);

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages 
    ] 
});

const EventHandler = require('./handlers/EventHandler');
const eventHandler = new EventHandler(client);


process.on("unhandledRejection", console.error);
process.on("uncaughtException", console.error);
process.on("uncaughtExceptionMonitor", console.error);


client.login(process.env.DISCORD_TOKEN);
