import { Event } from '@cosmjs/stargate';

export function getEventAttributeMap<T extends object>({
  attributes,
}: Event): T {
  return attributes.reduce<{ [key: string]: string }>((acc, { key, value }) => {
    acc[key] = value;
    return acc;
  }, {}) as T;
}

export function decodeEvent(event: Event) {
  return {
    ...event,
    // change base64 encoded objects into plain string values
    attributes: event.attributes.map(({ key, value, ...rest }) => {
      return {
        ...rest,
        key: Buffer.from(key, 'base64').toString(),
        value: Buffer.from(value, 'base64').toString(),
      };
    }),
  };
}

export interface DexDepositEvent {
  module: 'dex';
  action: 'Deposit';
  Creator: string;
  Receiver: string;
  Token0: string;
  Token1: string;
  TickIndex: string;
  Fee: string;
  SharesMinted: string;
  Reserves0Deposited: string;
  Reserves1Deposited: string;
}

export interface DexWithdrawalEvent {
  module: 'dex';
  action: 'Withdraw';
  Creator: string;
  Receiver: string;
  Token0: string;
  Token1: string;
  TickIndex: string;
  Fee: string;
  Reserves0Withdrawn: string;
  Reserves1Withdrawn: string;
  SharesRemoved: string;
}
