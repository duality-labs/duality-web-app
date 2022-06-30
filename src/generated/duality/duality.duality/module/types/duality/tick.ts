/* eslint-disable */
import { Writer, Reader } from "protobufjs/minimal";

export const protobufPackage = "duality.duality";

export interface Tick {
  token0: string;
  token1: string;
  price0: string;
  price1: string;
  fee: string;
  reserves0: string;
  reserves1: string;
}

const baseTick: object = {
  token0: "",
  token1: "",
  price0: "",
  price1: "",
  fee: "",
  reserves0: "",
  reserves1: "",
};

export const Tick = {
  encode(message: Tick, writer: Writer = Writer.create()): Writer {
    if (message.token0 !== "") {
      writer.uint32(10).string(message.token0);
    }
    if (message.token1 !== "") {
      writer.uint32(18).string(message.token1);
    }
    if (message.price0 !== "") {
      writer.uint32(26).string(message.price0);
    }
    if (message.price1 !== "") {
      writer.uint32(34).string(message.price1);
    }
    if (message.fee !== "") {
      writer.uint32(42).string(message.fee);
    }
    if (message.reserves0 !== "") {
      writer.uint32(50).string(message.reserves0);
    }
    if (message.reserves1 !== "") {
      writer.uint32(58).string(message.reserves1);
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): Tick {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseTick } as Tick;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.token0 = reader.string();
          break;
        case 2:
          message.token1 = reader.string();
          break;
        case 3:
          message.price0 = reader.string();
          break;
        case 4:
          message.price1 = reader.string();
          break;
        case 5:
          message.fee = reader.string();
          break;
        case 6:
          message.reserves0 = reader.string();
          break;
        case 7:
          message.reserves1 = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Tick {
    const message = { ...baseTick } as Tick;
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
    if (object.reserves0 !== undefined && object.reserves0 !== null) {
      message.reserves0 = String(object.reserves0);
    } else {
      message.reserves0 = "";
    }
    if (object.reserves1 !== undefined && object.reserves1 !== null) {
      message.reserves1 = String(object.reserves1);
    } else {
      message.reserves1 = "";
    }
    return message;
  },

  toJSON(message: Tick): unknown {
    const obj: any = {};
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    message.fee !== undefined && (obj.fee = message.fee);
    message.reserves0 !== undefined && (obj.reserves0 = message.reserves0);
    message.reserves1 !== undefined && (obj.reserves1 = message.reserves1);
    return obj;
  },

  fromPartial(object: DeepPartial<Tick>): Tick {
    const message = { ...baseTick } as Tick;
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
    if (object.reserves0 !== undefined && object.reserves0 !== null) {
      message.reserves0 = object.reserves0;
    } else {
      message.reserves0 = "";
    }
    if (object.reserves1 !== undefined && object.reserves1 !== null) {
      message.reserves1 = object.reserves1;
    } else {
      message.reserves1 = "";
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
