/* eslint-disable */
/* tslint:disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { Duration } from "../../../../google/protobuf/duration";
import { Timestamp } from "../../../../google/protobuf/timestamp";
import { Height } from "../../../../ibc/core/client/v1/client";
import { ClientState } from "../../../../ibc/lightclients/tendermint/v1/tendermint";

export const protobufPackage = "interchain_security.ccv.provider.v1";

/**
 * ConsumerAdditionProposal is a governance proposal on the provider chain to spawn a new consumer chain.
 * If it passes, then all validators on the provider chain are expected to validate the consumer chain at spawn time
 * or get slashed. It is recommended that spawn time occurs after the proposal end time.
 */
export interface ConsumerAdditionProposal {
  /** the title of the proposal */
  title: string;
  /** the description of the proposal */
  description: string;
  /**
   * the proposed chain-id of the new consumer chain, must be different from all other consumer chain ids of the executing
   * provider chain.
   */
  chainId: string;
  /**
   * the proposed initial height of new consumer chain.
   * For a completely new chain, this will be {0,1}. However, it may be different if this is a chain that is converting to a consumer chain.
   */
  initialHeight:
    | Height
    | undefined;
  /** genesis hash with no staking information included. */
  genesisHash: Uint8Array;
  /** binary hash is the hash of the binary that should be used by validators on chain initialization. */
  binaryHash: Uint8Array;
  /**
   * spawn time is the time on the provider chain at which the consumer chain genesis is finalized and all validators
   * will be responsible for starting their consumer chain validator node.
   */
  spawnTime:
    | Date
    | undefined;
  /**
   * Indicates whether the outstanding unbonding operations should be released
   * in case of a channel time-outs. When set to true, a governance proposal
   * on the provider chain would be necessary to release the locked funds.
   */
  lockUnbondingOnTimeout: boolean;
}

/**
 * ConsumerRemovalProposal is a governance proposal on the provider chain to remove (and stop) a consumer chain.
 * If it passes, all the consumer chain's state is removed from the provider chain. The outstanding unbonding
 * operation funds are released if the LockUnbondingOnTimeout parameter is set to false for the consumer chain ID.
 */
export interface ConsumerRemovalProposal {
  /** the title of the proposal */
  title: string;
  /** the description of the proposal */
  description: string;
  /** the chain-id of the consumer chain to be stopped */
  chainId: string;
  /** the time on the provider chain at which all validators are responsible to stop their consumer chain validator node */
  stopTime: Date | undefined;
}

/** Params defines the parameters for CCV Provider module */
export interface Params {
  templateClient:
    | ClientState
    | undefined;
  /** TrustingPeriodFraction is used to compute the consumer and provider IBC client's TrustingPeriod from the chain defined UnbondingPeriod */
  trustingPeriodFraction: number;
  /** Sent IBC packets will timeout after this duration */
  ccvTimeoutPeriod:
    | Duration
    | undefined;
  /** The channel initialization (IBC channel opening handshake) will timeout after this duration */
  initTimeoutPeriod:
    | Duration
    | undefined;
  /**
   * The VSC packets sent by the provider will timeout after this duration.
   * Note that unlike ccv_timeout_period which is an IBC param,
   * the vsc_timeout_period is a provider-side param that enables the provider
   * to timeout VSC packets even when a consumer chain is not live.
   */
  vscTimeoutPeriod: Duration | undefined;
}

export interface HandshakeMetadata {
  providerFeePoolAddr: string;
  version: string;
}

/**
 * SlashAcks contains addesses of consumer chain validators
 * successfully slashed on the provider chain
 */
export interface SlashAcks {
  addresses: string[];
}

/** ConsumerAdditionProposals holds pending governance proposals on the provider chain to spawn a new chain. */
export interface ConsumerAdditionProposals {
  /** proposals waiting for spawn_time to pass */
  pending: ConsumerAdditionProposal[];
}

/** ConsumerRemovalProposals holds pending governance proposals on the provider chain to remove (and stop) a consumer chain. */
export interface ConsumerRemovalProposals {
  /** proposals waiting for stop_time to pass */
  pending: ConsumerRemovalProposal[];
}

function createBaseConsumerAdditionProposal(): ConsumerAdditionProposal {
  return {
    title: "",
    description: "",
    chainId: "",
    initialHeight: undefined,
    genesisHash: new Uint8Array(),
    binaryHash: new Uint8Array(),
    spawnTime: undefined,
    lockUnbondingOnTimeout: false,
  };
}

export const ConsumerAdditionProposal = {
  encode(message: ConsumerAdditionProposal, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.title !== "") {
      writer.uint32(10).string(message.title);
    }
    if (message.description !== "") {
      writer.uint32(18).string(message.description);
    }
    if (message.chainId !== "") {
      writer.uint32(26).string(message.chainId);
    }
    if (message.initialHeight !== undefined) {
      Height.encode(message.initialHeight, writer.uint32(34).fork()).ldelim();
    }
    if (message.genesisHash.length !== 0) {
      writer.uint32(42).bytes(message.genesisHash);
    }
    if (message.binaryHash.length !== 0) {
      writer.uint32(50).bytes(message.binaryHash);
    }
    if (message.spawnTime !== undefined) {
      Timestamp.encode(toTimestamp(message.spawnTime), writer.uint32(58).fork()).ldelim();
    }
    if (message.lockUnbondingOnTimeout === true) {
      writer.uint32(64).bool(message.lockUnbondingOnTimeout);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsumerAdditionProposal {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsumerAdditionProposal();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.title = reader.string();
          break;
        case 2:
          message.description = reader.string();
          break;
        case 3:
          message.chainId = reader.string();
          break;
        case 4:
          message.initialHeight = Height.decode(reader, reader.uint32());
          break;
        case 5:
          message.genesisHash = reader.bytes();
          break;
        case 6:
          message.binaryHash = reader.bytes();
          break;
        case 7:
          message.spawnTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        case 8:
          message.lockUnbondingOnTimeout = reader.bool();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsumerAdditionProposal {
    return {
      title: isSet(object.title) ? String(object.title) : "",
      description: isSet(object.description) ? String(object.description) : "",
      chainId: isSet(object.chainId) ? String(object.chainId) : "",
      initialHeight: isSet(object.initialHeight) ? Height.fromJSON(object.initialHeight) : undefined,
      genesisHash: isSet(object.genesisHash) ? bytesFromBase64(object.genesisHash) : new Uint8Array(),
      binaryHash: isSet(object.binaryHash) ? bytesFromBase64(object.binaryHash) : new Uint8Array(),
      spawnTime: isSet(object.spawnTime) ? fromJsonTimestamp(object.spawnTime) : undefined,
      lockUnbondingOnTimeout: isSet(object.lockUnbondingOnTimeout) ? Boolean(object.lockUnbondingOnTimeout) : false,
    };
  },

  toJSON(message: ConsumerAdditionProposal): unknown {
    const obj: any = {};
    message.title !== undefined && (obj.title = message.title);
    message.description !== undefined && (obj.description = message.description);
    message.chainId !== undefined && (obj.chainId = message.chainId);
    message.initialHeight !== undefined
      && (obj.initialHeight = message.initialHeight ? Height.toJSON(message.initialHeight) : undefined);
    message.genesisHash !== undefined
      && (obj.genesisHash = base64FromBytes(
        message.genesisHash !== undefined ? message.genesisHash : new Uint8Array(),
      ));
    message.binaryHash !== undefined
      && (obj.binaryHash = base64FromBytes(message.binaryHash !== undefined ? message.binaryHash : new Uint8Array()));
    message.spawnTime !== undefined && (obj.spawnTime = message.spawnTime.toISOString());
    message.lockUnbondingOnTimeout !== undefined && (obj.lockUnbondingOnTimeout = message.lockUnbondingOnTimeout);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ConsumerAdditionProposal>, I>>(object: I): ConsumerAdditionProposal {
    const message = createBaseConsumerAdditionProposal();
    message.title = object.title ?? "";
    message.description = object.description ?? "";
    message.chainId = object.chainId ?? "";
    message.initialHeight = (object.initialHeight !== undefined && object.initialHeight !== null)
      ? Height.fromPartial(object.initialHeight)
      : undefined;
    message.genesisHash = object.genesisHash ?? new Uint8Array();
    message.binaryHash = object.binaryHash ?? new Uint8Array();
    message.spawnTime = object.spawnTime ?? undefined;
    message.lockUnbondingOnTimeout = object.lockUnbondingOnTimeout ?? false;
    return message;
  },
};

function createBaseConsumerRemovalProposal(): ConsumerRemovalProposal {
  return { title: "", description: "", chainId: "", stopTime: undefined };
}

export const ConsumerRemovalProposal = {
  encode(message: ConsumerRemovalProposal, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.title !== "") {
      writer.uint32(10).string(message.title);
    }
    if (message.description !== "") {
      writer.uint32(18).string(message.description);
    }
    if (message.chainId !== "") {
      writer.uint32(26).string(message.chainId);
    }
    if (message.stopTime !== undefined) {
      Timestamp.encode(toTimestamp(message.stopTime), writer.uint32(34).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsumerRemovalProposal {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsumerRemovalProposal();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.title = reader.string();
          break;
        case 2:
          message.description = reader.string();
          break;
        case 3:
          message.chainId = reader.string();
          break;
        case 4:
          message.stopTime = fromTimestamp(Timestamp.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsumerRemovalProposal {
    return {
      title: isSet(object.title) ? String(object.title) : "",
      description: isSet(object.description) ? String(object.description) : "",
      chainId: isSet(object.chainId) ? String(object.chainId) : "",
      stopTime: isSet(object.stopTime) ? fromJsonTimestamp(object.stopTime) : undefined,
    };
  },

  toJSON(message: ConsumerRemovalProposal): unknown {
    const obj: any = {};
    message.title !== undefined && (obj.title = message.title);
    message.description !== undefined && (obj.description = message.description);
    message.chainId !== undefined && (obj.chainId = message.chainId);
    message.stopTime !== undefined && (obj.stopTime = message.stopTime.toISOString());
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ConsumerRemovalProposal>, I>>(object: I): ConsumerRemovalProposal {
    const message = createBaseConsumerRemovalProposal();
    message.title = object.title ?? "";
    message.description = object.description ?? "";
    message.chainId = object.chainId ?? "";
    message.stopTime = object.stopTime ?? undefined;
    return message;
  },
};

function createBaseParams(): Params {
  return {
    templateClient: undefined,
    trustingPeriodFraction: 0,
    ccvTimeoutPeriod: undefined,
    initTimeoutPeriod: undefined,
    vscTimeoutPeriod: undefined,
  };
}

export const Params = {
  encode(message: Params, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.templateClient !== undefined) {
      ClientState.encode(message.templateClient, writer.uint32(10).fork()).ldelim();
    }
    if (message.trustingPeriodFraction !== 0) {
      writer.uint32(16).int64(message.trustingPeriodFraction);
    }
    if (message.ccvTimeoutPeriod !== undefined) {
      Duration.encode(message.ccvTimeoutPeriod, writer.uint32(26).fork()).ldelim();
    }
    if (message.initTimeoutPeriod !== undefined) {
      Duration.encode(message.initTimeoutPeriod, writer.uint32(34).fork()).ldelim();
    }
    if (message.vscTimeoutPeriod !== undefined) {
      Duration.encode(message.vscTimeoutPeriod, writer.uint32(42).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): Params {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseParams();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.templateClient = ClientState.decode(reader, reader.uint32());
          break;
        case 2:
          message.trustingPeriodFraction = longToNumber(reader.int64() as Long);
          break;
        case 3:
          message.ccvTimeoutPeriod = Duration.decode(reader, reader.uint32());
          break;
        case 4:
          message.initTimeoutPeriod = Duration.decode(reader, reader.uint32());
          break;
        case 5:
          message.vscTimeoutPeriod = Duration.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): Params {
    return {
      templateClient: isSet(object.templateClient) ? ClientState.fromJSON(object.templateClient) : undefined,
      trustingPeriodFraction: isSet(object.trustingPeriodFraction) ? Number(object.trustingPeriodFraction) : 0,
      ccvTimeoutPeriod: isSet(object.ccvTimeoutPeriod) ? Duration.fromJSON(object.ccvTimeoutPeriod) : undefined,
      initTimeoutPeriod: isSet(object.initTimeoutPeriod) ? Duration.fromJSON(object.initTimeoutPeriod) : undefined,
      vscTimeoutPeriod: isSet(object.vscTimeoutPeriod) ? Duration.fromJSON(object.vscTimeoutPeriod) : undefined,
    };
  },

  toJSON(message: Params): unknown {
    const obj: any = {};
    message.templateClient !== undefined
      && (obj.templateClient = message.templateClient ? ClientState.toJSON(message.templateClient) : undefined);
    message.trustingPeriodFraction !== undefined
      && (obj.trustingPeriodFraction = Math.round(message.trustingPeriodFraction));
    message.ccvTimeoutPeriod !== undefined
      && (obj.ccvTimeoutPeriod = message.ccvTimeoutPeriod ? Duration.toJSON(message.ccvTimeoutPeriod) : undefined);
    message.initTimeoutPeriod !== undefined
      && (obj.initTimeoutPeriod = message.initTimeoutPeriod ? Duration.toJSON(message.initTimeoutPeriod) : undefined);
    message.vscTimeoutPeriod !== undefined
      && (obj.vscTimeoutPeriod = message.vscTimeoutPeriod ? Duration.toJSON(message.vscTimeoutPeriod) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<Params>, I>>(object: I): Params {
    const message = createBaseParams();
    message.templateClient = (object.templateClient !== undefined && object.templateClient !== null)
      ? ClientState.fromPartial(object.templateClient)
      : undefined;
    message.trustingPeriodFraction = object.trustingPeriodFraction ?? 0;
    message.ccvTimeoutPeriod = (object.ccvTimeoutPeriod !== undefined && object.ccvTimeoutPeriod !== null)
      ? Duration.fromPartial(object.ccvTimeoutPeriod)
      : undefined;
    message.initTimeoutPeriod = (object.initTimeoutPeriod !== undefined && object.initTimeoutPeriod !== null)
      ? Duration.fromPartial(object.initTimeoutPeriod)
      : undefined;
    message.vscTimeoutPeriod = (object.vscTimeoutPeriod !== undefined && object.vscTimeoutPeriod !== null)
      ? Duration.fromPartial(object.vscTimeoutPeriod)
      : undefined;
    return message;
  },
};

function createBaseHandshakeMetadata(): HandshakeMetadata {
  return { providerFeePoolAddr: "", version: "" };
}

export const HandshakeMetadata = {
  encode(message: HandshakeMetadata, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.providerFeePoolAddr !== "") {
      writer.uint32(10).string(message.providerFeePoolAddr);
    }
    if (message.version !== "") {
      writer.uint32(18).string(message.version);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): HandshakeMetadata {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseHandshakeMetadata();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.providerFeePoolAddr = reader.string();
          break;
        case 2:
          message.version = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): HandshakeMetadata {
    return {
      providerFeePoolAddr: isSet(object.providerFeePoolAddr) ? String(object.providerFeePoolAddr) : "",
      version: isSet(object.version) ? String(object.version) : "",
    };
  },

  toJSON(message: HandshakeMetadata): unknown {
    const obj: any = {};
    message.providerFeePoolAddr !== undefined && (obj.providerFeePoolAddr = message.providerFeePoolAddr);
    message.version !== undefined && (obj.version = message.version);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<HandshakeMetadata>, I>>(object: I): HandshakeMetadata {
    const message = createBaseHandshakeMetadata();
    message.providerFeePoolAddr = object.providerFeePoolAddr ?? "";
    message.version = object.version ?? "";
    return message;
  },
};

function createBaseSlashAcks(): SlashAcks {
  return { addresses: [] };
}

export const SlashAcks = {
  encode(message: SlashAcks, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.addresses) {
      writer.uint32(10).string(v!);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): SlashAcks {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseSlashAcks();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.addresses.push(reader.string());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): SlashAcks {
    return { addresses: Array.isArray(object?.addresses) ? object.addresses.map((e: any) => String(e)) : [] };
  },

  toJSON(message: SlashAcks): unknown {
    const obj: any = {};
    if (message.addresses) {
      obj.addresses = message.addresses.map((e) => e);
    } else {
      obj.addresses = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<SlashAcks>, I>>(object: I): SlashAcks {
    const message = createBaseSlashAcks();
    message.addresses = object.addresses?.map((e) => e) || [];
    return message;
  },
};

function createBaseConsumerAdditionProposals(): ConsumerAdditionProposals {
  return { pending: [] };
}

export const ConsumerAdditionProposals = {
  encode(message: ConsumerAdditionProposals, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.pending) {
      ConsumerAdditionProposal.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsumerAdditionProposals {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsumerAdditionProposals();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pending.push(ConsumerAdditionProposal.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsumerAdditionProposals {
    return {
      pending: Array.isArray(object?.pending)
        ? object.pending.map((e: any) => ConsumerAdditionProposal.fromJSON(e))
        : [],
    };
  },

  toJSON(message: ConsumerAdditionProposals): unknown {
    const obj: any = {};
    if (message.pending) {
      obj.pending = message.pending.map((e) => e ? ConsumerAdditionProposal.toJSON(e) : undefined);
    } else {
      obj.pending = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ConsumerAdditionProposals>, I>>(object: I): ConsumerAdditionProposals {
    const message = createBaseConsumerAdditionProposals();
    message.pending = object.pending?.map((e) => ConsumerAdditionProposal.fromPartial(e)) || [];
    return message;
  },
};

function createBaseConsumerRemovalProposals(): ConsumerRemovalProposals {
  return { pending: [] };
}

export const ConsumerRemovalProposals = {
  encode(message: ConsumerRemovalProposals, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    for (const v of message.pending) {
      ConsumerRemovalProposal.encode(v!, writer.uint32(10).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsumerRemovalProposals {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsumerRemovalProposals();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.pending.push(ConsumerRemovalProposal.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsumerRemovalProposals {
    return {
      pending: Array.isArray(object?.pending)
        ? object.pending.map((e: any) => ConsumerRemovalProposal.fromJSON(e))
        : [],
    };
  },

  toJSON(message: ConsumerRemovalProposals): unknown {
    const obj: any = {};
    if (message.pending) {
      obj.pending = message.pending.map((e) => e ? ConsumerRemovalProposal.toJSON(e) : undefined);
    } else {
      obj.pending = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ConsumerRemovalProposals>, I>>(object: I): ConsumerRemovalProposals {
    const message = createBaseConsumerRemovalProposals();
    message.pending = object.pending?.map((e) => ConsumerRemovalProposal.fromPartial(e)) || [];
    return message;
  },
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

function bytesFromBase64(b64: string): Uint8Array {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

function toTimestamp(date: Date): Timestamp {
  const seconds = date.getTime() / 1_000;
  const nanos = (date.getTime() % 1_000) * 1_000_000;
  return { seconds, nanos };
}

function fromTimestamp(t: Timestamp): Date {
  let millis = t.seconds * 1_000;
  millis += t.nanos / 1_000_000;
  return new Date(millis);
}

function fromJsonTimestamp(o: any): Date {
  if (o instanceof Date) {
    return o;
  } else if (typeof o === "string") {
    return new Date(o);
  } else {
    return fromTimestamp(Timestamp.fromJSON(o));
  }
}

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
