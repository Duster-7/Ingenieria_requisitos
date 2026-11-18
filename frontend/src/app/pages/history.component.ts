import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ApiService } from '../core/api.service';
import { RealtimeService } from '../core/realtime.service';
import { ETIQUETA_SIGNO, Lectura, PresionArterial, TipoSigno } from '../core/models';
import { TrendChartComponent, SeriePunto } from '../shared/trend-chart.component';
import { aInputLocal, COLOR_SIGNO, ValorSignoPipe } from '../shared/format';

/** UC-02 Consultar historial — RF-03 (por paciente, tipo de signo y rango de fechas). */
@Component({
  selector: 'app-history',
  imports: [FormsModule, DatePipe, TrendChartComponent, ValorSignoPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Historial de signos vitales</h1>
        <p class="muted">Consulta por paciente, tipo de signo vital y periodo</p>
      </div>
    </div>

    <form class="filters card" (ngSubmit)="consultar()">
      <label>Paciente
        <select class="input" name="paciente" [(ngModel)]="pacienteId">
          @for (p of rt.pacientes(); track p.id) {
            <option [value]="p.id">{{ p.cama }} · {{ p.nombre }}</option>
          }
        </select>
      </label>
      <label>Signo vital
        <select class="input" name="tipo" [(ngModel)]="tipo">
          @for (t of tipos; track t) {
            <option [value]="t">{{ etiquetas[t] }}</option>
          }
        </select>
      </label>
      <label>Desde
        <input class="input" type="datetime-local" name="desde" [(ngModel)]="desde" />
      </label>
      <label>Hasta
        <input class="input" type="datetime-local" name="hasta" [(ngModel)]="hasta" />
      </label>
      <div class="filters__btns">
        <button type="button" class="btn btn--ghost" (click)="rango(15)">15 min</button>
        <button type="button" class="btn btn--ghost" (click)="rango(60)">1 h</button>
        <button type="button" class="btn btn--ghost" (click)="rango(24 * 60)">24 h</button>
        <button class="btn btn--primary" type="submit" [disabled]="cargando()">{{ cargando() ? 'Consultando…' : 'Consultar' }}</button>
      </div>
    </form>

    @if (error()) {
      <div class="notice notice--error">{{ error() }}</div>
    }

    @if (consultado()) {
      <section class="card">
        <div class="card__head">
          <h2>{{ etiquetas[tipoConsultado()] }} · {{ total() }} lecturas</h2>
          @if (estadisticas(); as s) {
            <div class="stats">
              <span>Mín <b>{{ s.min }}</b></span>
              <span>Prom <b>{{ s.prom }}</b></span>
              <span>Máx <b>{{ s.max }}</b></span>
            </div>
          }
        </div>
        <app-trend-chart [puntos]="serie()" [color]="colores[tipoConsultado()]" color2="#c9a7ff" [alto]="280" [lineasReferencia]="referencias()" />
      </section>

      <section class="card">
        <h2>Detalle (últimas {{ filas().length }})</h2>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Fecha y hora (sensor)</th><th>Valor</th><th>Unidad</th><th>Sensor</th><th>Secuencia</th><th>Recepción</th></tr>
            </thead>
            <tbody>
              @for (l of filas(); track l.id) {
                <tr>
                  <td>{{ l.timestampSensor | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                  <td><b>{{ l | valorSigno }}</b></td>
                  <td>{{ l.unidad }}</td>
                  <td class="mono">{{ l.sensorId }}</td>
                  <td class="mono">{{ l.seq ?? '—' }}</td>
                  <td class="muted">{{ l.timestampRecepcion | date: 'HH:mm:ss.SSS' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="muted">Sin lecturas en el periodo.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
  `
})
export class HistoryComponent implements OnInit {
  readonly paciente = input<string>();

  protected rt = inject(RealtimeService);
  private api = inject(ApiService);

  protected tipos: TipoSigno[] = ['FC', 'SPO2', 'PA', 'TEMP'];
  protected etiquetas = ETIQUETA_SIGNO;
  protected colores = COLOR_SIGNO;

  protected pacienteId = 'P-001';
  protected tipo: TipoSigno = 'FC';
  protected desde = '';
  protected hasta = '';

  protected cargando = signal(false);
  protected error = signal<string | null>(null);
  protected consultado = signal(false);
  protected lecturas = signal<Lectura[]>([]);
  protected total = signal(0);
  protected tipoConsultado = signal<TipoSigno>('FC');

  protected serie = computed<SeriePunto[]>(() =>
    this.lecturas().map((l) =>
      l.tipo === 'PA'
        ? { t: Date.parse(l.timestampSensor), v: (l.valor as PresionArterial).sistolica, v2: (l.valor as PresionArterial).diastolica }
        : { t: Date.parse(l.timestampSensor), v: l.valor as number }
    )
  );
  protected filas = computed(() => this.lecturas().slice(-200).reverse());
  protected estadisticas = computed(() => {
    const v = this.serie().map((p) => p.v);
    if (!v.length) return null;
    const prom = v.reduce((a, b) => a + b, 0) / v.length;
    const dec = this.tipoConsultado() === 'TEMP' ? 1 : 0;
    return { min: Math.min(...v).toFixed(dec), max: Math.max(...v).toFixed(dec), prom: prom.toFixed(1) };
  });
  protected referencias = computed(() =>
    this.tipoConsultado() === 'FC'
      ? [
          { valor: 140, etiqueta: 'Umbral alto 140' },
          { valor: 45, etiqueta: 'Umbral bajo 45' }
        ]
      : []
  );

  ngOnInit(): void {
    if (this.paciente()) this.pacienteId = this.paciente()!;
    this.rango(15, false);
    this.consultar();
  }

  rango(minutos: number, consultar = true): void {
    const ahora = new Date();
    this.hasta = aInputLocal(new Date(ahora.getTime() + 60_000));
    this.desde = aInputLocal(new Date(ahora.getTime() - minutos * 60_000));
    if (consultar) this.consultar();
  }

  consultar(): void {
    this.cargando.set(true);
    this.error.set(null);
    this.api.historial(this.pacienteId, { tipo: this.tipo, desde: this.desde, hasta: this.hasta, limite: 10000 }).subscribe({
      next: (r) => {
        this.lecturas.set(r.lecturas);
        this.total.set(r.total);
        this.tipoConsultado.set(this.tipo);
        this.consultado.set(true);
        this.cargando.set(false);
      },
      error: (e) => {
        this.error.set(e.error?.error ?? 'No se pudo consultar el historial');
        this.cargando.set(false);
      }
    });
  }
}
