import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';

export type SimulatorMode = 'normal' | 'lento' | 'caido' | 'invalida';

export interface SimulatorState {
  readonly proveedor: string;
  readonly modo: SimulatorMode;
}

const OPEN_FINANCE = 'open-finance';

/** Modo del Open Finance simulado (servicio simuladores), el tercero que consulta la cotización hipotecaria. */
@Injectable({ providedIn: 'root' })
export class SimulatorService {
  private readonly http = inject(HttpClient);

  openFinance(): Observable<SimulatorState> {
    return this.http.get<SimulatorState>(API_ENDPOINTS.simulator(OPEN_FINANCE));
  }

  setOpenFinance(modo: SimulatorMode): Observable<SimulatorState> {
    return this.http.put<SimulatorState>(`${API_ENDPOINTS.simulator(OPEN_FINANCE)}/modo`, { modo });
  }
}
