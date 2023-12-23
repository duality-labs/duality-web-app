import BigNumber from 'bignumber.js';
import { useCallback, useMemo, useState } from 'react';
import { assets as chainRegistryAssetList } from 'chain-registry';
import { Asset, AssetList, Chain } from '@chain-registry/types';
import {
  Token,
  TokenID,
  getIbcBaseDenom,
  getIbcDenom,
  getTokenId,
  getTokenValue,
  ibcDenomRegex,
} from '../utils/tokens';
import { useSimplePrice } from '../../tokenPrices';
import {
  chainFeeTokens,
  nativeChain,
  chainList,
  useIbcOpenTransfers,
} from './useChains';

const {
  REACT_APP__CHAIN_ID = '',
  REACT_APP__DEV_ASSETS = '',
  REACT_APP__DEV_NATIVE_ASSET_MAP = '',
} = import.meta.env;

type TokenList = Array<Token>;

const devAssetLists: AssetList[] | undefined = REACT_APP__DEV_ASSETS
  ? JSON.parse(REACT_APP__DEV_ASSETS)
  : undefined;

const devMappedAssetsList: AssetList | undefined =
  REACT_APP__DEV_NATIVE_ASSET_MAP
    ? {
        chain_name: nativeChain.chain_name,
        assets: Object.entries(
          JSON.parse(REACT_APP__DEV_NATIVE_ASSET_MAP) as {
            [tokenId: TokenID]: string;
          }
        ).flatMap<Asset>(([tokenId, path]) => {
          const devChainName = nativeChain.chain_name;
          const [symbol, chainName = devChainName] = path.split('/');
          const foundAssetList = chainRegistryAssetList.find(
            (list) => list.chain_name === chainName
          );
          const foundAsset = foundAssetList?.assets.find((asset) => {
            return asset.symbol === symbol;
          });
          // overwrite chain asset with fake tokenId of dev chain
          return foundAsset
            ? {
                ...foundAsset,
                // overwrite base denom for denom matching in Keplr fees
                base: tokenId,
                // add denom alias for denom exponent matching
                denom_units: foundAsset.denom_units.map((unit) => {
                  return unit.denom === foundAsset.base
                    ? // add token as base denom, move original denom to aliases
                      {
                        ...unit,
                        denom: tokenId,
                        aliases: [...(unit.aliases || []), unit.denom],
                      }
                    : unit;
                }),
              }
            : [];
        }),
      }
    : undefined;

export const assetLists = chainRegistryAssetList
  // override chain-registry chains with our specific chains by matching name
  .map((chain) => {
    // use REACT_APP__DEV_NATIVE_ASSET_MAP list to replace any chain info
    if (devMappedAssetsList && chain.chain_name === nativeChain.chain_name) {
      return devMappedAssetsList;
    }
    // use REACT_APP__DEV_ASSETS list to replace any chain info
    const foundDevChainAssets = devAssetLists?.find(
      (devAssetList) => devAssetList.chain_name === chain.chain_name
    );
    if (foundDevChainAssets) {
      return foundDevChainAssets;
    }
    return chain;
  });

// transform AssetList into TokenList
// for easier filtering/ordering by token attributes
function getTokens(condition: (chain: Chain) => boolean) {
  // go through each chain
  return assetLists.reduce<TokenList>((result, { chain_name, assets }) => {
    // add each asset with the parent chain details
    const chain = chainList.find((chain) => chain.chain_name === chain_name);
    return chain && condition(chain)
      ? result.concat(assets.map((asset) => ({ ...asset, chain })))
      : result;
  }, []);
}

const tokenListCache: {
  [key: string]: TokenList;
} = {};

function defaultSort(a: Token, b: Token) {
  // compare by symbol name
  return a.symbol.localeCompare(b.symbol);
}

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

const dualityTokensFilter = (chain: Chain) =>
  chain.chain_id === nativeChain.chain_id;
export function useDualityTokens(sortFunction = defaultSort) {
  tokenListCache['dualityTokens'] =
    tokenListCache['dualityTokens'] || getTokens(dualityTokensFilter);
  return useMemo(
    () => tokenListCache['dualityTokens'].slice().sort(sortFunction).reverse(),
    [sortFunction]
  );
}

export function useChainFeeToken(): [
  Token | undefined,
  React.Dispatch<React.SetStateAction<string | undefined>>
] {
  const [feeDenom, setFeeDenom] = useState(() => chainFeeTokens.at(0)?.denom);
  const restrictedSetFeeDenom: React.Dispatch<
    React.SetStateAction<string | undefined>
  > = useCallback((feeDenomOrCallback) => {
    if (feeDenomOrCallback) {
      if (typeof feeDenomOrCallback === 'function') {
        setFeeDenom((prev) => getRestrictedFeeDenom(feeDenomOrCallback(prev)));
      } else {
        setFeeDenom(getRestrictedFeeDenom(feeDenomOrCallback));
      }
    }
    function getRestrictedFeeDenom(
      feeDenom: string | undefined
    ): string | undefined {
      return chainFeeTokens.find(({ denom }) => denom === feeDenom)?.denom;
    }
  }, []);
  const feeToken = useToken(feeDenom);
  return [feeToken, restrictedSetFeeDenom];
}

export function useIbcTokens(sortFunction = defaultSort) {
  const ibcOpenTransfersInfo = useIbcOpenTransfers();
  return useMemo(() => {
    // get tokens that match the expected chainIDs
    const ibcClientChainIds = ibcOpenTransfersInfo.map(
      (openTransfer) => openTransfer.chain.chain_id
    );
    const ibcTokens = getTokens((chain) =>
      ibcClientChainIds.includes(chain.chain_id)
    );
    return ibcTokens.sort(sortFunction).reverse();
  }, [sortFunction, ibcOpenTransfersInfo]);
}

export function useToken(
  denom: string | undefined,
  matchFunction = matchTokenByDenom
): Token | undefined {
  const tokens = useTokensWithIbcInfo(useTokens());
  return useMemo(() => {
    return denom ? tokens.find(matchFunction(denom)) : undefined;
  }, [matchFunction, denom, tokens]);
}

// connected IBC info into given token list
export function useTokensWithIbcInfo(tokenList: Token[]): Token[] {
  const ibcOpenTransfersInfo = useIbcOpenTransfers();
  return useMemo(() => {
    return (
      tokenList
        // remove existing IBC informations and add new IBC denom information
        .map(({ ibc, ...token }) => {
          // return unchanged tokens from native chain
          if (token.chain.chain_id === nativeChain.chain_id) {
            return token;
          }
          // append ibcDenom as a denom alias
          const ibcOpenTransferInfo = ibcOpenTransfersInfo.find(({ chain }) => {
            return chain.chain_id === token.chain.chain_id;
          });
          // found connection info
          if (ibcOpenTransferInfo) {
            const channel = ibcOpenTransferInfo.channel;
            const channelID = channel.channel_id;
            const portID = channel.port_id;
            return {
              ...token,
              // append IBC information to existing known token/assets.
              // Neutron has assets registered in chain-registry,
              // but for not yet known/documented channels (in dev and testnet)
              // this appended information allows us to identify which tokens
              // a Neutron chain IBC denom represents
              denom_units: token.denom_units.map(
                ({ aliases = [], ...unit }) => {
                  const ibcDenom = getIbcDenom(unit.denom, channelID, portID);
                  return {
                    ...unit,
                    // place the calculated IBC denom as a unit denom alias.
                    // the local chain knows the IBC denom, and this unit->denom
                    // of this token and chain is what the IBC denom represents
                    aliases: [...aliases, ibcDenom],
                  };
                }
              ),
              // append our calculated IBC denom source information here
              ibc: {
                dst_channel: channel.channel_id,
                source_channel: channel.counterparty?.channel_id,
                // note: this may not be accurate:
                //       a channel may transfer many denoms from a source chain.
                //       this *should* be the base denom of token in question
                //       because Neutron operates on indivisible (base) denoms,
                //       but it is *possible* to IBC transfer a non-base denom
                //       which would be a *bad idea* for whoever did that
                source_denom: token.base,
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

// allow matching by token symbol or IBC denom string (typically from a URL)
function matchTokenBySymbol(symbol: string | undefined) {
  // match nothing
  if (!symbol) {
    return () => false;
  }
  // match denom aliases for IBC tokens
  if (symbol.match(ibcDenomRegex)) {
    return (tokenWithIbcInfo: Token) => {
      return (
        !!tokenWithIbcInfo.ibc &&
        !!tokenWithIbcInfo.denom_units?.find((unit) =>
          unit.aliases?.find((alias) => alias === symbol)
        )
      );
    };
  }
  // match regular symbols for local tokens
  else {
    return (token: Token) => {
      return (
        // match Duaity chain
        token.chain.chain_id === REACT_APP__CHAIN_ID &&
        // match symbol
        token.symbol === symbol
      );
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

// get a "symbol" string that can be later decoded by matchTokenBySymbol
function getTokenSymbol(token: Token | undefined): string | undefined {
  // return IBC denom or the local token symbol as the token identifier
  return token?.ibc ? getIbcBaseDenom(token) : token?.symbol;
}
// return token identifier that can be used as a part of a URL
// (for later decoding by matchTokenBySymbol and useTokenBySymbol)
export function getTokenPathPart(token: Token | undefined) {
  return encodeURIComponent(getTokenSymbol(token) ?? '-');
}

export function useTokenPathPart(token: Token | undefined) {
  return useMemo(() => getTokenPathPart(token), [token]);
}

export function matchToken(tokenSearch: Token) {
  const tokenId = getTokenId(tokenSearch);
  const tokenChainId = tokenSearch.chain.chain_id;
  if (tokenId && tokenChainId) {
    return (token: Token) => {
      return (
        // check for matching chain
        token.chain.chain_id === tokenChainId &&
        // match by identifying token symbols
        getTokenId(token) === tokenId
      );
    };
  }
  // match nothing
  return () => false;
}

export function matchTokens(tokenA: Token, tokenB: Token) {
  // check for matching chain
  if (tokenA.chain.chain_id === tokenB.chain.chain_id) {
    // match by identifying token symbols
    const tokenASymbol = getTokenSymbol(tokenA);
    const tokenBSymbol = getTokenSymbol(tokenB);
    return !!tokenASymbol && !!tokenBSymbol && tokenASymbol === tokenBSymbol;
  }
}
// utility functions to get a matching token from a list
export function matchTokenByDenom(denom: string) {
  if (denom) {
    // match IBC tokens
    if (denom.match(ibcDenomRegex)) {
      // the denom is an IBC token identifier, use available matching function
      return matchTokenBySymbol(denom);
    }
    // match native chain token denoms only
    else if (REACT_APP__CHAIN_ID) {
      return (token: Token) =>
        token.chain.chain_id === REACT_APP__CHAIN_ID &&
        !!token.denom_units.find((unit) => unit.denom === denom);
    }
  }
  // don't match empty string to anything
  return () => false;
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
