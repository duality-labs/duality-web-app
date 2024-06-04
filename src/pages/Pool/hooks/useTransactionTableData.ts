import Long from 'long';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  GetTxsEventResponse,
  OrderBy,
} from '@duality-labs/neutronjs/types/codegen/cosmos/tx/v1beta1/service';

import { Token, getTokenId } from '../../../lib/web3/utils/tokens';
import { guessInvertedOrder } from '../../../lib/web3/utils/pairs';
import { DexMessageAction } from '../../../lib/web3/utils/events';
import { WalletAddress } from '../../../lib/web3/utils/address';

import { useCosmosRestClientPromise } from '../../../lib/web3/clients/restClients';

type Hash = string;
type EncodedData = string;
type NumericString = string;
export interface Tx {
  hash: Hash;
  height: NumericString;
  index: 0;
  timestamp?: string; // this should be added to making a block height data lookup
  tx_result: {
    code: 0;
    data: EncodedData;
    log: EncodedData;
    info: string;
    gas_wanted: NumericString;
    gas_used: NumericString;
    events: Array<{
      type: string;
      attributes: Array<{
        key: string;
        value: string;
        index: boolean;
      }>;
    }>;
    codespace: string;
  };
  tx: EncodedData;
}
export interface GetTxsEventResponseManuallyType {
  jsonrpc: '2.0';
  id: -1;
  result: {
    txs: Array<Tx>;
    total_count: NumericString;
  };
}

export default function useTransactionTableData({
  tokenA,
  tokenB,
  account,
  action,
  pageSize = 10,
  orderByAscending,
}: {
  tokenA: Token;
  tokenB: Token;
  account?: WalletAddress | null;
  action?: DexMessageAction;
  pageSize?: number;
  orderByAscending?: boolean;
}) {
  const tokenIdA = getTokenId(tokenA) || '';
  const tokenIdB = getTokenId(tokenB) || '';

  const cosmosRestClientPromise = useCosmosRestClientPromise();

  const [pageOffset] = useState<number>(0);
  return useQuery({
    queryKey: [
      'events',
      tokenIdA,
      tokenIdB,
      action,
      account,
      pageSize,
      pageOffset,
    ],
    enabled: !!(tokenIdA && tokenIdB),
    queryFn: async (): Promise<GetTxsEventResponse> => {
      const invertedOrder = guessInvertedOrder([tokenIdA, tokenIdB]);

      // disable if account is specifically `null` (eg. wallet is not connected)
      if (account === null) {
        return {
          txs: [],
          tx_responses: [],
          total: Long.ZERO,
          pagination: {
            total: Long.ZERO,
          },
        };
      }

      /*
       * note: there is an issue with using the REST client here, eg.
       *
       * const clientResult = await cosmosRestClient.tx.v1beta1.getTxsEvent({
       *   'events': [
       *      `message.module='${'dex'}'`,
       *      `message.TokenZero='${invertedOrder ? tokenIdB : tokenIdA}'`,
       *      `message.TokenOne='${!invertedOrder ? tokenIdB : tokenIdA}'`,
       *      ...action ? [`message.action='${action}'`] : [],
       *      ...account ? [`message.Creator='${account}'`] : [],
       *   ],
       *   'limit': Long.fromNumber(pageSize),
       *   'order_by': 2 as OrderBy.ORDER_BY_DESC,
       *   'page': Long.fromNumber(pageOffset + 1),
       *   'pagination': {}
       * });
       *
       * this issue is that the base axios client in telescope will parse the
       * "events" param differently that the chain expects, the default param
       * serializer creates "events[]=..." params but chain expects "events=..."
       * link: https://github.com/axios/axios/blob/v1.7.2/README.md?plain=1#L448-L459
       * link: https://github.com/cosmology-tech/telescope/blob/%40osmonauts/telescope%400.101.3/packages/lcd/src/rest.ts#L8-L11
       *
       * Instead we shall craft the query ourselves
       */

      // note: this is brittle code and may break on a chain CosmosSDK upgrade
      // create query params for the REST txs request
      const queryParams = new URLSearchParams({
        // specify DEX module
        events: `message.module='${'dex'}'`,
        // add expected pagination
        order_by: orderByAscending
          ? (1 as OrderBy.ORDER_BY_ASC).toFixed()
          : (2 as OrderBy.ORDER_BY_DESC).toFixed(),
        limit: (pageSize || 10).toFixed(),
        offset: (pageOffset * pageSize).toFixed(),
      });
      // append extra event conditions
      const tokenId0 = !invertedOrder ? tokenIdA : tokenIdB;
      const tokenId1 = !invertedOrder ? tokenIdB : tokenIdA;
      queryParams.append('events', `message.TokenZero='${tokenId0}'`);
      queryParams.append('events', `message.TokenOne='${tokenId1}'`);
      if (action) {
        queryParams.append('events', `message.action='${action}'`);
      }
      if (account) {
        queryParams.append('events', `message.Creator='${account}'`);
      }
      // make REST txs request
      const cosmosRestClient = await cosmosRestClientPromise;
      return cosmosRestClient.tx.v1beta1.req.get<GetTxsEventResponse>(
        `cosmos/tx/v1beta1/txs?${queryParams.toString()}`
      );
    },
  });
}
