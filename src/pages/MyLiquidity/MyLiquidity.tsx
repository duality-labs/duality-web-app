import { Flex, Heading } from '@chakra-ui/react';
import { Link } from 'react-router-dom';
import { useBankBalances } from '../../lib/web3/indexerProvider';
import { useWeb3 } from '../../lib/web3/useWeb3';

import './MyLiquidity.scss';

export default function MyLiquidity() {
  const { wallet } = useWeb3();
  const { data: balances, isValidating } = useBankBalances();

  if (!wallet || (!isValidating && (!balances || balances.length === 0))) {
    return (
      <Flex
        className="no-liquidity"
        flexDirection="column"
        gap="1.25em"
        alignItems="center"
      >
        <Heading size="lg"> No liquidity positions found</Heading>
        <Link to="/add-liquidity">
          <button className="button button-info add-liquidity p-3 px-4">
            Add new liquidity
          </button>
        </Link>
      </Flex>
    );
  }

  return <div>Coming Soon</div>;
}
