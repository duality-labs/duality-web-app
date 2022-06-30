/* eslint-disable */
import { Writer, Reader } from "protobufjs/minimal";

export const protobufPackage = "duality.duality";

export interface Share {
  owner: string;
  token0: string;
  token1: string;
  price0: string;
  price1: string;
  fee: string;
  shares0: string;
  shares1: string;
}

const baseShare: object = {
  owner: "",
  token0: "",
  token1: "",
  price0: "",
  price1: "",
  fee: "",
  shares0: "",
  shares1: "",
};

export const Share = {
  encode(message: Share, writer: Writer = Writer.create()): Writer {
    if (message.owner !== "") {
      writer.uint32(10).string(message.owner);
    }
    if (message.token0 !== "") {
      writer.uint32(18).string(message.token0);
    }
    if (message.token1 !== "") {
      writer.uint32(26).string(message.token1);
    }
    if (message.price0 !== "") {
      writer.uint32(34).string(message.price0);
    }
    if (message.price1 !== "") {
      writer.uint32(42).string(message.price1);
    }
    if (message.fee !== "") {
      writer.uint32(50).string(message.fee);
    }
    if (message.shares0 !== "") {
      writer.uint32(58).string(message.shares0);
    }
    if (message.shares1 !== "") {
      writer.uint32(66).string(message.shares1);
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): Share {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseShare } as Share;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.owner = reader.string();
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

  fromJSON(object: any): Share {
    const message = { ...baseShare } as Share;
    if (object.owner !== undefined && object.owner !== null) {
      message.owner = String(object.owner);
    } else {
      message.owner = "";
    }
    if (object.token0 !== undefined && object.token0 !== null) {
      message.token0 = String(object.token0);
    } else {
      message.token0 = "";
    }
    if (object.token1 !== undefined && object.token1 !== null) {
      message.token1 = String(object.token1);
    } else {
      message.token1 = "";
    }
    if (object.price0 !== undefined && object.price0 !== null) {
      message.price0 = String(object.price0);
    } else {
      message.price0 = "";
    }
    if (object.price1 !== undefined && object.price1 !== null) {
      message.price1 = String(object.price1);
    } else {
      message.price1 = "";
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = String(object.fee);
    } else {
      message.fee = "";
    }
    if (object.shares0 !== undefined && object.shares0 !== null) {
      message.shares0 = String(object.shares0);
    } else {
      message.shares0 = "";
    }
    if (object.shares1 !== undefined && object.shares1 !== null) {
      message.shares1 = String(object.shares1);
    } else {
      message.shares1 = "";
    }
    return message;
  },

  toJSON(message: Share): unknown {
    const obj: any = {};
    message.owner !== undefined && (obj.owner = message.owner);
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    message.fee !== undefined && (obj.fee = message.fee);
    message.shares0 !== undefined && (obj.shares0 = message.shares0);
    message.shares1 !== undefined && (obj.shares1 = message.shares1);
    return obj;
  },

  fromPartial(object: DeepPartial<Share>): Share {
    const message = { ...baseShare } as Share;
    if (object.owner !== undefined && object.owner !== null) {
      message.owner = object.owner;
    } else {
      message.owner = "";
    }
    if (object.token0 !== undefined && object.token0 !== null) {
      message.token0 = object.token0;
    } else {
      message.token0 = "";
    }
    if (object.token1 !== undefined && object.token1 !== null) {
      message.token1 = object.token1;
    } else {
      message.token1 = "";
    }
    if (object.price0 !== undefined && object.price0 !== null) {
      message.price0 = object.price0;
    } else {
      message.price0 = "";
    }
    if (object.price1 !== undefined && object.price1 !== null) {
      message.price1 = object.price1;
    } else {
      message.price1 = "";
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = object.fee;
    } else {
      message.fee = "";
    }
    if (object.shares0 !== undefined && object.shares0 !== null) {
      message.shares0 = object.shares0;
    } else {
      message.shares0 = "";
    }
    if (object.shares1 !== undefined && object.shares1 !== null) {
      message.shares1 = object.shares1;
    } else {
      message.shares1 = "";
    }
    return message;
  },
};

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
