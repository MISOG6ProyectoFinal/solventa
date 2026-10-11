import { PartnerConfigDto, PartnerCreatedDto, PartnerDto } from '../services/partners-api.mapper';

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
  ramos_habilitados: [],
};

export const PARTNER_CONFIG_DTO: PartnerConfigDto = {
  socio_id: 's-1',
  ramos: [
    {
      id: 'ramo-viaje',
      nombre: 'Viaje',
      habilitado: false,
      coberturas: [
        { id: 'viaje-gastos-medicos', nombre: 'Gastos médicos en el exterior', habilitada: false },
        { id: 'viaje-cancelacion', nombre: 'Cancelación de viaje', habilitada: false },
      ],
    },
    {
      id: 'ramo-proteccion-pagos',
      nombre: 'Protección de pagos',
      habilitado: true,
      coberturas: [
        { id: 'pagos-desempleo', nombre: 'Desempleo involuntario', habilitada: true },
        { id: 'pagos-incapacidad-temporal', nombre: 'Incapacidad temporal', habilitada: false },
      ],
    },
  ],
  actualizado_en: '2026-10-01T09:00:00',
  actualizado_por: 'Carlos Ruiz',
};

export const PARTNER_CREATED_DTO: PartnerCreatedDto = { ...PARTNER_DTO, secreto: 'sv_sec_wp3wshvykwi' };
