import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Asset, Chain } from '@chain-registry/types';

import tknLogo from '../../assets/tokens/TKN.svg';
import stkLogo from '../../assets/tokens/STK.svg';

const {
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
} = process.env;

// filter to only those with real address and chain
interface Token extends Asset {
  address: string;
  chain: Chain;
}
type TokenList = Array<Token>;

const dualityChain = {
  chain_name: REACT_APP__CHAIN_NAME,
  status: 'upcoming',
  network_type: 'testnet',
  pretty_name: 'Duality Chain',
  chain_id: REACT_APP__CHAIN_ID,
  bech32_prefix: 'cosmos',
  slip44: 330,
};

const dualityMainToken: Token = {
  description: 'SDK default token',
  address: 'token',
  denom_units: [
    {
      denom: 'token',
      exponent: 18,
      aliases: ['dual'],
    },
  ],
  base: 'sdk.coin:token',
  name: 'Duality',
  display: 'duality',
  symbol: 'TKN',
  logo_URIs: {
    svg: tknLogo,
  },
  chain: dualityChain,
};

const dualityStakeToken: Token = {
  description: 'SDK default token',
  address: 'stake',
  denom_units: [
    {
      denom: 'stake',
      exponent: 18,
      aliases: ['dualstake'],
    },
  ],
  base: 'sdk.coin:stake',
  name: 'Duality Stake',
  display: 'duality-stake',
  symbol: 'STK',
  logo_URIs: {
    svg: stkLogo,
  },
  chain: dualityChain,
};

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function getTokens(condition: (chain: Chain) => boolean) {
  // go through each chain
  return (
    assets
      .reduce<TokenList>((result, { chain_name, assets }) => {
        // add each asset with the parent chain details
        const chain = chains.find((chain) => chain.chain_name === chain_name);
        return chain && condition(chain)
          ? result.concat(
              assets.flatMap(
                // ensure only existing address tokens are added
                (asset) =>
                  asset.address
                    ? { ...asset, address: asset.address, chain }
                    : []
              )
            )
          : result;
      }, [])
      // add Duality chain tokens
      .concat([dualityMainToken, dualityStakeToken])
  );
}

const tokenListCache: {
  [key: string]: TokenList;
} = {};

const allTokens = () => true;
export function useTokens(sortFunction = defaultSort) {
  tokenListCache['allTokens'] =
    tokenListCache['allTokens'] || getTokens(allTokens);
  return useMemo(
    () => tokenListCache['allTokens'].slice().sort(sortFunction),
    [sortFunction]
  );
}

const mainnetTokens = (chain: Chain) => chain?.network_type === 'mainnet';
export function useMainnetTokens(sortFunction = defaultSort) {
  tokenListCache['mainnetTokens'] =
    tokenListCache['mainnetTokens'] || getTokens(mainnetTokens);
  return useMemo(
    () => tokenListCache['mainnetTokens'].slice().sort(sortFunction),
    [sortFunction]
  );
}

function defaultSort(a: Token, b: Token) {
  // compare by symbol name
  return a.symbol.localeCompare(b.symbol);
}
