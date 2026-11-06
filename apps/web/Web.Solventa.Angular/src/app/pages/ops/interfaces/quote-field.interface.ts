import { TextKey } from '../../../core/i18n/es';

export type QuoteFieldType = 'text' | 'email' | 'date' | 'select';

/** Definición declarativa de un campo del formulario de cotización. */
export interface QuoteFieldDef {
  readonly key: string;
  readonly labelKey: TextKey;
  readonly type: QuoteFieldType;
  readonly required: boolean;
  readonly numeric?: boolean;
  readonly placeholder?: string;
  readonly options?: readonly string[];
}
