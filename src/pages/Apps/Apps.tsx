import { Link, useMatch } from 'react-router-dom';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useEffect, useRef } from 'react';

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

export default function Apps() {
  const example1Ref = useRef<HTMLIFrameElement>(null);

  const { wallet, address } = useWeb3();

  useEffect(() => {
    const message: DualityFrontEndMessageWalletExtension = {
      type: 'WalletExtension',
      data: {
        name: 'keplr',
        isConnected: !!wallet,
      },
    };
    // post to iframes
    example1Ref.current?.contentWindow?.postMessage(message);
  }, [wallet]);

  useEffect(() => {
    const message: DualityFrontEndMessageWalletAddress = {
      type: 'WalletAddress',
      data: address,
    };
    // post to iframes
    example1Ref.current?.contentWindow?.postMessage(message);
  }, [address]);

  if (useMatch('/apps/mars')) {
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
        <iframe
          title="mars"
          ref={example1Ref}
          src="https://codepen.io/dib542/embed/VwReGra"
          style={{ display: 'block', width: '100%', height: 500 }}
        />
      </div>
    );
  }

  return (
    <div className="container col flex gap-5 py-6">
      <div style={{ width: '40em', height: '25em' }}>
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
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
