import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import useTokens, { matchTokenByDenom } from './useTokens';
import { useSimplePrice } from '../../tokenPrices';
import { Token, getDisplayDenomAmount, getTokenId } from '../utils/tokens';
import {
  ShareValueContext,
  UserDepositFilter,
  UserPositionDepositContext,
  useUserDeposits,
  useUserPositionsContext,
} from './useUserShares';

export interface ValuedUserPositionDepositContext
  extends UserPositionDepositContext {
  token0Value?: BigNumber;
  token1Value?: BigNumber;
}

export function useUserPositionsShareValues(
  poolDepositFilter?: UserDepositFilter
): ValuedUserPositionDepositContext[] {
  const selectedPoolDeposits = useUserDeposits(poolDepositFilter);
  const userPositionDepositContext = useUserPositionsContext(poolDepositFilter);

  const allTokens = useTokens();
  const selectedTokens = useMemo<Token[]>(() => {
    const tokenMap = (selectedPoolDeposits || []).reduce<
      Set<Token | undefined>
    >((result, deposit) => {
      const { token0, token1 } = deposit.pairID || {};
      if (token0) {
        result.add(allTokens.find(matchTokenDenom(token0)));
      }
      if (token1) {
        result.add(allTokens.find(matchTokenDenom(token1)));
      }
      return result;
    }, new Set());

    // return tokens
    return Array.from(tokenMap.values()).filter(
      (token): token is Token => !!token
    );

    function matchTokenDenom(denom: string) {
      return (token: Token) =>
        !!token.denom_units.find((unit) => unit.denom === denom);
    }
  }, [allTokens, selectedPoolDeposits]);

  const { data: selectedTokensPrices } = useSimplePrice(selectedTokens);

  const selectedTokensPriceMap = useMemo(() => {
    return selectedTokens.reduce<{
      [tokenId: string]: number | undefined;
    }>((acc, token, index) => {
      const tokenId = getTokenId(token);
      if (tokenId) {
        acc[tokenId] = selectedTokensPrices[index];
      }
      return acc;
    }, {});
  }, [selectedTokens, selectedTokensPrices]);

  return useMemo<ValuedUserPositionDepositContext[]>(() => {
    return userPositionDepositContext.map<ValuedUserPositionDepositContext>(
      ({ token0Context, token1Context, ...rest }) => {
        return {
          ...rest,
          token0Context,
          token1Context,
          token0Value: token0Context && getValueOfContext(token0Context),
          token1Value: token1Context && getValueOfContext(token1Context),
        };
      }
    );

    function getValueOfContext(
      context: ShareValueContext
    ): BigNumber | undefined {
      const { token: tokenDenom, userReserves } = context;
      // what is the price per token?
      const token = selectedTokens.find(matchTokenByDenom(tokenDenom));
      const price = selectedTokensPriceMap[getTokenId(token) || ''];
      if (token && price && !isNaN(price)) {
        // how many tokens does the user have?
        const amount = getDisplayDenomAmount(token, userReserves);
        // how much are those tokens worth?
        const value = new BigNumber(amount || 0).multipliedBy(price);
        return value;
      }
    }
  }, [selectedTokens, selectedTokensPriceMap, userPositionDepositContext]);
}

// calculate total
export function useUserPositionsShareValue(
  poolDepositFilter?: UserDepositFilter
): BigNumber {
  const userPositionsShareValues =
    useUserPositionsShareValues(poolDepositFilter);

  return useMemo(() => {
    return userPositionsShareValues.reduce<BigNumber>(
      (acc, { token0Value, token1Value }) => {
        return acc.plus(token0Value || 0).plus(token1Value || 0);
      },
      new BigNumber(0)
    );
  }, [userPositionsShareValues]);
}
