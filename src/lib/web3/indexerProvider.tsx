import {
  useContext,
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import Long from 'long';
import { cosmos, dualitylabs } from '@duality-labs/dualityjs';

import { MessageActionEvent, TendermintTxData } from './events';
import { DexTickUpdateEvent, mapEventAttributes } from './utils/events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { useRpcPromise } from './rpcQueryClient';
import useTokens from '../../lib/web3/hooks/useTokens';
import useTokenPairs from './hooks/useTokenPairs';

import { feeTypes } from './utils/fees';

import { Token, TokenAddress, getAmountInDenom } from './utils/tokens';
import { IndexedShare, getShareInfo } from './utils/shares';
import { PairIdString, getPairID } from './utils/pairs';

import { Coin } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { Stake } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/incentives/stake';
import { PageRequest } from '@duality-labs/dualityjs/types/codegen/helpers.d';
import { QueryAllBalancesResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';

const { REACT_APP__REST_API = '' } = process.env;

const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;

interface UserBankBalance {
  balances: Array<Coin>;
}

interface UserShares {
  shares: Array<IndexedShare>;
}
export interface UserStakedShare extends IndexedShare {
  ID: string;
  owner: string;
  start_time?: string;
}
interface UserStakedShares {
  stakedShares: Array<UserStakedShare>;
}

interface PairUpdateHeightData {
  [pairID: string]: number; // block height
}

interface IndexerContextType {
  bank: {
    data?: UserBankBalance;
    isValidating: boolean;
  };
  shares: {
    data?: UserShares & UserStakedShares;
    isValidating: boolean;
  };
  tokens: {
    data?: Token[];
    isValidating: boolean;
  };
  tokenPairs: {
    data?: [TokenAddress, TokenAddress][];
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
  shares: {
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
  const seconds = 1000;
  const minutes = 60 * seconds;

  const [bankData, setBankData] = useState<UserBankBalance>();
  const [shareData, setShareData] = useState<UserShares & UserStakedShares>();
  const [poolUpdateHeightData, setPoolUpdateHeightData] =
    useState<PairUpdateHeightData>({});
  const tokensData = useTokens();
  const { data: tokenPairsData, isValidating: isTokenPairsValidating } =
    useTokenPairs({
      queryOptions: { refetchInterval: 10 * minutes },
    });

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
            .then(([coins = [], stakedCoins] = [[], []]) => {
              // separate out 'normal' and 'share' tokens from the bank balance
              const [tokens, tokenizedShares] = coins.reduce<
                [Array<Coin>, Array<IndexedShare>]
              >(
                ([tokens, tokenizedShares], coin) => {
                  const {
                    token0Address: token0,
                    token1Address: token1,
                    tickIndex1To0String: tickIndex1To0,
                    feeString: fee,
                  } = getShareInfo(coin) || {};
                  // transform tokenized shares into shares
                  if (token0 && token1 && tickIndex1To0 && fee) {
                    // add tokenized share if everything is fine
                    if (address) {
                      const tokenizedShare: IndexedShare = {
                        // todo: remove address from here
                        address,
                        pairId: getPairID(token0, token1),
                        tickIndex1To0,
                        fee,
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
                          fee,
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
              // collect stakedShares in a similar format
              const stakedShares: UserStakedShare[] = stakedCoins.reduce<
                UserStakedShare[]
              >((stakedShares, stakedCoin) => {
                const { ID, coins, owner, start_time } = stakedCoin;
                coins.forEach((coin) => {
                  const {
                    token0Address: token0,
                    token1Address: token1,
                    tickIndex1To0String: tickIndex1To0 = '',
                    feeString: fee = '',
                  } = getShareInfo(coin) || {};
                  const stakedShare = {
                    // todo: remove address from here
                    address: address || '',
                    pairId: getPairID(token0, token1),
                    tickIndex1To0,
                    fee,
                    sharesOwned: coin.amount,
                    ID: `${ID}`,
                    owner,
                    start_time: start_time && `${start_time}`,
                  };
                  stakedShares.push(stakedShare);
                });
                return stakedShares;
              }, []);
              setBankData({ balances: tokens });
              setShareData({ shares: tokenizedShares, stakedShares });
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

      async function fetchBankData(): Promise<[Coin[], Stake[]] | undefined> {
        const rpc = await rpcPromise;
        if (address && rpc) {
          const client = new bankClientImpl(rpc);
          setFetchBankDataState(({ fetched }) => ({ fetching: true, fetched }));
          let nextKey: Uint8Array | undefined;
          let balances: Array<Coin> = [];
          let res: QueryAllBalancesResponse;
          const stakedPositionsPromise =
            dualitylabs.ClientFactory.createLCDClient({
              restEndpoint: REACT_APP__REST_API,
            }).then((lcdClient) => {
              return lcdClient.dualitylabs.duality.incentives.getStakes({
                owner: address,
              });
            });
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
          // combine regular and staked balances together
          return await stakedPositionsPromise.then((stakedPositions) => {
            return [balances, stakedPositions.stakes || []];
          });
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
                  event.attributes.Token0,
                  event.attributes.Token1
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
      shares: {
        data: shareData,
        isValidating: !shareData,
      },
      tokens: {
        data: tokensData,
        isValidating: !shareData,
      },
      tokenPairs: {
        data: tokenPairsData,
        isValidating: isTokenPairsValidating,
      },
      pairUpdateHeight: poolUpdateHeightData,
    };
  }, [
    bankData,
    shareData,
    tokensData,
    tokenPairsData,
    poolUpdateHeightData,
    isTokenPairsValidating,
  ]);

  return (
    <IndexerContext.Provider value={result}>{children}</IndexerContext.Provider>
  );
}

export function useBankData() {
  return useContext(IndexerContext).bank;
}

export function useBankBalances() {
  const { data, isValidating } = useBankData();
  return { data: data?.balances, isValidating };
}

export function useBankBalance(token: Token | undefined) {
  const { data: balances, isValidating } = useBankBalances();
  const balance = useMemo(() => {
    return (
      (token &&
        balances?.find((balance) => balance.denom === token.address)?.amount) ||
      '0'
    );
  }, [balances, token]);
  return { data: balance, isValidating };
}

export function useBankBigBalance(token: Token | undefined) {
  const { data: balances, isValidating } = useBankBalances();
  const balance = useMemo(() => {
    const foundBalance =
      token &&
      balances?.find((balance) => {
        return token.denom_units.find((unit) => unit.denom === balance.denom);
      });
    return (
      token &&
      foundBalance &&
      getAmountInDenom(
        token,
        foundBalance.amount,
        foundBalance.denom,
        token.display
      )
    );
  }, [balances, token]);
  return { data: balance, isValidating };
}

export function useShareData() {
  return useContext(IndexerContext).shares;
}

export function useShares({
  tokens,
  staked = false,
}: { tokens?: [tokenA: Token, tokenB: Token]; staked?: boolean } = {}) {
  const { data, isValidating } = useShareData();
  const shares = useMemo((): IndexedShare[] | UserStakedShare[] | undefined => {
    // filter to specific tokens if asked for
    const shares = data?.shares.filter(
      (share) => Number(share.sharesOwned) > 0
    );
    const stakedShares = data?.stakedShares.filter(
      (share) => Number(share.sharesOwned) > 0
    );
    if (tokens) {
      return !staked
        ? shares?.filter(tokensFilter(tokens))
        : stakedShares?.filter(tokensFilter(tokens));
    }
    return !staked ? shares : stakedShares;

    function tokensFilter(tokens: [tokenA: Token, tokenB: Token]) {
      const [addressA, addressB] = tokens.map((token) => token.address);
      return function tokenFilter({ pairId = '' }: IndexedShare): boolean {
        const [address0, address1] = pairId.split('/');
        return (
          (addressA === address0 && addressB === address1) ||
          (addressA === address1 && addressB === address0)
        );
      };
    }
  }, [data?.shares, data?.stakedShares, tokens, staked]);
  return { data: shares, isValidating };
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
