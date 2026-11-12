import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import {
  CredentialEvent,
  NewPartner,
  Partner,
  PartnerConfig,
  PartnerCreated,
  PartnerQuotaUsage,
  RotatedCredential,
} from '../../../core/models/partner.model';
import { SessionService } from '../../../core/services/session.service';
import {
  CredentialEventDto,
  PartnerConfigDto,
  PartnerCreatedDto,
  PartnerDto,
  PartnerQuotaUsageDto,
  RotatedCredentialDto,
  toCredentialEvent,
  toNewPartnerDto,
  toPartner,
  toPartnerConfig,
  toPartnerConfigUpdateDto,
  toPartnerQuotaUsage,
  toRotatedCredential,
} from './partners-api.mapper';

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

  loadConfig(partnerId: string): Observable<PartnerConfig> {
    return this.http.get<PartnerConfigDto>(API_ENDPOINTS.partnerConfig(partnerId)).pipe(map(toPartnerConfig));
  }

  /** Reemplaza la configuración del socio. Aplica a sus siguientes solicitudes. */
  saveConfig(partnerId: string, config: PartnerConfig): Observable<PartnerConfig> {
    const body = toPartnerConfigUpdateDto(config, this.session.userName());
    return this.http.put<PartnerConfigDto>(API_ENDPOINTS.partnerConfig(partnerId), body).pipe(
      map(toPartnerConfig),
      tap((saved) => this.setEnabledRamos(partnerId, saved)),
    );
  }

  loadUsage(partnerId: string): Observable<PartnerQuotaUsage> {
    return this.http.get<PartnerQuotaUsageDto>(API_ENDPOINTS.partnerUsage(partnerId)).pipe(map(toPartnerQuotaUsage));
  }

  /** La nueva cuota aplica desde la siguiente llamada del socio. */
  updateQuota(partnerId: string, quota: number): Observable<Partner> {
    return this.http.put<PartnerDto>(API_ENDPOINTS.partnerQuota(partnerId), { cuota_consumo: quota }).pipe(
      map(toPartner),
      tap((updated) => this.replace(updated)),
    );
  }

  /** Emite un secreto nuevo; el anterior sigue válido durante la ventana de gracia. */
  rotateCredential(partnerId: string, graceMinutes: number): Observable<RotatedCredential> {
    const url = `${API_ENDPOINTS.partnerCredential(partnerId)}/rotacion`;
    return this.http.post<RotatedCredentialDto>(url, { gracia_minutos: graceMinutes }).pipe(
      map(toRotatedCredential),
      tap(({ partner }) => this.replace(partner)),
    );
  }

  /** Desde este momento el socio no puede llamar la API con su credencial. */
  revokeCredential(partnerId: string): Observable<Partner> {
    const url = `${API_ENDPOINTS.partnerCredential(partnerId)}/revocacion`;
    return this.http.post<PartnerDto>(url, {}).pipe(map(toPartner), tap((partner) => this.replace(partner)));
  }

  loadCredentialEvents(partnerId: string): Observable<CredentialEvent[]> {
    const url = `${API_ENDPOINTS.partnerCredential(partnerId)}/eventos`;
    return this.http.get<CredentialEventDto[]>(url).pipe(map((events) => events.map(toCredentialEvent)));
  }

  private replace(updated: Partner): void {
    this.state.update((partners) => partners.map((p) => (p.id === updated.id ? updated : p)));
  }

  private setEnabledRamos(partnerId: string, config: PartnerConfig): void {
    const enabledRamos = config.ramos.filter((ramo) => ramo.enabled).map(({ id, name }) => ({ id, name }));
    this.state.update((partners) => partners.map((p) => (p.id === partnerId ? { ...p, enabledRamos } : p)));
  }
}
