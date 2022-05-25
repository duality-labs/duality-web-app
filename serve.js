/* eslint-disable no-console */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { spawn } = require('child_process');

/** @typedef {require('child_process')} ProcessDoc */

const path = process.argv[2] ?? '../duality';
const network = process.argv[3] ?? 'localhost';

(async function MainIIFE() {
    await run('npx hardhat node', { type: 'data-contains', text: 'Any funds sent to them on Mainnet or any other live network WILL BE LOST.' });
    const { result: testData } = await run(`npx hardhat run --network ${network} scripts/deployTestEnv.js`);
    const contractAddress = /DualityCore:\s*(0x[\da-f]+)/i.exec(testData)[1];
    const tokenAAdrress = /ALPHA:\s*(0x[\da-f]+)/i.exec(testData)[1];
    const tokenBAdrress = /USDC:\s*(0x[\da-f]+)/i.exec(testData)[1];
    const { oldSpawn } = await run(`npx hardhat run --network ${network} scripts/simulateTrades.js`, { type: 'data-contains', text: 'simulate trades with which signer?' });
    await run('0', { type: 'data' }, oldSpawn);
    await run(contractAddress, { type: 'data' }, oldSpawn);
    await run(tokenAAdrress, { type: 'data' }, oldSpawn);
    await run(tokenBAdrress, { type: 'data' }, oldSpawn);
})();

/**
 * Logs the events of the spawn object
 * @param {ProcessDoc.ChildProcessWithoutNullStreams} child spawn object
 * @returns {Promise<{ result: string }>} async log
 */
async function setUpConsole(child) {
    return new Promise(function (resolve, reject) {
        let result = '';
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', function (data) {
            console.log(data);
            result += data;
        });

        child.stderr.setEncoding('utf8');
        child.stderr.on('data', function (err) {
            console.error(err);
            reject(err);
        });

        child.on('close', function (code) {
            console.log('closing code: ' + code);
            resolve(result);
        });

        child.stdin.setDefaultEncoding('utf8');
    });
}

/**
 * Runs a command using a new spawn object or an old one
 * @param {string} command text to run
 * @param {{ type: 'end' | 'data' | 'data-contains', text?: string }} [returnCondition] when to return the result
 * @param {ProcessDoc.ChildProcessWithoutNullStreams} [oldSpawn] use old spawn object
 * @returns {Promise<{ oldSpawn: ProcessDoc.ChildProcessWithoutNullStreams, result: string }>} async spawn and result
 */
async function run(command, returnCondition, oldSpawn) {
    return new Promise(function (resolve) {
        let result = '', processing = true;
        if (!returnCondition) returnCondition = { type: 'end' };
        console.log(command);
        if (!oldSpawn) {
            oldSpawn = spawn(`cd ${path} && ${command}`, { shell: true });
            setUpConsole(oldSpawn);
        } else {
            oldSpawn.stdin.write(`${command}\n`);
        }
        oldSpawn.stdout.on('data', function (data) {
            if (!processing) return;
            result += data;
            if (returnCondition.type === 'data') onReady();
            else if (returnCondition.type === 'data-contains' && data.includes(returnCondition.text)) onReady();
        });
        if (returnCondition.type === 'end') oldSpawn.on('close', onReady);


        function onReady() {
            processing = false;
            resolve({ oldSpawn, result });
        }
    });
}