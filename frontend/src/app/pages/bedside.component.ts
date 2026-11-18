import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { RealtimeService } from '../core/realtime.service';
import { ApiService } from '../core/api.service';
import { WaveformMonitorComponent } from '../shared/waveform-monitor.component';
import { TrendChartComponent } from '../shared/trend-chart.component';
import { ClaseEstadoPipe, COLOR_SIGNO, EstadoTextoPipe, TipoAlarmaPipe, ValorSignoPipe } from '../shared/format';

/** Pantalla táctil bedside — RF-05 (ECG ≥ 60 FPS), RF-01, RF-07. */
@Component({
  selector: 'app-bedside',
  imports: [RouterLink, DatePipe, WaveformMonitorComponent, TrendChartComponent, ValorSignoPipe, EstadoTextoPipe, ClaseEstadoPipe, TipoAlarmaPipe],
  template: `
    @if (paciente(); as p) {
      <div class="bedside" #pantalla [class.bedside--alarma]="alarmas().length">
        <header class="bedside__head">
          <a routerLink="/dashboard" class="btn btn--ghost btn--sm">← Central</a>
          <div class="bedside__who">
            <span class="pcard__bed">{{ p.cama }}</span>
            <b>{{ p.nombre }}</b>
            <span class="muted">{{ p.edad }} años · {{ p.diagnostico }}</span>
          </div>
          <span [class]="p.estado | claseEstado">{{ p.estado | estadoTexto }}</span>
          <div class="bedside__meta">
            <span class="meter" [class.meter--ok]="fps() >= 60" title="RF-05: refresco de la curva ECG">{{ fps() }} FPS</span>
            <span class="meter" [class.meter--ok]="(rt.latenciaPromedioMs() ?? 999) < 500" title="RNF-01: latencia sensor → pantalla">
              {{ rt.latenciaMs() ?? '--' }} ms
            </span>
            <button class="btn btn--ghost btn--sm" (click)="pantallaCompleta()">⛶</button>
          </div>
        </header>

        @for (a of alarmas(); track a.id) {
          <div class="bedside__alarm" role="alert">
            <span class="alarm-banner__dot"></span>
            <b>{{ a.tipo | tipoAlarma }}</b> {{ a.mensaje }}
            <span class="muted">{{ a.creadaEn | date: 'HH:mm:ss' }}</span>
            <button class="btn btn--light" (click)="confirmar(a.id)" [disabled]="confirmando() === a.id">Confirmar lectura</button>
          </div>
        }

        <div class="bedside__body">
          <section class="waves">
            <div class="wave">
              <span class="wave__lbl" [style.color]="colores.FC">II · ECG</span>
              <app-waveform-monitor tipo="ecg" [frecuencia]="fc()" [color]="colores.FC" [alto]="220" (fps)="fps.set($event)" />
            </div>
            <div class="wave">
              <span class="wave__lbl" [style.color]="colores.SPO2">Pleth · SpO₂</span>
              <app-waveform-monitor tipo="pleth" [frecuencia]="fc()" [color]="colores.SPO2" [alto]="120" />
            </div>
            <div class="wave wave--trend">
              <span class="wave__lbl" [style.color]="colores.PA">Tendencia PA (últimos 2 min)</span>
              <app-trend-chart [puntos]="rt.tendencias()[p.id]?.PA ?? []" [color]="colores.PA" color2="#c9a7ff" [alto]="120" />
            </div>
          </section>

          <aside class="tiles">
            <div class="tile tile--fc">
              <span class="tile__lbl">FC <small>BPM</small></span>
              <b class="tile__val">{{ p.ultimasLecturas.FC | valorSigno }}</b>
              <span class="tile__lim">{{ umbral().hrLow }} – {{ umbral().hrHigh }}</span>
            </div>
            <div class="tile tile--spo2">
              <span class="tile__lbl">SpO₂ <small>%</small></span>
              <b class="tile__val">{{ p.ultimasLecturas.SPO2 | valorSigno }}</b>
            </div>
            <div class="tile tile--pa">
              <span class="tile__lbl">PA <small>mmHg</small></span>
              <b class="tile__val tile__val--md">{{ p.ultimasLecturas.PA | valorSigno }}</b>
            </div>
            <div class="tile tile--temp">
              <span class="tile__lbl">Temp <small>°C</small></span>
              <b class="tile__val tile__val--md">{{ p.ultimasLecturas.TEMP | valorSigno }}</b>
            </div>
            <div class="tile tile--pump" [class.tile--stop]="p.bomba.estado === 'DETENIDA'">
              <span class="tile__lbl">Bomba de infusión</span>
              <b>{{ p.bomba.medicamento }}</b>
              <span>{{ p.bomba.estado === 'DETENIDA' ? '■ DETENIDA' : '▶ ' + p.bomba.velocidadMlH + ' ml/h' }}</span>
            </div>
          </aside>
        </div>
      </div>
    } @else {
      <p class="muted">Paciente no encontrado.</p>
    }
  `
})
export class BedsideComponent {
  readonly id = input.required<string>();

  protected rt = inject(RealtimeService);
  private api = inject(ApiService);
  private pantalla = viewChild<ElementRef<HTMLElement>>('pantalla');

  protected colores = COLOR_SIGNO;
  protected fps = signal(0);
  protected confirmando = signal<string | null>(null);
  protected umbral = signal({ hrLow: 45, hrHigh: 140 });

  protected paciente = computed(() => this.rt.pacientes().find((p) => p.id === this.id()) ?? null);
  protected fc = computed(() => {
    const v = this.paciente()?.ultimasLecturas.FC?.valor;
    return typeof v === 'number' && this.paciente()?.estado !== 'SIN_SENAL' ? v : null;
  });
  protected alarmas = computed(() => this.rt.alarmasActivas().filter((a) => a.pacienteId === this.id()));

  constructor() {
    this.api.umbrales().subscribe((u) => this.umbral.set(u));
  }

  confirmar(id: string): void {
    this.confirmando.set(id);
    this.api.confirmarAlarma(id).subscribe({
      next: (a) => {
        this.rt.actualizarAlarma(a);
        this.confirmando.set(null);
      },
      error: () => this.confirmando.set(null)
    });
  }

  pantallaCompleta(): void {
    const el = this.pantalla()?.nativeElement;
    if (!document.fullscreenElement) void el?.requestFullscreen?.();
    else void document.exitFullscreen();
  }
}
