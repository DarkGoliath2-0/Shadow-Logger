// Génère un graphique PNG avec Plotly.js (historique rouge, actuel bleu)
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import nodeHtmlToImage from 'node-html-to-image';

/**
 * Génère un graphique PNG avec Plotly (API cloud)
 * @param {Array<string>} labels - Labels X (dates)
 * @param {Array<number>} currentData - Données période actuelle
 * @param {Array<number>} prevData - Données période historique
 * @param {string} title - Titre du graphique
 * @param {Array<string>} [prevLabels=null] - Labels X historiques (même taille que labels)
 * @returns {Promise<string>} - Chemin du fichier PNG généré
 */
async function generatePlotlyGraph(labels, currentData, prevData, title = 'Évolution des invitations', prevLabels = null) {
  try {
  // Si prevLabels fourni, construit un axe multicategory
  let multiLabels = labels;
  if (prevLabels && prevLabels.length === labels.length) {
    multiLabels = labels.map((label, i) => [prevLabels[i], label]);
  }
  const figure = {
    data: [
      {
        x: multiLabels,
        y: currentData,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Période actuelle',
        line: { color: 'rgba(54, 162, 235, 1)', width: 3 },
        marker: { color: 'rgba(54, 162, 235, 1)', size: 7 }
      },
      {
        x: multiLabels,
        y: prevData,
        type: 'scatter',
        mode: 'lines+markers',
        name: 'Période précédente',
        line: { color: 'rgba(255, 99, 132, 1)', width: 3, dash: 'dash' },
        marker: { color: 'rgba(255, 99, 132, 1)', size: 7 }
      }
    ],
    layout: {
      title,
      autosize: false,
      width: 800,
      height: 400,
      margin: { l: 40, r: 20, t: 60, b: 50 },
      paper_bgcolor: '#181c20',
      plot_bgcolor: '#181c20',
      font: { color: '#fff' },
      xaxis: {
        gridcolor: '#444',
        type: prevLabels ? 'multicategory' : 'category',
        tickfont: { color: '#fff' }
      },
      yaxis: { gridcolor: '#444' },
      legend: { font: { color: '#fff' } }
    }
  };

  // Génère le HTML Plotly
  const width = 1200;
  const height = 600;
  const html = `
    <html>
      <head>
        <meta charset='utf-8'>
        <style>
          html, body {
            margin: 0;
            padding: 0;
            width: 1200px;
            height: 600px;
            background: #181c20;
            overflow: hidden;
          }
          #plot {
            width: 1200px;
            height: 600px;
            background: #181c20;
          }
        </style>
        <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
      </head>
      <body>
        <div id="plot"></div>
        <script>
          // multiLabels est injecté côté navigateur
          const multiLabels = ${JSON.stringify(multiLabels)};
          // Génère dynamiquement les annotations pour chaque date
          const annotations = [];
          const n = multiLabels.length;
          for (let i = 0; i < n; i++) {
            if (Array.isArray(multiLabels[i]) && multiLabels[i].length === 2) {
              // Date historique (haut)
              annotations.push({
                xref: 'x', yref: 'paper',
                x: i, y: 1.08,
                text: multiLabels[i][0],
                showarrow: false,
                font: { color: 'rgba(255,99,132,1)', size: 14 }
              });
              // Date actuelle (bas)
              annotations.push({
                xref: 'x', yref: 'paper',
                x: i, y: -0.18,
                text: multiLabels[i][1],
                showarrow: false,
                font: { color: 'rgba(54,162,235,1)', size: 14 }
              });
            }
          }
          Plotly.newPlot('plot', ${JSON.stringify(figure.data)}, {
            ...${JSON.stringify(figure.layout)},
            width: 1200,
            height: 600,
            autosize: false,
            margin: { l: 40, r: 20, t: 90, b: 80 },
            paper_bgcolor: '#181c20',
            plot_bgcolor: '#181c20',
            annotations: annotations
          }, {displayModeBar: false});
        </script>
      </body>
    </html>
  `;
// IMPORTANT : Après avoir envoyé l'image sur Discord, supprime le PNG avec fs.unlink pour éviter d'envoyer le même fichier ou d'encombrer le dossier temp.


  // Utilise le chemin absolu du conteneur Pterodactyl pour temp
  const tempDir = '/home/container/temp';
  await fs.promises.mkdir(tempDir, { recursive: true });
  // Donne les permissions maximales (lecture/écriture pour tous)
  try {
    await fs.promises.chmod(tempDir, 0o777);
  } catch (e) {
    console.warn('[PlotlyGraph] Impossible de modifier les permissions du dossier temp:', e);
  }
  const outPath = path.join(tempDir, `plotly_${uuidv4()}.png`);

  await nodeHtmlToImage({
    output: outPath,
    html,
    content: {},
    waitUntil: 'networkidle0',
    puppeteerArgs: { args: ['--no-sandbox'] },
    viewport: { width, height }
  });
  return outPath;
  
} catch (err) {
  console.error('[PlotlyGraph] Erreur lors de la génération du graphique :', err);
  return null;
}
}

export { generatePlotlyGraph };
