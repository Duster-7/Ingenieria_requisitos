import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Alarma,
  Bomba,
  Escenario,
  Incidente,
  Lectura,
  Metricas,
  NotificacionPush,
  Paciente,
  RegistroAuditoria,
  ReporteIncidente,
  TipoSigno,
  Umbrales
} from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);

  pacientes(): Observable<Paciente[]> {
    return this.http.get<Paciente[]>('/api/patients');
  }

  paciente(id: string): Observable<Paciente> {
    return this.http.get<Paciente>(`/api/patients/${id}`);
  }

  /** RF-03 — Historial por rango de fecha y tipo de signo. */
  historial(id: string, filtro: { tipo?: TipoSigno | ''; desde?: string; hasta?: string; limite?: number }) {
    let params = new HttpParams();
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.desde) params = params.set('desde', new Date(filtro.desde).toISOString());
    if (filtro.hasta) params = params.set('hasta', new Date(filtro.hasta).toISOString());
    if (filtro.limite) params = params.set('limite', filtro.limite);
    return this.http.get<{ total: number; lecturas: Lectura[] }>(`/api/patients/${id}/vitals`, { params });
  }

  alarmas(filtro: { estado?: string; pacienteId?: string } = {}): Observable<Alarma[]> {
    let params = new HttpParams().set('limite', 300);
    if (filtro.estado) params = params.set('estado', filtro.estado);
    if (filtro.pacienteId) params = params.set('pacienteId', filtro.pacienteId);
    return this.http.get<Alarma[]>('/api/alarms', { params });
  }

  /** RF-07 */
  confirmarAlarma(id: string): Observable<Alarma> {
    return this.http.post<Alarma>(`/api/alarms/${id}/ack`, {});
  }

  incidentes(): Observable<Incidente[]> {
    return this.http.get<Incidente[]>('/api/incidents');
  }

  /** RF-09 */
  confirmarIncidente(id: string): Observable<Incidente> {
    return this.http.post<Incidente>(`/api/incidents/${id}/confirm`, {});
  }

  descartarIncidente(id: string, motivo: string): Observable<Incidente> {
    return this.http.post<Incidente>(`/api/incidents/${id}/discard`, { motivo });
  }

  resolverIncidente(id: string, nota: string): Observable<Incidente> {
    return this.http.post<Incidente>(`/api/incidents/${id}/resolve`, { nota });
  }

  /** RF-10 */
  reporte(id: string): Observable<ReporteIncidente> {
    return this.http.get<ReporteIncidente>(`/api/incidents/${id}/report`);
  }

  reanudarBomba(pacienteId: string): Observable<Bomba> {
    return this.http.post<Bomba>(`/api/patients/${pacienteId}/pump/resume`, {});
  }

  umbrales(): Observable<Umbrales> {
    return this.http.get<Umbrales>('/api/config');
  }

  guardarUmbrales(u: Partial<Umbrales>): Observable<Umbrales> {
    return this.http.put<Umbrales>('/api/config', u);
  }

  metricas(): Observable<Metricas> {
    return this.http.get<Metricas>('/api/metrics');
  }

  auditoria(pacienteId?: string): Observable<RegistroAuditoria[]> {
    let params = new HttpParams().set('limite', 300);
    if (pacienteId) params = params.set('pacienteId', pacienteId);
    return this.http.get<RegistroAuditoria[]>('/api/audit', { params });
  }

  notificaciones(): Observable<NotificacionPush[]> {
    return this.http.get<NotificacionPush[]>('/api/notifications');
  }

  escenarios(): Observable<{ pacienteId: string; escenario: Escenario }[]> {
    return this.http.get<{ pacienteId: string; escenario: Escenario }[]>('/api/simulator');
  }

  cambiarEscenario(pacienteId: string, escenario: Escenario) {
    return this.http.post<{ pacienteId: string; escenario: Escenario }>(`/api/simulator/${pacienteId}/scenario`, { escenario });
  }
}
