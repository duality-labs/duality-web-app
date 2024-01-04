import { Link, useMatch } from 'react-router-dom';

import marsCard from '../../assets/mocks/mars-card.png';
import marsCard2 from '../../assets/mocks/mars-card-2.png';

export default function MyLiquidity() {
  if (useMatch('/apps/mars')) {
    return (
      <div className="mt-5 mb-auto">
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
          onError={({ currentTarget }) => {
            currentTarget.outerHTML = 'Duality';
          }}
        ></img>
        <div className="mt-5">
          <img src={marsCard} alt="Mars" />
        </div>
        <div className="mt-5">
          <img src={marsCard2} alt="Mars" />
        </div>
      </div>
    );
  }

  return (
    <div className="my-liquidity-page container col flex gap-5 py-6">
      <div>
        <Link
          className="logo"
          // may be redirected by other logic from here
          to="/apps/mars"
        >
          <div
            style={{
              width: '40em',
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
              onError={({ currentTarget }) => {
                currentTarget.outerHTML = 'Duality';
              }}
            ></img>
          </div>
        </Link>
      </div>
    </div>
  );
}
