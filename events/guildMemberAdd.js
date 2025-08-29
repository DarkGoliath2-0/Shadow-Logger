import Config from '../models/Config.js';
import InviteLog from '../models/InviteLog.js';
import InviteCounter from '../models/InviteCounter.js';

export default async (member, client) => {
  if (member.user.bot) return;
  if (!client.invitesCache) client.invitesCache = new Map();
  const config = await Config.findOne({ guildId: member.guild.id });
  if (!config || !config.enabled) return;
  let oldInvites = client.invitesCache.get(member.guild.id);
  let newInvites;
  try {
    newInvites = await member.guild.invites.fetch();
  } catch {
    return;
  }
  let inviteUsed = newInvites.find(inv => oldInvites && oldInvites.get(inv.code) < inv.uses);
  let inviterId = null;
  let inviterTag = null;
  let inviteCode = null;
  if (!inviteUsed) {
    // Fallback : cherche dans la base Invite si un code a été utilisé (différence d'usage)
    const Invite = (await import('../models/Invite.js')).default;
    for (const inv of newInvites.values()) {
      const oldUses = oldInvites ? oldInvites.get(inv.code) : 0;
      if (inv.uses > oldUses) {
        // Trouvé un code utilisé
        const dbInvite = await Invite.findOne({ code: inv.code, guildId: member.guild.id });
        if (dbInvite) {
          inviterId = dbInvite.inviterId;
          inviteCode = dbInvite.code;
          break;
        }
      }
    }
    if (!inviterId) return; // Aucun code trouvé
  } else {
    inviterId = inviteUsed.inviter.id;
    inviterTag = inviteUsed.inviter.tag;
    inviteCode = inviteUsed.code;
  }
  await InviteLog.create({
    inviterId,
    invitedId: member.id,
    guildId: member.guild.id
  });
  let counter = await InviteCounter.findOneAndUpdate(
    { userId: inviterId, guildId: member.guild.id },
    { $inc: { count: 1 }, $set: inviterTag ? { tag: inviterTag } : {} },
    { upsert: true, new: true }
  );
  let channel = config.channelId ? member.guild.channels.cache.get(config.channelId) : null;
  if (channel) {
    const message = config.messageTemplate
      .replace('{referrer}', `<@${inviterId}>`)
      .replace('{newMember}', `<@${member.id}>`)
      .replace('{count}', counter.count);
    channel.send({ content: message });
  }
  client.invitesCache.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));
};
