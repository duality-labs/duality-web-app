/* eslint-disable */
/* tslint:disable */
import _m0 from "protobufjs/minimal";
import { GenesisState } from "../../consumer/v1/genesis";
import { ConsumerAdditionProposals, ConsumerRemovalProposals } from "./provider";

export const protobufPackage = "interchain_security.ccv.provider.v1";

export interface QueryConsumerGenesisRequest {
  chainId: string;
}

export interface QueryConsumerGenesisResponse {
  genesisState: GenesisState | undefined;
}

export interface QueryConsumerChainsRequest {
}

export interface QueryConsumerChainsResponse {
  chains: Chain[];
}

export interface QueryConsumerChainStartProposalsRequest {
}

export interface QueryConsumerChainStartProposalsResponse {
  proposals: ConsumerAdditionProposals | undefined;
}

export interface QueryConsumerChainStopProposalsRequest {
}

export interface QueryConsumerChainStopProposalsResponse {
  proposals: ConsumerRemovalProposals | undefined;
}

export interface Chain {
  chainId: string;
  clientId: string;
}

function createBaseQueryConsumerGenesisRequest(): QueryConsumerGenesisRequest {
  return { chainId: "" };
}

export const QueryConsumerGenesisRequest = {
  encode(message: QueryConsumerGenesisRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.chainId !== "") {
      writer.uint32(10).string(message.chainId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerGenesisRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerGenesisRequest();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.chainId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryConsumerGenesisRequest {
    return { chainId: isSet(object.chainId) ? String(object.chainId) : "" };
  },

  toJSON(message: QueryConsumerGenesisRequest): unknown {
    const obj: any = {};
    message.chainId !== undefined && (obj.chainId = message.chainId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerGenesisRequest>, I>>(object: I): QueryConsumerGenesisRequest {
    const message = createBaseQueryConsumerGenesisRequest();
    message.chainId = object.chainId ?? "";
    return message;
  },
};

function createBaseQueryConsumerGenesisResponse(): QueryConsumerGenesisResponse {
  return { genesisState: undefined };
}

export const QueryConsumerGenesisResponse = {
  encode(message: QueryConsumerGenesisResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.genesisState !== undefined) {
      GenesisState.encode(message.genesisState, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerGenesisResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerGenesisResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.genesisState = GenesisState.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryConsumerGenesisResponse {
    return { genesisState: isSet(object.genesisState) ? GenesisState.fromJSON(object.genesisState) : undefined };
  },

  toJSON(message: QueryConsumerGenesisResponse): unknown {
    const obj: any = {};
    message.genesisState !== undefined
      && (obj.genesisState = message.genesisState ? GenesisState.toJSON(message.genesisState) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerGenesisResponse>, I>>(object: I): QueryConsumerGenesisResponse {
    const message = createBaseQueryConsumerGenesisResponse();
    message.genesisState = (object.genesisState !== undefined && object.genesisState !== null)
      ? GenesisState.fromPartial(object.genesisState)
      : undefined;
    return message;
  },
};

function createBaseQueryConsumerChainsRequest(): QueryConsumerChainsRequest {
  return {};
}

export const QueryConsumerChainsRequest = {
  encode(_: QueryConsumerChainsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerChainsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerChainsRequest();
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

  fromJSON(_: any): QueryConsumerChainsRequest {
    return {};
  },

  toJSON(_: QueryConsumerChainsRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerChainsRequest>, I>>(_: I): QueryConsumerChainsRequest {
    const message = createBaseQueryConsumerChainsRequest();
    return message;
  },
};

function createBaseQueryConsumerChainsResponse(): QueryConsumerChainsResponse {
  return { chains: [] };
}

export const QueryConsumerChainsResponse = {
  encode(message: QueryConsumerChainsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.chains) {
      Chain.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerChainsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerChainsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.chains.push(Chain.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryConsumerChainsResponse {
    return { chains: Array.isArray(object?.chains) ? object.chains.map((e: any) => Chain.fromJSON(e)) : [] };
  },

  toJSON(message: QueryConsumerChainsResponse): unknown {
    const obj: any = {};
    if (message.chains) {
      obj.chains = message.chains.map((e) => e ? Chain.toJSON(e) : undefined);
    } else {
      obj.chains = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerChainsResponse>, I>>(object: I): QueryConsumerChainsResponse {
    const message = createBaseQueryConsumerChainsResponse();
    message.chains = object.chains?.map((e) => Chain.fromPartial(e)) || [];
    return message;
  },
};

function createBaseQueryConsumerChainStartProposalsRequest(): QueryConsumerChainStartProposalsRequest {
  return {};
}

export const QueryConsumerChainStartProposalsRequest = {
  encode(_: QueryConsumerChainStartProposalsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerChainStartProposalsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerChainStartProposalsRequest();
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

  fromJSON(_: any): QueryConsumerChainStartProposalsRequest {
    return {};
  },

  toJSON(_: QueryConsumerChainStartProposalsRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerChainStartProposalsRequest>, I>>(
    _: I,
  ): QueryConsumerChainStartProposalsRequest {
    const message = createBaseQueryConsumerChainStartProposalsRequest();
    return message;
  },
};

function createBaseQueryConsumerChainStartProposalsResponse(): QueryConsumerChainStartProposalsResponse {
  return { proposals: undefined };
}

export const QueryConsumerChainStartProposalsResponse = {
  encode(message: QueryConsumerChainStartProposalsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.proposals !== undefined) {
      ConsumerAdditionProposals.encode(message.proposals, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerChainStartProposalsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerChainStartProposalsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.proposals = ConsumerAdditionProposals.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryConsumerChainStartProposalsResponse {
    return { proposals: isSet(object.proposals) ? ConsumerAdditionProposals.fromJSON(object.proposals) : undefined };
  },

  toJSON(message: QueryConsumerChainStartProposalsResponse): unknown {
    const obj: any = {};
    message.proposals !== undefined
      && (obj.proposals = message.proposals ? ConsumerAdditionProposals.toJSON(message.proposals) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerChainStartProposalsResponse>, I>>(
    object: I,
  ): QueryConsumerChainStartProposalsResponse {
    const message = createBaseQueryConsumerChainStartProposalsResponse();
    message.proposals = (object.proposals !== undefined && object.proposals !== null)
      ? ConsumerAdditionProposals.fromPartial(object.proposals)
      : undefined;
    return message;
  },
};

function createBaseQueryConsumerChainStopProposalsRequest(): QueryConsumerChainStopProposalsRequest {
  return {};
}

export const QueryConsumerChainStopProposalsRequest = {
  encode(_: QueryConsumerChainStopProposalsRequest, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerChainStopProposalsRequest {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerChainStopProposalsRequest();
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

  fromJSON(_: any): QueryConsumerChainStopProposalsRequest {
    return {};
  },

  toJSON(_: QueryConsumerChainStopProposalsRequest): unknown {
    const obj: any = {};
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerChainStopProposalsRequest>, I>>(
    _: I,
  ): QueryConsumerChainStopProposalsRequest {
    const message = createBaseQueryConsumerChainStopProposalsRequest();
    return message;
  },
};

function createBaseQueryConsumerChainStopProposalsResponse(): QueryConsumerChainStopProposalsResponse {
  return { proposals: undefined };
}

export const QueryConsumerChainStopProposalsResponse = {
  encode(message: QueryConsumerChainStopProposalsResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.proposals !== undefined) {
      ConsumerRemovalProposals.encode(message.proposals, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): QueryConsumerChainStopProposalsResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseQueryConsumerChainStopProposalsResponse();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.proposals = ConsumerRemovalProposals.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): QueryConsumerChainStopProposalsResponse {
    return { proposals: isSet(object.proposals) ? ConsumerRemovalProposals.fromJSON(object.proposals) : undefined };
  },

  toJSON(message: QueryConsumerChainStopProposalsResponse): unknown {
    const obj: any = {};
    message.proposals !== undefined
      && (obj.proposals = message.proposals ? ConsumerRemovalProposals.toJSON(message.proposals) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<QueryConsumerChainStopProposalsResponse>, I>>(
    object: I,
  ): QueryConsumerChainStopProposalsResponse {
    const message = createBaseQueryConsumerChainStopProposalsResponse();
    message.proposals = (object.proposals !== undefined && object.proposals !== null)
      ? ConsumerRemovalProposals.fromPartial(object.proposals)
      : undefined;
    return message;
  },
};

function createBaseChain(): Chain {
  return { chainId: "", clientId: "" };
}

export const Chain = {
  encode(message: Chain, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.chainId !== "") {
      writer.uint32(10).string(message.chainId);
    }
    if (message.clientId !== "") {
      writer.uint32(18).string(message.clientId);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Chain {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseChain();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.chainId = reader.string();
          break;
        case 2:
          message.clientId = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Chain {
    return {
      chainId: isSet(object.chainId) ? String(object.chainId) : "",
      clientId: isSet(object.clientId) ? String(object.clientId) : "",
    };
  },

  toJSON(message: Chain): unknown {
    const obj: any = {};
    message.chainId !== undefined && (obj.chainId = message.chainId);
    message.clientId !== undefined && (obj.clientId = message.clientId);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Chain>, I>>(object: I): Chain {
    const message = createBaseChain();
    message.chainId = object.chainId ?? "";
    message.clientId = object.clientId ?? "";
    return message;
  },
};

export interface Query {
  /**
   * ConsumerGenesis queries the genesis state needed to start a consumer chain
   * whose proposal has been accepted
   */
  QueryConsumerGenesis(request: QueryConsumerGenesisRequest): Promise<QueryConsumerGenesisResponse>;
  /**
   * ConsumerChains queries active consumer chains supported by the provider
   * chain
   */
  QueryConsumerChains(request: QueryConsumerChainsRequest): Promise<QueryConsumerChainsResponse>;
  /** QueryConsumerChainStarts queries consumer chain start proposals. */
  QueryConsumerChainStarts(
    request: QueryConsumerChainStartProposalsRequest,
  ): Promise<QueryConsumerChainStartProposalsResponse>;
  /** QueryConsumerChainStops queries consumer chain stop proposals. */
  QueryConsumerChainStops(
    request: QueryConsumerChainStopProposalsRequest,
  ): Promise<QueryConsumerChainStopProposalsResponse>;
}

export class QueryClientImpl implements Query {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.QueryConsumerGenesis = this.QueryConsumerGenesis.bind(this);
    this.QueryConsumerChains = this.QueryConsumerChains.bind(this);
    this.QueryConsumerChainStarts = this.QueryConsumerChainStarts.bind(this);
    this.QueryConsumerChainStops = this.QueryConsumerChainStops.bind(this);
  }
  QueryConsumerGenesis(request: QueryConsumerGenesisRequest): Promise<QueryConsumerGenesisResponse> {
    const data = QueryConsumerGenesisRequest.encode(request).finish();
    const promise = this.rpc.request("interchain_security.ccv.provider.v1.Query", "QueryConsumerGenesis", data);
    return promise.then((data) => QueryConsumerGenesisResponse.decode(new _m0.Reader(data)));
  }

  QueryConsumerChains(request: QueryConsumerChainsRequest): Promise<QueryConsumerChainsResponse> {
    const data = QueryConsumerChainsRequest.encode(request).finish();
    const promise = this.rpc.request("interchain_security.ccv.provider.v1.Query", "QueryConsumerChains", data);
    return promise.then((data) => QueryConsumerChainsResponse.decode(new _m0.Reader(data)));
  }

  QueryConsumerChainStarts(
    request: QueryConsumerChainStartProposalsRequest,
  ): Promise<QueryConsumerChainStartProposalsResponse> {
    const data = QueryConsumerChainStartProposalsRequest.encode(request).finish();
    const promise = this.rpc.request("interchain_security.ccv.provider.v1.Query", "QueryConsumerChainStarts", data);
    return promise.then((data) => QueryConsumerChainStartProposalsResponse.decode(new _m0.Reader(data)));
  }

  QueryConsumerChainStops(
    request: QueryConsumerChainStopProposalsRequest,
  ): Promise<QueryConsumerChainStopProposalsResponse> {
    const data = QueryConsumerChainStopProposalsRequest.encode(request).finish();
    const promise = this.rpc.request("interchain_security.ccv.provider.v1.Query", "QueryConsumerChainStops", data);
    return promise.then((data) => QueryConsumerChainStopProposalsResponse.decode(new _m0.Reader(data)));
  }
}

interface Rpc {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
