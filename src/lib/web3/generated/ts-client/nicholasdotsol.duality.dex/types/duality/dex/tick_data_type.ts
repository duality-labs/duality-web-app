/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import _m0 from "protobufjs/minimal";
export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export interface TickDataType {
  reserve0: string[];
  reserve1: string[];
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseTickDataType(): TickDataType {
  return { reserve0: [], reserve1: [] };
}

export const TickDataType = {

  decode(input: _m0.Reader | Uint8Array, length?: number): TickDataType {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseTickDataType();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.reserve0.push(reader.string());
          break;
        case 2:
          message.reserve1.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: TickDataType, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.reserve0) {
      writer.uint32(10).string(v!);
    }
    for (const v of message.reserve1) {
      writer.uint32(18).string(v!);
    }
    return writer;
  },

  fromJSON(object: any): TickDataType {
    return {

          reserve0: Array.isArray(object?.reserve0) ? object.reserve0.map((e: any) => String(e)) : [],
          reserve1: Array.isArray(object?.reserve1) ? object.reserve1.map((e: any) => String(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<TickDataType>, I>>(object: I): TickDataType {
    const message = createBaseTickDataType();
    message.reserve0 = object.reserve0?.map((e) => e) || [];
    message.reserve1 = object.reserve1?.map((e) => e) || [];
    return message;
  },

  toJSON(message: TickDataType): unknown {
    const obj: any = {};
    if (message.reserve0) {
      obj.reserve0 = message.reserve0.map((e) => e);
    } else {
      obj.reserve0 = [];
    }
    if (message.reserve1) {
      obj.reserve1 = message.reserve1.map((e) => e);
    } else {
      obj.reserve1 = [];
    }
    return obj;
  }
};