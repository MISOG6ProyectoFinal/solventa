export interface ContractProperty {
  readonly type?: string;
  readonly anyOf?: readonly { readonly type?: string }[];
  readonly enum?: readonly string[];
}

export interface ProductContract {
  readonly properties: Readonly<Record<string, ContractProperty>>;
}
