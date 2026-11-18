import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { RealtimeService } from '../core/realtime.service';
import { ApiService } from '../core/api.service';
import { Alarma } from '../core/models';
import { TipoAlarmaPipe } from '../shared/format';

type Filtro = 'TODAS' | 'ACTIVA' | 'CONFIRMADA' | 'RESUELTA';

/** UC-03 Gestionar alarma crítica — RF-01 y RF-07 (auditoría de confirmaciones). */
@Component({
  selector: 'app-alarms',
  imports: [DatePipe, RouterLink, TipoAlarmaPipe],
  template: `
    <div class="page-head">
      <div>
        <h1>Alarmas críticas</h1>
        <p class="muted">Emisión, confirmación de lectura y auditoría</p>
      </div>
      <div class="segmented">
        @for (f of filtros; track f) {
          <button [class.is-active]="filtro() === f" (click)="filtro.set(f)">
            {{ etiquetaFiltro[f] }} <span class="muted">{{ conteo()[f] }}</span>
          </button>
        }
      </div>
    </div>

    <section class="card">
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Emitida</th><th>Cama</th><th>Tipo</th><th>Detalle</th><th>Estado</th><th>Confirmación (usuario · fecha y hora)</th><th></th>
            </tr>
          </thead>
          <tbody>
            @for (a of lista(); track a.id) {
              <tr [class.row--critico]="a.estado === 'ACTIVA'">
                <td>{{ a.creadaEn | date: 'dd/MM HH:mm:ss' }}</td>
                <td><a [routerLink]="['/bedside', a.pacienteId]">{{ cama(a) }}</a></td>
                <td><span class="tag" [class.tag--critico]="a.tipo === 'ANAFILAXIA'">{{ a.tipo | tipoAlarma }}</span></td>
                <td>{{ a.mensaje }}</td>
                <td><span class="badge" [class.badge--critico]="a.estado === 'ACTIVA'" [class.badge--aviso]="a.estado === 'CONFIRMADA'" [class.badge--neutro]="a.estado === 'RESUELTA'">{{ a.estado }}</span></td>
                <td>
                  @if (a.confirmacion; as c) {
                    {{ c.usuarioNombre }} · {{ c.fechaHora | date: 'dd/MM/yyyy HH:mm:ss' }}
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
                <td>
                  @if (a.estado === 'ACTIVA') {
                    <button class="btn btn--danger btn--sm" (click)="confirmar(a)" [disabled]="procesando() === a.id">Confirmar</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="muted">No hay alarmas en esta categoría.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class AlarmsComponent {
  protected rt = inject(RealtimeService);
  private api = inject(ApiService);

  protected filtros: Filtro[] = ['ACTIVA', 'CONFIRMADA', 'RESUELTA', 'TODAS'];
  protected etiquetaFiltro: Record<Filtro, string> = { TODAS: 'Todas', ACTIVA: 'Activas', CONFIRMADA: 'Confirmadas', RESUELTA: 'Resueltas' };
  protected filtro = signal<Filtro>('TODAS');
  protected procesando = signal<string | null>(null);

  protected ordenadas = computed(() => [...this.rt.alarmas()].sort((a, b) => b.creadaEn.localeCompare(a.creadaEn)));
  protected lista = computed(() => (this.filtro() === 'TODAS' ? this.ordenadas() : this.ordenadas().filter((a) => a.estado === this.filtro())));
  protected conteo = computed(() => {
    const c: Record<Filtro, number> = { TODAS: 0, ACTIVA: 0, CONFIRMADA: 0, RESUELTA: 0 };
    for (const a of this.rt.alarmas()) {
      c.TODAS++;
      c[a.estado]++;
    }
    return c;
  });

  cama(a: Alarma): string {
    return this.rt.pacientes().find((p) => p.id === a.pacienteId)?.cama ?? a.pacienteId;
  }

  confirmar(a: Alarma): void {
    this.procesando.set(a.id);
    this.api.confirmarAlarma(a.id).subscribe({
      next: (r) => {
        this.rt.actualizarAlarma(r);
        this.procesando.set(null);
      },
      error: () => this.procesando.set(null)
    });
  }
}
