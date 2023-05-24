import { OfflineSigner } from '@cosmjs/proto-signing';
import { OfflineAminoSigner } from '@cosmjs/amino';

import { getSigningDualitylabsClient } from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API = '' } = process.env;

export default function rpcClient(
  wallet?: OfflineSigner,
  rpcURL = REACT_APP__RPC_API
) {
  return getSigningDualitylabsClient({
    rpcEndpoint: rpcURL,
    signer: wallet as OfflineAminoSigner,
  });
}
