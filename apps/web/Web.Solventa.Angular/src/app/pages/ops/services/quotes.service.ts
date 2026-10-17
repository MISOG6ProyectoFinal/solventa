import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { OfertaCotizacionResponse } from '../interfaces/quote-payload.interface';

export interface RamoCatalogDto {
  readonly id: string;
  readonly nombre: string;
}

/** Servicio HTTP para consultar catálogo y solicitar cotizaciones al BFF Web de Solventa. */
@Injectable({ providedIn: 'root' })
export class QuotesService {
  private readonly http = inject(HttpClient);

  getRamos(): Observable<readonly RamoCatalogDto[]> {
    return this.http.get<readonly RamoCatalogDto[]>(API_ENDPOINTS.ramos);
  }

  cotizar(payload: Record<string, unknown>): Observable<OfertaCotizacionResponse> {
    return this.http.post<OfertaCotizacionResponse>(API_ENDPOINTS.quotes, payload);
  }
}
