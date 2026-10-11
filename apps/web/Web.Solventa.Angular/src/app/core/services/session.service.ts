import { Injectable, signal } from '@angular/core';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';

const DEFAULT_USER_NAME = 'Ana Gómez';

/** Operador que usa el portal. Lo fija el inicio de sesión; hasta entonces aplica el operador por defecto. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  readonly userName = signal(sessionStorage.getItem(STORAGE_KEYS.userName) ?? DEFAULT_USER_NAME);
}
