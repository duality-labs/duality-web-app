import BigNumber from 'bignumber.js';
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
  opts: Partial<{ memo: string; keepPreviousData: boolean }> = {}
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
          opts.memo
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
    placeholderData: opts.keepPreviousData ? keepPreviousData : undefined,
  });

  return useSwrResponseFromReactQuery<
    ExtendedSimulateResponse | undefined,
    LimitOrderTxSimulationError
  >(result.data, result);
}
