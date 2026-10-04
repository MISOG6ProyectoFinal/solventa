export type QuoteFieldType = 'text' | 'email' | 'date' | 'select';

/** Definición declarativa de un campo del formulario de cotización. */
export interface QuoteFieldDef {
  readonly key: string;
  readonly label: string;
  readonly type: QuoteFieldType;
  readonly required: boolean;
  readonly placeholder?: string;
  readonly options?: readonly string[];
}
