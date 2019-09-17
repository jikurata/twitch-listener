#TwitchListener v0.0.0
---
Create and listen to Twtich webhooks
## Usage
---
```
const TwitchListener = require('./src/TwitchListener.js');
const config = require('./config/config.js');

const listener = new TwitchListener(config);

// Listen to the user follow webhook event
listener.on('follow', (data) => {
    // Do stuff with follow data
});

// Listen to the user stream change webhook event
listener.on('changeStream', (data) => {
    // Do stuff with stream data
});

// Listen to the user profile change webhook event
listener.on('changeProfile', (data) => {
    // Do stuff with profile data
});

// Start the application
listener.launch();
```
## Setup
---
1. Download this repo
2. In the root of the project folder, where package.json is located, install the dependencies
```
npm install
```
3. Create and register a client application through the Twitch console (More information below)
4. Create a .env file
    - NODE_ENV: Project environment (development, production, etc)
    - TWITCH_USERNAME: Your twitch username
    - CLIENT_ID: Your registered application id (More details below)
    - CLIENT_SECRET: Your client application secret (More details below)
    - HUB_SECRET: An arbitrary value for signature encryption/decryption
    - PORT: Port for the server to listen to
    - TOKEN_PATH: A filepath to store a retrieved app access token
    - WEBHOOK_DURATION: Webhook subscription duration (Max 86400 seconds)
    - WEBHOOK_CALLBACK: Your server endpoint to receive Twitch webhook requests

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
5. Edit the event listeners in app.js as needed
6. To launch the server
```
npm run launch
```
## Registering a client application
---
If you do not already have a Twitch application to attach to this module, then follow these steps:
1. Login to https://dev.twitch.tv/ and go to https://dev.twitch.tv/console
2. In the navigation, go to the Applications tab.
3. Click on Register your Application
4. Give the application a unique name (It usually helps to append random numbers to the name)
5. This application currently only supprots Application Access Tokens, so an Oauth redirect url is not currently required
6. Select the appropriate category for your application.
7. Create.
8. If it does not automatically route you to the new application configuration, then go back to the Applications tab. You should now see your application in the list. Click Manage.
9. Retrieve the client id.
10. Click on New Secret. Retrieve the secret. Do not ever expose this to the public.
11. Store those two credentials in your .env file.

## Current Implementation
---
In the current version, I mistakenly developed the module around Application Access Tokens.
I found in hindsight, that these types of tokens are only useful for retrieving public information from Twitch's API. Therefore, only webhooks that access public information are currently supported. These are:
1. User follow events
2. User profile change events
3. User stream change events

In the next version, there will be User Access Token support, which allows the client application to access private data from an authorized user.

## Test
---
```
npm run test
```
