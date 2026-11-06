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

export const CONTRACTS: Record<string, ProductContract> = {
  'viaje-internacional': {
    properties: {
      destino: { type: 'string', enum: ['Estados Unidos', 'España', 'México', 'Otro país'] },
      fecha_salida: { type: 'string' },
      viajeros: { type: 'integer' },
    },
  },
  'vida-esencial': {
    properties: {
      suma_asegurada: { anyOf: [{ type: 'number' }, { type: 'string' }] },
      parentesco: { type: 'string', enum: ['Cónyuge', 'Hijo(a)', 'Padre / Madre', 'Otro'] },
    },
  },
  'parametrico-clima-vuelo': {
    properties: {
      evento: { type: 'string', enum: ['Retraso de vuelo', 'Lluvia excesiva'] },
      valor_indemnizar: { anyOf: [{ type: 'number' }, { type: 'string' }] },
    },
  },
  'vida-hipotecario': {
    properties: {
      valor_credito: { anyOf: [{ type: 'number' }, { type: 'string' }] },
      plazo_anios: { type: 'integer' },
    },
  },
};
