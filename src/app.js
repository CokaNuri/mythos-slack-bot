require('dotenv').config();
const http = require('http');
const { App } = require('@slack/bolt');
const { handleAppMention } = require('./mentionHandler');

process.on('unhandledRejection', (err) => {
  console.error('unhandledRejection:', err);
});

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true,
});

app.event('app_mention', handleAppMention);

(async () => {
  await app.start();
  console.log('mythos-slack bot is running (socket mode)');
  http.createServer((_, res) => res.end('ok')).listen(8080);
})();
