import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { DatePipe } from '@angular/common';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';
import { AlarmSoundService } from '../core/alarm-sound.service';
import { ApiService } from '../core/api.service';
import { TipoAlarmaPipe } from '../shared/format';

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, TipoAlarmaPipe],
  templateUrl: './shell.component.html'
})
export class ShellComponent implements OnInit, OnDestroy {
  protected auth = inject(AuthService);
  protected rt = inject(RealtimeService);
  protected sonido = inject(AlarmSoundService);
  private api = inject(ApiService);

  protected menuAbierto = signal(false);
  protected confirmando = signal<string | null>(null);
  protected error = signal<string | null>(null);
  protected permisoNotif = signal(typeof Notification !== 'undefined' ? Notification.permission : 'denied');

  protected nombreCama = (pacienteId: string) => this.rt.pacientes().find((p) => p.id === pacienteId)?.cama ?? pacienteId;
  protected alarmasBanner = computed(() => this.rt.alarmasActivas().slice(0, 3));

  async ngOnInit(): Promise<void> {
    try {
      await this.rt.conectar();
    } catch {
      this.error.set('No se pudo conectar con la plataforma central. ¿Está el backend en ejecución?');
    }
  }

  ngOnDestroy(): void {
    this.rt.desconectar();
  }

  /** RF-07 desde el banner de alarmas. */
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

  async pedirPermisoNotificaciones(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    this.permisoNotif.set(await Notification.requestPermission());
  }

  alternarSilencio(): void {
    if (this.sonido.silenciado()) this.sonido.reactivar();
    else this.sonido.silenciar(2);
  }

  salir(): void {
    this.rt.desconectar();
    this.auth.logout();
  }
}
