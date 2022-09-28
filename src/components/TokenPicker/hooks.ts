import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Asset, Chain } from '@chain-registry/types';

interface Token extends Asset {
  chain: Chain;
}
type TokenList = Array<Token>;

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
export function useTokens() {
  return useMemo(() => {
    // go through each chain
    return assets.reduce<TokenList>((result, { chain_name, assets }) => {
      // add each asset with the parent chain details
      const chain = chains.find((chain) => chain.chain_name === chain_name);
      return chain
        ? result.concat(assets.map((asset) => ({ ...asset, chain })))
        : result;
    }, []);
  }, []);
}
