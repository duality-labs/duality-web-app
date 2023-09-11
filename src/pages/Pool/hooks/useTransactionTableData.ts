import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Token } from '../../../lib/web3/utils/tokens';
import { guessInvertedOrder } from '../../../lib/web3/utils/pairs';
import { DexMessageAction } from '../../../lib/web3/utils/events';
import { WalletAddress } from '../../../lib/web3/utils/address';

import { cosmos } from '@duality-labs/dualityjs';
import { GetTxsEventResponseSDKType } from '@duality-labs/dualityjs/types/codegen/cosmos/tx/v1beta1/service';

const { REACT_APP__REST_API = '' } = process.env;

export type TxResponse = GetTxsEventResponseSDKType['tx_responses'][number];

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
    queryFn: async (): Promise<GetTxsEventResponseSDKType> => {
      const invertedOrder = guessInvertedOrder(tokenA.address, tokenB.address);

      /*
       * note: you would expect the following to work, but request sent has
       * the multiple event parameters set as "events[]=message...&events[]="
       * instead of "events=message...&events="
       *
       * const dualityClient = await cosmos.ClientFactory.createLCDClient({
       *   restEndpoint: REACT_APP__REST_API
       * });
       * const response = await dualityClient.cosmos.tx.v1beta1.getTxsEvent({
       *   events: [
       *     `message.module='${'dex'}'`,
       *     !invertedOrder
       *       ? `message.Token0='${tokenA.address}'`
       *       : `message.Token0='${tokenB.address}'`,
       *     !invertedOrder
       *       ? `message.Token1='${tokenB.address}'`
       *       : `message.Token1='${tokenA.address}'`,
       *     action ? `message.action='${action}'` : '',
       *   ].filter(Boolean),
       *   orderBy: cosmos.tx.v1beta1.OrderBySDKType.ORDER_BY_ASC,
       *   page: Long.fromString(pageOffset + 1),
       *   limit: Long.fromString(pageSize),
       * });
       *
       */

      const response = await fetch(
        `${REACT_APP__REST_API}/cosmos/tx/v1beta1/txs?events=${[
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
          .map(encodeURIComponent)
          .join('&events=')}&order_by=${
          cosmos.tx.v1beta1.OrderBySDKType.ORDER_BY_ASC
        }&limit=${pageSize}&page=${pageOffset + 1}`
      );
      return await response.json();
    },
  });
}
