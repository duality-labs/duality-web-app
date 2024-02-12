import { useQueries } from '@tanstack/react-query';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { useMemo } from 'react';
import { DenomTrace } from '@duality-labs/neutronjs/types/codegen/ibc/applications/transfer/v1/transfer';

import { useIbcRestClient } from '../clients/restClients';
import { useDefaultDenomTraceByDenom } from './useDenomsFromRegistry';
import { SWRCommon, useCombineResults, useSwrResponse } from './useSWR';

type DenomTraceByDenom = Map<string, DenomTrace>;

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

  const { data: results, ...swr } = useQueries({
    queries: ibcDenoms.flatMap((denom) => {
      const hash = denom.split('ibc/').at(1);
      if (restClient && hash) {
        return {
          queryKey: [
            'useDenomTraceByDenom',
            denom,
            hash,
            defaultDenomTraceByDenom?.size,
          ],
          queryFn: async (): Promise<[string, DenomTrace?]> => {
            const foundDefaultTrace = defaultDenomTraceByDenom?.get(denom);
            return [
              denom,
              foundDefaultTrace ||
                (hash
                  ? await restClient.applications.transfer.v1
                      .denomTrace({ hash })
                      .then((response) => response.denom_trace)
                  : undefined),
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
    // use generic simple as possible combination
    combine: useCombineResults(),
  });

  const denomTraceByDenom = useMemo(() => {
    // compute map
    return results.reduce<DenomTraceByDenom>((map, [denom, trace]) => {
      // if resolved then add data
      if (denom && trace) {
        return map.set(denom, trace);
      }
      return map;
    }, new Map());
  }, [results]);

  return useSwrResponse(denomTraceByDenom, swr);
}

export function useDenomTrace(denom = ''): SWRCommon<DenomTrace> {
  const { data: denomTraceByDenom, ...swr } = useDenomTraceByDenom([denom]);
  return useSwrResponse<DenomTrace>(denomTraceByDenom?.get(denom), swr);
}
