import { useMemo } from 'react';
import { assets } from 'chain-registry';
import { Asset } from '@chain-registry/types';

interface Token extends Asset {
  chain_name: string;
}
type TokenList = Array<Token>;

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
export function useTokens() {
  return useMemo(() => {
    // go through each chain
    return assets.reduce<TokenList>((result, { chain_name, assets }) => {
      // add each asset with the parent chain name
      return result.concat(
        assets.map((asset) => {
          return {
            ...asset,
            chain_name,
          };
        })
      );
    }, []);
  }, []);
}
