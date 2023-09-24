import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import {
  assets as chainRegistryAssetList,
  chains as chainRegistryChainList,
} from 'chain-registry';
import { Asset, AssetList, Chain } from '@chain-registry/types';
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
  REACT_APP__DEV_ASSET_MAP = '',
} = process.env;

const isTestnet = REACT_APP__IS_MAINNET !== 'mainnet';

type TokenList = Array<Token>;

// create an alternate chain to identify dev assets on the Duality chain
export const devChain = { ...dualityChain, chain_name: '___dev___' };
const dualityMainToken: Asset = {
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
      aliases: ['duality'],
    },
  ],
  base: 'token',
  name: 'Duality',
  display: 'tkn',
  symbol: 'TKN',
  logo_URIs: {
    svg: tknLogo,
  },
};

const dualityStakeToken: Asset = {
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
      aliases: ['duality-stake'],
    },
  ],
  base: 'stake',
  name: 'Duality Stake',
  display: 'stk',
  symbol: 'STK',
  logo_URIs: {
    svg: stkLogo,
  },
};

export const dualityAssets: AssetList | undefined = REACT_APP__CHAIN_ASSETS
  ? (JSON.parse(REACT_APP__CHAIN_ASSETS) as AssetList)
  : isTestnet
  ? {
      chain_name: devChain.chain_name,
      assets: [dualityStakeToken, dualityMainToken],
    }
  : undefined;

export const providerAssets: AssetList | undefined = REACT_APP__PROVIDER_ASSETS
  ? (JSON.parse(REACT_APP__PROVIDER_ASSETS) as AssetList)
  : undefined;

const devAssets: AssetList | undefined = REACT_APP__DEV_ASSET_MAP
  ? {
      chain_name: devChain.chain_name,
      assets: Object.entries(
        JSON.parse(REACT_APP__DEV_ASSET_MAP) as { [address: string]: string }
      ).flatMap<Asset>(([address, path]) => {
        const devChainName = devChain.chain_name;
        const [symbol, chainName = devChainName] = path.split('/');
        const foundAssetList = chainRegistryAssetList.find(
          (list) => list.chain_name === chainName
        );
        const foundAsset = foundAssetList?.assets.find((asset) => {
          return asset.symbol === symbol;
        });
        // overwrite chain asset with fake address of dev chain
        return foundAsset
          ? {
              ...foundAsset,
              address,
            }
          : [];
      }),
    }
  : undefined;

const assetList = [
  ...chainRegistryAssetList,
  dualityAssets,
  providerAssets,
  // add any dev assets added to the environment
  isTestnet && devAssets,
].filter((assets): assets is AssetList => !!assets);
const chainList = [
  ...chainRegistryChainList,
  dualityChain,
  providerChain,
  isTestnet && devChain,
].filter((chain): chain is Chain => !!chain);

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function getTokens(condition: (chain: Chain) => boolean) {
  // go through each chain
  return assetList.reduce<TokenList>((result, { chain_name, assets }) => {
    // add each asset with the parent chain details
    const chain = chainList.find((chain) => chain.chain_name === chain_name);
    // only show assets that have a known address
    const knownAssets = assets.filter(
      (asset): asset is Token => !!asset.address
    );
    return chain && condition(chain)
      ? result.concat(knownAssets.map((asset) => ({ ...asset, chain })))
      : result;
  }, []);
}

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
              // rename the address as its IBC denom for easy local referencing
              address: getIbcDenom(token.address, channelID, portID),
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
                source_denom: token.address,
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

const ibcDenomRegex = /^ibc\/[0-9A-Fa-f]+$/;
function matchTokenBySymbol(symbol: string | undefined) {
  if (!symbol) {
    return () => false;
  }
  // match regular symbols for local tokens
  else {
    return (token: Token) => {
      return token.symbol === symbol;
    };
  }
}
export function useTokenBySymbol(symbol: string | undefined) {
  const allTokens = useTokens();
  const tokensWithIbcInfo = useTokensWithIbcInfo(allTokens);
  if (!symbol) {
    return undefined;
  }
  return tokensWithIbcInfo.find(matchTokenBySymbol(symbol));
}

// return the base IBC denom if it is found
export function getBaseIbcDenom(token: Token | undefined): string | undefined {
  if (token?.ibc) {
    const baseUnit = token.denom_units.find(
      (unit) => unit.denom === token.base
    );
    // return the denom that matches an IBC string
    if (baseUnit) {
      return [baseUnit.denom, ...(baseUnit.aliases || [])].find((alias) =>
        alias.match(ibcDenomRegex)
      );
    }
  }
}

function defaultSort(a: Token, b: Token) {
  // compare by symbol name
  return a.symbol.localeCompare(b.symbol);
}

export function matchTokens(tokenA: Token, tokenB: Token) {
  return (
    tokenA.address === tokenB.address &&
    tokenA.chain.chain_id === tokenB.chain.chain_id
  );
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
