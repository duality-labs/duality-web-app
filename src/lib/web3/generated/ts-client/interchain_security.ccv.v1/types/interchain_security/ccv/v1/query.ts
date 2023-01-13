/* eslint-disable */
/* tslint:disable */
export const protobufPackage = "interchain_security.ccv.v1";

/** Query defines the gRPC querier service. */
export interface Query {
}

export class QueryClientImpl implements Query {
  private readonly rpc: Rpc;
  constructor(rpc: Rpc) {
    this.rpc = rpc;
  }
}

interface Rpc {
  request(service: string, method: string, data: Uint8Array): Promise<Uint8Array>;
}
