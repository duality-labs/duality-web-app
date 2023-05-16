import { HttpEndpoint } from '@cosmjs/tendermint-rpc';

import { dualitylabs } from '@duality-labs/dualityjs';
import { useMemo } from 'react';

const { REACT_APP__REST_API = '' } = process.env;

export function lcdClient(rpcURL = REACT_APP__REST_API) {
  return dualitylabs.ClientFactory.createLCDClient({ restEndpoint: rpcURL });
}

type LcdClient = Awaited<
  ReturnType<typeof dualitylabs.ClientFactory.createLCDClient>
>;

const _lcdClients: Record<string, LcdClient> = {};

const getLcdEndpointKey = (lcdEndpoint: string | HttpEndpoint) => {
  if (typeof lcdEndpoint === 'string') {
    return lcdEndpoint;
  } else if (!!lcdEndpoint) {
    return lcdEndpoint.url;
  }
};

const getLcdClient = async (
  lcdEndpoint: string | HttpEndpoint
): Promise<LcdClient> => {
  const key = getLcdEndpointKey(lcdEndpoint);
  if (!key) {
    throw new Error('No LCD endpoint given');
  }
  if (_lcdClients.hasOwnProperty(key)) {
    return _lcdClients[key];
  }
  const lcd = await dualitylabs.ClientFactory.createLCDClient({
    restEndpoint: key,
  });
  _lcdClients[key] = lcd;
  return lcd;
};

export default getLcdClient;

/* useRPCPromise: gets an `rpc` value in a promise
 * an RPC promise can easily be used to connect single-use RPC clients
 *   eg. const rpcPromise = useRPCPromise();
 *       // in a hook or callback somewhere
 *       comst cb = useCallback(() => {
 *         const bankClientImpl = cosmos.bank.v1beta1.QueryClientImpl;
 *         const bankClient = new bankClientImpl(await rpcPromise);
 *       });
 */
export function useLcdClientPromise(
  restEndpoint = REACT_APP__REST_API
): Promise<LcdClient> {
  // return a new promise for each provided endpoint
  return useMemo(() => {
    return getLcdClient(restEndpoint);
  }, [restEndpoint]);
}
