/**
 * Gateway hospitalario (A-04) y Bomba de infusión (A-05).
 * RF-09 — Envío de la orden de paro al gateway y ejecución en la bomba.
 *
 * El transporte hacia el gateway se simula de forma asíncrona; el gateway
 * valida que la orden provenga de un incidente CONFIRMADO antes de ejecutarla.
 */
import { crearOrdenParo, EstadoOrden, EstadoBomba, EstadoIncidente } from '../domain/entities.js';
import { Evento } from '../domain/monitoringStateMachine.js';
import { Ev, AppError } from './events.js';

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export class GatewayService {
  constructor({ repo, bus, monitoring, latenciaRedMs = 40 }) {
    this.repo = repo;
    this.bus = bus;
    this.monitoring = monitoring;
    this.latenciaRedMs = latenciaRedMs;
  }

  async enviarOrdenParo(incidente, usuario) {
    const paciente = this.repo.findPatient(incidente.pacienteId);
    const orden = crearOrdenParo({
      incidenteId: incidente.id,
      pacienteId: paciente.id,
      bombaId: paciente.bomba.id,
      emitidaPor: { id: usuario.id, nombre: usuario.nombre }
    });
    incidente.ordenParo = orden;
    this.repo.audit({ accion: 'ORDEN_PARO_ENVIADA', usuario, pacienteId: paciente.id, detalle: { ordenId: orden.id, bombaId: orden.bombaId } });
    this.bus.emit(Ev.ORDEN_PARO, { ...orden });

    await delay(this.latenciaRedMs); // red hospitalaria -> gateway
    return this._recibirEnGateway(orden, incidente);
  }

  /** Lógica que corre "dentro" del gateway. */
  async _recibirEnGateway(orden, incidente) {
    orden.recibidaEn = new Date().toISOString();
    if (incidente.estado !== EstadoIncidente.CONFIRMADO) {
      orden.estado = EstadoOrden.RECHAZADA;
      orden.motivoRechazo = 'Orden no autorizada: incidente no confirmado';
      this.repo.audit({ accion: 'ORDEN_PARO_RECHAZADA', pacienteId: orden.pacienteId, detalle: { ordenId: orden.id, motivo: orden.motivoRechazo } });
      this.bus.emit(Ev.ORDEN_PARO, { ...orden });
      return orden;
    }
    orden.estado = EstadoOrden.RECIBIDA;
    this.bus.emit(Ev.ORDEN_PARO, { ...orden });

    await delay(Math.round(this.latenciaRedMs / 2)); // gateway -> bomba
    this._detenerBomba(orden.pacienteId);
    orden.estado = EstadoOrden.EJECUTADA;
    orden.ejecutadaEn = new Date().toISOString();
    this.repo.touch();
    this.repo.audit({ accion: 'INFUSION_DETENIDA', pacienteId: orden.pacienteId, detalle: { ordenId: orden.id, bombaId: orden.bombaId } });
    this.bus.emit(Ev.ORDEN_PARO, { ...orden });
    this.monitoring.aplicar(orden.pacienteId, Evento.INFUSION_DETENIDA);
    return orden;
  }

  _detenerBomba(pacienteId) {
    const p = this.repo.findPatient(pacienteId);
    p.bomba.estado = EstadoBomba.DETENIDA;
    p.bomba.actualizadoEn = new Date().toISOString();
    this.bus.emit(Ev.BOMBA_ESTADO, { pacienteId, bomba: { ...p.bomba } });
  }

  reanudarInfusion(pacienteId, usuario) {
    const p = this.repo.findPatient(pacienteId);
    if (!p) throw new AppError(404, 'Paciente no encontrado');
    const abierto = this.repo.findOpenIncident(pacienteId);
    if (abierto) throw new AppError(409, `No se puede reanudar: incidente ${abierto.id} sigue abierto`);
    if (p.bomba.estado === EstadoBomba.INFUNDIENDO) throw new AppError(409, 'La bomba ya está infundiendo');
    p.bomba.estado = EstadoBomba.INFUNDIENDO;
    p.bomba.actualizadoEn = new Date().toISOString();
    this.repo.touch();
    this.repo.audit({ accion: 'INFUSION_REANUDADA', usuario, pacienteId, detalle: { bombaId: p.bomba.id } });
    this.bus.emit(Ev.BOMBA_ESTADO, { pacienteId, bomba: { ...p.bomba } });
    return p.bomba;
  }
}
