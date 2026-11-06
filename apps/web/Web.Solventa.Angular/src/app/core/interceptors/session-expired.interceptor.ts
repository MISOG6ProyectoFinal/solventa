import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { AuthService } from '../services/auth.service';

const UNAUTHORIZED = 401;

/** Un 401 de la API (salvo el del inicio de sesión) cierra la sesión y lleva a `/login`. */
export const sessionExpiredInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: { status?: number }) => {
      const isApiCall = req.url.startsWith(environment.apiBaseUrl) && req.url !== API_ENDPOINTS.session.login;
      if (error.status === UNAUTHORIZED && isApiCall) {
        const returnUrl = router.url === '/' || router.url.startsWith('/login') ? undefined : router.url;
        auth.logout();
        void router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
      }
      return throwError(() => error);
    }),
  );
};
