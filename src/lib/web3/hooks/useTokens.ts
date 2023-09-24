import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import {
  assets as chainRegistryAssetList,
  chains as chainRegistryChainList,
} from 'chain-registry';
import { AssetList, Chain } from '@chain-registry/types';
import {
  Token,
  TokenAddress,
  getIbcDenom,
  getTokenValue,
} from '../utils/tokens';
import { useSimplePrice } from '../../tokenPrices';
import { dualityChain, providerChain, useIbcOpenTransfers } from './useChains';

import tknLogo from '../../../assets/tokens/TKN.svg';
import stkLogo from '../../../assets/tokens/STK.svg';

const {
  REACT_APP__IS_MAINNET = 'mainnet',
  REACT_APP__CHAIN_ASSETS = '',
  REACT_APP__PROVIDER_ASSETS = '',
} = process.env;

const isTestnet = REACT_APP__IS_MAINNET !== 'mainnet';

interface AddressableToken extends Token {
  address: string; // only accept routeable tokens in lists
}

type TokenList = Array<Token>;

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

export const dualityAssets: AssetList | undefined = REACT_APP__CHAIN_ASSETS
  ? (JSON.parse(REACT_APP__CHAIN_ASSETS) as AssetList)
  : isTestnet
  ? {
      chain_name: dualityChain.chain_name,
      assets: [dualityStakeToken, dualityMainToken],
    }
  : undefined;

export const providerAssets: AssetList | undefined = REACT_APP__PROVIDER_ASSETS
  ? (JSON.parse(REACT_APP__PROVIDER_ASSETS) as AssetList)
  : undefined;

const assetList = providerAssets
  ? [...chainRegistryAssetList, providerAssets]
  : chainRegistryAssetList;
const chainList = providerChain
  ? [...chainRegistryChainList, providerChain]
  : chainRegistryChainList;

const testnetTokens = isTestnet && [
  dualityMainToken,
  dualityStakeToken,
  // add a copy of some tokens onto the Duality chain for development
  ...assetList.flatMap(({ chain_name, assets }) => {
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
              // make test token amounts more consistent in dev
              // the different exponents really throws off
              else {
                return {
                  ...unit,
                  exponent: 18,
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
    assetList
      .reduce<TokenList>((result, { chain_name, assets }) => {
        // add each asset with the parent chain details
        const chain = chainList.find(
          (chain) => chain.chain_name === chain_name
        );
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

export function useIbcTokens(sortFunction = defaultSort) {
  const ibcOpenTransfersInfo = useIbcOpenTransfers();
  return useMemo(() => {
    // get tokens that match the expected chainIDs
    const ibcClientChainIds = ibcOpenTransfersInfo.map(
      (openTransfer) => openTransfer.chainID
    );
    const ibcTokens = getTokens((chain) =>
      ibcClientChainIds.includes(chain.chain_id)
    );
    return ibcTokens.sort(sortFunction).reverse();
  }, [sortFunction, ibcOpenTransfersInfo]);
}

export function useToken(
  tokenAddress: string | undefined,
  matchFunction = matchTokenByAddress
): Token | undefined {
  const tokens = useTokens();
  return useMemo(() => {
    return tokenAddress ? tokens.find(matchFunction(tokenAddress)) : undefined;
  }, [matchFunction, tokenAddress, tokens]);
}

// connected IBC info into given token list
export function useTokensWithIbcInfo(tokenList: Token[]) {
  const ibcOpenTransfersInfo = useIbcOpenTransfers();
  return useMemo(() => {
    return (
      tokenList
        // add IBC denom information
        .map((token) => {
          // return unchanged tokens from native chain
          if (token.chain.chain_id === dualityChain.chain_id) {
            return token;
          }
          // append ibcDenpm as a denom alias
          const ibcOpenTransferInfo = ibcOpenTransfersInfo.find(
            ({ chainID }) => {
              return chainID === token.chain.chain_id;
            }
          );
          // found connection info
          if (ibcOpenTransferInfo) {
            const channel = ibcOpenTransferInfo.channel;
            const channelID = channel.channel_id;
            const portID = channel.port_id;
            return {
              ...token,
              denom_units: token.denom_units.map(
                ({ aliases = [], ...unit }) => {
                  const ibcDenom = getIbcDenom(unit.denom, channelID, portID);
                  return {
                    ...unit,
                    aliases: [...aliases, ibcDenom],
                  };
                }
              ),
              ibc: {
                dst_channel: channel.channel_id,
                source_channel: channel.counterparty?.channel_id,
              },
            };
          }
          // else return the unchanged token
          else {
            return token;
          }
        })
    );
  }, [tokenList, ibcOpenTransfersInfo]);
}

export function getTokenBySymbol(symbol: string | undefined) {
  if (!symbol) {
    return undefined;
  }
  if (isTestnet) {
    tokenListCache['dualityTokens'] =
      tokenListCache['dualityTokens'] || getTokens(dualityTokensFilter);
    return tokenListCache['dualityTokens'].find(
      (token) => token.symbol === symbol
    );
  } else {
    // todo: in mainnet find the best way to differentiate between symbols
    // maybe use addresses instead or as a fallback to be more specific?
    tokenListCache['mainnetTokens'] =
      tokenListCache['mainnetTokens'] || getTokens(mainnetTokens);
    return tokenListCache['mainnetTokens'].find(
      (token) => token.symbol === symbol
    );
  }
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
  if (denom) {
    if (denom.startsWith('ibc/')) {
      // search token aliases for ibc denoms (which we should have updated)
      return (token: Token) =>
        !!token.denom_units.find((unit) => unit.aliases?.includes(denom));
    } else {
      return (token: Token) =>
        !!token.denom_units.find((unit) => unit.denom === denom);
    }
  }
  // don't match empty string to anything
  else {
    return () => false;
  }
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
