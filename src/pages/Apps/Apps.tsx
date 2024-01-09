import { Link, useMatch } from 'react-router-dom';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { IframeHTMLAttributes, useEffect, useRef } from 'react';
import useFrameMessaging, { useFrameHeight } from './useFrameMessaging';

interface DualityFrontEndMessageWalletAddress {
  type: 'WalletAddress';
  data: string | null;
}
interface DualityFrontEndMessageWalletExtension {
  type: 'WalletExtension';
  data: {
    name: 'keplr';
    isConnected: boolean;
  };
}
export type DualityFrontEndMessage =
  | DualityFrontEndMessageWalletExtension
  | DualityFrontEndMessageWalletAddress;

const marsStyle = {
  borderRadius: '1rem',
  borderWidth: 7,
  borderStyle: 'solid',
  borderColor: '#421f32',
  height: 100,
};
export default function Apps() {
  const marsSimple = useMatch('/apps/mars');
  const marsAdvanced = useMatch('/apps/mars/advanced');
  if (marsSimple) {
    return (
      <div className="container col flex gap-5 py-6">
        <img
          className="m-5 mr-auto"
          src="https://raw.githubusercontent.com/cosmos/chain-registry/master/mars/images/mars-protocol.svg"
          alt="Mars"
          style={{
            objectFit: 'cover',
            height: '10em',
            color: 'white',
            filter: 'invert(100%)',
          }}
        ></img>
        <p>Demo of dex data subscription using frame messaging</p>
        <ul style={{ marginLeft: 30 }}>
          <li>
            wallet address is read from outer frame (but could be read from
            inner frame)
          </li>
          <li>wallet address --&gt; inner frame</li>
          <li>wallet address is shown in inner frame</li>
          <li>
            in inner frame: (but notifications could be sent to outer frame)
            <ul style={{ marginLeft: 30 }}>
              <li>transaction loading notification state</li>
              <li>transaction request payload created</li>
              <li>transaction request authorization asked</li>
              <li>transaction request payload signed</li>
              <li>transaction request made</li>
              <li>transaction response notification state shown</li>
            </ul>
          </li>
        </ul>
        <AppIFrame src="https://65xs47-5173.csb.app" style={marsStyle} />
      </div>
    );
  }
  if (marsAdvanced) {
    return (
      <div className="container col flex gap-5 py-6">
        <img
          className="m-5 mr-auto"
          src="https://raw.githubusercontent.com/cosmos/chain-registry/master/mars/images/mars-protocol.svg"
          alt="Mars"
          style={{
            objectFit: 'cover',
            height: '10em',
            color: 'white',
            filter: 'invert(100%)',
          }}
        ></img>
        <p>
          Demo of dex transactions and data subscription using frame messaging
        </p>
        <ul style={{ marginLeft: 30 }}>
          <li>transaction loading notification state created in inner frame</li>
          <li>transaction loading notification state --&gt; outer frame</li>
          <li>transaction loading notification state shown in outer frame</li>
          <li>transaction request payload created in inner frame</li>
          <li>transaction request payload --&gt; outer frame</li>
          <li>transaction request payload signed in outer frame</li>
          <li>transaction request made in outer frame</li>
          <li>transaction response received in outer frame</li>
          <li>transaction response --&gt; inner frame</li>
          <li>transaction response parsed in inner frame</li>
          <li>
            transaction response notification state created in inner frame
          </li>
          <li>transaction response notification state --&gt; outer frame</li>
          <li>transaction response notification state shown in outer frame</li>
        </ul>
        <AppIFrame src="https://2rfjdl-5173.csb.app/" style={marsStyle} />
      </div>
    );
  }

  return (
    <div className="container col flex gap-5 py-6">
      <div className="row flex gap-5">
        <div style={{ width: '45em', height: '25em' }}>
          <Link
            className="logo"
            // may be redirected by other logic from here
            to="/apps/mars"
          >
            <div
              style={{
                height: '25em',
                backgroundImage:
                  'url("https://neutron.marsprotocol.io/_next/static/media/bg.0851eeb4.svg")',
                backgroundSize: 'cover',
                borderRadius: '1rem',
                border: '.4666666667rem solid #421f32',
              }}
            >
              <img
                className="m-5"
                src="https://raw.githubusercontent.com/cosmos/chain-registry/master/mars/images/mars-protocol.svg"
                alt="Mars"
                style={{
                  objectFit: 'cover',
                  height: '10em',
                  color: 'white',
                  filter: 'invert(100%)',
                }}
              ></img>
              <div className="ml-5">
                <h2 className="h2">The Advanced Orderbook</h2>
                <p>Get the best trading experience</p>
                <br />
                <i>
                  Demo of dex data subscription and inner frame wallet tx
                  signing
                </i>
              </div>
            </div>
          </Link>
        </div>

        <div style={{ width: '45em', height: '25em' }}>
          <Link
            className="logo"
            // may be redirected by other logic from here
            to="/apps/mars/advanced"
          >
            <div
              style={{
                height: '25em',
                backgroundImage:
                  'url("https://neutron.marsprotocol.io/_next/static/media/bg.0851eeb4.svg")',
                backgroundSize: 'cover',
                borderRadius: '1rem',
                border: '.4666666667rem solid #421f32',
              }}
            >
              <img
                className="m-5"
                src="https://raw.githubusercontent.com/cosmos/chain-registry/master/mars/images/mars-protocol.svg"
                alt="Mars"
                style={{
                  objectFit: 'cover',
                  height: '10em',
                  color: 'white',
                  filter: 'invert(100%)',
                }}
              ></img>
              <div className="ml-5">
                <h2 className="h2">The Advanced Orderbook</h2>
                <p>Get the best trading experience</p>
                <br />
                <i>
                  Demo of data subscription and outer frame wallet tx signing
                  using frame messaging
                </i>
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function AppIFrame({
  src,
  ...props
}: IframeHTMLAttributes<HTMLIFrameElement> & { src: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const framePort = useFrameMessaging(src);
  const height = useFrameHeight(framePort);
  const borderHeight = Number(props.style?.borderWidth) * 2;

  // update the frame with relevant state data
  const { wallet, address } = useWeb3();
  useEffect(() => {
    const message: DualityFrontEndMessageWalletExtension = {
      type: 'WalletExtension',
      data: {
        name: 'keplr',
        isConnected: !!wallet,
      },
    };
    // post to iframe
    framePort?.postMessage(message);
  }, [framePort, wallet]);
  useEffect(() => {
    const message: DualityFrontEndMessageWalletAddress = {
      type: 'WalletAddress',
      data: address,
    };
    // post to iframes
    framePort?.postMessage(message);
  }, [framePort, address]);

  return (
    <iframe
      title={`Preview for ${src}`}
      {...props}
      ref={frameRef}
      src={`${src}?standalone&parentOrigin=${encodeURIComponent(
        location.origin
      )}`}
      // sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
      style={{
        // defaults
        display: 'block',
        width: '100%',
        // custom
        ...props.style,
        // override
        height: height ? height + borderHeight : props.style?.height,
      }}
    />
  );
}
