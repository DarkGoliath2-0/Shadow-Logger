export default async (invite, client) => {
  const invites = await invite.guild.invites.fetch();
  if (!client.invitesCache) client.invitesCache = new Map();
  client.invitesCache.set(invite.guild.id, new Map(invites.map(inv => [inv.code, inv.uses])));
};
