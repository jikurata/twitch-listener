'use strict';
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');

const server = new TwitchListener(config);

server.on('follow', (data) => {
  console.log(data);
});

server.launch();
