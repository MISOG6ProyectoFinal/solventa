import { IconName } from '../../ui/constants/icons.constants';

export type RamoId =
  | 'VIAJE'
  | 'DISPOSITIVOS'
  | 'MICROSEGURO_VIDA'
  | 'PARAMETRICO'
  | 'PROTECCION_PAGOS'
  | 'VIDA_HIPOTECARIO';

export interface Ramo {
  readonly id: RamoId;
  readonly label: string;
  readonly icon: IconName;
  /** Requiere consentimiento OFD (OTP por SMS/Email) antes de cotizar. */
  readonly requiresConsent: boolean;
}
