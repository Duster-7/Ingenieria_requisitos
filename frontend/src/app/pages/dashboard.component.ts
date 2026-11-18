import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RealtimeService } from '../core/realtime.service';
import { ApiService } from '../core/api.service';
import { Escenario, Paciente } from '../core/models';
import { TrendChartComponent } from '../shared/trend-chart.component';
import { ClaseEstadoPipe, COLOR_SIGNO, EstadoTextoPipe, ValorSignoPipe } from '../shared/format';

/** UC-01 Monitorizar paciente — vista central de la UCI (app móvil / estación). */
@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, TrendChartComponent, ValorSignoPipe, EstadoTextoPipe, ClaseEstadoPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Central de monitorización</h1>
        <p class="muted">Signos vitales en tiempo real de los pacientes de la UCI</p>
      </div>
      <div class="kpis">
        <div class="kpi"><span>Pacientes</span><b>{{ rt.pacientes().length }}</b></div>
        <div class="kpi" [class.kpi--critico]="rt.alarmasActivas().length"><span>Alarmas activas</span><b>{{ rt.alarmasActivas().length }}</b></div>
        <div class="kpi" [class.kpi--critico]="rt.incidentesAbiertos().length"><span>Incidentes</span><b>{{ rt.incidentesAbiertos().length }}</b></div>
        <div class="kpi"><span>Latencia E2E</span><b>{{ rt.latenciaPromedioMs() ?? '--' }}<small> ms</small></b></div>
      </div>
    </div>

    <div class="grid-patients">
      @for (p of rt.pacientes(); track p.id) {
        <article class="pcard" [class.pcard--alarma]="critico(p)" [class.pcard--aviso]="aviso(p)">
          <header class="pcard__head">
            <div>
              <span class="pcard__bed">{{ p.cama }}</span>
              <h3>{{ p.nombre }}</h3>
              <small class="muted">{{ p.edad }} años · {{ p.diagnostico }}</small>
            </div>
            <span [class]="p.estado | claseEstado">{{ p.estado | estadoTexto }}</span>
          </header>

          <div class="vitals">
            <div class="vital vital--fc">
              <span class="vital__lbl">FC <small>BPM</small></span>
              <b class="vital__val">{{ p.ultimasLecturas.FC | valorSigno }}</b>
            </div>
            <div class="vital vital--spo2">
              <span class="vital__lbl">SpO₂ <small>%</small></span>
              <b class="vital__val">{{ p.ultimasLecturas.SPO2 | valorSigno }}</b>
            </div>
            <div class="vital vital--pa">
              <span class="vital__lbl">PA <small>mmHg</small></span>
              <b class="vital__val vital__val--sm">{{ p.ultimasLecturas.PA | valorSigno }}</b>
            </div>
            <div class="vital vital--temp">
              <span class="vital__lbl">Temp <small>°C</small></span>
              <b class="vital__val vital__val--sm">{{ p.ultimasLecturas.TEMP | valorSigno }}</b>
            </div>
          </div>

          <app-trend-chart [puntos]="rt.tendencias()[p.id]?.FC ?? []" [color]="colores.FC" [alto]="48" [compacto]="true" />

          <footer class="pcard__foot">
            <span class="pump" [class.pump--stop]="p.bomba.estado === 'DETENIDA'">
              <i></i>{{ p.bomba.medicamento }} · {{ p.bomba.estado === 'DETENIDA' ? 'DETENIDA' : p.bomba.velocidadMlH + ' ml/h' }}
            </span>
            <div class="pcard__actions">
              <a class="btn btn--ghost btn--sm" [routerLink]="['/historial']" [queryParams]="{ paciente: p.id }">Historial</a>
              <a class="btn btn--primary btn--sm" [routerLink]="['/bedside', p.id]">Bedside</a>
            </div>
          </footer>

          <div class="sim">
            <label>Simulador
              <select [value]="escenarios()[p.id] ?? 'NORMAL'" (change)="cambiar(p.id, $any($event.target).value)">
                @for (e of listaEscenarios; track e) {
                  <option [value]="e">{{ e }}</option>
                }
              </select>
            </label>
          </div>
        </article>
      } @empty {
        <p class="muted">Cargando pacientes…</p>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit {
  protected rt = inject(RealtimeService);
  private api = inject(ApiService);

  protected colores = COLOR_SIGNO;
  protected listaEscenarios: Escenario[] = ['NORMAL', 'TAQUICARDIA', 'BRADICARDIA', 'ANAFILAXIA'];
  protected escenarios = signal<Record<string, Escenario>>({});

  ngOnInit(): void {
    this.api.escenarios().subscribe((l) => this.escenarios.set(Object.fromEntries(l.map((x) => [x.pacienteId, x.escenario]))));
  }

  critico(p: Paciente): boolean {
    return p.estado === 'ALARMA_ACTIVA' || p.estado === 'EMERGENCIA_ANAFILAXIA';
  }

  aviso(p: Paciente): boolean {
    return p.estado === 'ALARMA_CONFIRMADA' || p.estado === 'INFUSION_DETENIDA';
  }

  cambiar(pacienteId: string, escenario: Escenario): void {
    this.api.cambiarEscenario(pacienteId, escenario).subscribe((r) => this.escenarios.update((m) => ({ ...m, [r.pacienteId]: r.escenario })));
  }
}
