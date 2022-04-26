# duality-web-app

The code for the Duality front-end web app.

## Setting up the dev environment

1. `$ npm install`
2. Clone the contracts repository alongside this repository. 
3. `$ cd path/to/duality && npm install`
4. `$ npx hardhat node` (this will start a local testnet)
5. Open a new terminal session, and cd back to the contracts repository
6. `$ npx hardhat run scripts/deployTestEnv.ts` This will deploy contracts and set up some sample trading pairs. Note down the deployed addresses the command outputs.
7. `npx hardhat run scripts/simulateTrades.ts`
   1. Select a signer by entering a number from 0-2 when prompted.
   2. Enter contract addresses as output from the deploy command
   3. You can run as many instances of this command as you'd like to simulate multiple traders
8. `$ cd path/to/duality-web-app`
9. Copy `.env.template` to `.env` and change the variables to match the output contract addresses
   1. The chain ID for your local hardhat testnet is `31337`.
10. `$ npm start` 
11. Dev site is available at `http://localhost:3000`