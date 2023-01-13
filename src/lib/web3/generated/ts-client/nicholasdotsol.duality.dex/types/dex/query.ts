/* eslint-disable */
/* tslint:disable */
/* eslint-disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { PageRequest, PageResponse } from "../cosmos/base/query/v1beta1/pagination";
import { AdjanceyMatrix } from "./adjancey_matrix";
import { EdgeRow } from "./edge_row";
import { FeeTier } from "./fee_tier";
import { LimitOrderTranche } from "./limit_order_tranche";
import { LimitOrderTrancheUser } from "./limit_order_tranche_user";
import { PairMap } from "./pair_map";
import { Params } from "./params";
import { Shares } from "./shares";
import { TickMap } from "./tick_map";
import { Tokens } from "./tokens";
import { TokenMap } from "./token_map";
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
  /** Queries a TickMap by index. */
  TickMap(request: QueryGetTickMapRequest): Promise<QueryGetTickMapResponse>;
  /** Queries a list of TickMap items. */
  TickMapAll(request: QueryAllTickMapRequest): Promise<QueryAllTickMapResponse>;
  /** Queries a PairMap by index. */
  PairMap(request: QueryGetPairMapRequest): Promise<QueryGetPairMapResponse>;
  /** Queries a list of PairMap items. */
  PairMapAll(request: QueryAllPairMapRequest): Promise<QueryAllPairMapResponse>;
  /** Queries a Tokens by id. */
  Tokens(request: QueryGetTokensRequest): Promise<QueryGetTokensResponse>;
  /** Queries a list of Tokens items. */
  TokensAll(request: QueryAllTokensRequest): Promise<QueryAllTokensResponse>;
  /** Queries a TokenMap by index. */
  TokenMap(request: QueryGetTokenMapRequest): Promise<QueryGetTokenMapResponse>;
  /** Queries a list of TokenMap items. */
  TokenMapAll(request: QueryAllTokenMapRequest): Promise<QueryAllTokenMapResponse>;
  /** Queries a Shares by index. */
  Shares(request: QueryGetSharesRequest): Promise<QueryGetSharesResponse>;
  /** Queries a list of Shares items. */
  SharesAll(request: QueryAllSharesRequest): Promise<QueryAllSharesResponse>;
  /** Queries a FeeTier by id. */
  FeeTier(request: QueryGetFeeTierRequest): Promise<QueryGetFeeTierResponse>;
  /** Queries a list of FeeTier items. */
  FeeTierAll(request: QueryAllFeeTierRequest): Promise<QueryAllFeeTierResponse>;
  /** Queries a EdgeRow by id. */
  EdgeRow(request: QueryGetEdgeRowRequest): Promise<QueryGetEdgeRowResponse>;
  /** Queries a list of EdgeRow items. */
  EdgeRowAll(request: QueryAllEdgeRowRequest): Promise<QueryAllEdgeRowResponse>;
  /** Queries a AdjanceyMatrix by id. */
  AdjanceyMatrix(request: QueryGetAdjanceyMatrixRequest): Promise<QueryGetAdjanceyMatrixResponse>;
  /** Queries a list of AdjanceyMatrix items. */
  AdjanceyMatrixAll(request: QueryAllAdjanceyMatrixRequest): Promise<QueryAllAdjanceyMatrixResponse>;
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
}

export interface QueryAllAdjanceyMatrixRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllAdjanceyMatrixResponse {
  AdjanceyMatrix: AdjanceyMatrix[];
  pagination: PageResponse | undefined;
}

export interface QueryAllEdgeRowRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllEdgeRowResponse {
  EdgeRow: EdgeRow[];
  pagination: PageResponse | undefined;
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

export interface QueryAllPairMapRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllPairMapResponse {
  pairMap: PairMap[];
  pagination: PageResponse | undefined;
}

export interface QueryAllSharesRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllSharesResponse {
  shares: Shares[];
  pagination: PageResponse | undefined;
}

export interface QueryAllTickMapRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllTickMapResponse {
  tickMap: TickMap[];
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

export interface QueryGetAdjanceyMatrixRequest {
  id: number;
}

export interface QueryGetAdjanceyMatrixResponse {
  AdjanceyMatrix: AdjanceyMatrix | undefined;
}

export interface QueryGetEdgeRowRequest {
  id: number;
}

export interface QueryGetEdgeRowResponse {
  EdgeRow: EdgeRow | undefined;
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

export interface QueryGetPairMapRequest {
  pairId: string;
}

export interface QueryGetPairMapResponse {
  pairMap: PairMap | undefined;
}

export interface QueryGetSharesRequest {
  address: string;
  pairId: string;
  tickIndex: number;
  fee: number;
}

export interface QueryGetSharesResponse {
  shares: Shares | undefined;
}

export interface QueryGetTickMapRequest {
  tickIndex: number;
  pairId: string;
}

export interface QueryGetTickMapResponse {
  tickMap: TickMap | undefined;
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

function createBaseQueryGetTickMapRequest(): QueryGetTickMapRequest {
  return { pairId: "", tickIndex: 0 };
}

export const QueryGetTickMapRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTickMapRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTickMapRequest();
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
  encode(message: QueryGetTickMapRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.tickIndex !== 0) {
      writer.uint32(8).int64(message.tickIndex);
    }
    if (message.pairId !== "") {
      writer.uint32(18).string(message.pairId);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTickMapRequest {
    return {

          pairId: isSet(object.pairId) ? String(object.pairId) : "",
          tickIndex: isSet(object.tickIndex) ? Number(object.tickIndex) : 0
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTickMapRequest>, I>>(object: I): QueryGetTickMapRequest {
    const message = createBaseQueryGetTickMapRequest();
    message.tickIndex = object.tickIndex ?? 0;
    message.pairId = object.pairId ?? "";
    return message;
  },

  toJSON(message: QueryGetTickMapRequest): unknown {
    const obj: any = {};
    message.tickIndex !== undefined && (obj.tickIndex = Math.round(message.tickIndex));
    message.pairId !== undefined && (obj.pairId = message.pairId);
    return obj;
  }
};

function createBaseQueryGetTickMapResponse(): QueryGetTickMapResponse {
  return { tickMap: undefined };
}

export const QueryGetTickMapResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetTickMapResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetTickMapResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tickMap = TickMap.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetTickMapResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.tickMap !== undefined) {
      TickMap.encode(message.tickMap, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetTickMapResponse {
    return { tickMap: isSet(object.tickMap) ? TickMap.fromJSON(object.tickMap) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetTickMapResponse>, I>>(object: I): QueryGetTickMapResponse {
    const message = createBaseQueryGetTickMapResponse();
    message.tickMap = (object.tickMap !== undefined && object.tickMap !== null)
      ? TickMap.fromPartial(object.tickMap)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetTickMapResponse): unknown {
    const obj: any = {};
    message.tickMap !== undefined && (obj.tickMap = message.tickMap ? TickMap.toJSON(message.tickMap) : undefined);
    return obj;
  }
};

function createBaseQueryAllTickMapRequest(): QueryAllTickMapRequest {
  return { pagination: undefined };
}

export const QueryAllTickMapRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTickMapRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTickMapRequest();
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
  encode(message: QueryAllTickMapRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTickMapRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTickMapRequest>, I>>(object: I): QueryAllTickMapRequest {
    const message = createBaseQueryAllTickMapRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTickMapRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllTickMapResponse(): QueryAllTickMapResponse {
  return { pagination: undefined, tickMap: [] };
}

export const QueryAllTickMapResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllTickMapResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllTickMapResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tickMap.push(TickMap.decode(reader, reader.uint32()));
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
  encode(message: QueryAllTickMapResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.tickMap) {
      TickMap.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllTickMapResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          tickMap: Array.isArray(object?.tickMap) ? object.tickMap.map((e: any) => TickMap.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllTickMapResponse>, I>>(object: I): QueryAllTickMapResponse {
    const message = createBaseQueryAllTickMapResponse();
    message.tickMap = object.tickMap?.map((e) => TickMap.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllTickMapResponse): unknown {
    const obj: any = {};
    if (message.tickMap) {
      obj.tickMap = message.tickMap.map((e) => e ? TickMap.toJSON(e) : undefined);
    } else {
      obj.tickMap = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetPairMapRequest(): QueryGetPairMapRequest {
  return { pairId: "" };
}

export const QueryGetPairMapRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetPairMapRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetPairMapRequest();
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
  encode(message: QueryGetPairMapRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairId !== "") {
      writer.uint32(10).string(message.pairId);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetPairMapRequest {
    return { pairId: isSet(object.pairId) ? String(object.pairId) : "" };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetPairMapRequest>, I>>(object: I): QueryGetPairMapRequest {
    const message = createBaseQueryGetPairMapRequest();
    message.pairId = object.pairId ?? "";
    return message;
  },

  toJSON(message: QueryGetPairMapRequest): unknown {
    const obj: any = {};
    message.pairId !== undefined && (obj.pairId = message.pairId);
    return obj;
  }
};

function createBaseQueryGetPairMapResponse(): QueryGetPairMapResponse {
  return { pairMap: undefined };
}

export const QueryGetPairMapResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetPairMapResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetPairMapResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairMap = PairMap.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetPairMapResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pairMap !== undefined) {
      PairMap.encode(message.pairMap, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetPairMapResponse {
    return { pairMap: isSet(object.pairMap) ? PairMap.fromJSON(object.pairMap) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetPairMapResponse>, I>>(object: I): QueryGetPairMapResponse {
    const message = createBaseQueryGetPairMapResponse();
    message.pairMap = (object.pairMap !== undefined && object.pairMap !== null)
      ? PairMap.fromPartial(object.pairMap)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetPairMapResponse): unknown {
    const obj: any = {};
    message.pairMap !== undefined && (obj.pairMap = message.pairMap ? PairMap.toJSON(message.pairMap) : undefined);
    return obj;
  }
};

function createBaseQueryAllPairMapRequest(): QueryAllPairMapRequest {
  return { pagination: undefined };
}

export const QueryAllPairMapRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllPairMapRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllPairMapRequest();
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
  encode(message: QueryAllPairMapRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllPairMapRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllPairMapRequest>, I>>(object: I): QueryAllPairMapRequest {
    const message = createBaseQueryAllPairMapRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllPairMapRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllPairMapResponse(): QueryAllPairMapResponse {
  return { pagination: undefined, pairMap: [] };
}

export const QueryAllPairMapResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllPairMapResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllPairMapResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pairMap.push(PairMap.decode(reader, reader.uint32()));
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
  encode(message: QueryAllPairMapResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.pairMap) {
      PairMap.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllPairMapResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          pairMap: Array.isArray(object?.pairMap) ? object.pairMap.map((e: any) => PairMap.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllPairMapResponse>, I>>(object: I): QueryAllPairMapResponse {
    const message = createBaseQueryAllPairMapResponse();
    message.pairMap = object.pairMap?.map((e) => PairMap.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllPairMapResponse): unknown {
    const obj: any = {};
    if (message.pairMap) {
      obj.pairMap = message.pairMap.map((e) => e ? PairMap.toJSON(e) : undefined);
    } else {
      obj.pairMap = [];
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

function createBaseQueryGetSharesRequest(): QueryGetSharesRequest {
  return { address: "", fee: 0, pairId: "", tickIndex: 0 };
}

export const QueryGetSharesRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetSharesRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetSharesRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.address = reader.string();
          break;
        case 2:
          message.pairId = reader.string();
          break;
        case 3:
          message.tickIndex = longToNumber(reader.int64() as Long);
          break;
        case 4:
          message.fee = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetSharesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.address !== "") {
      writer.uint32(10).string(message.address);
    }
    if (message.pairId !== "") {
      writer.uint32(18).string(message.pairId);
    }
    if (message.tickIndex !== 0) {
      writer.uint32(24).int64(message.tickIndex);
    }
    if (message.fee !== 0) {
      writer.uint32(32).uint64(message.fee);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetSharesRequest {
    return {

          address: isSet(object.address) ? String(object.address) : "",
          fee: isSet(object.fee) ? Number(object.fee) : 0,
          pairId: isSet(object.pairId) ? String(object.pairId) : "",
          tickIndex: isSet(object.tickIndex) ? Number(object.tickIndex) : 0
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetSharesRequest>, I>>(object: I): QueryGetSharesRequest {
    const message = createBaseQueryGetSharesRequest();
    message.address = object.address ?? "";
    message.pairId = object.pairId ?? "";
    message.tickIndex = object.tickIndex ?? 0;
    message.fee = object.fee ?? 0;
    return message;
  },

  toJSON(message: QueryGetSharesRequest): unknown {
    const obj: any = {};
    message.address !== undefined && (obj.address = message.address);
    message.pairId !== undefined && (obj.pairId = message.pairId);
    message.tickIndex !== undefined && (obj.tickIndex = Math.round(message.tickIndex));
    message.fee !== undefined && (obj.fee = Math.round(message.fee));
    return obj;
  }
};

function createBaseQueryGetSharesResponse(): QueryGetSharesResponse {
  return { shares: undefined };
}

export const QueryGetSharesResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetSharesResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetSharesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.shares = Shares.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetSharesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.shares !== undefined) {
      Shares.encode(message.shares, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetSharesResponse {
    return { shares: isSet(object.shares) ? Shares.fromJSON(object.shares) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetSharesResponse>, I>>(object: I): QueryGetSharesResponse {
    const message = createBaseQueryGetSharesResponse();
    message.shares = (object.shares !== undefined && object.shares !== null)
      ? Shares.fromPartial(object.shares)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetSharesResponse): unknown {
    const obj: any = {};
    message.shares !== undefined && (obj.shares = message.shares ? Shares.toJSON(message.shares) : undefined);
    return obj;
  }
};

function createBaseQueryAllSharesRequest(): QueryAllSharesRequest {
  return { pagination: undefined };
}

export const QueryAllSharesRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllSharesRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllSharesRequest();
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
  encode(message: QueryAllSharesRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllSharesRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllSharesRequest>, I>>(object: I): QueryAllSharesRequest {
    const message = createBaseQueryAllSharesRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllSharesRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllSharesResponse(): QueryAllSharesResponse {
  return { pagination: undefined, shares: [] };
}

export const QueryAllSharesResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllSharesResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllSharesResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.shares.push(Shares.decode(reader, reader.uint32()));
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
  encode(message: QueryAllSharesResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.shares) {
      Shares.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllSharesResponse {
    return {

          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined,
          shares: Array.isArray(object?.shares) ? object.shares.map((e: any) => Shares.fromJSON(e)) : []
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllSharesResponse>, I>>(object: I): QueryAllSharesResponse {
    const message = createBaseQueryAllSharesResponse();
    message.shares = object.shares?.map((e) => Shares.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllSharesResponse): unknown {
    const obj: any = {};
    if (message.shares) {
      obj.shares = message.shares.map((e) => e ? Shares.toJSON(e) : undefined);
    } else {
      obj.shares = [];
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

function createBaseQueryGetEdgeRowRequest(): QueryGetEdgeRowRequest {
  return { id: 0 };
}

export const QueryGetEdgeRowRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetEdgeRowRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetEdgeRowRequest();
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
  encode(message: QueryGetEdgeRowRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint64(message.id);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetEdgeRowRequest {
    return { id: isSet(object.id) ? Number(object.id) : 0 };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetEdgeRowRequest>, I>>(object: I): QueryGetEdgeRowRequest {
    const message = createBaseQueryGetEdgeRowRequest();
    message.id = object.id ?? 0;
    return message;
  },

  toJSON(message: QueryGetEdgeRowRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    return obj;
  }
};

function createBaseQueryGetEdgeRowResponse(): QueryGetEdgeRowResponse {
  return { EdgeRow: undefined };
}

export const QueryGetEdgeRowResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetEdgeRowResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetEdgeRowResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.EdgeRow = EdgeRow.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetEdgeRowResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.EdgeRow !== undefined) {
      EdgeRow.encode(message.EdgeRow, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetEdgeRowResponse {
    return { EdgeRow: isSet(object.EdgeRow) ? EdgeRow.fromJSON(object.EdgeRow) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetEdgeRowResponse>, I>>(object: I): QueryGetEdgeRowResponse {
    const message = createBaseQueryGetEdgeRowResponse();
    message.EdgeRow = (object.EdgeRow !== undefined && object.EdgeRow !== null)
      ? EdgeRow.fromPartial(object.EdgeRow)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetEdgeRowResponse): unknown {
    const obj: any = {};
    message.EdgeRow !== undefined && (obj.EdgeRow = message.EdgeRow ? EdgeRow.toJSON(message.EdgeRow) : undefined);
    return obj;
  }
};

function createBaseQueryAllEdgeRowRequest(): QueryAllEdgeRowRequest {
  return { pagination: undefined };
}

export const QueryAllEdgeRowRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllEdgeRowRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllEdgeRowRequest();
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
  encode(message: QueryAllEdgeRowRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllEdgeRowRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllEdgeRowRequest>, I>>(object: I): QueryAllEdgeRowRequest {
    const message = createBaseQueryAllEdgeRowRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllEdgeRowRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllEdgeRowResponse(): QueryAllEdgeRowResponse {
  return { EdgeRow: [], pagination: undefined };
}

export const QueryAllEdgeRowResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllEdgeRowResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllEdgeRowResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.EdgeRow.push(EdgeRow.decode(reader, reader.uint32()));
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
  encode(message: QueryAllEdgeRowResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.EdgeRow) {
      EdgeRow.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllEdgeRowResponse {
    return {

          EdgeRow: Array.isArray(object?.EdgeRow) ? object.EdgeRow.map((e: any) => EdgeRow.fromJSON(e)) : [],
          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllEdgeRowResponse>, I>>(object: I): QueryAllEdgeRowResponse {
    const message = createBaseQueryAllEdgeRowResponse();
    message.EdgeRow = object.EdgeRow?.map((e) => EdgeRow.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllEdgeRowResponse): unknown {
    const obj: any = {};
    if (message.EdgeRow) {
      obj.EdgeRow = message.EdgeRow.map((e) => e ? EdgeRow.toJSON(e) : undefined);
    } else {
      obj.EdgeRow = [];
    }
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageResponse.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryGetAdjanceyMatrixRequest(): QueryGetAdjanceyMatrixRequest {
  return { id: 0 };
}

export const QueryGetAdjanceyMatrixRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetAdjanceyMatrixRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetAdjanceyMatrixRequest();
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
  encode(message: QueryGetAdjanceyMatrixRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.id !== 0) {
      writer.uint32(8).uint64(message.id);
    }
    return writer;
  },

  fromJSON(object: any): QueryGetAdjanceyMatrixRequest {
    return { id: isSet(object.id) ? Number(object.id) : 0 };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetAdjanceyMatrixRequest>, I>>(
    object: I,
  ): QueryGetAdjanceyMatrixRequest {
    const message = createBaseQueryGetAdjanceyMatrixRequest();
    message.id = object.id ?? 0;
    return message;
  },

  toJSON(message: QueryGetAdjanceyMatrixRequest): unknown {
    const obj: any = {};
    message.id !== undefined && (obj.id = Math.round(message.id));
    return obj;
  }
};

function createBaseQueryGetAdjanceyMatrixResponse(): QueryGetAdjanceyMatrixResponse {
  return { AdjanceyMatrix: undefined };
}

export const QueryGetAdjanceyMatrixResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryGetAdjanceyMatrixResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryGetAdjanceyMatrixResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.AdjanceyMatrix = AdjanceyMatrix.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: QueryGetAdjanceyMatrixResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.AdjanceyMatrix !== undefined) {
      AdjanceyMatrix.encode(message.AdjanceyMatrix, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryGetAdjanceyMatrixResponse {
    return {

          AdjanceyMatrix: isSet(object.AdjanceyMatrix) ? AdjanceyMatrix.fromJSON(object.AdjanceyMatrix) : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryGetAdjanceyMatrixResponse>, I>>(
    object: I,
  ): QueryGetAdjanceyMatrixResponse {
    const message = createBaseQueryGetAdjanceyMatrixResponse();
    message.AdjanceyMatrix = (object.AdjanceyMatrix !== undefined && object.AdjanceyMatrix !== null)
      ? AdjanceyMatrix.fromPartial(object.AdjanceyMatrix)
      : undefined;
    return message;
  },

  toJSON(message: QueryGetAdjanceyMatrixResponse): unknown {
    const obj: any = {};
    message.AdjanceyMatrix !== undefined
      && (obj.AdjanceyMatrix = message.AdjanceyMatrix ? AdjanceyMatrix.toJSON(message.AdjanceyMatrix) : undefined);
    return obj;
  }
};

function createBaseQueryAllAdjanceyMatrixRequest(): QueryAllAdjanceyMatrixRequest {
  return { pagination: undefined };
}

export const QueryAllAdjanceyMatrixRequest = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllAdjanceyMatrixRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllAdjanceyMatrixRequest();
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
  encode(message: QueryAllAdjanceyMatrixRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllAdjanceyMatrixRequest {
    return { pagination: isSet(object.pagination) ? PageRequest.fromJSON(object.pagination) : undefined };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllAdjanceyMatrixRequest>, I>>(
    object: I,
  ): QueryAllAdjanceyMatrixRequest {
    const message = createBaseQueryAllAdjanceyMatrixRequest();
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageRequest.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllAdjanceyMatrixRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined
      && (obj.pagination = message.pagination ? PageRequest.toJSON(message.pagination) : undefined);
    return obj;
  }
};

function createBaseQueryAllAdjanceyMatrixResponse(): QueryAllAdjanceyMatrixResponse {
  return { AdjanceyMatrix: [], pagination: undefined };
}

export const QueryAllAdjanceyMatrixResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryAllAdjanceyMatrixResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryAllAdjanceyMatrixResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.AdjanceyMatrix.push(AdjanceyMatrix.decode(reader, reader.uint32()));
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
  encode(message: QueryAllAdjanceyMatrixResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.AdjanceyMatrix) {
      AdjanceyMatrix.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(message.pagination, writer.uint32(18).fork()).ldelim();
    }
    return writer;
  },

  fromJSON(object: any): QueryAllAdjanceyMatrixResponse {
    return {

          AdjanceyMatrix: Array.isArray(object?.AdjanceyMatrix)
            ? object.AdjanceyMatrix.map((e: any) => AdjanceyMatrix.fromJSON(e))
            : [],
          pagination: isSet(object.pagination) ? PageResponse.fromJSON(object.pagination) : undefined
        };
  },

  fromPartial<I extends Exact<DeepPartial<QueryAllAdjanceyMatrixResponse>, I>>(
    object: I,
  ): QueryAllAdjanceyMatrixResponse {
    const message = createBaseQueryAllAdjanceyMatrixResponse();
    message.AdjanceyMatrix = object.AdjanceyMatrix?.map((e) => AdjanceyMatrix.fromPartial(e)) || [];
    message.pagination = (object.pagination !== undefined && object.pagination !== null)
      ? PageResponse.fromPartial(object.pagination)
      : undefined;
    return message;
  },

  toJSON(message: QueryAllAdjanceyMatrixResponse): unknown {
    const obj: any = {};
    if (message.AdjanceyMatrix) {
      obj.AdjanceyMatrix = message.AdjanceyMatrix.map((e) => e ? AdjanceyMatrix.toJSON(e) : undefined);
    } else {
      obj.AdjanceyMatrix = [];
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

export class QueryClientImpl implements Query {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.Params = this.Params.bind(this);
    this.TickMap = this.TickMap.bind(this);
    this.TickMapAll = this.TickMapAll.bind(this);
    this.PairMap = this.PairMap.bind(this);
    this.PairMapAll = this.PairMapAll.bind(this);
    this.Tokens = this.Tokens.bind(this);
    this.TokensAll = this.TokensAll.bind(this);
    this.TokenMap = this.TokenMap.bind(this);
    this.TokenMapAll = this.TokenMapAll.bind(this);
    this.Shares = this.Shares.bind(this);
    this.SharesAll = this.SharesAll.bind(this);
    this.FeeTier = this.FeeTier.bind(this);
    this.FeeTierAll = this.FeeTierAll.bind(this);
    this.EdgeRow = this.EdgeRow.bind(this);
    this.EdgeRowAll = this.EdgeRowAll.bind(this);
    this.AdjanceyMatrix = this.AdjanceyMatrix.bind(this);
    this.AdjanceyMatrixAll = this.AdjanceyMatrixAll.bind(this);
    this.LimitOrderTrancheUser = this.LimitOrderTrancheUser.bind(this);
    this.LimitOrderTrancheUserAll = this.LimitOrderTrancheUserAll.bind(this);
    this.LimitOrderTranche = this.LimitOrderTranche.bind(this);
    this.LimitOrderTrancheAll = this.LimitOrderTrancheAll.bind(this);
  }
  Params(request: QueryParamsRequest): Promise<QueryParamsResponse> {
    const data = QueryParamsRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "Params", data);
    return promise.then((data) => QueryParamsResponse.decode(new _m0.Reader(data)));
  }

  TickMap(request: QueryGetTickMapRequest): Promise<QueryGetTickMapResponse> {
    const data = QueryGetTickMapRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TickMap", data);
    return promise.then((data) => QueryGetTickMapResponse.decode(new _m0.Reader(data)));
  }

  TickMapAll(request: QueryAllTickMapRequest): Promise<QueryAllTickMapResponse> {
    const data = QueryAllTickMapRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "TickMapAll", data);
    return promise.then((data) => QueryAllTickMapResponse.decode(new _m0.Reader(data)));
  }

  PairMap(request: QueryGetPairMapRequest): Promise<QueryGetPairMapResponse> {
    const data = QueryGetPairMapRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "PairMap", data);
    return promise.then((data) => QueryGetPairMapResponse.decode(new _m0.Reader(data)));
  }

  PairMapAll(request: QueryAllPairMapRequest): Promise<QueryAllPairMapResponse> {
    const data = QueryAllPairMapRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "PairMapAll", data);
    return promise.then((data) => QueryAllPairMapResponse.decode(new _m0.Reader(data)));
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

  Shares(request: QueryGetSharesRequest): Promise<QueryGetSharesResponse> {
    const data = QueryGetSharesRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "Shares", data);
    return promise.then((data) => QueryGetSharesResponse.decode(new _m0.Reader(data)));
  }

  SharesAll(request: QueryAllSharesRequest): Promise<QueryAllSharesResponse> {
    const data = QueryAllSharesRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "SharesAll", data);
    return promise.then((data) => QueryAllSharesResponse.decode(new _m0.Reader(data)));
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

  EdgeRow(request: QueryGetEdgeRowRequest): Promise<QueryGetEdgeRowResponse> {
    const data = QueryGetEdgeRowRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "EdgeRow", data);
    return promise.then((data) => QueryGetEdgeRowResponse.decode(new _m0.Reader(data)));
  }

  EdgeRowAll(request: QueryAllEdgeRowRequest): Promise<QueryAllEdgeRowResponse> {
    const data = QueryAllEdgeRowRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "EdgeRowAll", data);
    return promise.then((data) => QueryAllEdgeRowResponse.decode(new _m0.Reader(data)));
  }

  AdjanceyMatrix(request: QueryGetAdjanceyMatrixRequest): Promise<QueryGetAdjanceyMatrixResponse> {
    const data = QueryGetAdjanceyMatrixRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "AdjanceyMatrix", data);
    return promise.then((data) => QueryGetAdjanceyMatrixResponse.decode(new _m0.Reader(data)));
  }

  AdjanceyMatrixAll(request: QueryAllAdjanceyMatrixRequest): Promise<QueryAllAdjanceyMatrixResponse> {
    const data = QueryAllAdjanceyMatrixRequest.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.dex.Query", "AdjanceyMatrixAll", data);
    return promise.then((data) => QueryAllAdjanceyMatrixResponse.decode(new _m0.Reader(data)));
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
