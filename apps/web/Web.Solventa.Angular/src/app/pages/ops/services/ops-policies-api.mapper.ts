import { ClaimStatus, Policy, PolicyClaim, PolicyPayment, PolicyStatus } from '../../../core/models/policy.model';

export interface PolicyCustomerDto {
  readonly tipo_documento: string;
  readonly numero_documento: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string;
}

export interface PolicyPaymentDto {
  readonly id: string;
  readonly estado: string;
  readonly monto: string;
  readonly creado_en?: string;
}

export interface PolicyClaimDto {
  readonly id: string;
  readonly radicado?: string | null;
  readonly estado: string;
  readonly tipo: string;
  readonly ocurrido_en: string;
  readonly creado_en?: string;
}

/** Póliza como la arma el BFF Web: la de Pólizas con el asegurado, el socio, el producto y su ramo. */
export interface PolicyDto {
  readonly id: string;
  readonly numero: string;
  readonly estado: string;
  readonly producto_id: string;
  readonly prima: string;
  readonly coberturas: readonly { id: string; nombre: string }[];
  readonly vigencia: { desde: string; hasta: string };
  readonly canal: string;
  readonly cliente: PolicyCustomerDto | null;
  readonly socio: { id: string; nombre: string } | null;
  readonly producto: { id: string; nombre: string } | null;
  readonly ramo_id: string | null;
  readonly pagos?: readonly PolicyPaymentDto[];
  readonly siniestros?: readonly PolicyClaimDto[];
}

const POLICY_STATUS: Record<string, PolicyStatus> = { activa: 'Activa', vencida: 'Vencida', cancelada: 'Cancelada' };
const PAYMENT_STATUS: Record<string, PolicyPayment['status']> = { aprobado: 'Aprobado', rechazado: 'Rechazado' };
const CLAIM_STATUS: Record<string, ClaimStatus> = { borrador: 'Reportado', radicado: 'En revisión' };
const NONE = '-';

/** `ramo-vida-hipotecario` → `VIDA_HIPOTECARIO`, la clave del ramo en el portal. */
export function toRamoId(ramoId: string | null): string {
  return ramoId ? ramoId.replace(/^ramo-/, '').toUpperCase().replace(/-/g, '_') : '';
}

function toPayment(dto: PolicyPaymentDto): PolicyPayment {
  return {
    ref: dto.id,
    date: (dto.creado_en ?? '').slice(0, 10),
    tipo: 'Prima',
    medio: NONE,
    amount: Number(dto.monto),
    status: PAYMENT_STATUS[dto.estado] ?? 'Pendiente',
  };
}

function toClaim(dto: PolicyClaimDto): PolicyClaim {
  return {
    id: dto.radicado || dto.id,
    tipo: dto.tipo,
    fechaOcurrencia: dto.ocurrido_en.slice(0, 10),
    fechaAviso: (dto.creado_en ?? '').slice(0, 10),
    status: CLAIM_STATUS[dto.estado] ?? 'Reportado',
  };
}

export function toPolicy(dto: PolicyDto): Policy {
  const customer = dto.cliente;
  return {
    id: dto.id,
    number: dto.numero,
    tipoDocumento: customer?.tipo_documento ?? '',
    identification: customer?.numero_documento ?? '',
    insuredName: customer ? [customer.nombre, customer.apellido].filter(Boolean).join(' ') : NONE,
    ramo: toRamoId(dto.ramo_id),
    producto: dto.producto?.nombre ?? dto.producto_id,
    socioOrigen: dto.socio?.nombre ?? dto.canal,
    status: POLICY_STATUS[dto.estado] ?? 'Activa',
    startDate: dto.vigencia.desde,
    endDate: dto.vigencia.hasta,
    premium: Number(dto.prima),
    phone: customer?.telefono || NONE,
    email: customer?.email || NONE,
    coverages: dto.coberturas.map((coverage) => ({
      name: coverage.nombre,
      sumaAsegurada: NONE,
      deducible: NONE,
      included: true,
    })),
    beneficiaries: [],
    payments: (dto.pagos ?? []).map(toPayment),
    claims: (dto.siniestros ?? []).map(toClaim),
    endorsements: [],
  };
}
