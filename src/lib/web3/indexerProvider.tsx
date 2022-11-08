import { useContext, createContext, useState, useEffect, useMemo } from 'react';
import { BigNumber } from 'bignumber.js';
import { Coin } from '@cosmjs/launchpad';

import { MessageActionEvent } from './events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { queryClient } from './generated/duality/nicholasdotsol.duality.dex/module/index';
import {
  DexQueryAllSharesResponse,
  DexShares,
  DexTickMap,
  RpcStatus,
  V1Beta1PageResponse,
} from './generated/duality/nicholasdotsol.duality.dex/module/rest';
import { Token } from '../../components/TokenPicker/hooks';
import { FeeType, feeTypes } from './utils/fees';
import { getAmountInDenom } from './utils/tokens';

const { REACT_APP__REST_API } = process.env;

type TokenAddress = string; // a valid hex address, eg. 0x01
type BigNumberString = string; // a number in string format, eg. "1"

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

function getFullData(): Promise<PairMap> {
  return new Promise(function (resolve, reject) {
    if (!REACT_APP__REST_API) {
      reject(new Error('Undefined rest api base URL'));
    } else {
      // TODO: handle pagination
      queryClient({ addr: REACT_APP__REST_API })
        .then((client) => client.queryTickMapAll())
        .then((res) => {
          if (res.ok) {
            return res.data;
          } else {
            // remove API error details from public view
            throw new Error(`API error code: ${res.error.code}`);
          }
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
  return `${token0}-${token1}`;
}

/**
 * Gets the tick id
 * @param price price ratio of (token 1) / (token 0)
 * @param fee tick's fee
 * @returns tick id
 */
function getTickID(
  price: BigNumberString, // decimal form eg. "1.000000000000000000"
  fee: BigNumberString // decimal form eg. "1.000000000000000000"
) {
  return `${price}-${fee}`;
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
        result[pairId].ticks.push({
          tickIndex: new BigNumber(tickIndex || 0),
          price: new BigNumber(1.0001).pow(tickIndex || 0),
          feeIndex: new BigNumber(feeIndex),
          fee: new BigNumber(fee || 0),
          totalShares: new BigNumber(
            tickData.reserve0AndShares?.[feeIndex].totalShares || 0
          ),
          reserve0: new BigNumber(
            tickData.reserve0AndShares?.[feeIndex].reserve0 || 0
          ),
          reserve1: new BigNumber(tickData.reserve1?.[feeIndex] || 0),
        });
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
    Price,
    Fee,
    NewReserves0,
    NewReserves1,
  }: { [eventKey: string]: string }
): PairMap {
  const pairID = getPairID(Token0, Token1);
  const tickID = getTickID(Price, Fee);
  const oldPairInfo = oldData[pairID];
  const price = new BigNumber(Price);
  const fee = new BigNumber(Fee);
  const reserve0 = new BigNumber(NewReserves0);
  const reserve1 = new BigNumber(NewReserves1);
  const newTick: TickInfo = {
    price,
    tickIndex: new BigNumber(0),
    fee,
    feeIndex: new BigNumber(0),
    reserve0,
    reserve1,
    // calculate new total
    // TODO: the back end may provide the totalShares property in the future
    // so it should be used as the source of truth and not recalculated here
    totalShares: reserve0.plus(reserve1.multipliedBy(price)),
  };
  const newPoolTicks: PoolTicks = [undefined, undefined];
  if (reserve0.isGreaterThan(0)) {
    newPoolTicks[0] = newTick;
  }
  if (reserve1.isGreaterThan(0)) {
    newPoolTicks[1] = newTick;
  }
  // note: the ticks structure isn't strictly needed as the pool arrays
  // may be calculated without it. We keep it for now for logic simplicity.
  // The ticks structure is easier to reason about than the pool arrays.
  // This could be refactored for computation or storage optimisation later.
  // see: https://github.com/duality-labz/duality-web-app/pull/102#discussion_r938174401
  const ticks = {
    ...oldPairInfo?.ticks,
    [tickID]: newPoolTicks,
  };
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
          const res = await client.request<BalancesResponse, RpcStatus>({
            path: `/cosmos/bank/v1beta1/balances/${address}`,
            method: 'GET',
            format: 'json',
          });
          if (res.ok) {
            setFetchBankDataState(() => ({ fetching: false, fetched: true }));
            return res.data.balances || [];
          } else {
            setFetchBankDataState(({ fetched }) => ({
              fetching: false,
              fetched,
            }));
            // remove API error details from public view
            throw new Error(`API error code: ${res.error.code}`);
          }
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
          const res = await client.request<
            DexQueryAllSharesResponse,
            RpcStatus
          >({
            // todo: this query should be sepcific to the user's address
            // however that has not been implemented yet
            // so instead we query all and then filter the results
            path: '/NicholasDotSol/duality/dex/shares',
            method: 'GET',
            format: 'json',
          });
          if (res.ok) {
            setFetchShareDataState(() => ({ fetching: false, fetched: true }));
            const shares = res.data.shares || [];
            // filter shares to this wallet
            return shares.filter((share) => share.address === address);
          } else {
            setFetchShareDataState(({ fetched }) => ({
              fetching: false,
              fetched,
            }));
            // remove API error details from public view
            throw new Error(`API error code: ${res.error.code}`);
          }
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

  useEffect(() => {
    const onDexUpdateMessage = function (event: MessageActionEvent) {
      const { Token0, Token1, NewReserves0, NewReserves1, Price, Fee } = event;
      if (
        !Token0 ||
        !Token1 ||
        !Price ||
        !NewReserves0 ||
        !NewReserves1 ||
        !Fee
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }
      setIndexerData((oldData) => {
        return addTickData(oldData, {
          Token0,
          Token1,
          Price,
          Fee,
          NewReserves0,
          NewReserves1,
        });
      });
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
      setIndexerData((oldData) => {
        // NewSwap is movement of existing ticks so the pair should already exist
        const forward = !!oldData?.[getPairID(TokenIn, TokenOut)];
        const reverse = !!oldData?.[getPairID(TokenOut, TokenIn)];
        if (forward || reverse) {
          return addTickData(oldData, {
            Token0: forward ? TokenIn : TokenOut,
            Token1: forward ? TokenOut : TokenIn,
            Price: PriceOfSwap,
            Fee: FeeOfSwap,
            NewReserves0: NewReserve0,
            NewReserves1: NewReserve1,
          });
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
  const [token0, token1] = [tokenA, tokenB].sort();
  const pair =
    pairs && token0 && token1
      ? pairs[getPairID(token0, token1)] || pairs[getPairID(token1, token0)]
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
