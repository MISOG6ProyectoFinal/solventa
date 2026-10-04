import { RamoId } from '../../../core/models/ramo.model';
import { QuoteFieldDef } from '../interfaces/quote-field.interface';

/** Campos comunes del cliente (espejo de `clientFields` en los mockups). */
export const QUOTE_CLIENT_FIELDS: readonly QuoteFieldDef[] = [
  { key: 'tipoDocumento', label: 'Tipo de documento', type: 'select', required: true, options: ['CC', 'CE', 'Pasaporte'] },
  { key: 'numeroDocumento', label: 'Número de documento', type: 'text', required: true, placeholder: '1020304050' },
  { key: 'nombre', label: 'Nombre completo', type: 'text', required: true },
  { key: 'email', label: 'Correo', type: 'email', required: true },
  { key: 'telefono', label: 'Celular', type: 'text', required: true, placeholder: '3001234567' },
];

/** Campos de riesgo por ramo (espejo de `ramoFields` en los mockups). */
export const QUOTE_RISK_FIELDS: Record<RamoId, readonly QuoteFieldDef[]> = {
  VIAJE: [
    { key: 'destino', label: 'Destino', type: 'select', required: true, options: ['Estados Unidos', 'España', 'México', 'Otro país'] },
    { key: 'fechaSalida', label: 'Fecha de salida', type: 'date', required: true },
    { key: 'fechaRegreso', label: 'Fecha de regreso', type: 'date', required: true },
    { key: 'viajeros', label: 'Número de viajeros', type: 'text', required: true, placeholder: '1' },
    { key: 'fechaNacimiento', label: 'Fecha de nacimiento del titular', type: 'date', required: true },
  ],
  DISPOSITIVOS: [
    { key: 'tipoDispositivo', label: 'Tipo de dispositivo', type: 'select', required: true, options: ['Celular', 'Portátil', 'Tablet'] },
    { key: 'marcaModelo', label: 'Marca y modelo', type: 'text', required: true, placeholder: 'Samsung Galaxy S25' },
    { key: 'imei', label: 'IMEI / serial', type: 'text', required: true },
    { key: 'valorComercial', label: 'Valor comercial (COP)', type: 'text', required: true },
  ],
  MICROSEGURO_VIDA: [
    { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date', required: true },
    { key: 'sumaAsegurada', label: 'Suma asegurada (COP)', type: 'text', required: true, placeholder: '15000000' },
    { key: 'beneficiario', label: 'Beneficiario', type: 'text', required: true },
    { key: 'parentesco', label: 'Parentesco', type: 'select', required: true, options: ['Cónyuge', 'Hijo(a)', 'Padre / Madre', 'Otro'] },
  ],
  PARAMETRICO: [
    { key: 'evento', label: 'Evento asegurado', type: 'select', required: true, options: ['Retraso de vuelo', 'Lluvia excesiva'] },
    { key: 'referencia', label: 'Vuelo / zona de referencia', type: 'text', required: true, placeholder: 'AN-412' },
    { key: 'fechaEvento', label: 'Fecha del evento', type: 'date', required: true },
    { key: 'valorIndemnizar', label: 'Valor a indemnizar (COP)', type: 'text', required: true },
  ],
  PROTECCION_PAGOS: [
    { key: 'entidad', label: 'Entidad financiera', type: 'text', required: true, placeholder: 'Banco Aurora' },
    { key: 'numeroCredito', label: 'Número de crédito', type: 'text', required: true },
    { key: 'cuotaMensual', label: 'Cuota mensual (COP)', type: 'text', required: true },
    { key: 'plazoMeses', label: 'Plazo (meses)', type: 'text', required: true },
  ],
  VIDA_HIPOTECARIO: [
    { key: 'fechaNacimiento', label: 'Fecha de nacimiento', type: 'date', required: true },
    { key: 'entidad', label: 'Entidad financiera', type: 'text', required: true, placeholder: 'Banco Aurora' },
    { key: 'valorCredito', label: 'Valor del crédito hipotecario (COP)', type: 'text', required: true },
    { key: 'plazoAnios', label: 'Plazo del crédito (años)', type: 'text', required: true },
  ],
};
