import { NewOperator, Operator, OperatorChanges, OperatorRole } from '../../../core/models/operator.model';
import { toRoles } from '../../../core/services/auth-api.mapper';

/** Operador tal como lo entrega el BFF web (`/web/operadores`). */
export interface OperatorDto {
  id: string;
  correo: string;
  nombre: string;
  roles: string[];
  activo: boolean;
  creado_en: string;
}

export interface NewOperatorDto {
  correo: string;
  nombre: string;
  roles: OperatorRole[];
  contrasena: string;
}

export interface OperatorChangesDto {
  roles?: OperatorRole[];
  activo?: boolean;
}

export function toOperator(dto: OperatorDto): Operator {
  return {
    id: dto.id,
    email: dto.correo,
    name: dto.nombre,
    roles: toRoles(dto.roles),
    active: dto.activo,
    createdAt: dto.creado_en,
  };
}

export function toNewOperatorDto(operator: NewOperator): NewOperatorDto {
  return {
    correo: operator.email,
    nombre: operator.name,
    roles: [...operator.roles],
    contrasena: operator.password,
  };
}

export function toOperatorChangesDto(changes: OperatorChanges): OperatorChangesDto {
  return {
    ...(changes.roles ? { roles: [...changes.roles] } : {}),
    ...(changes.active === undefined ? {} : { activo: changes.active }),
  };
}
