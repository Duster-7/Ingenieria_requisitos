/**
 * Entidades del dominio (corresponden al Diagrama de Clases Completo,
 * 02_PlantUML/02_clases_completo.puml). Se modelan como objetos planos
 * serializables para poder persistirlos cifrados (RNF-02).
 */
import { randomUUID } from 'node:crypto';

export const Rol = Object.freeze({ MEDICO: 'MEDICO', ENFERMERA: 'ENFERMERA' });

export const TipoSigno = Object.freeze({
  FC: 'FC',       // Frecuencia cardíaca (BPM)
  SPO2: 'SPO2',   // Saturación de oxígeno (%)
  PA: 'PA',       // Presión arterial (mmHg) -> { sistolica, diastolica }
  TEMP: 'TEMP'    // Temperatura (°C)
});

export const UnidadSigno = Object.freeze({ FC: 'BPM', SPO2: '%', PA: 'mmHg', TEMP: '°C' });

export const TipoAlarma = Object.freeze({
  FC_ALTA: 'FC_ALTA',
  FC_BAJA: 'FC_BAJA',
  ANAFILAXIA: 'ANAFILAXIA'
});

export const EstadoAlarma = Object.freeze({ ACTIVA: 'ACTIVA', CONFIRMADA: 'CONFIRMADA', RESUELTA: 'RESUELTA' });

export const EstadoIncidente = Object.freeze({
  DETECTADO: 'DETECTADO',
  CONFIRMADO: 'CONFIRMADO',
  DESCARTADO: 'DESCARTADO',
  RESUELTO: 'RESUELTO'
});

export const EstadoOrden = Object.freeze({
  ENVIADA: 'ENVIADA',
  RECIBIDA: 'RECIBIDA',
  EJECUTADA: 'EJECUTADA',
  RECHAZADA: 'RECHAZADA'
});

export const EstadoBomba = Object.freeze({ INFUNDIENDO: 'INFUNDIENDO', DETENIDA: 'DETENIDA' });

const nowIso = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${randomUUID().slice(0, 8)}`;

export function crearLectura({ pacienteId, sensorId, tipo, valor, timestampSensor, seq }) {
  return {
    id: id('L'),
    pacienteId,
    sensorId,
    tipo,
    valor,
    unidad: UnidadSigno[tipo],
    seq: seq ?? null,
    timestampSensor: timestampSensor || nowIso(),
    timestampRecepcion: nowIso()
  };
}

export function crearAlarma({ pacienteId, tipo, valor, mensaje }) {
  return {
    id: id('AL'),
    pacienteId,
    tipo,
    prioridad: 'ALTA',
    valor,
    mensaje,
    estado: EstadoAlarma.ACTIVA,
    creadaEn: nowIso(),
    confirmacion: null
  };
}

export function crearIncidente({ pacienteId, puntaje, factores, alarmaId }) {
  return {
    id: id('INC'),
    pacienteId,
    tipo: 'ANAFILAXIA',
    puntaje,
    factores,
    alarmaId,
    estado: EstadoIncidente.DETECTADO,
    creadoEn: nowIso(),
    confirmadoPor: null,
    confirmadoEn: null,
    cerradoPor: null,
    cerradoEn: null,
    ordenParo: null
  };
}

export function crearOrdenParo({ incidenteId, pacienteId, bombaId, emitidaPor }) {
  return {
    id: id('OP'),
    incidenteId,
    pacienteId,
    bombaId,
    emitidaPor,
    estado: EstadoOrden.ENVIADA,
    enviadaEn: nowIso(),
    recibidaEn: null,
    ejecutadaEn: null,
    motivoRechazo: null
  };
}

export function crearRegistroAuditoria({ accion, usuario, pacienteId, detalle }) {
  return {
    id: id('AU'),
    accion,
    usuarioId: usuario?.id ?? 'SISTEMA',
    usuarioNombre: usuario?.nombre ?? 'Sistema',
    pacienteId: pacienteId ?? null,
    detalle: detalle ?? null,
    fechaHora: nowIso()
  };
}
