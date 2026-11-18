/**
 * RF-06 — Notificación push al móvil del médico ante un evento crítico.
 * Se publica en el canal en tiempo real `notificacion:push` (sala MEDICO) y el
 * cliente Angular la muestra como notificación del sistema (Notification API).
 */
import { randomUUID } from 'node:crypto';
import { Ev } from './events.js';

export class NotificationService {
  constructor({ bus }) {
    this.bus = bus;
    this.enviadas = [];
  }

  notificarEventoCritico({ paciente, titulo, cuerpo, alarmaId = null, incidenteId = null }) {
    const n = {
      id: `N-${randomUUID().slice(0, 8)}`,
      destinatarioRol: 'MEDICO',
      titulo,
      cuerpo,
      pacienteId: paciente.id,
      cama: paciente.cama,
      alarmaId,
      incidenteId,
      prioridad: 'ALTA',
      enviadaEn: new Date().toISOString()
    };
    this.enviadas.push(n);
    if (this.enviadas.length > 500) this.enviadas.shift();
    this.bus.emit(Ev.NOTIFICACION_PUSH, n);
    return n;
  }

  listar() {
    return [...this.enviadas].reverse();
  }
}
