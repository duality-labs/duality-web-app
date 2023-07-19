import { OfflineSigner } from '@cosmjs/proto-signing';
import { OfflineAminoSigner } from '@cosmjs/amino';

import {
  getSigningCosmosClient,
  getSigningDualitylabsClient,
  getSigningDualitylabsClientOptions,
} from '@duality-labs/dualityjs';

import {
  HttpEndpoint,
  SigningStargateClient,
  SigningStargateClientOptions,
} from '@cosmjs/stargate';

const { REACT_APP__RPC_API = '' } = process.env;

export default function rpcClient(
  wallet: OfflineSigner,
  {
    rpcEndpoint = REACT_APP__RPC_API,
    ...signingStargateClientOptions
  }: SigningStargateClientOptions & { rpcEndpoint?: string | HttpEndpoint } = {}
) {
  return SigningStargateClient.connectWithSigner(rpcEndpoint, wallet, {
    ...signingStargateClientOptions,
    // add default Duality type registry
    ...getSigningDualitylabsClientOptions(),
  });
}

export function signingRpcClient(
  getSigningClientFunction:
    | typeof getSigningCosmosClient
    | typeof getSigningDualitylabsClient,
  wallet?: OfflineSigner,
  rpcURL = REACT_APP__RPC_API
) {
  return getSigningClientFunction({
    rpcEndpoint: rpcURL,
    signer: wallet as OfflineAminoSigner,
  });
}
