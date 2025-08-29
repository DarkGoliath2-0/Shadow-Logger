import { SlashCommandBuilder } from 'discord.js';
import InviteCounter from '../models/InviteCounter.js';
import Config from '../models/Config.js';
import fs from 'fs';
const configData = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const ownerIds = configData.ownerIds || [];


export const data = new SlashCommandBuilder()
  .setName('synchro')
  .setDescription("Synchroniser les invitations existantes du serveur avec la base de données");

export async function execute(interaction) {
  try {
  if (!ownerIds.includes(interaction.user.id)) {
    return interaction.reply({ content: 'Vous n\'êtes pas autorisé à utiliser cette commande.', flags: 64 });
  }
  await interaction.deferReply({ flags: 64 });
  const guild = interaction.guild;
  // Vérifier si déjà synchronisé
  const config = await Config.findOne({ guildId: guild.id });
  if (config && config.invitesSynchronized) {
    return interaction.editReply({ content: 'La synchronisation a déjà été effectuée pour ce serveur.' });
  }
  let invites;
  try {
    invites = await guild.invites.fetch();
  } catch (err) {
    return interaction.editReply({ content: "Impossible de récupérer les invitations du serveur." });
  }
  let total = 0, updated = 0;
  for (const invite of invites.values()) {
    if (!invite.inviter || invite.inviter.bot) continue;
    total++;
    // Enregistre ou met à jour le compteur d'invitations
    const res = await InviteCounter.findOneAndUpdate(
      { userId: invite.inviter.id, guildId: guild.id },
      { $inc: { count: invite.uses }, $set: { tag: invite.inviter.tag } },
      { upsert: true, new: true }
    );
    // Enregistre ou met à jour le lien d'invitation
    await import('../models/Invite.js').then(async ({ default: Invite }) => {
      await Invite.findOneAndUpdate(
        { code: invite.code },
        {
          code: invite.code,
          inviterId: invite.inviter.id,
          uses: invite.uses,
          guildId: guild.id,
          createdAt: invite.createdTimestamp ? new Date(invite.createdTimestamp) : new Date()
        },
        { upsert: true, new: true }
      );
    });
    if (invite.uses > 0) updated++;
  }
  // Optionnel : marquer la synchro
  await Config.findOneAndUpdate(
    { guildId: guild.id },
    { $set: { invitesSynchronized: true } },
    { upsert: true }
  );
  return interaction.editReply({ content: `Synchronisation terminée : ${updated} invitations ajoutées pour ${total} liens trouvés.` });
  } catch (err) {
    console.error('[SYNCHRO] Erreur lors de la synchronisation :', err);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ content: 'Erreur lors de la synchronisation.' });
    } else {
      await interaction.reply({ content: 'Erreur lors de la synchronisation.' });
    }
  }
}
