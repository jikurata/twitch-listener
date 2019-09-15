'use strict';
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');
const server = new TwitchListener(config);
server.launch(config.port || 3000)
.then(() => server.requestAccessToken()) 
.then(token => server.requestActiveWebhooks())
.then(result => server.listenToProfileChange(60))
.catch(err => console.error(err));


server.requestUserInfo()
