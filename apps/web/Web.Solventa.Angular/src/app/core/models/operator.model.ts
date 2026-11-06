export type OperatorRole = 'administrador' | 'asesor' | 'consulta';

/** Operador autenticado en el portal. */
export interface SessionOperator {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly roles: readonly OperatorRole[];
}

/** Operador tal como lo administra la página de usuarios. */
export interface Operator extends SessionOperator {
  readonly active: boolean;
  readonly createdAt: string;
}

export interface NewOperator {
  readonly email: string;
  readonly name: string;
  readonly roles: readonly OperatorRole[];
  readonly password: string;
}

export interface OperatorChanges {
  readonly roles?: readonly OperatorRole[];
  readonly active?: boolean;
}
