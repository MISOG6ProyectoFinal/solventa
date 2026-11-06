import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OperatorRole } from '../models/operator.model';
import { AuthService } from '../services/auth.service';

/** Exige alguno de los roles de `data.roles` de la ruta; sin ese dato la ruta es para todos. */
export const roleGuard: CanActivateFn = (route) => {
  const roles = (route.data['roles'] as readonly OperatorRole[] | undefined) ?? [];
  if (roles.length === 0 || inject(AuthService).hasRole(...roles)) return true;
  return inject(Router).createUrlTree(['/ops']);
};
