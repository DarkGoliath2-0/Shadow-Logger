import { readdirSync } from 'fs';
import path from 'path';

export default (client) => {
  client.commands = new Map();
  const commandsPath = path.resolve('./commands');
  for (const file of readdirSync(commandsPath)) {
    if (!file.endsWith('.js')) continue;
    import(`../commands/${file}`).then((cmd) => {
      if (cmd.data && cmd.execute) {
        client.commands.set(cmd.data.name, cmd);
      }
    });
  }
};
