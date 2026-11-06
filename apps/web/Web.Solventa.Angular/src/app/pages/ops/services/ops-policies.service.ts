import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { CANCELLED_STATUS, Policy } from '../../../core/models/policy.model';
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
  readonly partners = computed(() => [...new Set(this.state().map((policy) => policy.socioOrigen))]);
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

  /** Pólizas no expone la cancelación: el cambio se refleja solo en esta vista. */
  cancel(id: string, cause: string): void {
    const cancelled = (policy: Policy): Policy =>
      policy.id === id ? { ...policy, status: CANCELLED_STATUS, cancelReason: cause, cancelDate: todayIso() } : policy;
    this.state.update((policies) => policies.map(cancelled));
    this.detail.update((policy) => (policy ? cancelled(policy) : policy));
  }
}
