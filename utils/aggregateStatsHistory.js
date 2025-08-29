import InviteLog from '../models/InviteLog.js';
import StatsHistory from '../models/StatsHistory.js';

/**
 * Agrège et stocke les stats d'invitation pour une période donnée (jour/mois/année)
 * @param {String} guildId
 * @param {'day'|'month'|'year'} periodType
 * @param {Date} date - date de référence (fin de période)
 */
export async function aggregateStatsHistory(guildId, periodType, date = new Date()) {
  let start, end, periodValue;
  if (periodType === 'day') {
    start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
    periodValue = start.toISOString().slice(0, 10); // 'YYYY-MM-DD'
  } else if (periodType === 'month') {
    start = new Date(date.getFullYear(), date.getMonth(), 1);
    end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
    periodValue = start.toISOString().slice(0, 7); // 'YYYY-MM'
  } else if (periodType === 'year') {
    start = new Date(date.getFullYear(), 0, 1);
    end = new Date(date.getFullYear() + 1, 0, 1);
    periodValue = start.getFullYear().toString(); // 'YYYY'
  } else {
    throw new Error('Type de période invalide');
  }

  // Agrégation globale (total serveur)
  const totalCount = await InviteLog.countDocuments({
    guildId,
    timestamp: { $gte: start, $lt: end }
  });
  await StatsHistory.findOneAndUpdate(
    { guildId, userId: null, periodType, periodValue },
    { $set: { count: totalCount, createdAt: new Date() } },
    { upsert: true }
  );

  // Agrégation par utilisateur
  const pipeline = [
    { $match: { guildId, timestamp: { $gte: start, $lt: end } } },
    { $group: { _id: "$inviterId", count: { $sum: 1 } } }
  ];
  const userStats = await InviteLog.aggregate(pipeline);
  for (const stat of userStats) {
    await StatsHistory.findOneAndUpdate(
      { guildId, userId: stat._id, periodType, periodValue },
      { $set: { count: stat.count, createdAt: new Date() } },
      { upsert: true }
    );
  }
}
