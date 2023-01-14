/* eslint-disable */
/* tslint:disable */
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, ResponseType } from "axios";
export type DexMsgCancelLimitOrderResponse = object;
export type DexMsgPlaceLimitOrderResponse = object;
export type DexMsgWithdrawFilledLimitOrderResponse = object;
export type DexMsgWithdrawlResponse = object;
/**
 * Params defines the parameters for the module.
 */
export type DexParams = object;
export type QueryParamsType = Record<string | number, any>;
export type RequestParams = Omit<FullRequestParams, "body" | "method" | "query" | "path">;

export interface ApiConfig<SecurityDataType = unknown> extends Omit<AxiosRequestConfig, "data" | "cancelToken"> {
  securityWorker?: (
    securityData: SecurityDataType | null,
  ) => Promise<AxiosRequestConfig | void> | AxiosRequestConfig | void;
  secure?: boolean;
  format?: ResponseType;
}

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

export interface DexFeeTier {
  /** @format uint64 */
  id?: string;

  /** @format int64 */
  fee?: string;
}

export interface DexLimitOrderTranche {
  pairId?: string;
  tokenIn?: string;

  /** @format int64 */
  tickIndex?: string;

  /** @format uint64 */
  trancheIndex?: string;
  reservesTokenIn?: string;
  reservesTokenOut?: string;
  totalTokenIn?: string;
  totalTokenOut?: string;
}

export interface DexLimitOrderTrancheUser {
  pairId?: string;
  token?: string;

  /** @format int64 */
  tickIndex?: string;

  /** @format uint64 */
  count?: string;
  address?: string;
  sharesOwned?: string;
  sharesWithdrawn?: string;
  sharesCancelled?: string;
}

export interface DexLimitTrancheIndexes {
  /** @format uint64 */
  fillTrancheIndex?: string;

  /** @format uint64 */
  placeTrancheIndex?: string;
}

export interface DexMsgDepositResponse {
  Reserve0Deposited?: string[];
  Reserve1Deposited?: string[];
}

export interface DexMsgSwapResponse {
  /**
   * Coin defines a token with a denomination and an amount.
   *
   * NOTE: The amount field is an Int which implements the custom method
   * signatures required by gogoproto.
   */
  coinOut?: V1Beta1Coin;
}

export interface DexQueryAllFeeTierResponse {
  FeeTier?: DexFeeTier[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryAllLimitOrderTrancheResponse {
  LimitOrderTranche?: DexLimitOrderTranche[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryAllLimitOrderTrancheUserResponse {
  LimitOrderTrancheUser?: DexLimitOrderTrancheUser[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryAllTickResponse {
  Tick?: DexTick[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryAllTokenMapResponse {
  tokenMap?: DexTokenMap[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryAllTokensResponse {
  Tokens?: DexTokens[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryAllTradingPairResponse {
  TradingPair?: DexTradingPair[];

  /**
   * PageResponse is to be embedded in gRPC response messages where the
   * corresponding request message has used PageRequest.
   *
   *  message SomeResponse {
   *          repeated Bar results = 1;
   *          PageResponse page = 2;
   *  }
   */
  pagination?: V1Beta1PageResponse;
}

export interface DexQueryGetFeeTierResponse {
  FeeTier?: DexFeeTier;
}

export interface DexQueryGetLimitOrderTrancheResponse {
  LimitOrderTranche?: DexLimitOrderTranche;
}

export interface DexQueryGetLimitOrderTrancheUserResponse {
  LimitOrderTrancheUser?: DexLimitOrderTrancheUser;
}

export interface DexQueryGetTickResponse {
  Tick?: DexTick;
}

export interface DexQueryGetTokenMapResponse {
  tokenMap?: DexTokenMap;
}

export interface DexQueryGetTokensResponse {
  Tokens?: DexTokens;
}

export interface DexQueryGetTradingPairResponse {
  TradingPair?: DexTradingPair;
}

/**
 * QueryParamsResponse is response type for the Query/Params RPC method.
 */
export interface DexQueryParamsResponse {
  /** params holds all the parameters of this module. */
  params?: DexParams;
}

export interface DexTick {
  pairId?: string;

  /** @format int64 */
  tickIndex?: string;
  tickData?: DexTickDataType;
  LimitOrderTranche0to1?: DexLimitTrancheIndexes;
  LimitOrderTranche1to0?: DexLimitTrancheIndexes;
  price0To1?: string;
}

export interface DexTickDataType {
  reserve0?: string[];
  reserve1?: string[];
}

export interface DexTokenMap {
  address?: string;

  /** @format int64 */
  index?: string;
}

export interface DexTokens {
  /** @format uint64 */
  id?: string;
  address?: string;
}

export interface DexTradingPair {
  pairId?: string;

  /** @format int64 */
  currentTick0To1?: string;

  /** @format int64 */
  currentTick1To0?: string;

  /** @format int64 */
  maxTick?: string;

  /** @format int64 */
  minTick?: string;
}

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

export interface ProtobufAny {
  "@type"?: string;
}

export interface RpcStatus {
  /** @format int32 */
  code?: number;
  message?: string;
  details?: ProtobufAny[];
}

/**
* Coin defines a token with a denomination and an amount.

NOTE: The amount field is an Int which implements the custom method
signatures required by gogoproto.
*/
export interface V1Beta1Coin {
  denom?: string;
  amount?: string;
}

/**
* message SomeRequest {
         Foo some_parameter = 1;
         PageRequest pagination = 2;
 }
*/
export interface V1Beta1PageRequest {
  /**
   * key is a value returned in PageResponse.next_key to begin
   * querying the next page most efficiently. Only one of offset or key
   * should be set.
   * @format byte
   */
  key?: string;

  /**
   * offset is a numeric offset that can be used when key is unavailable.
   * It is less efficient than using key. Only one of offset or key should
   * be set.
   * @format uint64
   */
  offset?: string;

  /**
   * limit is the total number of results to be returned in the result page.
   * If left empty it will default to a value to be set by each app.
   * @format uint64
   */
  limit?: string;

  /**
   * count_total is set to true  to indicate that the result set should include
   * a count of the total number of items available for pagination in UIs.
   * count_total is only respected when offset is used. It is ignored when key
   * is set.
   */
  count_total?: boolean;

  /**
   * reverse is set to true if results are to be returned in the descending order.
   *
   * Since: cosmos-sdk 0.43
   */
  reverse?: boolean;
}

/**
* PageResponse is to be embedded in gRPC response messages where the
corresponding request message has used PageRequest.

 message SomeResponse {
         repeated Bar results = 1;
         PageResponse page = 2;
 }
*/
export interface V1Beta1PageResponse {
  /**
   * next_key is the key to be passed to PageRequest.key to
   * query the next page most efficiently
   * @format byte
   */
  next_key?: string;

  /**
   * total is total number of results available if PageRequest.count_total
   * was set, its value is undefined otherwise
   * @format uint64
   */
  total?: string;
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
                  ...((params2 && params2.headers) || {})
                }
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
          data: body,
          headers: {

                  ...(type && type !== ContentType.FormData ? { "Content-Type": type } : {}),
                  ...(requestParams.headers || {})
                },
          params: query,
          responseType: responseFormat,
          url: path
        });
  };
}

/**
 * @title dex/fee_tier.proto
 * @version version not set
 */
export class Api<SecurityDataType extends unknown> extends HttpClient<SecurityDataType> {
  /**
   * No description
   *
   * @tags Query
   * @name QueryFeeTierAll
   * @summary Queries a list of FeeTier items.
   * @request GET:/NicholasDotSol/duality/dex/fee_tier
   */
  queryFeeTierAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllFeeTierResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/fee_tier`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryFeeTier
   * @summary Queries a FeeTier by id.
   * @request GET:/NicholasDotSol/duality/dex/fee_tier/{id}
   */
  queryFeeTier = (id: string, params: RequestParams = {}) =>
    this.request<DexQueryGetFeeTierResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/fee_tier/${id}`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryLimitOrderTrancheAll
   * @summary Queries a list of LimitOrderTranche items.
   * @request GET:/NicholasDotSol/duality/dex/limit_order_tranche
   */
  queryLimitOrderTrancheAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllLimitOrderTrancheResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/limit_order_tranche`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryLimitOrderTranche
   * @summary Queries a LimitOrderTranche by index.
   * @request GET:/NicholasDotSol/duality/dex/limit_order_tranche/{pairId}/{token}/{tickIndex}/{trancheIndex}
   */
  queryLimitOrderTranche = (
    pairId: string,
    token: string,
    tickIndex: string,
    trancheIndex: string,
    params: RequestParams = {},
  ) =>
    this.request<DexQueryGetLimitOrderTrancheResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/limit_order_tranche/${pairId}/${token}/${tickIndex}/${trancheIndex}`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryLimitOrderTrancheUserAll
   * @summary Queries a list of LimitOrderTrancheMap items.
   * @request GET:/NicholasDotSol/duality/dex/limit_order_tranche_user
   */
  queryLimitOrderTrancheUserAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllLimitOrderTrancheUserResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/limit_order_tranche_user`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryLimitOrderTrancheUser
   * @summary Queries a LimitOrderTrancheUser by index.
   * @request GET:/NicholasDotSol/duality/dex/limit_order_tranche_user/{pairId}/{token}/{tickIndex}/{count}/{address}
   */
  queryLimitOrderTrancheUser = (
    pairId: string,
    token: string,
    tickIndex: string,
    count: string,
    address: string,
    params: RequestParams = {},
  ) =>
    this.request<DexQueryGetLimitOrderTrancheUserResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/limit_order_tranche_user/${pairId}/${token}/${tickIndex}/${count}/${address}`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryParams
   * @summary Parameters queries the parameters of the module.
   * @request GET:/NicholasDotSol/duality/dex/params
   */
  queryParams = (params: RequestParams = {}) =>
    this.request<DexQueryParamsResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/params`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTickAll
   * @summary Queries a list of Tick items.
   * @request GET:/NicholasDotSol/duality/dex/tick
   */
  queryTickAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllTickResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/tick`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTick
   * @summary Queries a Tick by index.
   * @request GET:/NicholasDotSol/duality/dex/tick/{pairId}/{tickIndex}
   */
  queryTick = (pairId: string, tickIndex: string, params: RequestParams = {}) =>
    this.request<DexQueryGetTickResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/tick/${pairId}/${tickIndex}`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTokenMapAll
   * @summary Queries a list of TokenMap items.
   * @request GET:/NicholasDotSol/duality/dex/token_map
   */
  queryTokenMapAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllTokenMapResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/token_map`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTokenMap
   * @summary Queries a TokenMap by index.
   * @request GET:/NicholasDotSol/duality/dex/token_map/{address}
   */
  queryTokenMap = (address: string, params: RequestParams = {}) =>
    this.request<DexQueryGetTokenMapResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/token_map/${address}`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTokensAll
   * @summary Queries a list of Tokens items.
   * @request GET:/NicholasDotSol/duality/dex/tokens
   */
  queryTokensAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllTokensResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/tokens`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTokens
   * @summary Queries a Tokens by id.
   * @request GET:/NicholasDotSol/duality/dex/tokens/{id}
   */
  queryTokens = (id: string, params: RequestParams = {}) =>
    this.request<DexQueryGetTokensResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/tokens/${id}`,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTradingPairAll
   * @summary Queries a list of TradingPair items.
   * @request GET:/NicholasDotSol/duality/dex/trading_pair
   */
  queryTradingPairAll = (
    query?: {
      "pagination.key"?: string;
      "pagination.offset"?: string;
      "pagination.limit"?: string;
      "pagination.count_total"?: boolean;
      "pagination.reverse"?: boolean;
    },
    params: RequestParams = {},
  ) =>
    this.request<DexQueryAllTradingPairResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/trading_pair`,
          query: query,
          ...params
        });

  /**
   * No description
   *
   * @tags Query
   * @name QueryTradingPair
   * @summary Queries a TradingPair by index.
   * @request GET:/NicholasDotSol/duality/dex/trading_pair/{pairId}
   */
  queryTradingPair = (pairId: string, params: RequestParams = {}) =>
    this.request<DexQueryGetTradingPairResponse, RpcStatus>({

          format: "json",
          method: "GET",
          path: `/NicholasDotSol/duality/dex/trading_pair/${pairId}`,
          ...params
        });
}
