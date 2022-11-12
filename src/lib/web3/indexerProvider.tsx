import { useContext, createContext, useState, useEffect, useMemo } from 'react';
import { BigNumber } from 'bignumber.js';
import { Coin } from '@cosmjs/launchpad';

import { MessageActionEvent } from './events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { queryClient } from './generated/duality/nicholasdotsol.duality.dex/module/index';
import {
  DexQueryAllTickMapResponse,
  DexQueryAllSharesResponse,
  DexShares,
  DexTickMap,
  HttpResponse,
  RpcStatus,
  V1Beta1PageResponse,
} from './generated/duality/nicholasdotsol.duality.dex/module/rest';
import { Token } from '../../components/TokenPicker/hooks';
import { FeeType, feeTypes } from './utils/fees';
import { getAmountInDenom } from './utils/tokens';

const { REACT_APP__REST_API } = process.env;

type TokenAddress = string; // a valid hex address, eg. 0x01

interface BalancesResponse {
  balances?: Coin[];
  pagination?: V1Beta1PageResponse;
}
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
  reserve0: BigNumber;
  reserve1: BigNumber;
  totalShares: BigNumber;
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
  shares: Array<DexShares>;
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
      queryClient({ addr: REACT_APP__REST_API })
        .then(async (client) => {
          let nextKey: string | undefined;
          let tickMap: Array<DexTickMap> = [];
          let res: HttpResponse<DexQueryAllTickMapResponse, RpcStatus>;
          do {
            res = await client.queryTickMapAll({
              ...defaultFetchParams,
              'pagination.key': nextKey,
            });
            if (res.ok) {
              tickMap = tickMap.concat(res.data.tickMap || []);
            } else {
              // remove API error details from public view
              throw new Error(`API error code: ${res.error.code}`);
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
  return `${token0}/${token1}`;
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

function transformData(ticks: Array<DexTickMap>): PairMap {
  return ticks.reduce<PairMap>(function (
    result,
    { pairId = '', tickIndex, tickData }
  ) {
    // token0 and token1 are sorted by the back end
    const [token0, token1] = pairId.split('/');
    if (token0 && token1 && tickData) {
      result[pairId] = result[pairId] || {
        token0: token0,
        token1: token1,
        ticks: [],
      };

      feeTypes.forEach(({ fee }, feeIndex) => {
        const totalShares =
          Number(tickData.reserve0AndShares?.[feeIndex].totalShares) ?? -1;
        if (!isNaN(parseInt(tickIndex || '')) && totalShares >= 0) {
          result[pairId].ticks.push({
            tickIndex: new BigNumber(tickIndex || 0),
            // do no use BigNumber.pow here, it is slow enough to make the browser
            // unresponsive for a minute on first page load.
            price: new BigNumber(Math.pow(1.0001, Number(tickIndex) || 0)),
            feeIndex: new BigNumber(feeIndex),
            fee: new BigNumber(fee || 0),
            // todo: don't read total shares here, it makes little sense
            // possibly we should precompute these values into cumulative values
            totalShares: new BigNumber(totalShares),
            reserve0: new BigNumber(
              tickData.reserve0AndShares?.[feeIndex].reserve0 || 0
            ),
            reserve1: new BigNumber(tickData.reserve1?.[feeIndex] || 0),
          });
        }
      });
    }
    return result;
  },
  {});
}

function addTickData(
  oldData: PairMap = {},
  {
    Token0,
    Token1,
    TickIndex,
    FeeIndex,
    SharesMinted,
    NewReserves0,
    NewReserves1,
  }: { [eventKey: string]: string }
): PairMap {
  const pairID = getPairID(Token0, Token1);
  const oldPairInfo = oldData[pairID];
  const newTick: TickInfo = {
    tickIndex: new BigNumber(TickIndex),
    // compute price from TickIndex
    price: new BigNumber(Math.pow(1.0001, Number(TickIndex))),
    feeIndex: new BigNumber(FeeIndex),
    // compute fee from FeeIndex
    fee: new BigNumber(feeTypes[Number(FeeIndex)].fee),
    reserve0: new BigNumber(NewReserves0),
    reserve1: new BigNumber(NewReserves1),
    totalShares: new BigNumber(SharesMinted),
    // todo: if the tick already exists then this data should be combined,
    // instead of creating a new tick
  };

  // note: the ticks structure isn't strictly needed as the pool arrays
  // may be calculated without it. We keep it for now for logic simplicity.
  // The ticks structure is easier to reason about than the pool arrays.
  // This could be refactored for computation or storage optimisation later.
  // see: https://github.com/duality-labz/duality-web-app/pull/102#discussion_r938174401
  const ticks = [...(oldPairInfo?.ticks || []), newTick];
  return {
    ...oldData,
    [pairID]: {
      ...oldPairInfo, // not needed, displayed for consistency
      token0: Token0,
      token1: Token1,
      ticks,
    },
  };
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
  const [, setFetchBankDataState] = useState({
    fetching: false,
    fetched: false,
  });
  const fetchBankData = useMemo(() => {
    if (address) {
      return async () => {
        if (REACT_APP__REST_API) {
          const client = await queryClient({ addr: REACT_APP__REST_API });
          setFetchBankDataState(({ fetched }) => ({ fetching: true, fetched }));
          let nextKey: string | undefined;
          let balances: Array<Coin> = [];
          let res: HttpResponse<BalancesResponse, RpcStatus>;
          do {
            res = await client.request<BalancesResponse, RpcStatus>({
              path: `/cosmos/bank/v1beta1/balances/${address}`,
              method: 'GET',
              format: 'json',
              query: {
                ...defaultFetchParams,
                'pagination.key': nextKey,
              },
            });
            if (res.ok) {
              balances = balances.concat(res.data.balances || []);
            } else {
              setFetchBankDataState(({ fetched }) => ({
                fetching: false,
                fetched,
              }));
              // remove API error details from public view
              throw new Error(`API error code: ${res.error.code}`);
            }
            nextKey = res.data.pagination?.next_key;
          } while (nextKey);
          setFetchBankDataState(() => ({ fetching: false, fetched: true }));
          return balances || [];
        } else {
          throw new Error('Undefined rest api base URL');
        }
      };
    }
  }, [address]);

  useEffect(() => {
    if (fetchBankData) {
      setFetchBankDataState((fetchState) => {
        if (!fetchState.fetched && !fetchState.fetching) {
          fetchBankData().then((data) => {
            setBankData({ balances: data });
          });
        }
        return fetchState;
      });
    }
  }, [fetchBankData]);

  useEffect(() => {
    if (address) {
      const onTxBalanceUpdate = function () {
        fetchBankData?.()?.then((data) => setBankData({ balances: data }));
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
  }, [fetchBankData, address]);

  const [, setFetchShareDataState] = useState({
    fetching: false,
    fetched: false,
  });
  const fetchShareData = useMemo(() => {
    if (address) {
      return async () => {
        if (REACT_APP__REST_API) {
          const client = await queryClient({ addr: REACT_APP__REST_API });
          setFetchShareDataState(({ fetched }) => ({
            fetching: true,
            fetched,
          }));
          let nextKey: string | undefined;
          let shares: Array<DexShares> = [];
          let res: HttpResponse<DexQueryAllSharesResponse, RpcStatus>;
          do {
            res = await client.request<DexQueryAllSharesResponse, RpcStatus>({
              // todo: this query should be sepcific to the user's address
              // however that has not been implemented yet
              // so instead we query all and then filter the results
              path: '/NicholasDotSol/duality/dex/shares',
              method: 'GET',
              format: 'json',
              query: {
                ...defaultFetchParams,
                'pagination.key': nextKey,
              },
            });
            if (res.ok) {
              shares = shares.concat(res.data.shares || []);
            } else {
              setFetchShareDataState(({ fetched }) => ({
                fetching: false,
                fetched,
              }));
              // remove API error details from public view
              throw new Error(`API error code: ${res.error.code}`);
            }
            nextKey = res.data.pagination?.next_key;
          } while (nextKey);
          setFetchShareDataState(() => ({ fetching: false, fetched: true }));
          // filter shares to this wallet
          return shares.filter((share) => share.address === address);
        } else {
          throw new Error('Undefined rest api base URL');
        }
      };
    }
  }, [address]);

  useEffect(() => {
    if (fetchShareData) {
      setFetchShareDataState((fetchState) => {
        if (!fetchState.fetched && !fetchState.fetching) {
          fetchShareData().then((data) => {
            setShareData({ shares: data });
          });
        }
        return fetchState;
      });
    }
  }, [fetchShareData]);

  useEffect(() => {
    let lastRequested = 0;
    const onDexUpdateMessage = function (event: MessageActionEvent) {
      const Token0 = event['message.Token0'];
      const Token1 = event['message.Token1'];
      const TickIndex = event['message.TickIndex'];
      const FeeIndex = event['message.FeeIndex'];
      const NewReserves0 = event['message.NewReserves0'];
      const NewReserves1 = event['message.NewReserves1'];
      const SharesMinted = event['message.SharesMinted'];

      if (
        !Token0 ||
        !Token1 ||
        !TickIndex ||
        !FeeIndex ||
        !NewReserves0 ||
        !NewReserves1 ||
        !SharesMinted
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }
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
      // todo: do a partial update of indexer data
      // setIndexerData((oldData) => {
      //   return addTickData(oldData, {
      //     Token0,
      //     Token1,
      //     TickIndex,
      //     FeeIndex,
      //     SharesMinted,
      //     NewReserves0,
      //     NewReserves1,
      //   });
      // });
    };
    subscriber.subscribeMessage(onDexUpdateMessage, {
      message: { action: 'NewDeposit' },
    });
    subscriber.subscribeMessage(onDexUpdateMessage, {
      message: { action: 'NewWithdraw' },
    });
    return () => {
      subscriber.unsubscribeMessage(onDexUpdateMessage);
    };
  }, []);

  useEffect(() => {
    const onRouterUpdateMessage = function (event: MessageActionEvent) {
      const {
        TokenIn,
        TokenOut,
        NewReserve0,
        NewReserve1,
        PriceOfSwap,
        FeeOfSwap,
      } = event;
      // skip NewSwap events that are not about individual swaps
      // eg. the final NewSwap event of a MsgSwap action is the "overall" swap details
      if (!PriceOfSwap) return;
      if (
        !TokenIn ||
        !TokenOut ||
        !PriceOfSwap ||
        !FeeOfSwap ||
        !NewReserve0 ||
        !NewReserve1
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }
      setIndexerData((oldData = {}) => {
        // NewSwap is movement of existing ticks so the pair should already exist
        const [forward, reverse] = hasMatchingPairOfOrder(
          oldData,
          TokenIn,
          TokenOut
        );
        if (forward || reverse) {
          return addTickData(oldData, {
            Token0: forward ? TokenIn : TokenOut,
            Token1: forward ? TokenOut : TokenIn,
            Price: PriceOfSwap,
            Fee: FeeOfSwap,
            NewReserves0: NewReserve0,
            NewReserves1: NewReserve1,
          });
        } else {
          // there is no existing pair for these tokens
          // the app state is either out-of-date or this is the start of a new pair
        }
        return oldData;
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

export function useFeeLiquidityMap(
  tokenA?: TokenAddress,
  tokenB?: TokenAddress
) {
  const {
    data: pair,
    isValidating,
    error,
  } = useIndexerPairData(tokenA, tokenB);
  const feeLiquidityMap = useMemo(() => {
    if (!pair) return;

    const ticks = Object.values(pair.ticks);
    // normalise the data with the sum of values
    const totalLiquidity = ticks.reduce((result, tickData) => {
      return result.plus(tickData.totalShares || 0);
    }, new BigNumber(0));

    const feeTypeLiquidity = feeTypes.reduce<Record<FeeType['fee'], BigNumber>>(
      (result, feeType) => {
        result[feeType.fee] = new BigNumber(0);
        return result;
      },
      {}
    );

    return ticks.reduce<{ [feeTier: string]: BigNumber }>(
      (result, { fee, totalShares }) => {
        if (totalShares.isGreaterThan(0)) {
          const feeString = fee.toFixed();
          result[feeString] = result[feeString].plus(
            totalShares.dividedBy(totalLiquidity)
          );
        }
        return result;
      },
      feeTypeLiquidity
    );
  }, [pair]);

  return {
    data: feeLiquidityMap,
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
