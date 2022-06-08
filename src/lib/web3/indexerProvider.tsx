import { useContext, createContext, useState, useEffect } from 'react';
import { getContractAddress, Contract } from './getContract';
import { useWeb3 } from './useWeb3';

import { BigNumber, utils } from 'ethers';

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
  jitProtected: boolean;
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

const indexerURL = process.env.REACT_APP__INDEXER_URL;

function getFullData(): Promise<PairMap> {
  return new Promise(function (resolve, reject) {
    if (!indexerURL) return reject(new Error('Undefined indexer URL'));
    fetch(indexerURL)
      .then((res) => res.json())
      .then(transformData)
      .then(resolve)
      .catch(reject);
  });
}

function transformData(data: {
  [pairKey: string]: { [tickKey: string]: Array<string> };
}): Promise<PairMap> {
  return new Promise(function (resolve) {
    resolve(
      Object.entries(data).reduce<PairMap>(function (
        result,
        [pairKey, pairInfo]
      ) {
        const [token0, token1] = pairKey.split('-');
        const ticks = Object.entries(pairInfo).reduce<{
          [tickID: string]: TickInfo;
        }>(function (result, [tickKey, tickInfo]) {
          const [price0, price1, fee, jitProtected] = tickKey.split('-');
          const [reserves0, reserves1] = tickInfo;
          result[tickKey] = {
            price0: BigNumber.from(price0),
            price1: BigNumber.from(price1),
            reserves0: BigNumber.from(reserves0),
            reserves1: BigNumber.from(reserves1),
            jitProtected: jitProtected === '1',
            fee: BigNumber.from(fee),
          };
          return result;
        }, {});
        result[pairKey] = {
          token0: token0,
          token1: token1,
          ticks: ticks,
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
  const [eventDetector, setEventDetector] = useState({});
  const [blockDetector, setBlockDetector] = useState<object>();
  const { provider } = useWeb3();

  useEffect(() => {
    const timeoutID = setTimeout(() => {
      setBlockDetector({});
    }, 100);
    return () => {
      clearTimeout(timeoutID);
    };
  }, [eventDetector]);

  useEffect(() => {
    if (!provider) return;
    const filter = {
      address: getContractAddress(Contract.DUALITY_CORE),
      topics: [
        [
          utils.id('Swap0to1(bytes32,uint120[3],uint256)'),
          utils.id('Swap1to0(bytes32,uint120[3],uint256)'),
          utils.id('Deposit(address[2],uint120[3],uint128[2])'),
          utils.id('Withdraw(address[2],uint120[3],uint128[2])'),
        ],
      ],
    };
    provider.on(filter, onEvent);
    return () => {
      provider.removeListener(filter, onEvent);
    };

    function onEvent() {
      setEventDetector({});
    }
  }, [provider]);

  useEffect(() => {
    if (!blockDetector) return;
    getFullData()
      .then(function (res) {
        setIndexerData(res);
      })
      .catch(function (err: Error) {
        setError(err?.message ?? 'Unknown Error');
      });
  }, [blockDetector]);

  return (
    <IndexerContext.Provider value={{ pairs: indexerData ?? {}, error: error }}>
      {children}
    </IndexerContext.Provider>
  );
}

export function useIndexerData() {
  return useContext(IndexerContext);
}
