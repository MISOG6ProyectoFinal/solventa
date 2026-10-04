import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';

/** Adjunta el token Bearer solo a las peticiones dirigidas a la API de Solventa. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiBaseUrl)) return next(req);

  const token = sessionStorage.getItem(STORAGE_KEYS.accessToken);
  return token ? next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })) : next(req);
};
