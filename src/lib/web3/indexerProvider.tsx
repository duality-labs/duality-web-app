import { useContext, createContext, useState, useEffect } from 'react';
import {
  EventType,
  createSubscriptionManager,
  MessageActionEvent,
} from './events';
import { BigNumber } from 'bignumber.js';
import { queryClient } from './generated/duality/nicholasdotsol.duality.dex/module/index';
import { DexTicks } from './generated/duality/nicholasdotsol.duality.dex/module/rest';

const { REACT_APP__REST_API, REACT_APP__WEBSOCKET_URL } = process.env;

type TokenAddress = string; // a valid hex address, eg. 0x01
type BigNumberString = string; // a number in string format, eg. "1"

if (!REACT_APP__WEBSOCKET_URL)
  throw new Error('Invalid value for env variable REACT_APP__WEBSOCKET_URL');
const subscriber = createSubscriptionManager(REACT_APP__WEBSOCKET_URL);

export interface PairInfo {
  token0: string;
  token1: string;
  ticks: { [tickID: string]: TickInfo };
}

/**
 * TickInfo is a reflection of the backend structue "DexPool"
 * but utilising BigNumber type instead of BigNumberString type properties
 */
export interface TickInfo {
  index: number;
  price: BigNumber;
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
function getPairID(token0: TokenAddress, token1: TokenAddress) {
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
    { token0, token1, poolsZeroToOne }
  ) {
    if (token0 && token1 && poolsZeroToOne?.length) {
      const pairID = getPairID(token0, token1);
      poolsZeroToOne.forEach(
        ({ index = 0, price, fee, reserve0, reserve1, totalShares }) => {
          if (
            index >= 0 &&
            price &&
            fee &&
            reserve0 &&
            reserve1 &&
            totalShares
          ) {
            const tickID = getTickID(price, fee);
            result[pairID] = result[pairID] || {
              token0: token0,
              token1: token1,
              ticks: {},
            };
            result[pairID].ticks[tickID] = {
              index,
              price: new BigNumber(price),
              reserve0: new BigNumber(reserve0),
              reserve1: new BigNumber(reserve1),
              fee: new BigNumber(fee),
              totalShares: new BigNumber(totalShares),
            };
          }
        }
      );
    }
    return result;
  },
  {});
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
      const { Token0, Token1, Reserve0, Reserve1, Price, Fee, TotalShares } =
        event;
      if (
        !Token0 ||
        !Token1 ||
        !Price ||
        !Reserve0 ||
        !Reserve1 ||
        !Fee ||
        !TotalShares
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
        return {
          ...oldData,
          [pairID]: {
            ...oldPairInfo, // not needed, displayed for consistency
            token0: Token0,
            token1: Token1,
            ticks: {
              ...oldPairInfo?.ticks,
              [tickID]: {
                ...oldTickInfo, // not needed, displayed for consistency
                price: new BigNumber(Price),
                fee: new BigNumber(Fee),
                reserve0: new BigNumber(Reserve0),
                reserve1: new BigNumber(Reserve1),
                totalShares: new BigNumber(TotalShares),
              },
            },
          },
        };
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
