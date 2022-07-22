import { useContext, createContext, useState, useEffect } from 'react';
import {
  EventType,
  createSubscriptionManager,
  MessageActionEvent,
} from './events';
import { BigNumber } from 'bignumber.js';

const { REACT_APP__REST_API, REACT_APP__WEBSOCKET_URL } = process.env;

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
  pairs: PairMap;
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

function getPairID(token0: string, token1: string) {
  return `${token0}-${token1}`;
  // warning: will throw an error if `tokens` aren't valid hex addresses
  // return utils.solidityKeccak256(['address[2]'], [tokens.slice().sort()]);
}

function getTickID(price0: string, price1: string, fee: string) {
  return `${price0}-${price1}-${fee}`;
  //return utils.solidityKeccak256(['uint256', 'uint256', 'uint256'], [price0, price1, fee]);
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
}): Promise<PairMap> {
  return new Promise(function (resolve) {
    resolve(
      data.tick.reduce<PairMap>(function (
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
      {})
    );
  });
}

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const [indexerData, setIndexerData] = useState<{
    [pairID: string]: PairInfo;
  }>();
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
      setIndexerData((oldData) => {
        if (!oldData) oldData = {};
        oldData[pairID] = oldData[pairID] || {
          ticks: {},
          token0: Token0,
          token1: Token1,
        };
        const tickInfo = oldData[pairID].ticks[tickID] || {
          price0: new BigNumber(Price0),
          price1: new BigNumber(Price1),
          fee: new BigNumber(Fee),
        };
        tickInfo.reserves0 = new BigNumber(NewReserves0);
        tickInfo.reserves1 = new BigNumber(NewReserves1);
        oldData[pairID].ticks[tickID] = tickInfo;
        return { ...oldData };
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
    setResult({ pairs: indexerData ?? {}, error: error });
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
