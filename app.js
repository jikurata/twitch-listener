'use strict';
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');

const server = new TwitchListener(config);
server.launch(config.port || 3000)
.catch(err => console.error(err));

server.on('follow', (data) => {
  console.log(data);
});
