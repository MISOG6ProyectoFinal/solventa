import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.constants';
import {
  RespuestaConsultaConsentimiento,
  RespuestaSolicitud,
  RespuestaValidacion,
  SolicitudConsentimiento,
  SolicitudValidacionOTP,
} from '../interfaces/consent.interface';

@Injectable({ providedIn: 'root' })
export class ConsentService {
  private readonly http = inject(HttpClient);

  solicitar(solicitud: SolicitudConsentimiento): Observable<RespuestaSolicitud> {
    return this.http.post<RespuestaSolicitud>(API_ENDPOINTS.consentimientos.solicitar, solicitud);
  }

  validar(consentimientoId: string, codigo: string): Observable<RespuestaValidacion> {
    const payload: SolicitudValidacionOTP = {
      consentimiento_id: consentimientoId,
      codigo,
    };
    return this.http.post<RespuestaValidacion>(API_ENDPOINTS.consentimientos.validar, payload);
  }

  consultar(consentimientoId: string): Observable<RespuestaConsultaConsentimiento> {
    return this.http.get<RespuestaConsultaConsentimiento>(API_ENDPOINTS.consentimientos.consultar(consentimientoId));
  }
}
