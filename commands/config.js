import 'dotenv/config';
import { SlashCommandBuilder } from 'discord.js';
import Config from '../models/Config.js';

export const data = new SlashCommandBuilder()
  .setName('config')
  .setDescription("Configurer le logger d'invitations")
  .addBooleanOption(option =>
    option.setName('enabled').setDescription('Activer le logger').setRequired(false))
  .addChannelOption(option =>
    option.setName('channel').setDescription('Channel où envoyer les logs').setRequired(false))
  .addStringOption(option =>
    option.setName('message').setDescription('Message personnalisé ({referrer}, {newMember}, {count})').setRequired(false));

import fs from 'fs';
const configData = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const ownerIds = configData.ownerIds || [];

export async function execute(interaction) {
  if (!ownerIds.includes(interaction.user.id)) {
    return interaction.reply({ content: 'Vous n\'êtes pas autorisé à utiliser cette commande.', flags: 64 });
  }
  const enabled = interaction.options.getBoolean('enabled');
  const channel = interaction.options.getChannel('channel');
  const message = interaction.options.getString('message');
  let config = await Config.findOne({ guildId: interaction.guild.id });
  if (!config) config = new Config({ guildId: interaction.guild.id });
  if (enabled !== null) config.enabled = enabled;
  if (channel) config.channelId = channel.id;
  if (message) {
    config.messageTemplate = message;
  } else if (!config.messageTemplate) {
    config.messageTemplate = process.env.MESSAGE_TEMPLATE || "Bienvenue {newMember} ! Ravi(e) de t'accueillir parmi nous. Un grand merci à {referrer} pour l'invitation, qui compte désormais {count} invitations ! 🎉";
  }
  await config.save();
  return interaction.reply({ content: 'Configuration mise à jour.', flags: 64 });
}
