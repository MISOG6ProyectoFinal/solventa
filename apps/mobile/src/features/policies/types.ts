export type PolicyCoverage = {
  id: string;
  nombre: string;
};

export type PolicyTerm = {
  desde: string;
  hasta: string;
};

export type Policy = {
  id: string;
  numero: string;
  cotizacion_id: string;
  cobro_id: string;
  producto_id: string;
  prima: string;
  estado: string;
  vigencia: PolicyTerm;
  coberturas: PolicyCoverage[];
  renovable?: boolean;
};

export type RenewalOffer = {
  poliza_id: string;
  numero_poliza: string;
  producto_id: string;
  prima_actual: string;
  prima_propuesta: string;
  vigencia_actual: PolicyTerm;
  vigencia_propuesta: PolicyTerm;
  coberturas_propuestas: PolicyCoverage[];
};

export type RenewalPaymentStatus = 'aprobado' | 'rechazado' | 'procesando';

export type RenewalPaymentResult = {
  id: string;
  poliza_id: string;
  estado: RenewalPaymentStatus;
  monto: string;
  moneda: string;
};

export type RenewalPaymentSimulation = 'rechazado';
