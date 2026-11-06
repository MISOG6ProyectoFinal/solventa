import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { Ramo } from '../../../core/models/ramo.model';
import { OfertaCotizacionResponse } from '../interfaces/quote-payload.interface';
import { ProductContract } from '../interfaces/product-contract.interface';

interface RamoDto {
  readonly id: string;
  readonly nombre: string;
  readonly requiere_consentimiento: boolean;
  readonly productos: readonly { id: string; nombre: string; requiere_consentimiento: boolean }[];
}

/** Servicio HTTP para consultar catálogo y solicitar cotizaciones al BFF Web de Solventa. */
@Injectable({ providedIn: 'root' })
export class QuotesService {
  private readonly http = inject(HttpClient);

  getRamos(): Observable<readonly Ramo[]> {
    return this.http.get<readonly RamoDto[]>(API_ENDPOINTS.ramos).pipe(
      map((ramos) =>
        ramos.map((ramo) => ({
          id: ramo.id,
          name: ramo.nombre,
          requiresConsent: ramo.requiere_consentimiento,
          products: ramo.productos.map((product) => ({
            id: product.id,
            name: product.nombre,
            requiresConsent: product.requiere_consentimiento,
          })),
        })),
      ),
    );
  }

  getContract(productId: string): Observable<ProductContract> {
    return this.http.get<ProductContract>(API_ENDPOINTS.productContract(productId));
  }

  cotizar(payload: Record<string, unknown>): Observable<OfertaCotizacionResponse> {
    return this.http.post<OfertaCotizacionResponse>(API_ENDPOINTS.quotes, payload);
  }
}
