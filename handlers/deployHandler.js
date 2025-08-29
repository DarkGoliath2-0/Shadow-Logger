import { REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

export default async (client) => {
  const commands = [];
  const commandsPath = path.resolve('./commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const command = (await import(`../commands/${file}`));
    if (command.data) {
      commands.push(command.data.toJSON());
      client.commands.set(command.data.name, command);
      console.log(`[✅] Commande chargée: ${command.data.name}`);
    } else {
      console.log(`[❌] La commande ${file} manque de propriétés requises.`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    if (process.env.GUILD_ID) {
      await rest.put(
        Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
        { body: commands }
      );
      console.log(`[⚡] Commandes déployées sur le serveur : ${process.env.GUILD_ID}`);
    } else {
      await rest.put(
        Routes.applicationCommands(process.env.CLIENT_ID),
        { body: commands }
      );
      console.log('[⚡] Commandes globales déployées (propagation lente)');
    }
  } catch (error) {
    console.error('[❌] Erreur lors du déploiement des commandes :', error);
  }
};
