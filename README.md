# duality-web-app

The code for the Duality front-end web app.

This version of the front end is intended to work with the release of the backend that is noted in the [@duality-labs/neutronjs](https://www.npmjs.com/package/@duality-labs/neutronjs) dependency in package.json

## Setting up the dev environment

To set up the front end locally, connected to the current online testnet:

1. `$ npm install`
2. `$ npm run dev`
3. The dev site should become available at http://localhost:5173
4. Install/enable [the Keplr extension](https://github.com/chainapsis/keplr-wallet)
   on your browser
5. when you visit/refresh http://localhost:5173, allow the site to connect to
   the Duality testnet chain through Keplr prompt window that should appear
6. Select the Duality testnet chain on your Keplr extension
7. Add/select a valid Cosmos account on Keplr
8. If your account on Keplr has a bank balance on the Duality chain
   you will see that bank balance represented on your Keplr extension

### Connecting to a local backend with Docker Compose

1. Follow the instructions for [Neutron Cosmopark local development](https://docs.neutron.org/neutron/build-and-run/cosmopark/)
   to start a local environment with the Neutron chain and some chaines you can
   bridge to and from
2. The env vars for specific IBC denoms in local development should have
   examples in .env.development
3. Edit your own .env.development.local file to change the backend ENV vars
   (without adding changes to git because .local files are ignnored)

   - `REACT_APP__REST_API=http://localhost:1317`
   - `REACT_APP__RPC_API=http://localhost:26657`
   - `REACT_APP__WEBSOCKET_URL=ws://localhost:26657/websocket`

   match these endpoints to your locally running chain cluster to develop against it.

   You can also use one of the MNENOMIC env vars in the Docker Compose file
   to add a new Keplr account (select "Import existing account") for local
   development

4. Start/restart your development server to use these new ENV vars:

   - `npm run dev`

   your development should now be making requests to your local backend

## Generated API types

The frontend connects to the backend through the backend API.
We use TypeScript types and API client code generated from the backend repo
.proto files and the
[@osmonauts/telescope](https://www.npmjs.com/package/@osmonauts/telescope)
package to help define the shape of the API for the frontend code base.
These files exist at https://github.com/duality-labs/neutronjs

The current backend repository version to use with the frontend
should be defined in the package.json file: here the version number of the
https://github.com/duality-labs/neutronjs dependency should represent
the corresponding backend API version number to use, see
https://github.com/neutron-org/neutron/releases

## Deployed At

Current build of `main` should be available at https://app.testnet.duality.xyz
