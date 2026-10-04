import { RamoId } from './ramo.model';

export type PolicyStatus = 'Activa' | 'Cancelada' | 'Vencida';

export type ClaimStatus = 'Reportado' | 'En revisión' | 'Aprobado' | 'Pagado' | 'Rechazado' | 'Cerrado';

export interface PolicyCoverage {
  name: string;
  sumaAsegurada: string;
  deducible: string;
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
  medio: string;
  amount: number;
  status: 'Aprobado' | 'Pendiente' | 'Rechazado';
}

export interface PolicyClaim {
  id: string;
  tipo: string;
  fechaOcurrencia: string;
  fechaAviso: string;
  status: ClaimStatus;
  montoEstimado: number;
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
  ramo: RamoId;
  producto: string;
  socioOrigen: string;
  status: PolicyStatus;
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
