/** Aplica la máquina de estados de monitorización a cada paciente. */
import { siguienteEstado, Evento, EstadoMonitorizacion } from '../domain/monitoringStateMachine.js';
import { Ev } from './events.js';

export class MonitoringService {
  constructor({ repo, bus, signalTimeoutMs = 10000 }) {
    this.repo = repo;
    this.bus = bus;
    this.signalTimeoutMs = signalTimeoutMs;
    this.lastSeen = new Map();
    this._watchdog = null;
  }

  /** Intenta aplicar un evento. Devuelve el nuevo estado o null si no aplica. */
  aplicar(pacienteId, evento, usuario = null) {
    const p = this.repo.findPatient(pacienteId);
    if (!p) return null;
    const anterior = p.estado;
    const nuevo = siguienteEstado(anterior, evento);
    if (!nuevo || nuevo === anterior) return null;
    p.estado = nuevo;
    this.repo.touch();
    if (evento !== Evento.LECTURA_RECIBIDA) {
      this.repo.audit({ accion: 'CAMBIO_ESTADO', usuario, pacienteId, detalle: { anterior, nuevo, evento } });
    }
    this.bus.emit(Ev.PACIENTE_ESTADO, { pacienteId, anterior, estado: nuevo, evento, fechaHora: new Date().toISOString() });
    return nuevo;
  }

  registrarSenal(pacienteId) {
    this.lastSeen.set(pacienteId, Date.now());
    this.aplicar(pacienteId, Evento.LECTURA_RECIBIDA);
  }

  /** Vigila la pérdida de señal de los sensores. */
  iniciarWatchdog(intervalMs = 3000) {
    this._watchdog = setInterval(() => {
      const now = Date.now();
      for (const p of this.repo.listPatients()) {
        const t = this.lastSeen.get(p.id);
        if (p.estado !== EstadoMonitorizacion.SIN_SENAL && t && now - t > this.signalTimeoutMs) {
          this.aplicar(p.id, Evento.SENAL_PERDIDA);
        }
      }
    }, intervalMs);
    this._watchdog.unref?.();
  }

  detener() {
    if (this._watchdog) clearInterval(this._watchdog);
  }
}
