import { TextKey } from '../../../core/i18n/es';
import { Endorsement, Policy, PolicyClaim, PolicyPayment } from '../../../core/models/policy.model';

export interface PolicyCustomerDto {
  readonly tipo_documento: string;
  readonly numero_documento: string;
  readonly nombre: string;
  readonly apellido: string;
  readonly email: string;
  readonly telefono: string;
}

export interface InsuredDto {
  readonly nombre: string;
  readonly telefono: string;
  readonly correo: string;
  readonly direccion: string;
}

export interface PolicyEndorsementDto {
  readonly id: string;
  readonly tipo: string;
  readonly tipo_nombre?: string;
  readonly fecha_efectiva: string;
  readonly motivo: string;
  readonly usuario_id: string;
  readonly creado_en: string;
  readonly version_anterior: Partial<InsuredDto>;
  readonly version_nueva: Partial<InsuredDto>;
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
  readonly causa_cancelacion?: string | null;
  readonly fecha_cancelacion?: string | null;
  /** Datos vigentes del asegurado: el último endoso sobre Identidad. Solo viene en el detalle. */
  readonly asegurado?: InsuredDto;
  readonly endosos?: readonly PolicyEndorsementDto[];
  readonly pagos?: readonly PolicyPaymentDto[];
  readonly siniestros?: readonly PolicyClaimDto[];
  readonly beneficiarios?: readonly { readonly nombre: string; readonly parentesco: string; readonly porcentaje: number | string }[];
}

const NONE = '-';

function toPayment(dto: PolicyPaymentDto): PolicyPayment {
  return {
    ref: dto.id,
    date: (dto.creado_en ?? '').slice(0, 10),
    tipo: 'Prima',
    medio: NONE,
    amount: Number(dto.monto),
    status: dto.estado,
  };
}

function toClaim(dto: PolicyClaimDto): PolicyClaim {
  return {
    id: dto.radicado || dto.id,
    tipo: dto.tipo,
    fechaOcurrencia: dto.ocurrido_en.slice(0, 10),
    fechaAviso: (dto.creado_en ?? '').slice(0, 10),
    status: dto.estado,
  };
}

const INSURED_LABELS: readonly [keyof InsuredDto, TextKey][] = [
  ['nombre', 'endorsement.name'],
  ['telefono', 'endorsement.phone'],
  ['correo', 'endorsement.email'],
  ['direccion', 'endorsement.address'],
];

function toEndorsement(dto: PolicyEndorsementDto): Endorsement {
  const pairs = (version: Partial<InsuredDto>): [TextKey, string][] =>
    INSURED_LABELS.map(([key, label]): [TextKey, string] => [label, version[key] ?? NONE]);
  return {
    id: dto.id,
    tipo: dto.tipo_nombre ?? dto.tipo,
    fechaEfectiva: dto.fecha_efectiva,
    motivo: dto.motivo,
    usuario: dto.usuario_id,
    registrado: dto.creado_en,
    antes: pairs(dto.version_anterior),
    despues: pairs(dto.version_nueva),
  };
}

export function toPolicy(dto: PolicyDto): Policy {
  const customer = dto.cliente;
  const insured = dto.asegurado;
  const customerName = customer ? [customer.nombre, customer.apellido].filter(Boolean).join(' ') : NONE;
  return {
    id: dto.id,
    number: dto.numero,
    tipoDocumento: customer?.tipo_documento ?? '',
    identification: customer?.numero_documento ?? '',
    insuredName: insured?.nombre || customerName,
    ramo: dto.ramo_id ?? '',
    producto: dto.producto?.nombre ?? dto.producto_id,
    socioOrigen: dto.socio?.nombre ?? dto.canal,
    status: dto.estado,
    startDate: dto.vigencia.desde,
    endDate: dto.vigencia.hasta,
    premium: Number(dto.prima),
    cancelReason: dto.causa_cancelacion ?? undefined,
    cancelDate: dto.fecha_cancelacion ?? undefined,
    address: insured?.direccion || undefined,
    phone: insured?.telefono || customer?.telefono || NONE,
    email: insured?.correo || customer?.email || NONE,
    coverages: dto.coberturas.map((coverage) => ({
      name: coverage.nombre,
      sumaAsegurada: NONE,
      deducible: NONE,
      included: true,
    })),
    beneficiaries: (dto.beneficiarios ?? []).map((b) => ({
      name: b.nombre,
      parentesco: b.parentesco,
      porcentaje: Number(b.porcentaje),
    })),
    payments: (dto.pagos ?? []).map(toPayment),
    claims: (dto.siniestros ?? []).map(toClaim),
    endorsements: (dto.endosos ?? []).filter((e) => e.version_nueva?.nombre).map(toEndorsement),
  };
}
