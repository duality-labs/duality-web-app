/* eslint-disable */
/* tslint:disable */
import { GeneratedType } from "@cosmjs/proto-signing";
import { MsgWithdrawFilledLimitOrder } from "./types/dex/tx";
import { MsgSwap } from "./types/dex/tx";
import { MsgPlaceLimitOrder } from "./types/dex/tx";
import { MsgCancelLimitOrder } from "./types/dex/tx";
import { MsgDeposit } from "./types/dex/tx";
import { MsgWithdrawl } from "./types/dex/tx";

const msgTypes: Array<[string, GeneratedType]>  = [
    ["/nicholasdotsol.duality.dex.MsgWithdrawFilledLimitOrder", MsgWithdrawFilledLimitOrder],
    ["/nicholasdotsol.duality.dex.MsgSwap", MsgSwap],
    ["/nicholasdotsol.duality.dex.MsgPlaceLimitOrder", MsgPlaceLimitOrder],
    ["/nicholasdotsol.duality.dex.MsgCancelLimitOrder", MsgCancelLimitOrder],
    ["/nicholasdotsol.duality.dex.MsgDeposit", MsgDeposit],
    ["/nicholasdotsol.duality.dex.MsgWithdrawl", MsgWithdrawl],
    
];

export { msgTypes }