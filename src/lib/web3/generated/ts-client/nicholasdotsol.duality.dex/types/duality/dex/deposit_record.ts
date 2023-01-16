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
export interface DepositRecord {
  pairId: string;
  sharesOwned: string;
  centerTickIndex: number;
  lowerTickIndex: number;
  upperTickIndex: number;
  feeIndex: number;
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseDepositRecord(): DepositRecord {
  return { centerTickIndex: 0, feeIndex: 0, lowerTickIndex: 0, pairId: "", sharesOwned: "", upperTickIndex: 0 };
}

export const DepositRecord = {

  decode(input: _m0.Reader | Uint8Array, length?: number): DepositRecord {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseDepositRecord();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairId = reader.string();
          break;
        case 2:
          message.sharesOwned = reader.string();
          break;
        case 3:
          message.centerTickIndex = longToNumber(reader.int64() as Long);
          break;
        case 4:
          message.lowerTickIndex = longToNumber(reader.int64() as Long);
          break;
        case 5:
          message.upperTickIndex = longToNumber(reader.int64() as Long);
          break;
        case 6:
          message.feeIndex = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: DepositRecord, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairId !== "") {
      writer.uint32(10).string(message.pairId);
    }
    if (message.sharesOwned !== "") {
      writer.uint32(18).string(message.sharesOwned);
    }
    if (message.centerTickIndex !== 0) {
      writer.uint32(24).int64(message.centerTickIndex);
    }
    if (message.lowerTickIndex !== 0) {
      writer.uint32(32).int64(message.lowerTickIndex);
    }
    if (message.upperTickIndex !== 0) {
      writer.uint32(40).int64(message.upperTickIndex);
    }
    if (message.feeIndex !== 0) {
      writer.uint32(48).uint64(message.feeIndex);
    }
    return writer;
  },

  fromJSON(object: any): DepositRecord {
    return {

          centerTickIndex: isSet(object.centerTickIndex) ? Number(object.centerTickIndex) : 0,
          feeIndex: isSet(object.feeIndex) ? Number(object.feeIndex) : 0,
          lowerTickIndex: isSet(object.lowerTickIndex) ? Number(object.lowerTickIndex) : 0,
          pairId: isSet(object.pairId) ? String(object.pairId) : "",
          sharesOwned: isSet(object.sharesOwned) ? String(object.sharesOwned) : "",
          upperTickIndex: isSet(object.upperTickIndex) ? Number(object.upperTickIndex) : 0
        };
  },

  fromPartial<I extends Exact<DeepPartial<DepositRecord>, I>>(object: I): DepositRecord {
    const message = createBaseDepositRecord();
    message.pairId = object.pairId ?? "";
    message.sharesOwned = object.sharesOwned ?? "";
    message.centerTickIndex = object.centerTickIndex ?? 0;
    message.lowerTickIndex = object.lowerTickIndex ?? 0;
    message.upperTickIndex = object.upperTickIndex ?? 0;
    message.feeIndex = object.feeIndex ?? 0;
    return message;
  },

  toJSON(message: DepositRecord): unknown {
    const obj: any = {};
    message.pairId !== undefined && (obj.pairId = message.pairId);
    message.sharesOwned !== undefined && (obj.sharesOwned = message.sharesOwned);
    message.centerTickIndex !== undefined && (obj.centerTickIndex = Math.round(message.centerTickIndex));
    message.lowerTickIndex !== undefined && (obj.lowerTickIndex = Math.round(message.lowerTickIndex));
    message.upperTickIndex !== undefined && (obj.upperTickIndex = Math.round(message.upperTickIndex));
    message.feeIndex !== undefined && (obj.feeIndex = Math.round(message.feeIndex));
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
