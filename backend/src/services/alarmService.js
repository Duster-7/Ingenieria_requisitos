/**
 * RF-01 — Alarma sonora y visual de prioridad alta (FC > 140 o FC < 45 BPM).
 * RF-07 — Registro de la confirmación de lectura de la alarma.
 */
import { crearAlarma, EstadoAlarma, TipoAlarma, TipoSigno } from '../domain/entities.js';
import { Evento } from '../domain/monitoringStateMachine.js';
import { Ev, AppError } from './events.js';

/** Regla pura de umbrales de FC (verificable con valores límite). */
export function evaluarFrecuenciaCardiaca(bpm, { hrHigh, hrLow }) {
  if (bpm > hrHigh) return TipoAlarma.FC_ALTA;
  if (bpm < hrLow) return TipoAlarma.FC_BAJA;
  return null;
}

export class AlarmService {
  constructor({ repo, bus, monitoring, notifications, getThresholds }) {
    this.repo = repo;
    this.bus = bus;
    this.monitoring = monitoring;
    this.notifications = notifications;
    this.getThresholds = getThresholds;
  }

  /** Evalúa una lectura recién ingresada. Devuelve la alarma creada (si la hubo). */
  evaluarLectura(lectura) {
    if (lectura.tipo !== TipoSigno.FC) return null;
    const tipo = evaluarFrecuenciaCardiaca(lectura.valor, this.getThresholds());

    if (!tipo) {
      this._resolverConfirmadasFC(lectura.pacienteId);
      return null;
    }

    const abierta = this.repo.findOpenAlarm(lectura.pacienteId, tipo);
    if (abierta) {
      abierta.ultimoValor = lectura.valor;
      return null;
    }
    return this.crear({
      pacienteId: lectura.pacienteId,
      tipo,
      valor: lectura.valor,
      mensaje:
        tipo === TipoAlarma.FC_ALTA
          ? `Taquicardia: ${lectura.valor} BPM (> ${this.getThresholds().hrHigh})`
          : `Bradicardia: ${lectura.valor} BPM (< ${this.getThresholds().hrLow})`
    });
  }

  crear({ pacienteId, tipo, valor, mensaje, incidenteId = null }) {
    const paciente = this.repo.findPatient(pacienteId);
    const alarma = crearAlarma({ pacienteId, tipo, valor, mensaje });
    alarma.incidenteId = incidenteId;
    alarma.sonora = true;   // RF-01: la UI debe reproducir sonido
    alarma.visual = true;   // RF-01: la UI debe resaltar visualmente
    this.repo.addAlarm(alarma);
    this.repo.audit({ accion: 'ALARMA_EMITIDA', pacienteId, detalle: { alarmaId: alarma.id, tipo, valor } });
    this.bus.emit(Ev.ALARMA_NUEVA, { ...alarma, cama: paciente?.cama, paciente: paciente?.nombre });

    if (tipo !== TipoAlarma.ANAFILAXIA) {
      this.monitoring.aplicar(pacienteId, Evento.UMBRAL_SUPERADO);
      // RF-06: evento crítico -> push al médico
      this.notifications.notificarEventoCritico({
        paciente,
        titulo: `Alarma crítica · ${paciente?.cama}`,
        cuerpo: `${paciente?.nombre}: ${mensaje}`,
        alarmaId: alarma.id
      });
    }
    return alarma;
  }

  /** RF-07 — Confirmar lectura: guarda usuario, paciente, fecha y hora. */
  confirmar(alarmaId, usuario) {
    const alarma = this.repo.findAlarm(alarmaId);
    if (!alarma) throw new AppError(404, 'Alarma no encontrada');
    if (alarma.estado !== EstadoAlarma.ACTIVA) throw new AppError(409, 'La alarma ya fue confirmada');

    alarma.estado = EstadoAlarma.CONFIRMADA;
    alarma.confirmacion = {
      usuarioId: usuario.id,
      usuarioNombre: usuario.nombre,
      rol: usuario.rol,
      pacienteId: alarma.pacienteId,
      fechaHora: new Date().toISOString()
    };
    this.repo.touch();
    this.repo.audit({
      accion: 'ALARMA_CONFIRMADA',
      usuario,
      pacienteId: alarma.pacienteId,
      detalle: { alarmaId: alarma.id, tipo: alarma.tipo }
    });
    this.bus.emit(Ev.ALARMA_ACTUALIZADA, alarma);

    const quedanActivas = this.repo
      .listAlarms({ pacienteId: alarma.pacienteId, estado: EstadoAlarma.ACTIVA })
      .some((a) => a.tipo !== TipoAlarma.ANAFILAXIA);
    if (!quedanActivas) this.monitoring.aplicar(alarma.pacienteId, Evento.ALARMA_CONFIRMADA, usuario);
    return alarma;
  }

  /** Cuando la FC vuelve a rango, las alarmas ya confirmadas se resuelven. */
  _resolverConfirmadasFC(pacienteId) {
    let resueltas = 0;
    for (const a of this.repo.listAlarms({ pacienteId, estado: EstadoAlarma.CONFIRMADA })) {
      if (a.tipo === TipoAlarma.FC_ALTA || a.tipo === TipoAlarma.FC_BAJA) {
        a.estado = EstadoAlarma.RESUELTA;
        a.resueltaEn = new Date().toISOString();
        this.bus.emit(Ev.ALARMA_ACTUALIZADA, a);
        resueltas++;
      }
    }
    if (resueltas) {
      this.repo.touch();
      this.monitoring.aplicar(pacienteId, Evento.VALORES_NORMALES);
    }
  }

  resolverPorIncidente(incidenteId) {
    for (const a of this.repo.state.alarmas) {
      if (a.incidenteId === incidenteId && a.estado !== EstadoAlarma.RESUELTA) {
        a.estado = EstadoAlarma.RESUELTA;
        a.resueltaEn = new Date().toISOString();
        this.bus.emit(Ev.ALARMA_ACTUALIZADA, a);
      }
    }
    this.repo.touch();
  }

  hayAlarmasFCActivas(pacienteId) {
    return this.repo
      .listAlarms({ pacienteId, estado: EstadoAlarma.ACTIVA })
      .some((a) => a.tipo !== TipoAlarma.ANAFILAXIA);
  }
}
