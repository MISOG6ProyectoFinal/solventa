export type Alcance = 'cotizacion' | 'emision' | 'consulta';

export type PartnerType = 'Banco' | 'Aerolínea' | 'E-commerce' | 'Fintech' | 'Retailer';

/** Ramo del canal embebido, identificado por el catálogo del backend. */
export interface PartnerRamo {
  id: string;
  name: string;
}

export interface PartnerCoverageConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export interface PartnerRamoConfig extends PartnerRamo {
  enabled: boolean;
  coverages: PartnerCoverageConfig[];
}

/** Ramos y coberturas que el socio puede vender, con la traza del último cambio. */
export interface PartnerConfig {
  ramos: PartnerRamoConfig[];
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface Partner {
  id: string;
  name: string;
  identifier: string;
  tipo: PartnerType;
  pais: string;
  contactEmail: string;
  alcances: Alcance[];
  clientId: string;
  secret: string;
  credentialStatus: 'Activa' | 'Revocada';
  apiContractStatus: 'Activo' | 'Suspendido';
  versionContratoApi: string;
  cuotaConsumo: number;
  enabledRamos: PartnerRamo[];
  altaFecha: string;
  altaUsuario: string;
}

/** Datos que captura el formulario de alta. */
export interface NewPartner {
  name: string;
  identifier: string;
  tipo: PartnerType;
  pais: string;
  contactEmail: string;
  alcances: Alcance[];
}

/** Resultado del alta: única vez que el secreto llega en claro. */
export interface PartnerCreated {
  partner: Partner;
  secret: string;
}
