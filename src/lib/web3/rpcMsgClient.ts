import { OfflineSigner } from '@cosmjs/proto-signing';
import { OfflineAminoSigner } from '@cosmjs/amino';

import {
  getSigningCosmosClient,
  getSigningDualityClient,
  getSigningIbcClient,
} from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API = '' } = process.env;

export default function rpcClient(
  wallet?: OfflineSigner,
  rpcURL = REACT_APP__RPC_API
) {
  return getSigningDualityClient({
    rpcEndpoint: rpcURL,
    signer: wallet as OfflineAminoSigner,
  });
}

export function signingRpcClient(
  getSigningClientFunction:
    | typeof getSigningCosmosClient
    | typeof getSigningDualityClient,
  wallet?: OfflineSigner,
  rpcURL = REACT_APP__RPC_API
) {
  return getSigningClientFunction({
    rpcEndpoint: rpcURL,
    signer: wallet as OfflineAminoSigner,
  });
}

export function ibcClient(wallet?: OfflineSigner, rpcURL = REACT_APP__RPC_API) {
  return getSigningIbcClient({
    rpcEndpoint: rpcURL,
    signer: wallet as OfflineAminoSigner,
  });
}

export const getSigningDualityClient = async ({
  rpcEndpoint,
  signer,
  defaultTypes = defaultRegistryTypes
}: {
  rpcEndpoint: string | HttpEndpoint;
  signer: OfflineSigner;
  defaultTypes?: ReadonlyArray<[string, GeneratedType]>;
}) => {
  const registry = new Registry([...defaultTypes, ...dualityProtoRegistry]);
  const aminoTypes = new AminoTypes({
    ...dualityAminoConverters
  });
  const client = await SigningStargateClient.connectWithSigner(rpcEndpoint, signer, {
    registry: (registry as any),
    aminoTypes
  });
  return client;
};
