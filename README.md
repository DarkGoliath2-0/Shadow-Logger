# Bot Logger Discord

Bot Logger Discord est un bot open source permettant de logger et comptabiliser les invitations sur un serveur Discord. Il s’appuie sur [discord.js](https://discord.js.org/) et [mongoose](https://mongoosejs.com/) pour la gestion des données. Ce projet vise à être simple à déployer, facile à personnaliser, et à fournir une base solide pour tous les serveurs souhaitant suivre efficacement les invitations.

## Fonctionnalités principales

- Comptabilise précisément les invitations Discord (même en cas de suppression de lien ou de départ/rejoin).
- Envoie un message personnalisé à chaque arrivée, avec variables dynamiques.
- Statistiques d’invitation par utilisateur.
- Commandes slash pour consulter les stats.
- Système modulaire et facilement extensible.

## Prérequis

- Node.js v24
- Un bot Discord enregistré ([voir documentation officielle](https://discord.com/developers/applications))
- Une base MongoDB (ex : MongoDB Atlas)

## Installation rapide

### 0. **Préparation de l'environnement Pterodactyl (ou autre panel Docker compatible)**
1. **Uploader l'egg fourni**
   - Rendez-vous dans le dossier `egg` du projet et récupérez le fichier `egg-node-js-peperteer.json`.
   - Importez cet egg sur votre panel (ex : Pterodactyl) via la section "Nests/Eggs".
2. **Créez un serveur à partir de cet egg**
   - Lors de la création du serveur, sélectionnez l'egg importé.
   - Configurez les ressources nécessaires (RAM, stockage, etc.) selon vos besoins.
3. **Continuez ensuite avec les étapes ci-dessous pour installer le code et effectuer les paramétrages.**


1. **Décompressez l'archive du bot**
   - L'archive contient déjà tous les fichiers nécessaires au fonctionnement du bot, il n'est donc pas nécessaire de cloner un dépôt Git.
   - Placez l'ensemble des fichiers sur votre serveur (ex : via SFTP ou gestionnaire de fichiers du panel).

2. **Complétez le fichier `.env`**
   - Le fichier `.env` est déjà présent dans l'archive.
   - Ouvrez-le et renseignez les informations suivantes :
   ```env
   DISCORD_TOKEN=VotreTokenDiscord
   MONGODB_URI=VotreURI_MongoDB
   CLIENT_ID=VotreClientID
   GUILD_ID=VotreGuildID
   MESSAGE_TEMPLATE=Bienvenue {newMember} ! Merci à {referrer} pour l’invitation ({count} filleuls)
   ```
   **Variables disponibles dans le message personnalisé :**
   - `{referrer}` : le parrain
   - `{newMember}` : le nouveau membre
   - `{count}` : nombre total de filleuls du parrain

3. **Modifiez le fichier `config.json`**
   Ce fichier est essentiel pour définir :
   - **ownerIds** : la liste des IDs Discord autorisés à utiliser les commandes d’administration (`/config`, `/synchro`, `/stats`).
   - **channelId** : l’ID du salon où seront envoyés les logs de suppression lorsqu’un membre quitte le serveur.

   Exemple de structure :
   ```json
   {
     "ownerIds": ["123456789012345678", "987654321098765432"],
     "logLogger": "123456789012345678"
   }
   ```
   > ⚠️ **Ce paramétrage est requis pour que les commandes avancées et les logs fonctionnent correctement.**

4. **Premier démarrage et installation automatique des dépendances**

   > Tous les modules nécessaires sont listés dans `package.json` et seront automatiquement installés lors du premier démarrage (y compris sur Pterodactyl).

## Structure du projet

- `index.js` : point d’entrée principal du bot
- `.env` : configuration des variables d’environnement (non versionné)
- `package.json` : liste des dépendances et scripts Node.js
- `config.json` : configuration additionnelle (owners, logs)
- `commands/` : commandes slash (statistiques, synchronisation, etc.)
- `events/` : gestion des événements Discord (arrivée, départ, création/suppression d’invites...)
- `handlers/` : chargement dynamique (événements, commandes, déploiement)
- `models/` : schémas Mongoose pour la BDD

## Ordre d’utilisation recommandé et fonctionnement des commandes

Pour une prise en main optimale du bot, suivez cet ordre et lisez le détail des commandes :

### 1. `/config` — Configuration du bot
Permet de configurer le bot pour le serveur Discord. **Seuls les administrateurs (ou les IDs définis dans `config.json`) peuvent l’utiliser.**
- **Options disponibles** :
  - `enabled` : activer/désactiver le logger d’invitations.
  - `channel` : choisir le salon où seront envoyés les logs d’invitations.
  - `message` : définir un message d’accueil personnalisé (placeholders : `{referrer}`, `{newMember}`, `{count}`).
    - Si ce champ n’est pas renseigné, **un message par défaut (défini dans le `.env`) sera automatiquement utilisé** pour garantir une présentation correcte à chaque arrivée.
- **À utiliser en premier** pour initialiser ou modifier la configuration du bot.

### 2. `/synchro` — Synchronisation des invitations
Synchronise toutes les invitations existantes du serveur avec la base de données du bot. **Seuls les administrateurs (ou les IDs définis dans `config.json`) peuvent l’utiliser.**
- À utiliser juste après la configuration ou après toute modification manuelle des invitations sur le serveur.
- Permet de garantir que les statistiques du bot reflètent la réalité du serveur.

### 3. `/stats` — Statistiques des invitations
Permet de consulter les statistiques détaillées des invitations. **Seuls les administrateurs (ou les IDs définis dans `config.json`) peuvent utiliser ces commandes.**
- `/stats list [user]` : affiche le nombre d’invitations pour un utilisateur donné ou pour tous les membres si aucun utilisateur n’est précisé.
- `/stats graph [période]` : affiche un graphique des invitations sur une période donnée (jour, semaine, mois, année).

> **Astuce** : Après chaque modification majeure (ex : ajout d’invites manuelles, réinitialisation), pensez à relancer `/synchro` pour garder des stats fiables.

---

**Exemple d’utilisation :**
- `/config enabled:true channel:#logs message:"Bienvenue {newMember} ! Merci à {referrer} ({count} filleuls)"`
- `/synchro`
- `/stats list`
- `/stats graph periode:mois`

## Exemples d’utilisation

- **Message d’arrivée personnalisé**
  > "Bienvenue {newMember} ! Merci à {referrer} pour l’invitation. Il a désormais {count} filleuls."

- **Commandes slash**
  - `/stats` : affiche le classement des parrains
  - `/synchro` : synchronise les invitations (admin)

## Bonnes pratiques & Sécurité

- **Ne partagez jamais votre vrai fichier `.env`** (token Discord et URI MongoDB sont sensibles !)
- Ajoutez `.env` à votre `.gitignore`.
- Privilégiez un bot Discord avec permissions minimales (voir [permissions calculator](https://discordapi.com/permissions.html)).
- Utilisez MongoDB Atlas pour un hébergement sécurisé et gratuit.

## Contribution

Les contributions sont les bienvenues !
- Ouvrez une issue pour suggérer une fonctionnalité ou signaler un bug.
- Forkez le projet, créez une branche, proposez une pull request.
- Respectez la structure du projet et commentez votre code.

## Licence

Ce projet est publié sous licence MIT.

## Remerciements

Merci à tous les contributeurs de la communauté Discord.js et open source !

---

*Made with ❤️ by ShadowHeberg*
