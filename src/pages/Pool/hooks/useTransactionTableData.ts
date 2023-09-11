import Long from 'long';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { Token } from '../../../lib/web3/utils/tokens';
import { guessInvertedOrder } from '../../../lib/web3/utils/pairs';
import { DexMessageAction } from '../../../lib/web3/utils/events';
import { WalletAddress } from '../../../lib/web3/utils/address';

import { cosmos } from '@duality-labs/dualityjs';
import { GetTxsEventResponse } from '@duality-labs/dualityjs/types/codegen/cosmos/tx/v1beta1/service';

const { REACT_APP__RPC_API = '' } = process.env;

export type TxResponse = GetTxsEventResponse['txResponses'][number];

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
    queryFn: async (): Promise<GetTxsEventResponse> => {
      const invertedOrder = guessInvertedOrder(tokenA.address, tokenB.address);

      const dualityClient = await cosmos.ClientFactory.createRPCQueryClient({
        rpcEndpoint: REACT_APP__RPC_API,
      });
      const response = await dualityClient.cosmos.tx.v1beta1.getTxsEvent({
        events: [
          `message.module='${'dex'}'`,
          !invertedOrder
            ? `message.TokenZero='${tokenA.address}'`
            : `message.TokenZero='${tokenB.address}'`,
          !invertedOrder
            ? `message.TokenOne='${tokenB.address}'`
            : `message.TokenOne='${tokenA.address}'`,
          action ? `message.action='${action}'` : '',
        ].filter(Boolean),
        orderBy: cosmos.tx.v1beta1.OrderBySDKType.ORDER_BY_ASC,
        page: Long.fromNumber(pageOffset + 1),
        limit: Long.fromNumber(pageSize),
      });
      return response;
    },
  });
}
