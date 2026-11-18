import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RealtimeService } from '../core/realtime.service';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Incidente } from '../core/models';

/** UC-05 Detectar anafilaxia · UC-06 Detener infusión de emergencia — RF-08 y RF-09. */
@Component({
  selector: 'app-incidents',
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    <div class="page-head">
      <div>
        <h1>Incidentes de emergencia</h1>
        <p class="muted">Detección de anafilaxia inminente y paro automático de la infusión</p>
      </div>
    </div>

    @if (error()) {
      <div class="notice notice--error">{{ error() }}</div>
    }

    @if (!abiertos().length) {
      <div class="card empty">
        <p>No hay incidentes abiertos.</p>
        <p class="muted">Para probar el flujo, en la Central cambia el simulador de un paciente a <b>ANAFILAXIA</b>.</p>
      </div>
    }

    <div class="incident-list">
      @for (i of abiertos(); track i.id) {
        <article class="incident" [class.incident--confirmado]="i.estado === 'CONFIRMADO'">
          <header class="incident__head">
            <div>
              <span class="tag tag--critico">ANAFILAXIA</span>
              <h2>{{ cama(i) }} · {{ nombre(i) }}</h2>
              <small class="muted">Detectado {{ i.creadoEn | date: 'dd/MM/yyyy HH:mm:ss' }} · {{ i.id }}</small>
            </div>
            <div class="score">
              <span>Puntaje</span>
              <b>{{ i.puntaje | number: '1.2-2' }}</b>
            </div>
          </header>

          <ul class="factors">
            @for (f of i.factores; track f) {
              <li>{{ f }}</li>
            }
          </ul>

          <div class="timeline">
            <div class="step is-done"><i></i><b>Detectado</b><small>{{ i.creadoEn | date: 'HH:mm:ss.SSS' }}</small></div>
            <div class="step" [class.is-done]="i.confirmadoEn"><i></i><b>Confirmado</b><small>{{ i.confirmadoPor?.nombre ?? 'Pendiente' }}</small></div>
            <div class="step" [class.is-done]="i.ordenParo"><i></i><b>Orden enviada</b><small>{{ (i.ordenParo?.enviadaEn | date: 'HH:mm:ss.SSS') ?? '—' }}</small></div>
            <div class="step" [class.is-done]="i.ordenParo?.recibidaEn"><i></i><b>Gateway</b><small>{{ (i.ordenParo?.recibidaEn | date: 'HH:mm:ss.SSS') ?? '—' }}</small></div>
            <div class="step" [class.is-done]="i.ordenParo?.estado === 'EJECUTADA'" [class.is-fail]="i.ordenParo?.estado === 'RECHAZADA'">
              <i></i><b>Bomba detenida</b><small>{{ (i.ordenParo?.ejecutadaEn | date: 'HH:mm:ss.SSS') ?? '—' }}</small>
            </div>
          </div>

          <footer class="incident__actions">
            @if (!auth.esMedico()) {
              <span class="muted">Solo un médico puede confirmar el evento y detener la infusión.</span>
            } @else if (i.estado === 'DETECTADO') {
              @if (pendiente() === i.id) {
                <span class="confirm-q">¿Confirmar anafilaxia y detener la infusión de <b>{{ medicamento(i) }}</b>?</span>
                <button class="btn btn--danger" (click)="confirmar(i)" [disabled]="procesando()">Sí, detener infusión</button>
                <button class="btn btn--ghost" (click)="pendiente.set(null)">Cancelar</button>
              } @else {
                <button class="btn btn--danger" (click)="pendiente.set(i.id)">Confirmar anafilaxia → detener infusión</button>
                <button class="btn btn--ghost" (click)="descartar(i)" [disabled]="procesando()">Descartar (falso positivo)</button>
              }
            } @else {
              <button class="btn btn--primary" (click)="resolver(i)" [disabled]="procesando()">Marcar como resuelto</button>
            }
            <a class="btn btn--ghost" [routerLink]="['/bedside', i.pacienteId]">Bedside</a>
            @if (auth.esMedico()) {
              <a class="btn btn--ghost" [routerLink]="['/reporte', i.id]">Reporte</a>
            }
          </footer>
        </article>
      }
    </div>

    @if (bombasDetenidas().length && auth.esMedico()) {
      <section class="card">
        <h2>Bombas detenidas sin incidente abierto</h2>
        @for (p of bombasDetenidas(); track p.id) {
          <div class="row-inline">
            <span><b>{{ p.cama }}</b> · {{ p.bomba.medicamento }}</span>
            <button class="btn btn--primary btn--sm" (click)="reanudar(p.id)" [disabled]="procesando()">Reanudar infusión</button>
          </div>
        }
      </section>
    }

    <section class="card">
      <h2>Historial de incidentes</h2>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Detectado</th><th>Cama</th><th>Puntaje</th><th>Estado</th><th>Cerrado por</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            @for (i of cerrados(); track i.id) {
              <tr>
                <td>{{ i.creadoEn | date: 'dd/MM HH:mm:ss' }}</td>
                <td>{{ cama(i) }}</td>
                <td>{{ i.puntaje | number: '1.2-2' }}</td>
                <td><span class="badge badge--neutro">{{ i.estado }}</span></td>
                <td>{{ i.cerradoPor?.nombre }}</td>
                <td>{{ i.motivoCierre }}</td>
                <td>@if (auth.esMedico()) { <a [routerLink]="['/reporte', i.id]">Reporte</a> }</td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted">Sin incidentes cerrados.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class IncidentsComponent {
  protected rt = inject(RealtimeService);
  protected auth = inject(AuthService);
  private api = inject(ApiService);

  protected pendiente = signal<string | null>(null);
  protected procesando = signal(false);
  protected error = signal<string | null>(null);

  protected abiertos = computed(() => this.rt.incidentesAbiertos());
  protected cerrados = computed(() =>
    this.rt.incidentes().filter((i) => i.estado === 'DESCARTADO' || i.estado === 'RESUELTO').sort((a, b) => b.creadoEn.localeCompare(a.creadoEn))
  );
  protected bombasDetenidas = computed(() => this.rt.pacientes().filter((p) => p.bomba.estado === 'DETENIDA' && !p.incidenteAbierto));

  private paciente = (i: Incidente) => this.rt.pacientes().find((p) => p.id === i.pacienteId);
  cama = (i: Incidente) => this.paciente(i)?.cama ?? i.pacienteId;
  nombre = (i: Incidente) => this.paciente(i)?.nombre ?? '';
  medicamento = (i: Incidente) => this.paciente(i)?.bomba.medicamento ?? 'la bomba';

  private ejecutar(obs: ReturnType<ApiService['confirmarIncidente']>): void {
    this.procesando.set(true);
    this.error.set(null);
    obs.subscribe({
      next: (i) => {
        this.rt.actualizarIncidente(i);
        this.pendiente.set(null);
        this.procesando.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.error ?? 'Operación no completada');
        this.procesando.set(false);
      }
    });
  }

  /** RF-09 */
  confirmar(i: Incidente): void {
    this.ejecutar(this.api.confirmarIncidente(i.id));
  }

  descartar(i: Incidente): void {
    this.ejecutar(this.api.descartarIncidente(i.id, 'Falso positivo tras valoración médica'));
  }

  resolver(i: Incidente): void {
    this.ejecutar(this.api.resolverIncidente(i.id, 'Paciente estabilizado'));
  }

  reanudar(pacienteId: string): void {
    this.procesando.set(true);
    this.api.reanudarBomba(pacienteId).subscribe({
      next: () => this.procesando.set(false),
      error: (e) => {
        this.error.set(e.error?.error ?? 'No se pudo reanudar');
        this.procesando.set(false);
      }
    });
  }
}
