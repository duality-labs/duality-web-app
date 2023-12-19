import { OfflineSigner } from '@cosmjs/proto-signing';
import { OfflineAminoSigner } from '@cosmjs/amino';

import {
  getSigningNeutronClient,
  getSigningIbcClient,
} from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API = '' } = import.meta.env;

export default function rpcClient(
  wallet?: OfflineSigner,
  rpcURL = REACT_APP__RPC_API
) {
  return getSigningNeutronClient({
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
