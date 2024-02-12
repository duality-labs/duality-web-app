import { Asset } from '@chain-registry/types';
import './AssetName.scss';

export default function AssetSymbol({ asset }: { asset: Asset | undefined }) {
  // return symbol noted as an abbreviation
  return asset ? (
    <abbr className="asset-name" title={asset.description ?? asset.name}>
      {asset.symbol}
    </abbr>
  ) : null;
}
