import { QuoteFieldDef } from '../interfaces/quote-field.interface';

/** Campos comunes del cliente (espejo de `clientFields` en los mockups). */
export const QUOTE_CLIENT_FIELDS: readonly QuoteFieldDef[] = [
  { key: 'tipoDocumento', labelKey: 'quote.field.tipoDocumento', type: 'select', required: true, optionsSource: 'documentTypes' },
  { key: 'numeroDocumento', labelKey: 'quote.field.numeroDocumento', type: 'text', required: true, numeric: true, placeholder: '1020304050' },
  { key: 'nombre', labelKey: 'quote.field.nombre', type: 'text', required: true },
  { key: 'apellido', labelKey: 'quote.field.apellido', type: 'text', required: true },
  { key: 'telefono', labelKey: 'quote.field.telefono', type: 'text', required: true, numeric: true, placeholder: '3001234567' },
  { key: 'email', labelKey: 'quote.field.email', type: 'email', required: true },
];
