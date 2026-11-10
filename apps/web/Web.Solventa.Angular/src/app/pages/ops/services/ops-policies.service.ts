import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { CANCELLED_STATUS, Policy } from '../../../core/models/policy.model';
import { EndorsementDraft } from '../interfaces/endorsement-draft.interface';
import { todayIso } from '../utils/today.utils';
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

  /** Pólizas no expone la cancelación: el cambio se refleja solo en esta vista. */
  cancel(id: string, cause: string): void {
    const cancelled = (policy: Policy): Policy =>
      policy.id === id ? { ...policy, status: CANCELLED_STATUS, cancelReason: cause, cancelDate: todayIso() } : policy;
    this.state.update((policies) => policies.map(cancelled));
    this.detail.update((policy) => (policy ? cancelled(policy) : policy));
  }
}
