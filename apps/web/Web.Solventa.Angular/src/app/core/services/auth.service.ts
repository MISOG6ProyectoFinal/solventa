import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, map, tap } from 'rxjs';
import { API_ENDPOINTS } from '../constants/api-endpoints.constants';
import { STORAGE_KEYS } from '../constants/storage-keys.constants';
import { OperatorRole, SessionOperator } from '../models/operator.model';
import { LoginResponseDto, toSessionOperator } from './auth-api.mapper';

/** Sesión del operador del portal: token y operador en `sessionStorage`, estado como signals. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<SessionOperator | null>(this.restore());

  readonly operator = this.state.asReadonly();
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly roles = computed<readonly OperatorRole[]>(() => this.state()?.roles ?? []);

  /** Verdadero si el operador tiene al menos uno de los roles indicados. */
  hasRole(...roles: OperatorRole[]): boolean {
    const own = this.roles();
    return roles.some((role) => own.includes(role));
  }

  login(email: string, password: string): Observable<SessionOperator> {
    return this.http.post<LoginResponseDto>(API_ENDPOINTS.session.login, { correo: email, contrasena: password }).pipe(
      tap((response) => {
        const operator = toSessionOperator(response.operador);
        sessionStorage.setItem(STORAGE_KEYS.accessToken, response.token);
        sessionStorage.setItem(STORAGE_KEYS.operator, JSON.stringify(operator));
        this.state.set(operator);
      }),
      map((response) => toSessionOperator(response.operador)),
    );
  }

  logout(): void {
    sessionStorage.removeItem(STORAGE_KEYS.accessToken);
    sessionStorage.removeItem(STORAGE_KEYS.operator);
    this.state.set(null);
  }

  private restore(): SessionOperator | null {
    const token = sessionStorage.getItem(STORAGE_KEYS.accessToken);
    const stored = sessionStorage.getItem(STORAGE_KEYS.operator);
    if (!token || !stored) return this.discard();
    try {
      const operator = JSON.parse(stored) as Partial<SessionOperator>;
      const valid = typeof operator.id === 'string' && typeof operator.name === 'string' && Array.isArray(operator.roles);
      return valid ? (operator as SessionOperator) : this.discard();
    } catch {
      return this.discard();
    }
  }

  private discard(): null {
    sessionStorage.removeItem(STORAGE_KEYS.accessToken);
    sessionStorage.removeItem(STORAGE_KEYS.operator);
    return null;
  }
}
