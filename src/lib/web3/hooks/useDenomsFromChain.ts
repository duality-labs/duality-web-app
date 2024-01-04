import { useDeepCompareMemoize } from 'use-deep-compare-effect';
import { useCallback, useMemo } from 'react';
import { immutable } from 'swr/immutable';
import { SWRConfiguration } from 'swr';
import useSWRInfinite, { SWRInfiniteKeyLoader } from 'swr/infinite';
import ms from 'ms';

import { DenomTrace } from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/transfer';
import {
  QueryDenomTraceResponse,
  QueryDenomTracesResponse,
} from '@duality-labs/dualityjs/types/codegen/ibc/applications/transfer/v1/query';

import { IbcRestClient, useIbcRestClient } from '../clients/lcdClients';
import { Asset } from '@chain-registry/types';

const fetchAtMostOncePerHour: SWRConfiguration = {
  dedupingInterval: ms('1 hour'),
};

type GetKey<Client, PageKey, Response> = SWRInfiniteKeyLoader<
  Response,
  [Client, PageKey] | null
>;
type GetIbcPaginationKey = GetKey<
  IbcRestClient,
  Uint8Array | undefined,
  QueryDenomTracesResponse
>;

export function useAllChainIbcDenoms(): Array<DenomTrace> | undefined {
  const restClient = useIbcRestClient();
  const getKey: SWRInfiniteKeyLoader<
    QueryDenomTracesResponse,
    [client: IbcRestClient, pageKey: Uint8Array | undefined, key: string] | null
  > = useCallback(
    (pageIndex, previousPageData) => {
      // don't start without the client
      if (!restClient) {
        return null;
      }

      // reached the end of pages
      if (previousPageData && !previousPageData.pagination.next_key) {
        return null;
      }

      // fetch page by pageKey
      const pageKey = previousPageData?.pagination.next_key;
      return [restClient, pageKey, 'denom-traces'];
    },
    [restClient]
  );
  const pages = useSWRInfinite<QueryDenomTracesResponse, Error, typeof getKey>(
    getKey,
    async ([restClient, pageKey]) => {
      return await restClient?.applications.transfer.v1.denomTraces({
        pagination: { key: pageKey },
      });
    },
    fetchAtMostOncePerHour
  ).data;

  return useMemo<DenomTrace[] | undefined>(() => {
    return pages?.flatMap((page) => page.denom_traces);
  }, [pages]);
}

function useUserIbcDenomTraces() {
  return [];
}
function useAsdf() {
  const denomTraces = useUserIbcDenomTraces();
  return denomTraces && {};
}
interface ExtendedDenomTrace extends DenomTrace {
  chain_denom: string;
}
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
      return [restClient, uniqueDenoms[index], 'denom-trace'];
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

interface DenomHint {
  chainName?: string;
  channelId?: string;
  channelPort?: string;
  channelTrust?: string;
  channelPath?: string;
}
export function useDenomDisambiguation(
  denom: string,
  otherDenoms: string[]
): DenomHint | undefined {
  const denomTraceByDenom = useDenomTraceByDenom([denom, ...otherDenoms]);

  const denomTrace = useMemo(
    () => denomTraceByDenom?.get(denom),
    [denom, denomTraceByDenom]
  );
  // otherSimilarTraces is deep-memoized to prevent updates of denoms that are
  // unrelated to this token (in denomTraceByDenom) from changing this var
  const otherSimilarTraces = useDeepCompareMemoize(
    useMemo(() => {
      const denomTrace = denomTraceByDenom?.get(denom);
      if (denomTrace && denomTraceByDenom) {
        return Array.from(denomTraceByDenom)
          .map(([, denomTrace]) => denomTrace)
          .filter((otherTrace) => otherTrace !== denomTrace)
          .filter(
            (otherTrace) => otherTrace.base_denom === denomTrace.base_denom
          );
      }
    }, [denom, denomTraceByDenom])
  );

  return useMemo<DenomHint | undefined>(() => {
    if (denomTrace) {
      // check if disambiguation is needed
      if (otherSimilarTraces?.length) {
        // show the user what is different between this denom and similar denoms
        // TODO: add more disambiguation hint logic here
        return { channelPath: denomTrace.path };
      }
      // disambiguation is not needed, return resolved empty hint
      return {};
    }
  }, [denomTrace, otherSimilarTraces]);
}
