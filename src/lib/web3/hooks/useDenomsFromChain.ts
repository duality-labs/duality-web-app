import { useQueries } from '@tanstack/react-query';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { DenomTrace } from '@duality-labs/neutronjs/types/codegen/ibc/applications/transfer/v1/transfer';

import { useIbcRestClient } from '../clients/restClients';
import { useDefaultDenomTraceByDenom } from './useDenomsFromRegistry';

type DenomTraceByDenom = Map<string, DenomTrace>;

type SWRCommon<Data = unknown, Error = unknown> = {
  isValidating: boolean;
  isLoading: boolean;
  error: Error;
  data: Data | undefined;
};

export function useDenomTraceByDenom(
  denoms: string[]
): SWRCommon<DenomTraceByDenom> {
  // get what information we can from chain-registry data
  const defaultDataState = useDefaultDenomTraceByDenom();
  const { data: defaultDenomTraceByDenom } = defaultDataState;

  // use only unique IBC denoms
  const ibcDenoms = useDeepCompareMemoize(
    // only look up "unknown" denoms from the chain after we have registry data
    // or the chain-registry data fetching has hit an error
    defaultDenomTraceByDenom?.size || defaultDataState.error
      ? Array.from(new Set(denoms))
          .filter((denom) => denom.startsWith('ibc/'))
          .filter((denom) => defaultDenomTraceByDenom?.has(denom))
      : []
  );

  const restClient = useIbcRestClient();

  const { data: denomTraceByDenom, ...swr } = useQueries({
    queries: ibcDenoms.flatMap((denom) => {
      const hash = denom.split('ibc/').at(1);
      if (restClient && hash) {
        return {
          queryKey: ['useDenomTraceByDenom', denom, hash],
          queryFn: async (): Promise<[string, DenomTrace?]> => {
            return [
              denom,
              hash
                ? await restClient.applications.transfer.v1
                    .denomTrace({ hash })
                    .then((response) => response.denom_trace)
                    .catch(() => undefined)
                : undefined,
            ];
          },
          // never refetch these values, they will never change
          staleTime: Infinity,
          refetchInterval: Infinity,
          refetchOnMount: false,
          refetchOnReconnect: false,
          refetchOnWindowFocus: false,
        };
      }
      return [];
    }),
    combine: (results) => {
      return {
        isLoading: results.every((result) => result.isPending),
        isValidating: results.some((result) => result.isFetching),
        data: results.reduce<DenomTraceByDenom>(
          (map, { data: [denom, trace] = [] }) => {
            // if resolved then add data
            if (denom && trace) {
              return map.set(denom, trace);
            }
            return map;
          },
          new Map()
        ),
        error: results.find((result) => result.error)?.error,
      };
    },
  });

  const { isValidating, isLoading, error } = swr;
  return { isValidating, isLoading, error, data: denomTraceByDenom };
}

export function useDenomTrace(denom = ''): SWRCommon<DenomTrace> {
  const { data: denomTraceByDenom, ...swr } = useDenomTraceByDenom([denom]);
  return { ...swr, data: denomTraceByDenom?.get(denom) };
}
