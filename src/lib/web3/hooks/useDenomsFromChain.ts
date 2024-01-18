import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { immutable } from 'swr/immutable';
import { useCallback, useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';

import { IbcRestClient, useIbcRestClient } from '../clients/lcdClients';

type DenomTraceByDenom = Map<string, DenomTrace>;

function useUniqueDenoms(denoms: string[]) {
  return useDeepCompareMemoize(Array.from(new Set(denoms)));
}

function useDenomTraceByDenom(denoms: string[]): DenomTraceByDenom | undefined {
  const uniqueDenoms = useUniqueDenoms(denoms);

  const restClient = useIbcRestClient();
  const getKey = useCallback<
    SWRInfiniteKeyLoader<
      DenomTrace,
      [client: IbcRestClient, denom: string, key: string] | null
    >
  >(
    (index: number) => {
      // don't start without the client
      if (!restClient) {
        return null;
      }

      // fetch page by pageKey
      return [restClient, uniqueDenoms.at(index) || '', 'denom-trace'];
    },
    [restClient, uniqueDenoms]
  );
  const pages = useSWRInfinite<[string, DenomTrace?], Error, typeof getKey>(
    getKey,
    async ([restClient, denom]) => {
      const hash = denom.split('ibc/').at(1);
      return [
        denom,
        // fetch denom trace only if the denom has an IBC hash
        hash
          ? await restClient?.applications.transfer.v1
              .denomTrace({ hash })
              .then((response) => response.denom_trace)
          : undefined,
      ];
    },
    // these endpoint responses never change
    { use: [immutable] }
  ).data;

  // combine maps into one
  return useMemo<DenomTraceByDenom | undefined>(() => {
    return pages?.reduce<DenomTraceByDenom>((map, [denom, denomTrace]) => {
      if (denom && denomTrace) {
        return map.set(denom, denomTrace);
      }
      return map;
    }, new Map());
  }, [pages]);
}

export function useDenomTrace(denom?: string): DenomTrace | undefined {
  const denoms = useDeepCompareMemoize(denom ? [denom] : []);
  const denomTraceByDenom = useDenomTraceByDenom(denoms);
  return denomTraceByDenom?.get(denom || '');
}
