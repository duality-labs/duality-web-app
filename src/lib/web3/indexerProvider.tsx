import {
  useContext,
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import Long from 'long';
import { cosmos } from '@duality-labs/dualityjs';

import { MessageActionEvent, TendermintTxData } from './events';
import { DexTickUpdateEvent, mapEventAttributes } from './utils/events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { useRpcPromise } from './rpcQueryClient';
import useTokens, {
  matchTokenByDenom,
  useTokensWithIbcInfo,
} from '../../lib/web3/hooks/useTokens';
import useTokenPairs, { TokenPairReserves } from './hooks/useTokenPairs';

import { Token } from './utils/tokens';
import { isDexShare } from './utils/shares';
import { PairIdString, getPairID } from './utils/pairs';

import { Coin } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { PageRequest } from '@duality-labs/dualityjs/types/codegen/helpers.d';
import { QueryAllBalancesResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';

const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;

interface UserBankBalance {
  balances: Array<Coin>;
}

interface PairUpdateHeightData {
  [pairID: string]: number; // block height
}

interface IndexerContextType {
  bank: {
    data?: UserBankBalance;
    isValidating: boolean;
  };
  tokens: {
    data?: Token[];
    isValidating: boolean;
  };
  tokenPairs: {
    data?: TokenPairReserves[];
    isValidating: boolean;
  };
  pairUpdateHeight: PairUpdateHeightData;
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
  tokens: {
    isValidating: true,
  },
  tokenPairs: {
    isValidating: true,
  },
  pairUpdateHeight: {},
});

const defaultFetchParams: Partial<PageRequest> = {
  limit: Long.fromNumber(1000),
  countTotal: true,
};

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const [bankData, setBankData] = useState<UserBankBalance>();
  const [poolUpdateHeightData, setPoolUpdateHeightData] =
    useState<PairUpdateHeightData>({});
  const tokensData = useTokens();
  const { data: tokenPairsData } = useTokenPairs();

  const rpcPromise = useRpcPromise();

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
            .then((coins = []) => {
              // separate out 'normal' and 'share' tokens from the bank balance
              const nonDexCoins = coins.filter((coin) => !isDexShare(coin));
              setBankData({ balances: nonDexCoins });
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

      async function fetchBankData(): Promise<Coin[] | undefined> {
        const rpc = await rpcPromise;
        if (address && rpc) {
          const client = new bankClientImpl(rpc);
          setFetchBankDataState(({ fetched }) => ({ fetching: true, fetched }));
          let nextKey: Uint8Array | undefined;
          let balances: Array<Coin> = [];
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
                (balance: Coin): balance is Coin => balance.amount !== undefined
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
            nextKey = res.pagination?.next_key;
          } while (nextKey && nextKey.length > 0);
          setFetchBankDataState(() => ({ fetching: false, fetched: true }));
          return balances;
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

  // update bank balance and pool height whenever the user completes a Tx
  useEffect(() => {
    if (address) {
      const onTxBalanceUpdate = (
        event: MessageActionEvent,
        tx: TendermintTxData
      ) => {
        // update bank
        updateBankData();
        // update pool heights for pages to fetch nex data for
        if (tx?.value?.TxResult) {
          updatePairUpdateHeightData(tx.value.TxResult);
        }
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
    function updatePairUpdateHeightData(
      txResult: TendermintTxData['value']['TxResult']
    ) {
      const height = Number(txResult.height);
      const events = txResult.result.events;
      if (events && events.length > 0 && !isNaN(height)) {
        // find tick Update events
        const tickUpdateEvents = events
          .map(mapEventAttributes)
          .filter((event): event is DexTickUpdateEvent => {
            return (
              (event as DexTickUpdateEvent).attributes.action === 'TickUpdate'
            );
          });
        // collect token heights to change
        if (tickUpdateEvents.length > 0) {
          setPoolUpdateHeightData((poolUpdateHeightData) => {
            return tickUpdateEvents.reduce(
              (poolUpdateHeightData, event) => {
                const pairID = getPairID(
                  event.attributes.TokenZero,
                  event.attributes.TokenOne
                );
                poolUpdateHeightData[pairID] = height;
                return poolUpdateHeightData;
              },
              {
                ...poolUpdateHeightData,
              }
            );
          });
        }
      }
    }
  }, [updateBankData, address]);

  const result = useMemo(() => {
    return {
      // todo: pass whole query responses here
      bank: {
        data: bankData,
        isValidating: !bankData,
      },
      tokens: {
        data: tokensData,
        isValidating: !bankData,
      },
      tokenPairs: {
        data: tokenPairsData,
        // note: token pairs uses a real-time indexer endpoint for data
        //       so it should always be validating
        isValidating: true,
      },
      pairUpdateHeight: poolUpdateHeightData,
    };
  }, [bankData, tokensData, tokenPairsData, poolUpdateHeightData]);

  return (
    <IndexerContext.Provider value={result}>{children}</IndexerContext.Provider>
  );
}

// note avoid using bank data directly, as we almost certainly want to use
// useBankBalances which matches IBC tokens based on current chain IBC context
function useBankData() {
  return useContext(IndexerContext).bank;
}

// define TokenCoin to represent a Coin paired with its chain-registry token
export type TokenCoin = Coin & { token: Token };

// get all the user's bank balance amounts of known tokens
// this includes IBC tokens using our known current chain IBC context
export function useBankBalances() {
  const { data, ...rest } = useBankData();

  const allTokens = useTokens();
  const allTokensWithIBC = useTokensWithIbcInfo(allTokens);
  const balances = useMemo<TokenCoin[] | undefined>(() => {
    // check all known tokens with IBC context for matching balance denoms
    return data?.balances.reduce<TokenCoin[]>((result, balance) => {
      const token = allTokensWithIBC.find(matchTokenByDenom(balance.denom));
      if (token) {
        result.push({ token, ...balance });
      }
      return result;
    }, []);
  }, [data?.balances, allTokensWithIBC]);

  return { data: balances, ...rest };
}

export function useTokensList() {
  return useContext(IndexerContext).tokens;
}

export function useTokenPairsList() {
  return useContext(IndexerContext).tokenPairs;
}

export function usePairUpdateHeight(
  pairID: PairIdString = ''
): number | undefined {
  return useContext(IndexerContext).pairUpdateHeight[pairID];
}
