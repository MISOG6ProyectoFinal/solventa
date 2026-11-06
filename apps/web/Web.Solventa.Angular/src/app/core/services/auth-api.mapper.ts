import { OPERATOR_ROLES } from '../constants/roles.constants';
import { OperatorRole, SessionOperator } from '../models/operator.model';

/** Operador tal como lo entrega el BFF web (`/web/sesiones`). */
export interface SessionOperatorDto {
  id: string;
  correo: string;
  nombre: string;
  roles: string[];
}

export interface LoginResponseDto {
  token: string;
  operador: SessionOperatorDto;
}

export function toRoles(roles: readonly string[]): OperatorRole[] {
  return OPERATOR_ROLES.filter((role) => roles.includes(role));
}

export function toSessionOperator(dto: SessionOperatorDto): SessionOperator {
  return { id: dto.id, email: dto.correo, name: dto.nombre, roles: toRoles(dto.roles) };
}
