/* eslint-disable */
/* tslint:disable */
import { GeneratedType } from "@cosmjs/proto-signing";
import { MsgSubmitProposal } from "./types/adminmodule/tx";
import { MsgDeleteAdmin } from "./types/adminmodule/tx";
import { MsgAddAdmin } from "./types/adminmodule/tx";

const msgTypes: Array<[string, GeneratedType]>  = [
    ["/cosmos.adminmodule.adminmodule.MsgSubmitProposal", MsgSubmitProposal],
    ["/cosmos.adminmodule.adminmodule.MsgDeleteAdmin", MsgDeleteAdmin],
    ["/cosmos.adminmodule.adminmodule.MsgAddAdmin", MsgAddAdmin],
    
];

export { msgTypes }