/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import _m0 from "protobufjs/minimal";
import { DepositRecord } from "./deposit_record";
import { LimitOrderTrancheUser } from "./limit_order_tranche_user";
export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;
export interface UserPositions {
  PoolDeposits: DepositRecord[];
  LimitOrders: LimitOrderTrancheUser[];
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseUserPositions(): UserPositions {
  return { LimitOrders: [], PoolDeposits: [] };
}

export const UserPositions = {

  decode(input: _m0.Reader | Uint8Array, length?: number): UserPositions {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUserPositions();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.PoolDeposits.push(DepositRecord.decode(reader, reader.uint32()));
          break;
        case 2:
          message.LimitOrders.push(LimitOrderTrancheUser.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: UserPositions, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.PoolDeposits) {
      DepositRecord.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    for (const v of message.LimitOrders) {
      LimitOrderTrancheUser.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): UserPositions {
    return {

          LimitOrders: Array.isArray(object?.LimitOrders)
            ? object.LimitOrders.map((e: any) => LimitOrderTrancheUser.fromJSON(e))
            : [],
          PoolDeposits: Array.isArray(object?.PoolDeposits)
            ? object.PoolDeposits.map((e: any) => DepositRecord.fromJSON(e))
            : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<UserPositions>, I>>(object: I): UserPositions {
    const message = createBaseUserPositions();
    message.PoolDeposits = object.PoolDeposits?.map((e) => DepositRecord.fromPartial(e)) || [];
    message.LimitOrders = object.LimitOrders?.map((e) => LimitOrderTrancheUser.fromPartial(e)) || [];
    return message;
  },

  toJSON(message: UserPositions): unknown {
    const obj: any = {};
    if (message.PoolDeposits) {
      obj.PoolDeposits = message.PoolDeposits.map((e) => e ? DepositRecord.toJSON(e) : undefined);
    } else {
      obj.PoolDeposits = [];
    }
    if (message.LimitOrders) {
      obj.LimitOrders = message.LimitOrders.map((e) => e ? LimitOrderTrancheUser.toJSON(e) : undefined);
    } else {
      obj.LimitOrders = [];
    }
    return obj;
  }
};