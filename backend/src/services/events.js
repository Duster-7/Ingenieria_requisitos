/** Nombres de eventos del bus interno (y de Socket.IO hacia los clientes). */
export const Ev = Object.freeze({
  TELEMETRIA: 'telemetria',
  ALARMA_NUEVA: 'alarma:nueva',
  ALARMA_ACTUALIZADA: 'alarma:actualizada',
  NOTIFICACION_PUSH: 'notificacion:push',
  INCIDENTE_NUEVO: 'incidente:nuevo',
  INCIDENTE_ACTUALIZADO: 'incidente:actualizado',
  ORDEN_PARO: 'orden:paro',
  BOMBA_ESTADO: 'bomba:estado',
  PACIENTE_ESTADO: 'paciente:estado'
});

export class AppError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
