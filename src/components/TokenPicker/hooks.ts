import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Asset, Chain } from '@chain-registry/types';

interface Token extends Asset {
  chain: Chain;
}
type TokenList = Array<Token>;

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function useTokens(condition: (chain: Chain) => boolean) {
  return useMemo(() => {
    // go through each chain
    return assets.reduce<TokenList>((result, { chain_name, assets }) => {
      // add each asset with the parent chain details
      const chain = chains.find((chain) => chain.chain_name === chain_name);
      return chain && condition(chain)
        ? result.concat(assets.map((asset) => ({ ...asset, chain })))
        : result;
    }, []);
  }, [condition]);
}

const allTokens = () => true;
export function useAllTokens() {
  return useTokens(allTokens);
}

const mainnetTokens = (chain: Chain) => chain?.network_type === 'mainnet';
export function useMainnetTokens() {
  return useTokens(mainnetTokens);
}
