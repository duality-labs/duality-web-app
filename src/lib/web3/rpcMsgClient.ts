import { OfflineSigner } from '@cosmjs/proto-signing';
import { OfflineAminoSigner } from '@cosmjs/amino';

import { getSigningNicholasdotsolClient } from '@duality-labs/dualityjs';

const { REACT_APP__RPC_API = '' } = process.env;

export default function rpcClient(
  wallet?: OfflineSigner,
  rpcURL = REACT_APP__RPC_API
) {
  // new nicholasdotsol.duality.dex.MsgClientImpl();
  return getSigningNicholasdotsolClient({
    rpcEndpoint: rpcURL,
    signer: wallet as OfflineAminoSigner,
  });
}
