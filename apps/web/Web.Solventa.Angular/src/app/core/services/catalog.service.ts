import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, shareReplay } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { CancellationCause } from '../models/catalog.model';

interface OptionDto {
  readonly id: string;
  readonly nombre: string;
}

interface CancellationCauseDto extends OptionDto {
  readonly reembolsable: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);

  readonly documentTypes$ = this.http.get<readonly string[]>(API_ENDPOINTS.documentTypes).pipe(shareReplay(1));
  readonly partnerTypes$ = this.http.get<readonly string[]>(API_ENDPOINTS.partnerTypes).pipe(shareReplay(1));
  readonly partnerScopes$ = this.http.get<readonly string[]>(API_ENDPOINTS.partnerScopes).pipe(shareReplay(1));
  readonly policyStatuses$: Observable<readonly string[]> = this.http
    .get<readonly OptionDto[]>(API_ENDPOINTS.policyStatuses)
    .pipe(
      map((statuses) => statuses.map((status) => status.id)),
      shareReplay(1),
    );
  readonly cancellationCauses$: Observable<readonly CancellationCause[]> = this.http
    .get<readonly CancellationCauseDto[]>(API_ENDPOINTS.cancellationCauses)
    .pipe(
      map((causes) => causes.map(({ id, nombre, reembolsable }) => ({ id, name: nombre, refundable: reembolsable }))),
      shareReplay(1),
    );
}
