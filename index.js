import { Client, GatewayIntentBits, Partials } from 'discord.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import eventHandler from './handlers/eventHandler.js';
import commandHandler from './handlers/commandHandler.js';
import deployHandler from './handlers/deployHandler.js';

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.GuildMember]
});

client.invitesCache = new Map();

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  eventHandler(client);
  commandHandler(client);
  client.once('ready', async () => {
    await deployHandler(client);
  });
  client.login(process.env.DISCORD_TOKEN);
})();
