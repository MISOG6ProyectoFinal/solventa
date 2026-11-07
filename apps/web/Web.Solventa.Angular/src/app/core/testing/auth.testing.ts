import { STORAGE_KEYS } from '../constants/storage-keys.constants';
import { OperatorRole, SessionOperator } from '../models/operator.model';

/** Deja una sesión en `sessionStorage` antes de crear `AuthService`, igual que tras un inicio de sesión. */
export function signInAs(roles: readonly OperatorRole[] = ['administrador'], name = 'Ana Gómez', id = 'op-test'): SessionOperator {
  const operator: SessionOperator = { id, email: 'ana@solventa.co', name, roles };
  sessionStorage.setItem(STORAGE_KEYS.accessToken, 'test-token');
  sessionStorage.setItem(STORAGE_KEYS.operator, JSON.stringify(operator));
  return operator;
}

export function signOut(): void {
  sessionStorage.removeItem(STORAGE_KEYS.accessToken);
  sessionStorage.removeItem(STORAGE_KEYS.operator);
}
