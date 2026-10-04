import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../interfaces/api-response.interface';

/** Normaliza cualquier error HTTP a `ApiError`. */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const apiError: ApiError = {
        status: err.status,
        message: err.error?.message ?? err.message ?? 'Error de red',
        details: err.error,
      };
      return throwError(() => apiError);
    }),
  );
