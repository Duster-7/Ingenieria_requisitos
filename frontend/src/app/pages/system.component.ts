import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { Metricas, RegistroAuditoria, Umbrales } from '../core/models';

/** Atributos de calidad (RNF-01, RNF-03, RNF-05), umbrales clínicos y auditoría. */
@Component({
  selector: 'app-system',
  imports: [DatePipe, JsonPipe, FormsModule],
  template: `
    <div class="page-head">
      <div>
        <h1>Sistema</h1>
        <p class="muted">Requisitos no funcionales, umbrales clínicos y registro de auditoría</p>
      </div>
    </div>

    @if (m(); as m) {
      <div class="grid-metrics">
        <div class="metric" [class.metric--ok]="m.latenciaE2E.cumple" [class.metric--bad]="m.latenciaE2E.cumple === false">
          <span class="metric__id">RNF-01 · Desempeño</span>
          <b>{{ m.latenciaE2E.p95Ms ?? '--' }} <small>ms p95</small></b>
          <p>Latencia E2E sensor → pantalla (objetivo &lt; {{ m.latenciaE2E.objetivoMs }} ms). Prom {{ m.latenciaE2E.promedioMs ?? '--' }} ms · {{ m.latenciaE2E.muestras }} muestras.</p>
          <small class="muted">Ingesta plataforma: {{ m.latenciaIngesta.promedioMs ?? '--' }} ms prom.</small>
        </div>
        <div class="metric metric--ok">
          <span class="metric__id">RNF-02 · Seguridad</span>
          <b>AES-256-GCM</b>
          <p>Expediente clínico cifrado en reposo en el archivo de datos del servidor.</p>
        </div>
        <div class="metric">
          <span class="metric__id">RNF-03 · Disponibilidad</span>
          <b>{{ uptime(m.disponibilidad.uptimeSeg) }}</b>
          <p>En línea desde {{ m.disponibilidad.enLineaDesde | date: 'dd/MM HH:mm:ss' }}. Objetivo mensual {{ m.disponibilidad.objetivoPorcentaje }}% (endpoint <code>/api/health</code>).</p>
        </div>
        <div class="metric" [class.metric--ok]="m.perdidaPaquetes.cumple" [class.metric--bad]="!m.perdidaPaquetes.cumple">
          <span class="metric__id">RNF-05 · Confiabilidad</span>
          <b>{{ m.perdidaPaquetes.porcentaje }} <small>% pérdida</small></b>
          <p>{{ m.perdidaPaquetes.recibidos }} recibidos · {{ m.perdidaPaquetes.perdidos }} perdidos (objetivo ≤ {{ m.perdidaPaquetes.objetivoPorcentaje }}%).</p>
        </div>
      </div>
    }

    <section class="card">
      <h2>Umbrales clínicos configurados</h2>
      <form class="filters" (ngSubmit)="guardar()">
        <label>FC alta (BPM) — RF-01
          <input class="input" type="number" name="hrHigh" [(ngModel)]="u.hrHigh" [disabled]="!auth.esMedico()" />
        </label>
        <label>FC baja (BPM) — RF-01
          <input class="input" type="number" name="hrLow" [(ngModel)]="u.hrLow" [disabled]="!auth.esMedico()" />
        </label>
        <label>Umbral anafilaxia (0–1) — RF-08
          <input class="input" type="number" step="0.05" min="0.05" max="1" name="anaphylaxis" [(ngModel)]="u.anaphylaxis" [disabled]="!auth.esMedico()" />
        </label>
        <div class="filters__btns">
          @if (auth.esMedico()) {
            <button class="btn btn--primary" type="submit">Guardar</button>
          } @else {
            <span class="muted">Solo médicos pueden modificar umbrales.</span>
          }
        </div>
      </form>
      @if (msg()) { <p class="muted">{{ msg() }}</p> }
    </section>

    <section class="card">
      <div class="card__head">
        <h2>Registro de auditoría</h2>
        <button class="btn btn--ghost btn--sm" (click)="cargarAuditoria()">Actualizar</button>
      </div>
      <div class="table-wrap table-wrap--tall">
        <table class="table table--compact">
          <thead><tr><th>Fecha y hora</th><th>Acción</th><th>Usuario</th><th>Paciente</th><th>Detalle</th></tr></thead>
          <tbody>
            @for (a of auditoria(); track a.id) {
              <tr>
                <td>{{ a.fechaHora | date: 'dd/MM HH:mm:ss' }}</td>
                <td><b>{{ a.accion }}</b></td>
                <td>{{ a.usuarioNombre }}</td>
                <td>{{ a.pacienteId ?? '—' }}</td>
                <td class="mono small">{{ a.detalle | json }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class SystemComponent implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  private api = inject(ApiService);
  private timer?: ReturnType<typeof setInterval>;

  protected m = signal<Metricas | null>(null);
  protected auditoria = signal<RegistroAuditoria[]>([]);
  protected msg = signal<string | null>(null);
  protected u: Umbrales = { hrHigh: 140, hrLow: 45, anaphylaxis: 0.7 };

  ngOnInit(): void {
    this.cargarMetricas();
    this.cargarAuditoria();
    this.api.umbrales().subscribe((u) => (this.u = { ...u }));
    this.timer = setInterval(() => this.cargarMetricas(), 3000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  cargarMetricas(): void {
    this.api.metricas().subscribe((m) => this.m.set(m));
  }

  cargarAuditoria(): void {
    this.api.auditoria().subscribe((a) => this.auditoria.set(a));
  }

  guardar(): void {
    this.api.guardarUmbrales(this.u).subscribe({
      next: (u) => {
        this.u = { ...u };
        this.msg.set('Umbrales actualizados.');
        this.cargarAuditoria();
      },
      error: (e) => this.msg.set(e.error?.error ?? 'No se pudo guardar')
    });
  }

  uptime(s: number): string {
    const h = Math.floor(s / 3600);
    const min = Math.floor((s % 3600) / 60);
    return h ? `${h} h ${min} min` : `${min} min ${s % 60} s`;
  }
}
