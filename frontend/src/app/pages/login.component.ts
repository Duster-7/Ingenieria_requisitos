import { Component, ElementRef, inject, signal, viewChild, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../core/auth.service';
import { AlarmSoundService } from '../core/alarm-sound.service';

/** UC-04 Autenticar médico — RF-04 (tarjeta RFID). */
@Component({
  selector: 'app-login',
  imports: [FormsModule],
  template: `
    <div class="login">
      <section class="login__panel">
        <div class="login__brand">
          <span class="brand__pulse" aria-hidden="true"></span>
          <h1>MediGuard <b>IoT</b></h1>
          <p>Monitoreo crítico · Unidad de Cuidados Intensivos</p>
        </div>

        <form class="rfid" (ngSubmit)="entrar(rfid)" [class.rfid--leyendo]="cargando()" [class.rfid--error]="error()">
          <div class="rfid__reader" aria-hidden="true">
            <span></span><span></span><span></span>
          </div>
          <h2>Acerque su tarjeta RFID al lector</h2>
          <p class="muted">El lector escribe el identificador automáticamente. También puede teclearlo.</p>
          <input
            #campo
            class="input input--lg"
            name="rfid"
            [(ngModel)]="rfid"
            autocomplete="off"
            placeholder="RFID-XXX-000"
            [disabled]="cargando()"
            aria-label="Identificador RFID"
          />
          <button class="btn btn--primary btn--block" type="submit" [disabled]="cargando() || !rfid.trim()">
            {{ cargando() ? 'Verificando…' : 'Iniciar sesión clínica' }}
          </button>
          @if (error()) {
            <p class="form-error" role="alert">{{ error() }}</p>
          }
        </form>

        <div class="demo-cards">
          <p class="muted">Tarjetas de demostración</p>
          <div class="demo-cards__row">
            @for (c of tarjetas; track c.rfid) {
              <button type="button" class="demo-card" (click)="entrar(c.rfid)" [disabled]="cargando()">
                <span class="demo-card__chip"></span>
                <b>{{ c.nombre }}</b>
                <small>{{ c.rol }} · {{ c.rfid }}</small>
              </button>
            }
            <button type="button" class="demo-card demo-card--bad" (click)="entrar('RFID-DESCONOCIDA-999')" [disabled]="cargando()">
              <span class="demo-card__chip"></span>
              <b>Tarjeta no registrada</b>
              <small>Prueba de rechazo</small>
            </button>
          </div>
        </div>
      </section>
    </div>
  `
})
export class LoginComponent implements AfterViewInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private sonido = inject(AlarmSoundService);
  private campo = viewChild<ElementRef<HTMLInputElement>>('campo');

  protected rfid = '';
  protected cargando = signal(false);
  protected error = signal<string | null>(null);

  protected tarjetas = [
    { rfid: 'RFID-MED-001', nombre: 'Dra. Ana Torres', rol: 'Médico' },
    { rfid: 'RFID-MED-002', nombre: 'Dr. Luis Herrera', rol: 'Médico' },
    { rfid: 'RFID-ENF-001', nombre: 'Enf. María López', rol: 'Enfermería' }
  ];

  ngAfterViewInit(): void {
    this.campo()?.nativeElement.focus();
  }

  async entrar(rfid: string): Promise<void> {
    this.sonido.desbloquear();
    this.error.set(null);
    this.cargando.set(true);
    try {
      await this.auth.loginRfid(rfid);
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        void Notification.requestPermission();
      }
      await this.router.navigate(['/dashboard']);
    } catch (e) {
      const err = e as HttpErrorResponse;
      this.error.set(err.status === 0 ? 'No hay conexión con el servidor (¿backend en ejecución?)' : err.error?.error ?? 'Error de autenticación');
      this.rfid = '';
      setTimeout(() => this.campo()?.nativeElement.focus());
    } finally {
      this.cargando.set(false);
    }
  }
}
