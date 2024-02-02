import { FontAwesomeIconProps } from '@fortawesome/react-fontawesome';
import { Asset } from '@chain-registry/types';
import AssetIcon from './AssetIcon';
import './AssetIconPair.scss';

// create aesthetic aspect ratio for icon pair
const r = 1.7;

export default function AssetIconPair({
  className,
  asset0,
  asset1,
  height = '2em',
}: {
  className?: string;
  asset0: Asset;
  asset1: Asset;
} & Pick<FontAwesomeIconProps, 'height'>) {
  const style = {
    height,
    width: typeof height === 'number' ? height * r : `calc(${height} * ${r})`,
  };
  return (
    <div
      className={['asset-icon-pair', className].filter(Boolean).join(' ')}
      style={style}
    >
      <AssetIcon height={height} asset={asset0} />
      <AssetIcon height={height} asset={asset1} />
    </div>
  );
}
