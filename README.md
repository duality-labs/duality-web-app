# duality-web-app

The code for the Duality front-end web app.

This version of the front end is intended to work with this release of the backend:

- https://github.com/duality-labs/duality/releases/tag/v0.1.0
- run with Docker:
  - checkout [35cdba3](https://github.com/duality-labs/duality/commit/35cdba33e71742d213c3f873a08fe5e46b5ec493) (tag [v0.1.0](https://github.com/duality-labs/duality/releases/tag/v0.1.0))
  - cherry-pick [c0a4196](https://github.com/duality-labs/duality/commit/c0a419600d5920c58f68822f932afb5857ebe45f) Dockerized Setup
- run with Docker Compose:
  - checkout [cee44d7](https://github.com/duality-labs/duality/commit/cee44d7cf9d079ad2302d2ffb6a9a67847aa0e10) part of Docker Compose setup

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

   You can also use one of the MNENOMIC env vars in the Docker Compose file
   to add a new Keplr account (select "Import existing account") for local
   development

4. Start/restart your development server to use these new ENV vars:

   - `npm start`

   your development should now be making requests to your local backend

The current backend repository commit to use for any branch in the frontend
should be defined in the file:
[src/lib/web3/generated/readme.md](https://github.com/duality-labs/duality-web-app/tree/main/src/lib/web3/generated/readme.md),
which describes the state at which the generated API files were made.

## Generated API types

The frontend connects to the backend through the backend API.
We use `$ ignite generate` (also called in `$ ignite chain serve`)
in the [Ignite CLI](https://docs.ignite.com/cli#ignite-generate)
in the backend to auto-generate TypeScript types that help define the shape
of the API for the frontend code base. These files exist at
[src/lib/web3/generated](https://github.com/duality-labs/duality-web-app/tree/main/src/lib/web3/generated/)

Instructions on how to update these generated types should exist at
[src/lib/web3/generated/readme.md](https://github.com/duality-labs/duality-web-app/tree/main/src/lib/web3/generated/readme.md)

## Deployed At

Current build preview should be available at https://graceful-palmier-ff28ba.netlify.app/
