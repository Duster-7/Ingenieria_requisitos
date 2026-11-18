import { Injectable, WritableSignal, computed, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Alarma, Bomba, EstadoMonitorizacion, Incidente, Lectura, NotificacionPush, OrdenParo, Paciente, PresionArterial, TipoSigno } from './models';

export interface PuntoTendencia {
  t: number;
  v: number;
  v2?: number;
}

const MAX_TENDENCIA = 120;

/**
 * Estado en tiempo real de la UCI: telemetría (RF-02), alarmas (RF-01/RF-07),
 * incidentes (RF-08/RF-09) y notificaciones push (RF-06) recibidas por Socket.IO.
 * También mide la latencia extremo a extremo (RNF-01).
 */
@Injectable({ providedIn: 'root' })
export class RealtimeService {
  private api = inject(ApiService);
  private auth = inject(AuthService);
  private socket: Socket | null = null;
  private muestrasLatencia: number[] = [];
  private envioLatencia: ReturnType<typeof setInterval> | null = null;

  readonly conectado = signal(false);
  readonly pacientes = signal<Paciente[]>([]);
  readonly alarmas = signal<Alarma[]>([]);
  readonly incidentes = signal<Incidente[]>([]);
  readonly notificaciones = signal<NotificacionPush[]>([]);
  readonly tendencias = signal<Record<string, Partial<Record<TipoSigno, PuntoTendencia[]>>>>({});
  readonly latenciaMs = signal<number | null>(null);
  readonly latenciaPromedioMs = signal<number | null>(null);
  readonly ultimaOrden = signal<OrdenParo | null>(null);

  readonly alarmasActivas = computed(() => this.alarmas().filter((a) => a.estado === 'ACTIVA'));
  readonly incidentesAbiertos = computed(() => this.incidentes().filter((i) => i.estado === 'DETECTADO' || i.estado === 'CONFIRMADO'));

  pacientePorId(id: string) {
    return computed(() => this.pacientes().find((p) => p.id === id) ?? null);
  }

  async conectar(): Promise<void> {
    if (this.socket) return;
    await this.recargar();

    this.socket = io({ auth: { token: this.auth.token() }, transports: ['websocket', 'polling'] });
    this.socket.on('connect', () => this.conectado.set(true));
    this.socket.on('disconnect', () => this.conectado.set(false));
    this.socket.on('connect_error', () => this.conectado.set(false));

    this.socket.on('telemetria', (l: Lectura) => this.onTelemetria(l));
    this.socket.on('paciente:estado', (e: { pacienteId: string; estado: EstadoMonitorizacion }) =>
      this.parchearPaciente(e.pacienteId, { estado: e.estado })
    );
    this.socket.on('bomba:estado', (e: { pacienteId: string; bomba: Bomba }) => this.parchearPaciente(e.pacienteId, { bomba: e.bomba }));
    this.socket.on('alarma:nueva', (a: Alarma) => this.upsert(this.alarmas, a, true));
    this.socket.on('alarma:actualizada', (a: Alarma) => this.upsert(this.alarmas, a));
    this.socket.on('incidente:nuevo', (i: Incidente) => {
      this.upsert(this.incidentes, i, true);
      this.parchearPaciente(i.pacienteId, { incidenteAbierto: i.id });
    });
    this.socket.on('incidente:actualizado', (i: Incidente) => {
      this.upsert(this.incidentes, i);
      if (i.estado === 'DESCARTADO' || i.estado === 'RESUELTO') this.parchearPaciente(i.pacienteId, { incidenteAbierto: null });
    });
    this.socket.on('orden:paro', (o: OrdenParo) => this.ultimaOrden.set(o));
    this.socket.on('notificacion:push', (n: NotificacionPush) => this.onPush(n));

    // RNF-01: reporta periódicamente la latencia E2E medida en esta pantalla
    this.envioLatencia = setInterval(() => {
      if (this.muestrasLatencia.length && this.socket?.connected) {
        this.socket.emit('metricas:latencia', this.muestrasLatencia.splice(0));
      }
    }, 5000);
  }

  desconectar(): void {
    this.socket?.disconnect();
    this.socket = null;
    if (this.envioLatencia) clearInterval(this.envioLatencia);
    this.conectado.set(false);
  }

  async recargar(): Promise<void> {
    const [pacientes, alarmas, incidentes] = await Promise.all([
      firstValueFrom(this.api.pacientes()),
      firstValueFrom(this.api.alarmas()),
      firstValueFrom(this.api.incidentes())
    ]);
    this.pacientes.set(pacientes);
    this.alarmas.set(alarmas);
    this.incidentes.set(incidentes);
  }

  descartarNotificacion(id: string): void {
    this.notificaciones.update((ns) => ns.filter((n) => n.id !== id));
  }

  actualizarAlarma(a: Alarma): void {
    this.upsert(this.alarmas, a);
  }

  actualizarIncidente(i: Incidente): void {
    this.upsert(this.incidentes, i);
  }

  // ---------------------------------------------------------------------------

  private onTelemetria(l: Lectura): void {
    const lat = Date.now() - Date.parse(l.timestampSensor);
    if (Number.isFinite(lat) && lat >= 0) {
      this.latenciaMs.set(lat);
      this.muestrasLatencia.push(lat);
      const prev = this.latenciaPromedioMs();
      this.latenciaPromedioMs.set(prev == null ? lat : Math.round(prev * 0.9 + lat * 0.1));
    }

    this.pacientes.update((ps) =>
      ps.map((p) => (p.id === l.pacienteId ? { ...p, ultimasLecturas: { ...p.ultimasLecturas, [l.tipo]: l } } : p))
    );

    const t = Date.parse(l.timestampSensor);
    const punto: PuntoTendencia =
      l.tipo === 'PA'
        ? { t, v: (l.valor as PresionArterial).sistolica, v2: (l.valor as PresionArterial).diastolica }
        : { t, v: l.valor as number };
    this.tendencias.update((all) => {
      const delPaciente = { ...(all[l.pacienteId] ?? {}) };
      const serie = [...(delPaciente[l.tipo] ?? []), punto];
      if (serie.length > MAX_TENDENCIA) serie.splice(0, serie.length - MAX_TENDENCIA);
      delPaciente[l.tipo] = serie;
      return { ...all, [l.pacienteId]: delPaciente };
    });
  }

  /** RF-06 — Notificación push: toast en la app + notificación del sistema operativo. */
  private onPush(n: NotificacionPush): void {
    this.notificaciones.update((ns) => [n, ...ns].slice(0, 5));
    setTimeout(() => this.descartarNotificacion(n.id), 15000);
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(n.titulo, { body: n.cuerpo, tag: n.id, requireInteraction: true });
      } catch {
        /* algunos navegadores móviles requieren Service Worker */
      }
    }
  }

  private parchearPaciente(id: string, patch: Partial<Paciente>): void {
    this.pacientes.update((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  private upsert<T extends { id: string }>(sig: WritableSignal<T[]>, item: T, alInicio = false): void {
    sig.update((arr) => {
      const i = arr.findIndex((x) => x.id === item.id);
      if (i >= 0) {
        const copia = [...arr];
        copia[i] = { ...copia[i], ...item };
        return copia;
      }
      return alInicio ? [item, ...arr] : [...arr, item];
    });
  }
}
