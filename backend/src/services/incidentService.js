/**
 * Gestión de incidentes de anafilaxia (UC-05, UC-06, UC-07).
 * RF-08 (generación del evento), RF-09 (confirmación -> orden de paro),
 * RF-10 (reporte consolidado del incidente).
 */
import { crearIncidente, EstadoIncidente, TipoAlarma } from '../domain/entities.js';
import { Evento } from '../domain/monitoringStateMachine.js';
import { Ev, AppError } from './events.js';

const VENTANA_PREVIA_MS = 10 * 60 * 1000;

function resumenSerie(lecturas, extraer) {
  const vals = lecturas.map(extraer).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return { muestras: vals.length, min: Math.min(...vals), max: Math.max(...vals), promedio: +(sum / vals.length).toFixed(1) };
}

export class IncidentService {
  constructor({ repo, bus, monitoring, alarms, notifications, gateway }) {
    this.repo = repo;
    this.bus = bus;
    this.monitoring = monitoring;
    this.alarms = alarms;
    this.notifications = notifications;
    this.gateway = gateway;
  }

  /** Callback del detector RF-08. */
  registrarDeteccion({ pacienteId, puntaje, factores, signos }) {
    const paciente = this.repo.findPatient(pacienteId);
    const incidente = crearIncidente({ pacienteId, puntaje, factores, alarmaId: null });
    incidente.signosAlDetectar = signos;
    this.repo.addIncident(incidente);

    const alarma = this.alarms.crear({
      pacienteId,
      tipo: TipoAlarma.ANAFILAXIA,
      valor: puntaje,
      mensaje: `Anafilaxia inminente (puntaje ${puntaje}): ${factores.join(', ')}`,
      incidenteId: incidente.id
    });
    incidente.alarmaId = alarma.id;

    this.repo.audit({ accion: 'ANAFILAXIA_DETECTADA', pacienteId, detalle: { incidenteId: incidente.id, puntaje, factores } });
    this.monitoring.aplicar(pacienteId, Evento.ANAFILAXIA_DETECTADA);
    this.bus.emit(Ev.INCIDENTE_NUEVO, { ...incidente, cama: paciente.cama, paciente: paciente.nombre });
    this.notifications.notificarEventoCritico({
      paciente,
      titulo: `⚠ Anafilaxia inminente · ${paciente.cama}`,
      cuerpo: `${paciente.nombre} — confirme el evento para detener la infusión de ${paciente.bomba.medicamento}.`,
      alarmaId: alarma.id,
      incidenteId: incidente.id
    });
    return incidente;
  }

  _get(id) {
    const inc = this.repo.findIncident(id);
    if (!inc) throw new AppError(404, 'Incidente no encontrado');
    return inc;
  }

  /** RF-09 — Confirmación médica y envío de la orden de paro al gateway. */
  async confirmar(id, usuario) {
    const inc = this._get(id);
    if (inc.estado !== EstadoIncidente.DETECTADO) throw new AppError(409, `El incidente está en estado ${inc.estado}`);
    inc.estado = EstadoIncidente.CONFIRMADO;
    inc.confirmadoPor = { id: usuario.id, nombre: usuario.nombre };
    inc.confirmadoEn = new Date().toISOString();
    this.repo.touch();
    this.repo.audit({ accion: 'ANAFILAXIA_CONFIRMADA', usuario, pacienteId: inc.pacienteId, detalle: { incidenteId: inc.id } });
    this.bus.emit(Ev.INCIDENTE_ACTUALIZADO, { ...inc });

    // La confirmación médica del incidente equivale a la confirmación de lectura de su alarma (RF-07)
    const alarma = inc.alarmaId && this.repo.findAlarm(inc.alarmaId);
    if (alarma?.estado === 'ACTIVA') this.alarms.confirmar(alarma.id, usuario);

    await this.gateway.enviarOrdenParo(inc, usuario);
    this.repo.touch();
    this.bus.emit(Ev.INCIDENTE_ACTUALIZADO, { ...inc });
    return inc;
  }

  descartar(id, usuario, motivo) {
    const inc = this._get(id);
    if (inc.estado !== EstadoIncidente.DETECTADO) throw new AppError(409, `El incidente está en estado ${inc.estado}`);
    inc.estado = EstadoIncidente.DESCARTADO;
    inc.cerradoPor = { id: usuario.id, nombre: usuario.nombre };
    inc.cerradoEn = new Date().toISOString();
    inc.motivoCierre = motivo || 'Falso positivo';
    this.repo.touch();
    this.alarms.resolverPorIncidente(inc.id);
    this.repo.audit({ accion: 'ANAFILAXIA_DESCARTADA', usuario, pacienteId: inc.pacienteId, detalle: { incidenteId: inc.id, motivo: inc.motivoCierre } });
    this.monitoring.aplicar(inc.pacienteId, Evento.INCIDENTE_DESCARTADO, usuario);
    this._reconciliarAlarmas(inc.pacienteId);
    this.bus.emit(Ev.INCIDENTE_ACTUALIZADO, { ...inc });
    return inc;
  }

  resolver(id, usuario, nota) {
    const inc = this._get(id);
    if (inc.estado !== EstadoIncidente.CONFIRMADO) throw new AppError(409, 'Solo se pueden resolver incidentes confirmados');
    inc.estado = EstadoIncidente.RESUELTO;
    inc.cerradoPor = { id: usuario.id, nombre: usuario.nombre };
    inc.cerradoEn = new Date().toISOString();
    inc.motivoCierre = nota || 'Paciente estabilizado';
    this.repo.touch();
    this.alarms.resolverPorIncidente(inc.id);
    this.repo.audit({ accion: 'INCIDENTE_RESUELTO', usuario, pacienteId: inc.pacienteId, detalle: { incidenteId: inc.id, nota: inc.motivoCierre } });
    this.monitoring.aplicar(inc.pacienteId, Evento.INCIDENTE_RESUELTO, usuario);
    this._reconciliarAlarmas(inc.pacienteId);
    this.bus.emit(Ev.INCIDENTE_ACTUALIZADO, { ...inc });
    return inc;
  }

  _reconciliarAlarmas(pacienteId) {
    if (this.alarms.hayAlarmasFCActivas(pacienteId)) this.monitoring.aplicar(pacienteId, Evento.UMBRAL_SUPERADO);
  }

  /** RF-10 — Reporte consolidado del incidente. */
  reporte(id) {
    const inc = this._get(id);
    const paciente = this.repo.findPatient(inc.pacienteId);
    const desde = new Date(new Date(inc.creadoEn).getTime() - VENTANA_PREVIA_MS).toISOString();
    const hasta = inc.cerradoEn || new Date().toISOString();
    const enRango = (iso) => iso >= desde && iso <= hasta;

    const lecturas = this.repo.queryReadings({ pacienteId: paciente.id, desde, hasta });
    const porTipo = (t) => lecturas.filter((l) => l.tipo === t);
    const alarmas = this.repo.listAlarms({ pacienteId: paciente.id }).filter((a) => enRango(a.creadaEn)).reverse();
    const confirmaciones = alarmas.filter((a) => a.confirmacion).map((a) => ({ alarmaId: a.id, tipo: a.tipo, ...a.confirmacion }));
    const acciones = this.repo.listAudit({ pacienteId: paciente.id, limite: 5000 }).filter((r) => enRango(r.fechaHora)).reverse();

    return {
      generadoEn: new Date().toISOString(),
      ventana: { desde, hasta },
      paciente: { id: paciente.id, nombre: paciente.nombre, cama: paciente.cama, edad: paciente.edad, diagnostico: paciente.diagnostico },
      incidente: inc,
      signosVitales: {
        resumen: {
          FC: resumenSerie(porTipo('FC'), (l) => l.valor),
          SPO2: resumenSerie(porTipo('SPO2'), (l) => l.valor),
          PAS: resumenSerie(porTipo('PA'), (l) => l.valor?.sistolica),
          PAD: resumenSerie(porTipo('PA'), (l) => l.valor?.diastolica),
          TEMP: resumenSerie(porTipo('TEMP'), (l) => l.valor)
        },
        totalLecturas: lecturas.length,
        serie: lecturas.slice(-2400)
      },
      alarmas,
      confirmaciones,
      accionesEmergencia: acciones,
      ordenParo: inc.ordenParo
    };
  }
}
