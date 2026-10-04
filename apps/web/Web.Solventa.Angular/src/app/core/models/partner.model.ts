import { RamoId } from './ramo.model';

export type Alcance = 'cotizacion' | 'emision' | 'consulta';

export type PartnerType = 'Banco' | 'Aerolínea' | 'E-commerce' | 'Fintech' | 'Retailer';

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
  enabledRamos: RamoId[];
  coveragesByRamo: Record<RamoId, string[]>;
  altaFecha: string;
  altaUsuario: string;
}
