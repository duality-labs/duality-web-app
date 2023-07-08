import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { assets, chains } from 'chain-registry';
import { Chain } from '@chain-registry/types';
import { Token, TokenAddress, getTokenValue } from '../utils/tokens';
import { useSimplePrice } from '../../tokenPrices';

import tknLogo from '../../../assets/tokens/TKN.svg';
import stkLogo from '../../../assets/tokens/STK.svg';

const {
  REACT_APP__CHAIN_NAME = '[chain_name]',
  REACT_APP__CHAIN_ID = '[chain_id]',
  REACT_APP__IS_MAINNET = 'mainnet',
} = process.env;

interface AddressableToken extends Token {
  address: string; // only accept routeable tokens in lists
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
      exponent: 0,
      aliases: [],
    },
    {
      denom: 'tkn',
      exponent: 18,
      aliases: ['duality', 'TOKEN'],
    },
  ],
  base: 'sdk.coin:token',
  name: 'Duality',
  display: 'tkn',
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
      exponent: 0,
      aliases: [],
    },
    {
      denom: 'stk',
      exponent: 18,
      aliases: ['duality-stake', 'STAKE'],
    },
  ],
  base: 'sdk.coin:stake',
  name: 'Duality Stake',
  display: 'stk',
  symbol: 'STK',
  logo_URIs: {
    svg: stkLogo,
  },
  chain: dualityChain,
};

const testnetTokens = REACT_APP__IS_MAINNET === 'testnet' && [
  dualityMainToken,
  dualityStakeToken,
  // add a copy of some tokens onto the Duality chain for development
  ...assets.flatMap(({ chain_name, assets }) => {
    const dualityTestAssetsAddressMap: { [key: string]: string } = {
      'cosmoshub:ATOM': 'tokenA',
      'ethereum:USDC': 'tokenB',
      'ethereum:ETH': 'tokenC',
      'osmosis:OSMO': 'tokenD',
      'juno:JUNO': 'tokenE',
      'stride:STRD': 'tokenF',
      'stargaze:STARS': 'tokenG',
      'crescent:CRE': 'tokenH',
      'chihuahua:HUAHUA': 'tokenI',
    };

    return assets.flatMap((asset) => {
      const address =
        dualityTestAssetsAddressMap[`${chain_name}:${asset.symbol}`];
      if (address) {
        const base = asset.base;
        return [
          {
            chain: dualityChain,
            ...asset,
            // replace base address with dev token name
            address,
            base: address,
            denom_units: asset.denom_units.map((unit) => {
              // replace base unit with dev token name
              if (unit.denom === base) {
                return {
                  ...unit,
                  denom: address,
                };
              }
              // make test tokens look more expensive in testing
              else {
                return {
                  ...unit,
                  exponent: 21,
                };
              }
            }),
          },
        ];
      }
      return [];
    });
  }),
];

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function getTokens(condition: (chain: Chain) => boolean) {
  // go through each chain
  return (
    assets
      .reduce<TokenList>((result, { chain_name, assets }) => {
        // add each asset with the parent chain details
        const chain = chains.find((chain) => chain.chain_name === chain_name);
        // only show assets that have a known address
        const knownAssets = assets.filter(
          (asset): asset is Token => !!asset.address
        );
        return chain && condition(chain)
          ? result.concat(knownAssets.map((asset) => ({ ...asset, chain })))
          : result;
      }, [])
      // add testnet Duality chain tokens
      .concat(testnetTokens || [])
  );
}

export const addressableTokenMap = getTokens(Boolean).reduce<{
  [tickAddress: string]: AddressableToken;
}>((result, asset) => {
  if (asset.address) {
    result[asset.address] = asset as AddressableToken;
  }
  return result;
}, {});

const tokenListCache: {
  [key: string]: TokenList;
} = {};

const allTokens = () => true;
export default function useTokens(sortFunction = defaultSort) {
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

const dualityTokensFilter = (chain: Chain) => chain?.chain_id === 'duality';
export function useDualityTokens(sortFunction = defaultSort) {
  tokenListCache['dualityTokens'] =
    tokenListCache['dualityTokens'] || getTokens(dualityTokensFilter);
  return useMemo(
    () => tokenListCache['dualityTokens'].slice().sort(sortFunction).reverse(),
    [sortFunction]
  );
}

function defaultSort(a: Token, b: Token) {
  // compare by symbol name
  return a.symbol.localeCompare(b.symbol);
}

// utility functions to get a matching token from a list
export function matchTokenByAddress(address: TokenAddress) {
  return (token: Token) => token.address === address;
}
export function matchTokenByDenom(denom: string) {
  return (token: Token) =>
    !!token.denom_units.find((unit) => unit.denom === denom);
}

// utility function to get value of token amount in USD
export function useTokenValue(
  token: Token,
  amount: BigNumber.Value
): number | null | undefined {
  return useTokenValueTotal([token, amount]);
}

// utility function to get value of token amounts in USD
export function useTokenValueTotal(
  ...tokenAmounts: Array<[token: Token, amount: BigNumber.Value]>
): number | null | undefined {
  const tokens = tokenAmounts.map(([token]) => token);
  const { data: prices, isValidating } = useSimplePrice(tokens);

  const values = tokenAmounts.map(([token, amount], index) => {
    const price = prices[index];
    return getTokenValue(token, amount, price);
  });

  // if any values are still resolving then return that we don't know the value
  if (isValidating && values.some((value) => value === undefined)) {
    return undefined;
  }

  // sum values if they are all found
  // (don't return a total value if only half the token amounts are present)
  if (values.every((value) => value !== undefined)) {
    return (values as number[]).reduce((acc, value) => acc + value, 0);
  }
  // else return an error state
  else {
    return null;
  }
}
