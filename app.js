'use strict';
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');

const listener = new TwitchListener(config);

// Listen to the user follow webhook event
listener.on('follow', (data) => {
  // Do stuff with follow data
  console.log(data);
});

// Listen to the user stream change webhook event
listener.on('changeStream', (data) => {
  // Do stuff with stream data
  console.log(data);
});

// Listen to the user profile change webhook event
listener.on('changeProfile', (data) => {
  // Do stuff with profile data
  console.log(data);
});

// Start the application
listener.launch();
