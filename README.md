# duality-web-app

The code for the Duality front-end web app.

## Setting up the dev environment

To set up the front end locally, connected to the current online testnet:

1. `$ npm install`
2. `$ npm start`
3. The dev site should become available at http://localhost:3000
4. Install/enable [the Keplr extension](https://github.com/chainapsis/keplr-wallet)
   on your browser
5. when you visit/refresh http://localhost:3000, allow the site to connect to
   the Duality testnet chain through Keplr prompt window that should appear
6. Select the Duality testnet chain on your Keplr extension
7. Add/select a valid Cosmos account on Keplr
8. If your account on Keplr has a bank balance on the Duality chain
   you will see that bank balance represented on your Keplr extension

### Connecting to a local backend with Docker Compose

Note: the Docker Compose setup files for this setup process exist in PR
https://github.com/duality-labs/duality/pull/53 and may not yet be merged in.
You can merge these changes into main locally to use them

1. Clone the Duality Cosmos repository: https://github.com/duality-labs/duality
   alongside this repository: (eg. to ../duality)
2. Use Docker Compose to run a local testnet

   - `$ docker-compose up --build` (for 1 leader, 4 follower and 1 test nodes) or
   - `$ docker-compose up --build dualityleader` (to start only the lead node) or
   - `$ docker-compose up --build dualityleader dualitynode0` (for 2 nodes) or
   - `$ docker-compose up --build --scale dualitytester=0` (for 5 nodes)

   the local testnet should be accessible at the ports specified in the
   docker-compose.yml file (eg. http://localhost:26657)

3. Edit your own .env.development.local file to change the backend ENV vars

   - `REACT_APP__REST_API=http://localhost:1317`
   - `REACT_APP__RPC_API=http://localhost:26657`
   - `REACT_APP__WEBSOCKET_URL=ws://localhost:26657/websocket`

   or similar (each node runs in a Docker container with its own unique ports)

4. Start/restart your development server to use these new ENV vars:

   - `npm start`

   your development should now be making requests to your local backend

## Deployed At

Current build preview should be available at https://graceful-palmier-ff28ba.netlify.app/
