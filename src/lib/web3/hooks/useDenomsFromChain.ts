import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import { immutable } from 'swr/immutable';
import { useEffect, useMemo } from 'react';
import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';

import { useIbcRestClient } from '../clients/lcdClients';

type DenomTraceByDenom = Map<string, DenomTrace>;

type SWRCommon<Data = unknown, Error = unknown> = {
  isValidating: boolean;
  isLoading: boolean;
  error: Error;
  data: Data | undefined;
};

const concurrentItemCount = 3;

export function useDenomTraceByDenom(
  denoms: string[]
): SWRCommon<DenomTraceByDenom> {
  // use only unique IBC denoms
  const ibcDenoms = useDeepCompareMemoize(
    Array.from(new Set(denoms)).filter((denom) => denom.startsWith('ibc/'))
  );

  const restClient = useIbcRestClient();
  const swr = useSWRInfinite<
    [string, DenomTrace?],
    Error,
    SWRInfiniteKeyLoader<DenomTrace, [denom: string, namespace: string]>
  >(
    // allow hash to be an empty string
    (index: number) => [ibcDenoms.at(index) || '', 'denom-trace'],
    // handle cases of undefined client and empty hash string
    restClient
      ? async ([denom]) => {
          const hash = denom.split('ibc/').at(1);
          return [
            denom,
            // fetch denom trace only if the denom has an IBC hash
            hash
              ? await restClient.applications.transfer.v1
                  .denomTrace({ hash })
                  .then((response) => response.denom_trace)
              : undefined,
          ];
        }
      : null,
    // these endpoint responses never change
    {
      parallel: true,
      use: [immutable],
      initialSize: concurrentItemCount,
      revalidateFirstPage: false,
      revalidateAll: false,
    }
  );

  // get all pages, concurrentItemCount at a time
  const { size, setSize } = swr;
  useEffect(() => {
    if (size < ibcDenoms.length) {
      setSize((size) => Math.min(ibcDenoms.length, size + concurrentItemCount));
    }
  }, [size, setSize, ibcDenoms]);

  // combine pages into one
  const { data: pages } = swr;
  const data = useMemo<DenomTraceByDenom | undefined>(() => {
    return pages?.reduce<DenomTraceByDenom>(
      (map, [denom, denomTrace] = ['']) => {
        if (denom && denomTrace) {
          return map.set(denom, denomTrace);
        }
        return map;
      },
      new Map()
    );
  }, [pages]);

  const { isValidating, isLoading, error } = swr;
  return { isValidating, isLoading, error, data };
}

export function useDenomTrace(denom = ''): SWRCommon<DenomTrace> {
  const { data: denomTraceByDenom, ...swr } = useDenomTraceByDenom([denom]);
  return { ...swr, data: denomTraceByDenom?.get(denom) };
}
