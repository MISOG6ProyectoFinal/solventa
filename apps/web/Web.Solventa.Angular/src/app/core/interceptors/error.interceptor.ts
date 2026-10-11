import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../interfaces/api-response.interface';

/** Normaliza cualquier error HTTP a `ApiError`. El backend responde `{ detail: string | { codigo, mensaje } }`. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((err: HttpErrorResponse) => throwError(() => toApiError(err))));

function toApiError(err: HttpErrorResponse): ApiError {
  const detail = err.error?.detail;
  const message = typeof detail === 'string' ? detail : detail?.mensaje;
  return {
    status: err.status,
    code: typeof detail === 'object' ? detail?.codigo : undefined,
    message: message ?? err.error?.message ?? err.message ?? 'Error de red',
    details: err.error,
  };
}
