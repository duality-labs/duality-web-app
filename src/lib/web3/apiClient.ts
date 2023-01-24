import { OfflineSigner } from '@cosmjs/proto-signing';

import { IgniteClient } from './generated/ts-client/client';
import { Env } from './generated/ts-client/env';

import { Module as CosmosBankV1Beta1 } from './generated/ts-client/cosmos.bank.v1beta1';
import { Module as Dex } from './generated/ts-client/nicholasdotsol.duality.dex';

const { REACT_APP__REST_API = '', REACT_APP__RPC_API = '' } = import.meta.env;

const CustomClient = IgniteClient.plugin([CosmosBankV1Beta1, Dex]);

export default function apiClient(
  wallet: OfflineSigner,
  {
    apiURL = REACT_APP__REST_API,
    rpcURL = REACT_APP__RPC_API,
    prefix,
  }: Partial<Env> = {}
) {
  return new CustomClient({ apiURL, rpcURL, prefix }, wallet);
}
