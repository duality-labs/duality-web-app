import fs from 'fs';

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
  .forEach((file) => {
    const data = fs.readFileSync(file, { encoding: 'utf8' });
    fs.writeFileSync(
      file,
      `/* eslint-disable */\n/* tslint:disable */\n${data}`
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
