import {
  useContext,
  createContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import Long from 'long';
import { BigNumber } from 'bignumber.js';
import { cosmos } from '@duality-labs/dualityjs';

import { MessageActionEvent } from './events';
import subscriber from './subscriptionManager';
import { useWeb3 } from './useWeb3';

import { useRpcPromise } from './rpcQueryClient';
import useTokens from '../../lib/web3/hooks/useTokens';
import useTokenPairs from './hooks/useTokenPairs';

import { feeTypes } from './utils/fees';

import { Token, TokenAddress, getAmountInDenom } from './utils/tokens';
import { calculateShares } from './utils/ticks';
import { IndexedShare, getShareInfo } from './utils/shares';
import { getPairID } from './utils/pairs';

import { CoinSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/base/v1beta1/coin';
import { PageRequest } from '@duality-labs/dualityjs/types/codegen/helpers.d';
import { QueryAllBalancesResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/bank/v1beta1/query';

const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;

interface UserBankBalance {
  balances: Array<CoinSDKType>;
}

interface UserShares {
  shares: Array<IndexedShare>;
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
  tokens: {
    data?: Token[];
    error?: string;
    isValidating: boolean;
  };
  tokenPairs: {
    data?: [TokenAddress, TokenAddress][];
    error?: string;
    isValidating: boolean;
  };
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
});

const defaultFetchParams: Partial<PageRequest> = {
  limit: Long.fromNumber(1000),
  countTotal: true,
};

export function IndexerProvider({ children }: { children: React.ReactNode }) {
  const seconds = 1000;
  const minutes = 60 * seconds;

  const [bankData, setBankData] = useState<UserBankBalance>();
  const [shareData, setShareData] = useState<UserShares>();
  const tokensData = useTokens();
  const { data: tokenPairsData, isValidating: isTokenPairsValidating } =
    useTokenPairs({
      swr: { refreshInterval: 10 * minutes },
    });

  const rpcPromise = useRpcPromise();

  const [error, setError] = useState<string>();
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
    tokens: {
      data: tokensData,
      error: error,
      isValidating: true,
    },
    tokenPairs: {
      data: tokenPairsData,
      error: error,
      isValidating: true,
    },
  });

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
            .then((data = []) => {
              // separate out 'normal' and 'share' tokens from the bank balance
              const [tokens, tokenizedShares] = data.reduce<
                [Array<CoinSDKType>, Array<IndexedShare>]
              >(
                ([tokens, tokenizedShares], coin) => {
                  const {
                    token0Address: token0,
                    token1Address: token1,
                    tickIndexString: tickIndex,
                    feeString: fee,
                  } = getShareInfo(coin) || {};
                  // transform tokenized shares into shares
                  if (token0 && token1 && tickIndex && fee) {
                    // add tokenized share if everything is fine
                    if (address) {
                      const tokenizedShare = {
                        // todo: remove address from here
                        address,
                        pairId: getPairID(token0, token1),
                        tickIndex,
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
              setBankData({ balances: tokens });
              setShareData({ shares: tokenizedShares });
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

      async function fetchBankData() {
        const rpc = await rpcPromise;
        if (address && rpc) {
          const client = new bankClientImpl(rpc);
          setFetchBankDataState(({ fetched }) => ({ fetching: true, fetched }));
          let nextKey: Uint8Array | undefined;
          let balances: Array<CoinSDKType> = [];
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
                (balance: CoinSDKType): balance is CoinSDKType =>
                  balance.amount !== undefined
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
            nextKey = res.pagination?.nextKey;
          } while (nextKey && nextKey.length > 0);
          setFetchBankDataState(() => ({ fetching: false, fetched: true }));
          return balances || [];
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

  // update bank balance whenever bank transfers are detected
  useEffect(() => {
    if (address) {
      const onTxBalanceUpdate = () => {
        updateBankData();
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
  }, [updateBankData, address]);

  useEffect(() => {
    const onDexUpdateMessage = function (event: MessageActionEvent) {
      const Receiver = event['message.Receiver'];
      const Token0 = event['message.Token0'];
      const Token1 = event['message.Token1'];
      const TickIndex = event['message.TickIndex'];
      const Fee = event['message.Fee'];
      const NewReserves0 = event['message.NewReserves0'];
      const NewReserves1 = event['message.NewReserves1'];

      if (
        Receiver !== address ||
        !Token0 ||
        !Token1 ||
        !TickIndex ||
        !Fee ||
        !NewReserves0 ||
        !NewReserves1
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }
      // update user's share state
      setShareData((state) => {
        if (!state) return state;
        // find matched data
        const { shares = [] } = state || {};
        const data = shares.slice();
        const pairId = getPairID(Token0, Token1);
        const shareFoundIndex = shares.findIndex(
          (share) =>
            share.pairId === pairId &&
            share.tickIndex === TickIndex &&
            share.fee === Fee
        );
        const sharesOwned = calculateShares({
          tickIndex: new BigNumber(TickIndex),
          reserve0: new BigNumber(NewReserves0),
          reserve1: new BigNumber(NewReserves1),
        });
        // upsert new share
        if (sharesOwned.isGreaterThan(0)) {
          const newShare = {
            pairId,
            address,
            fee: Fee,
            tickIndex: TickIndex,
            sharesOwned: sharesOwned.toFixed(),
          };
          if (shareFoundIndex >= 0) {
            // update share
            data.splice(shareFoundIndex, 1, newShare);
          } else {
            // add share
            data.push(newShare);
          }
        }
        // else remove share
        else {
          if (shareFoundIndex >= 0) {
            data.splice(shareFoundIndex, 1);
          }
        }
        return { shares: data };
      });
    };
    // subscribe to messages for this address only
    if (address) {
      subscriber.subscribeMessage(onDexUpdateMessage, {
        message: { action: 'Deposit', Receiver: address },
      });
      subscriber.subscribeMessage(onDexUpdateMessage, {
        message: { action: 'NewWithdraw', Receiver: address },
      });
      return () => {
        subscriber.unsubscribeMessage(onDexUpdateMessage);
      };
    }
  }, [rpcPromise, address]);

  useEffect(() => {
    const onRouterUpdateMessage = function (event: MessageActionEvent) {
      const Creator = event['message.Creator'];
      const TokenIn = event['message.TokenIn'];
      const TokenOut = event['message.TokenOut'];
      const AmountIn = event['message.AmountIn'];
      const AmountOut = event['message.AmountOut'];
      const MinOut = event['message.MinOut'];
      if (
        !Creator ||
        !TokenIn ||
        !TokenOut ||
        !AmountIn ||
        !AmountOut ||
        !MinOut
      ) {
        setError('Invalid event response from server');
        return;
      } else {
        setError(undefined);
      }

      // todo: update something without refetching?
      // may not be possible or helpful
      // bank balance update will be caught already by the bank event watcher
      // it's too complicated to update indexer state with the event detail's
    };
    subscriber.subscribeMessage(onRouterUpdateMessage, {
      // todo: this doesn't exist anymore
      message: { action: 'NewSwap' },
    });
    return () => {
      subscriber.unsubscribeMessage(onRouterUpdateMessage);
    };
  }, [rpcPromise]);

  useEffect(() => {
    setResult({
      bank: {
        data: bankData,
        error: error,
        isValidating: !bankData && !error,
      },
      shares: {
        data: shareData,
        error: error,
        isValidating: !shareData && !error,
      },
      tokens: {
        data: undefined,
        error: error,
        isValidating: !shareData && !error,
      },
      tokenPairs: {
        data: tokenPairsData,
        error: error,
        isValidating: isTokenPairsValidating,
      },
    });
  }, [bankData, shareData, tokenPairsData, error, isTokenPairsValidating]);

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
    return (
      (token &&
        balances?.find((balance) => balance.denom === token.address)?.amount) ||
      '0'
    );
  }, [balances, token]);
  return { data: balance, error, isValidating };
}

export function useBankBigBalance(token: Token | undefined) {
  const { data: balances, error, isValidating } = useBankBalances();
  const balance = useMemo(() => {
    return token && balances && getBigBalance(token, balances);
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

export function getBigBalance(
  token: Token,
  userBalances: UserBankBalance['balances']
): string {
  const denomUnits = token.denom_units;
  const balanceObject = userBalances?.find((balance) => {
    return denomUnits?.find((unit) => unit.denom === balance.denom);
  });
  return (
    (!!balanceObject &&
      balanceObject.amount &&
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

export function useTokensList() {
  return useContext(IndexerContext).tokens;
}

export function useTokenPairsList() {
  return useContext(IndexerContext).tokenPairs;
}
