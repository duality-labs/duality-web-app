/* eslint-disable */
/* tslint:disable */
import Long from "long";
import _m0 from "protobufjs/minimal";
import { GenesisState as GenesisState1 } from "../../consumer/v1/genesis";
import { MaturedUnbondingOps, UnbondingOp, ValidatorSetChangePacketData } from "../../v1/ccv";
import { ConsumerAdditionProposal, ConsumerRemovalProposal, Params } from "./provider";

export const protobufPackage = "interchain_security.ccv.provider.v1";

/** GenesisState defines the CCV provider chain genesis state */
export interface GenesisState {
  /** empty for a new chain */
  valsetUpdateId: number;
  /** empty for a new chain */
  consumerStates: ConsumerState[];
  /** empty for a new chain */
  unbondingOps: UnbondingOp[];
  /** empty for a new chain */
  matureUnbondingOps:
    | MaturedUnbondingOps
    | undefined;
  /** empty for a new chain */
  valsetUpdateIdToHeight: ValsetUpdateIdToHeight[];
  /** empty for a new chain */
  consumerAdditionProposals: ConsumerAdditionProposal[];
  /** empty for a new chain */
  consumerRemovalProposals: ConsumerRemovalProposal[];
  params: Params | undefined;
}

/** consumer chain */
export interface ConsumerState {
  /** ChannelID defines the chain ID for the consumer chain */
  chainId: string;
  /** ChannelID defines the IBC channel ID for the consumer chain */
  channelId: string;
  /** ClientID defines the IBC client ID for the consumer chain */
  clientId: string;
  /** InitalHeight defines the initial block height for the consumer chain */
  initialHeight: number;
  /**
   * LockUnbondingOnTimeout defines whether the unbonding funds should be released for this
   * chain in case of a IBC channel timeout
   */
  lockUnbondingOnTimeout: boolean;
  /** ConsumerGenesis defines the initial consumer chain genesis states */
  consumerGenesis:
    | GenesisState1
    | undefined;
  /** PendingValsetChanges defines the pending validator set changes for the consumer chain */
  pendingValsetChanges: ValidatorSetChangePacketData[];
  slashDowntimeAck: string[];
  /** UnbondingOpsIndex defines the unbonding operations on the consumer chain */
  unbondingOpsIndex: UnbondingOpIndex[];
}

/**
 * UnbondingOpIndex defines the genesis information for each unbonding operations index
 * referenced by chain id and valset udpate id
 */
export interface UnbondingOpIndex {
  valsetUpdateId: number;
  unbondingOpIndex: number[];
}

/**
 * ValsetUpdateIdToHeight defines the genesis information for the mapping
 * of each valset udpate id to a block height
 */
export interface ValsetUpdateIdToHeight {
  valsetUpdateId: number;
  height: number;
}

function createBaseGenesisState(): GenesisState {
  return {
    valsetUpdateId: 0,
    consumerStates: [],
    unbondingOps: [],
    matureUnbondingOps: undefined,
    valsetUpdateIdToHeight: [],
    consumerAdditionProposals: [],
    consumerRemovalProposals: [],
    params: undefined,
  };
}

export const GenesisState = {
  encode(message: GenesisState, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.valsetUpdateId !== 0) {
      writer.uint32(8).uint64(message.valsetUpdateId);
    }
    for (const v of message.consumerStates) {
      ConsumerState.encode(v!, writer.uint32(18).fork()).ldelim();
    }
    for (const v of message.unbondingOps) {
      UnbondingOp.encode(v!, writer.uint32(26).fork()).ldelim();
    }
    if (message.matureUnbondingOps !== undefined) {
      MaturedUnbondingOps.encode(message.matureUnbondingOps, writer.uint32(34).fork()).ldelim();
    }
    for (const v of message.valsetUpdateIdToHeight) {
      ValsetUpdateIdToHeight.encode(v!, writer.uint32(42).fork()).ldelim();
    }
    for (const v of message.consumerAdditionProposals) {
      ConsumerAdditionProposal.encode(v!, writer.uint32(50).fork()).ldelim();
    }
    for (const v of message.consumerRemovalProposals) {
      ConsumerRemovalProposal.encode(v!, writer.uint32(58).fork()).ldelim();
    }
    if (message.params !== undefined) {
      Params.encode(message.params, writer.uint32(66).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): GenesisState {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseGenesisState();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.valsetUpdateId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.consumerStates.push(ConsumerState.decode(reader, reader.uint32()));
          break;
        case 3:
          message.unbondingOps.push(UnbondingOp.decode(reader, reader.uint32()));
          break;
        case 4:
          message.matureUnbondingOps = MaturedUnbondingOps.decode(reader, reader.uint32());
          break;
        case 5:
          message.valsetUpdateIdToHeight.push(ValsetUpdateIdToHeight.decode(reader, reader.uint32()));
          break;
        case 6:
          message.consumerAdditionProposals.push(ConsumerAdditionProposal.decode(reader, reader.uint32()));
          break;
        case 7:
          message.consumerRemovalProposals.push(ConsumerRemovalProposal.decode(reader, reader.uint32()));
          break;
        case 8:
          message.params = Params.decode(reader, reader.uint32());
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): GenesisState {
    return {
      valsetUpdateId: isSet(object.valsetUpdateId) ? Number(object.valsetUpdateId) : 0,
      consumerStates: Array.isArray(object?.consumerStates)
        ? object.consumerStates.map((e: any) => ConsumerState.fromJSON(e))
        : [],
      unbondingOps: Array.isArray(object?.unbondingOps)
        ? object.unbondingOps.map((e: any) => UnbondingOp.fromJSON(e))
        : [],
      matureUnbondingOps: isSet(object.matureUnbondingOps)
        ? MaturedUnbondingOps.fromJSON(object.matureUnbondingOps)
        : undefined,
      valsetUpdateIdToHeight: Array.isArray(object?.valsetUpdateIdToHeight)
        ? object.valsetUpdateIdToHeight.map((e: any) => ValsetUpdateIdToHeight.fromJSON(e))
        : [],
      consumerAdditionProposals: Array.isArray(object?.consumerAdditionProposals)
        ? object.consumerAdditionProposals.map((e: any) => ConsumerAdditionProposal.fromJSON(e))
        : [],
      consumerRemovalProposals: Array.isArray(object?.consumerRemovalProposals)
        ? object.consumerRemovalProposals.map((e: any) => ConsumerRemovalProposal.fromJSON(e))
        : [],
      params: isSet(object.params) ? Params.fromJSON(object.params) : undefined,
    };
  },

  toJSON(message: GenesisState): unknown {
    const obj: any = {};
    message.valsetUpdateId !== undefined && (obj.valsetUpdateId = Math.round(message.valsetUpdateId));
    if (message.consumerStates) {
      obj.consumerStates = message.consumerStates.map((e) => e ? ConsumerState.toJSON(e) : undefined);
    } else {
      obj.consumerStates = [];
    }
    if (message.unbondingOps) {
      obj.unbondingOps = message.unbondingOps.map((e) => e ? UnbondingOp.toJSON(e) : undefined);
    } else {
      obj.unbondingOps = [];
    }
    message.matureUnbondingOps !== undefined && (obj.matureUnbondingOps = message.matureUnbondingOps
      ? MaturedUnbondingOps.toJSON(message.matureUnbondingOps)
      : undefined);
    if (message.valsetUpdateIdToHeight) {
      obj.valsetUpdateIdToHeight = message.valsetUpdateIdToHeight.map((e) =>
        e ? ValsetUpdateIdToHeight.toJSON(e) : undefined
      );
    } else {
      obj.valsetUpdateIdToHeight = [];
    }
    if (message.consumerAdditionProposals) {
      obj.consumerAdditionProposals = message.consumerAdditionProposals.map((e) =>
        e ? ConsumerAdditionProposal.toJSON(e) : undefined
      );
    } else {
      obj.consumerAdditionProposals = [];
    }
    if (message.consumerRemovalProposals) {
      obj.consumerRemovalProposals = message.consumerRemovalProposals.map((e) =>
        e ? ConsumerRemovalProposal.toJSON(e) : undefined
      );
    } else {
      obj.consumerRemovalProposals = [];
    }
    message.params !== undefined && (obj.params = message.params ? Params.toJSON(message.params) : undefined);
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<GenesisState>, I>>(object: I): GenesisState {
    const message = createBaseGenesisState();
    message.valsetUpdateId = object.valsetUpdateId ?? 0;
    message.consumerStates = object.consumerStates?.map((e) => ConsumerState.fromPartial(e)) || [];
    message.unbondingOps = object.unbondingOps?.map((e) => UnbondingOp.fromPartial(e)) || [];
    message.matureUnbondingOps = (object.matureUnbondingOps !== undefined && object.matureUnbondingOps !== null)
      ? MaturedUnbondingOps.fromPartial(object.matureUnbondingOps)
      : undefined;
    message.valsetUpdateIdToHeight = object.valsetUpdateIdToHeight?.map((e) => ValsetUpdateIdToHeight.fromPartial(e))
      || [];
    message.consumerAdditionProposals =
      object.consumerAdditionProposals?.map((e) => ConsumerAdditionProposal.fromPartial(e)) || [];
    message.consumerRemovalProposals =
      object.consumerRemovalProposals?.map((e) => ConsumerRemovalProposal.fromPartial(e)) || [];
    message.params = (object.params !== undefined && object.params !== null)
      ? Params.fromPartial(object.params)
      : undefined;
    return message;
  },
};

function createBaseConsumerState(): ConsumerState {
  return {
    chainId: "",
    channelId: "",
    clientId: "",
    initialHeight: 0,
    lockUnbondingOnTimeout: false,
    consumerGenesis: undefined,
    pendingValsetChanges: [],
    slashDowntimeAck: [],
    unbondingOpsIndex: [],
  };
}

export const ConsumerState = {
  encode(message: ConsumerState, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.chainId !== "") {
      writer.uint32(10).string(message.chainId);
    }
    if (message.channelId !== "") {
      writer.uint32(18).string(message.channelId);
    }
    if (message.clientId !== "") {
      writer.uint32(26).string(message.clientId);
    }
    if (message.initialHeight !== 0) {
      writer.uint32(32).uint64(message.initialHeight);
    }
    if (message.lockUnbondingOnTimeout === true) {
      writer.uint32(40).bool(message.lockUnbondingOnTimeout);
    }
    if (message.consumerGenesis !== undefined) {
      GenesisState1.encode(message.consumerGenesis, writer.uint32(50).fork()).ldelim();
    }
    for (const v of message.pendingValsetChanges) {
      ValidatorSetChangePacketData.encode(v!, writer.uint32(58).fork()).ldelim();
    }
    for (const v of message.slashDowntimeAck) {
      writer.uint32(66).string(v!);
    }
    for (const v of message.unbondingOpsIndex) {
      UnbondingOpIndex.encode(v!, writer.uint32(74).fork()).ldelim();
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ConsumerState {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseConsumerState();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.chainId = reader.string();
          break;
        case 2:
          message.channelId = reader.string();
          break;
        case 3:
          message.clientId = reader.string();
          break;
        case 4:
          message.initialHeight = longToNumber(reader.uint64() as Long);
          break;
        case 5:
          message.lockUnbondingOnTimeout = reader.bool();
          break;
        case 6:
          message.consumerGenesis = GenesisState1.decode(reader, reader.uint32());
          break;
        case 7:
          message.pendingValsetChanges.push(ValidatorSetChangePacketData.decode(reader, reader.uint32()));
          break;
        case 8:
          message.slashDowntimeAck.push(reader.string());
          break;
        case 9:
          message.unbondingOpsIndex.push(UnbondingOpIndex.decode(reader, reader.uint32()));
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ConsumerState {
    return {
      chainId: isSet(object.chainId) ? String(object.chainId) : "",
      channelId: isSet(object.channelId) ? String(object.channelId) : "",
      clientId: isSet(object.clientId) ? String(object.clientId) : "",
      initialHeight: isSet(object.initialHeight) ? Number(object.initialHeight) : 0,
      lockUnbondingOnTimeout: isSet(object.lockUnbondingOnTimeout) ? Boolean(object.lockUnbondingOnTimeout) : false,
      consumerGenesis: isSet(object.consumerGenesis) ? GenesisState1.fromJSON(object.consumerGenesis) : undefined,
      pendingValsetChanges: Array.isArray(object?.pendingValsetChanges)
        ? object.pendingValsetChanges.map((e: any) => ValidatorSetChangePacketData.fromJSON(e))
        : [],
      slashDowntimeAck: Array.isArray(object?.slashDowntimeAck)
        ? object.slashDowntimeAck.map((e: any) => String(e))
        : [],
      unbondingOpsIndex: Array.isArray(object?.unbondingOpsIndex)
        ? object.unbondingOpsIndex.map((e: any) => UnbondingOpIndex.fromJSON(e))
        : [],
    };
  },

  toJSON(message: ConsumerState): unknown {
    const obj: any = {};
    message.chainId !== undefined && (obj.chainId = message.chainId);
    message.channelId !== undefined && (obj.channelId = message.channelId);
    message.clientId !== undefined && (obj.clientId = message.clientId);
    message.initialHeight !== undefined && (obj.initialHeight = Math.round(message.initialHeight));
    message.lockUnbondingOnTimeout !== undefined && (obj.lockUnbondingOnTimeout = message.lockUnbondingOnTimeout);
    message.consumerGenesis !== undefined
      && (obj.consumerGenesis = message.consumerGenesis ? GenesisState1.toJSON(message.consumerGenesis) : undefined);
    if (message.pendingValsetChanges) {
      obj.pendingValsetChanges = message.pendingValsetChanges.map((e) =>
        e ? ValidatorSetChangePacketData.toJSON(e) : undefined
      );
    } else {
      obj.pendingValsetChanges = [];
    }
    if (message.slashDowntimeAck) {
      obj.slashDowntimeAck = message.slashDowntimeAck.map((e) => e);
    } else {
      obj.slashDowntimeAck = [];
    }
    if (message.unbondingOpsIndex) {
      obj.unbondingOpsIndex = message.unbondingOpsIndex.map((e) => e ? UnbondingOpIndex.toJSON(e) : undefined);
    } else {
      obj.unbondingOpsIndex = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ConsumerState>, I>>(object: I): ConsumerState {
    const message = createBaseConsumerState();
    message.chainId = object.chainId ?? "";
    message.channelId = object.channelId ?? "";
    message.clientId = object.clientId ?? "";
    message.initialHeight = object.initialHeight ?? 0;
    message.lockUnbondingOnTimeout = object.lockUnbondingOnTimeout ?? false;
    message.consumerGenesis = (object.consumerGenesis !== undefined && object.consumerGenesis !== null)
      ? GenesisState1.fromPartial(object.consumerGenesis)
      : undefined;
    message.pendingValsetChanges = object.pendingValsetChanges?.map((e) => ValidatorSetChangePacketData.fromPartial(e))
      || [];
    message.slashDowntimeAck = object.slashDowntimeAck?.map((e) => e) || [];
    message.unbondingOpsIndex = object.unbondingOpsIndex?.map((e) => UnbondingOpIndex.fromPartial(e)) || [];
    return message;
  },
};

function createBaseUnbondingOpIndex(): UnbondingOpIndex {
  return { valsetUpdateId: 0, unbondingOpIndex: [] };
}

export const UnbondingOpIndex = {
  encode(message: UnbondingOpIndex, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.valsetUpdateId !== 0) {
      writer.uint32(8).uint64(message.valsetUpdateId);
    }
    writer.uint32(18).fork();
    for (const v of message.unbondingOpIndex) {
      writer.uint64(v);
    }
    writer.ldelim();
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): UnbondingOpIndex {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseUnbondingOpIndex();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.valsetUpdateId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          if ((tag & 7) === 2) {
            const end2 = reader.uint32() + reader.pos;
            while (reader.pos < end2) {
              message.unbondingOpIndex.push(longToNumber(reader.uint64() as Long));
            }
          } else {
            message.unbondingOpIndex.push(longToNumber(reader.uint64() as Long));
          }
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): UnbondingOpIndex {
    return {
      valsetUpdateId: isSet(object.valsetUpdateId) ? Number(object.valsetUpdateId) : 0,
      unbondingOpIndex: Array.isArray(object?.unbondingOpIndex)
        ? object.unbondingOpIndex.map((e: any) => Number(e))
        : [],
    };
  },

  toJSON(message: UnbondingOpIndex): unknown {
    const obj: any = {};
    message.valsetUpdateId !== undefined && (obj.valsetUpdateId = Math.round(message.valsetUpdateId));
    if (message.unbondingOpIndex) {
      obj.unbondingOpIndex = message.unbondingOpIndex.map((e) => Math.round(e));
    } else {
      obj.unbondingOpIndex = [];
    }
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<UnbondingOpIndex>, I>>(object: I): UnbondingOpIndex {
    const message = createBaseUnbondingOpIndex();
    message.valsetUpdateId = object.valsetUpdateId ?? 0;
    message.unbondingOpIndex = object.unbondingOpIndex?.map((e) => e) || [];
    return message;
  },
};

function createBaseValsetUpdateIdToHeight(): ValsetUpdateIdToHeight {
  return { valsetUpdateId: 0, height: 0 };
}

export const ValsetUpdateIdToHeight = {
  encode(message: ValsetUpdateIdToHeight, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.valsetUpdateId !== 0) {
      writer.uint32(8).uint64(message.valsetUpdateId);
    }
    if (message.height !== 0) {
      writer.uint32(16).uint64(message.height);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): ValsetUpdateIdToHeight {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseValsetUpdateIdToHeight();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.valsetUpdateId = longToNumber(reader.uint64() as Long);
          break;
        case 2:
          message.height = longToNumber(reader.uint64() as Long);
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },

  fromJSON(object: any): ValsetUpdateIdToHeight {
    return {
      valsetUpdateId: isSet(object.valsetUpdateId) ? Number(object.valsetUpdateId) : 0,
      height: isSet(object.height) ? Number(object.height) : 0,
    };
  },

  toJSON(message: ValsetUpdateIdToHeight): unknown {
    const obj: any = {};
    message.valsetUpdateId !== undefined && (obj.valsetUpdateId = Math.round(message.valsetUpdateId));
    message.height !== undefined && (obj.height = Math.round(message.height));
    return obj;
  },

  fromPartial<I extends Exact<DeepPartial<ValsetUpdateIdToHeight>, I>>(object: I): ValsetUpdateIdToHeight {
    const message = createBaseValsetUpdateIdToHeight();
    message.valsetUpdateId = object.valsetUpdateId ?? 0;
    message.height = object.height ?? 0;
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

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;

export type DeepPartial<T> = T extends Builtin ? T
  : T extends Array<infer U> ? Array<DeepPartial<U>> : T extends ReadonlyArray<infer U> ? ReadonlyArray<DeepPartial<U>>
  : T extends {} ? { [K in keyof T]?: DeepPartial<T[K]> }
  : Partial<T>;

type KeysOfUnion<T> = T extends T ? keyof T : never;
export type Exact<P, I extends P> = P extends Builtin ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

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
