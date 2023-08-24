import { useMemo, useState } from 'react';
import { Asset } from '@chain-registry/types';

import BridgeCard from '../../components/cards/BridgeCard';
import { dualityAssets, providerAssets } from '../../lib/web3/hooks/useTokens';
import { Token } from '../../lib/web3/utils/tokens';
import { dualityChain, providerChain } from '../../lib/web3/hooks/useChains';

import './Bridge.scss';

export default function MyLiquidity() {
  const [assetFrom] = useState<Asset | undefined>(providerAssets?.assets.at(0));
  const [assetTo] = useState<Asset | undefined>(dualityAssets?.assets.at(0));
  const from = useMemo<Token | undefined>(() => {
    return (
      assetFrom &&
      providerChain && {
        address: '',
        chain: providerChain,
        ...assetFrom,
      }
    );
  }, [assetFrom]);
  const to = useMemo<Token | undefined>(() => {
    return (
      assetTo &&
      providerChain && {
        address: '',
        chain: dualityChain,
        ...assetTo,
      }
    );
  }, [assetTo]);

  return (
    <div className="container row">
      <div className="bridge-page col m-auto">
        <div className="page-card">
          <h2 className="h2 mb-lg">Bridge</h2>
          <BridgeCard from={from} to={to} />
        </div>
      </div>
    </div>
  );
}
