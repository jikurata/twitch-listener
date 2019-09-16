'use strict';
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');
const server = new TwitchListener(config);
server.launch(config.port || 3000)
.then(() => server.followWebhook())
.then(() => {
  setInterval(() => {
    server.requestActiveWebhooks()
    .then((webhooks) => console.log(webhooks))
  }, 5000);
})
.catch(err => console.error(err));


server.requestUserInfo()
