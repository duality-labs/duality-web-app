import fs from 'fs';
import morphTS from './generated-files-morph.mjs';

/**
 * @param {string} directory
 * @param {{ recursive: boolean }} opts
 */
function getDirFilenames(directory, opts = {}) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .reduce((result, file) => {
      const path = `${directory}/${file.name}`;
      if (opts.recursive && file.isDirectory()) {
        result.push(...getDirFilenames(path, opts));
      } else {
        result.push(path);
      }
      return result;
    }, []);
}

let files = getDirFilenames('./src/lib/web3/generated', { recursive: true });

// remove unused module type generations (reduce git line changes)
files
  .filter((file) => file.match(/\/ts-client\/(\w+\.)+\w+\//))
  .filter(
    (file) =>
      !(
        file.includes('/ts-client/cosmos.bank.v1beta1/') ||
        file.includes('/ts-client/nicholasdotsol.duality.dex/')
      )
  )
  .forEach((file) => {
    fs.rmSync(file);
  });

// recheck file list
files = getDirFilenames('./src/lib/web3/generated', { recursive: true });

// fix implicit 'any' errors
files
  .filter((file) => file.endsWith('/ts-client/helpers.ts'))
  .forEach((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      .replace(
        'function getStructure(template)',
        'function getStructure(template: any)'
      );
    fs.writeFileSync(file, replaced);
  });
files
  .filter((file) => file.endsWith('/module.ts'))
  .forEach((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      .replace('(signer) => {', '(signer: any) => {');
    fs.writeFileSync(file, replaced);
  });

// fix "Type 'undefined' is not assignable to type " errors
files
  .filter((file) => file.endsWith('/ts-client/client.ts'))
  .forEach((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      .replace('signer?: OfflineSigner', 'signer: OfflineSigner');
    fs.writeFileSync(file, replaced);
  });

// do TypeScript AST manipulations
await morphTS();

// fix other "compiled with problems" errors
files
  .filter((file) => file.endsWith('/module.ts'))
  .forEach((file) => {
    const original = fs.readFileSync(file, { encoding: 'utf8' });
    // find an Api method to use as a definite type instead of an "implcit any"
    const firstApiMethod =
      original.match(
        /const txClient .*? return {\s+(?:async )?(\w+)\(/s
      )?.[1] || '';
    const replaced = original
      // Property 'tx' has no initializer and is not definitely assigned in the constructor.
      .replace(
        'public tx: ReturnType<typeof txClient>',
        'public tx!: ReturnType<typeof txClient>'
      )
      .replace(/\[m\]/g, `[m as '${firstApiMethod}']`);
    fs.writeFileSync(file, replaced);
  });

// todo: fix ts-client generation:
//   remove root client `useKeplr` method: it unfortunately attempts to import
//   "./cosmos.staking.v1beta1/module" which was not autogenerated in the
//   `ignite generate ts-client` process for some reason.
//   if we can resolve this issue we can then use the `useKelpr` method
files
  .filter((file) => file.endsWith('/ts-client/client.ts'))
  .forEach((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      // .replace(/async useKeplr/s, 'useKaplr')
      .replace(/async useKeplr.*}/s, '}');
    fs.writeFileSync(file, replaced);
  });
