# Dockerfile personnalisé Node.js 24 + Puppeteer/Plotly compatible Pterodactyl
FROM node:24

# Installation des librairies nécessaires à Chromium/Puppeteer
RUN apt-get update && apt-get install -y \
    wget ca-certificates fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 \
    libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils libpangocairo-1.0-0 libpangoft2-1.0-0 libxshmfence1 \
    libxss1 libxtst6 --no-install-recommends && rm -rf /var/lib/apt/lists/*

WORKDIR /home/container

# (Optionnel) Copie et installation des dépendances Node.js si build local
# COPY . .
# RUN npm install --production

# Commande par défaut (Pterodactyl la remplacera au runtime)
CMD ["node", "index.js"]
