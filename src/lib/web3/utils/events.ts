import BigNumber from 'bignumber.js';
import { Event, parseCoins } from '@cosmjs/stargate';
import { WalletAddress } from './address';
import { Token } from './tokens';

export function mapEventAttributes<T = ChainEvent>(event: Event): T {
  return {
    ...event,
    attributes: event.attributes.reduce<{ [key: string]: string }>(
      (acc, { key, value }) => {
        acc[key] = value;
        return acc;
      },
      {}
    ),
    // these attributes should but may not match the expected types
  } as unknown as T;
}

export type DexMessageAction =
  | 'PlaceLimitOrder'
  | 'Deposit'
  | 'Withdraw'
  | 'TickUpdate';

export type ChainEvent = CosmosEvent | DexEvent;

export type CosmosEvent =
  | TxFeeEvent
  | CoinTransferEvent
  | CoinSpentEvent
  | CoinReceivedEvent;

export type DexEvent =
  | DexPlaceLimitOrderEvent
  | DexDepositEvent
  | DexWithdrawalEvent
  | DexTickUpdateEvent;

export interface DexDepositEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'Deposit';
    Creator: WalletAddress;
    Receiver: WalletAddress;
    Token0: string;
    Token1: string;
    TickIndex: string;
    Fee: string;
    SharesMinted: string;
    Reserves0Deposited: string;
    Reserves1Deposited: string;
  };
}

export interface DexWithdrawalEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'Withdraw';
    Creator: WalletAddress;
    Receiver: WalletAddress;
    Token0: string;
    Token1: string;
    TickIndex: string;
    Fee: string;
    Reserves0Withdrawn: string;
    Reserves1Withdrawn: string;
    SharesRemoved: string;
  };
}

export interface DexPlaceLimitOrderEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'PlaceLimitOrder';
    Creator: WalletAddress;
    Receiver: WalletAddress;
    Token0: string;
    Token1: string;
    TokenIn: string;
    AmountIn: string;
    LimitTick: string;
    OrderType:
      | 'GOOD_TIL_CANCELLED'
      | 'FILL_OR_KILL'
      | 'IMMEDIATE_OR_CANCEL'
      | 'JUST_IN_TIME'
      | 'GOOD_TIL_TIME';
    Shares: string;
    TrancheKey: string;
  };
}

export interface DexTickUpdateEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'TickUpdate';
    Token0: string;
    Token1: string;
    TokenIn: string;
    TickIndex: string;
    Fee: string;
    Reserves: string;
  };
}

// CoinString is an amount and denom like "1000uATOM"
// typically handled with object type Coin from @cosmjs/stargate
type CoinString = string;
export interface CoinReceivedEvent {
  type: 'coin_received';
  attributes: {
    amount: CoinString;
    receiver: WalletAddress;
  };
}

export interface CoinSpentEvent {
  type: 'coin_spent';
  attributes: {
    amount: CoinString;
    spender: WalletAddress;
  };
}

export interface CoinTransferEvent {
  type: 'transfer';
  attributes: {
    amount: CoinString;
    recipient: WalletAddress;
    sender: WalletAddress;
  };
}

export interface TxFeeEvent {
  type: 'tx';
  attributes: {
    fee: CoinString;
    fee_payer: WalletAddress;
  };
}

export function getSpentTokenAmount(
  events: ChainEvent[],
  spender: WalletAddress,
  {
    matchToken,
    includeFees,
  }: { matchToken?: Token; includeFees?: boolean } = {}
): BigNumber {
  const excludedEvents: ChainEvent[] = includeFees
    ? []
    : getFeeEvents(events, spender);
  const tokenEvents = events.filter(
    (event): event is CoinSpentEvent =>
      !excludedEvents.includes(event) &&
      event.type === 'coin_spent' &&
      (matchToken
        ? event.attributes.amount.endsWith(matchToken.address)
        : true) &&
      event.attributes.spender === spender
  );
  return sumTokenEventAmounts(tokenEvents);
}

export function getReceivedTokenAmount(
  events: ChainEvent[],
  receiver: WalletAddress,
  {
    matchToken,
    includeFees,
  }: { matchToken?: Token; includeFees?: boolean } = {}
): BigNumber {
  const excludedEvents: ChainEvent[] = includeFees
    ? []
    : getFeeEvents(events, receiver);
  const tokenEvents = events.filter(
    (event): event is CoinReceivedEvent =>
      !excludedEvents.includes(event) &&
      event.type === 'coin_received' &&
      (matchToken
        ? event.attributes.amount.endsWith(matchToken.address)
        : true) &&
      event.attributes.receiver === receiver
  );
  return sumTokenEventAmounts(tokenEvents);
}

// find the fee events in a list of ChainEvents, eg. for excluding from a search
function getFeeEvents(events: ChainEvent[], feePayer: WalletAddress) {
  const feeTxEvent = events.find((event): event is TxFeeEvent => {
    return event.type === 'tx' && event.attributes.fee_payer === feePayer;
  });
  const feeTransferEvent =
    feeTxEvent &&
    events.find((event): event is CoinTransferEvent => {
      return (
        event.type === 'coin_spent' &&
        event.attributes.amount === feeTxEvent.attributes.fee &&
        event.attributes.spender === feeTxEvent.attributes.fee_payer
      );
    });
  const feeSpentEvent =
    feeTransferEvent &&
    events.find((event): event is CoinSpentEvent => {
      return (
        event.type === 'coin_spent' &&
        event.attributes.amount === feeTransferEvent.attributes.amount &&
        event.attributes.spender === feeTransferEvent.attributes.sender
      );
    });
  const feeReceivedEvent =
    feeTransferEvent &&
    events.find((event): event is CoinReceivedEvent => {
      return (
        event.type === 'coin_received' &&
        event.attributes.amount === feeTransferEvent.attributes.amount &&
        event.attributes.receiver === feeTransferEvent.attributes.recipient
      );
    });
  return [
    feeTxEvent,
    feeTransferEvent,
    feeSpentEvent,
    feeReceivedEvent,
  ].flatMap((event) => (event ? [event] : []));
}

function sumTokenEventAmounts(
  events: (CoinReceivedEvent | CoinSpentEvent)[]
): BigNumber {
  return events
    .map(({ attributes }) => parseCoins(attributes.amount)[0])
    .reduce((acc, coin) => acc.plus(coin?.amount || 0), new BigNumber(0));
}
