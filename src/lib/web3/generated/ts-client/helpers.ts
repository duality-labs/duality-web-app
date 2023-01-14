/* eslint-disable */
/* tslint:disable */
export type AnyFunction = (...args: any) => any;
export type Constructor<T> = new (...args: any[]) => T;
export type Return<T> =
  T extends AnyFunction
  ? ReturnType<T>
  : T extends AnyFunction[]
  ? UnionToIntersection<ReturnType<T[number]>>
      : never
export type UnionToIntersection<Union> =
  (Union extends any
    ? (argument: Union) => void
    : never
  ) extends (argument: infer Intersection) => void
      ? Intersection
  : never;
export const MissingWalletError = new Error("wallet is required");

export function getStructure(template: any) {
	let structure = { fields: []  as Array<unknown>}
	for (const [key, value] of Object.entries(template)) {
		let field: any = {}
		field.name = key
		field.type = typeof value
		structure.fields.push(field)
	}
	return structure
}