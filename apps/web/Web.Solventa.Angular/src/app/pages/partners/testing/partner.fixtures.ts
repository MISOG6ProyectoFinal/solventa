import { PartnerCreatedDto, PartnerDto } from '../services/partners-api.mapper';

export const PARTNER_DTO: PartnerDto = {
  id: 's-1',
  nombre: 'Fintech Demo',
  identificador: 'FINTECH-DEMO',
  tipo: 'Fintech',
  pais: 'Colombia',
  correo_contacto: 'ops@fintech.demo',
  alcances: ['cotizacion', 'emision', 'consulta'],
  client_id: 'sv_live_fintechdemo_ab12',
  secreto_enmascarado: 'sv_sec_••••••••ykwi',
  estado_credencial: 'Activa',
  estado_contrato: 'Activo',
  version_contrato: 'v2',
  cuota_consumo: 1000,
  alta_fecha: '2026-09-12T13:00:00',
  alta_usuario: 'Ana Gómez',
};

export const PARTNER_CREATED_DTO: PartnerCreatedDto = { ...PARTNER_DTO, secreto: 'sv_sec_wp3wshvykwi' };
