/* eslint-disable */
/* tslint:disable */
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

export interface AbciValidatorUpdate {
  pub_key?: CryptoPublicKey;

  /** @format int64 */
  power?: string;
}

export interface Ccvconsumerv1GenesisState {
  params?: Ccvconsumerv1Params;

  /** empty for a completely new chain */
  provider_client_id?: string;

  /** empty for a completely new chain */
  provider_channel_id?: string;

  /** true for new chain GenesisState, false for chain restart. */
  new_chain?: boolean;

  /** ProviderClientState filled in on new chain, nil on restart. */
  provider_client_state?: V1ClientState;

  /** ProviderConsensusState filled in on new chain, nil on restart. */
  provider_consensus_state?: V1ConsensusState;

  /** MaturingPackets nil on new chain, filled on restart. */
  maturing_packets?: V1MaturingVSCPacket[];

  /** InitialValset filled in on new chain and on restart. */
  initial_val_set?: AbciValidatorUpdate[];

  /** HeightToValsetUpdateId nil on new chain, filled on restart. */
  height_to_valset_update_id?: V1HeightToValsetUpdateID[];

  /** OutstandingDowntimes nil on new chain, filled on restart. */
  outstanding_downtime_slashing?: V1OutstandingDowntime[];

  /** PendingSlashRequests filled in on new chain, nil on restart. */
  pending_slash_requests?: V1SlashRequests;
}

export interface Ccvconsumerv1Params {
  /**
   * TODO: Remove enabled flag and find a better way to setup e2e tests
   * See: https://github.com/cosmos/interchain-security/issues/339
   */
  enabled?: boolean;

  /**
   * /////////////////////
   * Distribution Params
   * Number of blocks between ibc-token-transfers from the consumer chain to
   * the provider chain. Note that at this transmission event a fraction of
   * the accumulated tokens are divided and sent consumer redistribution
   * address.
   * @format int64
   */
  blocks_per_distribution_transmission?: string;

  /**
   * Channel, and provider-chain receiving address to send distribution token
   * transfers over. These parameters is auto-set during the consumer <->
   * provider handshake procedure.
   */
  distribution_transmission_channel?: string;
  provider_fee_pool_addr_str?: string;

  /** Sent CCV related IBC packets will timeout after this duration */
  ccv_timeout_period?: string;

  /** Sent transfer related IBC packets will timeout after this duration */
  transfer_timeout_period?: string;

  /**
   * The fraction of tokens allocated to the consumer redistribution address
   * during distribution events. The fraction is a string representing a
   * decimal number. For example "0.75" would represent 75%.
   */
  consumer_redistribution_fraction?: string;

  /**
   * The number of historical info entries to persist in store.
   * This param is a part of the cosmos sdk staking module. In the case of
   * a ccv enabled consumer chain, the ccv module acts as the staking module.
   * @format int64
   */
  historical_entries?: string;

  /**
   * Unbonding period for the consumer,
   * which should be smaller than that of the provider in general.
   */
  unbonding_period?: string;
}

export interface CryptoPublicKey {
  /** @format byte */
  ed25519?: string;

  /** @format byte */
  secp256k1?: string;
}

export enum Ics23HashOp {
  NO_HASH = "NO_HASH",
  SHA256 = "SHA256",
  SHA512 = "SHA512",
  KECCAK = "KECCAK",
  RIPEMD160 = "RIPEMD160",
  BITCOIN = "BITCOIN",
  SHA512256 = "SHA512_256",
}

/**
* InnerSpec contains all store-specific structure info to determine if two proofs from a
given store are neighbors.

This enables:

isLeftMost(spec: InnerSpec, op: InnerOp)
isRightMost(spec: InnerSpec, op: InnerOp)
isLeftNeighbor(spec: InnerSpec, left: InnerOp, right: InnerOp)
*/
export interface Ics23InnerSpec {
  /**
   * Child order is the ordering of the children node, must count from 0
   * iavl tree is [0, 1] (left then right)
   * merk is [0, 2, 1] (left, right, here)
   */
  child_order?: number[];

  /** @format int32 */
  child_size?: number;

  /** @format int32 */
  min_prefix_length?: number;

  /** @format int32 */
  max_prefix_length?: number;

  /**
   * empty child is the prehash image that is used when one child is nil (eg. 20 bytes of 0)
   * @format byte
   */
  empty_child?: string;

  /** hash is the algorithm that must be used for each InnerOp */
  hash?: Ics23HashOp;
}

/**
* *
LeafOp represents the raw key-value data we wish to prove, and
must be flexible to represent the internal transformation from
the original key-value pairs into the basis hash, for many existing
merkle trees.

key and value are passed in. So that the signature of this operation is:
leafOp(key, value) -> output

To process this, first prehash the keys and values if needed (ANY means no hash in this case):
hkey = prehashKey(key)
hvalue = prehashValue(value)

Then combine the bytes, and hash it
output = hash(prefix || length(hkey) || hkey || length(hvalue) || hvalue)
*/
export interface Ics23LeafOp {
  hash?: Ics23HashOp;
  prehash_key?: Ics23HashOp;
  prehash_value?: Ics23HashOp;

  /**
   * - NO_PREFIX: NO_PREFIX don't include any length info
   *  - VAR_PROTO: VAR_PROTO uses protobuf (and go-amino) varint encoding of the length
   *  - VAR_RLP: VAR_RLP uses rlp int encoding of the length
   *  - FIXED32_BIG: FIXED32_BIG uses big-endian encoding of the length as a 32 bit integer
   *  - FIXED32_LITTLE: FIXED32_LITTLE uses little-endian encoding of the length as a 32 bit integer
   *  - FIXED64_BIG: FIXED64_BIG uses big-endian encoding of the length as a 64 bit integer
   *  - FIXED64_LITTLE: FIXED64_LITTLE uses little-endian encoding of the length as a 64 bit integer
   *  - REQUIRE_32_BYTES: REQUIRE_32_BYTES is like NONE, but will fail if the input is not exactly 32 bytes (sha256 output)
   *  - REQUIRE_64_BYTES: REQUIRE_64_BYTES is like NONE, but will fail if the input is not exactly 64 bytes (sha512 output)
   */
  length?: Ics23LengthOp;

  /**
   * prefix is a fixed bytes that may optionally be included at the beginning to differentiate
   * a leaf node from an inner node.
   * @format byte
   */
  prefix?: string;
}

/**
* - NO_PREFIX: NO_PREFIX don't include any length info
 - VAR_PROTO: VAR_PROTO uses protobuf (and go-amino) varint encoding of the length
 - VAR_RLP: VAR_RLP uses rlp int encoding of the length
 - FIXED32_BIG: FIXED32_BIG uses big-endian encoding of the length as a 32 bit integer
 - FIXED32_LITTLE: FIXED32_LITTLE uses little-endian encoding of the length as a 32 bit integer
 - FIXED64_BIG: FIXED64_BIG uses big-endian encoding of the length as a 64 bit integer
 - FIXED64_LITTLE: FIXED64_LITTLE uses little-endian encoding of the length as a 64 bit integer
 - REQUIRE_32_BYTES: REQUIRE_32_BYTES is like NONE, but will fail if the input is not exactly 32 bytes (sha256 output)
 - REQUIRE_64_BYTES: REQUIRE_64_BYTES is like NONE, but will fail if the input is not exactly 64 bytes (sha512 output)
*/
export enum Ics23LengthOp {
  NO_PREFIX = "NO_PREFIX",
  VAR_PROTO = "VAR_PROTO",
  VAR_RLP = "VAR_RLP",
  FIXED32BIG = "FIXED32_BIG",
  FIXED32LITTLE = "FIXED32_LITTLE",
  FIXED64BIG = "FIXED64_BIG",
  FIXED64LITTLE = "FIXED64_LITTLE",
  REQUIRE32BYTES = "REQUIRE_32_BYTES",
  REQUIRE64BYTES = "REQUIRE_64_BYTES",
}

/**
* *
ProofSpec defines what the expected parameters are for a given proof type.
This can be stored in the client and used to validate any incoming proofs.

verify(ProofSpec, Proof) -> Proof | Error

As demonstrated in tests, if we don't fix the algorithm used to calculate the
LeafHash for a given tree, there are many possible key-value pairs that can
generate a given hash (by interpretting the preimage differently).
We need this for proper security, requires client knows a priori what
tree format server uses. But not in code, rather a configuration object.
*/
export interface Ics23ProofSpec {
  /**
   * any field in the ExistenceProof must be the same as in this spec.
   * except Prefix, which is just the first bytes of prefix (spec can be longer)
   * *
   * LeafOp represents the raw key-value data we wish to prove, and
   * must be flexible to represent the internal transformation from
   * the original key-value pairs into the basis hash, for many existing
   * merkle trees.
   *
   * key and value are passed in. So that the signature of this operation is:
   * leafOp(key, value) -> output
   * To process this, first prehash the keys and values if needed (ANY means no hash in this case):
   * hkey = prehashKey(key)
   * hvalue = prehashValue(value)
   * Then combine the bytes, and hash it
   * output = hash(prefix || length(hkey) || hkey || length(hvalue) || hvalue)
   */
  leaf_spec?: Ics23LeafOp;

  /**
   * InnerSpec contains all store-specific structure info to determine if two proofs from a
   * given store are neighbors.
   *
   * This enables:
   * isLeftMost(spec: InnerSpec, op: InnerOp)
   * isRightMost(spec: InnerSpec, op: InnerOp)
   * isLeftNeighbor(spec: InnerSpec, left: InnerOp, right: InnerOp)
   */
  inner_spec?: Ics23InnerSpec;

  /**
   * max_depth (if > 0) is the maximum number of InnerOps allowed (mainly for fixed-depth tries)
   * @format int32
   */
  max_depth?: number;

  /**
   * min_depth (if > 0) is the minimum number of InnerOps allowed (mainly for fixed-depth tries)
   * @format int32
   */
  min_depth?: number;
}

/**
* `Any` contains an arbitrary serialized protocol buffer message along with a
URL that describes the type of the serialized message.

Protobuf library provides support to pack/unpack Any values in the form
of utility functions or additional generated methods of the Any type.

Example 1: Pack and unpack a message in C++.

    Foo foo = ...;
    Any any;
    any.PackFrom(foo);
    ...
    if (any.UnpackTo(&foo)) {
      ...
    }

Example 2: Pack and unpack a message in Java.

    Foo foo = ...;
    Any any = Any.pack(foo);
    ...
    if (any.is(Foo.class)) {
      foo = any.unpack(Foo.class);
    }

 Example 3: Pack and unpack a message in Python.

    foo = Foo(...)
    any = Any()
    any.Pack(foo)
    ...
    if any.Is(Foo.DESCRIPTOR):
      any.Unpack(foo)
      ...

 Example 4: Pack and unpack a message in Go

     foo := &pb.Foo{...}
     any, err := anypb.New(foo)
     if err != nil {
       ...
     }
     ...
     foo := &pb.Foo{}
     if err := any.UnmarshalTo(foo); err != nil {
       ...
     }

The pack methods provided by protobuf library will by default use
'type.googleapis.com/full.type.name' as the type URL and the unpack
methods only use the fully qualified type name after the last '/'
in the type URL, for example "foo.bar.com/x/y.z" will yield type
name "y.z".


JSON
====
The JSON representation of an `Any` value uses the regular
representation of the deserialized, embedded message, with an
additional field `@type` which contains the type URL. Example:

    package google.profile;
    message Person {
      string first_name = 1;
      string last_name = 2;
    }

    {
      "@type": "type.googleapis.com/google.profile.Person",
      "firstName": <string>,
      "lastName": <string>
    }

If the embedded message type is well-known and has a custom JSON
representation, that representation will be embedded adding a field
`value` which holds the custom JSON in addition to the `@type`
field. Example (for message [google.protobuf.Duration][]):

    {
      "@type": "type.googleapis.com/google.protobuf.Duration",
      "value": "1.212s"
    }
*/
export interface ProtobufAny {
  /**
   * A URL/resource name that uniquely identifies the type of the serialized
   * protocol buffer message. This string must contain at least
   * one "/" character. The last segment of the URL's path must represent
   * the fully qualified name of the type (as in
   * `path/google.protobuf.Duration`). The name should be in a canonical form
   * (e.g., leading "." is not accepted).
   *
   * In practice, teams usually precompile into the binary all types that they
   * expect it to use in the context of Any. However, for URLs which use the
   * scheme `http`, `https`, or no scheme, one can optionally set up a type
   * server that maps type URLs to message definitions as follows:
   * * If no scheme is provided, `https` is assumed.
   * * An HTTP GET on the URL must yield a [google.protobuf.Type][]
   *   value in binary format, or produce an error.
   * * Applications are allowed to cache lookup results based on the
   *   URL, or have them precompiled into a binary to avoid any
   *   lookup. Therefore, binary compatibility needs to be preserved
   *   on changes to types. (Use versioned type names to manage
   *   breaking changes.)
   * Note: this functionality is not currently available in the official
   * protobuf release, and it is not used for type URLs beginning with
   * type.googleapis.com.
   * Schemes other than `http`, `https` (or the empty scheme) might be
   * used with implementation specific semantics.
   */
  "@type"?: string;
}

export interface RpcStatus {
  /** @format int32 */
  code?: number;
  message?: string;
  details?: ProtobufAny[];
}

export interface TendermintabciValidator {
  /**
   * The first 20 bytes of SHA256(public key)
   * @format byte
   */
  address?: string;

  /**
   * PubKey pub_key = 2 [(gogoproto.nullable)=false];
   * The voting power
   * @format int64
   */
  power?: string;
}

export interface V1Chain {
  chain_id?: string;
  client_id?: string;
}

/**
* ClientState from Tendermint tracks the current validator set, latest height,
and a possible frozen height.
*/
export interface V1ClientState {
  chain_id?: string;

  /**
   * Fraction defines the protobuf message type for tmmath.Fraction that only
   * supports positive values.
   */
  trust_level?: V1Fraction;

  /**
   * duration of the period since the LastestTimestamp during which the
   * submitted headers are valid for upgrade
   */
  trusting_period?: string;

  /** duration of the staking unbonding period */
  unbonding_period?: string;

  /** defines how much new (untrusted) header's Time can drift into the future. */
  max_clock_drift?: string;

  /**
   * Block height when the client was frozen due to a misbehaviour
   * Normally the RevisionHeight is incremented at each height while keeping
   * RevisionNumber the same. However some consensus algorithms may choose to
   * reset the height in certain conditions e.g. hard forks, state-machine
   * breaking changes In these cases, the RevisionNumber is incremented so that
   * height continues to be monitonically increasing even as the RevisionHeight
   * gets reset
   */
  frozen_height?: V1Height;

  /**
   * Latest height the client was updated to
   * Normally the RevisionHeight is incremented at each height while keeping
   * RevisionNumber the same. However some consensus algorithms may choose to
   * reset the height in certain conditions e.g. hard forks, state-machine
   * breaking changes In these cases, the RevisionNumber is incremented so that
   * height continues to be monitonically increasing even as the RevisionHeight
   * gets reset
   */
  latest_height?: V1Height;

  /** Proof specifications used in verifying counterparty state */
  proof_specs?: Ics23ProofSpec[];

  /**
   * Path at which next upgraded client will be committed.
   * Each element corresponds to the key for a single CommitmentProof in the
   * chained proof. NOTE: ClientState must stored under
   * `{upgradePath}/{upgradeHeight}/clientState` ConsensusState must be stored
   * under `{upgradepath}/{upgradeHeight}/consensusState` For SDK chains using
   * the default upgrade module, upgrade_path should be []string{"upgrade",
   * "upgradedIBCState"}`
   */
  upgrade_path?: string[];

  /**
   * This flag, when set to true, will allow governance to recover a client
   * which has expired
   */
  allow_update_after_expiry?: boolean;

  /**
   * This flag, when set to true, will allow governance to unfreeze a client
   * whose chain has experienced a misbehaviour event
   */
  allow_update_after_misbehaviour?: boolean;
}

/**
 * ConsensusState defines the consensus state from Tendermint.
 */
export interface V1ConsensusState {
  /**
   * timestamp that corresponds to the block height in which the ConsensusState
   * was stored.
   * @format date-time
   */
  timestamp?: string;

  /**
   * commitment root (i.e app hash)
   * MerkleRoot defines a merkle root hash.
   * In the Cosmos SDK, the AppHash of a block header becomes the root.
   */
  root?: V1MerkleRoot;

  /** @format byte */
  next_validators_hash?: string;
}

/**
* ConsumerAdditionProposal is a governance proposal on the provider chain to spawn a new consumer chain.
If it passes, then all validators on the provider chain are expected to validate the consumer chain at spawn time
or get slashed. It is recommended that spawn time occurs after the proposal end time.
*/
export interface V1ConsumerAdditionProposal {
  /** the title of the proposal */
  title?: string;

  /** the description of the proposal */
  description?: string;

  /**
   * the proposed chain-id of the new consumer chain, must be different from all other consumer chain ids of the executing
   * provider chain.
   */
  chain_id?: string;

  /**
   * the proposed initial height of new consumer chain.
   * For a completely new chain, this will be {0,1}. However, it may be different if this is a chain that is converting to a consumer chain.
   */
  initial_height?: V1Height;

  /**
   * genesis hash with no staking information included.
   * @format byte
   */
  genesis_hash?: string;

  /**
   * binary hash is the hash of the binary that should be used by validators on chain initialization.
   * @format byte
   */
  binary_hash?: string;

  /**
   * spawn time is the time on the provider chain at which the consumer chain genesis is finalized and all validators
   * will be responsible for starting their consumer chain validator node.
   * @format date-time
   */
  spawn_time?: string;

  /**
   * Indicates whether the outstanding unbonding operations should be released
   * in case of a channel time-outs. When set to true, a governance proposal
   * on the provider chain would be necessary to release the locked funds.
   */
  lock_unbonding_on_timeout?: boolean;
}

/**
 * ConsumerAdditionProposals holds pending governance proposals on the provider chain to spawn a new chain.
 */
export interface V1ConsumerAdditionProposals {
  /** proposals waiting for spawn_time to pass */
  pending?: V1ConsumerAdditionProposal[];
}

/**
* ConsumerRemovalProposal is a governance proposal on the provider chain to remove (and stop) a consumer chain.
If it passes, all the consumer chain's state is removed from the provider chain. The outstanding unbonding
operation funds are released if the LockUnbondingOnTimeout parameter is set to false for the consumer chain ID.
*/
export interface V1ConsumerRemovalProposal {
  /** the title of the proposal */
  title?: string;

  /** the description of the proposal */
  description?: string;

  /** the chain-id of the consumer chain to be stopped */
  chain_id?: string;

  /**
   * the time on the provider chain at which all validators are responsible to stop their consumer chain validator node
   * @format date-time
   */
  stop_time?: string;
}

/**
 * ConsumerRemovalProposals holds pending governance proposals on the provider chain to remove (and stop) a consumer chain.
 */
export interface V1ConsumerRemovalProposals {
  /** proposals waiting for stop_time to pass */
  pending?: V1ConsumerRemovalProposal[];
}

/**
* Fraction defines the protobuf message type for tmmath.Fraction that only
supports positive values.
*/
export interface V1Fraction {
  /** @format uint64 */
  numerator?: string;

  /** @format uint64 */
  denominator?: string;
}

/**
* Normally the RevisionHeight is incremented at each height while keeping
RevisionNumber the same. However some consensus algorithms may choose to
reset the height in certain conditions e.g. hard forks, state-machine
breaking changes In these cases, the RevisionNumber is incremented so that
height continues to be monitonically increasing even as the RevisionHeight
gets reset
*/
export interface V1Height {
  /**
   * the revision that the client is currently on
   * @format uint64
   */
  revision_number?: string;

  /**
   * the height within the given revision
   * @format uint64
   */
  revision_height?: string;
}

export interface V1HeightToValsetUpdateID {
  /** @format uint64 */
  height?: string;

  /** @format uint64 */
  valset_update_id?: string;
}

export interface V1MaturingVSCPacket {
  /** @format uint64 */
  vscId?: string;

  /** @format uint64 */
  maturity_time?: string;
}

/**
* MerkleRoot defines a merkle root hash.
In the Cosmos SDK, the AppHash of a block header becomes the root.
*/
export interface V1MerkleRoot {
  /** @format byte */
  hash?: string;
}

/**
* OutstandingDowntime defines the genesis information for each validator
flagged with an outstanding downtime slashing.
*/
export interface V1OutstandingDowntime {
  validator_consensus_address?: string;
}

export interface V1QueryConsumerChainStartProposalsResponse {
  /** ConsumerAdditionProposals holds pending governance proposals on the provider chain to spawn a new chain. */
  proposals?: V1ConsumerAdditionProposals;
}

export interface V1QueryConsumerChainStopProposalsResponse {
  /** ConsumerRemovalProposals holds pending governance proposals on the provider chain to remove (and stop) a consumer chain. */
  proposals?: V1ConsumerRemovalProposals;
}

export interface V1QueryConsumerChainsResponse {
  chains?: V1Chain[];
}

export interface V1QueryConsumerGenesisResponse {
  genesis_state?: Ccvconsumerv1GenesisState;
}

/**
* This packet is sent from the consumer chain to the provider chain
to request the slashing of a validator as a result of an infraction
committed on the consumer chain.
*/
export interface V1SlashPacketData {
  validator?: TendermintabciValidator;

  /**
   * map to the infraction block height on the provider
   * @format uint64
   */
  valset_update_id?: string;

  /**
   * tell if the slashing is for a downtime or a double-signing infraction
   * InfractionType indicates the infraction type a validator commited.
   *
   *  - INFRACTION_TYPE_UNSPECIFIED: UNSPECIFIED defines an empty infraction type.
   *  - INFRACTION_TYPE_DOUBLE_SIGN: DOUBLE_SIGN defines a validator that double-signs a block.
   *  - INFRACTION_TYPE_DOWNTIME: DOWNTIME defines a validator that missed signing too many blocks.
   */
  infraction?: V1Beta1InfractionType;
}

export interface V1SlashRequest {
  /**
   * This packet is sent from the consumer chain to the provider chain
   * to request the slashing of a validator as a result of an infraction
   * committed on the consumer chain.
   */
  packet?: V1SlashPacketData;

  /**
   * InfractionType indicates the infraction type a validator commited.
   *
   *  - INFRACTION_TYPE_UNSPECIFIED: UNSPECIFIED defines an empty infraction type.
   *  - INFRACTION_TYPE_DOUBLE_SIGN: DOUBLE_SIGN defines a validator that double-signs a block.
   *  - INFRACTION_TYPE_DOWNTIME: DOWNTIME defines a validator that missed signing too many blocks.
   */
  infraction?: V1Beta1InfractionType;
}

export interface V1SlashRequests {
  requests?: V1SlashRequest[];
}

/**
* InfractionType indicates the infraction type a validator commited.

 - INFRACTION_TYPE_UNSPECIFIED: UNSPECIFIED defines an empty infraction type.
 - INFRACTION_TYPE_DOUBLE_SIGN: DOUBLE_SIGN defines a validator that double-signs a block.
 - INFRACTION_TYPE_DOWNTIME: DOWNTIME defines a validator that missed signing too many blocks.
*/
export enum V1Beta1InfractionType {
  INFRACTION_TYPE_UNSPECIFIED = "INFRACTION_TYPE_UNSPECIFIED",
  INFRACTION_TYPE_DOUBLE_SIGN = "INFRACTION_TYPE_DOUBLE_SIGN",
  INFRACTION_TYPE_DOWNTIME = "INFRACTION_TYPE_DOWNTIME",
}

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, ResponseType } from "axios";

export type QueryParamsType = Record<string | number, any>;

export interface FullRequestParams extends Omit<AxiosRequestConfig, "data" | "params" | "url" | "responseType"> {
  /** set parameter to `true` for call `securityWorker` for this request */
  secure?: boolean;
  /** request path */
  path: string;
  /** content type of request body */
  type?: ContentType;
  /** query params */
  query?: QueryParamsType;
  /** format of response (i.e. response.json() -> format: "json") */
  format?: ResponseType;
  /** request body */
  body?: unknown;
}

export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

export enum ContentType {
  Json = "application/json",
  FormData = "multipart/form-data",
  UrlEncoded = "application/x-www-form-urlencoded",
}

export class HttpClient<SecurityDataType = unknown> {
  public instance: AxiosInstance;
  private securityData: SecurityDataType | null = null;
  private securityWorker?: ApiConfig<SecurityDataType>["securityWorker"];
  private secure?: boolean;
  private format?: ResponseType;

  constructor({ securityWorker, secure, format, ...axiosConfig }: ApiConfig<SecurityDataType> = {}) {
    this.instance = axios.create({ ...axiosConfig, baseURL: axiosConfig.baseURL || "" });
    this.secure = secure;
    this.format = format;
    this.securityWorker = securityWorker;
  }

  public setSecurityData = (data: SecurityDataType | null) => {
    this.securityData = data;
  };

  private mergeRequestParams(params1: AxiosRequestConfig, params2?: AxiosRequestConfig): AxiosRequestConfig {
    return {
      ...this.instance.defaults,
      ...params1,
      ...(params2 || {}),
      headers: {
        ...(this.instance.defaults.headers || {}),
        ...(params1.headers || {}),
        ...((params2 && params2.headers) || {}),
      },
    };
  }

  private createFormData(input: Record<string, unknown>): FormData {
    return Object.keys(input || {}).reduce((formData, key) => {
      const property = input[key];
      formData.append(
        key,
        property instanceof Blob
          ? property
          : typeof property === "object" && property !== null
          ? JSON.stringify(property)
          : `${property}`,
      );
      return formData;
    }, new FormData());
  }

  public request = async <T = any, _E = any>({
    secure,
    path,
    type,
    query,
    format,
    body,
    ...params
  }: FullRequestParams): Promise<AxiosResponse<T>> => {
    const secureParams =
      ((typeof secure === "boolean" ? secure : this.secure) &&
        this.securityWorker &&
        (await this.securityWorker(this.securityData))) ||
      {};
    const requestParams = this.mergeRequestParams(params, secureParams);
    const responseFormat = (format && this.format) || void 0;

    if (type === ContentType.FormData && body && body !== null && typeof body === "object") {
      requestParams.headers.common = { Accept: "*/*" };
      requestParams.headers.post = {};
      requestParams.headers.put = {};

      body = this.createFormData(body as Record<string, unknown>);
    }

    return this.instance.request({
      ...requestParams,
      headers: {
        ...(type && type !== ContentType.FormData ? { "Content-Type": type } : {}),
        ...(requestParams.headers || {}),
      },
      params: query,
      responseType: responseFormat,
      data: body,
      url: path,
    });
  };
}

/**
 * @title interchain_security/ccv/provider/v1/genesis.proto
 * @version version not set
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  /**
   * No description
   *
   * @tags Query
   * @name QueryQueryConsumerChainStarts
   * @summary QueryConsumerChainStarts queries consumer chain start proposals.
   * @request GET:/interchain_security/ccv/provider/consumer_chain_start_proposals
   */
  queryQueryConsumerChainStarts = (params: RequestParams = {}) =>
    this.request<V1QueryConsumerChainStartProposalsResponse, RpcStatus>({
      path: `/interchain_security/ccv/provider/consumer_chain_start_proposals`,
      method: "GET",
      format: "json",
      ...params,
    });

  /**
   * No description
   *
   * @tags Query
   * @name QueryQueryConsumerChainStops
   * @summary QueryConsumerChainStops queries consumer chain stop proposals.
   * @request GET:/interchain_security/ccv/provider/consumer_chain_stop_proposals
   */
  queryQueryConsumerChainStops = (params: RequestParams = {}) =>
    this.request<V1QueryConsumerChainStopProposalsResponse, RpcStatus>({
      path: `/interchain_security/ccv/provider/consumer_chain_stop_proposals`,
      method: "GET",
      format: "json",
      ...params,
    });

  /**
 * No description
 * 
 * @tags Query
 * @name QueryQueryConsumerChains
 * @summary ConsumerChains queries active consumer chains supported by the provider
chain
 * @request GET:/interchain_security/ccv/provider/consumer_chains
 */
  queryQueryConsumerChains = (params: RequestParams = {}) =>
    this.request<V1QueryConsumerChainsResponse, RpcStatus>({
      path: `/interchain_security/ccv/provider/consumer_chains`,
      method: "GET",
      format: "json",
      ...params,
    });

  /**
 * No description
 * 
 * @tags Query
 * @name QueryQueryConsumerGenesis
 * @summary ConsumerGenesis queries the genesis state needed to start a consumer chain
whose proposal has been accepted
 * @request GET:/interchain_security/ccv/provider/consumer_genesis/{chain_id}
 */
  queryQueryConsumerGenesis = (chainId: string, params: RequestParams = {}) =>
    this.request<V1QueryConsumerGenesisResponse, RpcStatus>({
      path: `/interchain_security/ccv/provider/consumer_genesis/${chainId}`,
      method: "GET",
      format: "json",
      ...params,
    });
}
