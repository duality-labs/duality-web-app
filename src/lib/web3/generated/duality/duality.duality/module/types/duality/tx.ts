/* eslint-disable */
import { Reader, Writer } from 'protobufjs/minimal';

export const protobufPackage = 'duality.duality';

export interface MsgDepositShares {
  creator: string;
  token0: string;
  token1: string;
  price0: string;
  price1: string;
  fee: string;
  shares0: string;
  shares1: string;
}

export interface MsgDepositSharesResponse {}

export interface MsgWithdrawShares {
  creator: string;
  token0: string;
  token1: string;
  price0: string;
  price1: string;
  fee: string;
  shares0: string;
  shares1: string;
}

export interface MsgWithdrawSharesResponse {}

const baseMsgDepositShares: object = {
  creator: '',
  token0: '',
  token1: '',
  price0: '',
  price1: '',
  fee: '',
  shares0: '',
  shares1: '',
};

export const MsgDepositShares = {
  encode(message: MsgDepositShares, writer: Writer = Writer.create()): Writer {
    if (message.creator !== '') {
      writer.uint32(10).string(message.creator);
    }
    if (message.token0 !== '') {
      writer.uint32(18).string(message.token0);
    }
    if (message.token1 !== '') {
      writer.uint32(26).string(message.token1);
    }
    if (message.price0 !== '') {
      writer.uint32(34).string(message.price0);
    }
    if (message.price1 !== '') {
      writer.uint32(42).string(message.price1);
    }
    if (message.fee !== '') {
      writer.uint32(50).string(message.fee);
    }
    if (message.shares0 !== '') {
      writer.uint32(58).string(message.shares0);
    }
    if (message.shares1 !== '') {
      writer.uint32(66).string(message.shares1);
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): MsgDepositShares {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseMsgDepositShares } as MsgDepositShares;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.token0 = reader.string();
          break;
        case 3:
          message.token1 = reader.string();
          break;
        case 4:
          message.price0 = reader.string();
          break;
        case 5:
          message.price1 = reader.string();
          break;
        case 6:
          message.fee = reader.string();
          break;
        case 7:
          message.shares0 = reader.string();
          break;
        case 8:
          message.shares1 = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): MsgDepositShares {
    const message = { ...baseMsgDepositShares } as MsgDepositShares;
    if (object.creator !== undefined && object.creator !== null) {
      message.creator = String(object.creator);
    } else {
      message.creator = '';
    }
    if (object.token0 !== undefined && object.token0 !== null) {
      message.token0 = String(object.token0);
    } else {
      message.token0 = '';
    }
    if (object.token1 !== undefined && object.token1 !== null) {
      message.token1 = String(object.token1);
    } else {
      message.token1 = '';
    }
    if (object.price0 !== undefined && object.price0 !== null) {
      message.price0 = String(object.price0);
    } else {
      message.price0 = '';
    }
    if (object.price1 !== undefined && object.price1 !== null) {
      message.price1 = String(object.price1);
    } else {
      message.price1 = '';
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = String(object.fee);
    } else {
      message.fee = '';
    }
    if (object.shares0 !== undefined && object.shares0 !== null) {
      message.shares0 = String(object.shares0);
    } else {
      message.shares0 = '';
    }
    if (object.shares1 !== undefined && object.shares1 !== null) {
      message.shares1 = String(object.shares1);
    } else {
      message.shares1 = '';
    }
    return message;
  },

  toJSON(message: MsgDepositShares): unknown {
    const obj: any = {};
    message.creator !== undefined && (obj.creator = message.creator);
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    message.fee !== undefined && (obj.fee = message.fee);
    message.shares0 !== undefined && (obj.shares0 = message.shares0);
    message.shares1 !== undefined && (obj.shares1 = message.shares1);
    return obj;
  },

  fromPartial(object: DeepPartial<MsgDepositShares>): MsgDepositShares {
    const message = { ...baseMsgDepositShares } as MsgDepositShares;
    if (object.creator !== undefined && object.creator !== null) {
      message.creator = object.creator;
    } else {
      message.creator = '';
    }
    if (object.token0 !== undefined && object.token0 !== null) {
      message.token0 = object.token0;
    } else {
      message.token0 = '';
    }
    if (object.token1 !== undefined && object.token1 !== null) {
      message.token1 = object.token1;
    } else {
      message.token1 = '';
    }
    if (object.price0 !== undefined && object.price0 !== null) {
      message.price0 = object.price0;
    } else {
      message.price0 = '';
    }
    if (object.price1 !== undefined && object.price1 !== null) {
      message.price1 = object.price1;
    } else {
      message.price1 = '';
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = object.fee;
    } else {
      message.fee = '';
    }
    if (object.shares0 !== undefined && object.shares0 !== null) {
      message.shares0 = object.shares0;
    } else {
      message.shares0 = '';
    }
    if (object.shares1 !== undefined && object.shares1 !== null) {
      message.shares1 = object.shares1;
    } else {
      message.shares1 = '';
    }
    return message;
  },
};

const baseMsgDepositSharesResponse: object = {};

export const MsgDepositSharesResponse = {
  encode(
    _: MsgDepositSharesResponse,
    writer: Writer = Writer.create()
  ): Writer {
    return writer;
  },

  decode(
    input: Reader | Uint8Array,
    length?: number
  ): MsgDepositSharesResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...baseMsgDepositSharesResponse,
    } as MsgDepositSharesResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): MsgDepositSharesResponse {
    const message = {
      ...baseMsgDepositSharesResponse,
    } as MsgDepositSharesResponse;
    return message;
  },

  toJSON(_: MsgDepositSharesResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(
    _: DeepPartial<MsgDepositSharesResponse>
  ): MsgDepositSharesResponse {
    const message = {
      ...baseMsgDepositSharesResponse,
    } as MsgDepositSharesResponse;
    return message;
  },
};

const baseMsgWithdrawShares: object = {
  creator: '',
  token0: '',
  token1: '',
  price0: '',
  price1: '',
  fee: '',
  shares0: '',
  shares1: '',
};

export const MsgWithdrawShares = {
  encode(message: MsgWithdrawShares, writer: Writer = Writer.create()): Writer {
    if (message.creator !== '') {
      writer.uint32(10).string(message.creator);
    }
    if (message.token0 !== '') {
      writer.uint32(18).string(message.token0);
    }
    if (message.token1 !== '') {
      writer.uint32(26).string(message.token1);
    }
    if (message.price0 !== '') {
      writer.uint32(34).string(message.price0);
    }
    if (message.price1 !== '') {
      writer.uint32(42).string(message.price1);
    }
    if (message.fee !== '') {
      writer.uint32(50).string(message.fee);
    }
    if (message.shares0 !== '') {
      writer.uint32(58).string(message.shares0);
    }
    if (message.shares1 !== '') {
      writer.uint32(66).string(message.shares1);
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): MsgWithdrawShares {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseMsgWithdrawShares } as MsgWithdrawShares;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.token0 = reader.string();
          break;
        case 3:
          message.token1 = reader.string();
          break;
        case 4:
          message.price0 = reader.string();
          break;
        case 5:
          message.price1 = reader.string();
          break;
        case 6:
          message.fee = reader.string();
          break;
        case 7:
          message.shares0 = reader.string();
          break;
        case 8:
          message.shares1 = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): MsgWithdrawShares {
    const message = { ...baseMsgWithdrawShares } as MsgWithdrawShares;
    if (object.creator !== undefined && object.creator !== null) {
      message.creator = String(object.creator);
    } else {
      message.creator = '';
    }
    if (object.token0 !== undefined && object.token0 !== null) {
      message.token0 = String(object.token0);
    } else {
      message.token0 = '';
    }
    if (object.token1 !== undefined && object.token1 !== null) {
      message.token1 = String(object.token1);
    } else {
      message.token1 = '';
    }
    if (object.price0 !== undefined && object.price0 !== null) {
      message.price0 = String(object.price0);
    } else {
      message.price0 = '';
    }
    if (object.price1 !== undefined && object.price1 !== null) {
      message.price1 = String(object.price1);
    } else {
      message.price1 = '';
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = String(object.fee);
    } else {
      message.fee = '';
    }
    if (object.shares0 !== undefined && object.shares0 !== null) {
      message.shares0 = String(object.shares0);
    } else {
      message.shares0 = '';
    }
    if (object.shares1 !== undefined && object.shares1 !== null) {
      message.shares1 = String(object.shares1);
    } else {
      message.shares1 = '';
    }
    return message;
  },

  toJSON(message: MsgWithdrawShares): unknown {
    const obj: any = {};
    message.creator !== undefined && (obj.creator = message.creator);
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    message.fee !== undefined && (obj.fee = message.fee);
    message.shares0 !== undefined && (obj.shares0 = message.shares0);
    message.shares1 !== undefined && (obj.shares1 = message.shares1);
    return obj;
  },

  fromPartial(object: DeepPartial<MsgWithdrawShares>): MsgWithdrawShares {
    const message = { ...baseMsgWithdrawShares } as MsgWithdrawShares;
    if (object.creator !== undefined && object.creator !== null) {
      message.creator = object.creator;
    } else {
      message.creator = '';
    }
    if (object.token0 !== undefined && object.token0 !== null) {
      message.token0 = object.token0;
    } else {
      message.token0 = '';
    }
    if (object.token1 !== undefined && object.token1 !== null) {
      message.token1 = object.token1;
    } else {
      message.token1 = '';
    }
    if (object.price0 !== undefined && object.price0 !== null) {
      message.price0 = object.price0;
    } else {
      message.price0 = '';
    }
    if (object.price1 !== undefined && object.price1 !== null) {
      message.price1 = object.price1;
    } else {
      message.price1 = '';
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = object.fee;
    } else {
      message.fee = '';
    }
    if (object.shares0 !== undefined && object.shares0 !== null) {
      message.shares0 = object.shares0;
    } else {
      message.shares0 = '';
    }
    if (object.shares1 !== undefined && object.shares1 !== null) {
      message.shares1 = object.shares1;
    } else {
      message.shares1 = '';
    }
    return message;
  },
};

const baseMsgWithdrawSharesResponse: object = {};

export const MsgWithdrawSharesResponse = {
  encode(
    _: MsgWithdrawSharesResponse,
    writer: Writer = Writer.create()
  ): Writer {
    return writer;
  },

  decode(
    input: Reader | Uint8Array,
    length?: number
  ): MsgWithdrawSharesResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...baseMsgWithdrawSharesResponse,
    } as MsgWithdrawSharesResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(_: any): MsgWithdrawSharesResponse {
    const message = {
      ...baseMsgWithdrawSharesResponse,
    } as MsgWithdrawSharesResponse;
    return message;
  },

  toJSON(_: MsgWithdrawSharesResponse): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(
    _: DeepPartial<MsgWithdrawSharesResponse>
  ): MsgWithdrawSharesResponse {
    const message = {
      ...baseMsgWithdrawSharesResponse,
    } as MsgWithdrawSharesResponse;
    return message;
  },
};

/** Msg defines the Msg service. */
export interface Msg {
  DepositShares(request: MsgDepositShares): Promise<MsgDepositSharesResponse>;
  /** this line is used by starport scaffolding # proto/tx/rpc */
  WithdrawShares(
    request: MsgWithdrawShares
  ): Promise<MsgWithdrawSharesResponse>;
}

export class MsgClientImpl implements Msg {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
  }
  DepositShares(request: MsgDepositShares): Promise<MsgDepositSharesResponse> {
    const data = MsgDepositShares.encode(request).finish();
    const promise = this.rpc.request(
      'duality.duality.Msg',
      'DepositShares',
      data
    );
    return promise.then((data) =>
      MsgDepositSharesResponse.decode(new Reader(data))
    );
  }

  WithdrawShares(
    request: MsgWithdrawShares
  ): Promise<MsgWithdrawSharesResponse> {
    const data = MsgWithdrawShares.encode(request).finish();
    const promise = this.rpc.request(
      'duality.duality.Msg',
      'WithdrawShares',
      data
    );
    return promise.then((data) =>
      MsgWithdrawSharesResponse.decode(new Reader(data))
    );
  }
}

interface Rpc {
  request(
    service: string,
    method: string,
    data: Uint8Array
  ): Promise<Uint8Array>;
}

type Builtin = Date | Function | Uint8Array | string | number | undefined;
export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Array<infer U>
  ? Array<DeepPartial<U>>
  : T extends ReadonlyArray<infer U>
  ? ReadonlyArray<DeepPartial<U>>
  : T extends {}
  ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
