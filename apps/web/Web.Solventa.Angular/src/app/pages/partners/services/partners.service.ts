import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { NewPartner, Partner, PartnerCreated } from '../../../core/models/partner.model';
import { SessionService } from '../../../core/services/session.service';
import { PartnerCreatedDto, PartnerDto, toNewPartnerDto, toPartner } from './partners-api.mapper';

@Injectable({ providedIn: 'root' })
export class PartnersService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);

  private readonly state = signal<Partner[]>([]);

  readonly partners = this.state.asReadonly();
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http.get<PartnerDto[]>(API_ENDPOINTS.partners).subscribe({
      next: (partners) => {
        this.state.set(partners.map(toPartner));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  findById(id: string | null): Partner | null {
    if (!id) return null;
    return this.state().find((p) => p.id === id) ?? null;
  }

  /** Da de alta el socio en el backend, que genera sus credenciales y activa el contrato. */
  create(partner: NewPartner): Observable<PartnerCreated> {
    const body = toNewPartnerDto(partner, this.session.userName());
    return this.http.post<PartnerCreatedDto>(API_ENDPOINTS.partners, body).pipe(
      map((dto) => ({ partner: toPartner(dto), secret: dto.secreto })),
      tap(({ partner: created }) => this.state.update((partners) => [created, ...partners])),
    );
  }

  updatePartner(updated: Partner): void {
    this.state.update((partners) => partners.map((p) => (p.id === updated.id ? updated : p)));
  }
}
