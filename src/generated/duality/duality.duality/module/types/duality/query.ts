/* eslint-disable */
import { Reader, Writer } from "protobufjs/minimal";
import { Params } from "../duality/params";
import { Share } from "../duality/share";
import {
  PageRequest,
  PageResponse,
} from "../cosmos/base/query/v1beta1/pagination";
import { Tick } from "../duality/tick";

export const protobufPackage = "duality.duality";

/** QueryParamsRequest is request type for the Query/Params RPC method. */
export interface QueryParamsRequest {}

/** QueryParamsResponse is response type for the Query/Params RPC method. */
export interface QueryParamsResponse {
  /** params holds all the parameters of this module. */
  params: Params | undefined;
}

export interface QueryGetShareRequest {
  owner: string;
  token0: string;
  token1: string;
  price0: string;
  price1: string;
  fee: string;
}

export interface QueryGetShareResponse {
  share: Share | undefined;
}

export interface QueryAllShareRequest {
  pagination: PageRequest | undefined;
}

export interface QueryAllShareResponse {
  share: Share[];
  pagination: PageResponse | undefined;
}

export interface QueryGetTickRequest {
  token0: string;
  token1: string;
  price0: string;
  price1: string;
  fee: string;
}

export interface QueryGetTickResponse {
  tick: Tick | undefined;
}

export interface QueryAllTickByTokensRequest {
  token0: string;
  token1: string;
  /** optional added query parameters below */
  pagination: PageRequest | undefined;
  /** filter to fee */
  fee: string;
  /** filter to price of token0 */
  price0: string;
  /** filter to price of token1 */
  price1: string;
}

export interface QueryAllTickRequest {
  /** optional added query parameters below */
  pagination: PageRequest | undefined;
  /** filter to token */
  token0: string;
  /** filter to token */
  token1: string;
  /** filter to fee */
  fee: string;
  /** filter to price of token0 */
  price0: string;
  /** filter to price of token1 */
  price1: string;
}

export interface QueryAllTickResponse {
  tick: Tick[];
  pagination: PageResponse | undefined;
}

const baseQueryParamsRequest: object = {};

export const QueryParamsRequest = {
  encode(_: QueryParamsRequest, writer: Writer = Writer.create()): Writer {
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryParamsRequest {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryParamsRequest } as QueryParamsRequest;
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

  fromJSON(_: any): QueryParamsRequest {
    const message = { ...baseQueryParamsRequest } as QueryParamsRequest;
    return message;
  },

  toJSON(_: QueryParamsRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial(_: DeepPartial<QueryParamsRequest>): QueryParamsRequest {
    const message = { ...baseQueryParamsRequest } as QueryParamsRequest;
    return message;
  },
};

const baseQueryParamsResponse: object = {};

export const QueryParamsResponse = {
  encode(
    message: QueryParamsResponse,
    writer: Writer = Writer.create()
  ): Writer {
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryParamsResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryParamsResponse } as QueryParamsResponse;
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

  fromJSON(object: any): QueryParamsResponse {
    const message = { ...baseQueryParamsResponse } as QueryParamsResponse;
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromJSON(object.params);
    } else {
      message.params = undefined;
    }
    return message;
  },

  toJSON(message: QueryParamsResponse): unknown {
    const obj: any = {};
    message.params !== undefined &&
      (obj.params = message.params ? Params.toJSON(message.params) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryParamsResponse>): QueryParamsResponse {
    const message = { ...baseQueryParamsResponse } as QueryParamsResponse;
    if (object.params !== undefined && object.params !== null) {
      message.params = Params.fromPartial(object.params);
    } else {
      message.params = undefined;
    }
    return message;
  },
};

const baseQueryGetShareRequest: object = {
  owner: "",
  token0: "",
  token1: "",
  price0: "",
  price1: "",
  fee: "",
};

export const QueryGetShareRequest = {
  encode(
    message: QueryGetShareRequest,
    writer: Writer = Writer.create()
  ): Writer {
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
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryGetShareRequest {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryGetShareRequest } as QueryGetShareRequest;
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
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryGetShareRequest {
    const message = { ...baseQueryGetShareRequest } as QueryGetShareRequest;
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
    return message;
  },

  toJSON(message: QueryGetShareRequest): unknown {
    const obj: any = {};
    message.owner !== undefined && (obj.owner = message.owner);
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    message.fee !== undefined && (obj.fee = message.fee);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryGetShareRequest>): QueryGetShareRequest {
    const message = { ...baseQueryGetShareRequest } as QueryGetShareRequest;
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
    return message;
  },
};

const baseQueryGetShareResponse: object = {};

export const QueryGetShareResponse = {
  encode(
    message: QueryGetShareResponse,
    writer: Writer = Writer.create()
  ): Writer {
    if (message.share !== undefined) {
      Share.encode(message.share, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryGetShareResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryGetShareResponse } as QueryGetShareResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.share = Share.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryGetShareResponse {
    const message = { ...baseQueryGetShareResponse } as QueryGetShareResponse;
    if (object.share !== undefined && object.share !== null) {
      message.share = Share.fromJSON(object.share);
    } else {
      message.share = undefined;
    }
    return message;
  },

  toJSON(message: QueryGetShareResponse): unknown {
    const obj: any = {};
    message.share !== undefined &&
      (obj.share = message.share ? Share.toJSON(message.share) : undefined);
    return obj;
  },

  fromPartial(
    object: DeepPartial<QueryGetShareResponse>
  ): QueryGetShareResponse {
    const message = { ...baseQueryGetShareResponse } as QueryGetShareResponse;
    if (object.share !== undefined && object.share !== null) {
      message.share = Share.fromPartial(object.share);
    } else {
      message.share = undefined;
    }
    return message;
  },
};

const baseQueryAllShareRequest: object = {};

export const QueryAllShareRequest = {
  encode(
    message: QueryAllShareRequest,
    writer: Writer = Writer.create()
  ): Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryAllShareRequest {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryAllShareRequest } as QueryAllShareRequest;
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

  fromJSON(object: any): QueryAllShareRequest {
    const message = { ...baseQueryAllShareRequest } as QueryAllShareRequest;
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromJSON(object.pagination);
    } else {
      message.pagination = undefined;
    }
    return message;
  },

  toJSON(message: QueryAllShareRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined &&
      (obj.pagination = message.pagination
        ? PageRequest.toJSON(message.pagination)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryAllShareRequest>): QueryAllShareRequest {
    const message = { ...baseQueryAllShareRequest } as QueryAllShareRequest;
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromPartial(object.pagination);
    } else {
      message.pagination = undefined;
    }
    return message;
  },
};

const baseQueryAllShareResponse: object = {};

export const QueryAllShareResponse = {
  encode(
    message: QueryAllShareResponse,
    writer: Writer = Writer.create()
  ): Writer {
    for (const v of message.share) {
      Share.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(
        message.pagination,
        writer.uint32(18).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryAllShareResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryAllShareResponse } as QueryAllShareResponse;
    message.share = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.share.push(Share.decode(reader, reader.uint32()));
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

  fromJSON(object: any): QueryAllShareResponse {
    const message = { ...baseQueryAllShareResponse } as QueryAllShareResponse;
    message.share = [];
    if (object.share !== undefined && object.share !== null) {
      for (const e of object.share) {
        message.share.push(Share.fromJSON(e));
      }
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromJSON(object.pagination);
    } else {
      message.pagination = undefined;
    }
    return message;
  },

  toJSON(message: QueryAllShareResponse): unknown {
    const obj: any = {};
    if (message.share) {
      obj.share = message.share.map((e) => (e ? Share.toJSON(e) : undefined));
    } else {
      obj.share = [];
    }
    message.pagination !== undefined &&
      (obj.pagination = message.pagination
        ? PageResponse.toJSON(message.pagination)
        : undefined);
    return obj;
  },

  fromPartial(
    object: DeepPartial<QueryAllShareResponse>
  ): QueryAllShareResponse {
    const message = { ...baseQueryAllShareResponse } as QueryAllShareResponse;
    message.share = [];
    if (object.share !== undefined && object.share !== null) {
      for (const e of object.share) {
        message.share.push(Share.fromPartial(e));
      }
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromPartial(object.pagination);
    } else {
      message.pagination = undefined;
    }
    return message;
  },
};

const baseQueryGetTickRequest: object = {
  token0: "",
  token1: "",
  price0: "",
  price1: "",
  fee: "",
};

export const QueryGetTickRequest = {
  encode(
    message: QueryGetTickRequest,
    writer: Writer = Writer.create()
  ): Writer {
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
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryGetTickRequest {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryGetTickRequest } as QueryGetTickRequest;
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
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryGetTickRequest {
    const message = { ...baseQueryGetTickRequest } as QueryGetTickRequest;
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
    return message;
  },

  toJSON(message: QueryGetTickRequest): unknown {
    const obj: any = {};
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    message.fee !== undefined && (obj.fee = message.fee);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryGetTickRequest>): QueryGetTickRequest {
    const message = { ...baseQueryGetTickRequest } as QueryGetTickRequest;
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
    return message;
  },
};

const baseQueryGetTickResponse: object = {};

export const QueryGetTickResponse = {
  encode(
    message: QueryGetTickResponse,
    writer: Writer = Writer.create()
  ): Writer {
    if (message.tick !== undefined) {
      Tick.encode(message.tick, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryGetTickResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryGetTickResponse } as QueryGetTickResponse;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tick = Tick.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryGetTickResponse {
    const message = { ...baseQueryGetTickResponse } as QueryGetTickResponse;
    if (object.tick !== undefined && object.tick !== null) {
      message.tick = Tick.fromJSON(object.tick);
    } else {
      message.tick = undefined;
    }
    return message;
  },

  toJSON(message: QueryGetTickResponse): unknown {
    const obj: any = {};
    message.tick !== undefined &&
      (obj.tick = message.tick ? Tick.toJSON(message.tick) : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryGetTickResponse>): QueryGetTickResponse {
    const message = { ...baseQueryGetTickResponse } as QueryGetTickResponse;
    if (object.tick !== undefined && object.tick !== null) {
      message.tick = Tick.fromPartial(object.tick);
    } else {
      message.tick = undefined;
    }
    return message;
  },
};

const baseQueryAllTickByTokensRequest: object = {
  token0: "",
  token1: "",
  fee: "",
  price0: "",
  price1: "",
};

export const QueryAllTickByTokensRequest = {
  encode(
    message: QueryAllTickByTokensRequest,
    writer: Writer = Writer.create()
  ): Writer {
    if (message.token0 !== "") {
      writer.uint32(10).string(message.token0);
    }
    if (message.token1 !== "") {
      writer.uint32(18).string(message.token1);
    }
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(26).fork()).ldelim();
    }
    if (message.fee !== "") {
      writer.uint32(34).string(message.fee);
    }
    if (message.price0 !== "") {
      writer.uint32(42).string(message.price0);
    }
    if (message.price1 !== "") {
      writer.uint32(50).string(message.price1);
    }
    return writer;
  },

  decode(
    input: Reader | Uint8Array,
    length?: number
  ): QueryAllTickByTokensRequest {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = {
      ...baseQueryAllTickByTokensRequest,
    } as QueryAllTickByTokensRequest;
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
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        case 4:
          message.fee = reader.string();
          break;
        case 5:
          message.price0 = reader.string();
          break;
        case 6:
          message.price1 = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryAllTickByTokensRequest {
    const message = {
      ...baseQueryAllTickByTokensRequest,
    } as QueryAllTickByTokensRequest;
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
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromJSON(object.pagination);
    } else {
      message.pagination = undefined;
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = String(object.fee);
    } else {
      message.fee = "";
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
    return message;
  },

  toJSON(message: QueryAllTickByTokensRequest): unknown {
    const obj: any = {};
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.pagination !== undefined &&
      (obj.pagination = message.pagination
        ? PageRequest.toJSON(message.pagination)
        : undefined);
    message.fee !== undefined && (obj.fee = message.fee);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    return obj;
  },

  fromPartial(
    object: DeepPartial<QueryAllTickByTokensRequest>
  ): QueryAllTickByTokensRequest {
    const message = {
      ...baseQueryAllTickByTokensRequest,
    } as QueryAllTickByTokensRequest;
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
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromPartial(object.pagination);
    } else {
      message.pagination = undefined;
    }
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = object.fee;
    } else {
      message.fee = "";
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
    return message;
  },
};

const baseQueryAllTickRequest: object = {
  token0: "",
  token1: "",
  fee: "",
  price0: "",
  price1: "",
};

export const QueryAllTickRequest = {
  encode(
    message: QueryAllTickRequest,
    writer: Writer = Writer.create()
  ): Writer {
    if (message.pagination !== undefined) {
      PageRequest.encode(message.pagination, writer.uint32(10).fork()).ldelim();
    }
    if (message.token0 !== "") {
      writer.uint32(18).string(message.token0);
    }
    if (message.token1 !== "") {
      writer.uint32(26).string(message.token1);
    }
    if (message.fee !== "") {
      writer.uint32(34).string(message.fee);
    }
    if (message.price0 !== "") {
      writer.uint32(42).string(message.price0);
    }
    if (message.price1 !== "") {
      writer.uint32(50).string(message.price1);
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryAllTickRequest {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryAllTickRequest } as QueryAllTickRequest;
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pagination = PageRequest.decode(reader, reader.uint32());
          break;
        case 2:
          message.token0 = reader.string();
          break;
        case 3:
          message.token1 = reader.string();
          break;
        case 4:
          message.fee = reader.string();
          break;
        case 5:
          message.price0 = reader.string();
          break;
        case 6:
          message.price1 = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryAllTickRequest {
    const message = { ...baseQueryAllTickRequest } as QueryAllTickRequest;
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromJSON(object.pagination);
    } else {
      message.pagination = undefined;
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
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = String(object.fee);
    } else {
      message.fee = "";
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
    return message;
  },

  toJSON(message: QueryAllTickRequest): unknown {
    const obj: any = {};
    message.pagination !== undefined &&
      (obj.pagination = message.pagination
        ? PageRequest.toJSON(message.pagination)
        : undefined);
    message.token0 !== undefined && (obj.token0 = message.token0);
    message.token1 !== undefined && (obj.token1 = message.token1);
    message.fee !== undefined && (obj.fee = message.fee);
    message.price0 !== undefined && (obj.price0 = message.price0);
    message.price1 !== undefined && (obj.price1 = message.price1);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryAllTickRequest>): QueryAllTickRequest {
    const message = { ...baseQueryAllTickRequest } as QueryAllTickRequest;
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageRequest.fromPartial(object.pagination);
    } else {
      message.pagination = undefined;
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
    if (object.fee !== undefined && object.fee !== null) {
      message.fee = object.fee;
    } else {
      message.fee = "";
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
    return message;
  },
};

const baseQueryAllTickResponse: object = {};

export const QueryAllTickResponse = {
  encode(
    message: QueryAllTickResponse,
    writer: Writer = Writer.create()
  ): Writer {
    for (const v of message.tick) {
      Tick.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    if (message.pagination !== undefined) {
      PageResponse.encode(
        message.pagination,
        writer.uint32(18).fork()
      ).ldelim();
    }
    return writer;
  },

  decode(input: Reader | Uint8Array, length?: number): QueryAllTickResponse {
    const reader = input instanceof Uint8Array ? new Reader(input) : input;
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = { ...baseQueryAllTickResponse } as QueryAllTickResponse;
    message.tick = [];
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.tick.push(Tick.decode(reader, reader.uint32()));
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

  fromJSON(object: any): QueryAllTickResponse {
    const message = { ...baseQueryAllTickResponse } as QueryAllTickResponse;
    message.tick = [];
    if (object.tick !== undefined && object.tick !== null) {
      for (const e of object.tick) {
        message.tick.push(Tick.fromJSON(e));
      }
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromJSON(object.pagination);
    } else {
      message.pagination = undefined;
    }
    return message;
  },

  toJSON(message: QueryAllTickResponse): unknown {
    const obj: any = {};
    if (message.tick) {
      obj.tick = message.tick.map((e) => (e ? Tick.toJSON(e) : undefined));
    } else {
      obj.tick = [];
    }
    message.pagination !== undefined &&
      (obj.pagination = message.pagination
        ? PageResponse.toJSON(message.pagination)
        : undefined);
    return obj;
  },

  fromPartial(object: DeepPartial<QueryAllTickResponse>): QueryAllTickResponse {
    const message = { ...baseQueryAllTickResponse } as QueryAllTickResponse;
    message.tick = [];
    if (object.tick !== undefined && object.tick !== null) {
      for (const e of object.tick) {
        message.tick.push(Tick.fromPartial(e));
      }
    }
    if (object.pagination !== undefined && object.pagination !== null) {
      message.pagination = PageResponse.fromPartial(object.pagination);
    } else {
      message.pagination = undefined;
    }
    return message;
  },
};

/** Query defines the gRPC querier service. */
export interface Query {
  /** Parameters queries the parameters of the module. */
  Params(request: QueryParamsRequest): Promise<QueryParamsResponse>;
  /** Queries a Share by index. */
  Share(request: QueryGetShareRequest): Promise<QueryGetShareResponse>;
  /** Queries a list of Share items. */
  ShareAll(request: QueryAllShareRequest): Promise<QueryAllShareResponse>;
  /** Queries a Tick by index. */
  Tick(request: QueryGetTickRequest): Promise<QueryGetTickResponse>;
  /** Queries a list of Tick items by tokens. */
  TickAllByTokens(
    request: QueryAllTickByTokensRequest
  ): Promise<QueryAllTickResponse>;
  /** Queries a list of Tick items. */
  TickAll(request: QueryAllTickRequest): Promise<QueryAllTickResponse>;
}

export class QueryClientImpl implements Query {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
  }
  Params(request: QueryParamsRequest): Promise<QueryParamsResponse> {
    const data = QueryParamsRequest.encode(request).finish();
    const promise = this.rpc.request("duality.duality.Query", "Params", data);
    return promise.then((data) => QueryParamsResponse.decode(new Reader(data)));
  }

  Share(request: QueryGetShareRequest): Promise<QueryGetShareResponse> {
    const data = QueryGetShareRequest.encode(request).finish();
    const promise = this.rpc.request("duality.duality.Query", "Share", data);
    return promise.then((data) =>
      QueryGetShareResponse.decode(new Reader(data))
    );
  }

  ShareAll(request: QueryAllShareRequest): Promise<QueryAllShareResponse> {
    const data = QueryAllShareRequest.encode(request).finish();
    const promise = this.rpc.request("duality.duality.Query", "ShareAll", data);
    return promise.then((data) =>
      QueryAllShareResponse.decode(new Reader(data))
    );
  }

  Tick(request: QueryGetTickRequest): Promise<QueryGetTickResponse> {
    const data = QueryGetTickRequest.encode(request).finish();
    const promise = this.rpc.request("duality.duality.Query", "Tick", data);
    return promise.then((data) =>
      QueryGetTickResponse.decode(new Reader(data))
    );
  }

  TickAllByTokens(
    request: QueryAllTickByTokensRequest
  ): Promise<QueryAllTickResponse> {
    const data = QueryAllTickByTokensRequest.encode(request).finish();
    const promise = this.rpc.request(
      "duality.duality.Query",
      "TickAllByTokens",
      data
    );
    return promise.then((data) =>
      QueryAllTickResponse.decode(new Reader(data))
    );
  }

  TickAll(request: QueryAllTickRequest): Promise<QueryAllTickResponse> {
    const data = QueryAllTickRequest.encode(request).finish();
    const promise = this.rpc.request("duality.duality.Query", "TickAll", data);
    return promise.then((data) =>
      QueryAllTickResponse.decode(new Reader(data))
    );
  }
}

interface Rpc {
  request(
    service: string,
    method: string,
    data: Uint8Array
  ): Promise<Uint8Array>;
}

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
