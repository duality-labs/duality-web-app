import { LimitOrderType } from '@duality-labs/dualityjs/types/codegen/dualitylabs/duality/dex/tx';
import Table from '../../components/Table/Table';
import { formatDateTime } from '../../lib/utils/time';
import { useWeb3 } from '../../lib/web3/useWeb3';
import { WalletAddress } from '../../lib/web3/utils/address';
import {
  DexEvent,
  DexPlaceLimitOrderEvent,
  getReceivedTokenAmount,
  getSpentTokenAmount,
  mapEventAttributes,
} from '../../lib/web3/utils/events';
import { Token, getAmountInDenom } from '../../lib/web3/utils/tokens';
import useTransactionTableData, {
  Tx,
} from '../Pool/hooks/useTransactionTableData';

import './OrderbookFooter.scss';
import { formatCurrency } from '../../lib/utils/number';
import BigNumber from 'bignumber.js';
import {
  dualityMainToken,
  dualityStakeToken,
} from '../../lib/web3/hooks/useTokens';
import { useSimplePrice } from '../../lib/tokenPrices';

export default function OrderbookFooter({
  tokenA,
  tokenB,
}: {
  tokenA?: Token;
  tokenB?: Token;
}) {
  const { address: account } = useWeb3();
  return (
    <div className="page-card flex">
      <div className="row flex-centered mb-lg">
        <div className="col">
          <div className="row flex-centered gap-lg">
            <h4 className="h4">Orders</h4>
          </div>
        </div>
        <div className="col ml-auto">Card Nav right</div>
      </div>
      <div className="row orderbook-orders">
        {tokenA && tokenB && account && (
          <OrderbookFooterTable
            tokenA={tokenA}
            tokenB={tokenB}
            account={account}
          />
        )}
      </div>
    </div>
  );
}

const pageSize = 10;
function OrderbookFooterTable({
  tokenA,
  tokenB,
  account,
}: {
  tokenA: Token;
  tokenB: Token;
  account: WalletAddress;
}) {
  const { data } = useTransactionTableData({
    tokenA,
    tokenB,
    action: 'PlaceLimitOrder',
    account,
    pageSize,
  });

  return <Table<Tx> headings={headings} columns={columns} data={data?.txs} />;
}

const headings = [
  'Time',
  'Type',
  'Side',
  'Price',
  'Amount',
  'Filled',
  'Total',
  'Status',
];
const columns = [
  TimeColumn,
  TypeColumn,
  SideColumn,
  PriceColumn,
  AmountColumn,
  FilledColumn,
  TotalColumn,
  StatusColumn,
];

function TimeColumn({ row: tx }: { row: Tx }) {
  return (
    <td>
      {tx.timestamp ? (
        <>{formatDateTime(tx.timestamp)}</>
      ) : (
        <>Block: {tx.height}</>
      )}
    </td>
  );
}

function findPlaceLimitOrderActionEvent({
  attributes,
}: Tx['tx_result']['events'][number]) {
  return (
    attributes
      // .filter((event): event is DexPlaceLimitOrderEvent => event.key === 'action' && event.value === 'PlaceLimitOrder' )
      .find(({ key, value }) => key === 'action' && value === 'PlaceLimitOrder')
  );
}

const orderTypeTextMap: {
  [key in keyof typeof LimitOrderType]: string;
} = {
  IMMEDIATE_OR_CANCEL: 'Market',
  FILL_OR_KILL: 'Fill-Kill',
  GOOD_TIL_CANCELLED: 'Limit',
  GOOD_TIL_TIME: 'Stop Order',
  JUST_IN_TIME: 'JIT',
  UNRECOGNIZED: 'Unknown',
};

function TypeColumn({ row: tx }: { row: Tx }) {
  const event = tx.tx_result.events.find(findPlaceLimitOrderActionEvent);
  if (event) {
    const attributes =
      mapEventAttributes<DexPlaceLimitOrderEvent>(event).attributes;
    return <td>{orderTypeTextMap[attributes.OrderType]}</td>;
  }
  return <td></td>;
}

function SideColumn({ row: tx }: { row: Tx }) {
  const event = tx.tx_result.events.find(findPlaceLimitOrderActionEvent);
  if (event) {
    const attributes =
      mapEventAttributes<DexPlaceLimitOrderEvent>(event).attributes;
    // todo: un-hardcode
    return (
      <td>
        {attributes.TokenIn === 'token' ? (
          <span className="text-success">Buy</span>
        ) : (
          <span className="text-danger">Sell</span>
        )}
      </td>
    );
  }
  return <td></td>;
}

function PriceColumn() {
  // todo: un-hardcode
  return <td>{formatCurrency(Math.random())}</td>;
}

function AmountColumn({ row: tx }: { row: Tx }) {
  const events = tx.tx_result.events.map((event) =>
    mapEventAttributes<DexEvent>(event)
  );

  const event = tx.tx_result.events.find(findPlaceLimitOrderActionEvent);
  const attributes = mapEventAttributes<DexPlaceLimitOrderEvent>(
    event || { type: '', attributes: [] }
  ).attributes;

  const tokenA = dualityMainToken;
  // const tokenB = dualityStakeToken;

  function getTokenAReserves() {
    const address = attributes.Creator;
    return attributes.TokenIn === tokenA.address
      ? getSpentTokenAmount(events, address, { matchToken: tokenA })
      : getReceivedTokenAmount(events, address, { matchToken: tokenA });
  }

  // function getTokenBReserves() {
  //   const address = attributes.Creator;
  //   return attributes.TokenIn === tokenB.address
  //     ? getSpentTokenAmount(events, address, { matchToken: tokenB })
  //     : getReceivedTokenAmount(events, address, { matchToken: tokenB });
  // }

  function getTokenReservesInDenom(token: Token, reserves: BigNumber.Value) {
    return getAmountInDenom(token, reserves, token.address, token.display, {
      fractionalDigits: 3,
      significantDigits: 3,
    });
  }

  if (event && attributes) {
    return <td>{getTokenReservesInDenom(tokenA, getTokenAReserves())}</td>;
  }
  return <td></td>;
}

function FilledColumn() {
  // todo: un-hardcode
  return <td>100%</td>;
}

function TotalColumn({ row: tx }: { row: Tx }) {
  const tokenA = dualityMainToken;
  const tokenB = dualityStakeToken;
  const {
    data: [tokenAPrice],
    // isValidating,
  } = useSimplePrice([tokenA, tokenB]);
  const events = tx.tx_result.events.map((event) =>
    mapEventAttributes<DexEvent>(event)
  );

  const event = tx.tx_result.events.find(findPlaceLimitOrderActionEvent);
  const attributes = mapEventAttributes<DexPlaceLimitOrderEvent>(
    event || { type: '', attributes: [] }
  ).attributes;

  function getTokenAReserves() {
    const address = attributes.Creator;
    return attributes.TokenIn === tokenA.address
      ? getSpentTokenAmount(events, address, { matchToken: tokenA })
      : getReceivedTokenAmount(events, address, { matchToken: tokenA });
  }

  // function getTokenBReserves() {
  //   const address = attributes.Creator;
  //   return attributes.TokenIn === tokenB.address
  //     ? getSpentTokenAmount(events, address, { matchToken: tokenB })
  //     : getReceivedTokenAmount(events, address, { matchToken: tokenB });
  // }

  // function getTokenReservesInDenom(token: Token, reserves: BigNumber.Value) {
  //   return getAmountInDenom(token, reserves, token.address, token.display, {
  //     fractionalDigits: 3,
  //     significantDigits: 3,
  //   });
  // }

  if (event && attributes) {
    const value = new BigNumber(
      getAmountInDenom(
        tokenA,
        getTokenAReserves(),
        tokenA.address,
        tokenA.display
      ) || 0
    ).multipliedBy(tokenAPrice || 0);
    return (
      <td>
        {value.isLessThan(0.005)
          ? `< ${formatCurrency(0.01)}`
          : formatCurrency(value.toNumber())}
      </td>
    );
  }
  return <td></td>;
}

function StatusColumn() {
  // todo: un-hardcode
  return <td>Filled</td>;
}
