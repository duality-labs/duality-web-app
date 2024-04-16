import { Asset } from '@chain-registry/types';
import './AssetName.scss';

export default function AssetSymbol({
  asset,
  placeholder,
}: {
  asset: Asset | undefined;
  placeholder?: string;
}) {
  // return symbol noted as an abbreviation
  return asset ? (
    <abbr className="asset-name" title={asset.description ?? asset.name}>
      {asset.symbol}
    </abbr>
  ) : (
    placeholder
  );
}
