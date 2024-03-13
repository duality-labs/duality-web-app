import {
  FontAwesomeIcon,
  FontAwesomeIconProps,
} from '@fortawesome/react-fontawesome';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import { Asset } from '@chain-registry/types';
import './AssetIcon.scss';

export default function AssetIcon({
  asset,
  height = '2em',
}: { asset: Asset } & Pick<FontAwesomeIconProps, 'height'>) {
  const style = { height, width: height };
  return asset?.logo_URIs ? (
    // if logos exist for the asset then use these
    <img
      className="asset-icon"
      alt={`${asset.name} logo`}
      style={style}
      // in this context (large images) prefer SVGs over PNGs for better images
      src={asset.logo_URIs.svg || asset.logo_URIs.png}
    />
  ) : (
    // if no logos exist for the asset (or the asset doesn't exist) then use "?"
    <FontAwesomeIcon
      icon={faQuestionCircle}
      style={style}
      className="asset-icon asset-image-not-found"
    ></FontAwesomeIcon>
  );
}
