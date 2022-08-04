import { useContext, createContext, useState, useEffect } from 'react';
import {
  EventType,
  createSubscriptionManager,
  MessageActionEvent,
} from './events';
import { BigNumber } from 'bignumber.js';
import { queryClient } from './generated/duality/nicholasdotsol.duality.dex/module/index';
import {
  DexPool,
  DexTicks,
} from './generated/duality/nicholasdotsol.duality.dex/module/rest';

const { REACT_APP__REST_API, REACT_APP__WEBSOCKET_URL } = process.env;

type TokenAddress = string; // a valid hex address, eg. 0x01
type BigNumberString = string; // a number in string format, eg. "1"

if (!REACT_APP__WEBSOCKET_URL)
  throw new Error('Invalid value for env variable REACT_APP__WEBSOCKET_URL');
const subscriber = createSubscriptionManager(REACT_APP__WEBSOCKET_URL);

export interface PairInfo {
  token0: string;
  token1: string;
  ticks: TickMap;
  poolsZeroToOne: Array<TickInfo>;
  poolsOneToZero: Array<TickInfo>;
}

/**
 * TickMap contains a mapping from tickIDs to tick indexes inside poolsZeroToOne and poolsOneToZero
 */
interface TickMap {
  [tickID: string]: [index0to1: TickInfo, index1to0: TickInfo];
}

/**
 * TickInfo is a reflection of the backend structue "DexPool"
 * but utilising BigNumber type instead of BigNumberString type properties
 */
export interface TickInfo {
  // index: number; do not store index as they may change with partial updates
  price: BigNumber; // price is a decimal (to 18 places) ratio of price1/price0
  reserve0: BigNumber;
  reserve1: BigNumber;
  fee: BigNumber;
  totalShares: BigNumber;
}

export interface PairMap {
  [pairID: string]: PairInfo;
}

interface IndexerContextType {
  data?: PairMap;
  error?: string;
  isValidating: boolean;
}

const IndexerContext = createContext<IndexerContextType>({
  isValidating: true,
});

function getFullData(): Promise<PairMap> {
  return new Promise(function (resolve, reject) {
    if (!REACT_APP__REST_API) {
      reject(new Error('Undefined rest api base URL'));
    } else {
      // TODO: handle pagination
      queryClient({ addr: REACT_APP__REST_API })
        .then((client) => client.queryTicksAll())
        .then((res) => {
          if (res.ok) {
            return res.data;
          } else {
            // remove API error details from public view
            throw new Error(`API error code: ${res.error.code}`);
          }
        })
        .then((data) => transformData(data.ticks || []))
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

function transformData(ticks: Array<DexTicks>): PairMap {
  return ticks.reduce<PairMap>(function (
    result,
    // token0 and token1 are sorted by the back end
    { token0, token1, poolsZeroToOne = [], poolsOneToZero = [] }
  ) {
    if (token0 && token1 && poolsZeroToOne?.length) {
      const pairID = getPairID(token0, token1);
      const ticks: TickMap = {};
      result[pairID] = {
        token0: token0,
        token1: token1,
        ticks: ticks,
        poolsZeroToOne: poolsZeroToOne
          .map((dexPool) => {
            const tickInfo = toTickInfo(dexPool);
            const { price, fee } = dexPool;
            // append tickInfo into tickID map before returning defined values
            if (tickInfo && price && fee) {
              const tickID = getTickID(price, fee);
              ticks[tickID] = ticks[tickID] || [];
              ticks[tickID][0] = tickInfo;
            }
            return tickInfo;
          })
          .filter(Boolean) as Array<TickInfo>,
        poolsOneToZero: poolsOneToZero
          .map((dexPool) => {
            const tickInfo = toTickInfo(dexPool);
            const { price, fee } = dexPool;
            // append tickInfo into tickID map before returning defined values
            if (tickInfo && price && fee) {
              const tickID = getTickID(price, fee);
              ticks[tickID] = ticks[tickID] || [];
              ticks[tickID][1] = tickInfo;
            }
            return tickInfo;
          })
          .filter(Boolean) as Array<TickInfo>,
      };
    }
    return result;
  }, {});
  // convert from API JSON big number strings to BigNumbers
  function toTickInfo({
    price,
    reserve0,
    reserve1,
    fee,
    totalShares,
  }: DexPool): TickInfo | undefined {
    if (price && reserve0 && reserve1 && fee && totalShares) {
      const tickInfo = {
        price: new BigNumber(price),
        reserve0: new BigNumber(reserve0),
        reserve1: new BigNumber(reserve1),
        fee: new BigNumber(fee),
        totalShares: new BigNumber(totalShares),
      };
      return tickInfo;
    }
  }
}

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const [indexerData, setIndexerData] = useState<PairMap>();
  const [error, setError] = useState<string>();
  // avoid sending more than once
  const [, setRequestedFlag] = useState(false);
  const [result, setResult] = useState<IndexerContextType>({
    data: indexerData,
    error: error,
    isValidating: true,
  });

  useEffect(() => {
    const onTickChange = function (event: MessageActionEvent) {
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
      const pairID = getPairID(Token0, Token1);
      const tickID = getTickID(Price, Fee);
      setIndexerData((oldData = {}) => {
        const oldPairInfo = oldData[pairID];
        const oldTickInfo = oldPairInfo?.ticks?.[tickID];
        const price = new BigNumber(Price);
        const fee = new BigNumber(Fee);
        const reserve0 = new BigNumber(NewReserves0);
        const reserve1 = new BigNumber(NewReserves1);
        const ticks = {
          ...oldPairInfo?.ticks,
          [tickID]: {
            ...oldTickInfo, // not needed, displayed for consistency
            price,
            fee,
            reserve0,
            reserve1,
            // calculate new total
            totalShares: reserve0.plus(reserve1.multipliedBy(price)),
          },
        };
        return {
          ...oldData,
          [pairID]: {
            ...oldPairInfo, // not needed, displayed for consistency
            token0: Token0,
            token1: Token1,
            ticks,
            // reorder pools by "real" price (the price after fees are applied)
            poolsZeroToOne: Object.values(ticks)
              .map((ticks) => ticks[0])
              .sort((a, b) =>
                getRealPrice(a, 1).minus(getRealPrice(b, 1)).toNumber()
              ),
            poolsOneToZero: Object.values(ticks)
              .map((ticks) => ticks[1])
              .sort((a, b) =>
                getRealPrice(b, -1).minus(getRealPrice(a, -1)).toNumber()
              ),
          },
        };
        function getRealPrice(tick: TickInfo, forward: number) {
          return forward >= 0
            ? tick.price.plus(tick.fee)
            : tick.price.minus(tick.fee);
        }
      });
    };
    subscriber.subscribeMessage(onTickChange, EventType.EventTxValue, {
      messageAction: 'NewDeposit',
    });
    subscriber.subscribeMessage(onTickChange, EventType.EventTxValue, {
      messageAction: 'NewWithdraw',
    });
    return () => {
      subscriber.unsubscribeMessage(onTickChange);
    };
  }, []);

  useEffect(() => {
    setResult({
      data: indexerData,
      error: error,
      isValidating: !indexerData && !error,
    });
  }, [indexerData, error]);

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

export function useIndexerData() {
  return useContext(IndexerContext);
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
