/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { PageRequest, PageResponse } from "../../cosmos/base/query/v1beta1/pagination";
import { DepositRecord } from "./deposit_record";
import { FeeTier } from "./fee_tier";
import { LimitOrderTranche } from "./limit_order_tranche";
import { LimitOrderTrancheUser } from "./limit_order_tranche_user";
import { Params } from "./params";
import { Tick } from "./tick";
import { Tokens } from "./tokens";
import { TokenMap } from "./token_map";
import { TradingPair } from "./trading_pair";
import { UserPositions } from "./user_positions";
export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };
type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;

/** Query defines the gRPC querier service. */
export interface Query {
  /** Parameters queries the parameters of the module. */
  Params(request: QueryParamsRequest): Promise<QueryParamsResponse>;
  /** Queries a Tick by index. */
  Tick(request: QueryGetTickRequest): Promise<QueryGetTickResponse>;
  /** Queries a list of Tick items. */
  TickAll(request: QueryAllTickRequest): Promise<QueryAllTickResponse>;
  /** Queries a TradingPair by index. */
  TradingPair(request: QueryGetTradingPairRequest): Promise<QueryGetTradingPairResponse>;
  /** Queries a list of TradingPair items. */
  TradingPairAll(request: QueryAllTradingPairRequest): Promise<QueryAllTradingPairResponse>;
  /** Queries a Tokens by id. */
  Tokens(request: QueryGetTokensRequest): Promise<QueryGetTokensResponse>;
  /** Queries a list of Tokens items. */
  TokensAll(request: QueryAllTokensRequest): Promise<QueryAllTokensResponse>;
  /** Queries a TokenMap by index. */
  TokenMap(request: QueryGetTokenMapRequest): Promise<QueryGetTokenMapResponse>;
  /** Queries a list of TokenMap items. */
  TokenMapAll(request: QueryAllTokenMapRequest): Promise<QueryAllTokenMapResponse>;
  /** Queries a FeeTier by id. */
  FeeTier(request: QueryGetFeeTierRequest): Promise<QueryGetFeeTierResponse>;
  /** Queries a list of FeeTier items. */
  FeeTierAll(request: QueryAllFeeTierRequest): Promise<QueryAllFeeTierResponse>;
  /** Queries a LimitOrderTrancheUser by index. */
  LimitOrderTrancheUser(request: QueryGetLimitOrderTrancheUserRequest): Promise<QueryGetLimitOrderTrancheUserResponse>;
  /** Queries a list of LimitOrderTrancheMap items. */
  LimitOrderTrancheUserAll(
    request: QueryAllLimitOrderTrancheUserRequest,
  ): Promise<QueryAllLimitOrderTrancheUserResponse>;
  /** Queries a LimitOrderTranche by index. */
  LimitOrderTranche(request: QueryGetLimitOrderTrancheRequest): Promise<QueryGetLimitOrderTrancheResponse>;
  /** Queries a list of LimitOrderTranche items. */
  LimitOrderTrancheAll(request: QueryAllLimitOrderTrancheRequest): Promise<QueryAllLimitOrderTrancheResponse>;
  /** Queries a list of GetUserPositions items. */
  GetUserPositions(request: QueryGetUserPositionsRequest): Promise<QueryGetUserPositionsResponse>;
  /** Queries a list of UserDeposits items. */
  UserDepositsAll(request: QueryAllUserDepositsRequest): Promise<QueryAllUserDepositsResponse>;
  /** Queries a list of UserLimitOrders items. */
  UserLimitOrdersAll(request: QueryAllUserLimitOrdersRequest): Promise<QueryAllUserLimitOrdersResponse>;
}

export interface QueryAllFeeTierRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllFeeTierResponse {
  FeeTier: FeeTier[];
  pagination: PageResponse | undefined;
}

export interface QueryAllLimitOrderTrancheRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllLimitOrderTrancheResponse {
  LimitOrderTranche: LimitOrderTranche[];
  pagination: PageResponse | undefined;
}

export interface QueryAllLimitOrderTrancheUserRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllLimitOrderTrancheUserResponse {
  LimitOrderTrancheUser: LimitOrderTrancheUser[];
  pagination: PageResponse | undefined;
}

export interface QueryAllTickRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllTickResponse {
  Tick: Tick[];
  pagination: PageResponse | undefined;
}

export interface QueryAllTokenMapRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllTokenMapResponse {
  tokenMap: TokenMap[];
  pagination: PageResponse | undefined;
}

export interface QueryAllTokensRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllTokensResponse {
  Tokens: Tokens[];
  pagination: PageResponse | undefined;
}

export interface QueryAllTradingPairRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllTradingPairResponse {
  TradingPair: TradingPair[];
  pagination: PageResponse | undefined;
}

export interface QueryAllUserDepositsRequest {
  address: string;
}

export interface QueryAllUserDepositsResponse {
  Deposits: DepositRecord[];
}

export interface QueryAllUserLimitOrdersRequest {
  address: string;
}

export interface QueryAllUserLimitOrdersResponse {
  limitOrders: LimitOrderTrancheUser[];
}

export interface QueryGetFeeTierRequest {
  id: number;
}

export interface QueryGetFeeTierResponse {
  FeeTier: FeeTier | undefined;
}

export interface QueryGetLimitOrderTrancheRequest {
  pairId: string;
  tickIndex: number;
  token: string;
  trancheIndex: number;
}

export interface QueryGetLimitOrderTrancheResponse {
  LimitOrderTranche: LimitOrderTranche | undefined;
}

export interface QueryGetLimitOrderTrancheUserRequest {
  pairId: string;
  tickIndex: number;
  token: string;
  count: number;
  address: string;
}

export interface QueryGetLimitOrderTrancheUserResponse {
  LimitOrderTrancheUser: LimitOrderTrancheUser | undefined;
}

export interface QueryGetTickRequest {
  tickIndex: number;
  pairId: string;
}

export interface QueryGetTickResponse {
  Tick: Tick | undefined;
}

export interface QueryGetTokenMapRequest {
  address: string;
}

export interface QueryGetTokenMapResponse {
  tokenMap: TokenMap | undefined;
}

export interface QueryGetTokensRequest {
  id: number;
}

export interface QueryGetTokensResponse {
  Tokens: Tokens | undefined;
}

export interface QueryGetTradingPairRequest {
  pairId: string;
}

export interface QueryGetTradingPairResponse {
  TradingPair: TradingPair | undefined;
}

export interface QueryGetUserPositionsRequest {
  address: string;
}

export interface QueryGetUserPositionsResponse {
  UserPositions: UserPositions | undefined;
}

/** QueryParamsRequest is request type for the Query/Params RPC method. */
export interface QueryParamsRequest {
}

/** QueryParamsResponse is response type for the Query/Params RPC method. */
export interface QueryParamsResponse {
  /** params holds all the parameters of this module. */
  params: Params | undefined;
}

interface Rpc {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}

export const protobufPackage = "nicholasdotsol.duality.dex";

function createBaseQueryParamsRequest(): QueryParamsRequest {
  return {};
}

export const QueryParamsRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryParamsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryParamsRequest();
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
  encode(_: QueryParamsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  fromJSON(_: any): QueryParamsRequest {
    return {};
  },

  fromPartial<I extends Exact<DeepPartial<QueryParamsRequest>, I>>(_: I): QueryParamsRequest {
    const message = createBaseQueryParamsRequest();
    return message;
  },

  toJSON(_: QueryParamsRequest): unknown {
    const obj: any = {};
    return obj;
  }
};

function createBaseQueryParamsResponse(): QueryParamsResponse {
  return { params: undefined };
}

export const QueryParamsResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryParamsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryParamsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.params = Params.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryParamsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryParamsResponse {
    return { params: isSet(object.params) ? Params.fromJSON(object.params) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryParamsResponse>, I>>(object: I): QueryParamsResponse {
    const message = createBaseQueryParamsResponse();
    message.params = (object.params !== undefined && object.params !== null)
      ? Params.fromPartial(object.params)
      : undefined;
    return message;
  },

  toJSON(message: QueryParamsResponse): unknown {
    const obj: any = {};
    message.params !== undefined && (obj.params = message.params ? Params.toJSON(message.params) : undefined);
    return obj;
  }
};

function createBaseQueryGetTickRequest(): QueryGetTickRequest {
  return { pairId: "", tickIndex: 0 };
}

export const QueryGetTickRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTickRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTickRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tickIndex = longToNumber(reader.int64() as Long);
          break;
        case 2:
          message.pairId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTickRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.tickIndex !== 0) {
      writer.uint32(8).int64(message.tickIndex);
    }
    if (message.pairId !== "") {
      writer.uint32(18).string(message.pairId);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTickRequest {
    return {

          pairId: isSet(object.pairId) ? String(object.pairId) : "",
          tickIndex: isSet(object.tickIndex) ? Number(object.tickIndex) : 0
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTickRequest>, I>>(object: I): QueryGetTickRequest {
    const message = createBaseQueryGetTickRequest();
    message.tickIndex = object.tickIndex ?? 0;
    message.pairId = object.pairId ?? "";
    return message;
  },

  toJSON(message: QueryGetTickRequest): unknown {
    const obj: any = {};
    message.tickIndex !== undefined && (obj.tickIndex = Math.round(message.tickIndex));
    message.pairId !== undefined && (obj.pairId = message.pairId);
    return obj;
  }
};

function createBaseQueryGetTickResponse(): QueryGetTickResponse {
  return { Tick: undefined };
}

export const QueryGetTickResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTickResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTickResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.Tick = Tick.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTickResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.Tick !== undefined) {
      Tick.encode(message.Tick, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTickResponse {
    return { Tick: isSet(object.Tick) ? Tick.fromJSON(object.Tick) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTickResponse>, I>>(object: I): QueryGetTickResponse {
    const message = createBaseQueryGetTickResponse();
    message.Tick = (object.Tick !== undefined && object.Tick !== null) ? Tick.fromPartial(object.Tick) : undefined;
    return message;
  },

  toJSON(message: QueryGetTickResponse): unknown {
    const obj: any = {};
    message.Tick !== undefined && (obj.Tick = message.Tick ? Tick.toJSON(message.Tick) : undefined);
    return obj;
  }
};

function createBaseQueryAllTickRequest(): QueryAllTickRequest {
  return { pagination: undefined };
}

export const QueryAllTickRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTickRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTickRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTickRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTickRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTickRequest>, I>>(object: I): QueryAllTickRequest {
    const message = createBaseQueryAllTickRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTickRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllTickResponse(): QueryAllTickResponse {
  return { pagination: undefined, Tick: [] };
}

export const QueryAllTickResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTickResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTickResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.Tick.push(Tick.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTickResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.Tick) {
      Tick.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTickResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          Tick: Array.isArray(object?.Tick) ? object.Tick.map((e: any) => Tick.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTickResponse>, I>>(object: I): QueryAllTickResponse {
    const message = createBaseQueryAllTickResponse();
    message.Tick = object.Tick?.map((e) => Tick.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTickResponse): unknown {
    const obj: any = {};
    if (message.Tick) {
      obj.Tick = message.Tick.map((e) => e ? Tick.toJSON(e) : undefined);
    } else {
      obj.Tick = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetTradingPairRequest(): QueryGetTradingPairRequest {
  return { pairId: "" };
}

export const QueryGetTradingPairRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTradingPairRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTradingPairRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTradingPairRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairId !== "") {
      writer.uint32(10).string(message.pairId);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTradingPairRequest {
    return { pairId: isSet(object.pairId) ? String(object.pairId) : "" };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTradingPairRequest>, I>>(object: I): QueryGetTradingPairRequest {
    const message = createBaseQueryGetTradingPairRequest();
    message.pairId = object.pairId ?? "";
    return message;
  },

  toJSON(message: QueryGetTradingPairRequest): unknown {
    const obj: any = {};
    message.pairId !== undefined && (obj.pairId = message.pairId);
    return obj;
  }
};

function createBaseQueryGetTradingPairResponse(): QueryGetTradingPairResponse {
  return { TradingPair: undefined };
}

export const QueryGetTradingPairResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTradingPairResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTradingPairResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.TradingPair = TradingPair.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTradingPairResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.TradingPair !== undefined) {
      TradingPair.encode(message.TradingPair, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTradingPairResponse {
    return { TradingPair: isSet(object.TradingPair) ? TradingPair.fromJSON(object.TradingPair) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTradingPairResponse>, I>>(object: I): QueryGetTradingPairResponse {
    const message = createBaseQueryGetTradingPairResponse();
    message.TradingPair = (object.TradingPair !== undefined && object.TradingPair !== null)
      ? TradingPair.fromPartial(object.TradingPair)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetTradingPairResponse): unknown {
    const obj: any = {};
    message.TradingPair !== undefined
      && (obj.TradingPair = message.TradingPair ? TradingPair.toJSON(message.TradingPair) : undefined);
    return obj;
  }
};

function createBaseQueryAllTradingPairRequest(): QueryAllTradingPairRequest {
  return { pagination: undefined };
}

export const QueryAllTradingPairRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTradingPairRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTradingPairRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTradingPairRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTradingPairRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTradingPairRequest>, I>>(object: I): QueryAllTradingPairRequest {
    const message = createBaseQueryAllTradingPairRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTradingPairRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllTradingPairResponse(): QueryAllTradingPairResponse {
  return { pagination: undefined, TradingPair: [] };
}

export const QueryAllTradingPairResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTradingPairResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTradingPairResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.TradingPair.push(TradingPair.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTradingPairResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.TradingPair) {
      TradingPair.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTradingPairResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          TradingPair: Array.isArray(object?.TradingPair)
            ? object.TradingPair.map((e: any) => TradingPair.fromJSON(e))
            : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTradingPairResponse>, I>>(object: I): QueryAllTradingPairResponse {
    const message = createBaseQueryAllTradingPairResponse();
    message.TradingPair = object.TradingPair?.map((e) => TradingPair.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTradingPairResponse): unknown {
    const obj: any = {};
    if (message.TradingPair) {
      obj.TradingPair = message.TradingPair.map((e) => e ? TradingPair.toJSON(e) : undefined);
    } else {
      obj.TradingPair = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetTokensRequest(): QueryGetTokensRequest {
  return { id: 0 };
}

export const QueryGetTokensRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTokensRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTokensRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTokensRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint64(message.id);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTokensRequest {
    return { id: isSet(object.id) ? Number(object.id) : 0 };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTokensRequest>, I>>(object: I): QueryGetTokensRequest {
    const message = createBaseQueryGetTokensRequest();
    message.id = object.id ?? 0;
    return message;
  },

  toJSON(message: QueryGetTokensRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    return obj;
  }
};

function createBaseQueryGetTokensResponse(): QueryGetTokensResponse {
  return { Tokens: undefined };
}

export const QueryGetTokensResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTokensResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTokensResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.Tokens = Tokens.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTokensResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.Tokens !== undefined) {
      Tokens.encode(message.Tokens, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTokensResponse {
    return { Tokens: isSet(object.Tokens) ? Tokens.fromJSON(object.Tokens) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTokensResponse>, I>>(object: I): QueryGetTokensResponse {
    const message = createBaseQueryGetTokensResponse();
    message.Tokens = (object.Tokens !== undefined && object.Tokens !== null)
      ? Tokens.fromPartial(object.Tokens)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetTokensResponse): unknown {
    const obj: any = {};
    message.Tokens !== undefined && (obj.Tokens = message.Tokens ? Tokens.toJSON(message.Tokens) : undefined);
    return obj;
  }
};

function createBaseQueryAllTokensRequest(): QueryAllTokensRequest {
  return { pagination: undefined };
}

export const QueryAllTokensRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTokensRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTokensRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTokensRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTokensRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTokensRequest>, I>>(object: I): QueryAllTokensRequest {
    const message = createBaseQueryAllTokensRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTokensRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllTokensResponse(): QueryAllTokensResponse {
  return { pagination: undefined, Tokens: [] };
}

export const QueryAllTokensResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTokensResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTokensResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.Tokens.push(Tokens.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTokensResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.Tokens) {
      Tokens.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTokensResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          Tokens: Array.isArray(object?.Tokens) ? object.Tokens.map((e: any) => Tokens.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTokensResponse>, I>>(object: I): QueryAllTokensResponse {
    const message = createBaseQueryAllTokensResponse();
    message.Tokens = object.Tokens?.map((e) => Tokens.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTokensResponse): unknown {
    const obj: any = {};
    if (message.Tokens) {
      obj.Tokens = message.Tokens.map((e) => e ? Tokens.toJSON(e) : undefined);
    } else {
      obj.Tokens = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetTokenMapRequest(): QueryGetTokenMapRequest {
  return { address: "" };
}

export const QueryGetTokenMapRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTokenMapRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTokenMapRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTokenMapRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTokenMapRequest {
    return { address: isSet(object.address) ? String(object.address) : "" };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTokenMapRequest>, I>>(object: I): QueryGetTokenMapRequest {
    const message = createBaseQueryGetTokenMapRequest();
    message.address = object.address ?? "";
    return message;
  },

  toJSON(message: QueryGetTokenMapRequest): unknown {
    const obj: any = {};
    message.address !== undefined && (obj.address = message.address);
    return obj;
  }
};

function createBaseQueryGetTokenMapResponse(): QueryGetTokenMapResponse {
  return { tokenMap: undefined };
}

export const QueryGetTokenMapResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTokenMapResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTokenMapResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tokenMap = TokenMap.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTokenMapResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.tokenMap !== undefined) {
      TokenMap.encode(message.tokenMap, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTokenMapResponse {
    return { tokenMap: isSet(object.tokenMap) ? TokenMap.fromJSON(object.tokenMap) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTokenMapResponse>, I>>(object: I): QueryGetTokenMapResponse {
    const message = createBaseQueryGetTokenMapResponse();
    message.tokenMap = (object.tokenMap !== undefined && object.tokenMap !== null)
      ? TokenMap.fromPartial(object.tokenMap)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetTokenMapResponse): unknown {
    const obj: any = {};
    message.tokenMap !== undefined && (obj.tokenMap = message.tokenMap ? TokenMap.toJSON(message.tokenMap) : undefined);
    return obj;
  }
};

function createBaseQueryAllTokenMapRequest(): QueryAllTokenMapRequest {
  return { pagination: undefined };
}

export const QueryAllTokenMapRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTokenMapRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTokenMapRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTokenMapRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTokenMapRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTokenMapRequest>, I>>(object: I): QueryAllTokenMapRequest {
    const message = createBaseQueryAllTokenMapRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTokenMapRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllTokenMapResponse(): QueryAllTokenMapResponse {
  return { pagination: undefined, tokenMap: [] };
}

export const QueryAllTokenMapResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTokenMapResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTokenMapResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tokenMap.push(TokenMap.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllTokenMapResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.tokenMap) {
      TokenMap.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTokenMapResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          tokenMap: Array.isArray(object?.tokenMap) ? object.tokenMap.map((e: any) => TokenMap.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTokenMapResponse>, I>>(object: I): QueryAllTokenMapResponse {
    const message = createBaseQueryAllTokenMapResponse();
    message.tokenMap = object.tokenMap?.map((e) => TokenMap.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTokenMapResponse): unknown {
    const obj: any = {};
    if (message.tokenMap) {
      obj.tokenMap = message.tokenMap.map((e) => e ? TokenMap.toJSON(e) : undefined);
    } else {
      obj.tokenMap = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetFeeTierRequest(): QueryGetFeeTierRequest {
  return { id: 0 };
}

export const QueryGetFeeTierRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetFeeTierRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetFeeTierRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.id = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetFeeTierRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint64(message.id);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetFeeTierRequest {
    return { id: isSet(object.id) ? Number(object.id) : 0 };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetFeeTierRequest>, I>>(object: I): QueryGetFeeTierRequest {
    const message = createBaseQueryGetFeeTierRequest();
    message.id = object.id ?? 0;
    return message;
  },

  toJSON(message: QueryGetFeeTierRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    return obj;
  }
};

function createBaseQueryGetFeeTierResponse(): QueryGetFeeTierResponse {
  return { FeeTier: undefined };
}

export const QueryGetFeeTierResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetFeeTierResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetFeeTierResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.FeeTier = FeeTier.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetFeeTierResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.FeeTier !== undefined) {
      FeeTier.encode(message.FeeTier, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetFeeTierResponse {
    return { FeeTier: isSet(object.FeeTier) ? FeeTier.fromJSON(object.FeeTier) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetFeeTierResponse>, I>>(object: I): QueryGetFeeTierResponse {
    const message = createBaseQueryGetFeeTierResponse();
    message.FeeTier = (object.FeeTier !== undefined && object.FeeTier !== null)
      ? FeeTier.fromPartial(object.FeeTier)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetFeeTierResponse): unknown {
    const obj: any = {};
    message.FeeTier !== undefined && (obj.FeeTier = message.FeeTier ? FeeTier.toJSON(message.FeeTier) : undefined);
    return obj;
  }
};

function createBaseQueryAllFeeTierRequest(): QueryAllFeeTierRequest {
  return { pagination: undefined };
}

export const QueryAllFeeTierRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllFeeTierRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllFeeTierRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllFeeTierRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllFeeTierRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllFeeTierRequest>, I>>(object: I): QueryAllFeeTierRequest {
    const message = createBaseQueryAllFeeTierRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllFeeTierRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllFeeTierResponse(): QueryAllFeeTierResponse {
  return { FeeTier: [], pagination: undefined };
}

export const QueryAllFeeTierResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllFeeTierResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllFeeTierResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.FeeTier.push(FeeTier.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllFeeTierResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.FeeTier) {
      FeeTier.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllFeeTierResponse {
    return {

          FeeTier: Array.isArray(object?.FeeTier) ? object.FeeTier.map((e: any) => FeeTier.fromJSON(e)) : [],
          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllFeeTierResponse>, I>>(object: I): QueryAllFeeTierResponse {
    const message = createBaseQueryAllFeeTierResponse();
    message.FeeTier = object.FeeTier?.map((e) => FeeTier.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllFeeTierResponse): unknown {
    const obj: any = {};
    if (message.FeeTier) {
      obj.FeeTier = message.FeeTier.map((e) => e ? FeeTier.toJSON(e) : undefined);
    } else {
      obj.FeeTier = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetLimitOrderTrancheUserRequest(): QueryGetLimitOrderTrancheUserRequest {
  return { address: "", count: 0, pairId: "", tickIndex: 0, token: "" };
}

export const QueryGetLimitOrderTrancheUserRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetLimitOrderTrancheUserRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetLimitOrderTrancheUserRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairId = reader.string();
          break;
        case 2:
          message.tickIndex = longToNumber(reader.int64() as Long);
          break;
        case 3:
          message.token = reader.string();
          break;
        case 4:
          message.count = longToNumber(reader.uint64() as Long);
          break;
        case 5:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetLimitOrderTrancheUserRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairId !== "") {
      writer.uint32(10).string(message.pairId);
    }
    if (message.tickIndex !== 0) {
      writer.uint32(16).int64(message.tickIndex);
    }
    if (message.token !== "") {
      writer.uint32(26).string(message.token);
    }
    if (message.count !== 0) {
      writer.uint32(32).uint64(message.count);
    }
    if (message.address !== "") {
      writer.uint32(42).string(message.address);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetLimitOrderTrancheUserRequest {
    return {

          address: isSet(object.address) ? String(object.address) : "",
          count: isSet(object.count) ? Number(object.count) : 0,
          pairId: isSet(object.pairId) ? String(object.pairId) : "",
          tickIndex: isSet(object.tickIndex) ? Number(object.tickIndex) : 0,
          token: isSet(object.token) ? String(object.token) : ""
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetLimitOrderTrancheUserRequest>, I>>(
    object: I,
  ): QueryGetLimitOrderTrancheUserRequest {
    const message = createBaseQueryGetLimitOrderTrancheUserRequest();
    message.pairId = object.pairId ?? "";
    message.tickIndex = object.tickIndex ?? 0;
    message.token = object.token ?? "";
    message.count = object.count ?? 0;
    message.address = object.address ?? "";
    return message;
  },

  toJSON(message: QueryGetLimitOrderTrancheUserRequest): unknown {
    const obj: any = {};
    message.pairId !== undefined && (obj.pairId = message.pairId);
    message.tickIndex !== undefined && (obj.tickIndex = Math.round(message.tickIndex));
    message.token !== undefined && (obj.token = message.token);
    message.count !== undefined && (obj.count = Math.round(message.count));
    message.address !== undefined && (obj.address = message.address);
    return obj;
  }
};

function createBaseQueryGetLimitOrderTrancheUserResponse(): QueryGetLimitOrderTrancheUserResponse {
  return { LimitOrderTrancheUser: undefined };
}

export const QueryGetLimitOrderTrancheUserResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetLimitOrderTrancheUserResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetLimitOrderTrancheUserResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.LimitOrderTrancheUser = LimitOrderTrancheUser.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetLimitOrderTrancheUserResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.LimitOrderTrancheUser !== undefined) {
      LimitOrderTrancheUser.encode(message.LimitOrderTrancheUser, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetLimitOrderTrancheUserResponse {
    return {

          LimitOrderTrancheUser: isSet(object.LimitOrderTrancheUser)
            ? LimitOrderTrancheUser.fromJSON(object.LimitOrderTrancheUser)
            : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetLimitOrderTrancheUserResponse>, I>>(
    object: I,
  ): QueryGetLimitOrderTrancheUserResponse {
    const message = createBaseQueryGetLimitOrderTrancheUserResponse();
    message.LimitOrderTrancheUser =
      (object.LimitOrderTrancheUser !== undefined && object.LimitOrderTrancheUser !== null)
        ? LimitOrderTrancheUser.fromPartial(object.LimitOrderTrancheUser)
        : undefined;
    return message;
  },

  toJSON(message: QueryGetLimitOrderTrancheUserResponse): unknown {
    const obj: any = {};
    message.LimitOrderTrancheUser !== undefined && (obj.LimitOrderTrancheUser = message.LimitOrderTrancheUser
      ? LimitOrderTrancheUser.toJSON(message.LimitOrderTrancheUser)
      : undefined);
    return obj;
  }
};

function createBaseQueryAllLimitOrderTrancheUserRequest(): QueryAllLimitOrderTrancheUserRequest {
  return { pagination: undefined };
}

export const QueryAllLimitOrderTrancheUserRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllLimitOrderTrancheUserRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllLimitOrderTrancheUserRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllLimitOrderTrancheUserRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllLimitOrderTrancheUserRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllLimitOrderTrancheUserRequest>, I>>(
    object: I,
  ): QueryAllLimitOrderTrancheUserRequest {
    const message = createBaseQueryAllLimitOrderTrancheUserRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllLimitOrderTrancheUserRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllLimitOrderTrancheUserResponse(): QueryAllLimitOrderTrancheUserResponse {
  return { LimitOrderTrancheUser: [], pagination: undefined };
}

export const QueryAllLimitOrderTrancheUserResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllLimitOrderTrancheUserResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllLimitOrderTrancheUserResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.LimitOrderTrancheUser.push(LimitOrderTrancheUser.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllLimitOrderTrancheUserResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.LimitOrderTrancheUser) {
      LimitOrderTrancheUser.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllLimitOrderTrancheUserResponse {
    return {

          LimitOrderTrancheUser: Array.isArray(object?.LimitOrderTrancheUser)
            ? object.LimitOrderTrancheUser.map((e: any) => LimitOrderTrancheUser.fromJSON(e))
            : [],
          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllLimitOrderTrancheUserResponse>, I>>(
    object: I,
  ): QueryAllLimitOrderTrancheUserResponse {
    const message = createBaseQueryAllLimitOrderTrancheUserResponse();
    message.LimitOrderTrancheUser = object.LimitOrderTrancheUser?.map((e) => LimitOrderTrancheUser.fromPartial(e))
      || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllLimitOrderTrancheUserResponse): unknown {
    const obj: any = {};
    if (message.LimitOrderTrancheUser) {
      obj.LimitOrderTrancheUser = message.LimitOrderTrancheUser.map((e) =>
        e ? LimitOrderTrancheUser.toJSON(e) : undefined
      );
    } else {
      obj.LimitOrderTrancheUser = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetLimitOrderTrancheRequest(): QueryGetLimitOrderTrancheRequest {
  return { pairId: "", tickIndex: 0, token: "", trancheIndex: 0 };
}

export const QueryGetLimitOrderTrancheRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetLimitOrderTrancheRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetLimitOrderTrancheRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairId = reader.string();
          break;
        case 2:
          message.tickIndex = longToNumber(reader.int64() as Long);
          break;
        case 3:
          message.token = reader.string();
          break;
        case 4:
          message.trancheIndex = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetLimitOrderTrancheRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairId !== "") {
      writer.uint32(10).string(message.pairId);
    }
    if (message.tickIndex !== 0) {
      writer.uint32(16).int64(message.tickIndex);
    }
    if (message.token !== "") {
      writer.uint32(26).string(message.token);
    }
    if (message.trancheIndex !== 0) {
      writer.uint32(32).uint64(message.trancheIndex);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetLimitOrderTrancheRequest {
    return {

          pairId: isSet(object.pairId) ? String(object.pairId) : "",
          tickIndex: isSet(object.tickIndex) ? Number(object.tickIndex) : 0,
          token: isSet(object.token) ? String(object.token) : "",
          trancheIndex: isSet(object.trancheIndex) ? Number(object.trancheIndex) : 0
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetLimitOrderTrancheRequest>, I>>(
    object: I,
  ): QueryGetLimitOrderTrancheRequest {
    const message = createBaseQueryGetLimitOrderTrancheRequest();
    message.pairId = object.pairId ?? "";
    message.tickIndex = object.tickIndex ?? 0;
    message.token = object.token ?? "";
    message.trancheIndex = object.trancheIndex ?? 0;
    return message;
  },

  toJSON(message: QueryGetLimitOrderTrancheRequest): unknown {
    const obj: any = {};
    message.pairId !== undefined && (obj.pairId = message.pairId);
    message.tickIndex !== undefined && (obj.tickIndex = Math.round(message.tickIndex));
    message.token !== undefined && (obj.token = message.token);
    message.trancheIndex !== undefined && (obj.trancheIndex = Math.round(message.trancheIndex));
    return obj;
  }
};

function createBaseQueryGetLimitOrderTrancheResponse(): QueryGetLimitOrderTrancheResponse {
  return { LimitOrderTranche: undefined };
}

export const QueryGetLimitOrderTrancheResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetLimitOrderTrancheResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetLimitOrderTrancheResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.LimitOrderTranche = LimitOrderTranche.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetLimitOrderTrancheResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.LimitOrderTranche !== undefined) {
      LimitOrderTranche.encode(message.LimitOrderTranche, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetLimitOrderTrancheResponse {
    return {

          LimitOrderTranche: isSet(object.LimitOrderTranche)
            ? LimitOrderTranche.fromJSON(object.LimitOrderTranche)
            : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetLimitOrderTrancheResponse>, I>>(
    object: I,
  ): QueryGetLimitOrderTrancheResponse {
    const message = createBaseQueryGetLimitOrderTrancheResponse();
    message.LimitOrderTranche = (object.LimitOrderTranche !== undefined && object.LimitOrderTranche !== null)
      ? LimitOrderTranche.fromPartial(object.LimitOrderTranche)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetLimitOrderTrancheResponse): unknown {
    const obj: any = {};
    message.LimitOrderTranche !== undefined && (obj.LimitOrderTranche = message.LimitOrderTranche
      ? LimitOrderTranche.toJSON(message.LimitOrderTranche)
      : undefined);
    return obj;
  }
};

function createBaseQueryAllLimitOrderTrancheRequest(): QueryAllLimitOrderTrancheRequest {
  return { pagination: undefined };
}

export const QueryAllLimitOrderTrancheRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllLimitOrderTrancheRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllLimitOrderTrancheRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllLimitOrderTrancheRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllLimitOrderTrancheRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllLimitOrderTrancheRequest>, I>>(
    object: I,
  ): QueryAllLimitOrderTrancheRequest {
    const message = createBaseQueryAllLimitOrderTrancheRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllLimitOrderTrancheRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllLimitOrderTrancheResponse(): QueryAllLimitOrderTrancheResponse {
  return { LimitOrderTranche: [], pagination: undefined };
}

export const QueryAllLimitOrderTrancheResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllLimitOrderTrancheResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllLimitOrderTrancheResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.LimitOrderTranche.push(LimitOrderTranche.decode(reader, reader.uint32()));
          break;
        case 2:
          message.pagination = PageResponse.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllLimitOrderTrancheResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.LimitOrderTranche) {
      LimitOrderTranche.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllLimitOrderTrancheResponse {
    return {

          LimitOrderTranche: Array.isArray(object?.LimitOrderTranche)
            ? object.LimitOrderTranche.map((e: any) => LimitOrderTranche.fromJSON(e))
            : [],
          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllLimitOrderTrancheResponse>, I>>(
    object: I,
  ): QueryAllLimitOrderTrancheResponse {
    const message = createBaseQueryAllLimitOrderTrancheResponse();
    message.LimitOrderTranche = object.LimitOrderTranche?.map((e) => LimitOrderTranche.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllLimitOrderTrancheResponse): unknown {
    const obj: any = {};
    if (message.LimitOrderTranche) {
      obj.LimitOrderTranche = message.LimitOrderTranche.map((e) => e ? LimitOrderTranche.toJSON(e) : undefined);
    } else {
      obj.LimitOrderTranche = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetUserPositionsRequest(): QueryGetUserPositionsRequest {
  return { address: "" };
}

export const QueryGetUserPositionsRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetUserPositionsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetUserPositionsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetUserPositionsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetUserPositionsRequest {
    return { address: isSet(object.address) ? String(object.address) : "" };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetUserPositionsRequest>, I>>(object: I): QueryGetUserPositionsRequest {
    const message = createBaseQueryGetUserPositionsRequest();
    message.address = object.address ?? "";
    return message;
  },

  toJSON(message: QueryGetUserPositionsRequest): unknown {
    const obj: any = {};
    message.address !== undefined && (obj.address = message.address);
    return obj;
  }
};

function createBaseQueryGetUserPositionsResponse(): QueryGetUserPositionsResponse {
  return { UserPositions: undefined };
}

export const QueryGetUserPositionsResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetUserPositionsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetUserPositionsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.UserPositions = UserPositions.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetUserPositionsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.UserPositions !== undefined) {
      UserPositions.encode(message.UserPositions, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetUserPositionsResponse {
    return { UserPositions: isSet(object.UserPositions) ? UserPositions.fromJSON(object.UserPositions) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetUserPositionsResponse>, I>>(
    object: I,
  ): QueryGetUserPositionsResponse {
    const message = createBaseQueryGetUserPositionsResponse();
    message.UserPositions = (object.UserPositions !== undefined && object.UserPositions !== null)
      ? UserPositions.fromPartial(object.UserPositions)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetUserPositionsResponse): unknown {
    const obj: any = {};
    message.UserPositions !== undefined
      && (obj.UserPositions = message.UserPositions ? UserPositions.toJSON(message.UserPositions) : undefined);
    return obj;
  }
};

function createBaseQueryAllUserDepositsRequest(): QueryAllUserDepositsRequest {
  return { address: "" };
}

export const QueryAllUserDepositsRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllUserDepositsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllUserDepositsRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllUserDepositsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },

  fromJSON(object: any): QueryAllUserDepositsRequest {
    return { address: isSet(object.address) ? String(object.address) : "" };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllUserDepositsRequest>, I>>(object: I): QueryAllUserDepositsRequest {
    const message = createBaseQueryAllUserDepositsRequest();
    message.address = object.address ?? "";
    return message;
  },

  toJSON(message: QueryAllUserDepositsRequest): unknown {
    const obj: any = {};
    message.address !== undefined && (obj.address = message.address);
    return obj;
  }
};

function createBaseQueryAllUserDepositsResponse(): QueryAllUserDepositsResponse {
  return { Deposits: [] };
}

export const QueryAllUserDepositsResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllUserDepositsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllUserDepositsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.Deposits.push(DepositRecord.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllUserDepositsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.Deposits) {
      DepositRecord.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllUserDepositsResponse {
    return {

          Deposits: Array.isArray(object?.Deposits) ? object.Deposits.map((e: any) => DepositRecord.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllUserDepositsResponse>, I>>(object: I): QueryAllUserDepositsResponse {
    const message = createBaseQueryAllUserDepositsResponse();
    message.Deposits = object.Deposits?.map((e) => DepositRecord.fromPartial(e)) || [];
    return message;
  },

  toJSON(message: QueryAllUserDepositsResponse): unknown {
    const obj: any = {};
    if (message.Deposits) {
      obj.Deposits = message.Deposits.map((e) => e ? DepositRecord.toJSON(e) : undefined);
    } else {
      obj.Deposits = [];
    }
    return obj;
  }
};

function createBaseQueryAllUserLimitOrdersRequest(): QueryAllUserLimitOrdersRequest {
  return { address: "" };
}

export const QueryAllUserLimitOrdersRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllUserLimitOrdersRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllUserLimitOrdersRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllUserLimitOrdersRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    return writer;
  },

  fromJSON(object: any): QueryAllUserLimitOrdersRequest {
    return { address: isSet(object.address) ? String(object.address) : "" };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllUserLimitOrdersRequest>, I>>(
    object: I,
  ): QueryAllUserLimitOrdersRequest {
    const message = createBaseQueryAllUserLimitOrdersRequest();
    message.address = object.address ?? "";
    return message;
  },

  toJSON(message: QueryAllUserLimitOrdersRequest): unknown {
    const obj: any = {};
    message.address !== undefined && (obj.address = message.address);
    return obj;
  }
};

function createBaseQueryAllUserLimitOrdersResponse(): QueryAllUserLimitOrdersResponse {
  return { limitOrders: [] };
}

export const QueryAllUserLimitOrdersResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllUserLimitOrdersResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllUserLimitOrdersResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.limitOrders.push(LimitOrderTrancheUser.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryAllUserLimitOrdersResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.limitOrders) {
      LimitOrderTrancheUser.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllUserLimitOrdersResponse {
    return {

          limitOrders: Array.isArray(object?.limitOrders)
            ? object.limitOrders.map((e: any) => LimitOrderTrancheUser.fromJSON(e))
            : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllUserLimitOrdersResponse>, I>>(
    object: I,
  ): QueryAllUserLimitOrdersResponse {
    const message = createBaseQueryAllUserLimitOrdersResponse();
    message.limitOrders = object.limitOrders?.map((e) => LimitOrderTrancheUser.fromPartial(e)) || [];
    return message;
  },

  toJSON(message: QueryAllUserLimitOrdersResponse): unknown {
    const obj: any = {};
    if (message.limitOrders) {
      obj.limitOrders = message.limitOrders.map((e) => e ? LimitOrderTrancheUser.toJSON(e) : undefined);
    } else {
      obj.limitOrders = [];
    }
    return obj;
  }
};

export class QueryClientImpl implements Query {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.Params = this.Params.bind(this);
    this.Tick = this.Tick.bind(this);
    this.TickAll = this.TickAll.bind(this);
    this.TradingPair = this.TradingPair.bind(this);
    this.TradingPairAll = this.TradingPairAll.bind(this);
    this.Tokens = this.Tokens.bind(this);
    this.TokensAll = this.TokensAll.bind(this);
    this.TokenMap = this.TokenMap.bind(this);
    this.TokenMapAll = this.TokenMapAll.bind(this);
    this.FeeTier = this.FeeTier.bind(this);
    this.FeeTierAll = this.FeeTierAll.bind(this);
    this.LimitOrderTrancheUser = this.LimitOrderTrancheUser.bind(this);
    this.LimitOrderTrancheUserAll = this.LimitOrderTrancheUserAll.bind(this);
    this.LimitOrderTranche = this.LimitOrderTranche.bind(this);
    this.LimitOrderTrancheAll = this.LimitOrderTrancheAll.bind(this);
    this.GetUserPositions = this.GetUserPositions.bind(this);
    this.UserDepositsAll = this.UserDepositsAll.bind(this);
    this.UserLimitOrdersAll = this.UserLimitOrdersAll.bind(this);
  }
  Params(request: QueryParamsRequest): Promise<QueryParamsResponse> {
    const data = QueryParamsRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "Params", data);
    return promise.then((data) => QueryParamsResponse.decode(new _m0.Reader(data)));
  }

  Tick(request: QueryGetTickRequest): Promise<QueryGetTickResponse> {
    const data = QueryGetTickRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "Tick", data);
    return promise.then((data) => QueryGetTickResponse.decode(new _m0.Reader(data)));
  }

  TickAll(request: QueryAllTickRequest): Promise<QueryAllTickResponse> {
    const data = QueryAllTickRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TickAll", data);
    return promise.then((data) => QueryAllTickResponse.decode(new _m0.Reader(data)));
  }

  TradingPair(request: QueryGetTradingPairRequest): Promise<QueryGetTradingPairResponse> {
    const data = QueryGetTradingPairRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TradingPair", data);
    return promise.then((data) => QueryGetTradingPairResponse.decode(new _m0.Reader(data)));
  }

  TradingPairAll(request: QueryAllTradingPairRequest): Promise<QueryAllTradingPairResponse> {
    const data = QueryAllTradingPairRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TradingPairAll", data);
    return promise.then((data) => QueryAllTradingPairResponse.decode(new _m0.Reader(data)));
  }

  Tokens(request: QueryGetTokensRequest): Promise<QueryGetTokensResponse> {
    const data = QueryGetTokensRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "Tokens", data);
    return promise.then((data) => QueryGetTokensResponse.decode(new _m0.Reader(data)));
  }

  TokensAll(request: QueryAllTokensRequest): Promise<QueryAllTokensResponse> {
    const data = QueryAllTokensRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TokensAll", data);
    return promise.then((data) => QueryAllTokensResponse.decode(new _m0.Reader(data)));
  }

  TokenMap(request: QueryGetTokenMapRequest): Promise<QueryGetTokenMapResponse> {
    const data = QueryGetTokenMapRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TokenMap", data);
    return promise.then((data) => QueryGetTokenMapResponse.decode(new _m0.Reader(data)));
  }

  TokenMapAll(request: QueryAllTokenMapRequest): Promise<QueryAllTokenMapResponse> {
    const data = QueryAllTokenMapRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TokenMapAll", data);
    return promise.then((data) => QueryAllTokenMapResponse.decode(new _m0.Reader(data)));
  }

  FeeTier(request: QueryGetFeeTierRequest): Promise<QueryGetFeeTierResponse> {
    const data = QueryGetFeeTierRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "FeeTier", data);
    return promise.then((data) => QueryGetFeeTierResponse.decode(new _m0.Reader(data)));
  }

  FeeTierAll(request: QueryAllFeeTierRequest): Promise<QueryAllFeeTierResponse> {
    const data = QueryAllFeeTierRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "FeeTierAll", data);
    return promise.then((data) => QueryAllFeeTierResponse.decode(new _m0.Reader(data)));
  }

  LimitOrderTrancheUser(request: QueryGetLimitOrderTrancheUserRequest): Promise<QueryGetLimitOrderTrancheUserResponse> {
    const data = QueryGetLimitOrderTrancheUserRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "LimitOrderTrancheUser", data);
    return promise.then((data) => QueryGetLimitOrderTrancheUserResponse.decode(new _m0.Reader(data)));
  }

  LimitOrderTrancheUserAll(
    request: QueryAllLimitOrderTrancheUserRequest,
  ): Promise<QueryAllLimitOrderTrancheUserResponse> {
    const data = QueryAllLimitOrderTrancheUserRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "LimitOrderTrancheUserAll", data);
    return promise.then((data) => QueryAllLimitOrderTrancheUserResponse.decode(new _m0.Reader(data)));
  }

  LimitOrderTranche(request: QueryGetLimitOrderTrancheRequest): Promise<QueryGetLimitOrderTrancheResponse> {
    const data = QueryGetLimitOrderTrancheRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "LimitOrderTranche", data);
    return promise.then((data) => QueryGetLimitOrderTrancheResponse.decode(new _m0.Reader(data)));
  }

  LimitOrderTrancheAll(request: QueryAllLimitOrderTrancheRequest): Promise<QueryAllLimitOrderTrancheResponse> {
    const data = QueryAllLimitOrderTrancheRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "LimitOrderTrancheAll", data);
    return promise.then((data) => QueryAllLimitOrderTrancheResponse.decode(new _m0.Reader(data)));
  }

  GetUserPositions(request: QueryGetUserPositionsRequest): Promise<QueryGetUserPositionsResponse> {
    const data = QueryGetUserPositionsRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "GetUserPositions", data);
    return promise.then((data) => QueryGetUserPositionsResponse.decode(new _m0.Reader(data)));
  }

  UserDepositsAll(request: QueryAllUserDepositsRequest): Promise<QueryAllUserDepositsResponse> {
    const data = QueryAllUserDepositsRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "UserDepositsAll", data);
    return promise.then((data) => QueryAllUserDepositsResponse.decode(new _m0.Reader(data)));
  }

  UserLimitOrdersAll(request: QueryAllUserLimitOrdersRequest): Promise<QueryAllUserLimitOrdersResponse> {
    const data = QueryAllUserLimitOrdersRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "UserLimitOrdersAll", data);
    return promise.then((data) => QueryAllUserLimitOrdersResponse.decode(new _m0.Reader(data)));
  }
}

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
