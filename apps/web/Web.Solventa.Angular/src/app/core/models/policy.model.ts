export const ACTIVE_STATUS = 'activa';
export const CANCELLED_STATUS = 'cancelada';

export interface PolicyCoverage {
  name: string;
  sumaAsegurada?: string;
  deducible?: string;
  umbral?: string;
  included: boolean;
}

export interface Beneficiary {
  name: string;
  parentesco: string;
  porcentaje: number;
}

export interface PolicyPayment {
  ref: string;
  date: string;
  tipo: 'Prima' | 'Indemnización' | 'Devolución';
  medio?: string;
  amount: number;
  status: string;
}

export interface PolicyClaim {
  id: string;
  tipo: string;
  fechaOcurrencia: string;
  fechaAviso?: string;
  status: string;
  montoEstimado?: number;
  montoAprobado?: number;
  parametrico?: { fuente: string; valorObservado: string; umbral: string };
}

export interface Endorsement {
  id: string;
  tipo: string;
  fechaEfectiva: string;
  motivo: string;
  usuario: string;
  registrado: string;
  antes: [string, string][];
  despues: [string, string][];
  primaAjustada?: number;
}

export interface Policy {
  id: string;
  number: string;
  tipoDocumento: string;
  identification: string;
  insuredName: string;
  /** Id del ramo en el catálogo (`ramo-vida-hipotecario`); vacío si el producto no tiene ramo conocido. */
  ramo: string;
  producto: string;
  socioOrigen: string;
  status: string;
  startDate: string;
  endDate: string;
  premium: number;
  sumaAsegurada?: number;
  address?: string;
  phone: string;
  email: string;
  coverages: PolicyCoverage[];
  beneficiaries: Beneficiary[];
  payments: PolicyPayment[];
  claims: PolicyClaim[];
  endorsements: Endorsement[];
  cancelReason?: string;
  cancelDate?: string;
}
