export interface ContractProperty {
  readonly type?: string;
  readonly anyOf?: readonly { readonly type?: string; readonly $ref?: string }[];
  readonly enum?: readonly string[];
  readonly format?: string;
  readonly title?: string;
  readonly const?: string;
  readonly $ref?: string;
}

export interface ProductContract {
  readonly properties: Readonly<Record<string, ContractProperty>>;
  readonly required?: readonly string[];
}
