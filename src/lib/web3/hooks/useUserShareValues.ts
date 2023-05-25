import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import useTokens from './useTokens';
import { useSimplePrice } from '../../tokenPrices';
import { Token, getAmountInDenom } from '../utils/tokens';
import {
  UserDepositFilter,
  UserPositionDepositContext,
  useUserDeposits,
  useUserPositionsContext,
} from './useUserShares';

interface ValuedUserPositionDepositContext extends UserPositionDepositContext {
  value?: BigNumber;
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
      [tokenAddress: string]: number | undefined;
    }>((acc, token, index) => {
      if (token.address) {
        acc[token.address] = selectedTokensPrices[index];
      }
      return acc;
    }, {});
  }, [selectedTokens, selectedTokensPrices]);

  return useMemo<ValuedUserPositionDepositContext[]>(() => {
    return userPositionDepositContext.map<ValuedUserPositionDepositContext>(
      ({ deposit, context }) => {
        const {
          reserves,
          sharesOwned,
          totalShares,
          token: tokenAddress,
        } = context;
        // what is the price per token?
        const token = selectedTokens.find(
          ({ address }) => address === tokenAddress
        );
        const price = selectedTokensPriceMap[tokenAddress];
        if (token && price && !isNaN(price)) {
          // how many tokens does the user have?
          const reserve = reserves
            .multipliedBy(sharesOwned)
            .dividedBy(totalShares);
          const amount = getAmountInDenom(
            token,
            reserve,
            token.address,
            token.display
          );
          // how much are those tokens worth?
          const value = new BigNumber(amount || 0).multipliedBy(price);
          return { deposit, context, value };
        }
        return { deposit, context };
      }
    );
  }, [selectedTokens, selectedTokensPriceMap, userPositionDepositContext]);
}

// calculate total
export function useUserPositionsShareValue(
  poolDepositFilter?: UserDepositFilter
): BigNumber {
  const userPositionsShareValues =
    useUserPositionsShareValues(poolDepositFilter);

  return useMemo(() => {
    return userPositionsShareValues.reduce<BigNumber>((acc, { value }) => {
      return value ? acc.plus(value) : acc;
    }, new BigNumber(0));
  }, [userPositionsShareValues]);
}
