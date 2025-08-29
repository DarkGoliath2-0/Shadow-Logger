import { SlashCommandBuilder } from 'discord.js';
import InviteCounter from '../models/InviteCounter.js';
import StatsHistory from '../models/StatsHistory.js';
import { generatePlotlyGraph } from '../utils/plotlyGraph.js';
import fs from 'fs';
import path from 'path';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription("Voir le nombre d'invitations")
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription("Lister tous les utilisateurs ou un utilisateur spécifique et leur nombre d'invitations")
      .addUserOption(option =>
        option.setName('user').setDescription('Utilisateur à vérifier').setRequired(false))
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('graph')
      .setDescription("Afficher la courbe d'invitation sous forme de graphique")
      .addStringOption(option =>
        option.setName('periode')
          .setDescription('Période à afficher')
          .setRequired(false)
          .addChoices(
            { name: 'Jour', value: 'jour' },
            { name: 'Semaine', value: 'semaine' },
            { name: 'Mois', value: 'mois' },
            { name: 'Année', value: 'annee' }
          ))
  );

export async function execute(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    let user = interaction.options.getUser('user');
    if (user) {
      let counter, count, member;
      try {
        counter = await InviteCounter.findOne({ userId: user.id, guildId: interaction.guild.id });
        count = counter ? counter.count : 0;
      } catch (err) {
        console.error('Erreur MongoDB InviteCounter.findOne:', err);
        return interaction.reply({ content: 'Erreur lors de la récupération des invitations.', ephemeral: true });
      }
      try {
        member = await interaction.guild.members.fetch(user.id);
      } catch (err) {
        console.error('Erreur Discord fetch member:', err);
        member = null;
      }
      const tag = member ? member.user.tag : user.id;
      return interaction.reply({ content: `${tag} a ${count} invitation(s).` });
    } else {
      let counters;
      try {
        counters = await InviteCounter.find({ guildId: interaction.guild.id });
      } catch (err) {
        console.error('Erreur MongoDB InviteCounter.find:', err);
        return interaction.reply({ content: 'Erreur lors de la récupération des invitations.', ephemeral: true });
      }
      if (!counters.length) return interaction.reply({ content: 'Aucune donnée d\'invitation trouvée.', flags: 64 });
      await interaction.deferReply();
      counters.sort((a, b) => b.count - a.count);
      const lines = [];
      for (const c of counters) {
        const tag = c.tag ? c.tag : c.userId;
        lines.push(`${tag} : ${c.count} invitation(s)`);
      }
      // Pagination : 10 utilisateurs par page
      const pageSize = 10;
      const totalPages = Math.ceil(lines.length / pageSize);
      let page = 0;
      function generateEmbed(page) {
        const start = page * pageSize;
        const end = start + pageSize;
        const pageLines = lines.slice(start, end);
        return {
          title: `Classement des invitations (page ${page + 1}/${totalPages})`,
          description: pageLines.join('\n'),
          color: 0x4bc0c0,
          footer: { text: `Total utilisateurs : ${lines.length}` }
        };
      }
      const row = {
        type: 1,
        components: [
          {
            type: 2,
            style: 2,
            custom_id: 'prev_page',
            label: 'Précédent',
            disabled: true
          },
          {
            type: 2,
            style: 2,
            custom_id: 'next_page',
            label: 'Suivant',
            disabled: totalPages <= 1
          }
        ]
      };
      let reply;
      try {
        if (interaction.replied || interaction.deferred) {
          reply = await interaction.editReply({
            embeds: [generateEmbed(page)],
            components: [row]
          });
        } else {
          reply = await interaction.reply({
            embeds: [generateEmbed(page)],
            components: [row],
            fetchReply: true
          });
        }
      } catch (err) {
        console.error('Erreur lors de la réponse initiale /stats list :', err);
        return;
      }
      if (totalPages <= 1) return;
      // Gestion des boutons
      const filter = i => i.user.id === interaction.user.id && (i.customId === 'prev_page' || i.customId === 'next_page');
      try {
        const collector = reply.createMessageComponentCollector({ filter, time: 60000 });
        collector.on('collect', async i => {
          if (i.customId === 'prev_page') page--;
          if (i.customId === 'next_page') page++;
          // Met à jour les boutons
          row.components[0].disabled = page === 0;
          row.components[1].disabled = page === totalPages - 1;
          await i.update({ embeds: [generateEmbed(page)], components: [row] });
        });
        collector.on('end', async () => {
          row.components[0].disabled = true;
          row.components[1].disabled = true;
          await reply.edit({ components: [row] });
        });
      } catch (err) {
        console.error('Erreur pagination /stats list :', err);
        try {
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Une erreur est survenue lors de la pagination.', ephemeral: true });
          } else {
            await interaction.reply({ content: 'Une erreur est survenue lors de la pagination.', ephemeral: true });
          }
        } catch (err2) {
          console.error('Erreur lors de l\'envoi du message d\'erreur pagination :', err2);
        }
      }
      return;

    }
  }

  if (sub === 'graph') {
    // --- Nouvelle version Plotly.js ---
    // --- Nouvelle version Plotly.js ---
    // Les imports sont déjà faits en haut du fichier
    // Option période (jour/mois/année)
    const periode = interaction.options.getString('periode') || 'jour';
    let InviteLog;
    try {
      InviteLog = (await import('../models/InviteLog.js')).default;
    } catch (err) {
      return interaction.reply({ content: 'Erreur lors de la récupération du modèle InviteLog.', ephemeral: true });
    }
    await interaction.deferReply();
    const now = new Date();
    let labels = [], data = [], prevData = [], prevLabels = [];
    let chartLabel = '', chartTitle = '', chartPrevLabel = '';

    console.log('[STATS] Début génération labels/données pour la période:', periode);
    if (periode === 'jour') {
      // 24 dernières heures
      for (let i = 23; i >= 0; i--) {
        const hour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() - i);
        const periodValue = hour.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        labels.push(hour.getHours() + 'h');
        // Stats courante (heure)
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'hour',
          periodValue,
          userId: null
        });
        if (!stat) {
          const start = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours());
          const end = new Date(hour.getFullYear(), hour.getMonth(), hour.getDate(), hour.getHours() + 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Stats précédente (la veille, même heure)
        const prevHour = new Date(hour.getTime() - 24 * 60 * 60 * 1000);
        const prevPeriodValue = prevHour.toISOString().slice(0, 13);
        prevLabels.push(prevHour.getHours() + 'h');
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'hour',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevHour.getFullYear(), prevHour.getMonth(), prevHour.getDate(), prevHour.getHours());
          const prevEnd = new Date(prevHour.getFullYear(), prevHour.getMonth(), prevHour.getDate(), prevHour.getHours() + 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Aujourd\'hui';
      chartPrevLabel = 'Hier';
      chartTitle = 'Évolution des invitations aujourd\'hui';
      console.log('[STATS] Labels/données jour générés:', labels, data, prevLabels, prevData);
    } else if (periode === 'semaine') {
      // 7 derniers jours
      for (let i = 6; i >= 0; i--) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const periodValue = day.toISOString().slice(0, 10);
        labels.push(day.toLocaleDateString());
        // Stats courante
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'day',
          periodValue,
          userId: null
        });
        if (!stat) {
          const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Stats précédente (semaine précédente, même jour)
        const prevDay = new Date(day.getTime() - 7 * 24 * 60 * 60 * 1000);
        const prevPeriodValue = prevDay.toISOString().slice(0, 10);
        prevLabels.push(prevDay.toLocaleDateString());
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'day',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate());
          const prevEnd = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate() + 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Cette semaine';
      chartPrevLabel = 'Semaine précédente';
      chartTitle = 'Évolution des invitations cette semaine';
      console.log('[STATS] Labels/données semaine générés:', labels, data, prevLabels, prevData);
    } else if (periode === 'mois') {
      // 30 derniers jours
      for (let i = 29; i >= 0; i--) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const periodValue = day.toISOString().slice(0, 10);
        labels.push(day.toLocaleDateString());
        // Stats courante
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'day',
          periodValue,
          userId: null
        });
        if (!stat) {
          const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Stats précédente (mois précédent, même jour)
        const prevDay = new Date(day.getTime() - 30 * 24 * 60 * 60 * 1000);
        const prevPeriodValue = prevDay.toISOString().slice(0, 10);
        prevLabels.push(prevDay.toLocaleDateString());
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'day',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate());
          const prevEnd = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate() + 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Ce mois';
      chartPrevLabel = 'Mois précédent';
      chartTitle = 'Évolution des invitations ce mois';
      console.log('[STATS] Labels/données mois générés:', labels, data, prevLabels, prevData);
    } else if (periode === 'annee') {
      // 12 derniers mois
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const periodValue = date.toISOString().slice(0, 7);
        labels.push(date.toLocaleString('default', { month: 'short', year: '2-digit' }));
        // Stats courante (mois)
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'month',
          periodValue,
          userId: null
        });
        if (!stat) {
          const start = new Date(date.getFullYear(), date.getMonth(), 1);
          const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Stats précédente (année précédente, même mois)
        const prevDate = new Date(date.getFullYear() - 1, date.getMonth(), 1);
        const prevPeriodValue = prevDate.toISOString().slice(0, 7);
        prevLabels.push(prevDate.toLocaleString('default', { month: 'short', year: '2-digit' }));
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'month',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1);
          const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Cette année';
      chartPrevLabel = 'Année précédente';
      chartTitle = 'Évolution des invitations cette année';
      console.log('[STATS] Labels/données annee générés:', labels, data, prevLabels, prevData);
    
      // 7 derniers jours
      const days = 7;
      for (let i = days - 1; i >= 0; i--) {
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const periodValue = day.toISOString().slice(0, 10);
        labels.push(day.toLocaleDateString());
        // Stats courante
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'day',
          periodValue,
          userId: null
        });
        if (!stat) {
          // fallback InviteLog
          const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
          const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Stats précédente
        const prevDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i - days);
        const prevPeriodValue = prevDay.toISOString().slice(0, 10);
        prevLabels.push(prevDay.toLocaleDateString());
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'day',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate());
          const prevEnd = new Date(prevDay.getFullYear(), prevDay.getMonth(), prevDay.getDate() + 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Cette période';
      chartPrevLabel = 'Période précédente';
      chartTitle = 'Évolution des invitations cette semaine';
    } else if (periode === 'mois') {
      // 12 derniers mois
      const months = 12;
      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const periodValue = date.toISOString().slice(0, 7);
        labels.push(date.toLocaleString('default', { month: 'short', year: '2-digit' }));
        // Stats courante
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'month',
          periodValue,
          userId: null
        });
        if (!stat) {
          const start = new Date(date.getFullYear(), date.getMonth(), 1);
          const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Mois précédent
        const prevDate = new Date(now.getFullYear(), now.getMonth() - i - months, 1);
        const prevPeriodValue = prevDate.toISOString().slice(0, 7);
        prevLabels.push(prevDate.toLocaleString('default', { month: 'short', year: '2-digit' }));
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'month',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevDate.getFullYear(), prevDate.getMonth(), 1);
          const prevEnd = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Cette période';
      chartPrevLabel = 'Période précédente';
      chartTitle = 'Évolution des invitations cette année';
    } else if (periode === 'annee') {
      // 5 dernières années
      const years = 5;
      for (let i = years - 1; i >= 0; i--) {
        const year = now.getFullYear() - i;
        const periodValue = year.toString();
        labels.push(year.toString());
        // Stats courante
        let stat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'year',
          periodValue,
          userId: null
        });
        if (!stat) {
          const start = new Date(year, 0, 1);
          const end = new Date(year + 1, 0, 1);
          stat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: start, $lt: end } }) };
        }
        data.push(stat.count);
        // Année précédente
        const prevYear = year - years;
        const prevPeriodValue = prevYear.toString();
        prevLabels.push(prevYear.toString());
        let prevStat = await StatsHistory.findOne({
          guildId: interaction.guild.id,
          periodType: 'year',
          periodValue: prevPeriodValue,
          userId: null
        });
        if (!prevStat) {
          const prevStart = new Date(prevYear, 0, 1);
          const prevEnd = new Date(prevYear + 1, 0, 1);
          prevStat = { count: await InviteLog.countDocuments({ guildId: interaction.guild.id, timestamp: { $gte: prevStart, $lt: prevEnd } }) };
        }
        prevData.push(prevStat.count);
      }
      chartLabel = 'Cette période';
      chartPrevLabel = 'Période précédente';
      chartTitle = 'Évolution des invitations sur 5 ans';
    }
    // Vérifie s'il y a au moins une donnée non nulle
    const totalData = data.reduce((a, b) => a + b, 0);
    const totalPrev = prevData.reduce((a, b) => a + b, 0);
    if (totalData === 0 && totalPrev === 0) {
      return interaction.editReply({ content: 'Aucune donnée d\'invitation disponible pour cette période.', ephemeral: true });
    }
    // S'assure que les deux courbes font la même taille
    while (prevData.length < data.length) prevData.unshift(0);
    while (data.length < prevData.length) data.unshift(0);
    // --- Génération du graphique PNG avec Plotly.js ---
    try {
      const imgPath = await generatePlotlyGraph(labels, data, prevData, chartTitle);
      if (!imgPath) {
        console.error('[STATS][PLOTLY] Erreur : generatePlotlyGraph a retourné null ou n/a');
        await interaction.editReply({ content: 'Erreur lors de la génération du graphique (fichier non généré).', ephemeral: true });
        return;
      }
      const file = {
        attachment: imgPath,
        name: 'stats-invites.png'
      };
      await interaction.editReply({
        embeds: [
          {
            title: chartTitle,
            description: `Bleu = ${chartLabel} | Rouge = ${chartPrevLabel}`,
            image: { url: 'attachment://stats-invites.png' },
            color: 0x181c20
          }
        ],
        files: [file]
      });
      // Nettoyage du fichier temporaire
      setTimeout(() => { try { fs.unlinkSync(imgPath); } catch(e){ console.error('[STATS][CLEANUP] Erreur suppression fichier PNG:', e); } }, 10000);
    } catch (err) {
      console.error('[STATS][PLOTLY] Erreur génération graphique (exception) :', err);
      await interaction.editReply({ content: 'Erreur lors de la génération du graphique (exception).', ephemeral: true });
    }
    return;
  }
};