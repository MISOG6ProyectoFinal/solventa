import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { Policy } from '../../../core/models/policy.model';
import { CancellationQuote } from '../interfaces/cancellation-quote.interface';
import { EndorsementDraft } from '../interfaces/endorsement-draft.interface';
import { PolicyDto, toPolicy } from './ops-policies-api.mapper';

/** Pólizas del módulo Ops: las últimas de todos los canales, leídas del BFF Web. */
@Injectable({ providedIn: 'root' })
export class OpsPoliciesService {
  private readonly http = inject(HttpClient);
  private readonly state = signal<readonly Policy[]>([]);
  private readonly detail = signal<Policy | null>(null);

  readonly policies = this.state.asReadonly();
  readonly selected = this.detail.asReadonly();
  readonly partners = computed(() => [...new Set(this.state().map((policy) => policy.socioOrigen).filter(Boolean))]);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly detailLoading = signal(false);

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http.get<PolicyDto[]>(API_ENDPOINTS.policies).subscribe({
      next: (policies) => {
        this.state.set(policies.map(toPolicy));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  /** Abre una póliza: primero la del listado y luego el detalle con sus cobros y siniestros. */
  open(id: string | null): void {
    this.detail.set(this.state().find((policy) => policy.id === id) ?? null);
    if (!id) return;
    this.detailLoading.set(true);
    this.http.get<PolicyDto>(API_ENDPOINTS.policy(id)).subscribe({
      next: (dto) => {
        this.detail.set(toPolicy(dto));
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  /** Registra el endoso en Pólizas (no toca Identidad) y recarga el detalle con la versión nueva. */
  registerEndorsement(id: string, draft: EndorsementDraft): Observable<unknown> {
    const body = {
      fecha_efectiva: draft.effectiveDate,
      motivo: draft.reason,
      version_nueva: { nombre: draft.name, telefono: draft.phone, correo: draft.email, direccion: draft.address },
    };
    return this.http.post(API_ENDPOINTS.policyEndorsements(id), body).pipe(tap(() => this.open(id)));
  }

  close(): void {
    this.open(null);
  }

  /** Pide a Pólizas (que consulta a Cotización) el valor a reintegrar. No cambia la póliza. */
  quoteCancellation(id: string, cause: string): Observable<CancellationQuote> {
    return this.http
      .post<{ dias_vigencia: number; dias_no_devengados: number; monto_reintegro: string | number }>(
        API_ENDPOINTS.policyCancellationQuote(id),
        { causa: cause },
      )
      .pipe(
        map((dto) => ({
          termDays: dto.dias_vigencia,
          unearnedDays: dto.dias_no_devengados,
          refund: Number(dto.monto_reintegro),
        })),
      );
  }

  /** Cancela de forma definitiva en Pólizas y recarga el listado y el detalle ya cancelados. */
  cancel(id: string, cause: string): Observable<unknown> {
    return this.http.post(API_ENDPOINTS.policyCancellation(id), { causa: cause }).pipe(
      tap(() => {
        this.load();
        this.open(id);
      }),
    );
  }
}
