import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TxExtension } from '@cosmjs/stargate';
import { neutron } from '@duality-labs/neutronjs';
import type {
  MsgPlaceLimitOrder,
  MsgPlaceLimitOrderResponse,
} from '@duality-labs/neutronjs/types/codegen/neutron/dex/tx';

import { useWeb3 } from '../../../lib/web3/useWeb3';
import {
  useTxSimulationClient,
  TxSimulationError,
} from '../../../lib/web3/clients/signingClients';

import { useSwrResponseFromReactQuery } from '../../../lib/web3/hooks/useSWR';
import { createMemo } from '../../../lib/web3/utils/memo';
import { orderTypeEnum } from '../../../lib/web3/utils/limitOrders';
import {
  DexPlaceLimitOrderEvent,
  mapEventAttributes,
} from '../../../lib/web3/utils/events';
import logger from '../../../lib/utils/logger';

type SimulateResponse = Awaited<ReturnType<TxExtension['tx']['simulate']>>;
type ExtendedSimulateResponse = Partial<
  SimulateResponse & {
    response: MsgPlaceLimitOrderResponse & {
      tranchedReserves: number;
      swappedReserves: number;
    };
    error: LimitOrderTxSimulationError;
  }
>;

class LimitOrderTxSimulationError extends TxSimulationError {
  insufficientLiquidity: boolean;
  constructor(error: unknown) {
    super(error);
    this.name = 'LimitOrderTxSimulationError';

    // parse out message codes
    this.insufficientLiquidity = this.message.includes(
      // eslint-disable-next-line quotes
      "Fill Or Kill limit order couldn't be executed in its entirety"
    );
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
  opts: Partial<{
    memo: string;
    keepPreviousData: boolean;
    workaroundErrorForFoK: boolean;
  }> = {}
) {
  // use signing client simulation function to get simulated response and gas
  const { wallet, address } = useWeb3();
  const txSimulationClient = useTxSimulationClient(wallet);
  const memo = createMemo(opts.memo);
  const result = useQuery<
    ExtendedSimulateResponse | undefined,
    LimitOrderTxSimulationError
  >({
    queryKey: [
      txSimulationClient,
      address,
      JSON.stringify(msgPlaceLimitOrder),
      memo,
    ],
    enabled: Boolean(txSimulationClient && address && msgPlaceLimitOrder),
    queryFn: async (): Promise<ExtendedSimulateResponse | undefined> => {
      // early exit to help types, should match "enabled" property condition
      if (!(txSimulationClient && address && msgPlaceLimitOrder)) return;
      // return empty response for a zero amount query
      if (!Number(msgPlaceLimitOrder.amount_in)) return {};
      try {
        const placeOrder = async (msgPlaceLimitOrder: MsgPlaceLimitOrder) => {
          logger?.debug('Client simulateMsg from', address, msgPlaceLimitOrder);
          return txSimulationClient.simulate(
            address,
            [
              neutron.dex.MessageComposer.withTypeUrl.placeLimitOrder(
                msgPlaceLimitOrder
              ),
            ],
            opts.memo
          );
        };

        // note: this is a workaround to deal with FoK "insufficient liquidity"
        //       errors that may occur due to bad rounding behavior in the dex
        const placeOrders = async (msgPlaceLimitOrder: MsgPlaceLimitOrder) => {
          try {
            return await placeOrder(msgPlaceLimitOrder);
          } catch (e) {
            const error = e instanceof Error ? e : new Error(`${e}`);
            // retry the simulation with an IMMEDIATE_OR_CANCEL order
            // if it was a FILL_OR_KILL order with "insufficient liquidity"
            if (
              msgPlaceLimitOrder.order_type === orderTypeEnum.FILL_OR_KILL &&
              error.message?.includes('executed in its entirety.')
            ) {
              // get decoded response of the IMMEDIATE_OR_CANCEL equivalent
              const response = await placeOrder({
                ...msgPlaceLimitOrder,
                order_type: orderTypeEnum.IMMEDIATE_OR_CANCEL,
              });
              const decodedResponse =
                response.result &&
                neutron.dex.MsgPlaceLimitOrderResponse.decode(
                  response.result.msgResponses[0].value
                );

              // if the IoC order was just a few tokens (rounding) short of FoK:
              // then replace the FoK response with this IoC response
              if (
                decodedResponse &&
                Number(msgPlaceLimitOrder.amount_in) -
                  Number(decodedResponse.coin_in.amount) <
                  3
              ) {
                return response;
              }
              // otherwise continue to throw the original error
            }
            throw e;
          }
        };

        const { gasInfo, result } = opts.workaroundErrorForFoK
          ? await placeOrders(msgPlaceLimitOrder)
          : await placeOrder(msgPlaceLimitOrder);
        // return successful response
        if (result && result.msgResponses.length > 0) {
          const response = neutron.dex.MsgPlaceLimitOrderResponse.decode(
            result.msgResponses[0].value
          );
          const placeLimitOrderEvent = result.events
            .map<DexPlaceLimitOrderEvent>(mapEventAttributes)
            .find((event) => event.attributes.action === 'PlaceLimitOrder');
          // determine the amount of reserves that were added to tranches,
          // these reserves have not yet been traded (so we may estimate them)
          // note: hopefully tranchedReserves can be added to the
          //       MsgPlaceLimitOrderResponse payload so that we don't need to derive it here
          const tranchedReserves = Number(
            placeLimitOrderEvent?.attributes.Shares || 0
          );
          const swappedReserves =
            Number(placeLimitOrderEvent?.attributes.AmountIn || 0) -
            tranchedReserves;

          // note: hopefully tranchedReserves can be added to the
          //       MsgPlaceLimitOrderResponse payload so that we don't need to derive it here
          return {
            gasInfo,
            result,
            response: { ...response, tranchedReserves, swappedReserves },
          };
        }
        // likely an error result
        return { gasInfo, result };
      } catch (error) {
        // return error so that it may be persisted
        return { error: new LimitOrderTxSimulationError(error) };
      }
    },
    // persist results (with error in error key)
    placeholderData: opts.keepPreviousData ? keepPreviousData : undefined,
  });

  return useSwrResponseFromReactQuery<
    ExtendedSimulateResponse | undefined,
    LimitOrderTxSimulationError
  >(result.data, result);
}
