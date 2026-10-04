import { IconName } from '../../ui/constants/icons.constants';
import { Ramo, RamoId } from '../../core/models/ramo.model';
import { Alcance, PartnerType } from '../../core/models/partner.model';

/** Catálogo de ramos (6) con su ícono y si requiere consentimiento OFD. */
export const RAMOS: readonly Ramo[] = [
  { id: 'VIAJE', label: 'Viaje', icon: 'viaje', requiresConsent: false },
  { id: 'DISPOSITIVOS', label: 'Protección de dispositivos', icon: 'dispositivos', requiresConsent: false },
  { id: 'MICROSEGURO_VIDA', label: 'Microseguro de vida', icon: 'microseguroVida', requiresConsent: false },
  { id: 'PARAMETRICO', label: 'Paramétrico (clima / vuelo)', icon: 'parametrico', requiresConsent: false },
  { id: 'PROTECCION_PAGOS', label: 'Protección de pagos', icon: 'proteccionPagos', requiresConsent: true },
  { id: 'VIDA_HIPOTECARIO', label: 'Vida hipotecario', icon: 'vidaHipotecario', requiresConsent: true },
];

export const RAMO_ICON: Record<RamoId, IconName> = {
  VIAJE: 'viaje',
  DISPOSITIVOS: 'dispositivos',
  MICROSEGURO_VIDA: 'microseguroVida',
  PARAMETRICO: 'parametrico',
  PROTECCION_PAGOS: 'proteccionPagos',
  VIDA_HIPOTECARIO: 'vidaHipotecario',
};

export const COVERAGE_CATALOG: Record<RamoId, readonly string[]> = {
  VIAJE: ['Gastos médicos en el exterior', 'Cancelación de viaje', 'Pérdida de equipaje', 'Asistencia en viaje'],
  DISPOSITIVOS: ['Daño accidental', 'Robo', 'Daño por líquidos', 'Garantía extendida'],
  MICROSEGURO_VIDA: ['Fallecimiento', 'Auxilio funerario', 'Incapacidad total y permanente'],
  PARAMETRICO: ['Retraso de vuelo', 'Lluvia excesiva', 'Sequía'],
  PROTECCION_PAGOS: ['Desempleo involuntario', 'Incapacidad temporal', 'Fallecimiento (saldo de la deuda)'],
  VIDA_HIPOTECARIO: ['Fallecimiento (saldo del crédito)', 'Incapacidad total y permanente', 'Enfermedades graves'],
};

export const ALCANCES: readonly { id: Alcance; label: string }[] = [
  { id: 'cotizacion', label: 'Cotización' },
  { id: 'emision', label: 'Emisión' },
  { id: 'consulta', label: 'Consulta de pólizas y siniestros' },
];

export const PARTNER_TYPES: readonly PartnerType[] = ['Banco', 'Aerolínea', 'E-commerce', 'Fintech', 'Retailer'];
