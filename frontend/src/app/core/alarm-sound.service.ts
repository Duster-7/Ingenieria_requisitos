import { Injectable, effect, inject, signal } from '@angular/core';
import { RealtimeService } from './realtime.service';

/**
 * RF-01 — Componente sonoro de la alarma de prioridad alta.
 * Patrón de 3 + 2 pulsos (inspirado en IEC 60601-1-8) que se repite
 * mientras existan alarmas ACTIVAS sin confirmar.
 */
@Injectable({ providedIn: 'root' })
export class AlarmSoundService {
  private rt = inject(RealtimeService);
  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private silenciadoHasta = 0;

  readonly silenciado = signal(false);

  constructor() {
    effect(() => {
      const hay = this.rt.alarmasActivas().length > 0;
      if (hay) this.iniciar();
      else this.detener();
    });
  }

  /** Debe llamarse tras un gesto del usuario (p. ej. el login) para habilitar audio. */
  desbloquear(): void {
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* sin soporte de audio */
    }
  }

  silenciar(minutos = 2): void {
    this.silenciadoHasta = Date.now() + minutos * 60_000;
    this.silenciado.set(true);
    setTimeout(() => this.silenciado.set(false), minutos * 60_000);
  }

  reactivar(): void {
    this.silenciadoHasta = 0;
    this.silenciado.set(false);
  }

  private iniciar(): void {
    if (this.timer) return;
    this.patron();
    this.timer = setInterval(() => this.patron(), 2500);
  }

  private detener(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private patron(): void {
    if (!this.ctx || Date.now() < this.silenciadoHasta) return;
    const t0 = this.ctx.currentTime;
    const pulsos = [0, 0.15, 0.3, 0.6, 0.75];
    for (const dt of pulsos) this.pulso(t0 + dt, 880, 0.11);
  }

  private pulso(inicio: number, freq: number, dur: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, inicio);
    gain.gain.linearRampToValueAtTime(0.08, inicio + 0.01);
    gain.gain.setValueAtTime(0.08, inicio + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, inicio + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + dur + 0.01);
  }
}
