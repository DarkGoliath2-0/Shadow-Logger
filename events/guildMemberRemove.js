import InviteCounter from '../models/InviteCounter.js';
import fs from 'fs';

const configData = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));

export default async (member, client) => {
  try {
    // Supprime tous les enregistrements d'invitation pour cet utilisateur dans ce serveur
    const res = await InviteCounter.deleteMany({ userId: member.id, guildId: member.guild.id });
    if (res.deletedCount > 0) {
      console.log(`[CLEANUP] Invitations supprimées pour ${member.user ? member.user.tag : member.id} (${member.id}) sur le serveur ${member.guild.id}`);
    }
    // Supprime tous les liens d'invitation de cet utilisateur dans ce serveur (DB)
    const Invite = (await import('../models/Invite.js')).default;
    const res2 = await Invite.deleteMany({ inviterId: member.id, guildId: member.guild.id });
    if (res2.deletedCount > 0) {
      console.log(`[CLEANUP] Liens supprimés pour ${member.user ? member.user.tag : member.id} (${member.id}) sur le serveur ${member.guild.id}`);
    }
    // Supprime aussi les liens d'invitation dans le serveur Discord
    try {
      const invites = await member.guild.invites.fetch();
      let deleted = 0;
      for (const invite of invites.values()) {
        if (invite.inviter && invite.inviter.id === member.id) {
          await invite.delete("L'utilisateur a quitté le serveur");
          deleted++;
        }
      }
      if (deleted > 0) {
        console.log(`[CLEANUP] ${deleted} lien(s) Discord supprimé(s) pour ${member.user ? member.user.tag : member.id} (${member.id}) sur le serveur ${member.guild.id}`);
      }
    } catch (err) {
      console.error(`[CLEANUP] Erreur lors de la suppression des liens Discord pour ${member.id} sur le serveur ${member.guild.id}:`, err);
    }
    // Envoie un log dans le canal Discord référencé
    try {
      const guild = client.guilds.cache.get(process.env.GUILD_ID);
      if (guild && configData.logLogger) {
        const channel = guild.channels.cache.get(configData.logLogger);
        if (channel) {
          // On veut : utilisateur, nombre de liens Discord supprimés, nombre d'invitations réalisées (compteurs)
          let msg = `🧹 **Départ membre** : ${member.user ? member.user.tag : member.id} (${member.id})\n`;
          msg += `- Liens Discord supprimés : ${typeof deleted !== 'undefined' ? deleted : 0}\n`;
          msg += `- Invitations réalisées : ${res.deletedCount}`;
          channel.send({ content: msg });
        }
      }
    } catch (err) {
      console.error(`[CLEANUP] Erreur lors de l'envoi du log Discord :`, err);
    }
  } catch (err) {
    console.error(`[CLEANUP] Erreur lors de la suppression des invitations/liens pour ${member.id} sur le serveur ${member.guild.id}:`, err);
  }
};
