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

/** Campos de riesgo por ramo (espejo de `ramoFields` en los mockups). */
export const QUOTE_RISK_FIELDS: Record<string, readonly QuoteFieldDef[]> = {
  'ramo-viaje': [
    { key: 'destino', labelKey: 'quote.field.destino', type: 'select', required: true, optionsSource: 'contract' },
    { key: 'fechaSalida', labelKey: 'quote.field.fechaSalida', type: 'date', required: true },
    { key: 'fechaRegreso', labelKey: 'quote.field.fechaRegreso', type: 'date', required: true },
    { key: 'viajeros', labelKey: 'quote.field.viajeros', type: 'text', required: true, numeric: true, placeholder: '1' },
    { key: 'fechaNacimiento', labelKey: 'quote.field.fechaNacimientoTitular', type: 'date', required: true },
  ],
  'ramo-microseguro-vida': [
    { key: 'fechaNacimiento', labelKey: 'quote.field.fechaNacimiento', type: 'date', required: true },
    { key: 'sumaAsegurada', labelKey: 'quote.field.sumaAsegurada', type: 'text', required: true, numeric: true, placeholder: '15000000' },
    { key: 'beneficiario', labelKey: 'quote.field.beneficiario', type: 'text', required: true },
    { key: 'parentesco', labelKey: 'quote.field.parentesco', type: 'select', required: true, optionsSource: 'contract' },
  ],
  'ramo-parametrico': [
    { key: 'evento', labelKey: 'quote.field.evento', type: 'select', required: true, optionsSource: 'contract' },
    { key: 'referencia', labelKey: 'quote.field.referencia', type: 'text', required: true, placeholder: 'AN-412' },
    { key: 'fechaEvento', labelKey: 'quote.field.fechaEvento', type: 'date', required: true },
    { key: 'valorIndemnizar', labelKey: 'quote.field.valorIndemnizar', type: 'text', required: true, numeric: true },
  ],
  'ramo-vida-hipotecario': [
    { key: 'fechaNacimiento', labelKey: 'quote.field.fechaNacimiento', type: 'date', required: true },
    { key: 'entidad', labelKey: 'quote.field.entidad', type: 'text', required: true, placeholder: 'Banco Aurora' },
    { key: 'valorCredito', labelKey: 'quote.field.valorCredito', type: 'text', required: true, numeric: true },
    { key: 'plazoAnios', labelKey: 'quote.field.plazoAnios', type: 'text', required: true, numeric: true },
  ],
};
