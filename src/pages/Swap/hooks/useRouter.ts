import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TxExtension } from '@cosmjs/stargate';
import { neutron } from '@duality-labs/neutronjs';
import type {
  MsgPlaceLimitOrder,
  MsgPlaceLimitOrderResponse,
} from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import { PairRequest, PairResult, RouterResult } from './index';
import { routerAsync, calculateFee, SwapError } from './router';

import { formatMaximumSignificantDecimals } from '../../../lib/utils/number';
import { TickInfo } from '../../../lib/web3/utils/ticks';
import { getPairID } from '../../../lib/web3/utils/pairs';
import {
  getBaseDenomAmount,
  getDisplayDenomAmount,
} from '../../../lib/web3/utils/tokens';

import { useWeb3 } from '../../../lib/web3/useWeb3';
import {
  useTxSimulationClient,
  TxSimulationError,
} from '../../../lib/web3/clients/signingClients';

import { useToken } from '../../../lib/web3/hooks/useDenomClients';
import { useTokenPairTickLiquidity } from '../../../lib/web3/hooks/useTickLiquidity';
import { useOrderedTokenPair } from '../../../lib/web3/hooks/useTokenPairs';
import { useSwrResponseFromReactQuery } from '../../../lib/web3/hooks/useSWR';

const cachedRequests: {
  [token0: string]: { [token1: string]: PairResult };
} = {};

async function getRouterResult(
  alteredValue: string,
  tokenA: string,
  tokenB: string,
  token0: string,
  token0Ticks: TickInfo[] = [],
  token1Ticks: TickInfo[] = [],
  reverseSwap: boolean
): Promise<RouterResult> {
  if (reverseSwap) {
    // The router can't calculate the value of the buying token based on the value of the selling token (yet)
    throw new Error('Cannot calculate the reverse value');
  } else {
    return await routerAsync(
      alteredValue,
      tokenA,
      tokenB,
      token0,
      token0Ticks,
      token1Ticks
    );
  }
}

type SimulateResponse = Awaited<ReturnType<TxExtension['tx']['simulate']>>;
type ExtendedSimulateResponse = Partial<
  SimulateResponse & {
    response: MsgPlaceLimitOrderResponse;
    error: LimitOrderTxSimulationError;
  }
>;

const FILL_OR_KILL_ERROR =
  // eslint-disable-next-line quotes
  "Fill Or Kill limit order couldn't be executed in its entirety";
class LimitOrderTxSimulationError extends TxSimulationError {
  insufficientLiquidity: boolean;
  constructor(error: unknown) {
    super(error);
    this.name = 'LimitOrderTxSimulationError';

    // parse out message codes
    this.insufficientLiquidity = this.message.includes(FILL_OR_KILL_ERROR);
  }
}

/**
 * Gets the simulated results and gas usage of a limit order transaction
 * @param msgPlaceLimitOrder the MsgPlaceLimitOrder request
 * @param memo optional memo string to add
 * @returns aync request state and data of { gasInfo, txResult, msgResponse }
 */
export function useSimulatedLimitOrderResult(
  msgPlaceLimitOrder: MsgPlaceLimitOrder | undefined,
  memo = ''
) {
  // use signing client simulation function to get simulated response and gas
  const { wallet, address } = useWeb3();
  const txSimulationClient = useTxSimulationClient(wallet);
  const result = useQuery<
    ExtendedSimulateResponse | undefined,
    LimitOrderTxSimulationError
  >({
    queryKey: [txSimulationClient, address, JSON.stringify(msgPlaceLimitOrder)],
    enabled: Boolean(txSimulationClient && address && msgPlaceLimitOrder),
    queryFn: async (): Promise<ExtendedSimulateResponse | undefined> => {
      // early exit to help types, should match "enabled" property condition
      if (!(txSimulationClient && address && msgPlaceLimitOrder)) return;
      // return empty response for a zero amount query
      if (!Number(msgPlaceLimitOrder.amount_in)) return {};
      try {
        const { gasInfo, result } = await txSimulationClient.simulate(
          address,
          [
            neutron.dex.MessageComposer.withTypeUrl.placeLimitOrder(
              msgPlaceLimitOrder
            ),
          ],
          memo
        );
        // return successful response
        if (result && result.msgResponses.length > 0) {
          const response = neutron.dex.MsgPlaceLimitOrderResponse.decode(
            result.msgResponses[0].value
          );
          // add liquidity error if appropriate
          const error = new BigNumber(response.coin_in.amount)
            .multipliedBy(1.01)
            .isLessThan(msgPlaceLimitOrder.amount_in)
            ? new LimitOrderTxSimulationError(FILL_OR_KILL_ERROR)
            : undefined;
          return { gasInfo, result, response, error };
        }
        // likely an error result
        return { gasInfo, result };
      } catch (error) {
        // return error so that it may be persisted
        return { error: new LimitOrderTxSimulationError(error) };
      }
    },
    // persist results (with error in error key)
    placeholderData: keepPreviousData,
  });

  return useSwrResponseFromReactQuery<
    ExtendedSimulateResponse | undefined,
    LimitOrderTxSimulationError
  >(result.data, result);
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective IDs and value
 * @returns estimated info of swap, loading state and possible error
 */
export function useRouterResult(pairRequest: PairRequest): {
  data?: RouterResult;
  isValidating: boolean;
  error?: SwapError;
} {
  const [data, setData] = useState<RouterResult>();
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<SwapError>();

  const [token0, token1] =
    useOrderedTokenPair([pairRequest.tokenA, pairRequest.tokenB]) || [];

  const pairId = token0 && token1 ? getPairID(token0, token1) : null;
  const {
    data: [token0Ticks, token1Ticks],
  } = useTokenPairTickLiquidity([token0, token1]);

  const { data: tokenA } = useToken(pairRequest.tokenA);
  const { data: tokenB } = useToken(pairRequest.tokenB);

  useEffect(() => {
    if (
      !pairRequest.tokenA ||
      !pairRequest.tokenB ||
      (!pairRequest.valueA && !pairRequest.valueB) ||
      !token0 ||
      !token1 ||
      !pairId
    ) {
      return;
    }
    if (pairRequest.tokenA === pairRequest.tokenB) {
      setData(undefined);
      setError(new Error('The tokens cannot be the same'));
      return;
    }
    if (pairRequest.valueA && pairRequest.valueB) {
      setData(undefined);
      setError(new Error('One value must be falsy'));
      return;
    }
    if (!tokenA || !tokenB) {
      setData(undefined);
      setError(new Error('Tokens not found: token list not ready'));
      return;
    }
    setIsValidating(true);
    setData(undefined);
    setError(undefined);
    // convert token request down into base denom
    const alteredValue = getBaseDenomAmount(tokenA, pairRequest.valueA || 0);
    const reverseSwap = !!pairRequest.valueB;
    if (!alteredValue || alteredValue === '0') {
      setIsValidating(false);
      setData(undefined);
      return;
    }
    let cancelled = false;

    // this could be useRouterResult for much better usage
    // replacing the above useEffect with probably a useMemo
    getRouterResult(
      alteredValue,
      pairRequest.tokenA,
      pairRequest.tokenB,
      token0,
      token0Ticks,
      token1Ticks,
      reverseSwap
    )
      .then(function (result) {
        if (cancelled) return;
        setIsValidating(false);
        // convert token result back into display denom
        setData(convertToDisplayDenom(result));
      })
      .catch(function (err: SwapError) {
        if (cancelled) return;
        setIsValidating(false);
        setError(err);
        if (err.result) {
          setData(convertToDisplayDenom(err.result));
        } else {
          setData(undefined);
        }
      });

    return () => {
      cancelled = true;
    };

    // todo: this function should deal with uToken values only and not be concerned with conversions
    function convertToDisplayDenom(result: RouterResult): RouterResult {
      return {
        ...result,
        amountIn: new BigNumber(pairRequest.valueA || 0),
        amountOut: new BigNumber(
          (tokenB &&
            getDisplayDenomAmount(
              tokenB,
              result.amountOut.decimalPlaces(0, BigNumber.ROUND_DOWN)
            )) ||
            0
        ),
      };
    }
  }, [
    pairRequest.tokenA,
    pairRequest.tokenB,
    pairRequest.valueA,
    pairRequest.valueB,
    pairId,
    token0,
    token1,
    token0Ticks,
    token1Ticks,
    tokenA,
    tokenB,
  ]);

  return { data, isValidating, error };
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective IDs and value
 * @param routerResult the results of the router (if they exist)
 * @returns estimated info of swap
 */
export function getRouterEstimates(
  pairRequest: PairRequest,
  routerResult: RouterResult | undefined
): PairResult | undefined {
  // note: this sorting on the frontend may differ from the sorting on the backend
  const [token0, token1] = [pairRequest.tokenA, pairRequest.tokenB].sort();
  if (token0 && token1) {
    // return estimate from current result
    if (routerResult) {
      const rate = routerResult.amountOut.dividedBy(routerResult.amountIn);
      const extraFee = calculateFee();
      // todo: use result
      // const extraFee = calculateFee(routerResult);
      const estimate = {
        tokenA: routerResult.tokenIn,
        tokenB: routerResult.tokenOut,
        rate: rate.toFixed(),
        valueA: formatMaximumSignificantDecimals(routerResult.amountIn),
        valueB: formatMaximumSignificantDecimals(routerResult.amountOut),
        gas: extraFee.toFixed(),
      };
      cachedRequests[token0] = cachedRequests[token0] || {};
      cachedRequests[token0][token1] = estimate;
      return estimate;
    }
    // if current result is not available, return cached value rough estimate
    else {
      cachedRequests[token0] = cachedRequests[token0] || {};
      const cachedPairInfo = cachedRequests[token0][token1];

      const alteredValue = pairRequest.valueA ?? pairRequest.valueB;
      const reverseSwap = !!pairRequest.valueB;
      if (
        cachedPairInfo &&
        pairRequest.tokenA &&
        pairRequest.tokenB &&
        alteredValue
      ) {
        const { rate, gas } = cachedPairInfo;
        const convertedRate =
          pairRequest.tokenA === cachedPairInfo.tokenA
            ? new BigNumber(rate)
            : new BigNumber(1).dividedBy(rate);
        const roughEstimate = formatMaximumSignificantDecimals(
          new BigNumber(alteredValue).multipliedBy(convertedRate).toFixed()
        );
        return {
          tokenA: pairRequest.tokenA,
          tokenB: pairRequest.tokenB,
          rate: convertedRate.toFixed(),
          valueA: reverseSwap ? roughEstimate : alteredValue,
          valueB: reverseSwap ? alteredValue : roughEstimate,
          gas,
        };
      }
    }
  }
}

/**
 * Gets the estimated info of a swap transaction
 * @param pairRequest the respective IDs and value
 * @returns estimated info of swap, loading state and possible error
 */
export function useRouterEstimates(pairRequest: PairRequest): {
  data?: PairResult;
  isValidating: boolean;
  error?: SwapError;
} {
  const { data, error, isValidating } = useRouterResult(pairRequest);
  return { data: getRouterEstimates(pairRequest, data), isValidating, error };
}
