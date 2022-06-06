import { useContext, createContext, useState, useEffect } from 'react';

export interface PairInfo {
  ticks: { [tickID: string]: TickInfo };
}

export interface TickInfo {
  price0: string;
  price1: string;
  reserves0: string;
  reserves1: string;
  jitProtected: boolean;
  fee: string;
}

interface IndexerContextType {
  pairs: { [pairID: string]: PairInfo };
  error?: string;
}

const IndexerContext = createContext<IndexerContextType>({
  pairs: {},
});

const indexerURL = process.env.REACT_APP__INDEXER_URL;

function getFullData(): Promise<{ [pairID: string]: PairInfo }> {
  return new Promise(function (resolve, reject) {
    if (!indexerURL) return reject(new Error('Undefined indexer URL'));
    fetch(indexerURL)
      .then((res) => res.json())
      .then(function (res: { [pairID: string]: PairInfo }) {
        resolve(res);
      })
      .catch(reject);
  });
}

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const [indexerData, setIndexerData] = useState<{
    [pairID: string]: PairInfo;
  }>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    getFullData()
      .then(function (res) {
        setIndexerData(res);
      })
      .catch(function (err: Error) {
        setError(err?.message ?? 'Unknown Error');
      });
  }, []);

  return (
    <IndexerContext.Provider value={{ pairs: indexerData ?? {}, error: error }}>
      {children}
    </IndexerContext.Provider>
  );
}

export function useIndexerData() {
  return useContext(IndexerContext);
}
