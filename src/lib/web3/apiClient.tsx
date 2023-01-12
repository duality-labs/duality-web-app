import { OfflineSigner } from '@cosmjs/proto-signing';

import { Client } from './generated/ts-client';
import { Env } from './generated/ts-client/env';

const { REACT_APP__REST_API = '', REACT_APP__RPC_API = '' } = process.env;

export default function apiClient(
  wallet: OfflineSigner,
  {
    apiURL = REACT_APP__REST_API,
    rpcURL = REACT_APP__RPC_API,
    prefix,
  }: Partial<Env> = {}
) {
  return new Client({ apiURL, rpcURL, prefix }, wallet);
}
