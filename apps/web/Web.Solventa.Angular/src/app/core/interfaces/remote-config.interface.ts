import { IconName } from '../../ui/constants/icons.constants';
import { TextKey } from '../i18n/es';
import { OperatorRole } from '../models/operator.model';

/** Descripción de un Micro Frontend remoto registrado en el shell. */
export interface RemoteConfig {
  /** Nombre en `federation.manifest.json`. */
  readonly name: string;
  /** Módulo expuesto por el remoto (ej. `./Component`). */
  readonly exposed: string;
  /** Ruta del shell donde se monta. */
  readonly path: string;
  /** Clave i18n de la etiqueta del menú y del título de respaldo. */
  readonly labelKey: TextKey;
  /** Ícono del menú lateral. */
  readonly icon: IconName;
  /** Atributo `data-testid` del ítem de menú. */
  readonly testId: string;
  /** Roles que ven el ítem y entran a la ruta; sin valor lo ven todos. */
  readonly roles?: readonly OperatorRole[];
}
