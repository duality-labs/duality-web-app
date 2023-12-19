import { AminoMsg } from '@cosmjs/amino';
import Long from 'long';
import { limitOrderTypeFromJSON, MsgDeposit, MsgWithdrawal, MsgPlaceLimitOrder, MsgWithdrawFilledLimitOrder, MsgCancelLimitOrder, MsgMultiHopSwap } from '@neutron-org/neutronjsplus/dist/proto/neutron/neutron/dex/tx_pb.d';

export interface MsgDepositAminoType extends AminoMsg {
  type: "/duality.dex.MsgDeposit";
  value: {
    creator: string;
    receiver: string;
    tokenA: string;
    tokenB: string;
    amountsA: string[];
    amountsB: string[];
    tickIndexesAToB: string[];
    fees: string[];
    Options: {
      disable_autoswap: boolean;
    }[];
  };
}
export interface MsgWithdrawalAminoType extends AminoMsg {
  type: "/duality.dex.MsgWithdrawal";
  value: {
    creator: string;
    receiver: string;
    tokenA: string;
    tokenB: string;
    sharesToRemove: string[];
    tickIndexesAToB: string[];
    fees: string[];
  };
}
export interface MsgPlaceLimitOrderAminoType extends AminoMsg {
  type: "/duality.dex.MsgPlaceLimitOrder";
  value: {
    creator: string;
    receiver: string;
    tokenIn: string;
    tokenOut: string;
    tickIndexInToOut: string;
    amountIn: string;
    orderType: number;
    expirationTime: {
      seconds: string;
      nanos: number;
    };
    maxAmountOut: string;
  };
}
export interface MsgWithdrawFilledLimitOrderAminoType extends AminoMsg {
  type: "/duality.dex.MsgWithdrawFilledLimitOrder";
  value: {
    creator: string;
    trancheKey: string;
  };
}
export interface MsgCancelLimitOrderAminoType extends AminoMsg {
  type: "/duality.dex.MsgCancelLimitOrder";
  value: {
    creator: string;
    trancheKey: string;
  };
}
export interface MsgMultiHopSwapAminoType extends AminoMsg {
  type: "/duality.dex.MsgMultiHopSwap";
  value: {
    creator: string;
    receiver: string;
    routes: {
      hops: string[];
    }[];
    amountIn: string;
    exitLimitPrice: string;
    pickBestRoute: boolean;
  };
}
export const AminoConverter = {
  "/duality.dex.MsgDeposit": {
    aminoType: "/duality.dex.MsgDeposit",
    toAmino: ({
      creator,
      receiver,
      tokenA,
      tokenB,
      amountsA,
      amountsB,
      tickIndexesAToB,
      fees,
      Options
    }: MsgDeposit): MsgDepositAminoType["value"] => {
      return {
        creator,
        receiver,
        tokenA,
        tokenB,
        amountsA,
        amountsB,
        tickIndexesAToB: tickIndexesAToB.map(el0 => el0.toString()),
        fees: fees.map(el0 => el0.toString()),
        Options: Options.map(el0 => ({
          disable_autoswap: el0.disable_autoswap
        }))
      };
    },
    fromAmino: ({
      creator,
      receiver,
      tokenA,
      tokenB,
      amountsA,
      amountsB,
      tickIndexesAToB,
      fees,
      Options
    }: MsgDepositAminoType["value"]): MsgDeposit => {
      return {
        creator,
        receiver,
        tokenA,
        tokenB,
        amountsA,
        amountsB,
        tickIndexesAToB: tickIndexesAToB.map(el0 => Long.fromString(el0)),
        fees: fees.map(el0 => Long.fromString(el0)),
        Options: Options.map(el0 => ({
          disable_autoswap: el0.disable_autoswap
        }))
      };
    }
  },
  "/duality.dex.MsgWithdrawal": {
    aminoType: "/duality.dex.MsgWithdrawal",
    toAmino: ({
      creator,
      receiver,
      tokenA,
      tokenB,
      sharesToRemove,
      tickIndexesAToB,
      fees
    }: MsgWithdrawal): MsgWithdrawalAminoType["value"] => {
      return {
        creator,
        receiver,
        tokenA,
        tokenB,
        sharesToRemove,
        tickIndexesAToB: tickIndexesAToB.map(el0 => el0.toString()),
        fees: fees.map(el0 => el0.toString())
      };
    },
    fromAmino: ({
      creator,
      receiver,
      tokenA,
      tokenB,
      sharesToRemove,
      tickIndexesAToB,
      fees
    }: MsgWithdrawalAminoType["value"]): MsgWithdrawal => {
      return {
        creator,
        receiver,
        tokenA,
        tokenB,
        sharesToRemove,
        tickIndexesAToB: tickIndexesAToB.map(el0 => Long.fromString(el0)),
        fees: fees.map(el0 => Long.fromString(el0))
      };
    }
  },
  "/duality.dex.MsgPlaceLimitOrder": {
    aminoType: "/duality.dex.MsgPlaceLimitOrder",
    toAmino: ({
      creator,
      receiver,
      tokenIn,
      tokenOut,
      tickIndexInToOut,
      amountIn,
      orderType,
      expirationTime,
      maxAmountOut
    }: MsgPlaceLimitOrder): MsgPlaceLimitOrderAminoType["value"] => {
      return {
        creator,
        receiver,
        tokenIn,
        tokenOut,
        tickIndexInToOut: tickIndexInToOut.toString(),
        amountIn,
        orderType,
        expirationTime,
        maxAmountOut
      };
    },
    fromAmino: ({
      creator,
      receiver,
      tokenIn,
      tokenOut,
      tickIndexInToOut,
      amountIn,
      orderType,
      expirationTime,
      maxAmountOut
    }: MsgPlaceLimitOrderAminoType["value"]): MsgPlaceLimitOrder => {
      return {
        creator,
        receiver,
        tokenIn,
        tokenOut,
        tickIndexInToOut: Long.fromString(tickIndexInToOut),
        amountIn,
        orderType: limitOrderTypeFromJSON(orderType),
        expirationTime,
        maxAmountOut
      };
    }
  },
  "/duality.dex.MsgWithdrawFilledLimitOrder": {
    aminoType: "/duality.dex.MsgWithdrawFilledLimitOrder",
    toAmino: ({
      creator,
      trancheKey
    }: MsgWithdrawFilledLimitOrder): MsgWithdrawFilledLimitOrderAminoType["value"] => {
      return {
        creator,
        trancheKey
      };
    },
    fromAmino: ({
      creator,
      trancheKey
    }: MsgWithdrawFilledLimitOrderAminoType["value"]): MsgWithdrawFilledLimitOrder => {
      return {
        creator,
        trancheKey
      };
    }
  },
  "/duality.dex.MsgCancelLimitOrder": {
    aminoType: "/duality.dex.MsgCancelLimitOrder",
    toAmino: ({
      creator,
      trancheKey
    }: MsgCancelLimitOrder): MsgCancelLimitOrderAminoType["value"] => {
      return {
        creator,
        trancheKey
      };
    },
    fromAmino: ({
      creator,
      trancheKey
    }: MsgCancelLimitOrderAminoType["value"]): MsgCancelLimitOrder => {
      return {
        creator,
        trancheKey
      };
    }
  },
  "/duality.dex.MsgMultiHopSwap": {
    aminoType: "/duality.dex.MsgMultiHopSwap",
    toAmino: ({
      creator,
      receiver,
      routes,
      amountIn,
      exitLimitPrice,
      pickBestRoute
    }: MsgMultiHopSwap): MsgMultiHopSwapAminoType["value"] => {
      return {
        creator,
        receiver,
        routes: routes.map(el0 => ({
          hops: el0.hops
        })),
        amountIn,
        exitLimitPrice,
        pickBestRoute
      };
    },
    fromAmino: ({
      creator,
      receiver,
      routes,
      amountIn,
      exitLimitPrice,
      pickBestRoute
    }: MsgMultiHopSwapAminoType["value"]): MsgMultiHopSwap => {
      return {
        creator,
        receiver,
        routes: routes.map(el0 => ({
          hops: el0.hops
        })),
        amountIn,
        exitLimitPrice,
        pickBestRoute
      };
    }
  }
};
