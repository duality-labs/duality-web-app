/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { EdgeRow } from "./edge_row";
export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export interface AdjanceyMatrix {
  id: number;
  edgeRow: EdgeRow | undefined;
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseAdjanceyMatrix(): AdjanceyMatrix {
  return { edgeRow: undefined, id: 0 };
}

export const AdjanceyMatrix = {

  decode(input: _m0.Reader | Uint8Array, length?: number): AdjanceyMatrix {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseAdjanceyMatrix();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.edgeRow = EdgeRow.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: AdjanceyMatrix, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint64(message.id);
    }
    if (message.edgeRow !== undefined) {
      EdgeRow.encode(message.edgeRow, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): AdjanceyMatrix {
    return {

          edgeRow: isSet(object.edgeRow) ? EdgeRow.fromJSON(object.edgeRow) : undefined,
          id: isSet(object.id) ? Number(object.id) : 0
        };
  },

  fromPartial<I extends Exact<DeepPartial<AdjanceyMatrix>, I>>(object: I): AdjanceyMatrix {
    const message = createBaseAdjanceyMatrix();
    message.id = object.id ?? 0;
    message.edgeRow = (object.edgeRow !== undefined && object.edgeRow !== null)
      ? EdgeRow.fromPartial(object.edgeRow)
      : undefined;
    return message;
  },

  toJSON(message: AdjanceyMatrix): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    message.edgeRow !== undefined && (obj.edgeRow = message.edgeRow ? EdgeRow.toJSON(message.edgeRow) : undefined);
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
