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

/** Msg defines the Msg service. */
export interface Msg {
  /** this line is used by starport scaffolding # proto/tx/rpc */
  Send(request: MsgSend): Promise<MsgSendResponse>;
}

export interface MsgSend {
  creator: string;
  amountIn: string;
  tokenIn: string;
}

export interface MsgSendResponse {
}

interface Rpc {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}

export const protobufPackage = "nicholasdotsol.duality.mev";

function createBaseMsgSend(): MsgSend {
  return { amountIn: "", creator: "", tokenIn: "" };
}

export const MsgSend = {

  decode(input: _m0.Reader | Uint8Array, length?: number): MsgSend {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgSend();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          message.creator = reader.string();
          break;
        case 2:
          message.amountIn = reader.string();
          break;
        case 3:
          message.tokenIn = reader.string();
          break;
        default:
          reader.skipType(tag & 7);
          break;
      }
    }
    return message;
  },
  encode(message: MsgSend, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.creator !== "") {
      writer.uint32(10).string(message.creator);
    }
    if (message.amountIn !== "") {
      writer.uint32(18).string(message.amountIn);
    }
    if (message.tokenIn !== "") {
      writer.uint32(26).string(message.tokenIn);
    }
    return writer;
  },

  fromJSON(object: any): MsgSend {
    return {

          amountIn: isSet(object.amountIn) ? String(object.amountIn) : "",
          creator: isSet(object.creator) ? String(object.creator) : "",
          tokenIn: isSet(object.tokenIn) ? String(object.tokenIn) : ""
        };
  },

  fromPartial<I extends Exact<DeepPartial<MsgSend>, I>>(object: I): MsgSend {
    const message = createBaseMsgSend();
    message.creator = object.creator ?? "";
    message.amountIn = object.amountIn ?? "";
    message.tokenIn = object.tokenIn ?? "";
    return message;
  },

  toJSON(message: MsgSend): unknown {
    const obj: any = {};
    message.creator !== undefined && (obj.creator = message.creator);
    message.amountIn !== undefined && (obj.amountIn = message.amountIn);
    message.tokenIn !== undefined && (obj.tokenIn = message.tokenIn);
    return obj;
  }
};

function createBaseMsgSendResponse(): MsgSendResponse {
  return {};
}

export const MsgSendResponse = {

  decode(input: _m0.Reader | Uint8Array, length?: number): MsgSendResponse {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgSendResponse();
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
  encode(_: MsgSendResponse, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    return writer;
  },

  fromJSON(_: any): MsgSendResponse {
    return {};
  },

  fromPartial<I extends Exact<DeepPartial<MsgSendResponse>, I>>(_: I): MsgSendResponse {
    const message = createBaseMsgSendResponse();
    return message;
  },

  toJSON(_: MsgSendResponse): unknown {
    const obj: any = {};
    return obj;
  }
};

export class MsgClientImpl implements Msg {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
    this.Send = this.Send.bind(this);
  }
  Send(request: MsgSend): Promise<MsgSendResponse> {
    const data = MsgSend.encode(request).finish();
    const promise = this.rpc.request("nicholasdotsol.duality.mev.Msg", "Send", data);
    return promise.then((data) => MsgSendResponse.decode(new _m0.Reader(data)));
  }
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}
