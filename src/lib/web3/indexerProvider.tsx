import { useContext, createContext, useState, useEffect } from 'react';
import {
  EventType,
  createSubscriptionManager,
  MessageActionEvent,
} from './events';
import { BigNumber } from 'bignumber.js';

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

export interface TickInfo {
  price0: BigNumber;
  price1: BigNumber;
  reserves0: BigNumber;
  reserves1: BigNumber;
  fee: BigNumber;
}

export interface PairMap {
  [pairID: string]: PairInfo;
}

interface IndexerContextType {
  pairs?: PairMap;
  error?: string;
}

const IndexerContext = createContext<IndexerContextType>({
  pairs: {},
});

function getFullData(): Promise<PairMap> {
  return new Promise(function (resolve, reject) {
    if (!REACT_APP__REST_API)
      return reject(new Error('Undefined rest api URL'));
    fetch(REACT_APP__REST_API)
      .then((res) => res.json())
      .then(transformData)
      .then(resolve)
      .catch(reject);
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
 * @param price0 price of token 0
 * @param price1 price of token 1
 * @param fee tick's fee
 * @returns tick id
 */
function getTickID(
  price0: BigNumberString,
  price1: BigNumberString,
  fee: BigNumberString
) {
  return `${price0}-${price1}-${fee}`;
}

function transformData(data: {
  tick: Array<{
    token0: string;
    token1: string;
    price0: string;
    price1: string;
    fee: string;
    reserves0: string;
    reserves1: string;
  }>;
}): PairMap {
  return data.tick.reduce<PairMap>(function (
    result,
    { token0, token1, price0, price1, fee, reserves0, reserves1 }
  ) {
    const pairID = getPairID(token0, token1);
    const tickID = getTickID(price0, price1, fee);
    result[pairID] = result[pairID] || {
      token0: token0,
      token1: token1,
      ticks: {},
    };
    result[pairID].ticks[tickID] = {
      price0: new BigNumber(price0),
      price1: new BigNumber(price1),
      reserves0: new BigNumber(reserves0),
      reserves1: new BigNumber(reserves1),
      fee: new BigNumber(fee),
    };
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
    pairs: indexerData ?? {},
    error: error,
  });

  useEffect(() => {
    const onTickChange = function (event: MessageActionEvent) {
      const {
        Token0,
        Token1,
        NewReserves0,
        NewReserves1,
        Price0,
        Price1,
        Fee,
      } = event;
      if (
        !Token0 ||
        !Token1 ||
        !Price0 ||
        !Price1 ||
        !NewReserves0 ||
        !NewReserves1 ||
        !Fee
      ) {
        setError('Invalid event response from server');
        return;
      }
      const pairID = getPairID(Token0, Token1);
      const tickID = getTickID(Price0, Price1, Fee);
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
                price0: new BigNumber(Price0),
                price1: new BigNumber(Price1),
                fee: new BigNumber(Fee),
                reserves0: new BigNumber(NewReserves0),
                reserves1: new BigNumber(NewReserves1),
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
    setResult({ pairs: indexerData, error: error });
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
