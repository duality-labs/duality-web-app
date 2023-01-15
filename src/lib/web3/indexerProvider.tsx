import {
  useContext,
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import { BigNumber } from 'bignumber.js';
import { Coin } from '@cosmjs/launchpad';

import { MessageActionEvent } from './events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { queryClient as bankClient } from './generated/ts-client/cosmos.bank.v1beta1/module';
import { Api as BankApi } from './generated/ts-client/cosmos.bank.v1beta1/rest';
import { queryClient } from './generated/ts-client/nicholasdotsol.duality.dex/module';
import {
  DexTick,
  Api,
} from './generated/ts-client/nicholasdotsol.duality.dex/rest';
import {
  addressableTokenMap as tokenMap,
  Token,
} from '../../components/TokenPicker/hooks';
import { feeTypes } from './utils/fees';
import { getAmountInDenom } from './utils/tokens';
import { calculateShares } from './utils/ticks';
import { IndexedShare } from './utils/shares';

const { REACT_APP__REST_API } = process.env;

export type TokenAddress = string; // a valid hex address, eg. 0x01

export interface PairInfo {
  token0: string;
  token1: string;
  ticks: TickInfo[];
}

/**
 * TickMap contains a mapping from tickIDs to tick indexes inside poolsZeroToOne and poolsOneToZero
 */
export interface TickMap {
  [tickID: string]: PoolTicks;
}

type PoolTicks = [
  index0to1: TickInfo | undefined,
  index1to0: TickInfo | undefined
];

/**
 * TickInfo is a reflection of the backend structue "DexPool"
 * but utilising BigNumber type instead of BigNumberString type properties
 */
export interface TickInfo {
  token0: Token;
  token1: Token;
  reserve0: BigNumber;
  reserve1: BigNumber;
  fee: BigNumber;
  feeIndex: BigNumber; // feeIndex is the index of a certain predefined fee
  tickIndex: BigNumber; // tickIndex is the exact price ratio in the form: 1.0001^[tickIndex]
  price: BigNumber; // price is an approximate decimal (to 18 places) ratio of price1/price0
}

export interface PairMap {
  [pairID: string]: PairInfo;
}

interface UserBankBalance {
  balances: Array<Coin>;
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
});

const defaultFetchParams = {
  'pagination.limit': '1000',
};

function getFullData(): Promise<PairMap> {
  return new Promise(function (resolve, reject) {
    if (!REACT_APP__REST_API) {
      reject(new Error('Undefined rest api base URL'));
    } else {
      new Promise<Api<unknown>>((resolve) =>
        resolve(queryClient({ addr: REACT_APP__REST_API }))
      )
        .then(async (client) => {
          let nextKey: string | undefined;
          let tickMap: Array<DexTick> = [];
          let res: Awaited<ReturnType<Api<unknown>['queryTickAll']>>;
          do {
            res = await client.queryTickAll({
              ...defaultFetchParams,
              'pagination.key': nextKey,
            });
            if (res.status === 200) {
              tickMap = tickMap.concat(res.data.Tick || []);
            } else {
              // remove API error details from public view
              throw new Error(
                `API error code: ${res.status} ${res.statusText}`
              );
            }
            nextKey = res.data.pagination?.next_key;
          } while (nextKey);
          return {
            ...res.data,
            tickMap: tickMap,
          };
        })
        .then((data) => transformData(data.tickMap || []))
        .then(resolve)
        .catch(reject);
    }
  });
}

/**
 * Gets the pair id for a sorted pair of tokens
 * @param token0 address of token 0
 * @param token1 address of token 1
 * @returns pair id for tokens
 */
export function getPairID(token0: TokenAddress, token1: TokenAddress) {
  return `${token0}<>${token1}`;
}

/**
 * Check if the current TokenA/TokenB pair is in the same order as Token0/1
 * @param pairID pair id for tokens
 * @param tokenA address of token A
 * @param tokenB address of token B
 * @returns bool for inverted order
 */
export function hasInvertedOrder(
  pairID: string,
  tokenA: string,
  tokenB: string
): boolean {
  return getPairID(tokenA, tokenB) !== pairID;
}

/**
 * Checks given token pair against stored data to determine
 * if the current TokenA/TokenB pair exists and is in the same order as Token0/1
 * @param pairMap pair map of stored tokens
 * @param tokenA address of token A
 * @param tokenB address of token B
 * @returns [isSorted, isInverseSorted] array for determining sort order (both may be `false` if pair is not found)
 */
export function hasMatchingPairOfOrder(
  pairMap: PairMap,
  tokenA: string,
  tokenB: string
): [boolean, boolean] {
  const forward = !!pairMap?.[getPairID(tokenA, tokenB)];
  const reverse = !!pairMap?.[getPairID(tokenB, tokenA)];
  return [forward, reverse];
}

function transformData(ticks: Array<DexTick>): PairMap {
  const intermediate = ticks.reduce<PairMap>(function (
    result,
    { pairId = '', tickIndex, tickData }
  ) {
    // token0 and token1 are sorted by the back end
    const [token0, token1] = pairId.split('<>');
    if (token0 && token1 && tokenMap[token0] && tokenMap[token1] && tickData) {
      result[pairId] = result[pairId] || {
        token0: token0,
        token1: token1,
        ticks: [],
      };

      feeTypes.forEach(({ fee }, feeIndex) => {
        if (!isNaN(parseInt(tickIndex || ''))) {
          result[pairId].ticks.push({
            token0: tokenMap[token0],
            token1: tokenMap[token1],
            tickIndex: new BigNumber(tickIndex || 0),
            // do no use BigNumber.pow here, it is slow enough to make the browser
            // unresponsive for a minute on first page load.
            price: new BigNumber(Math.pow(1.0001, Number(tickIndex) || 0)),
            feeIndex: new BigNumber(feeIndex),
            fee: new BigNumber(fee || 0),
            reserve0: new BigNumber(tickData.reserve0?.[feeIndex] || 0),
            reserve1: new BigNumber(tickData.reserve1?.[feeIndex] || 0),
          });
        }
      });
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
        ticks: pairInfo.ticks.sort((a, b) => {
          // sort by tickIndex (price) then feeIndex
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
  const [bankData, setBankData] = useState<UserBankBalance>();
  const [shareData, setShareData] = useState<UserShares>();
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
                [Array<Coin>, Array<IndexedShare>]
              >(
                ([tokens, tokenizedShares], coin) => {
                  const [, token0, token1, tickIndex, feeTier] =
                    coin.denom.match(
                      /^DualityLPShares-([^-]+)-([^-]+)-t(-?\d+)-f(\d+)$/
                    ) || [];
                  // transform tokenized shares into shares
                  if (token0 && token1 && tickIndex && feeTier) {
                    // calculate tokenized shares here
                    const feeIndex = feeTypes.findIndex(
                      ({ fee }) => fee === Number(feeTier) / 10000
                    );
                    // add tokenized share if everything is fine
                    if (address && feeIndex >= 0) {
                      const tokenizedShare = {
                        address,
                        pairId: getPairID(token0, token1),
                        tickIndex,
                        feeIndex: `${feeIndex}`,
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
        if (address && REACT_APP__REST_API) {
          const client = bankClient({ addr: REACT_APP__REST_API });
          setFetchBankDataState(({ fetched }) => ({ fetching: true, fetched }));
          let nextKey: string | undefined;
          let balances: Array<Coin> = [];
          let res: Awaited<ReturnType<BankApi<unknown>['queryAllBalances']>>;
          // let res: HttpResponse<BalancesResponse, RpcStatus>;
          do {
            res = await client.queryAllBalances(address, {
              ...defaultFetchParams,
              'pagination.key': nextKey,
            });
            if (res.status === 200) {
              const nonZeroBalances = res.data.balances?.filter(
                (balance): balance is Coin => balance.amount !== undefined
              );
              balances = balances.concat(nonZeroBalances || []);
            } else {
              setFetchBankDataState(({ fetched }) => ({
                fetching: false,
                fetched,
              }));
              // remove API error details from public view
              throw new Error(
                `API error code: ${res.status} ${res.statusText}`
              );
            }
            nextKey = res.data.pagination?.next_key;
          } while (nextKey);
          setFetchBankDataState(() => ({ fetching: false, fetched: true }));
          return balances || [];
        } else if (!REACT_APP__REST_API) {
          throw new Error('Undefined rest api base URL');
        }
      }
    },
    [address]
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
        getFullData()
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
  }, [address]);

  useEffect(() => {
    const onRouterUpdateMessage = function (event: MessageActionEvent) {
      const Creator = event['message.Creator'];
      const Token0 = event['message.Token0'];
      const Token1 = event['message.Token1'];
      const TokenIn = event['message.TokenIn'];
      const AmountIn = event['message.AmountIn'];
      const AmountOut = event['message.AmountOut'];
      const MinOut = event['message.MinOut'];
      if (
        !Creator ||
        !TokenIn ||
        !Token0 ||
        !Token1 ||
        !AmountIn ||
        !AmountOut ||
        !MinOut
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }

      const forward = TokenIn === Token0;
      const reverse = TokenIn === Token1;
      if (!forward && !reverse) {
        setError('Unknown error occurred. Incorrect tokens');
        return;
      }

      // todo: update something without refetching?
      // may not be possible or helpful
      // bank balance update will be caught already by the bank event watcher
      // it's too complicated to update indexer state with the event detail's

      // fetch new indexer data as the trade would have caused changes in ticks
      getFullData()
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
  }, []);

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
    });
  }, [bankData, indexerData, shareData, error]);

  useEffect(() => {
    setRequestedFlag((oldValue) => {
      if (oldValue) return true;
      getFullData()
        .then(function (res) {
          setIndexerData(res);
        })
        .catch(function (err: Error) {
          setError(err?.message ?? 'Unknown Error');
        });
      return true;
    });
  }, []);

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
