import { Injectable, computed, signal } from '@angular/core';
import { Policy } from '../../../core/models/policy.model';
import { OPS_TODAY } from '../constants/ops.constants';
import { OPS_POLICIES } from '../data/ops-policies.data';

/** Fuente de datos de pólizas del módulo Ops (en memoria hasta integrar el microservicio). */
@Injectable({ providedIn: 'root' })
export class OpsPoliciesService {
  private readonly state = signal<readonly Policy[]>(OPS_POLICIES);

  readonly policies = this.state.asReadonly();
  readonly partners = computed(() => [...new Set(this.state().map((policy) => policy.socioOrigen))]);

  findById(id: string | null): Policy | null {
    return this.state().find((policy) => policy.id === id) ?? null;
  }

  cancel(id: string, cause: string): void {
    this.state.update((policies) =>
      policies.map((policy): Policy =>
        policy.id === id ? { ...policy, status: 'Cancelada', cancelReason: cause, cancelDate: OPS_TODAY } : policy,
      ),
    );
  }
}
