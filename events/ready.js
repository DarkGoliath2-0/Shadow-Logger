export const once = true;
import { aggregateStatsHistory } from '../utils/aggregateStatsHistory.js';
import StatsHistory from '../models/StatsHistory.js';
import InviteLog from '../models/InviteLog.js';
let cron;
try {
  cron = (await import('node-cron')).default;
} catch (e) {
  console.warn('[CRON] node-cron n\'est pas installé. Les historiques ne seront pas auto-mis à jour.');
}

export default async (client) => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);

  // --- Rattrapage automatique au démarrage (pour la veille, le mois et l'année en cours) ---
  console.log('[CRON] Démarrage du bot : vérification/rattrapage des historiques jour/mois/année...');
  const guilds = client.guilds.cache.map(g => g.id);
  const now = new Date();
  for (const guildId of guilds) {
    // JOUR (veille)
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const periodValue = yesterday.toISOString().slice(0, 10);
    const exists = await StatsHistory.findOne({ guildId, periodType: 'day', periodValue, userId: null });
    if (!exists) await aggregateStatsHistory(guildId, 'day', yesterday);
    // MOIS (mois en cours)
    const monthValue = now.toISOString().slice(0, 7);
    const existsM = await StatsHistory.findOne({ guildId, periodType: 'month', periodValue: monthValue, userId: null });
    if (!existsM) await aggregateStatsHistory(guildId, 'month', now);
    // ANNEE (année en cours)
    const yearValue = now.getFullYear().toString();
    const existsY = await StatsHistory.findOne({ guildId, periodType: 'year', periodValue: yearValue, userId: null });
    if (!existsY) await aggregateStatsHistory(guildId, 'year', now);
  }
  console.log('[CRON] Rattrapage des historiques terminé.');

  // --- Planification automatique avec node-cron ---
  if (cron) {
    // Tous les jours à 00:10, agrège la veille
    cron.schedule('10 0 * * *', async () => {
      console.log('[CRON] Déclenchement planifié : agrégation historique JOUR (veille)');
      const now = new Date();
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      for (const guildId of client.guilds.cache.map(g => g.id)) {
        await aggregateStatsHistory(guildId, 'day', yesterday);
      }
      console.log('[CRON] Agrégation historique jour effectuée.');
    });
    // Tous les 1er du mois à 00:20, agrège le mois précédent
    cron.schedule('20 0 1 * *', async () => {
      console.log('[CRON] Déclenchement planifié : agrégation historique MOIS (mois précédent)');
      const now = new Date();
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      for (const guildId of client.guilds.cache.map(g => g.id)) {
        await aggregateStatsHistory(guildId, 'month', prevMonth);
      }
      console.log('[CRON] Agrégation historique mois effectuée.');
    });
    // Tous les 1er janvier à 00:30, agrège l'année précédente
    cron.schedule('30 0 1 1 *', async () => {
      console.log('[CRON] Déclenchement planifié : agrégation historique ANNEE (année précédente)');
      const now = new Date();
      const prevYear = new Date(now.getFullYear() - 1, 0, 1);
      for (const guildId of client.guilds.cache.map(g => g.id)) {
        await aggregateStatsHistory(guildId, 'year', prevYear);
      }
      console.log('[CRON] Agrégation historique année effectuée.');
    });
  }
};
