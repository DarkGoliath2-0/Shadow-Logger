import { readdirSync } from 'fs';
import path from 'path';

export default (client) => {
  const eventsPath = path.resolve('./events');
  for (const file of readdirSync(eventsPath)) {
    if (!file.endsWith('.js')) continue;
    import(`../events/${file}`).then((eventModule) => {
      const event = eventModule.default;
      const once = eventModule.once || false;
      const eventName = file.split('.')[0];
      if (once) {
        client.once(eventName, (...args) => event(...args, client));
      } else {
        client.on(eventName, (...args) => event(...args, client));
      }
    });
  }
};
