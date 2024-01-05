import { OfflineSigner } from '@cosmjs/proto-signing';
import { OfflineAminoSigner } from '@cosmjs/amino';

import {
  getSigningCosmosClient,
  getSigningDualityClient,
  getSigningIbcClient,
} from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API = '' } = import.meta.env;

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
