import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

/** Operador que usa el portal. Su nombre queda como responsable en las operaciones auditadas. */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AuthService);

  readonly userName = computed(() => this.auth.operator()?.name ?? '');
}
