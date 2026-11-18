import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api.service';
import { PresionArterial, ReporteIncidente, TipoSigno } from '../core/models';
import { TrendChartComponent, SeriePunto } from '../shared/trend-chart.component';
import { COLOR_SIGNO, TipoAlarmaPipe } from '../shared/format';

/** UC-07 Generar reporte de incidente — RF-10. */
@Component({
  selector: 'app-report',
  imports: [DatePipe, DecimalPipe, JsonPipe, RouterLink, TrendChartComponent, TipoAlarmaPipe],
  template: `
    <div class="page-head no-print">
      <a routerLink="/incidentes" class="btn btn--ghost btn--sm">← Incidentes</a>
      <div class="row-inline">
        <button class="btn btn--ghost" (click)="descargar()" [disabled]="!r()">Descargar JSON</button>
        <button class="btn btn--primary" (click)="imprimir()" [disabled]="!r()">Imprimir / PDF</button>
      </div>
    </div>

    @if (error()) {
      <div class="notice notice--error">{{ error() }}</div>
    }

    @if (r(); as r) {
      <article class="report">
        <header class="report__head">
          <div>
            <p class="report__kicker">MediGuard IoT · Reporte de incidente clínico</p>
            <h1>{{ r.paciente.nombre }} — {{ r.paciente.cama }}</h1>
            <p class="muted">{{ r.paciente.edad }} años · {{ r.paciente.diagnostico }} · ID {{ r.paciente.id }}</p>
          </div>
          <dl class="report__meta">
            <dt>Incidente</dt><dd class="mono">{{ r.incidente.id }}</dd>
            <dt>Estado</dt><dd>{{ r.incidente.estado }}</dd>
            <dt>Generado</dt><dd>{{ r.generadoEn | date: 'dd/MM/yyyy HH:mm:ss' }}</dd>
            <dt>Ventana</dt><dd>{{ r.ventana.desde | date: 'HH:mm:ss' }} – {{ r.ventana.hasta | date: 'HH:mm:ss' }}</dd>
          </dl>
        </header>

        <section>
          <h2>1. Evento detectado</h2>
          <p>
            Anafilaxia inminente con puntaje <b>{{ r.incidente.puntaje | number: '1.2-2' }}</b> detectada el
            {{ r.incidente.creadoEn | date: 'dd/MM/yyyy HH:mm:ss' }}.
            @if (r.incidente.confirmadoPor) { Confirmada por <b>{{ r.incidente.confirmadoPor.nombre }}</b> a las {{ r.incidente.confirmadoEn | date: 'HH:mm:ss' }}. }
            @if (r.incidente.cerradoPor) { Cerrada por {{ r.incidente.cerradoPor.nombre }} ({{ r.incidente.motivoCierre }}). }
          </p>
          <ul class="factors">
            @for (f of r.incidente.factores; track f) { <li>{{ f }}</li> }
          </ul>
        </section>

        <section>
          <h2>2. Signos vitales ({{ r.signosVitales.totalLecturas }} lecturas)</h2>
          <table class="table table--compact">
            <thead><tr><th>Signo</th><th>Mín</th><th>Promedio</th><th>Máx</th><th>Muestras</th></tr></thead>
            <tbody>
              @for (k of claves; track k) {
                @if (r.signosVitales.resumen[k]; as s) {
                  <tr><td>{{ k }}</td><td>{{ s.min }}</td><td>{{ s.promedio }}</td><td>{{ s.max }}</td><td>{{ s.muestras }}</td></tr>
                }
              }
            </tbody>
          </table>
          <div class="report__charts">
            @for (t of tiposGrafica; track t) {
              <div>
                <h3>{{ t }}</h3>
                <app-trend-chart [puntos]="series()[t]" [color]="colores[t]" color2="#c9a7ff" [alto]="150" />
              </div>
            }
          </div>
        </section>

        <section>
          <h2>3. Alarmas y confirmaciones</h2>
          <table class="table table--compact">
            <thead><tr><th>Hora</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Confirmada por</th></tr></thead>
            <tbody>
              @for (a of r.alarmas; track a.id) {
                <tr>
                  <td>{{ a.creadaEn | date: 'HH:mm:ss' }}</td>
                  <td>{{ a.tipo | tipoAlarma }}</td>
                  <td>{{ a.mensaje }}</td>
                  <td>{{ a.estado }}</td>
                  <td>{{ a.confirmacion ? a.confirmacion.usuarioNombre + ' · ' + (a.confirmacion.fechaHora | date: 'HH:mm:ss') : '—' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="muted">Sin alarmas en la ventana.</td></tr>
              }
            </tbody>
          </table>
        </section>

        <section>
          <h2>4. Orden de paro de infusión</h2>
          @if (r.ordenParo; as o) {
            <table class="table table--compact">
              <tbody>
                <tr><th>Orden</th><td class="mono">{{ o.id }}</td><th>Bomba</th><td class="mono">{{ o.bombaId }}</td></tr>
                <tr><th>Emitida por</th><td>{{ o.emitidaPor.nombre }}</td><th>Estado</th><td><b>{{ o.estado }}</b></td></tr>
                <tr><th>Enviada</th><td>{{ o.enviadaEn | date: 'HH:mm:ss.SSS' }}</td><th>Recibida (gateway)</th><td>{{ o.recibidaEn | date: 'HH:mm:ss.SSS' }}</td></tr>
                <tr><th>Ejecutada (bomba)</th><td>{{ o.ejecutadaEn | date: 'HH:mm:ss.SSS' }}</td><th>Tiempo total</th><td>{{ tiempoOrden() }} ms</td></tr>
              </tbody>
            </table>
          } @else {
            <p class="muted">No se emitió orden de paro.</p>
          }
        </section>

        <section>
          <h2>5. Acciones de emergencia y auditoría</h2>
          <table class="table table--compact">
            <thead><tr><th>Fecha y hora</th><th>Acción</th><th>Usuario</th><th>Detalle</th></tr></thead>
            <tbody>
              @for (a of r.accionesEmergencia; track a.id) {
                <tr>
                  <td>{{ a.fechaHora | date: 'HH:mm:ss.SSS' }}</td>
                  <td><b>{{ a.accion }}</b></td>
                  <td>{{ a.usuarioNombre }}</td>
                  <td class="mono small">{{ a.detalle | json }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>
      </article>
    } @else if (!error()) {
      <p class="muted">Generando reporte…</p>
    }
  `
})
export class ReportComponent implements OnInit {
  readonly id = input.required<string>();
  private api = inject(ApiService);

  protected r = signal<ReporteIncidente | null>(null);
  protected error = signal<string | null>(null);
  protected colores = COLOR_SIGNO;
  protected claves = ['FC', 'SPO2', 'PAS', 'PAD', 'TEMP'] as const;
  protected tiposGrafica: TipoSigno[] = ['FC', 'SPO2', 'PA', 'TEMP'];

  protected series = computed(() => {
    const out: Record<TipoSigno, SeriePunto[]> = { FC: [], SPO2: [], PA: [], TEMP: [] };
    for (const l of this.r()?.signosVitales.serie ?? []) {
      const t = Date.parse(l.timestampSensor);
      if (l.tipo === 'PA') out.PA.push({ t, v: (l.valor as PresionArterial).sistolica, v2: (l.valor as PresionArterial).diastolica });
      else out[l.tipo].push({ t, v: l.valor as number });
    }
    return out;
  });

  protected tiempoOrden = computed(() => {
    const o = this.r()?.ordenParo;
    return o?.ejecutadaEn ? Date.parse(o.ejecutadaEn) - Date.parse(o.enviadaEn) : '—';
  });

  ngOnInit(): void {
    this.api.reporte(this.id()).subscribe({
      next: (r) => this.r.set(r),
      error: (e) => this.error.set(e.error?.error ?? 'No se pudo generar el reporte')
    });
  }

  imprimir(): void {
    window.print();
  }

  descargar(): void {
    const blob = new Blob([JSON.stringify(this.r(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reporte-${this.id()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
