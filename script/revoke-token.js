'use strict';
const TwitchListener = require('../src/TwitchListener.js');
const config = require('../config/config.js');

const TL = new TwitchListener(config)
const token = TL.readAccessToken();
if ( token ) {
  TL.revokeAccessToken(token)
  .catch(err => console.error(err));
}
