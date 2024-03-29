import BigNumber from 'bignumber.js';
import { Event, parseCoins } from '@cosmjs/stargate';

import { tickIndexToPrice } from './ticks';
import { WalletAddress } from './address';
import { Token, TokenID, getTokenId } from './tokens';

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

// note: some versions of CosmosSDK have base64 encoded keys and values,
//       the values were base64 encoded in Tendermint versions before v0.35.0
// the switch to plain strings is documented here:
// - Tendermint v0.35.0
//   - code: https://github.com/tendermint/tendermint/blob/v0.35.0/proto/tendermint/abci/types.proto#L282-L286
//   - docs: https://github.com/tendermint/tendermint/blob/v0.35.0/CHANGELOG.md?plain=1#L120
// - CometBFT v0.37.0
//   - code: https://github.com/cometbft/cometbft/blob/v0.37.0/proto/tendermint/abci/types.proto#L346-L350
//   - docs: https://github.com/cometbft/cometbft/blob/v0.37.0/CHANGELOG.md?plain=1#L44-L46
export function decodeEvent(event: Event): Event {
  return {
    ...event,
    // change base64 encoded objects into plain string values
    attributes: event.attributes.map(({ key, value, ...rest }) => {
      return {
        ...rest,
        key: Buffer.from(`${key}`, 'base64').toString(),
        value: Buffer.from(`${value}`, 'base64').toString(),
      };
    }),
  };
}

export type DexMessageAction =
  | 'PlaceLimitOrder'
  | 'DepositLP'
  | 'WithdrawLP'
  | 'TickUpdate';

export type ChainEvent = CosmosEvent | IBCEvent | DexEvent;

export type CosmosEvent =
  | TxFeeEvent
  | CoinTransferEvent
  | CoinSpentEvent
  | CoinReceivedEvent;

export type IBCEvent = IBCSendPacketEvent | IBCReceivePacketEvent;

export type DexEvent =
  | DexPlaceLimitOrderEvent
  | DexDepositEvent
  | DexWithdrawalEvent
  | DexTickUpdateEvent;

export interface DexDepositEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'DepositLP';
    Creator: WalletAddress;
    Receiver: WalletAddress;
    TokenZero: string;
    TokenOne: string;
    TickIndex: string;
    Fee: string;
    SharesMinted: string;
    ReservesZeroDeposited: string;
    ReservesOneDeposited: string;
  };
}

export interface DexWithdrawalEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'WithdrawLP';
    Creator: WalletAddress;
    Receiver: WalletAddress;
    TokenZero: string;
    TokenOne: string;
    TickIndex: string;
    Fee: string;
    ReservesZeroWithdrawn: string;
    ReservesOneWithdrawn: string;
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
    TokenZero: string;
    TokenOne: string;
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
  type: 'message' | 'TickUpdate';
  attributes: {
    module: 'dex';
    action: 'TickUpdate';
    TokenZero: string;
    TokenOne: string;
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

interface IBCPacketEventAttributes {
  packet_data: string; // JSON string representation of the packet
  packet_data_hex: string;
  packet_timeout_height: string;
  packet_timeout_timestamp: string;
  packet_sequence: string;
  packet_src_port: string;
  packet_src_channel: string;
  packet_dst_port: string;
  packet_dst_channel: string;
  packet_channel_ordering: string;
  packet_connection: string;
  connection_id: string;
}

export interface IBCSendPacketEvent {
  type: 'send_packet';
  attributes: IBCPacketEventAttributes;
}

export interface IBCReceivePacketEvent {
  type: 'recv_packet';
  attributes: IBCPacketEventAttributes;
}

export function getLastPrice(
  events: ChainEvent[],
  { tokenA, tokenB }: { tokenA: Token; tokenB: Token }
) {
  const lastTickUpdate = events
    .reverse()
    .find((event): event is DexTickUpdateEvent => {
      return (
        (event.type === 'message' || event.type === 'TickUpdate') &&
        event.attributes.action === 'TickUpdate'
      );
    });
  const tickIndex = lastTickUpdate
    ? new BigNumber(lastTickUpdate.attributes.TickIndex)
    : undefined;
  const forward = lastTickUpdate?.attributes.TokenZero === getTokenId(tokenA);
  const reverse = lastTickUpdate?.attributes.TokenZero === getTokenId(tokenB);
  return tickIndex && (forward || reverse)
    ? tickIndexToPrice(forward ? tickIndex : tickIndex.negated())
    : undefined;
}

export function getSpentTokenAmount(
  events: ChainEvent[],
  {
    address: spender,
    matchToken,
    matchTokenId = getTokenId(matchToken),
    includeFees,
  }: {
    address?: WalletAddress;
    matchToken?: Token;
    matchTokenId?: TokenID;
    includeFees?: boolean;
  } = {}
): BigNumber {
  const excludedEvents: ChainEvent[] = includeFees
    ? []
    : getFeeEvents(events, spender);
  const tokenEvents = events.filter(
    (event): event is CoinSpentEvent =>
      !excludedEvents.includes(event) &&
      event.type === 'coin_spent' &&
      (matchTokenId ? event.attributes.amount.endsWith(matchTokenId) : true) &&
      (spender ? event.attributes.spender === spender : true)
  );
  return sumTokenEventAmounts(tokenEvents);
}

export function getReceivedTokenAmount(
  events: ChainEvent[],
  {
    address: receiver,
    matchToken,
    matchTokenId = getTokenId(matchToken),
    includeFees,
  }: {
    address?: WalletAddress;
    matchToken?: Token;
    matchTokenId?: TokenID;
    includeFees?: boolean;
  } = {}
): BigNumber {
  const excludedEvents: ChainEvent[] = includeFees
    ? []
    : getFeeEvents(events, receiver);
  const tokenEvents = events.filter(
    (event): event is CoinReceivedEvent =>
      !excludedEvents.includes(event) &&
      event.type === 'coin_received' &&
      (matchTokenId ? event.attributes.amount.endsWith(matchTokenId) : true) &&
      (receiver ? event.attributes.receiver === receiver : true)
  );
  return sumTokenEventAmounts(tokenEvents);
}

// find the fee events in a list of ChainEvents, eg. for excluding from a search
function getFeeEvents(events: ChainEvent[], feePayer?: WalletAddress) {
  const feeTxEvent = events.find((event): event is TxFeeEvent => {
    return (
      event.type === 'tx' &&
      // match fee payer string if asked for
      (feePayer
        ? event.attributes.fee_payer === feePayer
        : !!event.attributes.fee_payer)
    );
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
