import {
  useContext,
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import Long from 'long';
import { BigNumber } from 'bignumber.js';
import { cosmos, dualitylabs } from '@duality-labs/dualityjs';

import { MessageActionEvent } from './events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { useRpcPromise } from './rpcQueryClient';
import useTokens from './hooks/useTokens';
import useTokenPairs from './hooks/useTokenPairs';

import { addressableTokenMap as tokenMap } from '../../components/TokenPicker/hooks';

import { feeTypes } from './utils/fees';

import { Token, TokenAddress, getAmountInDenom } from './utils/tokens';
import { calculateShares, tickIndexToPrice } from './utils/ticks';
import { IndexedShare, getShareInfo } from './utils/shares';
import { PairInfo, PairMap, getPairID } from './utils/pairs';

import { ProtobufRpcClient } from '@cosmjs/stargate';
import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { TokensSDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/tokens';
import { TickLiquiditySDKType } from '@duality-labs/dualityjs/types/codegen/duality/dex/tick_liquidity';
import { PageRequest } from '@duality-labs/dualityjs/types/codegen/helpers.d';
import { QueryAllBalancesResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';

const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;
const queryClientImpl = dualitylabs.duality.dex.QueryClientImpl;

interface UserBankBalance {
  balances: Array<CoinSDKType>;
}

interface UserShares {
  shares: Array<IndexedShare>;
}

interface IndexerContextType {
  bank: {
    data?: UserBankBalance;
    error?: string;
    isValidating: boolean;
  };
  shares: {
    data?: UserShares;
    error?: string;
    isValidating: boolean;
  };
  indexer: {
    data?: PairMap;
    error?: string;
    isValidating: boolean;
  };
  tokens: {
    data?: TokensSDKType[];
    error?: string;
    isValidating: boolean;
  };
  tokenPairs: {
    data?: [TokenAddress, TokenAddress][];
    error?: string;
    isValidating: boolean;
  };
}

interface FetchState {
  fetching: boolean;
  fetched: boolean;
  error?: Error;
}

const IndexerContext = createContext<IndexerContextType>({
  bank: {
    isValidating: true,
  },
  shares: {
    isValidating: true,
  },
  indexer: {
    isValidating: true,
  },
  tokens: {
    isValidating: true,
  },
  tokenPairs: {
    isValidating: true,
  },
});

const defaultFetchParams: Partial<PageRequest> = {
  limit: Long.fromNumber(1000),
  countTotal: true,
};

async function getFullData(
  rpcPromise: Promise<ProtobufRpcClient>
): Promise<PairMap> {
  const rpc = await rpcPromise;
  return new Promise(function (resolve, reject) {
    if (!rpc) {
      reject(new Error('Undefined rest api base URL'));
    } else {
      Promise.resolve()
        .then(async () => {
          const queryClient = new queryClientImpl(rpc);
          let nextKey: Uint8Array | undefined;
          let tickMap: Array<TickLiquiditySDKType> = [];
          do {
            const res = await queryClient.tickLiquidityAll({
              ...defaultFetchParams,
              // note: fetch empty pair for now, fix later
              pairId: getPairID('', ''),
              tokenIn: '',
              pagination: {
                offset: Long.fromNumber(0),
                ...defaultFetchParams,
                key: nextKey || [],
              } as PageRequest,
            });
            tickMap = tickMap.concat(res.tickLiquidity || []);
            nextKey = res.pagination?.nextKey;
          } while (nextKey && nextKey.length > 0);
          return {
            tickMap: tickMap,
          };
        })
        .then((data) => transformData(data.tickMap || []))
        .then(resolve)
        .catch(reject);
    }
  });
}

function transformData(ticks: Array<TickLiquiditySDKType>): PairMap {
  const intermediate = ticks.reduce<PairMap>(function (
    result,
    {
      poolReserves: {
        pairId: { token0 = '', token1 = '' } = {},
        tokenIn,
        tickIndex: tickIndexString,
        fee: feeString,
        reserves: reservesString,
      } = {},
    }
  ) {
    const tickIndex = Number(tickIndexString);
    const reserves = Number(reservesString);
    const fee = Number(feeString) / 10000 || 0;
    const feeIndex = feeTypes.findIndex((feeType) => feeType.fee === fee);
    const pairId = getPairID(token0, token1);
    if (
      !isNaN(tickIndex) &&
      tokenIn &&
      token0 &&
      token1 &&
      tokenMap[tokenIn] &&
      tokenMap[token0] &&
      tokenMap[token1] &&
      reserves > 0 &&
      feeIndex >= 0
    ) {
      result[pairId] =
        result[pairId] ||
        ({
          token0: token0,
          token1: token1,
          token0Ticks: [],
          token1Ticks: [],
        } as PairInfo);

      // calculate price from tickIndex, try to keep price values consistent:
      //   JS rounding may be inconsistent with API's rounding
      const bigTickIndex = new BigNumber(tickIndex || 0);
      const bigPrice = tickIndexToPrice(bigTickIndex);

      if (tokenIn === token0) {
        result[pairId].token0Ticks.push({
          token0: tokenMap[token0],
          token1: tokenMap[token1],
          tickIndex: bigTickIndex,
          price: bigPrice,
          feeIndex: new BigNumber(feeIndex),
          fee: new BigNumber(fee),
          reserve0: new BigNumber(reserves || 0),
          reserve1: new BigNumber(0),
        });
      } else if (tokenIn === token1) {
        result[pairId].token1Ticks.push({
          token0: tokenMap[token0],
          token1: tokenMap[token1],
          tickIndex: bigTickIndex,
          price: bigPrice,
          feeIndex: new BigNumber(feeIndex),
          fee: new BigNumber(fee),
          reserve0: new BigNumber(0),
          reserve1: new BigNumber(reserves || 0),
        });
      }
    }
    return result;
  },
  {});

  // sort all ticks
  return Object.entries(intermediate).reduce<PairMap>(
    (result, [pairId, pairInfo]) => {
      result[pairId] = {
        ...pairInfo,
        // sort each pair's ticks
        token0Ticks: pairInfo.token0Ticks.sort((a, b) => {
          // sort by decreasing tickIndex (price) then feeIndex
          return (
            b.tickIndex.comparedTo(a.tickIndex) ||
            b.feeIndex.comparedTo(a.feeIndex)
          );
        }),
        token1Ticks: pairInfo.token1Ticks.sort((a, b) => {
          // sort by increasing tickIndex (price) then feeIndex
          return (
            a.tickIndex.comparedTo(b.tickIndex) ||
            a.feeIndex.comparedTo(b.feeIndex)
          );
        }),
      };
      return result;
    },
    {}
  );
}

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const [indexerData, setIndexerData] = useState<PairMap>();
  const seconds = 1000;
  const minutes = 60 * seconds;

  const [bankData, setBankData] = useState<UserBankBalance>();
  const [shareData, setShareData] = useState<UserShares>();
  const { data: tokensData } = useTokens({
    swr: { refreshInterval: 10 * minutes },
  });
  const { data: tokenPairsData, isValidating: isTokenPairsValidating } =
    useTokenPairs({
      swr: { refreshInterval: 10 * minutes },
    });

  const rpcPromise = useRpcPromise();

  const [error, setError] = useState<string>();
  // avoid sending more than once
  const [, setRequestedFlag] = useState(false);
  const [result, setResult] = useState<IndexerContextType>({
    bank: {
      data: bankData,
      error: error,
      isValidating: true,
    },
    shares: {
      data: shareData,
      error: error,
      isValidating: true,
    },
    indexer: {
      data: indexerData,
      error: error,
      isValidating: true,
    },
    tokens: {
      data: tokensData,
      error: error,
      isValidating: true,
    },
    tokenPairs: {
      data: tokenPairsData,
      error: error,
      isValidating: true,
    },
  });

  const { address } = useWeb3();
  const [, setFetchBankDataState] = useState<FetchState>({
    fetching: false,
    fetched: false,
  });
  const updateBankData = useCallback(
    (fetchStateCheck?: (fetchstate: FetchState) => boolean) => {
      setFetchBankDataState((fetchState) => {
        // check if already fetching (and other other passed in check)
        if (!fetchState.fetching && (fetchStateCheck?.(fetchState) ?? true)) {
          // todo: clean up this effect when address has changed
          // see: https://github.com/duality-labs/duality-web-app/issues/290
          fetchBankData()
            .then((data = []) => {
              // separate out 'normal' and 'share' tokens from the bank balance
              const [tokens, tokenizedShares] = data.reduce<
                [Array<CoinSDKType>, Array<IndexedShare>]
              >(
                ([tokens, tokenizedShares], coin) => {
                  const {
                    token0Address: token0,
                    token1Address: token1,
                    tickIndexString: tickIndex,
                    feeIndexString: feeIndex,
                  } = getShareInfo(coin) || {};
                  // transform tokenized shares into shares
                  if (token0 && token1 && tickIndex && feeIndex) {
                    // add tokenized share if everything is fine
                    if (address) {
                      const tokenizedShare = {
                        address,
                        pairId: getPairID(token0, token1),
                        tickIndex,
                        feeIndex,
                        sharesOwned: coin.amount,
                      };
                      return [tokens, [...tokenizedShares, tokenizedShare]];
                    }
                    // drop unknown (to front end) share
                    else {
                      // eslint-disable-next-line no-console
                      console.warn(
                        `Received unknown denomination in tokenized shares: ${coin.denom}`,
                        {
                          feeTypes,
                          feeIndex,
                          address,
                        }
                      );
                      return [tokens, tokenizedShares];
                    }
                  } else {
                    return [[...tokens, coin], tokenizedShares];
                  }
                },
                [[], []]
              );
              setBankData({ balances: tokens });
              setShareData({ shares: tokenizedShares });
            })
            .catch((e) => {
              setFetchBankDataState((state) => ({
                ...state,
                error: e as Error,
              }));
            });
        }
        return fetchState;
      });

      async function fetchBankData() {
        const rpc = await rpcPromise;
        if (address && rpc) {
          const client = new bankClientImpl(rpc);
          setFetchBankDataState(({ fetched }) => ({ fetching: true, fetched }));
          let nextKey: Uint8Array | undefined;
          let balances: Array<CoinSDKType> = [];
          let res: QueryAllBalancesResponse;
          do {
            try {
              res = await client.allBalances({
                address,
                pagination: {
                  offset: Long.fromNumber(0),
                  ...defaultFetchParams,
                  key: nextKey || [],
                } as PageRequest,
              });
              const nonZeroBalances = res.balances?.filter(
                (balance: CoinSDKType): balance is CoinSDKType =>
                  balance.amount !== undefined
              );
              balances = balances.concat(nonZeroBalances || []);
            } catch (err) {
              setFetchBankDataState(({ fetched }) => ({
                fetching: false,
                fetched,
              }));
              // remove API error details from public view
              throw new Error(`API error: ${err}`);
            }
            nextKey = res.pagination?.nextKey;
          } while (nextKey && nextKey.length > 0);
          setFetchBankDataState(() => ({ fetching: false, fetched: true }));
          return balances || [];
        } else if (!rpc) {
          throw new Error('Could not connect to RPC endpoint');
        }
      }
    },
    [rpcPromise, address]
  );

  // update bank data whenever wallet address is updated
  useEffect(() => {
    updateBankData();
  }, [updateBankData, address]);

  // update bank balance whenever bank transfers are detected
  useEffect(() => {
    if (address) {
      const onTxBalanceUpdate = () => {
        updateBankData();
      };
      subscriber.subscribeMessage(onTxBalanceUpdate, {
        transfer: { recipient: address },
      });
      subscriber.subscribeMessage(onTxBalanceUpdate, {
        transfer: { sender: address },
      });
      return () => {
        subscriber.unsubscribeMessage(onTxBalanceUpdate);
      };
    }
  }, [updateBankData, address]);

  useEffect(() => {
    let lastRequested = 0;
    const onDexUpdateMessage = function (event: MessageActionEvent) {
      const Receiver = event['message.Receiver'];
      const Token0 = event['message.Token0'];
      const Token1 = event['message.Token1'];
      const TickIndex = event['message.TickIndex'];
      const FeeIndex = event['message.FeeIndex'];
      const NewReserves0 = event['message.NewReserves0'];
      const NewReserves1 = event['message.NewReserves1'];

      if (
        Receiver !== address ||
        !Token0 ||
        !Token1 ||
        !TickIndex ||
        !FeeIndex ||
        !NewReserves0 ||
        !NewReserves1
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }
      // update user's share state
      setShareData((state) => {
        if (!state) return state;
        // find matched data
        const { shares = [] } = state || {};
        const data = shares.slice();
        const pairId = getPairID(Token0, Token1);
        const shareFoundIndex = shares.findIndex(
          (share) =>
            share.pairId === pairId &&
            share.tickIndex === TickIndex &&
            share.feeIndex === FeeIndex
        );
        const sharesOwned = calculateShares({
          tickIndex: new BigNumber(TickIndex),
          reserve0: new BigNumber(NewReserves0),
          reserve1: new BigNumber(NewReserves1),
        });
        // upsert new share
        if (sharesOwned.isGreaterThan(0)) {
          const newShare = {
            pairId,
            address,
            feeIndex: FeeIndex,
            tickIndex: TickIndex,
            sharesOwned: sharesOwned.toFixed(),
          };
          if (shareFoundIndex >= 0) {
            // update share
            data.splice(shareFoundIndex, 1, newShare);
          } else {
            // add share
            data.push(newShare);
          }
        }
        // else remove share
        else {
          if (shareFoundIndex >= 0) {
            data.splice(shareFoundIndex, 1);
          }
        }
        return { shares: data };
      });

      // update the indexer data (not a high priority, each block that contains changes to listened pairs should update the indexer state)
      const now = Date.now();
      if (now - lastRequested > 1000) {
        lastRequested = Date.now();
        getFullData(rpcPromise)
          .then(function (res) {
            setIndexerData(res);
          })
          .catch(function (err: Error) {
            setError(err?.message ?? 'Unknown Error');
          });
      }
      // todo: do a partial update of indexer data?
      // see this commit for previous work done on this
    };
    // subscribe to messages for this address only
    if (address) {
      subscriber.subscribeMessage(onDexUpdateMessage, {
        message: { action: 'NewDeposit', Receiver: address },
      });
      subscriber.subscribeMessage(onDexUpdateMessage, {
        message: { action: 'NewWithdraw', Receiver: address },
      });
      return () => {
        subscriber.unsubscribeMessage(onDexUpdateMessage);
      };
    }
  }, [rpcPromise, address]);

  useEffect(() => {
    const onRouterUpdateMessage = function (event: MessageActionEvent) {
      const Creator = event['message.Creator'];
      const TokenIn = event['message.TokenIn'];
      const TokenOut = event['message.TokenOut'];
      const AmountIn = event['message.AmountIn'];
      const AmountOut = event['message.AmountOut'];
      const MinOut = event['message.MinOut'];
      if (
        !Creator ||
        !TokenIn ||
        !TokenOut ||
        !AmountIn ||
        !AmountOut ||
        !MinOut
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }

      // todo: update something without refetching?
      // may not be possible or helpful
      // bank balance update will be caught already by the bank event watcher
      // it's too complicated to update indexer state with the event detail's

      // fetch new indexer data as the trade would have caused changes in ticks
      // todo: fetch only ticks of the pair that has changed if in view
      getFullData(rpcPromise)
        .then(function (res) {
          setIndexerData(res);
        })
        .catch(function (err: Error) {
          setError(err?.message ?? 'Unknown Error');
        });
    };
    subscriber.subscribeMessage(onRouterUpdateMessage, {
      message: { action: 'NewSwap' },
    });
    return () => {
      subscriber.unsubscribeMessage(onRouterUpdateMessage);
    };
  }, [rpcPromise]);

  useEffect(() => {
    setResult({
      bank: {
        data: bankData,
        error: error,
        isValidating: !bankData && !error,
      },
      indexer: {
        data: indexerData,
        error: error,
        isValidating: !indexerData && !error,
      },
      shares: {
        data: shareData,
        error: error,
        isValidating: !shareData && !error,
      },
      tokens: {
        data: undefined,
        error: error,
        isValidating: !shareData && !error,
      },
      tokenPairs: {
        data: tokenPairsData,
        error: error,
        isValidating: isTokenPairsValidating,
      },
    });
  }, [
    bankData,
    indexerData,
    shareData,
    tokenPairsData,
    error,
    isTokenPairsValidating,
  ]);

  useEffect(() => {
    setRequestedFlag((oldValue) => {
      if (oldValue) return true;
      getFullData(rpcPromise)
        .then(function (res) {
          setIndexerData(res);
        })
        .catch(function (err: Error) {
          setError(err?.message ?? 'Unknown Error');
        });
      return true;
    });
  }, [rpcPromise]);

  return (
    <IndexerContext.Provider value={result}>{children}</IndexerContext.Provider>
  );
}

export function useBankData() {
  return useContext(IndexerContext).bank;
}

export function useBankBalances() {
  const { data, error, isValidating } = useBankData();
  return { data: data?.balances, error, isValidating };
}

export function useBankBalance(token: Token | undefined) {
  const { data: balances, error, isValidating } = useBankBalances();
  const balance = useMemo(() => {
    return token && balances && getBalance(token, balances);
  }, [balances, token]);
  return { data: balance, error, isValidating };
}

export function useShareData() {
  return useContext(IndexerContext).shares;
}

export function useShares(tokens?: [tokenA: Token, tokenB: Token]) {
  const { data, error, isValidating } = useShareData();
  const shares = useMemo(() => {
    // filter to specific tokens if asked for
    const shares = data?.shares.filter(
      (share) => Number(share.sharesOwned) > 0
    );
    if (tokens) {
      const [addressA, addressB] = tokens.map((token) => token.address);
      return shares?.filter(({ pairId = '' }) => {
        const [address0, address1] = pairId.split('/');
        return (
          (addressA === address0 && addressB === address1) ||
          (addressA === address1 && addressB === address0)
        );
      });
    }
    return shares;
  }, [tokens, data]);
  return { data: shares, error, isValidating };
}

export function useIndexerData() {
  return useContext(IndexerContext).indexer;
}

export function useIndexerPairData(
  tokenA?: TokenAddress,
  tokenB?: TokenAddress
) {
  const { data: pairs, isValidating, error } = useIndexerData();
  const pair =
    pairs && tokenA && tokenB
      ? pairs[getPairID(tokenA, tokenB)] || pairs[getPairID(tokenB, tokenA)]
      : undefined;
  return {
    data: pair,
    error,
    isValidating,
  };
}

export function getBalance(
  token: Token,
  userBalances: UserBankBalance['balances']
): string {
  const denomUnits = token.denom_units;
  const balanceObject = userBalances?.find((balance) => {
    return denomUnits?.find((unit) => unit.denom === balance.denom);
  });
  return (
    (!!balanceObject &&
      balanceObject.amount &&
      Number(balanceObject.amount) > 0 &&
      getAmountInDenom(
        token,
        balanceObject.amount,
        balanceObject.denom,
        token.display
      )) ||
    '0'
  );
}

export function useTokensList() {
  return useContext(IndexerContext).tokens;
}

export function useTokenPairsList() {
  return useContext(IndexerContext).tokenPairs;
}
