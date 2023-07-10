import BigNumber from 'bignumber.js';
import { Event } from '@cosmjs/stargate';
import { EventSDKType } from '@duality-labs/dualityjs/types/codegen/tendermint/abci/types';
import { TokenAddress } from './tokens';

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

export function decodeEvent(event: Event | EventSDKType): Event {
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
  | DexWithdrawalEvent;

export interface DexDepositEvent {
  type: 'message';
  attributes: {
    module: 'dex';
    action: 'Deposit';
    Creator: TokenAddress;
    Receiver: TokenAddress;
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
    Creator: TokenAddress;
    Receiver: TokenAddress;
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
    Creator: TokenAddress;
    Receiver: TokenAddress;
    Token0: string;
    Token1: string;
    TokenIn: string;
    AmountIn: string;
    LimitTick: string;
    OrderType: string;
    Shares: string;
    TrancheKey: string;
  };
}

type AmountDenomString = string;
export interface CoinReceivedEvent {
  type: 'coin_received';
  attributes: {
    amount: AmountDenomString;
    receiver: TokenAddress;
  };
}

export interface CoinSpentEvent {
  type: 'coin_spent';
  attributes: {
    amount: AmountDenomString;
    spender: TokenAddress;
  };
}

export interface CoinTransferEvent {
  type: 'transfer';
  attributes: {
    amount: AmountDenomString;
    recipient: TokenAddress;
    sender: TokenAddress;
  };
}

export interface TxFeeEvent {
  type: 'tx';
  attributes: {
    fee: AmountDenomString;
    fee_payer: TokenAddress;
  };
}

export function parseAmountDenomString(
  amountDenom: AmountDenomString
): [amount: BigNumber, denom: string] {
  const [, amountString, denom] = amountDenom.match(/^(\d+)(.*)$/) || [];
  const amount = new BigNumber(amountString);
  if (amount.isNaN()) {
    throw new Error(`Invalid token amount: ${amountString}`);
  }
  return [amount, denom];
}
