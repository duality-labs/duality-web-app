/* eslint-disable */
/* tslint:disable */
import { GeneratedType } from "@cosmjs/proto-signing";
import { IgniteClient } from "./client";
export type Module = (instance: IgniteClient) => { module: ModuleInterface, registry: [string, GeneratedType][] }
export type ModuleInterface = { [key: string]: any }