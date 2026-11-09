export type PolicyCoverage = {
  id: string;
  nombre: string;
};

export type PolicyTerm = {
  desde: string;
  hasta: string;
};

export type AppliedRenewal = {
  estado: 'aplicada';
  cobro_id: string;
  vigencia_nueva: PolicyTerm;
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
  renovacion?: AppliedRenewal | null;
};

export type RenewalResult = {
  poliza_id: string;
  numero_poliza: string;
  producto_id: string;
  estado: 'aplicada';
  cobro_id: string;
  vigencia_anterior: PolicyTerm;
  vigencia_nueva: PolicyTerm;
  coberturas: PolicyCoverage[];
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
