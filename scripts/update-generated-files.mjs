import fs from 'fs';

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

const files = getDirFilenames('./src/lib/web3/generated', { recursive: true });

// fix ESLint and TypeScript warnings
files
  .filter((file) => file.endsWith('/index.ts'))
  .map((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      .replace('/* eslint-disable */', '')
      .replace('/* tslint:disable */', '')
      .trimStart();
    fs.writeFileSync(file, replaced);
    return file;
  })
  .forEach((file) => {
    const data = fs.readFileSync(file, { encoding: 'utf8' });
    fs.writeFileSync(
      file,
      `
/* eslint-disable */
/* tslint:disable */
${data}`.trimStart()
    );
  });

// fix TypeScript error
files
  .filter((file) => file.endsWith('/index.ts'))
  .forEach((file) => {
    const data = fs.readFileSync(file, { encoding: 'utf8' });
    const get = `
  let client;
  if (addr) {
    client = await SigningStargateClient.connectWithSigner(addr, wallet, { registry });
  }else{
    client = await SigningStargateClient.offline( wallet, { registry });
  }
`;
    const set = `
  const client = addr
    ? await SigningStargateClient.connectWithSigner(addr, wallet, { registry })
    : await SigningStargateClient.offline( wallet, { registry });
`;
    const replaced = data.replace(get, set);
    fs.writeFileSync(file, replaced);
  });

// fix hardcoded URLs
files
  .filter((file) => file.endsWith('/index.ts'))
  .forEach((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      .replace(
        '"http://localhost:26657"',
        'process.env.REACT_APP__RPC_API || ""'
      )
      .replace(
        '"http://localhost:1317"',
        'process.env.REACT_APP__REST_API || ""'
      );
    fs.writeFileSync(file, replaced);
  });

// fix odd generated comparisons
files
  .filter((file) => file.endsWith('.ts'))
  .forEach((file) => {
    const replaced = fs
      .readFileSync(file, { encoding: 'utf8' })
      .replace('(util.Long !== Long)', '(true)');
    fs.writeFileSync(file, replaced);
  });

// remove non-module index files (eg. vuex index.ts files)
files
  .filter(
    (file) => file.endsWith('/index.ts') && !file.endsWith('/module/index.ts')
  )
  .forEach((file) => {
    fs.rmSync(file);
  });

// remove vuex-root files
files
  .filter((file) => file.endsWith('/vuex-root'))
  .forEach((file) => {
    fs.rmSync(file);
  });
