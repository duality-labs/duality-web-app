/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export interface TradingPair {
  pairId: string;
  currentTick0To1: number;
  currentTick1To0: number;
  maxTick: number;
  minTick: number;
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseTradingPair(): TradingPair {
  return { currentTick0To1: 0, currentTick1To0: 0, maxTick: 0, minTick: 0, pairId: "" };
}

export const TradingPair = {

  decode(input: _m0.Reader | Uint8Array, length?: number): TradingPair {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTradingPair();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairId = reader.string();
          break;
        case 2:
          message.currentTick0To1 = longToNumber(reader.int64() as Long);
          break;
        case 3:
          message.currentTick1To0 = longToNumber(reader.int64() as Long);
          break;
        case 4:
          message.maxTick = longToNumber(reader.int64() as Long);
          break;
        case 5:
          message.minTick = longToNumber(reader.int64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: TradingPair, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairId !== "") {
      writer.uint32(10).string(message.pairId);
    }
    if (message.currentTick0To1 !== 0) {
      writer.uint32(16).int64(message.currentTick0To1);
    }
    if (message.currentTick1To0 !== 0) {
      writer.uint32(24).int64(message.currentTick1To0);
    }
    if (message.maxTick !== 0) {
      writer.uint32(32).int64(message.maxTick);
    }
    if (message.minTick !== 0) {
      writer.uint32(40).int64(message.minTick);
    }
    return writer;
  },

  fromJSON(object: any): TradingPair {
    return {

          currentTick0To1: isSet(object.currentTick0To1) ? Number(object.currentTick0To1) : 0,
          currentTick1To0: isSet(object.currentTick1To0) ? Number(object.currentTick1To0) : 0,
          maxTick: isSet(object.maxTick) ? Number(object.maxTick) : 0,
          minTick: isSet(object.minTick) ? Number(object.minTick) : 0,
          pairId: isSet(object.pairId) ? String(object.pairId) : ""
        };
  },

  fromPartial<I extends Exact<DeepPartial<TradingPair>, I>>(object: I): TradingPair {
    const message = createBaseTradingPair();
    message.pairId = object.pairId ?? "";
    message.currentTick0To1 = object.currentTick0To1 ?? 0;
    message.currentTick1To0 = object.currentTick1To0 ?? 0;
    message.maxTick = object.maxTick ?? 0;
    message.minTick = object.minTick ?? 0;
    return message;
  },

  toJSON(message: TradingPair): unknown {
    const obj: any = {};
    message.pairId !== undefined && (obj.pairId = message.pairId);
    message.currentTick0To1 !== undefined && (obj.currentTick0To1 = Math.round(message.currentTick0To1));
    message.currentTick1To0 !== undefined && (obj.currentTick1To0 = Math.round(message.currentTick1To0));
    message.maxTick !== undefined && (obj.maxTick = Math.round(message.maxTick));
    message.minTick !== undefined && (obj.minTick = Math.round(message.minTick));
    return obj;
  }
};

declare var self: any | undefined;
declare var window: any | undefined;
declare var global: any | undefined;
var globalThis: any = (() => {
  if (typeof globalThis !== "undefined") {
    return globalThis;
  }
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  if (typeof global !== "undefined") {
    return global;
  }
  throw "Unable to locate global object";
})();
function longToNumber(long: Long): number {
  if (long.gt(Number.MAX_SAFE_INTEGER)) {
    throw new globalThis.Error("Value is larger than Number.MAX_SAFE_INTEGER");
  }
  return long.toNumber();
}

if (_m0.util.Long !== Long) {
  _m0.util.Long = Long as any;
  _m0.configure();
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
