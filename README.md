#TwitchListener v0.0.0
Establish Twitch webhooks and subscribe TwitchListener events
## Setup
---
1. Download this repo
2. In the root of the project folder, where package.json is located, install the dependencies
```
npm install
```
3. Create a .env file
    - NODE_ENV: Project environment (development, production, etc)
    - TWITCH_USERNAME: Your twitch username
    - CLIENT_ID: Your registered application id (More details below)
    - CLIENT_SECRET: Your client application secret (More details below)
    - HUB_SECRET: An arbitrary value for signature encryption/decryption
    - PORT: Port for the server to listen to
    - TOKEN_PATH: A filepath to store a retrieved app access token
    - WEBHOOK_DURATION: Webhook subscription duration (Max 86400 seconds)
    - WEBHOOK_CALLBACK: Your server endpoint to receive Twitch requests

Example .env file:
```
NODE_ENV=production
TWITCH_USERNAME=iceerules
CLIENT_ID=a client id
CLIENT_SECRET=a client secret
HUB_SECRET=foobar
PORT=3000
TOKEN_PATH=cred.json
WEBHOOK_DURATION=86400
WEBHOOK_CALLBACK=http://127.0.0.1:3000/
```
4. To launch the server
```
npm run launch
```
##Usage
```
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');

const listener = new TwitchListener(config);

// Start the server
listener.launch()
.then() => {
    this.listenToFollow();
})


