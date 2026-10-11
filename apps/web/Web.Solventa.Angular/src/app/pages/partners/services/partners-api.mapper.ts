import { Alcance, NewPartner, Partner, PartnerType } from '../../../core/models/partner.model';

/** Socio tal como lo entrega el BFF web (`/web/socios`). */
export interface PartnerDto {
  id: string;
  nombre: string;
  identificador: string;
  tipo: PartnerType;
  pais: string;
  correo_contacto: string;
  alcances: Alcance[];
  client_id: string;
  secreto_enmascarado: string;
  estado_credencial: Partner['credentialStatus'];
  estado_contrato: Partner['apiContractStatus'];
  version_contrato: string;
  cuota_consumo: number;
  alta_fecha: string;
  alta_usuario: string;
}

export interface PartnerCreatedDto extends PartnerDto {
  secreto: string;
}

export interface NewPartnerDto {
  nombre: string;
  identificador: string;
  tipo: PartnerType;
  pais: string;
  correo_contacto: string;
  alcances: Alcance[];
  autorizado_por: string;
}

export function toPartner(dto: PartnerDto): Partner {
  return {
    id: dto.id,
    name: dto.nombre,
    identifier: dto.identificador,
    tipo: dto.tipo,
    pais: dto.pais,
    contactEmail: dto.correo_contacto,
    alcances: dto.alcances,
    clientId: dto.client_id,
    secret: dto.secreto_enmascarado,
    credentialStatus: dto.estado_credencial,
    apiContractStatus: dto.estado_contrato,
    versionContratoApi: dto.version_contrato,
    cuotaConsumo: dto.cuota_consumo,
    enabledRamos: [],
    coveragesByRamo: {
      VIAJE: [],
      DISPOSITIVOS: [],
      MICROSEGURO_VIDA: [],
      PARAMETRICO: [],
      PROTECCION_PAGOS: [],
      VIDA_HIPOTECARIO: [],
    },
    altaFecha: formatTimestamp(dto.alta_fecha),
    altaUsuario: dto.alta_usuario,
  };
}

export function toNewPartnerDto(partner: NewPartner, authorizedBy: string): NewPartnerDto {
  return {
    nombre: partner.name.trim(),
    identificador: partner.identifier.trim(),
    tipo: partner.tipo,
    pais: partner.pais,
    correo_contacto: partner.contactEmail.trim(),
    alcances: partner.alcances,
    autorizado_por: authorizedBy,
  };
}

/** `2026-09-12T18:00:00Z` → `2026-09-12 13:00` en la hora local del operador. */
export function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
