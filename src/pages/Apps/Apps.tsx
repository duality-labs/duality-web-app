import { Link, useMatch } from 'react-router-dom';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { useEffect, useRef, useState } from 'react';
import { useFrameMessagingForwarding, useFramePort, useInitializedFrame } from './frameMessaging';

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
//   const example1Ref = useRef<HTMLIFrameElement>(null);
//   const [readyFrame, setReadyFrame] = useState<HTMLIFrameElement>();

//     const allowedOrigin = 'https://tqljss-5173.csb.app';
//     useFrameMessagingForwarding(allowedOrigin);
//     const [readyFrame, frameRef] = useInitializedFrame(allowedOrigin);
//   const { wallet, address } = useWeb3();

//   useEffect(() => {
//     const message: DualityFrontEndMessageWalletExtension = {
//       type: 'WalletExtension',
//       data: {
//         name: 'keplr',
//         isConnected: !!wallet,
//       },
//     };
//     // post to iframe
//     readyFrame?.contentWindow?.postMessage(message, '*');
//   }, [readyFrame, wallet]);

//   useEffect(() => {
//     const message: DualityFrontEndMessageWalletAddress = {
//       type: 'WalletAddress',
//       data: address,
//     };
//     // post to iframes
//     readyFrame?.contentWindow?.postMessage(message, '*');
//   }, [readyFrame, address]);

//   useEffect(() => {
//     const handleFrameMessage = (event: MessageEvent) => {
//       console.log('hi any message', event);
//       if (
//         event.origin.endsWith('.csb.app') &&
//         event.origin.startsWith('https://')
//       ) {
//         console.log('hi message', event);
//       }
//     };
//     window.addEventListener('message', handleFrameMessage);
//     return () => window.removeEventListener('message', handleFrameMessage);
//   }, []);

  if (useMatch('/apps/mars')) {
    return (
        <App url="https://tqljss-5173.csb.app" />
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

function App({ url }: { url: string }) {
    const frameRef = useRef<HTMLIFrameElement>(null);
    const framePort = useFramePort(url);

    // forward signing client messages to the signing client
    useFrameMessagingForwarding(framePort);

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
          title={`Preview for ${url}`}
          ref={frameRef}
          src={`${url}?standalone&parentOrigin=${encodeURIComponent(
            location.origin
          )}`}
          // sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          style={{ display: 'block', width: '100%', height: 800 }}
        />
        {/* <iframe
          title="mars"
          ref={example1Ref}
          src="https://codesandbox.io/embed/76cgn6?view=preview&module=%2Fsrc%2FApp.tsx&hidenavigation=1"
          sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
          style={{ display: 'block', width: '100%', height: 500 }}
        /> */}
        {/* <iframe src="https://codesandbox.io/embed/76cgn6?view=preview&module=%2Fsrc%2FApp.tsx&expanddevtools=1"
            style={{"width":"100%", "height":" 500px", "border":"0", "borderRadius":" 4px", "overflow":"hidden"}}
            title="brave-lena-76cgn6"
     allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe> */}
      </div>
    );
}
