import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Token } from '../../../lib/web3/utils/tokens';
import { guessInvertedOrder } from '../../../lib/web3/utils/pairs';
import { DexMessageAction } from '../../../lib/web3/utils/events';
import { WalletAddress } from '../../../lib/web3/utils/address';

const { REACT_APP__RPC_API = '' } = process.env;

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
interface GetTxsEventResponseManuallyType {
  jsonrpc: '2.0';
  id: -1;
  result: {
    txs: Array<Tx>;
    total_count: NumericString;
  };
}

const blockTimestamps: { [height: string]: string } = {};

export default function useTransactionTableData({
  tokenA,
  tokenB,
  account,
  action,
  pageSize = 10,
}: {
  tokenA: Token;
  tokenB: Token;
  account?: WalletAddress;
  action?: DexMessageAction;
  pageSize?: number;
}) {
  const [pageOffset] = useState<number>(0);
  return useQuery({
    queryKey: [
      'events',
      tokenA.address,
      tokenB.address,
      action,
      account,
      pageSize,
      pageOffset,
    ],
    queryFn: async (): Promise<GetTxsEventResponseManuallyType['result']> => {
      const invertedOrder = guessInvertedOrder(tokenA.address, tokenB.address);

      /*
       * note: you would expect the following to work, but the ABCI query check
       * fails the event query of attribute Token0 and Token1 for numeric chars
       * see: https://github.com/cosmos/cosmos-sdk/commit/18da0e9c15e0210fdd289e3f1f0f5fefe3f6b72a#diff-53f84248611b4e705fd4106d3f6f46eed9258656b0b3db22bd56fdde5628cebdR47
       *
       * const QueryClientImpl = cosmos.tx.v1beta1.ServiceClientImpl;
       * const dualityClient = new QueryClientImpl(rpc);
       * const response = await dualityClient.getTxsEvent({
       *   events: [
       *     `message.module='${'dex'}'`,
       *     !invertedOrder
       *       ? `message.Token='${tokenA.address}'`
       *       : `message.Token0='${tokenB.address}'`,
       *     !invertedOrder
       *       ? `message.Token='${tokenB.address}'`
       *       : `message.Token1='${tokenA.address}'`,
       *     action ? `message.action='${action}'` : '',
       *   ].filter(Boolean),
       *   orderBy: cosmos.tx.v1beta1.OrderBySDKType.ORDER_BY_ASC,
       *   page: Long.fromString(pageOffset + 1),
       *   limit: Long.fromString(pageSize),
       * });
       *
       * instead we will create the query string ourself and add the return type
       */

      const response = await fetch(
        `${REACT_APP__RPC_API}/tx_search?query="${encodeURIComponent(
          [
            `message.module='${'dex'}'`,
            !invertedOrder
              ? `message.Token0='${tokenA.address}'`
              : `message.Token0='${tokenB.address}'`,
            !invertedOrder
              ? `message.Token1='${tokenB.address}'`
              : `message.Token1='${tokenA.address}'`,
            account ? `message.Creator='${account}'` : '',
            action ? `message.action='${action}'` : '',
          ]
            .filter(Boolean)
            .join(' AND ')
        )}"&per_page=${pageSize}&page=${pageOffset + 1}`
      );
      const result = (await response.json()) as GetTxsEventResponseManuallyType;
      const { total_count, txs } = result['result'];

      // mutate the txs to contain block height timestamps
      const txsWithTimestamps = await Promise.all(
        txs.map(async (tx) => {
          if (!blockTimestamps[tx.height]) {
            const response = await fetch(
              `${REACT_APP__RPC_API}/header?height=${tx.height}`
            );
            if (response.status === 200) {
              const { result } = (await response.json()) as {
                result: {
                  header: {
                    height: string;
                    time: string;
                  };
                };
              };
              blockTimestamps[tx.height] = result.header.time;
            }
          }
          return {
            ...tx,
            timestamp: blockTimestamps[tx.height],
          };
        })
      );

      return {
        total_count,
        txs: txsWithTimestamps,
      };
    },
  });
}
