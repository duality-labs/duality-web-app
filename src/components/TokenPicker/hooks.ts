import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Asset, Chain } from '@chain-registry/types';

interface Token extends Asset {
  chain: Chain;
}
type TokenList = Array<Token>;

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function getTokens(condition: (chain: Chain) => boolean) {
  // go through each chain
  return assets.reduce<TokenList>((result, { chain_name, assets }) => {
    // add each asset with the parent chain details
    const chain = chains.find((chain) => chain.chain_name === chain_name);
    return chain && condition(chain)
      ? result.concat(assets.map((asset) => ({ ...asset, chain })))
      : result;
  }, []);
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
