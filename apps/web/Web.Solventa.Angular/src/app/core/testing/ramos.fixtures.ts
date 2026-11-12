import { ProductContract } from '../../pages/ops/interfaces/product-contract.interface';

export const RAMOS_DTO = [
  {
    id: 'ramo-viaje',
    nombre: 'Viaje',
    requiere_consentimiento: false,
    productos: [{ id: 'viaje-internacional', nombre: 'Viaje Internacional', requiere_consentimiento: false }],
  },
  {
    id: 'ramo-microseguro-vida',
    nombre: 'Microseguro de vida',
    requiere_consentimiento: false,
    productos: [{ id: 'vida-esencial', nombre: 'Vida Esencial', requiere_consentimiento: false }],
  },
  {
    id: 'ramo-parametrico',
    nombre: 'Paramétrico (clima / vuelo)',
    requiere_consentimiento: false,
    productos: [{ id: 'parametrico-clima-vuelo', nombre: 'Paramétrico Clima y Vuelo', requiere_consentimiento: false }],
  },
  {
    id: 'ramo-vida-hipotecario',
    nombre: 'Vida hipotecario',
    requiere_consentimiento: true,
    productos: [{ id: 'vida-hipotecario', nombre: 'Vida Hipotecario', requiere_consentimiento: true }],
  },
];

const MONEY = { anyOf: [{ type: 'number' }, { type: 'string' }] };

/** Copia de lo que publica `GET /catalogo/productos/{id}/contrato`. */
export const CONTRACTS: Record<string, ProductContract> = {
  'viaje-internacional': {
    required: ['producto_id', 'destino', 'fecha_salida', 'fecha_regreso', 'viajeros'],
    properties: {
      producto_id: { type: 'string', const: 'viaje-internacional' },
      destino: { type: 'string', title: 'Destino', enum: ['Estados Unidos', 'España', 'México', 'Otro país'] },
      fecha_salida: { type: 'string', format: 'date', title: 'Fecha Salida' },
      fecha_regreso: { type: 'string', format: 'date', title: 'Fecha Regreso' },
      viajeros: { type: 'integer', title: 'Viajeros' },
    },
  },
  'vida-esencial': {
    required: ['producto_id', 'fecha_nacimiento', 'suma_asegurada', 'beneficiario', 'parentesco'],
    properties: {
      producto_id: { type: 'string', const: 'vida-esencial' },
      fecha_nacimiento: { type: 'string', format: 'date', title: 'Fecha Nacimiento' },
      suma_asegurada: { ...MONEY, title: 'Suma Asegurada' },
      beneficiario: { type: 'string', title: 'Beneficiario' },
      parentesco: { type: 'string', title: 'Parentesco', enum: ['Cónyuge', 'Hijo(a)', 'Padre / Madre', 'Otro'] },
    },
  },
  'parametrico-clima-vuelo': {
    required: ['producto_id', 'evento', 'referencia', 'fecha_evento', 'valor_indemnizar'],
    properties: {
      producto_id: { type: 'string', const: 'parametrico-clima-vuelo' },
      evento: { type: 'string', title: 'Evento', enum: ['Retraso de vuelo', 'Lluvia excesiva'] },
      referencia: { type: 'string', title: 'Referencia' },
      fecha_evento: { type: 'string', format: 'date', title: 'Fecha Evento' },
      valor_indemnizar: { ...MONEY, title: 'Valor Indemnizar' },
    },
  },
  'vida-hipotecario': {
    required: ['producto_id', 'fecha_nacimiento', 'entidad', 'valor_credito', 'plazo_anios'],
    properties: {
      producto_id: { type: 'string', const: 'vida-hipotecario' },
      fecha_nacimiento: { type: 'string', format: 'date', title: 'Fecha Nacimiento' },
      entidad: { type: 'string', title: 'Entidad' },
      valor_credito: { ...MONEY, title: 'Valor Credito' },
      plazo_anios: { type: 'integer', title: 'Plazo Anios' },
      consentimiento_id: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      consentimiento_open_finance: { anyOf: [{ $ref: '#/$defs/OpenFinanceConsent' }, { type: 'null' }] },
    },
  },
  hogar: {
    required: ['producto_id', 'suma_asegurada', 'edad'],
    properties: {
      producto_id: { type: 'string', const: 'hogar' },
      suma_asegurada: { ...MONEY, title: 'Suma Asegurada' },
      edad: { type: 'integer', title: 'Edad' },
    },
  },
};
