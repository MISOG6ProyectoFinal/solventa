import { Alcance, NewPartner, Partner, PartnerConfig, PartnerType } from '../../../core/models/partner.model';

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
  ramos_habilitados: { id: string; nombre: string }[];
}

/** Configuración del socio tal como la entrega `/web/socios/{id}/configuracion`. */
export interface PartnerConfigDto {
  socio_id: string;
  ramos: {
    id: string;
    nombre: string;
    habilitado: boolean;
    coberturas: { id: string; nombre: string; habilitada: boolean }[];
  }[];
  actualizado_en: string | null;
  actualizado_por: string | null;
}

export interface PartnerConfigUpdateDto {
  ramos: { ramo_id: string; coberturas: string[] }[];
  actualizado_por: string;
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
    enabledRamos: dto.ramos_habilitados.map((ramo) => ({ id: ramo.id, name: ramo.nombre })),
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

export function toPartnerConfig(dto: PartnerConfigDto): PartnerConfig {
  return {
    ramos: dto.ramos.map((ramo) => ({
      id: ramo.id,
      name: ramo.nombre,
      enabled: ramo.habilitado,
      coverages: ramo.coberturas.map((c) => ({ id: c.id, name: c.nombre, enabled: c.habilitada })),
    })),
    updatedAt: dto.actualizado_en ? formatTimestamp(dto.actualizado_en) : null,
    updatedBy: dto.actualizado_por,
  };
}

/** El backend recibe solo los ramos habilitados; un ramo ausente queda deshabilitado. */
export function toPartnerConfigUpdateDto(config: PartnerConfig, updatedBy: string): PartnerConfigUpdateDto {
  return {
    ramos: config.ramos
      .filter((ramo) => ramo.enabled)
      .map((ramo) => ({
        ramo_id: ramo.id,
        coberturas: ramo.coverages.filter((c) => c.enabled).map((c) => c.id),
      })),
    actualizado_por: updatedBy,
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
