import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import { ApiError } from '../../../core/interfaces/api-response.interface';
import { NewOperator, Operator, OperatorChanges } from '../../../core/models/operator.model';
import {
  OperatorDto,
  toNewOperatorDto,
  toOperator,
  toOperatorChangesDto,
} from './operators-api.mapper';

@Injectable({ providedIn: 'root' })
export class OperatorsService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<Operator[]>([]);

  readonly operators = this.state.asReadonly();
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.http.get<OperatorDto[]>(API_ENDPOINTS.operators).subscribe({
      next: (operators) => {
        this.state.set(operators.map(toOperator));
        this.loading.set(false);
      },
      error: (error: ApiError) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  create(operator: NewOperator): Observable<Operator> {
    return this.http.post<OperatorDto>(API_ENDPOINTS.operators, toNewOperatorDto(operator)).pipe(
      map(toOperator),
      tap((created) => this.state.update((operators) => [...operators, created])),
    );
  }

  /** Cambia los roles o el estado activo del operador. */
  update(operatorId: string, changes: OperatorChanges): Observable<Operator> {
    return this.http.patch<OperatorDto>(API_ENDPOINTS.operator(operatorId), toOperatorChangesDto(changes)).pipe(
      map(toOperator),
      tap((updated) => this.state.update((operators) => operators.map((o) => (o.id === updated.id ? updated : o)))),
    );
  }
}
