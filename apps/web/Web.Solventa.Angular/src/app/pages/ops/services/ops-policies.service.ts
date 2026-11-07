import { HttpClient } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, catchError, debounceTime, of, startWith, switchMap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { Policy } from '../../../core/models/policy.model';
import { OPS_TODAY } from '../constants/ops.constants';

const SEARCH_DEBOUNCE_MS = 300;

/** Pólizas del módulo Ops leídas del BFF web (búsqueda por número de póliza o identificación). */
@Injectable({ providedIn: 'root' })
export class OpsPoliciesService {
  private readonly http = inject(HttpClient);
  private readonly search$ = new Subject<string>();

  private readonly state = signal<readonly Policy[]>([]);
  private readonly detail = signal<Policy | null>(null);

  readonly policies = this.state.asReadonly();
  readonly selected = this.detail.asReadonly();
  readonly loadError = signal(false);
  readonly partners = computed(() => [...new Set(this.state().map((policy) => policy.socioOrigen))]);

  constructor() {
    this.search$
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        startWith(''),
        switchMap((q) =>
          this.http.get<Policy[]>(API_ENDPOINTS.webPolicies, { params: q ? { q } : {} }).pipe(
            catchError(() => {
              this.loadError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((policies) => {
        if (!policies) return;
        this.loadError.set(false);
        this.state.set(policies);
      });
  }

  search(text: string): void {
    this.search$.next(text);
  }

  /** Muestra de inmediato lo del listado y completa pagos y siniestros con el detalle. */
  open(id: string): void {
    this.detail.set(this.state().find((policy) => policy.id === id) ?? null);
    this.http.get<Policy>(`${API_ENDPOINTS.webPolicies}/${id}`).subscribe({
      next: (policy) => this.detail.set(policy),
      error: () => this.loadError.set(true),
    });
  }

  close(): void {
    this.detail.set(null);
  }

  // shortcut: la cancelación aún no se persiste en backend; solo actualiza lo cargado en pantalla.
  cancel(id: string, cause: string): void {
    const apply = (policy: Policy): Policy =>
      policy.id === id ? { ...policy, status: 'Cancelada', cancelReason: cause, cancelDate: OPS_TODAY } : policy;
    this.state.update((policies) => policies.map(apply));
    this.detail.update((policy) => (policy ? apply(policy) : policy));
  }
}
