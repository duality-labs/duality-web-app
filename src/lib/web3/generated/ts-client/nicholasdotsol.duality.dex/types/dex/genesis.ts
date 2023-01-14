/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { FeeTier } from "./fee_tier";
import { LimitOrderTranche } from "./limit_order_tranche";
import { LimitOrderTrancheUser } from "./limit_order_tranche_user";
import { Params } from "./params";
import { Tick } from "./tick";
import { Tokens } from "./tokens";
import { TokenMap } from "./token_map";
import { TradingPair } from "./trading_pair";
export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;
/** GenesisState defines the dex module's genesis state. */
export interface GenesisState {
  params: Params | undefined;
  TickList: Tick[];
  TradingPairList: TradingPair[];
  tokensList: Tokens[];
  tokensCount: number;
  tokenMapList: TokenMap[];
  FeeTierList: FeeTier[];
  FeeTierCount: number;
  LimitOrderTrancheUserList: LimitOrderTrancheUser[];
  /** this line is used by starport scaffolding # genesis/proto/state */
  LimitOrderTrancheList: LimitOrderTranche[];
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseGenesisState(): GenesisState {
  return {

      FeeTierCount: 0,
      FeeTierList: [],
      LimitOrderTrancheList: [],
      LimitOrderTrancheUserList: [],
      params: undefined,
      TickList: [],
      tokenMapList: [],
      tokensCount: 0,
      tokensList: [],
      TradingPairList: []
    };
}

export const GenesisState = {

  decode(input: _m0.Reader | Uint8Array, length?: number): GenesisState {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGenesisState();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.params = Params.decode(reader, reader.uint32());
          break;
        case 2:
          message.TickList.push(Tick.decode(reader, reader.uint32()));
          break;
        case 3:
          message.TradingPairList.push(TradingPair.decode(reader, reader.uint32()));
          break;
        case 4:
          message.tokensList.push(Tokens.decode(reader, reader.uint32()));
          break;
        case 5:
          message.tokensCount = longToNumber(reader.uint64() as Long);
          break;
        case 6:
          message.tokenMapList.push(TokenMap.decode(reader, reader.uint32()));
          break;
        case 8:
          message.FeeTierList.push(FeeTier.decode(reader, reader.uint32()));
          break;
        case 9:
          message.FeeTierCount = longToNumber(reader.uint64() as Long);
          break;
        case 14:
          message.LimitOrderTrancheUserList.push(LimitOrderTrancheUser.decode(reader, reader.uint32()));
          break;
        case 15:
          message.LimitOrderTrancheList.push(LimitOrderTranche.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: GenesisState, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.TickList) {
      Tick.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    for (const v of message.TradingPairList) {
      TradingPair.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    for (const v of message.tokensList) {
      Tokens.encode(v!, writer.uint32(34).fork()).ldelim();
    }
    if (message.tokensCount !== 0) {
      writer.uint32(40).uint64(message.tokensCount);
    }
    for (const v of message.tokenMapList) {
      TokenMap.encode(v!, writer.uint32(50).fork()).ldelim();
    }
    for (const v of message.FeeTierList) {
      FeeTier.encode(v!, writer.uint32(66).fork()).ldelim();
    }
    if (message.FeeTierCount !== 0) {
      writer.uint32(72).uint64(message.FeeTierCount);
    }
    for (const v of message.LimitOrderTrancheUserList) {
      LimitOrderTrancheUser.encode(v!, writer.uint32(114).fork()).ldelim();
    }
    for (const v of message.LimitOrderTrancheList) {
      LimitOrderTranche.encode(v!, writer.uint32(122).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): GenesisState {
    return {

          FeeTierCount: isSet(object.FeeTierCount) ? Number(object.FeeTierCount) : 0,
          FeeTierList: Array.isArray(object?.FeeTierList) ? object.FeeTierList.map((e: any) => FeeTier.fromJSON(e)) : [],
          LimitOrderTrancheList: Array.isArray(object?.LimitOrderTrancheList)
            ? object.LimitOrderTrancheList.map((e: any) => LimitOrderTranche.fromJSON(e))
            : [],
          LimitOrderTrancheUserList: Array.isArray(object?.LimitOrderTrancheUserList)
            ? object.LimitOrderTrancheUserList.map((e: any) => LimitOrderTrancheUser.fromJSON(e))
            : [],
          params: isSet(object.params) ? Params.fromJSON(object.params) : undefined,
          TickList: Array.isArray(object?.TickList) ? object.TickList.map((e: any) => Tick.fromJSON(e)) : [],
          tokenMapList: Array.isArray(object?.tokenMapList)
            ? object.tokenMapList.map((e: any) => TokenMap.fromJSON(e))
            : [],
          tokensCount: isSet(object.tokensCount) ? Number(object.tokensCount) : 0,
          tokensList: Array.isArray(object?.tokensList) ? object.tokensList.map((e: any) => Tokens.fromJSON(e)) : [],
          TradingPairList: Array.isArray(object?.TradingPairList)
            ? object.TradingPairList.map((e: any) => TradingPair.fromJSON(e))
            : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<GenesisState>, I>>(object: I): GenesisState {
    const message = createBaseGenesisState();
    message.params = (object.params !== undefined && object.params !== null)
      ? Params.fromPartial(object.params)
      : undefined;
    message.TickList = object.TickList?.map((e) => Tick.fromPartial(e)) || [];
    message.TradingPairList = object.TradingPairList?.map((e) => TradingPair.fromPartial(e)) || [];
    message.tokensList = object.tokensList?.map((e) => Tokens.fromPartial(e)) || [];
    message.tokensCount = object.tokensCount ?? 0;
    message.tokenMapList = object.tokenMapList?.map((e) => TokenMap.fromPartial(e)) || [];
    message.FeeTierList = object.FeeTierList?.map((e) => FeeTier.fromPartial(e)) || [];
    message.FeeTierCount = object.FeeTierCount ?? 0;
    message.LimitOrderTrancheUserList =
      object.LimitOrderTrancheUserList?.map((e) => LimitOrderTrancheUser.fromPartial(e)) || [];
    message.LimitOrderTrancheList = object.LimitOrderTrancheList?.map((e) => LimitOrderTranche.fromPartial(e)) || [];
    return message;
  },

  toJSON(message: GenesisState): unknown {
    const obj: any = {};
    message.params !== undefined && (obj.params = message.params ? Params.toJSON(message.params) : undefined);
    if (message.TickList) {
      obj.TickList = message.TickList.map((e) => e ? Tick.toJSON(e) : undefined);
    } else {
      obj.TickList = [];
    }
    if (message.TradingPairList) {
      obj.TradingPairList = message.TradingPairList.map((e) => e ? TradingPair.toJSON(e) : undefined);
    } else {
      obj.TradingPairList = [];
    }
    if (message.tokensList) {
      obj.tokensList = message.tokensList.map((e) => e ? Tokens.toJSON(e) : undefined);
    } else {
      obj.tokensList = [];
    }
    message.tokensCount !== undefined && (obj.tokensCount = Math.round(message.tokensCount));
    if (message.tokenMapList) {
      obj.tokenMapList = message.tokenMapList.map((e) => e ? TokenMap.toJSON(e) : undefined);
    } else {
      obj.tokenMapList = [];
    }
    if (message.FeeTierList) {
      obj.FeeTierList = message.FeeTierList.map((e) => e ? FeeTier.toJSON(e) : undefined);
    } else {
      obj.FeeTierList = [];
    }
    message.FeeTierCount !== undefined && (obj.FeeTierCount = Math.round(message.FeeTierCount));
    if (message.LimitOrderTrancheUserList) {
      obj.LimitOrderTrancheUserList = message.LimitOrderTrancheUserList.map((e) =>
        e ? LimitOrderTrancheUser.toJSON(e) : undefined
      );
    } else {
      obj.LimitOrderTrancheUserList = [];
    }
    if (message.LimitOrderTrancheList) {
      obj.LimitOrderTrancheList = message.LimitOrderTrancheList.map((e) => e ? LimitOrderTranche.toJSON(e) : undefined);
    } else {
      obj.LimitOrderTrancheList = [];
    }
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
